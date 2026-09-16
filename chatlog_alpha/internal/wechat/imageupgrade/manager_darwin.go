//go:build darwin

package imageupgrade

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/rs/zerolog/log"
)

// WeChat 4.1.12 / 269365 wechat.dylib (universal).
const receiveUpgradeResourceSHA = "9109337319f72712d3a69cc6bbdced7916303cfae35005ec1c7762899fad7111"

type manager struct {
	mu        sync.RWMutex
	status    Status
	statePath string
	command   *exec.Cmd
	done      chan struct{}
	runID     uint64
}

type agentEvent struct {
	Event         string    `json:"event"`
	PID           int       `json:"pid"`
	ResourceSHA   string    `json:"resource_sha"`
	Error         string    `json:"error"`
	Requests      uint64    `json:"requests"`
	Upgraded      uint64    `json:"upgraded"`
	Skipped       uint64    `json:"skipped"`
	LastRequestAt int64     `json:"last_request_at"`
	LastUpgradeAt int64     `json:"last_upgrade_at"`
	LastScopeKey  string    `json:"last_scope_key"`
	Upgrade       *Upgrade  `json:"upgrade"`
}

func NewManager() Manager {
	return &manager{status: Status{Supported: true, ResourceSHA: receiveUpgradeResourceSHA}}
}

func (m *manager) Start(input Options) error {
	options := normalizeOptions(input)
	if options.PID <= 0 {
		return fmt.Errorf("微信进程 PID 无效")
	}
	python, err := findFridaPython()
	if err != nil {
		return err
	}
	m.Stop()

	scopeJSON, err := json.Marshal(options.Talkers)
	if err != nil {
		return fmt.Errorf("encode image receive scope: %w", err)
	}
	command := exec.Command(
		python, "-u", "-c", receiveUpgradeAgent,
		"--parent-pid", strconv.Itoa(os.Getpid()),
		"--pid", strconv.Itoa(options.PID),
		"--scope-all", strconv.FormatBool(options.ScopeAll),
		"--talkers-json", string(scopeJSON),
	)
	command.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	stdout, err := command.StdoutPipe()
	if err != nil {
		return fmt.Errorf("open image receive helper output: %w", err)
	}
	stderr, err := command.StderrPipe()
	if err != nil {
		return fmt.Errorf("open image receive helper errors: %w", err)
	}
	if err := command.Start(); err != nil {
		return fmt.Errorf("start image receive helper: %w", err)
	}

	ready := make(chan error, 1)
	var readyOnce sync.Once
	done := make(chan struct{})
	m.mu.Lock()
	m.runID++
	runID := m.runID
	m.command = command
	m.done = done
	m.statePath = options.StatePath
	m.status = Status{
		Supported:      true,
		Running:        true,
		PID:            options.PID,
		ScopeAll:       options.ScopeAll,
		ScopeCount:     len(options.Talkers),
		StartedAt:      time.Now().Unix(),
		ResourceSHA:    receiveUpgradeResourceSHA,
		RecentUpgrades: loadRecent(options.StatePath),
	}
	m.mu.Unlock()

	go m.scanAgentOutput(stdout, runID, ready, &readyOnce)
	go scanAgentErrors(stderr)
	go func() {
		waitErr := command.Wait()
		m.mu.Lock()
		if m.runID == runID {
			m.command = nil
			m.status.Running = false
			m.status.Attached = false
			if waitErr != nil && strings.TrimSpace(m.status.LastError) == "" {
				m.status.LastError = waitErr.Error()
			}
		}
		m.mu.Unlock()
		readyOnce.Do(func() {
			if waitErr == nil {
				waitErr = errors.New("image receive helper exited before attach")
			}
			ready <- waitErr
		})
		close(done)
	}()

	timer := time.NewTimer(15 * time.Second)
	defer timer.Stop()
	select {
	case readyErr := <-ready:
		if readyErr == nil {
			return nil
		}
		m.Stop()
		return readyErr
	case <-timer.C:
		m.setError(runID, "等待图片接收升级组件连接超时")
		m.Stop()
		return fmt.Errorf("等待图片接收升级组件连接超时")
	}
}

func (m *manager) Stop() {
	m.mu.Lock()
	command := m.command
	done := m.done
	m.command = nil
	m.done = nil
	m.status.Running = false
	m.status.Attached = false
	m.mu.Unlock()
	if command == nil || command.Process == nil {
		return
	}
	_ = syscall.Kill(-command.Process.Pid, syscall.SIGTERM)
	if done == nil {
		return
	}
	select {
	case <-done:
	case <-time.After(3 * time.Second):
		_ = syscall.Kill(-command.Process.Pid, syscall.SIGKILL)
		select {
		case <-done:
		case <-time.After(time.Second):
		}
	}
}

func (m *manager) Snapshot() Status {
	m.mu.RLock()
	defer m.mu.RUnlock()
	status := m.status
	status.RecentUpgrades = append([]Upgrade(nil), m.status.RecentUpgrades...)
	return status
}

