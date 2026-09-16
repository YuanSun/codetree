package conf

import (
	"strings"

	clog "github.com/sjzar/chatlog/pkg/log"
)

const DefaultHTTPAddr = "127.0.0.1:5030"

// AppConfig is the single persisted configuration document used by the
// desktop Web application. Network and logging settings are application-wide;
// data, OCR, and delivery settings belong to an account profile.
type AppConfig struct {
	ConfigDir        string          `json:"-"`
	HTTPAddr         string          `json:"http_addr"`
	LogRetentionDays int             `json:"log_retention_days"`
	LastAccount      string          `json:"last_account"`
	Accounts         []AccountConfig `json:"accounts"`
}

type AccountConfig struct {
	Account              string    `json:"account"`
	Platform             string    `json:"platform"`
	Version              int       `json:"version"`
	FullVersion          string    `json:"full_version"`
	DataDir              string    `json:"data_dir"`
	DataKey              string    `json:"data_key"`
	ImgKey               string    `json:"img_key"`
	WorkDir              string    `json:"work_dir"`
	OCR                  OCRConfig `json:"ocr"`
	HookKeywords         string    `json:"hook_keywords"`
	HookKeywordMode      string    `json:"hook_keyword_mode"`
	HookEffectiveAt      int64     `json:"hook_effective_at"`
	HookNotifyMode       string    `json:"hook_notify_mode"`
	HookPostURL          string    `json:"hook_post_url"`
	HookBeforeCount      int       `json:"hook_before_count"`
	HookAfterCount       int       `json:"hook_after_count"`
	HookForwardAll       bool      `json:"hook_forward_all"`
	HookForwardContacts  string    `json:"hook_forward_contacts"`
	HookForwardChatRooms string    `json:"hook_forward_chatrooms"`
}

func (c *AppConfig) Normalize() {
	if strings.TrimSpace(c.HTTPAddr) == "" {
		c.HTTPAddr = DefaultHTTPAddr
	} else {
		c.HTTPAddr = strings.TrimSpace(c.HTTPAddr)
	}
	c.LogRetentionDays = clog.NormalizeRetentionDays(c.LogRetentionDays)
	if c.Accounts == nil {
		c.Accounts = []AccountConfig{}
	}
}

func (c *AppConfig) AccountMap() map[string]AccountConfig {
	profiles := make(map[string]AccountConfig, len(c.Accounts))
	for _, profile := range c.Accounts {
		if profile.Account != "" {
			profiles[profile.Account] = profile
		}
	}
	return profiles
}
