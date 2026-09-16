package wechatdb

import (
	"context"
	"time"

	"github.com/fsnotify/fsnotify"
	_ "github.com/mattn/go-sqlite3"

	"github.com/sjzar/chatlog/internal/model"
	"github.com/sjzar/chatlog/internal/wechatdb/datasource"
	"github.com/sjzar/chatlog/internal/wechatdb/repository"
)

type DB struct {
	ds   datasource.DataSource
	repo *repository.Repository
}

func New(ds datasource.DataSource) (*DB, error) {
	w := &DB{ds: ds}
	repo, err := repository.New(ds)
	if err != nil {
		_ = ds.Close()
		return nil, err
	}
	w.repo = repo
	return w, nil
}

func (w *DB) Close() error {
	if w.repo != nil {
		return w.repo.Close()
	}
	return nil
}

func (w *DB) GetMessages(start, end time.Time, talker string, sender string, keyword string, limit, offset int) ([]*model.Message, error) {
	ctx := context.Background()

	// 使用 repository 获取消息
	messages, err := w.repo.GetMessages(ctx, start, end, talker, sender, keyword, limit, offset)
	if err != nil {
		return nil, err
	}

	return messages, nil
}

func (w *DB) GetMessagesAfter(talker string, cursor model.MessageCursor, limit int) ([]*model.Message, error) {
	return w.repo.GetMessagesAfter(context.Background(), talker, cursor, limit)
}

func (w *DB) ResolveChangedMessageTalkers(
	changedFiles []string,
	candidates map[string]model.MessageCursor,
) ([]string, error) {
	return w.repo.ResolveChangedMessageTalkers(context.Background(), changedFiles, candidates)
}

func (w *DB) GetMessagesAfterFiles(
	talker string,
	cursor model.MessageCursor,
	limit int,
	changedFiles []string,
) ([]*model.Message, error) {
	return w.repo.GetMessagesAfterFiles(context.Background(), talker, cursor, limit, changedFiles)
}

func (w *DB) SearchMessagesAdvanced(
	ctx context.Context,
	request model.MessageSearchRequest,
) (model.MessageSearchResult, error) {
	request.Talkers = w.repo.ResolveTalkers(ctx, request.Talkers)
	result, err := w.ds.SearchMessagesAdvanced(ctx, request)
	if err != nil {
		return result, err
	}
	if err := w.repo.EnrichMessages(ctx, result.Messages); err != nil {
		return result, err
	}
	return result, nil
}

func (w *DB) AnalyzeMessages(
	ctx context.Context,
	request model.MessageAnalyticsRequest,
) (model.MessageAnalyticsResult, error) {
	request.Talkers = w.repo.ResolveTalkers(ctx, request.Talkers)
	return w.ds.AnalyzeMessages(ctx, request)
}

func (w *DB) GetMessage(talker string, seq int64) (*model.Message, error) {
	return w.repo.GetMessage(context.Background(), talker, seq)
}

type GetContactsResp struct {
	Items []*model.Contact `json:"items"`
}

func (w *DB) GetContacts(key string, limit, offset int) (*GetContactsResp, error) {
	ctx := context.Background()

	contacts, err := w.repo.GetContacts(ctx, key, limit, offset)
	if err != nil {
		return nil, err
	}

	return &GetContactsResp{
		Items: contacts,
	}, nil
}

func (w *DB) GetContact(key string) (*model.Contact, error) {
	return w.repo.GetContact(context.Background(), key)
}

type GetChatRoomsResp struct {
	Items []*model.ChatRoom `json:"items"`
}

func (w *DB) GetChatRooms(key string, limit, offset int) (*GetChatRoomsResp, error) {
	ctx := context.Background()

	chatRooms, err := w.repo.GetChatRooms(ctx, key, limit, offset)
	if err != nil {
		return nil, err
	}

	return &GetChatRoomsResp{
		Items: chatRooms,
	}, nil
}

func (w *DB) GetChatRoom(key string) (*model.ChatRoom, error) {
	return w.repo.GetChatRoom(context.Background(), key)
}

type GetSessionsResp struct {
	Items []*model.Session `json:"items"`
}

func (w *DB) GetSessions(key string, limit, offset int) (*GetSessionsResp, error) {
	ctx := context.Background()

	// 使用 repository 获取会话列表
	sessions, err := w.repo.GetSessions(ctx, key, limit, offset)
	if err != nil {
		return nil, err
	}

	return &GetSessionsResp{
		Items: sessions,
	}, nil
}

func (w *DB) GetMedia(_type string, key string) (*model.Media, error) {
	return w.repo.GetMedia(context.Background(), _type, key)
}

func (w *DB) GetMediaByName(_type string, name string, size int64) (*model.Media, error) {
	return w.repo.GetMediaByName(context.Background(), _type, name, size)
}

func (w *DB) SetCallback(group string, callback func(event fsnotify.Event) error) error {
	return w.ds.SetCallback(group, callback)
}

// SubscribeCallback is the cancellable form used by feature runtimes whose
// lifetime is shorter than the database itself.
func (w *DB) SubscribeCallback(group string, callback func(event fsnotify.Event) error) (func(), error) {
	return w.ds.SubscribeCallback(group, callback)
}

func (w *DB) GetDBs() (map[string][]string, error) {
	return w.ds.GetDBs()
}

func (w *DB) GetTables(group, file string) ([]string, error) {
	return w.ds.GetTables(group, file)
}

func (w *DB) GetTableData(group, file, table string, limit, offset int, keyword string) ([]map[string]interface{}, error) {
	return w.ds.GetTableData(group, file, table, limit, offset, keyword)
}

func (w *DB) StreamTableData(
	ctx context.Context,
	group string,
	file string,
	table string,
	keyword string,
	visit func(columns []string, values []interface{}) error,
) (int64, error) {
	return w.ds.StreamTableData(ctx, group, file, table, keyword, visit)
}

func (w *DB) ExecuteSQL(group, file, query string) ([]map[string]interface{}, error) {
	return w.ds.ExecuteSQL(group, file, query)
}

func (w *DB) StreamSQL(
	ctx context.Context,
	group string,
	file string,
	query string,
	visit func(columns []string, values []interface{}) error,
) (int64, error) {
	return w.ds.StreamSQL(ctx, group, file, query, visit)
}

func (w *DB) SearchAllDetailed(
	ctx context.Context,
	request model.DatabaseSearchRequest,
) (model.DatabaseSearchResult, error) {
	return w.ds.SearchAllDetailed(ctx, request)
}

// GetSNSTimeline 获取朋友圈时间线数据
func (w *DB) GetSNSTimeline(username string, limit, offset int) ([]map[string]interface{}, error) {
	return w.ds.GetSNSTimeline(context.Background(), username, limit, offset)
}