func (m *manager) scanAgentOutput(output interface{ Read([]byte) (int, error) }, runID uint64, ready chan<- error, readyOnce *sync.Once) {
	scanner := bufio.NewScanner(output)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		var event agentEvent
		if err := json.Unmarshal([]byte(line), &event); err != nil {
			log.Debug().Str("line", line).Msg("ignore malformed image receive helper output")
			continue
		}
		if event.Event == "attached" {
			readyOnce.Do(func() { ready <- nil })
		}
		if event.Event == "fatal" {
			message := strings.TrimSpace(event.Error)
			if message == "" {
				message = "图片接收升级组件启动失败"
			}
			readyOnce.Do(func() { ready <- errors.New(message) })
		}
		m.applyEvent(runID, event)
	}
	if err := scanner.Err(); err != nil {
		m.setError(runID, err.Error())
	}
}

func scanAgentErrors(output interface{ Read([]byte) (int, error) }) {
	scanner := bufio.NewScanner(output)
	scanner.Buffer(make([]byte, 0, 16*1024), 256*1024)
	for scanner.Scan() {
		if line := strings.TrimSpace(scanner.Text()); line != "" {
			log.Debug().Str("detail", line).Msg("image receive helper diagnostic")
		}
	}
}

func (m *manager) applyEvent(runID uint64, event agentEvent) {
	m.mu.Lock()
	if m.runID != runID {
		m.mu.Unlock()
		return
	}
	switch event.Event {
	case "attached":
		m.status.Attached = true
		m.status.AttachedAt = time.Now().Unix()
		if event.PID > 0 {
			m.status.PID = event.PID
		}
		if event.ResourceSHA != "" {
			m.status.ResourceSHA = event.ResourceSHA
		}
		m.status.LastError = ""
	case "state":
		m.status.Requests = event.Requests
		m.status.Upgraded = event.Upgraded
		m.status.Skipped = event.Skipped
		m.status.LastRequestAt = event.LastRequestAt
		m.status.LastUpgradeAt = event.LastUpgradeAt
		m.status.LastScopeKey = event.LastScopeKey
	case "upgrade":
		if event.Upgrade != nil {
			m.status.LastTalker = event.Upgrade.Talker
			m.status.LastUpgradeAt = event.Upgrade.At
			m.status.RecentUpgrades = appendRecent(m.status.RecentUpgrades, *event.Upgrade)
			path := m.statePath
			items := append([]Upgrade(nil), m.status.RecentUpgrades...)
			m.mu.Unlock()
			if err := persistRecent(path, items); err != nil {
				m.setError(runID, err.Error())
			}
			return
		}
	case "fatal":
		m.status.LastError = strings.TrimSpace(event.Error)
		m.status.Attached = false
	case "detached":
		m.status.Attached = false
	}
	m.mu.Unlock()
}

func (m *manager) setError(runID uint64, message string) {
	m.mu.Lock()
	if m.runID == runID {
		m.status.LastError = strings.TrimSpace(message)
	}
	m.mu.Unlock()
}

func findFridaPython() (string, error) {
	seen := map[string]struct{}{}
	for _, candidate := range []string{"python3", "python", "/opt/homebrew/bin/python3", "/usr/local/bin/python3"} {
		path, err := exec.LookPath(candidate)
		if err != nil {
			continue
		}
		if _, exists := seen[path]; exists {
			continue
		}
		seen[path] = struct{}{}
		probe := exec.Command(path, "-c", "import importlib.util,sys;sys.exit(0 if importlib.util.find_spec('frida') else 1)")
		if probe.Run() == nil {
			return path, nil
		}
	}
	return "", fmt.Errorf("未找到带 Frida 模块的 Python 运行环境")
}

