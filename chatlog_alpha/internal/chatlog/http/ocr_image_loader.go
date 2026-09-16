package http

import (
	"context"
	"fmt"
	stdhttp "net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/sjzar/chatlog/internal/chatlog/ocr"
	"github.com/sjzar/chatlog/internal/model"
)

func imageOCRRef(message *model.Message) (ocr.ImageRef, bool) {
	if message == nil || message.Type != model.MessageTypeImage {
		return ocr.ImageRef{}, false
	}
	mediaType, keys := extractMediaRef(message)
	if mediaType != "image" || len(keys) == 0 {
		return ocr.ImageRef{}, false
	}
	mediaKey := strings.TrimSpace(toString(message.Contents["md5"]))
	mediaPath := strings.TrimSpace(toString(message.Contents["path"]))
	if mediaKey == "" && len(keys) > 0 {
		mediaKey = keys[0]
	}
	return ocr.ImageRef{
		Talker:      message.Talker,
		TalkerName:  message.TalkerName,
		Sender:      message.Sender,
		SenderName:  message.SenderName,
		IsSelf:      message.IsSelf,
		MessageTime: message.Time.Unix(),
		MessageSeq:  message.Seq,
		DBLocalID:   message.DBLocalID,
		MessageID:   message.ID,
		MediaKey:    mediaKey,
		MediaPath:   mediaPath,
	}, mediaKey != "" || mediaPath != ""
}

func (s *Service) loadImageForOCR(ctx context.Context, ref ocr.ImageRef) ([]byte, string, error) {
	absolutePath := s.resolveOCRImagePath(ref)
	mediaPath := strings.TrimSpace(ref.MediaPath)
	mediaKey := strings.TrimSpace(ref.MediaKey)
	if absolutePath == "" {
		return nil, "", fmt.Errorf("OCR image file not found for %s", firstNonEmpty(mediaKey, mediaPath))
	}

	if !ocrImagePathUsable(absolutePath) {
		return nil, "", fmt.Errorf(
			"OCR requires mid/original image for %s (path=%s); thumbnail was excluded",
			firstNonEmpty(mediaKey, mediaPath),
			filepath.Base(absolutePath),
		)
	}

	if converted := convertedImagePath(absolutePath); converted != "" {
		if valid, validateErr := s.decodedImageFileUsable(ctx, converted); validateErr == nil && valid {
			data, err := readLocalMediaFile(converted)
			if err != nil {
				return nil, "", err
			}
			return data, stdhttp.DetectContentType(data), nil
		}
		if converted == absolutePath {
			return nil, "", fmt.Errorf("%w: OCR image is incomplete or corrupt: %s", ocr.ErrIncompleteImage, filepath.Base(converted))
		}
	}
	release, err := s.acquireLocalMediaSlot(ctx)
	if err != nil {
		return nil, "", err
	}
	defer release()
	data, err := readLocalMediaFile(absolutePath)
	if err != nil {
		return nil, "", err
	}
	detected := stdhttp.DetectContentType(data)
	if strings.HasPrefix(detected, "image/") && !strings.HasSuffix(strings.ToLower(absolutePath), ".dat") {
		return data, detected, nil
	}
	decoded, ext, err := s.decodeMedia(data)
	if err != nil && s.shouldRetryImageDecryptAfterKeyRefresh(err) {
		if _, refreshErr := s.tryRefreshImageKeyFromWeChat(); refreshErr == nil {
			decoded, ext, err = s.decodeMedia(data)
		}
	}
	if err != nil {
		if strings.HasPrefix(detected, "image/") {
			return data, detected, nil
		}
		return nil, "", fmt.Errorf("decode OCR image %s: %w", filepath.Base(absolutePath), err)
	}
	if err := validateDecodedImageForExtension(ext, decoded); err != nil {
		return nil, "", fmt.Errorf("decode OCR image %s: %w", filepath.Base(absolutePath), err)
	}
	// OCR consumes decoded bytes in memory. Persisting a plaintext sibling here
	// duplicates every selected image during a burst; media preview routes keep
	// their independent save/cache behavior.
	return decoded, contentTypeForImageExtension(ext, decoded), nil
}

// resolveOCRImagePath uses only direct repository/cache mappings. It never
// walks the account tree, which keeps the media gate cheap during bursts.
func (s *Service) resolveOCRImagePath(ref ocr.ImageRef) string {
	absolutePath := ""
	mediaPath := strings.TrimSpace(ref.MediaPath)
	mediaKey := strings.TrimSpace(ref.MediaKey)
	if mediaPath != "" {
		absolutePath = s.tryFindFileWithSuffixes("image", mediaPath)
		if absolutePath == "" {
			if candidate, _, err := s.safeDataPath(mediaPath); err == nil {
				if _, statErr := os.Stat(candidate); statErr == nil {
					absolutePath = candidate
				}
			}
		}
	}
	if mediaKey != "" {
		if media, err := s.db.GetMedia("image", mediaKey); err == nil && media != nil {
			if absolutePath == "" {
				absolutePath = s.tryFindFileWithSuffixes("image", media.Path)
			}
			if absolutePath == "" {
				absolutePath = s.findRelocatedMediaFile(media)
			}
		}
		if absolutePath == "" {
			if cached := s.getMD5FromCache(mediaKey); cached != "" {
				absolutePath = s.tryFindFileWithSuffixes("image", cached)
			}
		}
		// OCR runs from database events and therefore expects the message path,
		// media repository, or existing path cache to resolve the file. Do not
		// walk session/month trees here: one missing path in a burst must not turn
		// into repeated directory scans.
	}
	return absolutePath
}

// ocrImagePathUsable enforces the quality boundary immediately before bytes
// are read. Thumbnail suffixes remain excluded after conversion (`_t.jpg`).
func ocrImagePathUsable(path string) bool {
	path = strings.TrimSpace(path)
	if path == "" || isOCRThumbnailPath(path) {
		return false
	}
	if imageDATSuffixTier(path) >= 2 {
		return true
	}
	ext := strings.ToLower(filepath.Ext(path))
	if ext == ".dat" {
		return false
	}
	switch ext {
	case ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp":
		info, err := os.Stat(path)
		return err == nil && !info.IsDir()
	default:
		return false
	}
}

func isOCRThumbnailPath(path string) bool {
	base := strings.ToLower(strings.TrimSpace(filepath.Base(path)))
	for {
		switch {
		case strings.HasSuffix(base, "_t"), strings.HasSuffix(base, ".t"),
			strings.HasSuffix(base, "_thumb"), strings.HasSuffix(base, ".thumb"):
			return true
		}
		ext := filepath.Ext(base)
		switch ext {
		case ".dat", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp":
			base = strings.TrimSuffix(base, ext)
		default:
			return false
		}
	}
}

func convertedImagePath(path string) string {
	lower := strings.ToLower(path)
	if !strings.HasSuffix(lower, ".dat") && filepath.Ext(path) != "" {
		if _, err := os.Stat(path); err == nil {
			return path
		}
		return ""
	}
	base := path
	if filepath.Ext(path) != "" {
		base = strings.TrimSuffix(path, filepath.Ext(path))
	}
	for _, extension := range []string{".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"} {
		candidate := base + extension
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
	}
	return ""
}

func contentTypeForImageExtension(extension string, data []byte) string {
	switch strings.ToLower(strings.TrimPrefix(extension, ".")) {
	case "jpg", "jpeg":
		return "image/jpeg"
	case "png":
		return "image/png"
	case "gif":
		return "image/gif"
	case "webp":
		return "image/webp"
	default:
		return stdhttp.DetectContentType(data)
	}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
