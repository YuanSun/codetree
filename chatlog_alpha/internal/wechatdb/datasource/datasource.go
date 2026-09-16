package datasource

import (
	"context"
	"time"

	"github.com/fsnotify/fsnotify"

	"github.com/sjzar/chatlog/internal/model"
)

type MessageSource interface {
	GetMessages(ctx context.Context, startTime, endTime time.Time, talker string, sender string, keyword string, limit, offset int) ([]*model.Message, error)
	GetMessagesAfter(ctx context.Context, talker string, cursor model.MessageCursor, limit int) ([]*model.Message, error)
	GetMessagesAfterFiles(ctx context.Context, talker string, cursor model.MessageCursor, limit int, changedFiles []string) ([]*model.Message, error)
	ResolveChangedMessageTalkers(ctx context.Context, changedFiles []string, candidates map[string]model.MessageCursor) ([]string, error)
	GetMessage(ctx context.Context, talker string, seq int64) (*model.Message, error)
	SearchMessagesAdvanced(context.Context, model.MessageSearchRequest) (model.MessageSearchResult, error)
	AnalyzeMessages(context.Context, model.MessageAnalyticsRequest) (model.MessageAnalyticsResult, error)
}

type AddressBookSource interface {
	GetContacts(ctx context.Context, key string, limit, offset int) ([]*model.Contact, error)
	GetOpenimWordings(ctx context.Context) ([]*model.OpenimWording, error)
	GetChatRooms(ctx context.Context, key string, limit, offset int) ([]*model.ChatRoom, error)
}

type SessionSource interface {
	GetSessions(ctx context.Context, key string, limit, offset int) ([]*model.Session, error)
}

type MediaSource interface {
	GetMedia(ctx context.Context, _type string, key string) (*model.Media, error)
	GetMediaByName(ctx context.Context, _type string, name string, size int64) (*model.Media, error)
}

type SocialSource interface {
	GetSNSTimeline(ctx context.Context, username string, limit, offset int) ([]map[string]interface{}, error)
}

type ChangeSource interface {
	SetCallback(group string, callback func(event fsnotify.Event) error) error
	SubscribeCallback(group string, callback func(event fsnotify.Event) error) (func(), error)
}

type InspectorSource interface {
	GetDBs() (map[string][]string, error)
	GetTables(group, file string) ([]string, error)
	GetTableData(group, file, table string, limit, offset int, keyword string) ([]map[string]interface{}, error)
	StreamTableData(ctx context.Context, group, file, table, keyword string, visit func(columns []string, values []interface{}) error) (int64, error)
	ExecuteSQL(group, file, query string) ([]map[string]interface{}, error)
	StreamSQL(ctx context.Context, group, file, query string, visit func(columns []string, values []interface{}) error) (int64, error)
	SearchAllDetailed(context.Context, model.DatabaseSearchRequest) (model.DatabaseSearchResult, error)
}

type DataSource interface {
	MessageSource
	AddressBookSource
	SessionSource
	MediaSource
	SocialSource
	ChangeSource
	InspectorSource
	Close() error
}
