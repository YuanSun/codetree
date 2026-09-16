//go:build darwin

package darwin

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/rs/zerolog/log"
	keyshared "github.com/sjzar/chatlog/internal/wechat/key/shared"
	"github.com/sjzar/chatlog/internal/wechat/model"
)

func (e *V4Extractor) pickImageKeyWithTiming(ctx context.Context, proc *model.Process, status func(string), imageOnly bool) (string, error) {
	// 仅“获取图片密钥”流程执行 60 秒等待/轮询。
	if !imageOnly {
		return e.pickImageKeyWeFlow(proc.PID, proc.DataDir, status)
	}

	if status != nil {
		status("正在查找模板文件...")
	}
	resultTpl, ok := keyshared.FindTemplateData(proc.DataDir, 32)
	if !ok || len(resultTpl.Ciphertext) == 0 || resultTpl.XorKey == nil {
		if status != nil {
			status("未找到有效密钥，尝试扫描更多文件...")
		}
		resultTpl, ok = keyshared.FindTemplateData(proc.DataDir, 100)
	}
	if !ok || len(resultTpl.Ciphertext) == 0 {
		return "", fmt.Errorf("未找到 V4 图片模板文件，请先在微信中查看几张图片")
	}
	if resultTpl.XorKey == nil {
		return "", fmt.Errorf("未能从模板文件中计算出有效的 XOR 密钥")
	}
	if status != nil {
		status(fmt.Sprintf("XOR 密钥: 0x%02x，正在查找微信进程...", *resultTpl.XorKey))
	}
	if key, ok := deriveImageKeyByCodeAndWxid(proc.DataDir, status); ok {
		if status != nil {
			status("通过 kvcomm(code+wxid) 推导并验真成功")
		}
		return key, nil
	}

	deadline := time.Now().Add(60 * time.Second)
	scanRound := 0
	selectedPID := proc.PID
	if selectedPID == 0 {
		return "", fmt.Errorf("所选微信进程缺少 PID")
	}
	if status != nil {
		status(fmt.Sprintf("已锁定所选微信进程 PID=%d，正在扫描内存...", selectedPID))
	}
	for {
		if time.Now().After(deadline) {
			return "", fmt.Errorf("60 秒内未找到 AES 密钥")
		}

		scanRound++
		if status != nil {
			status(fmt.Sprintf("第 %d 次扫描内存，请在微信中打开图片大图...", scanRound))
		}

		imgKey, checked, err := scanImageKeyByWeFlow(selectedPID, resultTpl.Ciphertext, resultTpl.TemplateData, *resultTpl.XorKey)
		if err != nil {
			if errors.Is(err, ErrImageKeyPermission) {
				if status != nil {
					status("检测到微信内存读取权限不足，需要管理员授权")
				}
				return "", err
			}
			log.Debug().Err(err).Msg("扫描图片密钥失败，准备重试")
		}
		if status != nil {
			status(fmt.Sprintf("正在扫描图片密钥... 已检查 %d 个候选字符串", checked))
		}
		if imgKey != "" {
			if status != nil {
				status(fmt.Sprintf("通过字符串扫描找到图片密钥! (在检查了 %d 个候选后)", checked))
			}
			return imgKey, nil
		}

		select {
		case <-ctx.Done():
			return "", ctx.Err()
		case <-time.After(5 * time.Second):
		}
	}
}

func (e *V4Extractor) pickImageKeyWeFlow(pid uint32, dataDir string, status func(string)) (string, error) {
	tpl, ok := keyshared.FindTemplateData(dataDir, 32)
	if !ok || len(tpl.Ciphertext) == 0 || tpl.XorKey == nil {
		tpl, ok = keyshared.FindTemplateData(dataDir, 100)
	}
	if !ok || len(tpl.Ciphertext) == 0 || tpl.XorKey == nil {
		return "", nil
	}
	if key, ok := deriveImageKeyByCodeAndWxid(dataDir, status); ok {
		if status != nil {
			status("通过 kvcomm(code+wxid) 推导并验真成功")
		}
		return key, nil
	}
	imgKey, checked, err := scanImageKeyByWeFlow(pid, tpl.Ciphertext, tpl.TemplateData, *tpl.XorKey)
	if status != nil {
		status(fmt.Sprintf("正在扫描图片密钥... 已检查 %d 个候选字符串", checked))
	}
	if err != nil {
		return "", err
	}
	if imgKey != "" && status != nil {
		status(fmt.Sprintf("通过字符串扫描找到图片密钥! (在检查了 %d 个候选后)", checked))
	}
	return imgKey, nil
}

func scanImageKeyByWeFlow(pid uint32, ciphertext []byte, templateDat []byte, xorKey byte) (string, int, error) {
	if key, checked, err := scanImageKeyByPIDAndCiphertext(pid, ciphertext); err == nil || key != "" {
		if key != "" && keyshared.VerifyImageKeyStrong([]byte(key), templateDat, xorKey) {
			return key, checked, nil
		}
	}

	cands, checked, err := scanImageKeyCandidatesByPID(pid)
	if err != nil {
		return "", checked, err
	}
	for _, c := range cands {
		if len(c) < 16 {
			continue
		}
		k := c[:16]
		if keyshared.VerifyImageKeyHeader([]byte(k), ciphertext) && keyshared.VerifyImageKeyStrong([]byte(k), templateDat, xorKey) {
			return k, checked, nil
		}
	}
	any16, checkedAny16, err := scanImageAny16CandidatesByPID(pid)
	checked += checkedAny16
	if err != nil {
		return "", checked, nil
	}
	for _, k := range any16 {
		if keyshared.VerifyImageKeyHeader([]byte(k), ciphertext) && keyshared.VerifyImageKeyStrong([]byte(k), templateDat, xorKey) {
			return k, checked, nil
		}
	}
	return "", checked, nil
}

