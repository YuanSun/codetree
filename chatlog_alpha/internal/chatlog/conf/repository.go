package conf

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/rs/zerolog/log"

	clog "github.com/sjzar/chatlog/pkg/log"
	"github.com/sjzar/chatlog/pkg/util"
)

const (
	AppName      = "chatlog"
	EnvConfigDir = "CHATLOG_DIR"
	configName   = "chatlog.json"
)

// Repository owns the single application configuration document. Writes use
// an fsync + rename transaction so account switches never expose partial JSON.
type Repository struct {
	mu   sync.Mutex
	dir  string
	path string
}

func OpenRepository(configDir string) (*AppConfig, *Repository, error) {
	configDir = strings.TrimSpace(configDir)
	if configDir == "" {
		configDir = strings.TrimSpace(os.Getenv(EnvConfigDir))
	}
	if configDir == "" {
		configDir = util.AppRootDir()
	}
	absolute, err := filepath.Abs(configDir)
	if err != nil {
		return nil, nil, fmt.Errorf("resolve configuration directory: %w", err)
	}
	configDir = filepath.Clean(absolute)
	if err := os.MkdirAll(configDir, 0o700); err != nil {
		return nil, nil, fmt.Errorf("create configuration directory: %w", err)
	}
	if err := os.Chmod(configDir, 0o700); err != nil {
		return nil, nil, fmt.Errorf("secure configuration directory: %w", err)
	}
	repository := &Repository{dir: configDir, path: filepath.Join(configDir, configName)}
	appConfig, err := repository.load()
	if errors.Is(err, os.ErrNotExist) {
		appConfig = defaultAppConfig(configDir)
		if err := repository.Save(appConfig); err != nil {
			return nil, nil, err
		}
	} else if err != nil {
		return nil, nil, err
	}
	appConfig.ConfigDir = configDir
	appConfig.Normalize()
	logConfig("app config", appConfig)
	return appConfig, repository, nil
}

func defaultAppConfig(configDir string) *AppConfig {
	return &AppConfig{
		ConfigDir:        configDir,
		HTTPAddr:         DefaultHTTPAddr,
		LogRetentionDays: clog.DefaultRetentionDays,
		Accounts:         []AccountConfig{},
	}
}

func (r *Repository) load() (*AppConfig, error) {
	file, err := os.Open(r.path)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	decoder := json.NewDecoder(io.LimitReader(file, 8<<20))
	decoder.DisallowUnknownFields()
	var appConfig AppConfig
	if err := decoder.Decode(&appConfig); err != nil {
		return nil, fmt.Errorf("decode %s: %w", r.path, err)
	}
	if err := ensureJSONEOF(decoder); err != nil {
		return nil, fmt.Errorf("decode %s: %w", r.path, err)
	}
	if err := os.Chmod(r.path, 0o600); err != nil {
		return nil, fmt.Errorf("secure %s: %w", r.path, err)
	}
	return &appConfig, nil
}

func ensureJSONEOF(decoder *json.Decoder) error {
	var extra any
	if err := decoder.Decode(&extra); errors.Is(err, io.EOF) {
		return nil
	} else if err != nil {
		return err
	}
	return fmt.Errorf("configuration contains more than one JSON value")
}

func (r *Repository) Save(appConfig *AppConfig) error {
	if r == nil || appConfig == nil {
		return fmt.Errorf("configuration repository is not initialized")
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	copyConfig := *appConfig
	copyConfig.Normalize()
	temporary, err := os.CreateTemp(r.dir, ".chatlog-*.tmp")
	if err != nil {
		return fmt.Errorf("create configuration transaction: %w", err)
	}
	temporaryPath := temporary.Name()
	committed := false
	defer func() {
		_ = temporary.Close()
		if !committed {
			_ = os.Remove(temporaryPath)
		}
	}()
	if err := temporary.Chmod(0o600); err != nil {
		return fmt.Errorf("secure configuration transaction: %w", err)
	}
	encoder := json.NewEncoder(temporary)
	encoder.SetIndent("", "  ")
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(&copyConfig); err != nil {
		return fmt.Errorf("encode configuration: %w", err)
	}
	if err := temporary.Sync(); err != nil {
		return fmt.Errorf("sync configuration transaction: %w", err)
	}
	if err := temporary.Close(); err != nil {
		return fmt.Errorf("close configuration transaction: %w", err)
	}
	if err := os.Rename(temporaryPath, r.path); err != nil {
		return fmt.Errorf("commit configuration: %w", err)
	}
	committed = true
	if directory, err := os.Open(r.dir); err == nil {
		_ = directory.Sync()
		_ = directory.Close()
	}
	return nil
}

func logConfig(msg string, value any) {
	encoded, err := json.Marshal(value)
	if err != nil {
		log.Info().Msg(msg)
		return
	}
	var payload any
	if err := json.Unmarshal(encoded, &payload); err != nil {
		log.Info().Msg(msg)
		return
	}
	scrubConfigSecrets(payload)
	if scrubbed, err := json.Marshal(payload); err == nil {
		log.Info().Msgf("%s: %s", msg, scrubbed)
	}
}

func scrubConfigSecrets(value any) {
	switch item := value.(type) {
	case map[string]any:
		for key, child := range item {
			if isSensitiveConfigKey(key) {
				if text, ok := child.(string); ok && strings.TrimSpace(text) != "" {
					item[key] = "******"
				}
				continue
			}
			scrubConfigSecrets(child)
		}
	case []any:
		for _, child := range item {
			scrubConfigSecrets(child)
		}
	}
}

func isSensitiveConfigKey(key string) bool {
	normalized := strings.NewReplacer("_", "", "-", "", " ", "").Replace(strings.ToLower(strings.TrimSpace(key)))
	switch normalized {
	case "datakey", "imgkey", "apikey", "clientsecret", "accesstoken", "refreshtoken", "password", "posturl", "hookposturl":
		return true
	}
	return strings.Contains(normalized, "token") || strings.Contains(normalized, "secret") || strings.Contains(normalized, "apikey")
}
