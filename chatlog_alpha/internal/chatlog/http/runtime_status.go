package http

import (
	"math"
	"net/http"
	"os"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/shirou/gopsutil/v4/process"

	"github.com/sjzar/chatlog/internal/chatlog/ports"
	"github.com/sjzar/chatlog/pkg/observability"
)

type runtimeProcessSampler struct {
	process *process.Process
}

type runtimeLastRequestSnapshot struct {
	Method     string  `json:"method"`
	Path       string  `json:"path"`
	Status     int     `json:"status"`
	DurationMS float64 `json:"duration_ms"`
	At         string  `json:"at"`
}

type runtimeHTTPErrorSnapshot struct {
	ID         uint64  `json:"id"`
	Method     string  `json:"method"`
	Path       string  `json:"path"`
	Status     int     `json:"status"`
	DurationMS float64 `json:"duration_ms"`
	RequestID  string  `json:"request_id,omitempty"`
	At         string  `json:"at"`
}

func (s *Service) resetRuntimeMetrics(startedAt time.Time) {
	if startedAt.IsZero() {
		startedAt = time.Now()
	}
	s.diagnosticsState.runtimeStartedAt.Store(startedAt.UnixNano())
	s.diagnosticsState.runtimeRequestsTotal.Store(0)
	s.diagnosticsState.runtimeRequestsActive.Store(0)
	s.diagnosticsState.runtimeRequestsPeak.Store(0)
	s.diagnosticsState.runtimeStatus2xx.Store(0)
	s.diagnosticsState.runtimeStatus3xx.Store(0)
	s.diagnosticsState.runtimeStatus4xx.Store(0)
	s.diagnosticsState.runtimeStatus5xx.Store(0)
	s.diagnosticsState.runtimeLatencyTotalNS.Store(0)
	s.diagnosticsState.runtimeLatencyMaxNS.Store(0)
	s.diagnosticsState.runtimeLastRequestAt.Store(0)
	s.diagnosticsState.runtimeLastRequest.Store(runtimeLastRequestSnapshot{})
	s.diagnosticsState.runtimeDatabaseRead.Store(0)
	s.diagnosticsState.runtimeDatabaseWritten.Store(0)
	s.diagnosticsState.runtimeDatabaseReads.Store(0)
	s.diagnosticsState.runtimeDatabaseWrites.Store(0)
	s.diagnosticsState.runtimeDatabaseIOMu.Lock()
	s.diagnosticsState.runtimeDatabaseIOAt = startedAt
	s.diagnosticsState.runtimeDatabaseIORead = 0
	s.diagnosticsState.runtimeDatabaseIOWrite = 0
	s.diagnosticsState.runtimeDatabaseIOMu.Unlock()
	s.diagnosticsState.runtimeHTTPErrorsMu.Lock()
	s.diagnosticsState.runtimeHTTPErrors = nil
	s.diagnosticsState.runtimeHTTPErrorSeq = 0
	s.diagnosticsState.runtimeHTTPErrorsMu.Unlock()
	s.diagnosticsState.runtimeDatabaseQueries.Reset()

	s.diagnosticsState.runtimeProcessMu.Lock()
	s.diagnosticsState.runtimeProcessSnapshot.process = nil
	if current, err := process.NewProcess(int32(os.Getpid())); err == nil {
		s.diagnosticsState.runtimeProcessSnapshot.process = current
		_, _ = current.Percent(0)
	}
	s.diagnosticsState.runtimeProcessMu.Unlock()

	s.diagnosticsState.runtimeFileIOMu.Lock()
	s.diagnosticsState.runtimeFileIO = runtimeFileIOSampler{
		counters: make(map[int]runtimeFileIOCounter),
	}
	s.diagnosticsState.runtimeFileIOMu.Unlock()
}

func runtimeRequestTracked(path string) bool {
	return strings.HasPrefix(path, "/api/") ||
		strings.HasPrefix(path, "/image/") ||
		strings.HasPrefix(path, "/video/") ||
		strings.HasPrefix(path, "/voice/") ||
		strings.HasPrefix(path, "/file/") ||
		strings.HasPrefix(path, "/data/")
}

