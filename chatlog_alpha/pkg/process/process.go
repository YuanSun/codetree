//go:build darwin

package process

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"time"
)

type InstanceMetadata struct {
	PID     int    `json:"pid"`
	Address string `json:"address,omitempty"`
}

type AlreadyRunningError struct {
	PID     int
	Address string
}

func (e *AlreadyRunningError) Error() string {
	return fmt.Sprintf("chatlog is already running (pid %d)", e.PID)
}

// InstanceLock owns the flock descriptor for the full process lifetime. The
// lock file is intentionally permanent so releasing an old descriptor can
// never unlink a newly acquired lock inode.
type InstanceLock struct {
	file *os.File
	pid  int
}

func AcquireSingleInstance(runtimeDir string) (*InstanceLock, error) {
	if err := os.MkdirAll(runtimeDir, 0o700); err != nil {
		return nil, fmt.Errorf("create runtime directory: %w", err)
	}
	path := filepath.Join(runtimeDir, "chatlog.pid")
	file, err := os.OpenFile(path, os.O_CREATE|os.O_RDWR, 0o600)
	if err != nil {
		return nil, fmt.Errorf("open instance lock: %w", err)
	}
	if err := file.Chmod(0o600); err != nil {
		_ = file.Close()
		return nil, fmt.Errorf("secure instance lock: %w", err)
	}
	deadline := time.Now().Add(10 * time.Second)
	var metadata InstanceMetadata
	for {
		err = syscall.Flock(int(file.Fd()), syscall.LOCK_EX|syscall.LOCK_NB)
		if err == nil {
			break
		}
		if !errors.Is(err, syscall.EWOULDBLOCK) && !errors.Is(err, syscall.EAGAIN) {
			_ = file.Close()
			return nil, fmt.Errorf("lock instance file: %w", err)
		}
		metadata = readInstanceMetadata(file)
		if metadata.PID > 0 && metadata.Address != "" {
			_ = file.Close()
			return nil, &AlreadyRunningError{PID: metadata.PID, Address: metadata.Address}
		}
		if time.Now().After(deadline) {
			_ = file.Close()
			return nil, &AlreadyRunningError{PID: metadata.PID, Address: metadata.Address}
		}
		time.Sleep(50 * time.Millisecond)
	}
	lock := &InstanceLock{file: file, pid: os.Getpid()}
	if err := lock.writeMetadata(InstanceMetadata{PID: lock.pid}); err != nil {
		_ = lock.Close()
		return nil, err
	}
	return lock, nil
}

func readInstanceMetadata(file *os.File) InstanceMetadata {
	if file == nil {
		return InstanceMetadata{}
	}
	_, _ = file.Seek(0, 0)
	var metadata InstanceMetadata
	_ = json.NewDecoder(file).Decode(&metadata)
	metadata.Address = strings.TrimSpace(metadata.Address)
	return metadata
}

func (l *InstanceLock) SetAddress(address string) error {
	if l == nil || l.file == nil {
		return fmt.Errorf("instance lock is not held")
	}
	return l.writeMetadata(InstanceMetadata{PID: l.pid, Address: strings.TrimSpace(address)})
}

func (l *InstanceLock) writeMetadata(metadata InstanceMetadata) error {
	if err := l.file.Truncate(0); err != nil {
		return fmt.Errorf("truncate instance metadata: %w", err)
	}
	if _, err := l.file.Seek(0, 0); err != nil {
		return fmt.Errorf("seek instance metadata: %w", err)
	}
	encoder := json.NewEncoder(l.file)
	if err := encoder.Encode(metadata); err != nil {
		return fmt.Errorf("write instance metadata: %w", err)
	}
	if err := l.file.Sync(); err != nil {
		return fmt.Errorf("sync instance metadata: %w", err)
	}
	return nil
}

func (l *InstanceLock) Close() error {
	if l == nil || l.file == nil {
		return nil
	}
	file := l.file
	l.file = nil
	unlockErr := syscall.Flock(int(file.Fd()), syscall.LOCK_UN)
	closeErr := file.Close()
	if unlockErr != nil {
		return unlockErr
	}
	return closeErr
}
