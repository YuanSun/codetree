package database

import (
	"context"
	stderrors "errors"
	"fmt"
	"sync"
	"time"

	"github.com/rs/zerolog/log"

	"github.com/sjzar/chatlog/internal/chatlog/conf"
	"github.com/sjzar/chatlog/internal/chatlog/ports"
	"github.com/sjzar/chatlog/internal/model"
	"github.com/sjzar/chatlog/internal/wechatdb"
)

const (
	StateInit    = ports.DatabaseStateInit
	StateOpening = ports.DatabaseStateOpening
	StateReady   = ports.DatabaseStateReady
	StateError   = ports.DatabaseStateError
)

type Service struct {
	stateMu    sync.RWMutex
	state      ports.DatabaseState
	stateMsg   string
	conf       Config
	dbMu       sync.RWMutex
	db         *wechatdb.DB
	hookMu     sync.RWMutex
	hookSvc    HookRuntime
	hookCancel context.CancelFunc
	changeFeed *messageChangeCoordinator
	openDB     OpenDB
	openHook   HookFactory
	lifecycle  sync.Mutex
	changeMu   sync.RWMutex
}

var _ ports.MessageChangeFeed = (*Service)(nil)

type OpenDB func(path, dataKey string) (*wechatdb.DB, error)

type StorageConfig interface {
	GetWorkDir() string
	GetDataDir() string
	GetDataKey() string
}

type RuntimeConfig interface {
	GetRuntimeDir() string
	GetHTTPAddr() string
	GetMessageHook() *conf.MessageHook
	// GetAccount 当前激活账号（含 local hex suffix）；server 模式返回空串。
	GetAccount() string
}

type Config interface {
	StorageConfig
	RuntimeConfig
}

func NewService(conf Config, openDB OpenDB, openHook HookFactory) *Service {
	return &Service{
		conf:     conf,
		openDB:   openDB,
		openHook: openHook,
	}
}

func (s *Service) Start() error {
	s.lifecycle.Lock()
	defer s.lifecycle.Unlock()
	if s.hasDatabase() {
		return nil
	}
	s.SetOpening()

	// All runtime database access goes through the built-in direct VFS and
	// points at WeChat's original db_storage.
	dbPath := s.conf.GetDataDir()
	if s.openDB == nil {
		return fmt.Errorf("database opener is not configured")
	}
	db, err := s.openDB(dbPath, s.conf.GetDataKey())
	if err != nil {
		s.SetError(err.Error())
		return err
	}
	s.dbMu.Lock()
	s.db = db
	s.dbMu.Unlock()
	if db != nil {
		changeFeed := newMessageChangeCoordinator(wechatMessageChangeDatabase{db: db})
		if err := changeFeed.Start(); err != nil {
			changeFeed.Stop()
			log.Warn().Err(err).Msg("shared message change coordinator unavailable")
		} else {
			s.changeMu.Lock()
			s.changeFeed = changeFeed
			s.changeMu.Unlock()
		}
	}
	if err := s.initMessageHook(); err != nil {
		log.Error().Err(err).Msg("message hook runtime unavailable; database remains online")
	}
	s.SetReady()
	return nil
}

func (s *Service) Stop() error {
	s.lifecycle.Lock()
	defer s.lifecycle.Unlock()
	return s.stopLocked()
}

func (s *Service) stopLocked() error {
	var errs []error
	s.SetInit()
	if s.hookCancel != nil {
		s.hookCancel()
		s.hookCancel = nil
	}
	s.hookMu.Lock()
	hookSvc := s.hookSvc
	s.hookSvc = nil
	if hookSvc != nil {
		if err := hookSvc.Close(); err != nil {
			errs = append(errs, err)
		}
	}
	s.hookMu.Unlock()
	s.changeMu.Lock()
	if changeFeed := s.changeFeed; changeFeed != nil {
		changeFeed.Stop()
		s.changeFeed = nil
	}
	s.changeMu.Unlock()
	s.dbMu.Lock()
	db := s.db
	s.db = nil
	if db != nil {
		if err := db.Close(); err != nil {
			errs = append(errs, err)
		}
	}
	s.dbMu.Unlock()
	return stderrors.Join(errs...)
}

func (s *Service) SetInit() {
	s.stateMu.Lock()
	s.state = StateInit
	s.stateMsg = ""
	s.stateMu.Unlock()
}