func resolveXwechatRootFromPath(p string) string {
	p = strings.ReplaceAll(strings.TrimSpace(p), "\\", "/")
	p = strings.TrimRight(p, "/")
	if p == "" {
		return ""
	}
	if idx := strings.Index(p, "/xwechat_files"); idx >= 0 {
		return p[:idx+len("/xwechat_files")]
	}
	re := regexp.MustCompile(`^(.*\/com\.tencent\.xinWeChat\/(?:\d+\.\d+b\d+\.\d+|\d+\.\d+\.\d+))(\/|$)`)
	if m := re.FindStringSubmatch(p); len(m) >= 2 {
		return m[1]
	}
	return ""
}

func collectWxidCandidates(dataDir string) []string {
	out := make([]string, 0, 8)
	keyshared.AppendAccountIDCandidate(&out, filepath.Base(filepath.Clean(dataDir)))
	root := resolveXwechatRootFromPath(dataDir)
	if root != "" {
		entries, err := os.ReadDir(root)
		if err == nil {
			for _, e := range entries {
				if !e.IsDir() {
					continue
				}
				entryPath := filepath.Join(root, e.Name())
				if !keyshared.IsAccountDir(entryPath) {
					continue
				}
				keyshared.AppendAccountIDCandidate(&out, e.Name())
			}
		}
	}
	if len(out) == 0 {
		keyshared.AppendAccountIDCandidate(&out, "unknown")
	}
	return out
}

func collectAccountPathCandidates(dataDir string) []string {
	out := make([]string, 0, 8)
	keyshared.AppendUniquePath(&out, dataDir)
	root := resolveXwechatRootFromPath(dataDir)
	if root != "" {
		entries, err := os.ReadDir(root)
		if err == nil {
			for _, e := range entries {
				if !e.IsDir() {
					continue
				}
				if !keyshared.IsReasonableAccountID(e.Name()) {
					continue
				}
				entryPath := filepath.Join(root, e.Name())
				if !keyshared.IsAccountDir(entryPath) {
					continue
				}
				keyshared.AppendUniquePath(&out, entryPath)
			}
		}
	}
	return out
}

func getKvcommCandidates(dataDir string) []string {
	out := make([]string, 0, 16)
	home, _ := os.UserHomeDir()
	if home != "" {
		keyshared.AppendUniquePath(&out, filepath.Join(home, "Library", "Containers", "com.tencent.xinWeChat", "Data", "Documents", "app_data", "net", "kvcomm"))
		keyshared.AppendUniquePath(&out, filepath.Join(home, "Library", "Containers", "com.tencent.xinWeChat", "Data", "Library", "Application Support", "com.tencent.xinWeChat", "xwechat", "net", "kvcomm"))
		keyshared.AppendUniquePath(&out, filepath.Join(home, "Library", "Containers", "com.tencent.xinWeChat", "Data", "Library", "Application Support", "com.tencent.xinWeChat", "net", "kvcomm"))
		keyshared.AppendUniquePath(&out, filepath.Join(home, "Library", "Containers", "com.tencent.xinWeChat", "Data", "Documents", "xwechat", "net", "kvcomm"))
	}
	if dataDir != "" {
		normalized := strings.ReplaceAll(strings.TrimRight(dataDir, "/"), "\\", "/")
		if idx := strings.Index(normalized, "/xwechat_files"); idx >= 0 {
			base := normalized[:idx]
			keyshared.AppendUniquePath(&out, filepath.FromSlash(base+"/app_data/net/kvcomm"))
		}
		re := regexp.MustCompile(`^(.*\/com\.tencent\.xinWeChat\/(?:\d+\.\d+b\d+\.\d+|\d+\.\d+\.\d+))`)
		if m := re.FindStringSubmatch(normalized); len(m) >= 2 {
			vbase := m[1]
			keyshared.AppendUniquePath(&out, filepath.FromSlash(vbase+"/net/kvcomm"))
			if pidx := strings.LastIndex(vbase, "/"); pidx > 0 {
				keyshared.AppendUniquePath(&out, filepath.FromSlash(vbase[:pidx]+"/net/kvcomm"))
			}
		}
		cursor := dataDir
		for i := 0; i < 6; i++ {
			keyshared.AppendUniquePath(&out, filepath.Join(cursor, "net", "kvcomm"))
			next := filepath.Dir(cursor)
			if next == cursor {
				break
			}
			cursor = next
		}
	}
	return out
}

func deriveImageKeyByCodeAndWxid(dataDir string, status func(string)) (string, bool) {
	return keyshared.DeriveImageKey(
		keyshared.CollectKvcommCodes(getKvcommCandidates(dataDir)),
		collectWxidCandidates(dataDir),
		collectAccountPathCandidates(dataDir),
		status,
	)
}
