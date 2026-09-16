package imageupgrade

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

const recentUpgradeLimit = 64

type Options struct {
	PID       int
	ScopeAll  bool
	Talkers   []string
	StatePath string
}

type Upgrade struct {
	Talker      string `json:"talker"`
	MessageTime int64  `json:"message_time"`
	DBLocalID   int64  `json:"db_local_id"`
	At          int64  `json:"at"`
}

type Status struct {
	Supported      bool      `json:"supported"`
	Running        bool      `json:"running"`
	Attached       bool      `json:"attached"`
	PID            int       `json:"pid,omitempty"`
	ScopeAll       bool      `json:"scope_all"`
	ScopeCount     int       `json:"scope_count"`
	Requests       uint64    `json:"requests"`
	Upgraded       uint64    `json:"upgraded"`
	Skipped        uint64    `json:"skipped"`
	StartedAt      int64     `json:"started_at,omitempty"`
	AttachedAt     int64     `json:"attached_at,omitempty"`
	LastRequestAt  int64     `json:"last_request_at,omitempty"`
	LastUpgradeAt  int64     `json:"last_upgrade_at,omitempty"`
	LastTalker     string    `json:"last_talker,omitempty"`
	LastScopeKey   string    `json:"last_scope_key,omitempty"`
	ResourceSHA    string    `json:"resource_sha,omitempty"`
	LastError      string    `json:"last_error,omitempty"`
	RecentUpgrades []Upgrade `json:"-"`
}

type Manager interface {
	Start(Options) error
	Stop()
	Snapshot() Status
}

func normalizeOptions(input Options) Options {
	input.StatePath = filepath.Clean(strings.TrimSpace(input.StatePath))
	seen := make(map[string]struct{}, len(input.Talkers))
	talkers := make([]string, 0, len(input.Talkers))
	for _, raw := range input.Talkers {
		talker := strings.TrimSpace(raw)
		key := strings.ToLower(talker)
		if key == "" {
			continue
		}
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		talkers = append(talkers, talker)
	}
	sort.Slice(talkers, func(i, j int) bool {
		return strings.ToLower(talkers[i]) < strings.ToLower(talkers[j])
	})
	input.Talkers = talkers
	return input
}

func appendRecent(items []Upgrade, next Upgrade) []Upgrade {
	for index := range items {
		item := items[index]
		if strings.EqualFold(item.Talker, next.Talker) &&
			item.MessageTime == next.MessageTime && item.DBLocalID == next.DBLocalID {
			items[index] = next
			return items
		}
	}
	items = append(items, next)
	if len(items) > recentUpgradeLimit {
		items = append([]Upgrade(nil), items[len(items)-recentUpgradeLimit:]...)
	}
	return items
}

func loadRecent(path string) []Upgrade {
	if path == "" || path == "." {
		return nil
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	var items []Upgrade
	if json.Unmarshal(data, &items) != nil {
		return nil
	}
	if len(items) > recentUpgradeLimit {
		items = items[len(items)-recentUpgradeLimit:]
	}
	return append([]Upgrade(nil), items...)
}

func persistRecent(path string, items []Upgrade) error {
	if path == "" || path == "." {
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	data, err := json.Marshal(items)
	if err != nil {
		return err
	}
	temporary, err := os.CreateTemp(filepath.Dir(path), ".image-receive-upgrade-*.tmp")
	if err != nil {
		return err
	}
	temporaryPath := temporary.Name()
	defer os.Remove(temporaryPath)
	if err := temporary.Chmod(0o600); err != nil {
		_ = temporary.Close()
		return err
	}
	if _, err := temporary.Write(data); err != nil {
		_ = temporary.Close()
		return err
	}
	if err := temporary.Sync(); err != nil {
		_ = temporary.Close()
		return err
	}
	if err := temporary.Close(); err != nil {
		return err
	}
	return os.Rename(temporaryPath, path)
}
