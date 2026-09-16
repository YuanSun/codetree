package http

import (
	"os"
	"path/filepath"
	"strings"

	"github.com/sjzar/chatlog/internal/chatlog/conf"
	"github.com/sjzar/chatlog/pkg/util"
)

func (s *Service) configuredOCR() conf.OCRConfig {
	if s == nil || s.conf == nil {
		return conf.DefaultOCRConfig()
	}
	return conf.NormalizeOCRConfig(s.conf.GetOCRConfig())
}

func (s *Service) ocrIndexPath() string {
	root := strings.TrimSpace(s.conf.GetWorkDir())
	if root == "" {
		runtimeRoot := strings.TrimSpace(s.conf.GetRuntimeDir())
		if account := strings.TrimSpace(s.conf.GetAccount()); account != "" {
			root = util.WorkDirAt(runtimeRoot, account)
		}
		if root == "" {
			root = runtimeRoot
		}
	}
	if root == "" {
		root = os.TempDir()
	}
	return filepath.Join(root, "ocr", "image_ocr.db")
}
