package util

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/rs/zerolog/log"
)

const (
	chatlogDirEnv  = "CHATLOG_DIR"
	chatlogDirName = ".chatlog"
)

// AppRootDir is the only default root that chatlog creates for persistent
// configuration, logs, runtime state, caches and decrypted workspaces.
// CHATLOG_DIR relocates the whole tree instead of relocating configuration
// alone and leaving other generated directories behind.
func AppRootDir() string {
	if configured := strings.TrimSpace(os.Getenv(chatlogDirEnv)); configured != "" {
		if absolute, err := filepath.Abs(configured); err == nil {
			return filepath.Clean(absolute)
		}
		return filepath.Clean(configured)
	}
	home, err := os.UserHomeDir()
	if err != nil || strings.TrimSpace(home) == "" {
		return filepath.Join(os.TempDir(), "chatlog")
	}
	return filepath.Join(home, chatlogDirName)
}

// WorkDirAt returns the default decrypted workspace beneath root. Account names
// are reduced to one safe path component so detector-provided values cannot
// escape the application root.
func WorkDirAt(root, account string) string {
	root = strings.TrimSpace(root)
	if root == "" {
		root = AppRootDir()
	}
	if strings.TrimSpace(account) == "" {
		return filepath.Clean(root)
	}
	return filepath.Join(filepath.Clean(root), "workspaces", safePathComponent(account))
}

func DefaultWorkDir(account string) string {
	return WorkDirAt(AppRootDir(), account)
}

// CacheDirAt keeps generated caches under the same application root.
func CacheDirAt(root string, names ...string) string {
	root = strings.TrimSpace(root)
	if root == "" {
		root = AppRootDir()
	}
	parts := []string{filepath.Clean(root), "cache"}
	for _, name := range names {
		if value := safePathComponent(name); value != "" {
			parts = append(parts, value)
		}
	}
	return filepath.Join(parts...)
}

func DefaultCacheDir(names ...string) string {
	return CacheDirAt(AppRootDir(), names...)
}

func safePathComponent(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	var b strings.Builder
	b.Grow(len(value))
	for _, r := range value {
		switch {
		case r >= 'a' && r <= 'z',
			r >= 'A' && r <= 'Z',
			r >= '0' && r <= '9',
			r == '-', r == '_', r == '.', r == '@':
			b.WriteRune(r)
		default:
			b.WriteByte('_')
		}
	}
	result := strings.Trim(b.String(), ". ")
	if result == "" || result == ".." {
		return "default"
	}
	return result
}

// PrepareDir ensures that the specified directory path exists.
// If the directory does not exist, it attempts to create it.
func PrepareDir(path string) error {
	stat, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			if err := os.MkdirAll(path, 0700); err != nil {
				return err
			}
		} else {
			return err
		}
	} else if !stat.IsDir() {
		log.Debug().Msgf("%s is not a directory", path)
		return fmt.Errorf("%s is not a directory", path)
	}
	return os.Chmod(path, 0700)
}
