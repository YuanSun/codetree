// Package state owns the mutable application configuration and selected
// account. It is the only package that reads or writes chatlog.json.
package state

import (
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/sjzar/chatlog/internal/chatlog/conf"
	"github.com/sjzar/chatlog/internal/wechat"
	clog "github.com/sjzar/chatlog/pkg/log"
	"github.com/sjzar/chatlog/pkg/util"
)

type Snapshot struct {
	Account          string
	PID              int
	Status           string
	ExePath          string
	Platform         string
	Version          int
	FullVersion      string
	DataDir          string
	WorkDir          string
	DataKey          string
	ImageKey         string
	HTTPAddr         string
	LogRetentionDays int
}

type Update struct {
	HTTPAddr         *string
	WorkDir          *string
	DataDir          *string
	DataKey          *string
	ImageKey         *string
	LogRetentionDays *int
}

type Store struct {
	mu         sync.RWMutex
	config     *conf.AppConfig
	repository *conf.Repository

	profiles      map[string]conf.AccountConfig
	current       *wechat.Account
	active        conf.AccountConfig
	runtimeDir    string
	httpAddr      string
	retentionDays int
}

type mutableSnapshot struct {
	profiles      map[string]conf.AccountConfig
	current       *wechat.Account
	currentValue  *wechat.Account
	active        conf.AccountConfig
	httpAddr      string
	retentionDays int
}

func (s *Store) captureLocked() mutableSnapshot {
	snapshot := mutableSnapshot{
		profiles:      make(map[string]conf.AccountConfig, len(s.profiles)),
		current:       s.current,
		active:        s.active,
		httpAddr:      s.httpAddr,
		retentionDays: s.retentionDays,
	}
	for account, profile := range s.profiles {
		snapshot.profiles[account] = profile
	}
	if s.current != nil {
		copyAccount := *s.current
		snapshot.currentValue = &copyAccount
	}
	return snapshot
}

func (s *Store) persistOrRestoreLocked(before mutableSnapshot) error {
	if err := s.persistLocked(); err != nil {
		s.profiles = before.profiles
		s.current = before.current
		if before.current != nil && before.currentValue != nil {
			*before.current = *before.currentValue
		}
		s.active = before.active
		s.httpAddr = before.httpAddr
		s.retentionDays = before.retentionDays
		clog.SetRetention(before.retentionDays)
		return err
	}
	return nil
}

func Open(configPath string) (*Store, error) {
	appConfig, repository, err := conf.OpenRepository(configPath)
	if err != nil {
		return nil, err
	}
	store := &Store{
		config:        appConfig,
		repository:    repository,
		profiles:      appConfig.AccountMap(),
		runtimeDir:    appConfig.ConfigDir,
		httpAddr:      strings.TrimSpace(appConfig.HTTPAddr),
		retentionDays: clog.NormalizeRetentionDays(appConfig.LogRetentionDays),
	}
	if store.httpAddr == "" {
		store.httpAddr = conf.DefaultHTTPAddr
	}
	if profile, ok := store.profiles[appConfig.LastAccount]; ok {
		store.active = normalizeProfile(profile)
	} else {
		store.active = newProfile("")
	}
	clog.SetRetention(store.retentionDays)
	return store, nil
}

func newProfile(account string) conf.AccountConfig {
	return conf.AccountConfig{
		Account:         account,
		OCR:             conf.DefaultOCRConfig(),
		HookKeywordMode: conf.HookKeywordModeText,
		HookNotifyMode:  conf.HookNotifyPost,
		HookBeforeCount: 5,
		HookAfterCount:  5,
	}
}

func normalizeProfile(profile conf.AccountConfig) conf.AccountConfig {
	defaults := newProfile(profile.Account)
	profile.OCR = conf.NormalizeOCRConfig(profile.OCR)
	if profile.HookKeywordMode == "" {
		profile.HookKeywordMode = defaults.HookKeywordMode
	}
	if profile.HookNotifyMode == "" {
		profile.HookNotifyMode = defaults.HookNotifyMode
	}
	if profile.HookBeforeCount < 0 {
		profile.HookBeforeCount = 0
	}
	if profile.HookAfterCount < 0 {
		profile.HookAfterCount = 0
	}
	return profile
}

func (s *Store) Snapshot() Snapshot {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.refreshLocked()
	return Snapshot{
		Account:          s.active.Account,
		PID:              currentPID(s.current),
		Status:           currentStatus(s.current),
		ExePath:          currentExePath(s.current),
		Platform:         s.active.Platform,
		Version:          s.active.Version,
		FullVersion:      s.active.FullVersion,
		DataDir:          s.active.DataDir,
		WorkDir:          s.resolvedWorkDirLocked(),
		DataKey:          s.active.DataKey,
		ImageKey:         s.active.ImgKey,
		HTTPAddr:         s.httpAddr,
		LogRetentionDays: s.retentionDays,
	}
}

