package model

import (
	"strings"
	"time"
)

type Session struct {
	UserName              string    `json:"userName"`
	NOrder                int64     `json:"nOrder"`
	NickName              string    `json:"nickName"`
	Content               string    `json:"content"`
	NTime                 time.Time `json:"nTime"`
	UnreadCount           int64     `json:"unreadCount"`
	LastMsgType           int64     `json:"lastMsgType"`
	LastMsgSubType        int64     `json:"lastMsgSubType"`
	LastMsgSender         string    `json:"lastMsgSender"`
	LastSenderDisplayName string    `json:"lastSenderDisplayName"`
}

func (s *Session) PlainText(limit int) string {
	buf := strings.Builder{}
	buf.WriteString(s.NickName)
	buf.WriteString("(")
	buf.WriteString(s.UserName)
	buf.WriteString(") ")
	buf.WriteString(s.NTime.Format("2006-01-02 15:04:05"))
	buf.WriteString("\n")
	if limit > 0 {
		content := []rune(s.Content)
		if len(content) > limit {
			buf.WriteString(string(content[:limit]))
			buf.WriteString(" <...>")
		} else {
			buf.WriteString(s.Content)
		}
	}
	buf.WriteString("\n")
	return buf.String()
}
