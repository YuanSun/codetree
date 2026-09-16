package http

import (
	"sync"
	"sync/atomic"
	"time"
)

// diagnosticsState owns all mutable state used by statistics, database audits,
// and the live runtime diagnostics dashboard. Keeping the synchronization
// primitives beside the data they protect makes the diagnostics subsystem an
// explicit unit instead of spreading its lifecycle across Service.
type diagnosticsState struct {
	statsCache     boundedCache[string, statsCacheEntry]
	statsComputeMu sync.Mutex

	databaseAuditRunMu  sync.Mutex
	databaseAuditMu     sync.RWMutex
	databaseAudit       *databaseAuditReport
	databaseAuditShards map[string]databaseAuditShardCache

	runtimeStartedAt       atomic.Int64
	runtimeRequestsTotal   atomic.Uint64
	runtimeRequestsActive  atomic.Int64
	runtimeRequestsPeak    atomic.Int64
	runtimeStatus2xx       atomic.Uint64
	runtimeStatus3xx       atomic.Uint64
	runtimeStatus4xx       atomic.Uint64
	runtimeStatus5xx       atomic.Uint64
	runtimeLatencyTotalNS  atomic.Uint64
	runtimeLatencyMaxNS    atomic.Uint64
	runtimeLastRequestAt   atomic.Int64
	runtimeLastRequest     atomic.Value
	runtimeDatabaseRead    atomic.Uint64
	runtimeDatabaseWritten atomic.Uint64
	runtimeDatabaseReads   atomic.Uint64
	runtimeDatabaseWrites  atomic.Uint64
	runtimeDatabaseIOMu    sync.Mutex
	runtimeDatabaseIOAt    time.Time
	runtimeDatabaseIORead  uint64
	runtimeDatabaseIOWrite uint64
	runtimeHTTPErrorsMu    sync.Mutex
	runtimeHTTPErrors      []runtimeHTTPErrorSnapshot
	runtimeHTTPErrorSeq    uint64
	runtimeProcessMu       sync.Mutex
	runtimeProcessSnapshot runtimeProcessSampler
	runtimeFileIOMu        sync.Mutex
	runtimeFileIO          runtimeFileIOSampler
	runtimeFileTrace       runtimeFileTraceMonitor
	runtimeDatabaseQueries databaseQueryMetrics
	runtimeControlMu       sync.Mutex
	runtimeControlStarted  bool
	runtimeControlDelay    time.Duration
	runtimeControlRunner   func()
}

func newDiagnosticsState() *diagnosticsState {
	return &diagnosticsState{
		databaseAuditShards: make(map[string]databaseAuditShardCache),
	}
}