func currentPID(account *wechat.Account) int {
	if account == nil {
		return 0
	}
	return int(account.PID)
}

func currentStatus(account *wechat.Account) string {
	if account == nil {
		return ""
	}
	return account.Status
}

func currentExePath(account *wechat.Account) string {
	if account == nil {
		return ""
	}
	return account.ExePath
}

func (s *Store) Profiles() map[string]conf.AccountConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	profiles := make(map[string]conf.AccountConfig, len(s.profiles))
	for account, profile := range s.profiles {
		profiles[account] = profile
	}
	return profiles
}

func (s *Store) SelectProfile(account string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	before := s.captureLocked()
	profile, ok := s.profiles[account]
	if !ok {
		return fmt.Errorf("未找到账号 %s", account)
	}
	s.current = nil
	s.active = normalizeProfile(profile)
	return s.persistOrRestoreLocked(before)
}

func (s *Store) SelectCurrent(account *wechat.Account) error {
	if account == nil {
		return fmt.Errorf("账号不能为空")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	before := s.captureLocked()
	if s.active.Account != account.Name {
		if profile, ok := s.profiles[account.Name]; ok {
			s.active = normalizeProfile(profile)
		} else {
			s.active = newProfile(account.Name)
		}
	}
	s.current = account
	s.refreshLocked()
	return s.persistOrRestoreLocked(before)
}

func (s *Store) ClearSelection() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	before := s.captureLocked()
	s.current = nil
	s.active = newProfile("")
	return s.persistOrRestoreLocked(before)
}

func (s *Store) CurrentAccount() *wechat.Account {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.current == nil {
		return nil
	}
	current := *s.current
	return &current
}

func (s *Store) refreshLocked() {
	if s.current == nil {
		return
	}
	s.active.Account = s.current.Name
	s.active.Platform = s.current.Platform
	s.active.Version = s.current.Version
	s.active.FullVersion = s.current.FullVersion
	if s.current.DataDir != "" {
		s.active.DataDir = s.current.DataDir
	}
	if s.current.Key != "" {
		s.active.DataKey = s.current.Key
	}
	if s.current.ImgKey != "" {
		s.active.ImgKey = s.current.ImgKey
	}
}

func (s *Store) persistLocked() error {
	if s.active.Account != "" {
		s.profiles[s.active.Account] = s.active
	}
	accounts := make([]conf.AccountConfig, 0, len(s.profiles))
	seen := make(map[string]struct{}, len(s.profiles))
	for _, profile := range s.config.Accounts {
		current, ok := s.profiles[profile.Account]
		if !ok || profile.Account == "" {
			continue
		}
		accounts = append(accounts, current)
		seen[profile.Account] = struct{}{}
	}
	for account, profile := range s.profiles {
		if account == "" {
			continue
		}
		if _, ok := seen[account]; !ok {
			accounts = append(accounts, profile)
		}
	}
	next := *s.config
	next.Accounts = accounts
	next.LastAccount = s.active.Account
	next.HTTPAddr = s.httpAddr
	next.LogRetentionDays = s.retentionDays
	if err := s.repository.Save(&next); err != nil {
		return fmt.Errorf("保存应用配置: %w", err)
	}
	*s.config = next
	return nil
}

func (s *Store) resolvedWorkDirLocked() string {
	if strings.TrimSpace(s.active.WorkDir) != "" {
		return s.active.WorkDir
	}
	if s.active.Account == "" {
		return ""
	}
	return util.WorkDirAt(s.GetRuntimeDir(), s.active.Account)
}

func (s *Store) GetAccount() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.active.Account
}

func (s *Store) GetDataDir() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.active.DataDir
}

func (s *Store) GetWorkDir() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.resolvedWorkDirLocked()
}

func (s *Store) GetRuntimeDir() string {
	if strings.TrimSpace(s.runtimeDir) != "" {
		return s.runtimeDir
	}
	return util.AppRootDir()
}

func (s *Store) GetVersion() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.active.Version
}

func (s *Store) GetPID() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.current == nil {
		return 0
	}
	return int(s.current.PID)
}

func (s *Store) GetDataKey() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.active.DataKey
}

func (s *Store) GetHTTPAddr() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.httpAddr
}

// CommitKeys persists one key-capture result as a single configuration
// transaction. A restarted WeChat process may be supplied to atomically update
// both process identity and its account profile.
func (s *Store) CommitKeys(account *wechat.Account, dataDir, dataKey, imageKey string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	before := s.captureLocked()
	if account != nil {
		if s.active.Account != account.Name {
			if profile, ok := s.profiles[account.Name]; ok {
				s.active = normalizeProfile(profile)
			} else {
				s.active = newProfile(account.Name)
			}
		}
		s.current = account
		s.refreshLocked()
	}
	if dataDir = strings.TrimSpace(dataDir); dataDir != "" {
		s.active.DataDir = dataDir
		if s.current != nil {
			s.current.DataDir = dataDir
		}
	}
	if dataKey = strings.TrimSpace(dataKey); dataKey != "" {
		s.active.DataKey = dataKey
		if s.current != nil {
			s.current.Key = dataKey
		}
	}
	if imageKey = strings.TrimSpace(imageKey); imageKey != "" {
		s.active.ImgKey = imageKey
		if s.current != nil {
			s.current.ImgKey = imageKey
		}
	}
	return s.persistOrRestoreLocked(before)
}