const receiveUpgradeAgent = `
import argparse
import hashlib
import json
import os
import signal
import sys
import time

RESOURCE = "/Applications/WeChat.app/Contents/Resources/wechat.dylib"
EXPECTED_SHA = "9109337319f72712d3a69cc6bbdced7916303cfae35005ec1c7762899fad7111"

def emit(payload):
    sys.stdout.write(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n")
    sys.stdout.flush()

def alive(pid):
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--parent-pid", type=int, required=True)
    parser.add_argument("--pid", type=int, required=True)
    parser.add_argument("--scope-all", choices=("true", "false"), required=True)
    parser.add_argument("--talkers-json", required=True)
    args = parser.parse_args()
    running = True
    def stop(_signum, _frame):
        nonlocal running
        running = False
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    if not alive(args.pid):
        raise RuntimeError("selected WeChat PID is not running")
    with open(RESOURCE, "rb") as handle:
        resource_sha = hashlib.sha256(handle.read()).hexdigest()
    if resource_sha != EXPECTED_SHA:
        raise RuntimeError("WeChat resource fingerprint does not match the verified build: " + resource_sha)
    talkers = json.loads(args.talkers_json)
    config = {"all": args.scope_all == "true", "talkers": talkers}
    import frida
    session = None
    script = None
    try:
        session = frida.attach(args.pid)
        source = AGENT.replace("__CONFIG__", json.dumps(config, ensure_ascii=False))
        script = session.create_script(source)
        script.load()
        emit({"event":"attached", "pid":args.pid, "resource_sha":resource_sha})
        last_state = None
        while running and alive(args.parent_pid) and alive(args.pid):
            snapshot = script.exports_sync.drain()
            state = (
                int(snapshot.get("requests", 0)), int(snapshot.get("upgraded", 0)),
                int(snapshot.get("skipped", 0)), int(snapshot.get("last_request_at", 0)),
                int(snapshot.get("last_upgrade_at", 0)), snapshot.get("last_scope_key", "")
            )
            if state != last_state:
                emit({
                    "event":"state", "requests":state[0], "upgraded":state[1],
                    "skipped":state[2], "last_request_at":state[3],
                    "last_upgrade_at":state[4], "last_scope_key":state[5]
                })
                last_state = state
            for item in snapshot.get("events", []):
                emit({"event":"upgrade", "upgrade":item})
            time.sleep(0.25)
    finally:
        if script is not None:
            try:
                script.exports_sync.stop()
            except Exception:
                pass
            time.sleep(0.1)
            try:
                script.unload()
            except Exception:
                pass
        if session is not None:
            try:
                session.detach()
            except Exception:
                pass
        try:
            frida.shutdown()
        except Exception:
            pass
        emit({"event":"detached", "pid":args.pid})

try:
    AGENT = r'''
'use strict';
const CONFIG = __CONFIG__;
const RESOURCE_SUFFIX = '/Contents/Resources/wechat.dylib';
// StartC2CDownload_A + 0x58: mov x1, x19; bl StartC2CDownload_B
const PRE_START_B_OFFSET = 0x551cc1c;
const PRE_START_B_INSN = 0xaa1303e1;
let stopped = false;
let listener = null;
let requests = 0;
let upgraded = 0;
let skipped = 0;
let lastRequestAt = 0;
let lastUpgradeAt = 0;
let lastScopeKey = '';
let events = [];

function readStdString(object, offset) {
  try {
    const field = object.add(offset);
    const marker = field.add(0x17).readS8();
    let length = marker;
    let data = field;
    if (marker < 0) {
      length = Number(field.add(8).readU64());
      data = field.readPointer();
    }
    if (length <= 0 || length > 4096 || data.isNull()) return '';
    return data.readUtf8String(length) || '';
  } catch (_) {
    return '';
  }
}

function parseScopeKey(scopeKey, at) {
  const match = /^(.*)_(\d+)_(\d+)_(\d+)$/.exec(scopeKey);
  if (!match) return null;
  return {
    talker: match[1],
    message_time: Number(match[2]),
    db_local_id: Number(match[3]),
    at: Math.floor(at / 1000)
  };
}

function scopeAllows(scopeKey) {
  if (CONFIG.all === true) return true;
  const lower = scopeKey.toLowerCase();
  for (let i = 0; i < CONFIG.talkers.length; i++) {
    const talker = String(CONFIG.talkers[i] || '').trim().toLowerCase();
    if (talker && (lower === talker || lower.indexOf(talker + '_') === 0)) return true;
  }
  return false;
}

const modules = Process.enumerateModules().filter(function (item) {
  return item.path.endsWith(RESOURCE_SUFFIX);
});
if (modules.length !== 1) throw new Error('wechat.dylib count=' + modules.length);
const site = modules[0].base.add(PRE_START_B_OFFSET);
if (site.readU32() !== PRE_START_B_INSN) {
  throw new Error('StartC2CDownload hook site mismatch at 0x' + site.toString(16));
}
listener = Interceptor.attach(site, function () {
  if (stopped) return;
  try {
    const request = this.context.x19;
    if (!request || request.isNull()) return;
    if (request.add(0xa0).readS32() !== 3) return;
    const now = Date.now();
    const scopeKey = readStdString(request, 0x40);
    requests += 1;
    lastRequestAt = Math.floor(now / 1000);
    lastScopeKey = scopeKey;
    if (!scopeAllows(scopeKey)) {
      skipped += 1;
      return;
    }
    request.add(0xa0).writeS32(2);
    upgraded += 1;
    lastUpgradeAt = Math.floor(now / 1000);
    const event = parseScopeKey(scopeKey, now);
    if (event) {
      events.push(event);
      if (events.length > 64) events.shift();
    }
  } catch (_) {
  }
});

rpc.exports = {
  drain: function () {
    const drained = events;
    events = [];
    return {
      requests: requests,
      upgraded: upgraded,
      skipped: skipped,
      last_request_at: lastRequestAt,
      last_upgrade_at: lastUpgradeAt,
      last_scope_key: lastScopeKey,
      events: drained
    };
  },
  stop: function () {
    stopped = true;
    if (listener !== null) {
      listener.detach();
      listener = null;
    }
    return true;
  }
};
'''
    main()
except Exception as error:
    emit({"event":"fatal", "error":str(error)})
    sys.exit(1)
`
