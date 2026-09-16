package http

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"net/url"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/sjzar/chatlog/internal/errors"
	"github.com/sjzar/chatlog/internal/model"
	"github.com/sjzar/chatlog/pkg/util"
)

func (s *Service) decryptSNSMedia(ctx context.Context, data []byte, key string) ([]byte, string, error) {
	rawMime := detectSNSMimeStrict(data)
	if strings.HasPrefix(rawMime, "image/") {
		return data, rawMime, nil
	}

	if strings.TrimSpace(key) == "" {
		if strings.HasPrefix(rawMime, "video/") {
			return data, rawMime, nil
		}
		return nil, "", errors.QueryFailed("sns media decrypt key missing", nil)
	}
	_, err := strconv.ParseUint(strings.TrimSpace(key), 10, 64)
	if err != nil {
		return nil, "", errors.QueryFailed("invalid sns media decrypt key", err)
	}

	// 先按图片全量 XOR 尝试。实测朋友圈图片同样优先使用 reversed keystream。
	imageModes := []bool{true, false}
	decoded := make([]byte, len(data))
	for _, reversed := range imageModes {
		copy(decoded, data)
		stream, streamErr := s.getSNSKeystream(ctx, key, len(decoded), reversed)
		if streamErr != nil {
			return nil, "", errors.QueryFailed("sns wasm keystream failed", streamErr)
		}
		for i := range decoded {
			decoded[i] ^= stream[i]
		}
		imgMime := detectSNSMime(decoded, "")
		if strings.HasPrefix(imgMime, "image/") {
			return decoded, imgMime, nil
		}
	}

	// 再按视频头部窗口 XOR 尝试。
	copy(decoded, data)
	window := len(decoded)
	if window > snsVideoDecryptWindow {
		window = snsVideoDecryptWindow
	}
	stream, streamErr := s.getSNSKeystream(ctx, key, window, true)
	if streamErr != nil {
		return nil, "", errors.QueryFailed("sns wasm keystream failed", streamErr)
	}
	for i := 0; i < window; i++ {
		decoded[i] ^= stream[i]
	}
	videoMime := detectSNSMime(decoded, "")
	if strings.HasPrefix(videoMime, "video/") {
		return decoded, videoMime, nil
	}

	return nil, "", errors.QueryFailed("sns media decrypt failed", nil)
}

func (s *Service) getSNSKeystream(ctx context.Context, key string, size int, reverse bool) ([]byte, error) {
	if strings.TrimSpace(key) == "" {
		return nil, fmt.Errorf("missing key")
	}
	mode := "raw"
	if reverse {
		mode = "reversed"
	}
	stream, err := s.getSNSWasmKeystream(ctx, key, size, mode)
	if err != nil {
		return nil, err
	}
	if len(stream) != size {
		return nil, fmt.Errorf("sns wasm keystream returned %d bytes, want %d", len(stream), size)
	}
	return stream, nil
}

func detectSNSMime(buf []byte, fallback string) string {
	if strict := detectSNSMimeStrict(buf); strict != "" {
		return strict
	}
	if strings.Contains(strings.ToLower(fallback), "image/") || strings.Contains(strings.ToLower(fallback), "video/") {
		return fallback
	}
	return "application/octet-stream"
}

func detectSNSMimeStrict(buf []byte) string {
	if len(buf) >= 3 && buf[0] == 0xff && buf[1] == 0xd8 && buf[2] == 0xff {
		return "image/jpeg"
	}
	if len(buf) >= 8 && buf[0] == 0x89 && buf[1] == 0x50 && buf[2] == 0x4e && buf[3] == 0x47 {
		return "image/png"
	}
	if len(buf) >= 6 && string(buf[:6]) == "GIF87a" || len(buf) >= 6 && string(buf[:6]) == "GIF89a" {
		return "image/gif"
	}
	if len(buf) >= 12 && string(buf[:4]) == "RIFF" && string(buf[8:12]) == "WEBP" {
		return "image/webp"
	}
	if len(buf) >= 12 && string(buf[4:8]) == "ftyp" {
		head := strings.ToLower(string(buf[8:minIntLocal(len(buf), 32)]))
		if strings.Contains(head, "heic") || strings.Contains(head, "heix") || strings.Contains(head, "hevc") || strings.Contains(head, "mif1") {
			return "image/heic"
		}
		return "video/mp4"
	}
	return ""
}

