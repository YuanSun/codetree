package chatlog

import (
	stderrors "errors"
	"fmt"
	"path/filepath"
	"strings"

	chathttp "github.com/sjzar/chatlog/internal/chatlog/http"
	"github.com/sjzar/chatlog/internal/chatlog/ports"
	"github.com/sjzar/chatlog/internal/chatlog/state"
	clog "github.com/sjzar/chatlog/pkg/log"
)

var _ ports.ControlPlane = (*Application)(nil)

func (a *Application) ControlLockAccount(account string) (func(), error) {
	account = strings.TrimSpace(account)
	if account == "" {
		return nil, fmt.Errorf("请先选择账号")
	}
	if active := a.activeControlJob(); active != "" {
		return nil, fmt.Errorf("任务 %s 正在执行", active)
	}
	a.operationMu.Lock()
	if active := a.activeControlJob(); active != "" {
		a.operationMu.Unlock()
		return nil, fmt.Errorf("任务 %s 正在执行", active)
	}
	if a.store == nil || a.store.GetAccount() != account {
		a.operationMu.Unlock()
		return nil, fmt.Errorf("账号已切换，请刷新后重试")
	}
	return a.operationMu.Unlock, nil
}

func (a *Application) ControlSnapshot() ports.ControlSnapshot {
	if a.store == nil {
		return ports.ControlSnapshot{}
	}
	snapshot := a.store.Snapshot()
	databaseReady := a.database != nil && a.database.Ready()
	databaseError := ""
	if a.database != nil {
		_, databaseError = a.database.Status()
	}
	if databaseError == "" && !databaseReady {
		switch {
		case snapshot.Account == "":
			databaseError = "请选择微信账号"
		case snapshot.DataDir == "":
			databaseError = "请配置微信数据目录"
		case snapshot.DataKey == "":
			databaseError = "请提取或填写数据库密钥"
		}
	}
	return ports.ControlSnapshot{
		Account: snapshot.Account, PID: snapshot.PID, Status: snapshot.Status,
		ExePath: snapshot.ExePath, Platform: snapshot.Platform, Version: snapshot.Version,
		FullVersion: snapshot.FullVersion, DataDir: snapshot.DataDir, WorkDir: snapshot.WorkDir,
		DataKeyPresent: snapshot.DataKey != "", ImageKeyPresent: snapshot.ImageKey != "",
		HTTPAddr: snapshot.HTTPAddr, HTTPRunning: a.http != nil && a.http.IsRunning(),
		DatabaseReady: databaseReady, DatabaseError: databaseError,
		LogRetentionDays: snapshot.LogRetentionDays,
		RestartRequired:  a.restartRequired.Load(),
	}
}

func (a *Application) ControlAccounts() []ports.ControlAccount {
	return a.accountList()
}

func (a *Application) ControlUpdate(patch ports.ControlConfigPatch) (ports.ControlSnapshot, error) {
	if active := a.activeControlJob(); active != "" {
		return a.ControlSnapshot(), fmt.Errorf("任务 %s 正在执行，请稍后更新配置", active)
	}
	a.operationMu.Lock()
	defer a.operationMu.Unlock()
	if active := a.activeControlJob(); active != "" {
		return a.ControlSnapshot(), fmt.Errorf("任务 %s 正在执行，请稍后更新配置", active)
	}
	if a.store == nil {
		return ports.ControlSnapshot{}, fmt.Errorf("application is not initialized")
	}

	current := a.store.Snapshot()
	accountChange := patch.WorkDir != nil || patch.DataDir != nil || patch.DataKey != nil || patch.ImageKey != nil
	if accountChange && current.Account == "" {
		return a.ControlSnapshot(), fmt.Errorf("请先选择账号")
	}
	if patch.HTTPAddr != nil {
		value := strings.TrimSpace(*patch.HTTPAddr)
		if err := chathttp.ValidateListenAddress(value); err != nil {
			return a.ControlSnapshot(), err
		}
		*patch.HTTPAddr = value
	}
	for label, value := range map[string]*string{"微信数据目录": patch.DataDir, "工作目录": patch.WorkDir} {
		if value == nil {
			continue
		}
		normalized := strings.TrimSpace(*value)
		if normalized != "" && !filepath.IsAbs(normalized) {
			return a.ControlSnapshot(), fmt.Errorf("%s必须使用绝对路径", label)
		}
		*value = normalized
	}
	if patch.LogRetentionDays != nil && (*patch.LogRetentionDays < clog.MinRetentionDays || *patch.LogRetentionDays > clog.MaxRetentionDays) {
		return a.ControlSnapshot(), fmt.Errorf("日志保留天数必须在 %d-%d 之间", clog.MinRetentionDays, clog.MaxRetentionDays)
	}

	databaseChanged := patch.WorkDir != nil || patch.DataDir != nil || patch.DataKey != nil
	httpChanged := patch.HTTPAddr != nil && *patch.HTTPAddr != current.HTTPAddr
	releaseAccount := func() {}
	runtimeSuspended := false
	runtimeWasActive := false
	if a.http != nil {
		if databaseChanged {
			runtimeWasActive = a.http.AccountRuntimeActive()
			releaseAccount = a.http.SuspendAccountRuntime()
			runtimeSuspended = true
		} else if patch.ImageKey != nil {
			releaseAccount = a.http.LockAccountRequests()
		}
	}
	defer releaseAccount()
	if err := a.store.Apply(state.Update{
		HTTPAddr: patch.HTTPAddr, WorkDir: patch.WorkDir, DataDir: patch.DataDir,
		DataKey: patch.DataKey, ImageKey: patch.ImageKey, LogRetentionDays: patch.LogRetentionDays,
	}); err != nil {
		if runtimeSuspended {
			if resumeErr := a.restoreAccountRuntime(runtimeWasActive); resumeErr != nil {
				return a.ControlSnapshot(), stderrors.Join(err, fmt.Errorf("恢复账号运行时: %w", resumeErr))
			}
		}
		return a.ControlSnapshot(), err
	}
	if patch.ImageKey != nil && !databaseChanged {
		a.refreshMediaKeys()
		if a.http != nil {
			a.http.InvalidateAccountCaches()
		}
	}
	if httpChanged && a.http != nil && a.http.IsRunning() {
		a.restartRequired.Store(true)
	}
	if databaseChanged {
		if err := a.restartDatabaseAfterSuspendLocked(); err != nil {
			return a.ControlSnapshot(), fmt.Errorf("配置已保存，但数据库启动失败: %w", err)
		}
	}
	return a.ControlSnapshot(), nil
}