func (s *Store) Apply(update Update) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	before := s.captureLocked()
	if update.HTTPAddr != nil {
		s.httpAddr = strings.TrimSpace(*update.HTTPAddr)
	}
	if update.WorkDir != nil {
		s.active.WorkDir = strings.TrimSpace(*update.WorkDir)
	}
	if update.DataDir != nil {
		s.active.DataDir = strings.TrimSpace(*update.DataDir)
		if s.current != nil {
			s.current.DataDir = s.active.DataDir
		}
	}
	if update.DataKey != nil {
		s.active.DataKey = strings.TrimSpace(*update.DataKey)
		if s.current != nil {
			s.current.Key = s.active.DataKey
		}
	}
	if update.ImageKey != nil {
		s.active.ImgKey = strings.TrimSpace(*update.ImageKey)
		if s.current != nil {
			s.current.ImgKey = s.active.ImgKey
		}
	}
	if update.LogRetentionDays != nil {
		s.retentionDays = clog.NormalizeRetentionDays(*update.LogRetentionDays)
		clog.SetRetention(s.retentionDays)
	}
	return s.persistOrRestoreLocked(before)
}

func (s *Store) GetMessageHook() *conf.MessageHook {
	s.mu.RLock()
	defer s.mu.RUnlock()
	snapshot := conf.NormalizeMessageHook(conf.MessageHook{
		Keywords: s.active.HookKeywords, KeywordMode: s.active.HookKeywordMode,
		EffectiveAt: s.active.HookEffectiveAt, NotifyMode: s.active.HookNotifyMode,
		PostURL: s.active.HookPostURL, BeforeCount: s.active.HookBeforeCount,
		AfterCount: s.active.HookAfterCount, ForwardAll: s.active.HookForwardAll,
		ForwardContacts: s.active.HookForwardContacts, ForwardChatRooms: s.active.HookForwardChatRooms,
	})
	return &snapshot
}

func (s *Store) UpdateMessageHook(account string, next conf.MessageHook) error {
	next = conf.NormalizeMessageHook(next)
	s.mu.Lock()
	defer s.mu.Unlock()
	if account = strings.TrimSpace(account); account == "" || s.active.Account != account {
		return fmt.Errorf("账号已切换，请刷新后重试")
	}
	before := s.captureLocked()
	current := conf.MessageHook{
		Keywords: s.active.HookKeywords, KeywordMode: s.active.HookKeywordMode,
		EffectiveAt: s.active.HookEffectiveAt, ForwardAll: s.active.HookForwardAll,
		ForwardContacts: s.active.HookForwardContacts, ForwardChatRooms: s.active.HookForwardChatRooms,
	}
	if !conf.MessageHookRulesEqual(current, next) && next.EffectiveAt <= 0 {
		next.EffectiveAt = time.Now().Unix()
	} else if conf.MessageHookRulesEqual(current, next) {
		next.EffectiveAt = s.active.HookEffectiveAt
	}
	s.active.HookKeywords = next.Keywords
	s.active.HookKeywordMode = next.KeywordMode
	s.active.HookEffectiveAt = next.EffectiveAt
	s.active.HookNotifyMode = next.NotifyMode
	s.active.HookPostURL = next.PostURL
	s.active.HookBeforeCount = next.BeforeCount
	s.active.HookAfterCount = next.AfterCount
	s.active.HookForwardAll = next.ForwardAll
	s.active.HookForwardContacts = next.ForwardContacts
	s.active.HookForwardChatRooms = next.ForwardChatRooms
	return s.persistOrRestoreLocked(before)
}

func (s *Store) GetSaveDecryptedMedia() bool { return true }

func (s *Store) GetOCRConfig() conf.OCRConfig {
	s.mu.RLock()
	ocrConfig := s.active.OCR
	s.mu.RUnlock()
	return conf.OCRConfigWithEnv(ocrConfig)
}

func (s *Store) GetStoredOCRConfig() conf.OCRConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return conf.NormalizeOCRConfig(s.active.OCR)
}

func (s *Store) UpdateOCRConfig(account string, next conf.OCRConfig) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if account = strings.TrimSpace(account); account == "" || s.active.Account != account {
		return fmt.Errorf("账号已切换，请刷新后重试")
	}
	before := s.captureLocked()
	s.active.OCR = conf.NormalizeOCRConfig(next)
	return s.persistOrRestoreLocked(before)
}