func fixSNSURL(rawURL, token string, isVideo bool) string {
	fixed := strings.TrimSpace(rawURL)
	if fixed == "" {
		return ""
	}
	fixed = strings.Replace(fixed, "http://", "https://", 1)
	if !isVideo {
		fixed = strings.ReplaceAll(fixed, "/150?", "/0?")
		if strings.HasSuffix(fixed, "/150") {
			fixed = strings.TrimSuffix(fixed, "/150") + "/0"
		}
	}
	if token == "" || strings.Contains(fixed, "token=") {
		return fixed
	}
	if isVideo {
		parts := strings.SplitN(fixed, "?", 2)
		if len(parts) == 2 {
			return parts[0] + "?token=" + url.QueryEscape(token) + "&idx=1&" + parts[1]
		}
		return fixed + "?token=" + url.QueryEscape(token) + "&idx=1"
	}
	connector := "?"
	if strings.Contains(fixed, "?") {
		connector = "&"
	}
	return fixed + connector + "token=" + url.QueryEscape(token) + "&idx=1"
}

func fixSNSArticleCoverURL(rawURL, token string) string {
	fixed := strings.TrimSpace(rawURL)
	if fixed == "" {
		return ""
	}
	fixed = strings.Replace(fixed, "http://", "https://", 1)
	if token == "" || strings.Contains(fixed, "token=") {
		return fixed
	}
	connector := "?"
	if strings.Contains(fixed, "?") {
		connector = "&"
	}
	return fixed + connector + "token=" + url.QueryEscape(token) + "&idx=1"
}

func (s *Service) enrichSNSPostMedia(c *gin.Context, post *model.SNSPost) []gin.H {
	mediaEnabled := strings.TrimSpace(c.DefaultQuery("media", "1")) != "0"
	replace := strings.TrimSpace(c.DefaultQuery("replace", "1")) != "0"
	result := make([]gin.H, 0, len(post.MediaList))
	for _, media := range post.MediaList {
		isVideo := media.Type == "video"
		rawURL := fixSNSURL(media.URL, media.Token, isVideo)
		rawThumb := fixSNSURL(media.ThumbURL, media.Token, false)
		item := gin.H{
			"type":      media.Type,
			"url":       rawURL,
			"thumb":     rawThumb,
			"token":     media.Token,
			"key":       media.Key,
			"md5":       media.MD5,
			"enc_idx":   media.EncIdx,
			"width":     media.Width,
			"height":    media.Height,
			"duration":  media.Duration,
			"raw_url":   rawURL,
			"raw_thumb": rawThumb,
		}
		s.rememberSNSMediaKey(rawURL, media.Key)
		s.rememberSNSMediaKey(rawThumb, media.Key)
		if mediaEnabled {
			proxyURL := s.buildSNSMediaProxyURL(c, rawURL, media.Key)
			proxyThumb := s.buildSNSMediaProxyURL(c, rawThumb, media.Key)
			item["proxy_url"] = proxyURL
			item["proxy_thumb_url"] = proxyThumb
			item["resolved_url"] = proxyURL
			item["resolved_thumb_url"] = proxyThumb
			if replace {
				if proxyURL != "" {
					item["url"] = proxyURL
				}
				if proxyThumb != "" {
					item["thumb"] = proxyThumb
				}
			}
		}

		if media.LivePhoto != nil {
			liveURL := fixSNSURL(media.LivePhoto.URL, media.LivePhoto.Token, true)
			liveThumb := fixSNSURL(media.LivePhoto.ThumbURL, media.LivePhoto.Token, false)
			live := gin.H{
				"url":       liveURL,
				"thumb":     liveThumb,
				"token":     media.LivePhoto.Token,
				"key":       media.LivePhoto.Key,
				"enc_idx":   media.LivePhoto.EncIdx,
				"raw_url":   liveURL,
				"raw_thumb": liveThumb,
			}
			s.rememberSNSMediaKey(liveURL, media.LivePhoto.Key)
			s.rememberSNSMediaKey(liveThumb, media.LivePhoto.Key)
			if mediaEnabled {
				proxyURL := s.buildSNSMediaProxyURL(c, liveURL, media.LivePhoto.Key)
				proxyThumb := s.buildSNSMediaProxyURL(c, liveThumb, media.LivePhoto.Key)
				live["proxy_url"] = proxyURL
				live["proxy_thumb_url"] = proxyThumb
				live["resolved_url"] = proxyURL
				live["resolved_thumb_url"] = proxyThumb
				if replace {
					if proxyURL != "" {
						live["url"] = proxyURL
					}
					if proxyThumb != "" {
						live["thumb"] = proxyThumb
					}
				}
			}
			item["live_photo"] = live
		}

		result = append(result, item)
	}
	return result
}

