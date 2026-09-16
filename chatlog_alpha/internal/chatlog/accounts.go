package chatlog

import (
	"fmt"
	"path/filepath"
	"sort"
	"strings"

	"github.com/sjzar/chatlog/internal/chatlog/conf"
	"github.com/sjzar/chatlog/internal/chatlog/ports"
	iwechat "github.com/sjzar/chatlog/internal/wechat"
)

func (a *Application) liveAccounts() []*iwechat.Account {
	if a.wechat == nil {
		return nil
	}
	return hydrateLiveAccounts(a.wechat.GetWeChatInstances(), a.store.Profiles())
}

func hydrateLiveAccounts(instances []*iwechat.Account, profiles map[string]conf.AccountConfig) []*iwechat.Account {
	for _, instance := range instances {
		if instance == nil {
			continue
		}
		profile, ok := profiles[instance.Name]
		if !ok {
			continue
		}
		if instance.DataDir == "" {
			instance.DataDir = profile.DataDir
		}
		if instance.Key == "" {
			instance.Key = profile.DataKey
		}
		if instance.ImgKey == "" {
			instance.ImgKey = profile.ImgKey
		}
	}
	return instances
}

func (a *Application) selectInitialAccount() error {
	snapshot := a.store.Snapshot()
	selected := snapshot.Account
	if selected == "" {
		return nil
	}
	instances := a.liveAccounts()
	instance, err := uniqueLiveAccount(instances, selected, snapshot.DataDir)
	if err != nil || instance == nil {
		// Keep the saved profile selected and let the Web console present the
		// live choices. Startup must never guess between multiple processes.
		return nil
	}
	return a.store.SelectCurrent(instance)
}

func (a *Application) ensureLiveAccount() error {
	snapshot := a.store.Snapshot()
	selected := snapshot.Account
	if selected == "" {
		return fmt.Errorf("请先在 Web 控制台选择微信账号")
	}
	instances := a.liveAccounts()
	instance, err := uniqueLiveAccount(instances, selected, snapshot.DataDir)
	if err != nil {
		return err
	}
	if instance != nil {
		return a.store.SelectCurrent(instance)
	}
	// Preserve the selected profile while clearing a process identity that may
	// have gone stale after WeChat restarted or a capture task was interrupted.
	if err := a.store.SelectProfile(selected); err != nil {
		return err
	}
	return fmt.Errorf("账号 %s 当前没有可操作的微信进程", selected)
}

func (a *Application) SelectAccount(pid int, account string) error {
	selection, err := a.resolveAccountSelection(pid, account)
	if err != nil {
		return err
	}
	return a.applyAccountSelection(selection)
}

type accountSelection struct {
	live    *iwechat.Account
	profile string
}

func (a *Application) resolveAccountSelection(pid int, account string) (accountSelection, error) {
	if a.store == nil {
		return accountSelection{}, fmt.Errorf("application is not initialized")
	}
	account = strings.TrimSpace(account)
	if pid != 0 {
		var selected *iwechat.Account
		for _, instance := range a.liveAccounts() {
			if instance != nil && int(instance.PID) == pid {
				if account != "" && instance.Name != account {
					return accountSelection{}, fmt.Errorf("PID=%d 不属于账号 %s", pid, account)
				}
				if selected != nil {
					return accountSelection{}, fmt.Errorf("多个微信进程使用 PID=%d", pid)
				}
				selected = instance
			}
		}
		if selected == nil {
			return accountSelection{}, fmt.Errorf("未找到 PID=%d 的微信进程", pid)
		}
		return accountSelection{live: selected}, nil
	}
	if account == "" {
		return accountSelection{}, fmt.Errorf("必须明确指定微信账号或进程 PID")
	}
	if _, ok := a.store.Profiles()[account]; !ok {
		return accountSelection{}, fmt.Errorf("未找到账号 %s", account)
	}
	return accountSelection{profile: account}, nil
}

func (a *Application) applyAccountSelection(selection accountSelection) error {
	if selection.live != nil {
		return a.store.SelectCurrent(selection.live)
	}
	return a.store.SelectProfile(selection.profile)
}

func uniqueLiveAccount(instances []*iwechat.Account, account, dataDir string) (*iwechat.Account, error) {
	account = strings.TrimSpace(account)
	dataDir = cleanAccountPath(dataDir)
	var selected *iwechat.Account
	for _, instance := range instances {
		if instance == nil || instance.Name != account {
			continue
		}
		if dataDir != "" && cleanAccountPath(instance.DataDir) != dataDir {
			continue
		}
		if selected != nil {
			return nil, fmt.Errorf("多个微信进程匹配账号 %s，请在 Web 控制台按 PID 选择", account)
		}
		selected = instance
	}
	return selected, nil
}

func cleanAccountPath(path string) string {
	path = strings.TrimSpace(path)
	if path == "" {
		return ""
	}
	return filepath.Clean(path)
}

func (a *Application) accountList() []ports.ControlAccount {
	if a.store == nil {
		return []ports.ControlAccount{}
	}
	snapshot := a.store.Snapshot()
	profiles := a.store.Profiles()
	instances := a.liveAccounts()
	result := make([]ports.ControlAccount, 0, len(instances)+len(profiles))
	liveNames := make(map[string]struct{}, len(instances))
	for _, instance := range instances {
		if instance == nil {
			continue
		}
		liveNames[instance.Name] = struct{}{}
		result = append(result, ports.ControlAccount{
			Source: "process", Account: instance.Name, PID: instance.PID,
			DataDir: instance.DataDir, Status: instance.Status, Platform: instance.Platform,
			Version: instance.Version, FullVersion: instance.FullVersion,
			Current: snapshot.PID != 0 && snapshot.PID == int(instance.PID),
		})
	}
	for account, profile := range profiles {
		if _, live := liveNames[account]; live {
			continue
		}
		result = append(result, ports.ControlAccount{
			Source: "saved", Account: account, DataDir: profile.DataDir,
			WorkDir: profile.WorkDir, Platform: profile.Platform,
			Version: profile.Version, FullVersion: profile.FullVersion,
			Current: snapshot.PID == 0 && snapshot.Account == account,
		})
	}
	sort.SliceStable(result, func(i, j int) bool {
		if result[i].Current != result[j].Current {
			return result[i].Current
		}
		if result[i].Source != result[j].Source {
			return result[i].Source == "process"
		}
		if result[i].Account != result[j].Account {
			return result[i].Account < result[j].Account
		}
		return result[i].PID < result[j].PID
	})
	return result
}