func (a *Application) ControlSelect(selector ports.ControlAccountSelector) (ports.ControlSnapshot, error) {
	if active := a.activeControlJob(); active != "" {
		return a.ControlSnapshot(), fmt.Errorf("任务 %s 正在执行，请稍后切换账号", active)
	}
	a.operationMu.Lock()
	defer a.operationMu.Unlock()
	if active := a.activeControlJob(); active != "" {
		return a.ControlSnapshot(), fmt.Errorf("任务 %s 正在执行，请稍后切换账号", active)
	}
	if selector.PID == 0 && strings.TrimSpace(selector.Account) == "" {
		return a.ControlSnapshot(), fmt.Errorf("必须提供 pid 或 account")
	}
	selection, err := a.resolveAccountSelection(selector.PID, selector.Account)
	if err != nil {
		return a.ControlSnapshot(), err
	}
	current := a.store.Snapshot()
	if (selection.live != nil && current.PID == int(selection.live.PID) &&
		current.Account == selection.live.Name && cleanAccountPath(current.DataDir) == cleanAccountPath(selection.live.DataDir)) ||
		(selection.profile != "" && current.PID == 0 && current.Account == selection.profile) {
		return a.ControlSnapshot(), nil
	}
	previousAccount := current.Account
	previousCurrent := a.store.CurrentAccount()
	restorePrevious := func() error {
		if previousCurrent != nil {
			return a.store.SelectCurrent(previousCurrent)
		}
		if previousAccount != "" {
			return a.store.SelectProfile(previousAccount)
		}
		return a.store.ClearSelection()
	}
	startSelected := func() error {
		if a.databaseConfigured() {
			return a.startDatabaseLocked()
		}
		a.refreshMediaKeys()
		if a.http != nil {
			a.http.PublishControlOnlyAccount()
		}
		return nil
	}
	releaseAccount := func() {}
	if a.http != nil {
		releaseAccount = a.http.SuspendAccountRuntime()
	}
	defer releaseAccount()
	if a.services != nil {
		if err := a.services.StopDatabase(); err != nil {
			if resumeErr := a.restoreAccountRuntime(false); resumeErr != nil {
				return a.ControlSnapshot(), stderrors.Join(err, fmt.Errorf("恢复账号运行时: %w", resumeErr))
			}
			return a.ControlSnapshot(), err
		}
	}
	if err := a.applyAccountSelection(selection); err != nil {
		if restartErr := startSelected(); restartErr != nil {
			return a.ControlSnapshot(), stderrors.Join(err, fmt.Errorf("恢复原账号数据库: %w", restartErr))
		}
		return a.ControlSnapshot(), err
	}
	if err := startSelected(); err != nil {
		if a.services != nil {
			_ = a.services.StopDatabase()
		}
		rollbackErr := restorePrevious()
		if rollbackErr == nil {
			rollbackErr = startSelected()
		}
		if rollbackErr != nil {
			return a.ControlSnapshot(), stderrors.Join(
				fmt.Errorf("账号数据库启动失败: %w", err),
				fmt.Errorf("恢复原账号失败: %w", rollbackErr),
			)
		}
		return a.ControlSnapshot(), fmt.Errorf("账号数据库启动失败，已恢复原账号: %w", err)
	}
	return a.ControlSnapshot(), nil
}

func (a *Application) SetConfigValues(httpAddr, workDir, dataKey, imageKey, dataDir string, retention *int) error {
	patch := ports.ControlConfigPatch{LogRetentionDays: retention}
	if httpAddr != "" {
		patch.HTTPAddr = &httpAddr
	}
	if workDir != "" {
		patch.WorkDir = &workDir
	}
	if dataKey != "" {
		patch.DataKey = &dataKey
	}
	if imageKey != "" {
		patch.ImageKey = &imageKey
	}
	if dataDir != "" {
		patch.DataDir = &dataDir
	}
	_, err := a.ControlUpdate(patch)
	return err
}

func (a *Application) SwitchToAccount(pid int, account string) error {
	_, err := a.ControlSelect(ports.ControlAccountSelector{PID: pid, Account: account})
	return err
}
