package http

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"

	"github.com/sjzar/chatlog/internal/chatlog/conf"
	"github.com/sjzar/chatlog/internal/chatlog/ports"
	"github.com/sjzar/chatlog/internal/errors"
)

type Service struct {
	conf      Config
	db        Database
	imageKeys ImageKeyProvider
	media     ports.MediaCodec
	control   ports.ControlPlane

	router               *gin.Engine
	server               *http.Server
	listen               net.Listener
	serverMu             sync.Mutex
	events               *sseHub
	eventMu              sync.Mutex
	eventCancel          context.CancelFunc
	eventDone            chan struct{}
	eventMessageCancel   func()
	accountGeneration    atomic.Uint64
	accountRuntimeActive atomic.Bool
	accountRequests      sync.RWMutex

	mediaState       *mediaState
	diagnosticsState *diagnosticsState
	ocrState         *ocrState
}

const (
	md5PathCacheLimit     = 20_000
	snsMediaKeyCacheLimit = 4_096
	statsCacheLimit       = 256
)

var runtimeAccessLogSkipPaths = []string{
	"/health",
	"/api/v1/runtime/status",
	"/api/v1/runtime/logs",
	"/api/v1/runtime/file-io/details",
	"/api/v1/runtime/file-io/trace/start",
	"/api/v1/runtime/file-io/trace/stop",
	"/api/v1/runtime/file-io/trace",
	"/api/v1/db/audit",
	"/api/v1/hook/status",
	"/api/v1/hook/events",
	"/api/v1/ocr/status",
	"/api/v1/events",
}

type statsCacheEntry struct {
	Payload   gin.H
	ExpiresAt time.Time
	Snapshot  *chatStatsSnapshot
}

type NetworkConfig interface {
	GetHTTPAddr() string
}

type MediaConfig interface {
	GetDataDir() string
	GetRuntimeDir() string
	GetSaveDecryptedMedia() bool
	GetDataKey() string
	GetWorkDir() string
	GetVersion() int
}

type HookConfig interface {
	GetMessageHook() *conf.MessageHook
	UpdateMessageHook(account string, next conf.MessageHook) error
}

type OCRConfig interface {
	GetOCRConfig() conf.OCRConfig
}

type OCRConfigUpdater interface {
	UpdateOCRConfig(account string, next conf.OCRConfig) error
}

type OCRConfigStorage interface {
	OCRConfig
	OCRConfigUpdater
	GetStoredOCRConfig() conf.OCRConfig
}

type Config interface {
	NetworkConfig
	MediaConfig
	HookConfig
	OCRConfigStorage
	GetAccount() string
	GetPID() int
}

type ImageKeyProvider interface {
	RefreshImageKey(dataDir string) (string, error)
}

func NewService(conf Config, db Database, imageKeys ImageKeyProvider, media ports.MediaCodec, control ports.ControlPlane) *Service {
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	s := &Service{
		conf:             conf,
		db:               db,
		imageKeys:        imageKeys,
		media:            media,
		control:          control,
		router:           router,
		events:           newSSEHub(),
		mediaState:       newMediaState(),
		diagnosticsState: newDiagnosticsState(),
		ocrState:         newOCRState(),
	}
	s.resetRuntimeMetrics(time.Now())
	s.configureOCRLocalService()

	if err := router.SetTrustedProxies(nil); err != nil {
		log.Err(err).Msg("Failed to set trusted proxies")
	}

	router.Use(
		s.runtimeMetricsMiddleware(),
		errors.RecoveryMiddleware(),
		errors.ErrorHandlerMiddleware(),
		// Monitoring traffic (including the long-lived event stream) must not
		// create an access-log write stream merely by observing the service.
		gin.LoggerWithWriter(log.Logger, runtimeAccessLogSkipPaths...),
		securityHeadersMiddleware(),
		corsMiddleware(conf.GetHTTPAddr()),
		requestBodyLimitMiddleware(),
	)

	s.initRouter()
	return s
}

func (s *Service) Start() error {
	srv, listener, err := s.prepareServer()
	if err != nil {
		return err
	}
	s.startEventStream()
	if s.db.Ready() {
		if err := s.ResumeAccountRuntime(); err != nil {
			log.Warn().Err(err).Msg("account runtime is unavailable")
		}
	}
	go func() {
		if err := srv.Serve(listener); err != nil && err != http.ErrServerClosed {
			log.Error().Err(err).Msg("HTTP server stopped unexpectedly")
		}
	}()
	log.Info().Msg("Starting HTTP server on " + listener.Addr().String())
	return nil
}