func (s *Service) SetOpening() {
	s.stateMu.Lock()
	s.state = StateOpening
	s.stateMsg = ""
	s.stateMu.Unlock()
}

func (s *Service) SetReady() {
	s.stateMu.Lock()
	s.state = StateReady
	s.stateMsg = ""
	s.stateMu.Unlock()
}

func (s *Service) SetError(msg string) {
	s.stateMu.Lock()
	s.state = StateError
	s.stateMsg = msg
	s.stateMu.Unlock()
}

func (s *Service) hasDatabase() bool {
	if s == nil {
		return false
	}
	s.dbMu.RLock()
	defer s.dbMu.RUnlock()
	return s.db != nil
}

func (s *Service) acquireDatabase() (*wechatdb.DB, func(), error) {
	if s == nil {
		return nil, func() {}, fmt.Errorf("database not ready")
	}
	s.dbMu.RLock()
	if s.db == nil {
		s.dbMu.RUnlock()
		return nil, func() {}, fmt.Errorf("database not ready")
	}
	return s.db, s.dbMu.RUnlock, nil
}

func (s *Service) Status() (ports.DatabaseState, string) {
	if s == nil {
		return StateInit, ""
	}
	s.stateMu.RLock()
	defer s.stateMu.RUnlock()
	return s.state, s.stateMsg
}

func (s *Service) Ready() bool {
	if s == nil {
		return false
	}
	state, _ := s.Status()
	return state == StateReady && s.hasDatabase()
}

func (s *Service) GetMessages(start, end time.Time, talker string, sender string, keyword string, limit, offset int) ([]*model.Message, error) {
	db, release, err := s.acquireDatabase()
	if err != nil {
		return nil, err
	}
	defer release()
	return db.GetMessages(start, end, talker, sender, keyword, limit, offset)
}

func (s *Service) GetMessagesAfter(talker string, cursor model.MessageCursor, limit int) ([]*model.Message, error) {
	db, release, err := s.acquireDatabase()
	if err != nil {
		return nil, err
	}
	defer release()
	return db.GetMessagesAfter(talker, cursor, limit)
}

// SubscribeMessageChanges joins the shared single-read message stream used by
// OCR and push delivery. Consumers keep their own durable business cursors.
func (s *Service) SubscribeMessageChanges(
	name string,
	since time.Time,
	handler ports.MessageChangeHandler,
) (func(), error) {
	if s == nil {
		return nil, fmt.Errorf("message change coordinator is not running")
	}
	s.changeMu.RLock()
	defer s.changeMu.RUnlock()
	if s.changeFeed == nil {
		return nil, fmt.Errorf("message change coordinator is not running")
	}
	return s.changeFeed.Subscribe(name, since, handler)
}

func (s *Service) MessageChangeStats() ports.MessageChangeStats {
	if s == nil {
		return ports.MessageChangeStats{}
	}
	s.changeMu.RLock()
	defer s.changeMu.RUnlock()
	if s.changeFeed == nil {
		return ports.MessageChangeStats{}
	}
	return s.changeFeed.Stats()
}

func (s *Service) SearchMessagesAdvanced(
	ctx context.Context,
	request model.MessageSearchRequest,
) (model.MessageSearchResult, error) {
	db, release, err := s.acquireDatabase()
	if err != nil {
		return model.MessageSearchResult{}, err
	}
	defer release()
	return db.SearchMessagesAdvanced(ctx, request)
}

func (s *Service) AnalyzeMessages(
	ctx context.Context,
	request model.MessageAnalyticsRequest,
) (model.MessageAnalyticsResult, error) {
	db, release, err := s.acquireDatabase()
	if err != nil {
		return model.MessageAnalyticsResult{}, err
	}
	defer release()
	return db.AnalyzeMessages(ctx, request)
}

func (s *Service) GetMessage(talker string, seq int64) (*model.Message, error) {
	db, release, err := s.acquireDatabase()
	if err != nil {
		return nil, err
	}
	defer release()
	return db.GetMessage(talker, seq)
}

func (s *Service) GetContacts(key string, limit, offset int) (*ports.Contacts, error) {
	db, release, err := s.acquireDatabase()
	if err != nil {
		return nil, err
	}
	defer release()
	result, err := db.GetContacts(key, limit, offset)
	if err != nil {
		return nil, err
	}
	return &ports.Contacts{Items: result.Items}, nil
}

