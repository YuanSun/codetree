package wechat

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"github.com/sjzar/chatlog/internal/wechat"
	"github.com/sjzar/chatlog/internal/wechat/key"
)

type Service struct {
	accounts AccountProvider
}

type AccountProvider interface {
	ListAccounts() ([]*wechat.Account, error)
}

func NewService(accounts AccountProvider) *Service {
	return &Service{accounts: accounts}
}

// GetWeChatInstances returns all running WeChat instances
func (s *Service) GetWeChatInstances() []*wechat.Account {
	instances, _ := s.GetWeChatInstancesWithError()
	return instances
}

func (s *Service) GetWeChatInstancesWithError() ([]*wechat.Account, error) {
	if s.accounts == nil {
		return nil, fmt.Errorf("wechat account manager is not configured")
	}
	return s.accounts.ListAccounts()
}

// GetImageKeyWithStatus extracts the image key and forwards detailed progress.
func (s *Service) GetImageKeyWithStatus(ctx context.Context, info *wechat.Account, status func(string)) (string, error) {
	if info == nil {
		return "", fmt.Errorf("no WeChat instance selected")
	}
	if ctx == nil {
		ctx = context.Background()
	}
	if status != nil {
		ctx = key.WithRequest(ctx, key.Request{Status: status})
	}
	return info.GetImageKey(ctx)
}

// RefreshImageKey selects the running account that owns dataDir and refreshes
// its image key. HTTP depends on this small capability instead of constructing
// another WeChat service.
func (s *Service) RefreshImageKey(dataDir string) (string, error) {
	instances, err := s.GetWeChatInstancesWithError()
	if err != nil {
		return "", err
	}
	if len(instances) == 0 {
		return "", fmt.Errorf("wechat instance unavailable")
	}

	cleanDataDir := filepath.Clean(strings.TrimSpace(dataDir))
	if cleanDataDir == "." {
		return "", fmt.Errorf("wechat account data directory is required")
	}
	var target *wechat.Account
	for _, instance := range instances {
		if instance == nil {
			continue
		}
		instanceDir := strings.TrimSpace(instance.DataDir)
		if instanceDir == "" {
			continue
		}
		cleanInstanceDir := filepath.Clean(instanceDir)
		if !pathWithin(cleanInstanceDir, cleanDataDir) {
			continue
		}
		if target != nil {
			return "", fmt.Errorf("multiple running WeChat accounts own data directory %s", cleanDataDir)
		}
		target = instance
	}
	if target == nil {
		return "", fmt.Errorf("no running WeChat account owns data directory %s", cleanDataDir)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	return s.GetImageKeyWithStatus(ctx, target, nil)
}

func pathWithin(root, target string) bool {
	relative, err := filepath.Rel(root, target)
	if err != nil {
		return false
	}
	return relative == "." || (relative != ".." && !strings.HasPrefix(relative, ".."+string(filepath.Separator)))
}