func (s *Service) runtimeMetricsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		path := c.Request.URL.Path
		if path == "/api/v1/runtime/status" || path == "/api/v1/events" || !runtimeRequestTracked(path) {
			c.Next()
			return
		}

		startedAt := time.Now()
		active := s.diagnosticsState.runtimeRequestsActive.Add(1)
		updateAtomicMaximum(&s.diagnosticsState.runtimeRequestsPeak, active)
		c.Next()

		duration := time.Since(startedAt)
		s.diagnosticsState.runtimeRequestsActive.Add(-1)
		s.diagnosticsState.runtimeRequestsTotal.Add(1)
		s.diagnosticsState.runtimeLatencyTotalNS.Add(uint64(duration))
		updateAtomicMaximumUint(&s.diagnosticsState.runtimeLatencyMaxNS, uint64(duration))

		status := c.Writer.Status()
		switch {
		case status >= 500:
			s.diagnosticsState.runtimeStatus5xx.Add(1)
		case status >= 400:
			s.diagnosticsState.runtimeStatus4xx.Add(1)
		case status >= 300:
			s.diagnosticsState.runtimeStatus3xx.Add(1)
		default:
			s.diagnosticsState.runtimeStatus2xx.Add(1)
		}
		finishedAt := time.Now()
		s.diagnosticsState.runtimeLastRequestAt.Store(finishedAt.UnixNano())
		s.diagnosticsState.runtimeLastRequest.Store(runtimeLastRequestSnapshot{
			Method:     c.Request.Method,
			Path:       path,
			Status:     status,
			DurationMS: roundedMilliseconds(duration),
			At:         finishedAt.Format(time.RFC3339Nano),
		})
		if databaseRequest, _ := c.Get(databaseRequestContextKey); databaseRequest == true {
			if size := c.Writer.Size(); size > 0 {
				s.diagnosticsState.runtimeDatabaseRead.Add(uint64(size))
			}
			s.diagnosticsState.runtimeDatabaseReads.Add(1)
			switch c.Request.Method {
			case http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete:
				if c.Request.ContentLength > 0 {
					s.diagnosticsState.runtimeDatabaseWritten.Add(uint64(c.Request.ContentLength))
				}
				s.diagnosticsState.runtimeDatabaseWrites.Add(1)
			}
			s.diagnosticsState.runtimeDatabaseQueries.Record(databaseQueryMetric{
				Operation:  path,
				Group:      databaseMetricString(c, databaseQueryGroupContextKey),
				Table:      databaseMetricString(c, databaseQueryTableContextKey),
				Path:       databaseMetricString(c, databaseQueryPathContextKey),
				Status:     status,
				Rows:       databaseMetricRows(c),
				DurationMS: roundedMilliseconds(duration),
				At:         finishedAt.Format(time.RFC3339Nano),
			})
		}
		if status >= http.StatusBadRequest {
			s.appendRuntimeHTTPError(runtimeHTTPErrorSnapshot{
				Method:     c.Request.Method,
				Path:       path,
				Status:     status,
				DurationMS: roundedMilliseconds(duration),
				RequestID:  c.GetString("RequestID"),
				At:         finishedAt.Format(time.RFC3339Nano),
			})
		}
		if status < http.StatusBadRequest && c.Request.Method != http.MethodGet &&
			(strings.HasPrefix(path, "/api/v1/hook/") || strings.HasPrefix(path, "/api/v1/ocr/")) {
			s.wakeEventStream()
		}
	}
}

func (s *Service) appendRuntimeHTTPError(entry runtimeHTTPErrorSnapshot) {
	s.diagnosticsState.runtimeHTTPErrorsMu.Lock()
	s.diagnosticsState.runtimeHTTPErrorSeq++
	entry.ID = s.diagnosticsState.runtimeHTTPErrorSeq
	s.diagnosticsState.runtimeHTTPErrors = append(s.diagnosticsState.runtimeHTTPErrors, entry)
	const limit = 200
	if overflow := len(s.diagnosticsState.runtimeHTTPErrors) - limit; overflow > 0 {
		copy(s.diagnosticsState.runtimeHTTPErrors, s.diagnosticsState.runtimeHTTPErrors[overflow:])
		s.diagnosticsState.runtimeHTTPErrors = s.diagnosticsState.runtimeHTTPErrors[:limit]
	}
	s.diagnosticsState.runtimeHTTPErrorsMu.Unlock()
}