func (s *Service) GetContact(key string) (*model.Contact, error) {
	db, release, err := s.acquireDatabase()
	if err != nil {
		return nil, err
	}
	defer release()
	return db.GetContact(key)
}

func (s *Service) GetChatRooms(key string, limit, offset int) (*ports.ChatRooms, error) {
	db, release, err := s.acquireDatabase()
	if err != nil {
		return nil, err
	}
	defer release()
	result, err := db.GetChatRooms(key, limit, offset)
	if err != nil {
		return nil, err
	}
	return &ports.ChatRooms{Items: result.Items}, nil
}

func (s *Service) GetChatRoom(key string) (*model.ChatRoom, error) {
	db, release, err := s.acquireDatabase()
	if err != nil {
		return nil, err
	}
	defer release()
	return db.GetChatRoom(key)
}

// GetSession retrieves session information
func (s *Service) GetSessions(key string, limit, offset int) (*ports.Sessions, error) {
	db, release, err := s.acquireDatabase()
	if err != nil {
		return nil, err
	}
	defer release()
	result, err := db.GetSessions(key, limit, offset)
	if err != nil {
		return nil, err
	}
	return &ports.Sessions{Items: result.Items}, nil
}

func (s *Service) GetMedia(_type string, key string) (*model.Media, error) {
	db, release, err := s.acquireDatabase()
	if err != nil {
		return nil, err
	}
	defer release()
	return db.GetMedia(_type, key)
}

func (s *Service) GetMediaByName(_type string, name string, size int64) (*model.Media, error) {
	db, release, err := s.acquireDatabase()
	if err != nil {
		return nil, err
	}
	defer release()
	return db.GetMediaByName(_type, name, size)
}

func (s *Service) GetDecryptedDBs() (map[string][]string, error) {
	db, release, err := s.acquireDatabase()
	if err != nil {
		return nil, err
	}
	defer release()
	return db.GetDBs()
}

func (s *Service) GetTables(group, file string) ([]string, error) {
	db, release, err := s.acquireDatabase()
	if err != nil {
		return nil, err
	}
	defer release()
	return db.GetTables(group, file)
}

func (s *Service) GetTableData(group, file, table string, limit, offset int, keyword string) ([]map[string]interface{}, error) {
	db, release, err := s.acquireDatabase()
	if err != nil {
		return nil, err
	}
	defer release()
	return db.GetTableData(group, file, table, limit, offset, keyword)
}

func (s *Service) StreamTableData(
	ctx context.Context,
	group string,
	file string,
	table string,
	keyword string,
	visit func(columns []string, values []interface{}) error,
) (int64, error) {
	db, release, err := s.acquireDatabase()
	if err != nil {
		return 0, err
	}
	defer release()
	return db.StreamTableData(ctx, group, file, table, keyword, visit)
}

func (s *Service) ExecuteSQL(group, file, query string) ([]map[string]interface{}, error) {
	db, release, err := s.acquireDatabase()
	if err != nil {
		return nil, err
	}
	defer release()
	return db.ExecuteSQL(group, file, query)
}

func (s *Service) StreamSQL(
	ctx context.Context,
	group string,
	file string,
	query string,
	visit func(columns []string, values []interface{}) error,
) (int64, error) {
	db, release, err := s.acquireDatabase()
	if err != nil {
		return 0, err
	}
	defer release()
	return db.StreamSQL(ctx, group, file, query, visit)
}

func (s *Service) SearchAllDetailed(
	ctx context.Context,
	request model.DatabaseSearchRequest,
) (model.DatabaseSearchResult, error) {
	db, release, err := s.acquireDatabase()
	if err != nil {
		return model.DatabaseSearchResult{}, err
	}
	defer release()
	return db.SearchAllDetailed(ctx, request)
}

func (s *Service) initMessageHook() error {
	if !s.hasDatabase() || s.openHook == nil {
		return nil
	}
	ctx, cancel := context.WithCancel(context.Background())
	s.hookCancel = cancel
	hookSvc, err := s.openHook(s.conf, s)
	if err != nil {
		cancel()
		s.hookCancel = nil
		return err
	}
	s.hookMu.Lock()
	s.hookSvc = hookSvc
	s.hookMu.Unlock()
	go hookSvc.Run(ctx)
	log.Info().Msg("message hook service started")
	return nil
}

