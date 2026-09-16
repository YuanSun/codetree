package repository

import (
	"context"
	"sort"
	"strings"
	"time"

	"github.com/sjzar/chatlog/internal/model"
	"github.com/sjzar/chatlog/pkg/util"

	"github.com/rs/zerolog/log"
)

// GetMessages 实现 Repository 接口的 GetMessages 方法
func (r *Repository) GetMessages(ctx context.Context, startTime, endTime time.Time, talker string, sender string, keyword string, limit, offset int) ([]*model.Message, error) {

	talker, sender = r.parseTalkerAndSender(ctx, talker, sender)
	messages, err := r.ds.GetMessages(ctx, startTime, endTime, talker, sender, keyword, limit, offset)
	if err != nil {
		return nil, err
	}

	// 补充消息信息
	if err := r.EnrichMessages(ctx, messages); err != nil {
		log.Debug().Msgf("EnrichMessages failed: %v", err)
	}

	return messages, nil
}

// GetMessagesAfter returns the oldest rows after cursor. Unlike GetMessages it
// never asks the datasource for a newest-first window, so a burst larger than
// the page size cannot create a permanent gap.
func (r *Repository) GetMessagesAfter(ctx context.Context, talker string, cursor model.MessageCursor, limit int) ([]*model.Message, error) {
	talker, _ = r.parseTalkerAndSender(ctx, talker, "")
	messages, err := r.ds.GetMessagesAfter(ctx, talker, cursor, limit)
	if err != nil {
		return nil, err
	}
	if err := r.EnrichMessages(ctx, messages); err != nil {
		log.Debug().Msgf("EnrichMessages after cursor failed: %v", err)
	}
	return messages, nil
}

func (r *Repository) ResolveChangedMessageTalkers(
	ctx context.Context,
	changedFiles []string,
	candidates map[string]model.MessageCursor,
) ([]string, error) {
	return r.ds.ResolveChangedMessageTalkers(ctx, changedFiles, candidates)
}

func (r *Repository) GetMessagesAfterFiles(
	ctx context.Context,
	talker string,
	cursor model.MessageCursor,
	limit int,
	changedFiles []string,
) ([]*model.Message, error) {
	talker, _ = r.parseTalkerAndSender(ctx, talker, "")
	messages, err := r.ds.GetMessagesAfterFiles(ctx, talker, cursor, limit, changedFiles)
	if err != nil {
		return nil, err
	}
	if err := r.EnrichMessages(ctx, messages); err != nil {
		log.Debug().Msgf("EnrichMessages after changed files failed: %v", err)
	}
	return messages, nil
}

// GetMessage 获取单条消息
func (r *Repository) GetMessage(ctx context.Context, talker string, seq int64) (*model.Message, error) {
	// 如果传入的是昵称，尝试转换为 ID
	if contact, _ := r.GetContact(ctx, talker); contact != nil {
		talker = contact.UserName
	}

	msg, err := r.ds.GetMessage(ctx, talker, seq)
	if err != nil {
		return nil, err
	}

	r.enrichMessage(msg)
	return msg, nil
}

// EnrichMessages 补充消息的额外信息
func (r *Repository) EnrichMessages(ctx context.Context, messages []*model.Message) error {
	for _, msg := range messages {
		r.enrichMessage(msg)
	}
	return nil
}

// enrichMessage 补充单条消息的额外信息
func (r *Repository) enrichMessage(msg *model.Message) {
	// 处理群聊消息
	if msg.IsChatRoom {
		// 补充群聊名称
		r.cacheMu.RLock()
		if chatRoom, ok := r.chatRoomCache[msg.Talker]; ok {
			msg.TalkerName = chatRoom.DisplayName()

			// 补充发送者在群里的显示名称
			if displayName, ok := chatRoom.User2DisplayName[msg.Sender]; ok {
				msg.SenderName = displayName
			}
		}
		r.cacheMu.RUnlock()
	}

	// 如果不是自己发送的消息且还没有显示名称，尝试补充发送者信息
	if msg.SenderName == "" && !msg.IsSelf {
		contact := r.getFullContact(msg.Sender)
		if contact != nil {
			msg.SenderName = contact.DisplayName()
		}
	}
}

func (r *Repository) parseTalkerAndSender(ctx context.Context, talker, sender string) (string, string) {
	displayName2Users := make(map[string]map[string]struct{})
	users := make(map[string]struct{})
	addDisplayName := func(displayName, user string) {
		displayName = strings.TrimSpace(displayName)
		user = strings.TrimSpace(user)
		if displayName == "" || user == "" {
			return
		}
		matches := displayName2Users[displayName]
		if matches == nil {
			matches = make(map[string]struct{})
			displayName2Users[displayName] = matches
		}
		matches[user] = struct{}{}
	}

	talkers := util.Str2List(talker, ",")
	if len(talkers) > 0 {
		for i := 0; i < len(talkers); i++ {
			if contact, _ := r.GetContact(ctx, talkers[i]); contact != nil {
				talkers[i] = contact.UserName
			} else if chatRoom, _ := r.GetChatRoom(ctx, talkers[i]); chatRoom != nil {
				talkers[i] = chatRoom.Name
			}
		}
		// 获取群聊的用户列表
		for i := 0; i < len(talkers); i++ {
			if chatRoom, _ := r.GetChatRoom(ctx, talkers[i]); chatRoom != nil {
				for user, displayName := range chatRoom.User2DisplayName {
					addDisplayName(displayName, user)
				}
				for _, user := range chatRoom.Users {
					users[user.UserName] = struct{}{}
				}
			}
		}
		talker = strings.Join(talkers, ",")
	}

	senders := util.Str2List(sender, ",")
	if len(senders) > 0 {
		resolved := make([]string, 0, len(senders))
		seen := make(map[string]struct{})
		for _, requested := range senders {
			matches := displayName2Users[requested]
			if len(matches) == 0 {
				matches = make(map[string]struct{})
				for user := range users {
					if contact := r.getFullContact(user); contact != nil && contact.DisplayName() == requested {
						matches[user] = struct{}{}
					}
				}
			}
			if len(matches) == 0 {
				matches = map[string]struct{}{requested: {}}
			}
			ordered := make([]string, 0, len(matches))
			for user := range matches {
				ordered = append(ordered, user)
			}
			sort.Strings(ordered)
			for _, user := range ordered {
				if _, exists := seen[user]; exists {
					continue
				}
				seen[user] = struct{}{}
				resolved = append(resolved, user)
			}
		}
		sender = strings.Join(resolved, ",")
	}

	return talker, sender
}

// ResolveTalkers converts display names accepted by the HTTP API into stable
// database usernames before optimized datasource searches apply their scope.
func (r *Repository) ResolveTalkers(ctx context.Context, talkers []string) []string {
	resolved, _ := r.parseTalkerAndSender(ctx, strings.Join(talkers, ","), "")
	return util.Str2List(resolved, ",")
}
