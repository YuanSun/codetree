package wcdbapi

import (
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

func (c *Client) resolveDataKey(src string) (string, error) {
	if len(c.allKeys) == 0 {
		return "", fmt.Errorf("all_keys.json not found for encrypted db: %s", src)
	}
	src = filepath.Clean(src)
	c.mu.Lock()
	if key := c.resolvedKeys[src]; key != "" {
		c.mu.Unlock()
		return key, nil
	}
	c.mu.Unlock()

	rel, ok := relPathFromDataDir(c.dataDir, src)
	if !ok {
		return "", fmt.Errorf("db is outside data dir: %s", src)
	}
	key := strings.ToLower(strings.TrimSpace(c.allKeys[normalizeKeyPath(rel)]))
	if len(key) != 64 {
		return "", fmt.Errorf("all_keys.json missing key for db: %s", src)
	}
	if _, err := hex.DecodeString(key); err != nil {
		return "", fmt.Errorf("all_keys.json contains an invalid key for db: %s", src)
	}
	if !validateEncryptedDBKey(src, key, c.newDecryptor) {
		return "", fmt.Errorf("all_keys.json key validation failed for db: %s", src)
	}
	c.mu.Lock()
	c.resolvedKeys[src] = key
	c.mu.Unlock()
	return key, nil
}

func validateEncryptedDBKey(src, keyHex string, newDecryptor DecryptorFactory) bool {
	key, err := hex.DecodeString(strings.TrimSpace(keyHex))
	if err != nil || len(key) != 32 {
		return false
	}
	decryptor, err := newDecryptor()
	if err != nil {
		return false
	}
	file, err := os.Open(src)
	if err != nil {
		return false
	}
	defer file.Close()
	page := make([]byte, decryptor.GetPageSize())
	if _, err := io.ReadFull(file, page); err != nil {
		return false
	}
	return decryptor.Validate(page, key)
}

func loadAllKeysMap(dataDir string) map[string]string {
	path := filepath.Join(filepath.Dir(filepath.Clean(dataDir)), "all_keys.json")
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	object := map[string]struct {
		EncKey string `json:"enc_key"`
	}{}
	if err := json.Unmarshal(raw, &object); err != nil {
		return nil
	}
	out := make(map[string]string, len(object))
	for path, value := range object {
		key := strings.ToLower(strings.TrimSpace(value.EncKey))
		if len(key) == 64 {
			out[normalizeKeyPath(path)] = key
		}
	}
	return out
}

func relPathFromDataDir(dataDir, dbFile string) (string, bool) {
	rel, err := filepath.Rel(dataDir, dbFile)
	if err == nil && rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return filepath.ToSlash(rel), true
	}
	return "", false
}

func normalizeKeyPath(path string) string {
	return strings.TrimPrefix(strings.ToLower(strings.ReplaceAll(filepath.ToSlash(filepath.Clean(path)), "\\", "/")), "./")
}

func isPlainSQLite(path string) (bool, error) {
	file, err := os.Open(path)
	if err != nil {
		return false, err
	}
	defer file.Close()
	header := make([]byte, 16)
	n, err := io.ReadFull(file, header)
	if err != nil {
		if err == io.EOF || err == io.ErrUnexpectedEOF {
			return false, nil
		}
		return false, err
	}
	return n == 16 && string(header) == "SQLite format 3\x00", nil
}
