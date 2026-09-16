package model

type Contact struct {
	UserName     string `json:"userName"`
	Alias        string `json:"alias"`
	Remark       string `json:"remark"`
	NickName     string `json:"nickName"`
	Description  string `json:"description"`
	IsFriend     bool   `json:"isFriend"`
	BigHeadURL   string `json:"bigHeadUrl,omitempty"`
	SmallHeadURL string `json:"smallHeadUrl,omitempty"`

	// Enterprise WeChat (企业微信，@openim 后缀) 联系人专属。普通 wxid 这两个字段一直空。
	// CorpID 来自 contact.extra_buffer 的 protobuf JSON 里的 "...@im.wxwork" 字段，
	// 对应 openim_wording.wording_id；CorpName 是 openim_wording.wording。
	CorpID   string `json:"corpId,omitempty"`
	CorpName string `json:"corpName,omitempty"`
}

func (c *Contact) DisplayName() string {
	switch {
	case c.Remark != "":
		return c.Remark
	case c.NickName != "":
		return c.NickName
	}
	return ""
}
