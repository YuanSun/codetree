package wechat

import (
	"fmt"
	"path/filepath"
	"sort"
	"strings"

	chatlogerrors "github.com/sjzar/chatlog/internal/errors"
	"github.com/sjzar/chatlog/internal/wechat/backend"
	"github.com/sjzar/chatlog/internal/wechat/key"
	"github.com/sjzar/chatlog/internal/wechat/model"
	"github.com/sjzar/chatlog/internal/wechat/process"
)

const anonymousAccountPrefix = "未登录微信_"

// Manager discovers live WeChat accounts. It intentionally keeps no account
// cache: every list or resolution is a current process snapshot.
type Manager struct {
	runtime *processRuntime
}

// NewManager wires process discovery and key extraction without exposing the
// complete platform backend to individual accounts.
func NewManager(platform backend.Backend) *Manager {
	return &Manager{
		runtime: &processRuntime{
			detector:   platform.Detector(),
			extractors: platform,
		},
	}
}

// ListAccounts returns one account per currently running WeChat process.
func (m *Manager) ListAccounts() ([]*Account, error) {
	if m == nil || m.runtime == nil {
		return nil, fmt.Errorf("wechat process runtime is not configured")
	}
	processes, err := m.runtime.detector.FindProcesses()
	if err != nil {
		return nil, err
	}

	sort.SliceStable(processes, func(i, j int) bool {
		left, right := processes[i], processes[j]
		if left == nil {
			return false
		}
		if right == nil {
			return true
		}
		if left.AccountName != right.AccountName {
			return left.AccountName < right.AccountName
		}
		return left.PID < right.PID
	})

	accounts := make([]*Account, 0, len(processes))
	for _, process := range processes {
		if process != nil {
			accounts = append(accounts, newAccount(process, m.runtime))
		}
	}
	return accounts, nil
}

type accountIdentity struct {
	PID         uint32
	AccountName string
	DataDir     string
}

type accountRuntime interface {
	ResolveProcess(accountIdentity) (*model.Process, error)
	NewExtractor(version int) (key.Extractor, error)
}

type processRuntime struct {
	detector   process.Detector
	extractors backend.ExtractorFactory
}

func (r *processRuntime) NewExtractor(version int) (key.Extractor, error) {
	return r.extractors.NewExtractor(version)
}

// ResolveProcess uses only durable account identity: the existing PID, exact
// data directory, or a logged-in account name. It never substitutes an
// unrelated process merely because that process is the first result.
func (r *processRuntime) ResolveProcess(identity accountIdentity) (*model.Process, error) {
	if r == nil || r.detector == nil {
		return nil, fmt.Errorf("wechat process detector is not configured")
	}
	processes, err := r.detector.FindProcesses()
	if err != nil {
		return nil, err
	}

	if identity.PID != 0 {
		for _, candidate := range processes {
			if candidate != nil && candidate.PID == identity.PID && !identityConflicts(identity, candidate) {
				return candidate, nil
			}
		}
	}

	if dataDir := cleanIdentityPath(identity.DataDir); dataDir != "" {
		if candidate, err := uniqueProcess(processes, func(process *model.Process) bool {
			return cleanIdentityPath(process.DataDir) == dataDir
		}); candidate != nil || err != nil {
			return candidate, err
		}
	}

	if isLoggedInAccount(identity.AccountName) {
		if candidate, err := uniqueProcess(processes, func(process *model.Process) bool {
			return process.AccountName == identity.AccountName
		}); candidate != nil || err != nil {
			return candidate, err
		}
	}

	return nil, chatlogerrors.WeChatAccountNotFound(identityLabel(identity))
}

func uniqueProcess(processes []*model.Process, matches func(*model.Process) bool) (*model.Process, error) {
	var selected *model.Process
	for _, candidate := range processes {
		if candidate == nil || !matches(candidate) {
			continue
		}
		if selected != nil {
			return nil, fmt.Errorf("multiple WeChat processes match the selected account")
		}
		selected = candidate
	}
	return selected, nil
}

func identityConflicts(identity accountIdentity, process *model.Process) bool {
	if process == nil {
		return true
	}
	if isLoggedInAccount(identity.AccountName) && isLoggedInAccount(process.AccountName) && identity.AccountName != process.AccountName {
		return true
	}
	identityDir := cleanIdentityPath(identity.DataDir)
	processDir := cleanIdentityPath(process.DataDir)
	return identityDir != "" && processDir != "" && identityDir != processDir
}

func identityLabel(identity accountIdentity) string {
	if isLoggedInAccount(identity.AccountName) {
		return identity.AccountName
	}
	if identity.DataDir != "" {
		return filepath.Clean(identity.DataDir)
	}
	if identity.PID != 0 {
		return fmt.Sprintf("PID=%d", identity.PID)
	}
	return "selected process"
}

func isLoggedInAccount(name string) bool {
	name = strings.TrimSpace(name)
	return name != "" && !strings.HasPrefix(name, anonymousAccountPrefix)
}

func cleanIdentityPath(path string) string {
	path = strings.TrimSpace(path)
	if path == "" {
		return ""
	}
	return filepath.Clean(path)
}
