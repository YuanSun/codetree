package wechat

import (
	"context"
	"fmt"
	"time"

	"github.com/rs/zerolog/log"

	"github.com/sjzar/chatlog/internal/errors"
	"github.com/sjzar/chatlog/internal/wechat/key"
	"github.com/sjzar/chatlog/internal/wechat/model"
)

const processReadyTimeout = 30 * time.Second

// Account is a live WeChat account bound to a precise process identity.
type Account struct {
	Name        string
	Platform    string
	Version     int
	FullVersion string
	DataDir     string
	Key         string
	ImgKey      string
	PID         uint32
	ExePath     string
	Status      string
	runtime     accountRuntime
}

func newAccount(process *model.Process, runtime accountRuntime) *Account {
	account := &Account{runtime: runtime}
	account.applyProcess(process)
	return account
}

func (a *Account) resolveProcess() (*model.Process, error) {
	if a == nil || a.runtime == nil {
		return nil, fmt.Errorf("wechat account runtime is not configured")
	}
	process, err := a.runtime.ResolveProcess(a.identity())
	if err != nil {
		a.Status = model.StatusOffline
		return nil, err
	}
	a.applyProcess(process)
	return process, nil
}

func (a *Account) identity() accountIdentity {
	return accountIdentity{
		PID:         a.PID,
		AccountName: a.Name,
		DataDir:     a.DataDir,
	}
}

func (a *Account) applyProcess(process *model.Process) {
	if a == nil || process == nil {
		return
	}
	if a.Name == "" || !isLoggedInAccount(a.Name) || isLoggedInAccount(process.AccountName) {
		a.Name = process.AccountName
	}
	a.Platform = process.Platform
	a.Version = process.Version
	a.FullVersion = process.FullVersion
	a.DataDir = process.DataDir
	a.PID = process.PID
	a.ExePath = process.ExePath
	a.Status = process.Status
}

// GetImageKey extracts only the WeChat 4 image key.
func (a *Account) GetImageKey(ctx context.Context) (string, error) {
	if ctx == nil {
		ctx = context.Background()
	}
	if a.Version != 4 {
		return "", fmt.Errorf("仅支持微信V4版本获取图片密钥")
	}

	process, err := a.resolveProcess()
	if err != nil {
		return "", errors.RefreshProcessStatusFailed(err)
	}
	process, err = a.waitForDataDir(ctx, process)
	if err != nil {
		return "", err
	}

	extractor, err := a.runtime.NewExtractor(process.Version)
	if err != nil {
		return "", err
	}
	log.Info().Msg("正在启动内存扫描以获取图片密钥...")
	request := key.RequestFromContext(ctx)
	request.ImageOnly = true
	dataKey, imageKey, err := extractor.Extract(key.WithRequest(ctx, request), process)
	if err != nil {
		return "", err
	}
	if dataKey != "" {
		a.Key = dataKey
	}
	if imageKey == "" {
		return "", fmt.Errorf("未能获取到图片密钥")
	}
	a.ImgKey = imageKey
	return imageKey, nil
}

func (a *Account) waitForDataDir(ctx context.Context, process *model.Process) (*model.Process, error) {
	if process.Version != 4 || process.DataDir != "" {
		return process, nil
	}
	log.Info().Msg("检测到数据目录未就绪，等待微信登录...")

	timer := time.NewTimer(processReadyTimeout)
	defer timer.Stop()
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-timer.C:
			return nil, fmt.Errorf("数据目录未就绪，请确保微信已登录")
		case <-ticker.C:
			refreshed, err := a.resolveProcess()
			if err != nil {
				return nil, errors.RefreshProcessStatusFailed(err)
			}
			if refreshed.DataDir != "" {
				log.Info().Msgf("数据目录已就绪: %s", refreshed.DataDir)
				return refreshed, nil
			}
		}
	}
}