func (s *Service) enrichSNSPostArticle(c *gin.Context, post *model.SNSPost) any {
	if post == nil || post.Article == nil {
		return nil
	}
	article := post.Article
	// Article covers are deliberately stored as the /150 thumbnail. Rewriting
	// that path to /0 (appropriate for ordinary timeline images) makes the
	// article CDN reject the otherwise valid token.
	rawCover := fixSNSArticleCoverURL(article.CoverURL, article.CoverToken)
	s.rememberSNSMediaKey(rawCover, article.CoverKey)
	proxyCover := ""
	if strings.TrimSpace(c.DefaultQuery("media", "1")) != "0" {
		proxyCover = s.buildSNSMediaProxyURL(c, rawCover, article.CoverKey)
	}
	coverURL := rawCover
	if proxyCover != "" && strings.TrimSpace(c.DefaultQuery("replace", "1")) != "0" {
		coverURL = proxyCover
	}
	return gin.H{
		"title":           article.Title,
		"description":     article.Description,
		"url":             article.URL,
		"source_name":     article.SourceName,
		"source_username": article.SourceUserName,
		"cover_url":       coverURL,
		"raw_cover_url":   rawCover,
		"proxy_cover_url": proxyCover,
	}
}

func (s *Service) buildSNSMediaProxyURL(c *gin.Context, rawURL, key string) string {
	rawURL = strings.TrimSpace(rawURL)
	if rawURL == "" {
		return ""
	}
	params := url.Values{}
	params.Set("url", rawURL)
	if strings.TrimSpace(key) != "" {
		params.Set("key", key)
	}
	host := strings.TrimSpace(c.Request.Host)
	if host == "" {
		host = strings.TrimSpace(s.conf.GetHTTPAddr())
	}
	if host == "" {
		return ""
	}
	return "http://" + host + "/api/v1/sns/media/proxy?" + params.Encode()
}

func (s *Service) snsMediaCachePath(rawURL, key string) string {
	base := strings.TrimSpace(s.conf.GetWorkDir())
	if base == "" {
		base = util.WorkDirAt(s.conf.GetRuntimeDir(), "server")
	}
	sum := md5.Sum([]byte(rawURL + "|" + key))
	return filepath.Join(base, "cache", "sns", hex.EncodeToString(sum[:])+".bin")
}

func normalizeSNSMediaURL(rawURL string) string {
	rawURL = strings.TrimSpace(rawURL)
	if rawURL == "" {
		return ""
	}
	u, err := url.Parse(rawURL)
	if err != nil {
		return rawURL
	}
	u.Fragment = ""
	return u.String()
}

func (s *Service) rememberSNSMediaKey(rawURL, key string) {
	key = strings.TrimSpace(key)
	if key == "" || key == "0" {
		return
	}
	normalized := normalizeSNSMediaURL(rawURL)
	if normalized == "" {
		return
	}
	s.mediaState.snsMediaKeyCache.Set(normalized, key, snsMediaKeyCacheLimit)
}

func (s *Service) getSNSMediaKeyFromCache(rawURL string) string {
	normalized := normalizeSNSMediaURL(rawURL)
	if normalized == "" {
		return ""
	}
	key, _ := s.mediaState.snsMediaKeyCache.Get(normalized)
	key = strings.TrimSpace(key)
	return key
}

func minIntLocal(a, b int) int {
	if a < b {
		return a
	}
	return b
}
