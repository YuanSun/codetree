package media

import (
	"crypto/aes"
	"fmt"
	"path/filepath"
	"strings"
	"sync"

	"github.com/sjzar/chatlog/internal/chatlog/ports"
	"github.com/sjzar/chatlog/pkg/util/dat2img"
)

type xorRefreshCall struct {
	done chan struct{}
	key  byte
	err  error
}

type xorRefreshKey struct {
	generation uint64
	dataDir    string
}

// Keys owns media decoder state for exactly one selected account. Every
// account reconfiguration advances a generation so an old directory scan can
// never publish keys into the new account.
type Keys struct {
	codecMu    sync.RWMutex
	dataDir    string
	aesKey     [aes.BlockSize]byte
	xorKey     byte
	generation uint64

	refreshMu sync.Mutex
	inflight  map[xorRefreshKey]*xorRefreshCall
	scan      func(string) (byte, error)
}

func NewKeys() *Keys {
	keys := &Keys{
		inflight: make(map[xorRefreshKey]*xorRefreshCall),
		scan:     dat2img.ScanXORKey,
		xorKey:   dat2img.DefaultV4XORKey,
	}
	copy(keys.aesKey[:], "0000000000000000")
	return keys
}

func (k *Keys) Configure(dataDir, imageKey string) {
	k.codecMu.Lock()
	defer k.codecMu.Unlock()
	k.generation++
	k.dataDir = cleanDataDir(dataDir)
	k.aesKey = normalizedAESKey(imageKey)
	k.xorKey = dat2img.DefaultV4XORKey
}

func (k *Keys) UpdateImageKey(dataDir, imageKey string) bool {
	k.codecMu.Lock()
	defer k.codecMu.Unlock()
	if cleanDataDir(dataDir) != k.dataDir {
		return false
	}
	k.aesKey = normalizedAESKey(imageKey)
	return true
}

func (k *Keys) RefreshXOR(dataDir string) (byte, error) {
	dataDir = cleanDataDir(dataDir)
	k.codecMu.RLock()
	generation := k.generation
	currentDataDir := k.dataDir
	k.codecMu.RUnlock()
	if dataDir == "" || dataDir != currentDataDir {
		return dat2img.DefaultV4XORKey, fmt.Errorf("media account scope does not match %s", dataDir)
	}
	refreshKey := xorRefreshKey{generation: generation, dataDir: dataDir}

	k.refreshMu.Lock()
	if call := k.inflight[refreshKey]; call != nil {
		k.refreshMu.Unlock()
		<-call.done
		return call.key, call.err
	}
	call := &xorRefreshCall{done: make(chan struct{})}
	k.inflight[refreshKey] = call
	scan := k.scan
	k.refreshMu.Unlock()

	call.key, call.err = scan(dataDir)
	if call.err == nil {
		k.codecMu.Lock()
		if k.generation != generation || k.dataDir != dataDir {
			call.err = fmt.Errorf("media account changed while scanning XOR key")
		} else {
			k.xorKey = call.key
		}
		k.codecMu.Unlock()
	}

	k.refreshMu.Lock()
	delete(k.inflight, refreshKey)
	close(call.done)
	k.refreshMu.Unlock()
	return call.key, call.err
}

func (k *Keys) Decode(data []byte) ([]byte, string, error) {
	k.codecMu.RLock()
	aesKey := k.aesKey
	xorKey := k.xorKey
	k.codecMu.RUnlock()
	return dat2img.Decode(data, aesKey[:], xorKey)
}

func cleanDataDir(dataDir string) string {
	dataDir = strings.TrimSpace(dataDir)
	if dataDir == "" {
		return ""
	}
	return filepath.Clean(dataDir)
}

func normalizedAESKey(imageKey string) [aes.BlockSize]byte {
	var result [aes.BlockSize]byte
	imageKey = strings.TrimSpace(imageKey)
	if len(imageKey) < aes.BlockSize {
		imageKey = "0000000000000000"
	}
	copy(result[:], imageKey[:aes.BlockSize])
	return result
}

var _ ports.MediaKeys = (*Keys)(nil)
var _ ports.MediaCodec = (*Keys)(nil)
