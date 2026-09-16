package http

import (
	"bytes"
	"context"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"os"
	"strings"

	_ "golang.org/x/image/bmp"
	_ "golang.org/x/image/tiff"
	_ "golang.org/x/image/webp"
)

const (
	decodedImageValidationCacheLimit = 4_096
	maxDecodedImagePixels            = 50_000_000
)

type decodedImageValidationEntry struct {
	Size       int64
	ModifiedNS int64
	Valid      bool
}

// validateDecodedImage fully decodes the payload instead of only checking its
// header. Older V4 DAT decoders could leave encrypted bytes inside an otherwise
// plausible JPEG; DecodeConfig accepts those files while browsers reject them.
func validateDecodedImage(data []byte) error {
	if len(data) == 0 {
		return fmt.Errorf("decoded image is empty")
	}
	config, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("decode image metadata: %w", err)
	}
	if config.Width <= 0 || config.Height <= 0 ||
		int64(config.Width)*int64(config.Height) > maxDecodedImagePixels {
		return fmt.Errorf("decoded image dimensions are invalid: %dx%d", config.Width, config.Height)
	}
	if _, _, err := image.Decode(bytes.NewReader(data)); err != nil {
		return fmt.Errorf("decode complete image: %w", err)
	}
	return nil
}

func validateDecodedImageForExtension(extension string, data []byte) error {
	switch strings.ToLower(strings.TrimPrefix(extension, ".")) {
	case "jpg", "jpeg", "png", "gif", "webp", "bmp", "tiff", "tif":
		return validateDecodedImage(data)
	default:
		return nil
	}
}

func (s *Service) decodedImageFileUsable(ctx context.Context, path string) (bool, error) {
	info, err := os.Stat(path)
	if err != nil {
		return false, err
	}
	if valid, ok := s.cachedDecodedImageValidation(path, info); ok {
		return valid, nil
	}

	release, err := s.acquireLocalMediaSlot(ctx)
	if err != nil {
		return false, err
	}
	defer release()
	return s.decodedImageFileUsableWithinSlot(path)
}

// decodedImageFileUsableWithinSlot is used by callers that already hold the
// local-media semaphore, avoiding nested acquisition when two requests repair
// stale converted images concurrently.
func (s *Service) decodedImageFileUsableWithinSlot(path string) (bool, error) {
	info, err := os.Stat(path)
	if err != nil {
		return false, err
	}
	if valid, ok := s.cachedDecodedImageValidation(path, info); ok {
		return valid, nil
	}
	data, err := readLocalMediaFile(path)
	if err != nil {
		return false, err
	}
	valid := validateDecodedImage(data) == nil
	s.rememberDecodedImageValidation(path, info, valid)
	return valid, nil
}

func (s *Service) cachedDecodedImageValidation(path string, info os.FileInfo) (bool, bool) {
	entry, ok := s.mediaState.decodedImageValidationCache.Get(path)
	if !ok || entry.Size != info.Size() || entry.ModifiedNS != info.ModTime().UnixNano() {
		return false, false
	}
	return entry.Valid, true
}

func (s *Service) rememberDecodedImageValidation(path string, info os.FileInfo, valid bool) {
	s.mediaState.decodedImageValidationCache.Set(path, decodedImageValidationEntry{
		Size:       info.Size(),
		ModifiedNS: info.ModTime().UnixNano(),
		Valid:      valid,
	}, decodedImageValidationCacheLimit)
}
