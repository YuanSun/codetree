package http

import (
	"context"
	"time"

	"github.com/sjzar/chatlog/internal/chatlog/ports"
	"github.com/sjzar/chatlog/internal/model"
)

type DatabaseStatus interface {
	Status() (state ports.DatabaseState, message string)
	Ready() bool
}

type ChatQuery interface {
	GetMessages(start, end time.Time, talker, sender, keyword string, limit, offset int) ([]*model.Message, error)
	GetMessagesAfter(talker string, cursor model.MessageCursor, limit int) ([]*model.Message, error)
	GetSessions(key string, limit, offset int) (*ports.Sessions, error)
}

type AdvancedMessageSearchQuery interface {
	SearchMessagesAdvanced(context.Context, model.MessageSearchRequest) (model.MessageSearchResult, error)
}

type MessageAnalyticsQuery interface {
	AnalyzeMessages(context.Context, model.MessageAnalyticsRequest) (model.MessageAnalyticsResult, error)
}

type AddressBookQuery interface {
	GetContacts(key string, limit, offset int) (*ports.Contacts, error)
	GetContact(key string) (*model.Contact, error)
	GetChatRooms(key string, limit, offset int) (*ports.ChatRooms, error)
	GetChatRoom(key string) (*model.ChatRoom, error)
}

type MediaQuery interface {
	GetMedia(mediaType, key string) (*model.Media, error)
	GetMediaByName(mediaType, name string, size int64) (*model.Media, error)
}

type DatabaseInspector interface {
	GetDecryptedDBs() (map[string][]string, error)
	GetTables(group, file string) ([]string, error)
	GetTableData(group, file, table string, limit, offset int, keyword string) ([]map[string]interface{}, error)
	StreamTableData(ctx context.Context, group, file, table, keyword string, visit func(columns []string, values []interface{}) error) (int64, error)
	ExecuteSQL(group, file, query string) ([]map[string]interface{}, error)
	StreamSQL(ctx context.Context, group, file, query string, visit func(columns []string, values []interface{}) error) (int64, error)
}

type DetailedDatabaseSearch interface {
	SearchAllDetailed(context.Context, model.DatabaseSearchRequest) (model.DatabaseSearchResult, error)
}

type SocialQuery interface {
	GetSNSTimeline(username string, limit, offset int) ([]map[string]interface{}, error)
}

type HookAdmin interface {
	WakeMessageHook()
	GetMessageHookEvents(limit int) ([]ports.HookEvent, error)
	ClearMessageHookEvents() (int, error)
	CancelMessageHookEvent(eventID, target string) (int64, error)
	RetryMessageHookEvent(eventID, target string) (int64, error)
	DeleteMessageHookEvent(eventID, target string) (int64, error)
	RetryMessageHookEvents(eventIDs []string, target string) (int64, error)
	DeleteMessageHookEvents(eventIDs []string, target string) (int64, error)
	NotifyMessageHookOCR(message *model.Message, ocrText string) (bool, error)
	GetMessageHookStats() (ports.HookRuntimeStats, error)
	MessageHookStorePath() string
}

// Database composes the focused capability interfaces used by HTTP handlers.
type Database interface {
	DatabaseStatus
	ports.MessageChangeFeed
	ChatQuery
	AdvancedMessageSearchQuery
	MessageAnalyticsQuery
	AddressBookQuery
	MediaQuery
	DatabaseInspector
	DetailedDatabaseSearch
	SocialQuery
	HookAdmin
}
