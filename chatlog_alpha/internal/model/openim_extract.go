package model

import (
	"encoding/json"
	"regexp"
)

// openimCorpIDRe 匹配企业微信内部 corp 标识，形如
//
//	XXXXXXXXXXXXXXXX....@im.wxwork
//
// 字符集是大写 hex / 数字 / 字母。这一串和 openim_wording.wording_id 一一对应，
// 是判定 contact 所属企业的唯一稳定 key。
var openimCorpIDRe = regexp.MustCompile(`[A-Z0-9]{16,64}@im\.wxwork`)

// ExtractOpenimCorpID 从 contact.extra_buffer 里抽出 corp_id。返回空串表示不是
// 企业微信联系人，或者数据格式变了。
//
// extra_buffer 是 protobuf 包了一段 JSON：
//
//	{"custom_info":[
//	    {"title":"来自","detail":[{"desc":"企业微信",...}]},
//	    {"title":"企业","detail":[{"desc":"XXXX....@im.wxwork",...}]},
//	    {"title":"实名","detail":[{"desc":"<人名>",...}]},
//	    ...
//	]}
//
// 直接定位 extra_buffer 内的 custom_info JSON，按 `{}` 平衡找终点后解析。
func ExtractOpenimCorpID(extraBuffer []byte) string {
	if len(extraBuffer) == 0 {
		return ""
	}
	// 快速短路：bytes 里没有 @im.wxwork 字面量，肯定不是 openim 联系人
	if openimCorpIDRe.FindIndex(extraBuffer) == nil {
		return ""
	}
	return extractFromCustomInfoJSON(extraBuffer)
}

func extractFromCustomInfoJSON(b []byte) string {
	// 找 `{"custom_info":` 起点
	startMarker := []byte(`{"custom_info":`)
	idx := indexOfBytes(b, startMarker)
	if idx < 0 {
		return ""
	}
	// 平衡 `{}` 找终点
	depth := 0
	end := -1
	for i := idx; i < len(b); i++ {
		switch b[i] {
		case '{':
			depth++
		case '}':
			depth--
			if depth == 0 {
				end = i + 1
			}
		}
		if end > 0 {
			break
		}
	}
	if end < 0 {
		return ""
	}
	var payload struct {
		CustomInfo []struct {
			Title  string `json:"title"`
			Detail []struct {
				Desc string `json:"desc"`
			} `json:"detail"`
		} `json:"custom_info"`
	}
	if err := json.Unmarshal(b[idx:end], &payload); err != nil {
		return ""
	}
	for _, entry := range payload.CustomInfo {
		for _, d := range entry.Detail {
			if loc := openimCorpIDRe.FindStringIndex(d.Desc); loc != nil {
				return d.Desc[loc[0]:loc[1]]
			}
		}
	}
	return ""
}

func indexOfBytes(haystack, needle []byte) int {
	if len(needle) == 0 || len(needle) > len(haystack) {
		return -1
	}
	for i := 0; i+len(needle) <= len(haystack); i++ {
		match := true
		for j := 0; j < len(needle); j++ {
			if haystack[i+j] != needle[j] {
				match = false
				break
			}
		}
		if match {
			return i
		}
	}
	return -1
}
