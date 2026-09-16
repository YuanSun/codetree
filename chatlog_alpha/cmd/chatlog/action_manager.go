package chatlog

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	chatlogapp "github.com/sjzar/chatlog/internal/chatlog"
	"github.com/sjzar/chatlog/internal/chatlog/ports"
	"github.com/sjzar/chatlog/pkg/process"
	"github.com/sjzar/chatlog/pkg/util"
)

type actionManager interface {
	ControlSnapshot() ports.ControlSnapshot
	ControlAccounts() []ports.ControlAccount
	SelectAccount(pid int, account string) error
	SwitchToAccount(pid int, account string) error
	GetImageKeyWithStatus(func(string)) error
	RestartAndGetDataKey(func(string)) error
	SetConfigValues(httpAddr, workDir, dataKey, imageKey, dataDir string, retention *int) error
	StartService() error
	StopService() error
	Close() error
}

type localActionManager struct {
	*chatlogapp.Application
	instance *process.InstanceLock
}

func (m *localActionManager) StartService() error {
	if err := m.Application.StartService(); err != nil {
		return err
	}
	if err := m.instance.SetAddress(m.Application.HTTPAddress()); err != nil {
		return errors.Join(err, m.Application.StopService())
	}
	return nil
}

func (m *localActionManager) Close() error {
	serviceErr := m.Application.StopService()
	lockErr := m.instance.Close()
	return errors.Join(serviceErr, lockErr)
}

type remoteActionManager struct {
	baseURL  string
	client   *http.Client
	snapshot ports.ControlSnapshot
	accounts []ports.ControlAccount
}

const (
	remoteReadTimeout     = 15 * time.Second
	remoteMutationTimeout = 6 * time.Minute
)

func newRemoteActionManager(address string) (*remoteActionManager, error) {
	address = strings.TrimSpace(address)
	if address == "" {
		return nil, fmt.Errorf("running Web console has not published its address")
	}
	if !strings.HasPrefix(address, "http://") && !strings.HasPrefix(address, "https://") {
		address = "http://" + address
	}
	manager := &remoteActionManager{
		baseURL: strings.TrimRight(address, "/"),
		client:  &http.Client{},
	}
	if err := manager.refresh(); err != nil {
		return nil, err
	}
	return manager, nil
}

func (m *remoteActionManager) Close() error       { return nil }
func (m *remoteActionManager) StopService() error { return nil }

func (m *remoteActionManager) StartService() error {
	return fmt.Errorf("web console is already running at %s", m.baseURL)
}

func (m *remoteActionManager) ControlSnapshot() ports.ControlSnapshot { return m.snapshot }

func (m *remoteActionManager) ControlAccounts() []ports.ControlAccount {
	return append([]ports.ControlAccount(nil), m.accounts...)
}

func (m *remoteActionManager) SelectAccount(pid int, account string) error {
	return m.SwitchToAccount(pid, account)
}

func (m *remoteActionManager) SwitchToAccount(pid int, account string) error {
	ctx, cancel := context.WithTimeout(context.Background(), remoteMutationTimeout)
	defer cancel()
	var response struct {
		Status ports.ControlSnapshot `json:"status"`
	}
	err := m.doJSON(ctx, http.MethodPost, "/api/v1/control/account", ports.ControlAccountSelector{
		PID: pid, Account: strings.TrimSpace(account),
	}, &response)
	if err != nil {
		return err
	}
	m.snapshot = response.Status
	return m.refreshAccounts()
}

func (m *remoteActionManager) SetConfigValues(httpAddr, workDir, dataKey, imageKey, dataDir string, retention *int) error {
	ctx, cancel := context.WithTimeout(context.Background(), remoteMutationTimeout)
	defer cancel()
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
	var response struct {
		Status ports.ControlSnapshot `json:"status"`
	}
	if err := m.doJSON(ctx, http.MethodPatch, "/api/v1/control/config", patch, &response); err != nil {
		return err
	}
	m.snapshot = response.Status
	return nil
}

func (m *remoteActionManager) GetImageKeyWithStatus(status func(string)) error {
	return m.runAction(ports.ControlActionImageKey, status)
}

