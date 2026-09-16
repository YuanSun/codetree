package chatlog

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"sync"
	"sync/atomic"
	"syscall"

	"github.com/rs/zerolog/log"

	"github.com/sjzar/chatlog/internal/chatlog/database"
	chathttp "github.com/sjzar/chatlog/internal/chatlog/http"
	"github.com/sjzar/chatlog/internal/chatlog/modules"
	"github.com/sjzar/chatlog/internal/chatlog/state"
	"github.com/sjzar/chatlog/internal/chatlog/usecase"
	chatwechat "github.com/sjzar/chatlog/internal/chatlog/wechat"
)

// Application is the process-scoped composition owner. The HTTP control plane
// stays alive while account-scoped database resources are restarted.
type Application struct {
	store    *state.Store
	factory  *modules.Factory
	services *modules.Services
	database *database.Service
	http     *chathttp.Service
	wechat   *chatwechat.Service
	keys     *usecase.Keys

	operationMu     sync.Mutex
	initialized     bool
	restartRequired atomic.Bool
	shuttingDown    atomic.Bool
	lifecycleCtx    context.Context
	lifecycleCancel context.CancelFunc
	workWG          sync.WaitGroup
	shutdownOnce    sync.Once
	shutdownErr     error

	jobsMu    sync.RWMutex
	jobs      map[string]controlJobState
	activeJob string
}

func NewApplication() *Application {
	return NewApplicationWithFactory(modules.DarwinFactory())
}

func NewApplicationWithFactory(factory *modules.Factory) *Application {
	return &Application{factory: factory, jobs: make(map[string]controlJobState)}
}

func (a *Application) Initialize(configPath string) error {
	if a.initialized {
		return nil
	}
	a.lifecycleCtx, a.lifecycleCancel = context.WithCancel(context.Background())
	store, err := state.Open(configPath)
	if err != nil {
		return err
	}
	a.store = store
	if a.factory == nil {
		a.factory = modules.DarwinFactory()
	}
	services, err := a.factory.Build(store, a)
	if err != nil {
		return err
	}
	a.services = services
	a.database = services.Database
	a.http = services.HTTP
	a.wechat = services.WeChat
	a.keys = usecase.NewKeys(store, a.wechat, services.KeyCapture)
	if err := a.selectInitialAccount(); err != nil {
		return err
	}
	a.initialized = true
	return nil
}

func (a *Application) Run(configPath string, consoleReady func(string) error) (runErr error) {
	if err := a.Initialize(configPath); err != nil {
		return err
	}
	if err := a.services.StartConsole(); err != nil {
		return err
	}
	defer func() {
		if err := a.shutdown(); err != nil && runErr == nil {
			runErr = err
		}
	}()
	if consoleReady != nil {
		if err := consoleReady(a.HTTPAddress()); err != nil {
			return err
		}
	}
	if err := a.OpenConsole(); err != nil {
		log.Warn().Err(err).Msg("open Web console")
	}

	if a.databaseConfigured() {
		a.workWG.Add(1)
		go func() {
			defer a.workWG.Done()
			a.operationMu.Lock()
			err := a.startDatabaseLocked()
			a.operationMu.Unlock()
			if err != nil {
				log.Warn().Err(err).Msg("database is unavailable; Web setup remains online")
			}
		}()
	} else {
		log.Info().Msg("Web setup is online; select an account and configure database access")
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	<-ctx.Done()
	log.Info().Msg("收到退出信号，正在关闭 Chatlog Web 控制台")
	return nil
}

func (a *Application) StartService() error {
	a.operationMu.Lock()
	defer a.operationMu.Unlock()
	if !a.initialized {
		return fmt.Errorf("application is not initialized")
	}
	if a.shuttingDown.Load() {
		return fmt.Errorf("application is shutting down")
	}
	if !a.databaseConfigured() {
		return fmt.Errorf("请先配置账号数据目录和数据库密钥")
	}
	a.refreshMediaKeys()
	if err := a.services.StartHTTP(); err != nil {
		return err
	}
	return nil
}

func (a *Application) StopService() error {
	return a.shutdown()
}

func (a *Application) startDatabaseLocked() error {
	if a.services == nil {
		return fmt.Errorf("service graph is not initialized")
	}
	if a.shuttingDown.Load() {
		return context.Canceled
	}
	if err := a.services.StartDatabase(); err != nil {
		return err
	}
	a.refreshMediaKeys()
	if a.http != nil && a.http.IsRunning() {
		return a.http.ResumeAccountRuntime()
	}
	return nil
}

func (a *Application) restoreAccountRuntime(wasActive bool) error {
	if a.http == nil || !a.http.IsRunning() {
		return nil
	}
	if wasActive {
		return a.http.ResumeAccountRuntime()
	}
	a.http.PublishControlOnlyAccount()
	return nil
}

// restartDatabaseAfterSuspendLocked replaces the database while its caller
// owns the account-request writer lease and has detached account producers.
func (a *Application) restartDatabaseAfterSuspendLocked() error {
	if a.services == nil {
		return fmt.Errorf("service graph is not initialized")
	}
	if err := a.services.StopDatabase(); err != nil {
		_ = a.restoreAccountRuntime(false)
		return err
	}
	if !a.databaseConfigured() {
		a.refreshMediaKeys()
		if a.http != nil {
			a.http.PublishControlOnlyAccount()
		}
		return nil
	}
	return a.startDatabaseLocked()
}

func (a *Application) databaseConfigured() bool {
	if a.store == nil {
		return false
	}
	snapshot := a.store.Snapshot()
	return snapshot.Account != "" && snapshot.DataDir != "" && snapshot.DataKey != ""
}

func (a *Application) refreshMediaKeys() {
	if a.store == nil || a.services == nil || a.services.MediaKeys == nil {
		return
	}
	snapshot := a.store.Snapshot()
	a.services.MediaKeys.Configure(snapshot.DataDir, snapshot.ImageKey)
	if snapshot.Version != 4 || snapshot.DataDir == "" {
		return
	}
	if _, err := a.services.MediaKeys.RefreshXOR(snapshot.DataDir); err != nil {
		log.Debug().Err(err).Msg("media XOR refresh did not complete")
	}
}

func (a *Application) HTTPAddress() string {
	if a.store == nil {
		return ""
	}
	return a.store.GetHTTPAddr()
}

func (a *Application) OpenConsole() error {
	return openBrowser(a.HTTPAddress())
}

func (a *Application) shutdown() error {
	a.shutdownOnce.Do(func() {
		a.shuttingDown.Store(true)
		a.jobsMu.Lock()
		if a.lifecycleCancel != nil {
			a.lifecycleCancel()
		}
		a.jobsMu.Unlock()
		a.workWG.Wait()
		a.operationMu.Lock()
		defer a.operationMu.Unlock()
		if a.services != nil {
			a.shutdownErr = a.services.Stop()
		}
	})
	return a.shutdownErr
}

func (a *Application) lifecycleContext() context.Context {
	if a.lifecycleCtx != nil {
		return a.lifecycleCtx
	}
	return context.Background()
}
