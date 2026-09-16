package usecase

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"github.com/rs/zerolog/log"

	"github.com/sjzar/chatlog/internal/chatlog/ports"
	iwechat "github.com/sjzar/chatlog/internal/wechat"
)

type KeyService interface {
	GetImageKeyWithStatus(ctx context.Context, info *iwechat.Account, status func(string)) (string, error)
	GetWeChatInstances() []*iwechat.Account
}

type KeyState interface {
	CurrentAccount() *iwechat.Account
	GetDataDir() string
}

// CapturedKeys is an uncommitted platform-capture result. The application
// controller persists it inside the same account-generation transaction that
// refreshes media state or replaces the database runtime.
type CapturedKeys struct {
	Account  *iwechat.Account
	DataDir  string
	DataKey  string
	ImageKey string
}

// Keys owns the data/image-key application workflows. Web and CLI controllers
// delegate here instead of mixing platform workflow with transport lifecycle.
type Keys struct {
	state   KeyState
	service KeyService
	capture ports.KeyCapture
}

func NewKeys(state KeyState, service KeyService, capture ports.KeyCapture) *Keys {
	return &Keys{state: state, service: service, capture: capture}
}

func (u *Keys) GetImageKey(ctx context.Context, onStatus func(string)) (CapturedKeys, error) {
	if ctx == nil {
		ctx = context.Background()
	}
	current := u.state.CurrentAccount()
	if current == nil {
		return CapturedKeys{}, fmt.Errorf("未选择任何账号")
	}
	if onStatus != nil {
		onStatus("正在优先尝试本地推导图片密钥")
	}
	ctx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()
	imageKey, err := u.service.GetImageKeyWithStatus(ctx, current, onStatus)
	if err != nil && u.capture.IsImagePermissionError(err) {
		if onStatus != nil {
			onStatus("普通用户无法读取微信内存，准备请求临时管理员授权")
		}
		dataDir := firstNonEmpty(current.DataDir, u.state.GetDataDir())
		imageKey, err = u.capture.ExtractImageKey(
			ctx,
			current.PID,
			dataDir,
			onStatus,
		)
	}
	if err != nil {
		return CapturedKeys{}, err
	}
	if imageKey == "" {
		return CapturedKeys{}, fmt.Errorf("图片密钥提取结果为空")
	}
	if onStatus != nil {
		onStatus("图片密钥已提取；本次任务未保留管理员权限")
	}
	return CapturedKeys{Account: current, DataDir: current.DataDir, ImageKey: imageKey}, nil
}

func (u *Keys) CaptureDataKey(ctx context.Context, onStatus func(string)) (CapturedKeys, error) {
	if ctx == nil {
		ctx = context.Background()
	}
	current := u.state.CurrentAccount()
	if current == nil {
		return CapturedKeys{}, fmt.Errorf("未选择任何账号")
	}
	if !u.capture.Available() {
		return CapturedKeys{}, fmt.Errorf("提取数据库密钥需要 Frida：请先执行 pip3 install frida-tools")
	}
	if onStatus != nil {
		onStatus("[1/6] 检查 Frida 环境")
	}

	exePath := current.ExePath
	dataDir := firstNonEmpty(current.DataDir, u.state.GetDataDir())
	accountName := strings.TrimSpace(current.Name)
	if dataDir == "" && (accountName == "" || strings.HasPrefix(accountName, "未登录微信_")) {
		return CapturedKeys{}, fmt.Errorf("请先登录并选择具有稳定账号标识的微信进程")
	}
	log.Info().Msg("CaptureDataKey: Frida-only data key path")

	extractCtx, cancel := context.WithTimeout(ctx, 180*time.Second)
	defer cancel()
	capture, err := u.capture.CaptureDataKeys(extractCtx, ports.KeyCaptureTarget{
		PID: current.PID, DataDir: dataDir, ExePath: exePath,
	}, onStatus)
	if err != nil {
		return CapturedKeys{}, fmt.Errorf("frida 提取密钥失败: %w", err)
	}
	capture.Value = strings.TrimSpace(capture.Value)
	if capture.Value == "" {
		return CapturedKeys{}, fmt.Errorf("frida 未返回数据库主密钥")
	}

	newInstance, matchErr := matchRestartedInstance(u.service.GetWeChatInstances(), accountName, dataDir, exePath)
	if matchErr != nil {
		return CapturedKeys{}, matchErr
	}
	if newInstance != nil && newInstance.DataDir != "" {
		dataDir = newInstance.DataDir
	}
	waitCtx, waitCancel := context.WithTimeout(ctx, 120*time.Second)
	defer waitCancel()
	for newInstance == nil || dataDir == "" {
		candidate, candidateErr := matchRestartedInstance(u.service.GetWeChatInstances(), accountName, dataDir, exePath)
		if candidateErr != nil {
			return CapturedKeys{}, candidateErr
		}
		newInstance = candidate
		if newInstance != nil && newInstance.DataDir != "" {
			dataDir = newInstance.DataDir
			break
		}
		if onStatus != nil {
			onStatus("[6/6] 密钥已捕获，等待所选账号完成登录")
		}
		select {
		case <-waitCtx.Done():
			return CapturedKeys{}, waitCtx.Err()
		case <-time.After(time.Second):
		}
	}
	if newInstance == nil {
		return CapturedKeys{}, fmt.Errorf("微信重启后未找到所选账号 %s", accountName)
	}
	if dataDir == "" {
		return CapturedKeys{}, fmt.Errorf("所选账号登录后仍未发现数据库目录")
	}
	if onStatus != nil {
		onStatus("[6/6] 已找到账号数据目录，正在保存数据库密钥")
	}

	current = newInstance
	if applyErr := u.capture.ApplyDataKeys(dataDir, capture, onStatus); applyErr != nil {
		return CapturedKeys{}, fmt.Errorf("逐库应用数据库密钥: %w", applyErr)
	}
	if onStatus != nil {
		onStatus("Frida 提取密钥成功")
	}
	log.Info().Msg("Successfully got data key via Frida")
	return CapturedKeys{Account: current, DataDir: dataDir, DataKey: capture.Value}, nil
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}

func matchRestartedInstance(instances []*iwechat.Account, accountName, dataDir, exePath string) (*iwechat.Account, error) {
	var selected *iwechat.Account
	cleanDataDir := cleanAccountDataDir(dataDir)
	for _, instance := range instances {
		if instance == nil || (exePath != "" && instance.ExePath != exePath) {
			continue
		}
		matches := cleanDataDir != "" && cleanAccountDataDir(instance.DataDir) == cleanDataDir
		if !matches && accountName != "" && !strings.HasPrefix(accountName, "未登录微信_") {
			matches = instance.Name == accountName
		}
		if !matches {
			continue
		}
		if selected != nil {
			return nil, fmt.Errorf("多个微信进程匹配所选账号 %s", accountName)
		}
		selected = instance
	}
	return selected, nil
}

func cleanAccountDataDir(path string) string {
	path = strings.TrimSpace(path)
	if path == "" {
		return ""
	}
	return filepath.Clean(path)
}