// Close closes the database connection
func (s *Service) Close() {
	_ = s.Stop()
}

func (s *Service) WakeMessageHook() {
	if s == nil {
		return
	}
	s.hookMu.RLock()
	defer s.hookMu.RUnlock()
	if s.hookSvc != nil {
		s.hookSvc.Wake()
	}
}

func (s *Service) GetMessageHookEvents(limit int) ([]ports.HookEvent, error) {
	if s == nil {
		return []ports.HookEvent{}, nil
	}
	s.hookMu.RLock()
	defer s.hookMu.RUnlock()
	if s.hookSvc == nil {
		return []ports.HookEvent{}, nil
	}
	return s.hookSvc.RecentEvents(limit)
}

func (s *Service) ClearMessageHookEvents() (int, error) {
	if s == nil {
		return 0, nil
	}
	s.hookMu.RLock()
	defer s.hookMu.RUnlock()
	if s.hookSvc == nil {
		return 0, nil
	}
	return s.hookSvc.ClearEvents()
}

func (s *Service) CancelMessageHookEvent(eventID, target string) (int64, error) {
	if s == nil {
		return 0, nil
	}
	s.hookMu.RLock()
	defer s.hookMu.RUnlock()
	if s.hookSvc == nil {
		return 0, nil
	}
	return s.hookSvc.CancelEvent(eventID, target)
}

func (s *Service) RetryMessageHookEvent(eventID, target string) (int64, error) {
	if s == nil {
		return 0, nil
	}
	s.hookMu.RLock()
	defer s.hookMu.RUnlock()
	if s.hookSvc == nil {
		return 0, nil
	}
	return s.hookSvc.RetryEvent(eventID, target)
}

func (s *Service) DeleteMessageHookEvent(eventID, target string) (int64, error) {
	if s == nil {
		return 0, nil
	}
	s.hookMu.RLock()
	defer s.hookMu.RUnlock()
	if s.hookSvc == nil {
		return 0, nil
	}
	return s.hookSvc.DeleteEvent(eventID, target)
}

func (s *Service) RetryMessageHookEvents(eventIDs []string, target string) (int64, error) {
	if s == nil {
		return 0, nil
	}
	s.hookMu.RLock()
	defer s.hookMu.RUnlock()
	if s.hookSvc == nil {
		return 0, nil
	}
	return s.hookSvc.RetryEvents(eventIDs, target)
}

func (s *Service) DeleteMessageHookEvents(eventIDs []string, target string) (int64, error) {
	if s == nil {
		return 0, nil
	}
	s.hookMu.RLock()
	defer s.hookMu.RUnlock()
	if s.hookSvc == nil {
		return 0, nil
	}
	return s.hookSvc.DeleteEvents(eventIDs, target)
}

func (s *Service) NotifyMessageHookOCR(message *model.Message, ocrText string) (bool, error) {
	if s == nil {
		return false, nil
	}
	s.hookMu.RLock()
	defer s.hookMu.RUnlock()
	if s.hookSvc == nil {
		return false, nil
	}
	return s.hookSvc.NotifyOCRResult(message, ocrText)
}

func (s *Service) GetMessageHookStats() (ports.HookRuntimeStats, error) {
	if s == nil {
		return ports.HookRuntimeStats{}, nil
	}
	s.hookMu.RLock()
	defer s.hookMu.RUnlock()
	if s.hookSvc == nil {
		return ports.HookRuntimeStats{}, nil
	}
	return s.hookSvc.Stats()
}

func (s *Service) MessageHookStorePath() string {
	if s == nil {
		return ""
	}
	s.hookMu.RLock()
	defer s.hookMu.RUnlock()
	if s.hookSvc == nil {
		return ""
	}
	return s.hookSvc.StorePath()
}

// GetSNSTimeline 获取朋友圈时间线数据
func (s *Service) GetSNSTimeline(username string, limit, offset int) ([]map[string]interface{}, error) {
	db, release, err := s.acquireDatabase()
	if err != nil {
		return nil, err
	}
	defer release()
	return db.GetSNSTimeline(username, limit, offset)
}