func (s *Service) prepareServer() (*http.Server, net.Listener, error) {
	s.serverMu.Lock()
	defer s.serverMu.Unlock()
	if s.server != nil {
		return nil, nil, fmt.Errorf("HTTP server is already running")
	}
	addr := strings.TrimSpace(s.conf.GetHTTPAddr())
	if err := ValidateListenAddress(addr); err != nil {
		return nil, nil, err
	}
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		return nil, nil, fmt.Errorf("listen on %s: %w", addr, err)
	}
	srv := &http.Server{
		Addr:              addr,
		Handler:           s.router,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    1 << 20,
	}
	s.server = srv
	s.listen = listener
	s.resetRuntimeMetrics(time.Now())
	return srv, listener, nil
}

// IsRunning reports whether the HTTP server is currently serving requests.
func (s *Service) IsRunning() bool {
	if s == nil {
		return false
	}
	s.serverMu.Lock()
	defer s.serverMu.Unlock()
	return s.server != nil
}

func (s *Service) Stop() error {
	s.serverMu.Lock()
	srv := s.server
	listener := s.listen
	s.server = nil
	s.listen = nil
	s.serverMu.Unlock()
	s.stopRuntimeFileTrace()
	s.stopEventStream()
	if srv == nil {
		releaseRequests := s.LockAccountRequests()
		defer releaseRequests()
		s.stopOCRRuntime()
		s.clearRuntimeCaches()
		s.closeIdleSNSConnections()
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	err := srv.Shutdown(ctx)
	if err != nil {
		if listener != nil {
			_ = listener.Close()
		}
		_ = srv.Close()
	}
	releaseRequests := s.LockAccountRequests()
	defer releaseRequests()
	s.stopOCRRuntime()
	s.clearRuntimeCaches()
	s.closeIdleSNSConnections()
	if err != nil {
		return fmt.Errorf("shutdown HTTP server: %w", err)
	}
	log.Info().Msg("HTTP server stopped")
	return nil
}

func (s *Service) getStatsCache(key string) (gin.H, bool) {
	if strings.TrimSpace(key) == "" {
		return nil, false
	}
	now := time.Now()
	entry, ok := s.diagnosticsState.statsCache.Get(key)
	if !ok {
		return nil, false
	}
	if now.After(entry.ExpiresAt) {
		s.diagnosticsState.statsCache.Delete(key)
		return nil, false
	}
	return cloneStatsPayload(entry.Payload), true
}

func (s *Service) setStatsCache(key string, payload gin.H, ttl time.Duration) {
	if strings.TrimSpace(key) == "" || payload == nil {
		return
	}
	if ttl <= 0 {
		ttl = 60 * time.Second
	}
	now := time.Now()
	expireAt := now.Add(ttl)

	s.diagnosticsState.statsCache.DeleteIf(func(_ string, item statsCacheEntry) bool {
		return now.After(item.ExpiresAt)
	})
	s.diagnosticsState.statsCache.Set(key, statsCacheEntry{
		Payload:   cloneStatsPayload(payload),
		ExpiresAt: expireAt,
	}, statsCacheLimit)
}

func (s *Service) clearRuntimeCaches() {
	s.mediaState.md5PathCache.Clear()
	s.mediaState.snsMediaKeyCache.Clear()
	s.diagnosticsState.statsCache.Clear()
	s.mediaState.decodedImageValidationCache.Clear()
	s.diagnosticsState.databaseAuditMu.Lock()
	s.diagnosticsState.databaseAudit = nil
	s.diagnosticsState.databaseAuditShards = nil
	s.diagnosticsState.databaseAuditMu.Unlock()
}

func (s *Service) closeIdleSNSConnections() {
	s.mediaState.snsHTTPClientMu.Lock()
	client := s.mediaState.snsHTTPClient
	s.mediaState.snsHTTPClientMu.Unlock()
	if client != nil {
		client.CloseIdleConnections()
	}
}

func cloneStatsPayload(in gin.H) gin.H {
	if in == nil {
		return nil
	}
	raw, err := json.Marshal(in)
	if err != nil {
		out := make(gin.H, len(in))
		for k, v := range in {
			out[k] = v
		}
		return out
	}
	var out gin.H
	if err := json.Unmarshal(raw, &out); err != nil {
		out = make(gin.H, len(in))
		for k, v := range in {
			out[k] = v
		}
	}
	return out
}
