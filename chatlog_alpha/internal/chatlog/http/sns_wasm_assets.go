package http

import (
	"bytes"
	"context"
	"crypto/sha256"
	"embed"
	"encoding/base64"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"sync"

	"github.com/sjzar/chatlog/pkg/util"
)

const maxSNSWasmKeystreamSize = 8 << 20

//go:embed wasm/wasm_video_decode.js wasm/wasm_video_decode.wasm wasm/wasm_keystream_helper.js
var snsWasmAssets embed.FS

var (
	snsWasmInitMu  sync.Mutex
	snsWasmBaseDir string
)

func (s *Service) getSNSWasmKeystream(ctx context.Context, key string, size int, mode string) ([]byte, error) {
	if size <= 0 || size > maxSNSWasmKeystreamSize {
		return nil, fmt.Errorf("sns wasm keystream size %d is outside 1..%d", size, maxSNSWasmKeystreamSize)
	}
	baseDir, err := s.ensureSNSWasmAssets()
	if err != nil {
		return nil, err
	}
	if mode == "" {
		mode = "reversed"
	}

	cmd := exec.CommandContext(ctx, "node", filepath.Join(baseDir, "wasm_keystream_helper.js"), key, strconv.Itoa(size), mode)
	cmd.Env = os.Environ()
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}
	if err := cmd.Start(); err != nil {
		return nil, err
	}

	maxOutput := int64(base64.StdEncoding.EncodedLen(size) + 16)
	out, readErr := io.ReadAll(io.LimitReader(stdout, maxOutput+1))
	if int64(len(out)) > maxOutput {
		_ = stdout.Close()
		if cmd.Process != nil {
			_ = cmd.Process.Kill()
		}
		_ = cmd.Wait()
		return nil, fmt.Errorf("sns wasm helper output exceeds %d bytes", maxOutput)
	}
	waitErr := cmd.Wait()
	if waitErr != nil {
		return nil, fmt.Errorf("sns wasm helper failed: %s", stderr.String())
	}
	if readErr != nil {
		return nil, readErr
	}

	decoded := make([]byte, base64.StdEncoding.DecodedLen(len(out)))
	n, err := base64.StdEncoding.Decode(decoded, out)
	if err != nil {
		return nil, err
	}
	decoded = decoded[:n]
	if len(decoded) != size {
		return nil, fmt.Errorf("sns wasm helper returned %d bytes, want %d", len(decoded), size)
	}
	return decoded, nil
}

func (s *Service) ensureSNSWasmAssets() (string, error) {
	snsWasmInitMu.Lock()
	defer snsWasmInitMu.Unlock()

	if snsWasmBaseDir != "" {
		return snsWasmBaseDir, nil
	}

	files := []string{
		"wasm_video_decode.js",
		"wasm_video_decode.wasm",
		"wasm_keystream_helper.js",
	}
	digest := sha256.New()
	contents := make(map[string][]byte, len(files))
	for _, name := range files {
		data, err := snsWasmAssets.ReadFile("wasm/" + name)
		if err != nil {
			return "", err
		}
		if len(data) == 0 {
			return "", fmt.Errorf("embedded sns wasm asset %s is empty", name)
		}
		contents[name] = data
		_, _ = digest.Write([]byte(name))
		_, _ = digest.Write([]byte{0})
		_, _ = digest.Write(data)
		_, _ = digest.Write([]byte{0})
	}
	sum := digest.Sum(nil)
	baseDir := filepath.Join(
		util.CacheDirAt(s.conf.GetRuntimeDir(), "sns_wasm"),
		fmt.Sprintf("assets-%x", sum[:8]),
	)
	if err := os.MkdirAll(baseDir, 0o700); err != nil {
		return "", err
	}
	for _, name := range files {
		if err := materializeSNSWasmAsset(baseDir, name, contents[name]); err != nil {
			return "", err
		}
	}

	snsWasmBaseDir = baseDir
	return snsWasmBaseDir, nil
}

func materializeSNSWasmAsset(baseDir, name string, content []byte) error {
	target := filepath.Join(baseDir, name)
	if existing, err := os.ReadFile(target); err == nil && bytes.Equal(existing, content) {
		return os.Chmod(target, 0o600)
	}
	temporary, err := os.CreateTemp(baseDir, "."+name+"-*.tmp")
	if err != nil {
		return err
	}
	temporaryPath := temporary.Name()
	defer func() { _ = os.Remove(temporaryPath) }()
	if err := temporary.Chmod(0o600); err != nil {
		_ = temporary.Close()
		return err
	}
	if _, err := temporary.Write(content); err != nil {
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
	return os.Rename(temporaryPath, target)
}