func (s *Service) recentRuntimeHTTPErrors(limit int) []runtimeHTTPErrorSnapshot {
	if limit <= 0 {
		limit = 20
	}
	s.diagnosticsState.runtimeHTTPErrorsMu.Lock()
	defer s.diagnosticsState.runtimeHTTPErrorsMu.Unlock()
	if limit > len(s.diagnosticsState.runtimeHTTPErrors) {
		limit = len(s.diagnosticsState.runtimeHTTPErrors)
	}
	result := make([]runtimeHTTPErrorSnapshot, 0, limit)
	for index := len(s.diagnosticsState.runtimeHTTPErrors) - 1; index >= 0 && len(result) < limit; index-- {
		result = append(result, s.diagnosticsState.runtimeHTTPErrors[index])
	}
	return result
}

func (s *Service) databaseIOSnapshot(now time.Time) gin.H {
	readBytes := s.diagnosticsState.runtimeDatabaseRead.Load()
	writtenBytes := s.diagnosticsState.runtimeDatabaseWritten.Load()
	s.diagnosticsState.runtimeDatabaseIOMu.Lock()
	elapsed := now.Sub(s.diagnosticsState.runtimeDatabaseIOAt).Seconds()
	readBPS := float64(0)
	writeBPS := float64(0)
	if elapsed > 0 {
		readBPS = float64(readBytes-s.diagnosticsState.runtimeDatabaseIORead) / elapsed
		writeBPS = float64(writtenBytes-s.diagnosticsState.runtimeDatabaseIOWrite) / elapsed
	}
	s.diagnosticsState.runtimeDatabaseIOAt = now
	s.diagnosticsState.runtimeDatabaseIORead = readBytes
	s.diagnosticsState.runtimeDatabaseIOWrite = writtenBytes
	s.diagnosticsState.runtimeDatabaseIOMu.Unlock()
	return gin.H{
		"read_bytes_total":  readBytes,
		"write_bytes_total": writtenBytes,
		"read_bytes_sec":    math.Round(readBPS*100) / 100,
		"write_bytes_sec":   math.Round(writeBPS*100) / 100,
		"read_operations":   s.diagnosticsState.runtimeDatabaseReads.Load(),
		"write_operations":  s.diagnosticsState.runtimeDatabaseWrites.Load(),
		"measurement":       "logical database API payload bytes",
	}
}

func updateAtomicMaximum(target interface {
	Load() int64
	CompareAndSwap(old, new int64) bool
}, value int64) {
	for current := target.Load(); value > current; current = target.Load() {
		if target.CompareAndSwap(current, value) {
			return
		}
	}
}

func updateAtomicMaximumUint(target interface {
	Load() uint64
	CompareAndSwap(old, new uint64) bool
}, value uint64) {
	for current := target.Load(); value > current; current = target.Load() {
		if target.CompareAndSwap(current, value) {
			return
		}
	}
}

func roundedMilliseconds(duration time.Duration) float64 {
	return math.Round(float64(duration)/float64(time.Millisecond)*100) / 100
}

func databaseStateName(state ports.DatabaseState) string {
	switch state {
	case ports.DatabaseStateOpening:
		return "opening"
	case ports.DatabaseStateReady:
		return "ready"
	case ports.DatabaseStateError:
		return "error"
	default:
		return "initializing"
	}
}

func (s *Service) runtimeListenerSnapshot() (bool, string) {
	s.serverMu.Lock()
	defer s.serverMu.Unlock()
	if s.server == nil {
		if s.conf == nil {
			return false, ""
		}
		return false, strings.TrimSpace(s.conf.GetHTTPAddr())
	}
	if s.listen != nil {
		return true, s.listen.Addr().String()
	}
	return true, s.server.Addr
}