func (m *remoteActionManager) RestartAndGetDataKey(status func(string)) error {
	return m.runAction(ports.ControlActionDatabaseKey, status)
}

func (m *remoteActionManager) runAction(action ports.ControlAction, status func(string)) error {
	startCtx, startCancel := context.WithTimeout(context.Background(), remoteReadTimeout)
	defer startCancel()
	var started struct {
		Job ports.ControlJob `json:"job"`
	}
	if err := m.doJSON(startCtx, http.MethodPost, "/api/v1/control/actions", map[string]interface{}{"action": action}, &started); err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 6*time.Minute)
	defer cancel()
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()
	lastMessage := ""
	for {
		var response struct {
			Job ports.ControlJob `json:"job"`
		}
		if err := m.doJSON(ctx, http.MethodGet, "/api/v1/control/actions/"+started.Job.ID, nil, &response); err != nil {
			return err
		}
		if response.Job.Message != "" && response.Job.Message != lastMessage {
			lastMessage = response.Job.Message
			if status != nil {
				status(lastMessage)
			}
		}
		switch response.Job.Status {
		case ports.ControlJobSucceeded:
			return m.refresh()
		case ports.ControlJobFailed:
			if response.Job.Error != "" {
				return errors.New(response.Job.Error)
			}
			return fmt.Errorf("control action %s failed", action)
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
		}
	}
}

func (m *remoteActionManager) refresh() error {
	ctx, cancel := context.WithTimeout(context.Background(), remoteReadTimeout)
	defer cancel()
	var response struct {
		Status ports.ControlSnapshot `json:"status"`
	}
	if err := m.doJSON(ctx, http.MethodGet, "/api/v1/control/status", nil, &response); err != nil {
		return err
	}
	m.snapshot = response.Status
	return m.refreshAccounts()
}

func (m *remoteActionManager) refreshAccounts() error {
	ctx, cancel := context.WithTimeout(context.Background(), remoteReadTimeout)
	defer cancel()
	var response struct {
		Accounts []ports.ControlAccount `json:"accounts"`
	}
	if err := m.doJSON(ctx, http.MethodGet, "/api/v1/control/accounts", nil, &response); err != nil {
		return err
	}
	m.accounts = response.Accounts
	return nil
}

func (m *remoteActionManager) doJSON(ctx context.Context, method, path string, body, target interface{}) error {
	var reader io.Reader
	if body != nil {
		payload, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(payload)
	}
	request, err := http.NewRequestWithContext(ctx, method, m.baseURL+path, reader)
	if err != nil {
		return err
	}
	request.Header.Set("Accept", "application/json")
	if body != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	response, err := m.client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		payload, _ := io.ReadAll(io.LimitReader(response.Body, 1<<20))
		var problem struct {
			Error string `json:"error"`
		}
		_ = json.Unmarshal(payload, &problem)
		if strings.TrimSpace(problem.Error) != "" {
			return errors.New(problem.Error)
		}
		return fmt.Errorf("web control request returned HTTP %d", response.StatusCode)
	}
	if target == nil {
		return nil
	}
	decoder := json.NewDecoder(response.Body)
	decoder.DisallowUnknownFields()
	return decoder.Decode(target)
}

func initActionManager() (actionManager, error) {
	instance, err := process.AcquireSingleInstance(util.AppRootDir())
	if err != nil {
		var running *process.AlreadyRunningError
		if errors.As(err, &running) {
			return newRemoteActionManager(running.Address)
		}
		return nil, err
	}
	application := chatlogapp.NewApplication()
	if err := application.Initialize(""); err != nil {
		_ = instance.Close()
		return nil, err
	}
	return &localActionManager{Application: application, instance: instance}, nil
}

func initSelectedActionManager(action string) (actionManager, error) {
	manager, err := initActionManager()
	if err != nil {
		return nil, emitActionFailure(action, "init_failed", err)
	}
	if opsPID == 0 && strings.TrimSpace(opsAccount) == "" {
		return manager, nil
	}
	if err := manager.SelectAccount(opsPID, opsAccount); err != nil {
		_ = manager.Close()
		return nil, emitActionFailure(action, "select_account_failed", err)
	}
	return manager, nil
}