func (s *Service) processSnapshot() gin.H {
	result := gin.H{
		"pid":         os.Getpid(),
		"cpu_percent": float64(0),
		"rss_bytes":   uint64(0),
		"memory_pct":  float64(0),
		"threads":     int32(0),
	}

	s.diagnosticsState.runtimeProcessMu.Lock()
	defer s.diagnosticsState.runtimeProcessMu.Unlock()
	current := s.diagnosticsState.runtimeProcessSnapshot.process
	if current == nil {
		if created, err := process.NewProcess(int32(os.Getpid())); err == nil {
			current = created
			s.diagnosticsState.runtimeProcessSnapshot.process = created
			_, _ = current.Percent(0)
		}
	}
	if current == nil {
		return result
	}
	if value, err := current.Percent(0); err == nil && !math.IsNaN(value) && !math.IsInf(value, 0) {
		result["cpu_percent"] = math.Round(value*100) / 100
	}
	if value, err := current.MemoryInfo(); err == nil && value != nil {
		result["rss_bytes"] = value.RSS
	}
	if value, err := current.MemoryPercent(); err == nil {
		result["memory_pct"] = math.Round(float64(value)*100) / 100
	}
	if value, err := current.NumThreads(); err == nil {
		result["threads"] = value
	}
	return result
}

func (s *Service) handleRuntimeStatus(c *gin.Context) {
	c.JSON(http.StatusOK, s.runtimeStatusSnapshot(time.Now()))
}

func (s *Service) runtimeStatusSnapshot(now time.Time) gin.H {
	startedAtUnixNano := s.diagnosticsState.runtimeStartedAt.Load()
	startedAt := time.Unix(0, startedAtUnixNano)
	if startedAtUnixNano <= 0 || startedAt.After(now) {
		startedAt = now
	}

	var memory runtime.MemStats
	runtime.ReadMemStats(&memory)
	lastPauseNS := uint64(0)
	if memory.NumGC > 0 {
		lastPauseNS = memory.PauseNs[(memory.NumGC-1)%uint32(len(memory.PauseNs))]
	}

	databaseState := ports.DatabaseStateInit
	databaseMessage := ""
	databaseReady := false
	if s.db != nil {
		databaseState, databaseMessage = s.db.Status()
		databaseReady = s.db.Ready()
	}
	listenerActive, listenAddress := s.runtimeListenerSnapshot()

	totalRequests := s.diagnosticsState.runtimeRequestsTotal.Load()
	totalLatencyNS := s.diagnosticsState.runtimeLatencyTotalNS.Load()
	averageLatencyMS := float64(0)
	if totalRequests > 0 {
		averageLatencyMS = math.Round((float64(totalLatencyNS)/float64(totalRequests)/float64(time.Millisecond))*100) / 100
	}
	lastRequest, _ := s.diagnosticsState.runtimeLastRequest.Load().(runtimeLastRequestSnapshot)
	databaseIO := s.databaseIOSnapshot(now)
	fileIO := s.fileIOSnapshot(now)
	messageChanges := s.db.MessageChangeStats()

	return gin.H{
		"timestamp": now.Format(time.RFC3339Nano),
		"service": gin.H{
			"status":          "running",
			"started_at":      startedAt.Format(time.RFC3339Nano),
			"uptime_seconds":  math.Max(0, now.Sub(startedAt).Seconds()),
			"listener_active": listenerActive,
			"listen_address":  listenAddress,
			"go_version":      runtime.Version(),
			"platform":        "darwin/" + runtime.GOARCH,
		},
		"database": gin.H{
			"state":             databaseStateName(databaseState),
			"ready":             databaseReady,
			"message":           databaseMessage,
			"io":                databaseIO,
			"audit":             s.cachedDatabaseAuditSummary(),
			"query_performance": s.diagnosticsState.runtimeDatabaseQueries.Snapshot(),
			"message_changes":   messageChanges,
		},
		"process": s.processSnapshot(),
		"file_io": fileIO,
		"runtime": gin.H{
			"goroutines":   runtime.NumGoroutine(),
			"cpu_count":    runtime.NumCPU(),
			"gomaxprocs":   runtime.GOMAXPROCS(0),
			"cgo_calls":    runtime.NumCgoCall(),
			"heap_objects": memory.HeapObjects,
		},
		"memory": gin.H{
			"heap_alloc_bytes":    memory.HeapAlloc,
			"heap_inuse_bytes":    memory.HeapInuse,
			"heap_idle_bytes":     memory.HeapIdle,
			"heap_released_bytes": memory.HeapReleased,
			"heap_sys_bytes":      memory.HeapSys,
			"stack_inuse_bytes":   memory.StackInuse,
			"sys_bytes":           memory.Sys,
			"next_gc_bytes":       memory.NextGC,
		},
		"gc": gin.H{
			"cycles":         memory.NumGC,
			"pause_total_ms": roundedMilliseconds(time.Duration(memory.PauseTotalNs)),
			"last_pause_ms":  roundedMilliseconds(time.Duration(lastPauseNS)),
			"last_gc_at":     runtimeLastGCTimestamp(memory.LastGC),
		},
		"http": gin.H{
			"requests_total":       totalRequests,
			"active_requests":      s.diagnosticsState.runtimeRequestsActive.Load(),
			"peak_active_requests": s.diagnosticsState.runtimeRequestsPeak.Load(),
			"status_2xx":           s.diagnosticsState.runtimeStatus2xx.Load(),
			"status_3xx":           s.diagnosticsState.runtimeStatus3xx.Load(),
			"status_4xx":           s.diagnosticsState.runtimeStatus4xx.Load(),
			"status_5xx":           s.diagnosticsState.runtimeStatus5xx.Load(),
			"average_latency_ms":   averageLatencyMS,
			"max_latency_ms":       roundedMilliseconds(time.Duration(s.diagnosticsState.runtimeLatencyMaxNS.Load())),
			"last_request_at":      runtimeTimestamp(s.diagnosticsState.runtimeLastRequestAt.Load()),
			"last_request":         lastRequest,
			"recent_errors":        s.recentRuntimeHTTPErrors(30),
		},
		"resources": gin.H{
			"caches": gin.H{
				"media_paths":    gin.H{"entries": s.mediaState.md5PathCache.Len(), "capacity": md5PathCacheLimit},
				"sns_keys":       gin.H{"entries": s.mediaState.snsMediaKeyCache.Len(), "capacity": snsMediaKeyCacheLimit},
				"statistics":     gin.H{"entries": s.diagnosticsState.statsCache.Len(), "capacity": statsCacheLimit},
				"database_audit": gin.H{"entries": s.databaseAuditCacheEntries(), "capacity": 1},
			},
			"media_workers": gin.H{
				"local": gin.H{"active": len(s.mediaState.localMediaSlots), "capacity": maxConcurrentLocalMedia},
				"sns":   gin.H{"active": len(s.mediaState.snsMediaSlots), "capacity": maxConcurrentSNSMedia},
			},
		},
	}
}

func (s *Service) handleRuntimeLogs(c *gin.Context) {
	limit, err := strconv.Atoi(strings.TrimSpace(c.DefaultQuery("limit", "100")))
	if err != nil || limit < 1 {
		limit = 100
	}
	c.JSON(http.StatusOK, s.runtimeLogsSnapshot(c.Query("category"), c.Query("level"), limit))
}

func (s *Service) runtimeLogsSnapshot(category, level string, limit int) gin.H {
	store := observability.Logs()
	return gin.H{
		"entries":    store.Recent(category, level, limit),
		"total":      store.Len(),
		"categories": store.CategoryCounts(),
		"timestamp":  time.Now().Format(time.RFC3339Nano),
	}
}

func runtimeTimestamp(unixNano int64) string {
	if unixNano <= 0 {
		return ""
	}
	return time.Unix(0, unixNano).Format(time.RFC3339Nano)
}

func runtimeLastGCTimestamp(unixNano uint64) string {
	if unixNano == 0 {
		return ""
	}
	return time.Unix(0, int64(unixNano)).Format(time.RFC3339Nano)
}
