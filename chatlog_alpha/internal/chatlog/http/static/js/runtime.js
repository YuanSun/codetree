'use strict';


import { escapeHtml, finiteNumber, showToast } from './ui.js';
import { createActionHandlers } from './events.js';
import { applyHookEvents, renderHookStatus, updateHookPollState } from './hooks.js';
import { requestJSON } from './api.js';

let runtimeEventSource = null;
let runtimeDashboardStreamData = null;
let runtimeLogsStreamData = null;
let runtimeDashboardController = null;
let runtimeDashboardPromise = null;
let runtimeFileTraceLastStatus = null;
let runtimeLogsPromise = null;
let runtimeCachePromise = null;
let runtimeFileTracePromise = null;
let runtimeFileTraceFilterTimer = null;
let runtimeDatabaseAuditPromise = null;
let runtimeDashboardFailures = 0;
let runtimeTerminatePending = false;
const runtimeDashboardSamples = [];
const runtimeDashboardSampleLimit = 45;

const runtimeNumber = finiteNumber;

function formatRuntimeBytes(value) {
    let bytes = Math.max(0, runtimeNumber(value));
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let unit = 0;
    while (bytes >= 1024 && unit < units.length - 1) {
        bytes /= 1024;
        unit += 1;
    }
    const digits = bytes >= 100 || unit === 0 ? 0 : bytes >= 10 ? 1 : 2;
    return `${bytes.toFixed(digits)} ${units[unit]}`;
}

function formatRuntimeRate(value) {
    return `${formatRuntimeBytes(value)}/s`;
}

function formatRuntimeDuration(seconds) {
    let remaining = Math.max(0, Math.floor(runtimeNumber(seconds)));
    const days = Math.floor(remaining / 86400);
    remaining %= 86400;
    const hours = Math.floor(remaining / 3600);
    remaining %= 3600;
    const minutes = Math.floor(remaining / 60);
    const secs = remaining % 60;
    if (days > 0) return `${days}天 ${hours}小时`;
    if (hours > 0) return `${hours}小时 ${minutes}分`;
    if (minutes > 0) return `${minutes}分 ${secs}秒`;
    return `${secs}秒`;
}

function formatRuntimeTime(value, includeDate = false) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    const options = includeDate
        ? { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }
        : { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    return date.toLocaleString('zh-CN', options);
}

function setRuntimeText(id, value, title = '') {
    const element = document.getElementById(id);
    if (!element) return;
    element.textContent = value;
    if (title) element.title = title;
    else element.removeAttribute('title');
}

function renderRuntimeSparkline(id, values, color) {
    const container = document.getElementById(id);
    if (!container) return;
    const safeValues = values.map(value => Math.max(0, runtimeNumber(value))).filter(Number.isFinite);
    if (safeValues.length === 0) {
        container.innerHTML = '<span class="runtime-sparkline-empty">等待更多样本</span>';
        return;
    }
    const width = 320;
    const height = 82;
    const padding = 4;
    const minimum = Math.min(...safeValues);
    const maximum = Math.max(...safeValues);
    const range = Math.max(1, maximum - minimum);
    const points = safeValues.map((value, index) => {
        const x = safeValues.length === 1 ? width - padding : padding + (index / (safeValues.length - 1)) * (width - padding * 2);
        const y = height - padding - ((value - minimum) / range) * (height - padding * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const lastPoint = points.split(' ').at(-1).split(',');
    const areaPoints = `${padding},${height - padding} ${points} ${width - padding},${height - padding}`;
    container.innerHTML = `
        <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img">
            <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" class="runtime-sparkline-base"></line>
            <polygon points="${areaPoints}" fill="${color}" opacity="0.10"></polygon>
            <polyline points="${points}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></polyline>
            <circle cx="${lastPoint[0]}" cy="${lastPoint[1]}" r="3.5" fill="${color}"></circle>
        </svg>`;
}

function runtimeResourceRow(label, usage, formatter = value => Number(value).toLocaleString('zh-CN')) {
    const entries = Math.max(0, runtimeNumber(usage && (usage.entries ?? usage.active)));
    const capacity = Math.max(0, runtimeNumber(usage && usage.capacity));
    const ratio = capacity > 0 ? Math.min(100, entries / capacity * 100) : 0;
    return `
        <div class="runtime-resource-row">
            <div><span>${escapeHtml(label)}</span><strong>${escapeHtml(formatter(entries))} / ${escapeHtml(formatter(capacity))}</strong></div>
            <div class="runtime-resource-track"><i style="width:${ratio.toFixed(2)}%"></i></div>
        </div>`;
}

function renderRuntimeDiagnostics(data, previousSample) {
    const diagnostics = [];
    const database = data.database || {};
    const process = data.process || {};
    const goRuntime = data.runtime || {};
    const memory = data.memory || {};
    const http = data.http || {};
    const resources = data.resources || {};
    const mediaWorkers = resources.media_workers || {};
    const databaseAudit = database.audit || {};
    const databaseAuditAlerts = Array.isArray(databaseAudit.alerts) ? databaseAudit.alerts : [];

    if (!database.ready) {
        const labels = { initializing: '数据库初始化中', opening: '数据库直读初始化中', error: '数据库状态异常' };
        diagnostics.push({
            level: database.state === 'error' ? 'error' : 'warning',
            title: labels[database.state] || '数据库尚未就绪',
            detail: database.message || '数据查询接口会在数据库就绪后恢复。'
        });
    }
    for (const alert of databaseAuditAlerts) {
        diagnostics.push({
            level: alert.level === 'error' ? 'error' : alert.level === 'warning' ? 'warning' : 'neutral',
            title: alert.title || alert.code || '数据库审计提示',
            detail: alert.detail || '-'
        });
    }
    if (databaseAudit.available && runtimeNumber(databaseAudit.age_seconds) > 600) {
        diagnostics.push({
            level: 'warning',
            title: '数据库审计快照已过期',
            detail: `上次审计距今 ${formatRuntimeDuration(databaseAudit.age_seconds)}，可按需点击“执行全库审计”更新。`
        });
    }
    if (runtimeNumber(http.average_latency_ms) >= 1000) {
        diagnostics.push({ level: 'warning', title: '平均响应时间偏高', detail: `当前 ${runtimeNumber(http.average_latency_ms).toFixed(0)} ms，优先检查慢查询和媒体读取。` });
    }
    if (runtimeNumber(process.cpu_percent) >= 85) {
        diagnostics.push({ level: 'warning', title: 'CPU 负载偏高', detail: `进程当前占用 ${runtimeNumber(process.cpu_percent).toFixed(1)}%，观察是否持续多个采样周期。` });
    }
    if (runtimeNumber(goRuntime.goroutines) >= 500) {
        diagnostics.push({ level: 'warning', title: 'Go 协程数量较高', detail: `当前 ${runtimeNumber(goRuntime.goroutines).toLocaleString('zh-CN')} 个，建议检查未结束的后台任务与请求。` });
    }
    const previous5xx = previousSample ? runtimeNumber(previousSample.http && previousSample.http.status_5xx) : runtimeNumber(http.status_5xx);
    if (runtimeNumber(http.status_5xx) > previous5xx) {
        diagnostics.push({ level: 'error', title: '最新采样出现 5xx', detail: `累计 ${runtimeNumber(http.status_5xx).toLocaleString('zh-CN')} 次，最近请求为 ${http.last_request?.method || '-'} ${http.last_request?.path || '-'}` });
    }
    if (runtimeDashboardSamples.length >= 10) {
        const windowSamples = runtimeDashboardSamples.slice(-10);
        const firstRSS = runtimeNumber(windowSamples[0]?.process?.rss_bytes);
        const lastRSS = runtimeNumber(windowSamples.at(-1)?.process?.rss_bytes);
        if (firstRSS > 0 && lastRSS > firstRSS * 1.25 && lastRSS - firstRSS > 32 * 1024 * 1024) {
            diagnostics.push({ level: 'warning', title: '内存持续上升', detail: `最近 20 秒 RSS 增长 ${formatRuntimeBytes(lastRSS - firstRSS)}，建议继续观察趋势并采集内存样本。` });
        }
    }
    for (const [name, usage] of [['本地媒体任务', mediaWorkers.local], ['朋友圈媒体任务', mediaWorkers.sns]]) {
        if (runtimeNumber(usage?.capacity) > 0 && runtimeNumber(usage?.active) >= runtimeNumber(usage.capacity)) {
            diagnostics.push({ level: 'warning', title: `${name}已满载`, detail: `${runtimeNumber(usage.active)} / ${runtimeNumber(usage.capacity)} 个槽位正在使用。` });
        }
    }
    const heapAlloc = runtimeNumber(memory.heap_alloc_bytes);
    const heapSys = runtimeNumber(memory.heap_sys_bytes);
    if (heapSys > 0 && heapAlloc / heapSys >= 0.9) {
        diagnostics.push({ level: 'warning', title: 'Go 堆使用率较高', detail: `已分配 ${formatRuntimeBytes(heapAlloc)}，堆保留 ${formatRuntimeBytes(heapSys)}。` });
    }
    if (diagnostics.length === 0) {
        diagnostics.push({ level: 'ok', title: '实时指标稳定', detail: '当前未发现需要立即处理的状态；继续观察趋势变化。' });
    }

    setRuntimeText('runtime-diagnostic-count', diagnostics[0].level === 'ok' ? '状态正常' : `${diagnostics.length} 条提示`);
    const container = document.getElementById('runtime-diagnostics');
    if (container) {
        container.innerHTML = diagnostics.map(item => `
            <div class="runtime-diagnostic is-${item.level}">
                <i aria-hidden="true"></i>
                <div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.detail)}</span></div>
            </div>`).join('');
    }
}

function renderRuntimeDashboard(data) {
    const service = data.service || {};
    const database = data.database || {};
    const process = data.process || {};
    const goRuntime = data.runtime || {};
    const memory = data.memory || {};
    const gc = data.gc || {};
    const http = data.http || {};
    const resources = data.resources || {};
    const mediaWorkers = resources.media_workers || {};
    const databaseIO = database.io || {};
    const messageChanges = database.message_changes || {};
    const fileIO = data.file_io || {};
    const queryPerformance = database.query_performance || {};
    const previousSample = runtimeDashboardSamples.at(-1);

    runtimeDashboardSamples.push(data);
    if (runtimeDashboardSamples.length > runtimeDashboardSampleLimit) runtimeDashboardSamples.shift();

    const overallDot = document.getElementById('runtime-overall-dot');
    if (overallDot) {
        overallDot.className = `runtime-overall-dot ${database.state === 'error' ? 'is-error' : database.ready ? 'is-ok' : 'is-warning'}`;
    }
    const overallTitle = database.state === 'error' ? '服务运行中，数据库异常' : database.ready ? '项目运行正常' : '服务运行中，数据库准备中';
    setRuntimeText('runtime-overall-state', overallTitle);
    setRuntimeText('runtime-overall-detail', `${service.go_version || 'Go'} · ${service.platform || '-'} · PID ${process.pid || '-'}`);
    setRuntimeText('runtime-listen-address', service.listen_address || '-');
    setRuntimeText('runtime-updated-at', formatRuntimeTime(data.timestamp));
    setRuntimeText('runtime-uptime', formatRuntimeDuration(service.uptime_seconds));
    setRuntimeText('runtime-started-at', `启动时间 ${formatRuntimeTime(service.started_at, true)}`);
    setRuntimeText('runtime-cpu', `${runtimeNumber(process.cpu_percent).toFixed(1)}%`);
    setRuntimeText('runtime-cpu-context', `${runtimeNumber(goRuntime.cpu_count).toLocaleString('zh-CN')} 个逻辑核心 · GOMAXPROCS ${runtimeNumber(goRuntime.gomaxprocs)}`);
    setRuntimeText('runtime-rss', formatRuntimeBytes(process.rss_bytes));
    setRuntimeText('runtime-heap-context', `Go 堆 ${formatRuntimeBytes(memory.heap_alloc_bytes)} · 系统占用 ${runtimeNumber(process.memory_pct).toFixed(2)}%`);
    setRuntimeText('runtime-goroutines', runtimeNumber(goRuntime.goroutines).toLocaleString('zh-CN'));
    setRuntimeText('runtime-thread-context', `系统线程 ${runtimeNumber(process.threads).toLocaleString('zh-CN')} · CGO ${runtimeNumber(goRuntime.cgo_calls).toLocaleString('zh-CN')}`);
    setRuntimeText('runtime-request-total', runtimeNumber(http.requests_total).toLocaleString('zh-CN'));
    setRuntimeText('runtime-request-active', `当前并发 ${runtimeNumber(http.active_requests)} · 峰值 ${runtimeNumber(http.peak_active_requests)}`);
    setRuntimeText('runtime-latency-average', `${runtimeNumber(http.average_latency_ms).toFixed(1)} ms`);
    setRuntimeText('runtime-latency-max', `最大 ${runtimeNumber(http.max_latency_ms).toFixed(1)} ms`);
    setRuntimeText('runtime-http-errors', (runtimeNumber(http.status_4xx) + runtimeNumber(http.status_5xx)).toLocaleString('zh-CN'));
    setRuntimeText('runtime-http-error-context', `4xx ${runtimeNumber(http.status_4xx)} · 5xx ${runtimeNumber(http.status_5xx)}`);
    const databaseLabels = { ready: '就绪', initializing: '初始化中', opening: '直读初始化中', error: '异常' };
    setRuntimeText('runtime-database-state', databaseLabels[database.state] || database.state || '-');
    setRuntimeText('runtime-database-message', database.message || (database.ready ? '查询服务可用' : '等待数据库状态'));
    setRuntimeText('runtime-sample-count', `${runtimeDashboardSamples.length} 个样本`);
    setRuntimeText('runtime-db-read-total', formatRuntimeBytes(databaseIO.read_bytes_total));
    setRuntimeText('runtime-db-write-total', formatRuntimeBytes(databaseIO.write_bytes_total));
    setRuntimeText('runtime-db-read-speed', formatRuntimeRate(databaseIO.read_bytes_sec));
    setRuntimeText('runtime-db-write-speed', formatRuntimeRate(databaseIO.write_bytes_sec));
    setRuntimeText('runtime-db-read-ops', `${runtimeNumber(databaseIO.read_operations).toLocaleString('zh-CN')} 次读取`);
    setRuntimeText('runtime-db-write-ops', `${runtimeNumber(databaseIO.write_operations).toLocaleString('zh-CN')} 次写入`);
    setRuntimeText('runtime-change-mode', messageChanges.running ? '统一事件流' : '未运行');
    setRuntimeText('runtime-change-subscribers', `${runtimeNumber(messageChanges.subscribers).toLocaleString('zh-CN')} 个消费者 · ${runtimeNumber(messageChanges.message_queries).toLocaleString('zh-CN')} 次消息查询 · 定向 ${runtimeNumber(messageChanges.targeted_scans).toLocaleString('zh-CN')}`);
    setRuntimeText('runtime-change-messages', runtimeNumber(messageChanges.published_messages).toLocaleString('zh-CN'));
    setRuntimeText('runtime-change-batches', `${runtimeNumber(messageChanges.published_batches).toLocaleString('zh-CN')} 个批次 · 重试 ${runtimeNumber(messageChanges.delivery_retries).toLocaleString('zh-CN')}`);
    setRuntimeText('runtime-change-pending', runtimeNumber(messageChanges.pending_deliveries).toLocaleString('zh-CN'));
    setRuntimeText('runtime-change-buffered', `${runtimeNumber(messageChanges.buffered_messages).toLocaleString('zh-CN')} 条回放缓存 · ${runtimeNumber(messageChanges.pending_source_files).toLocaleString('zh-CN')} 个源分片待处理`);
    setRuntimeText('runtime-change-lag', `${runtimeNumber(messageChanges.last_lag_ms).toLocaleString('zh-CN')} ms`);
    setRuntimeText('runtime-change-error', messageChanges.last_error || `最近扫描 ${runtimeNumber(messageChanges.last_scan_duration_ms).toLocaleString('zh-CN')} ms`);
    setRuntimeText('runtime-file-read-total', formatRuntimeBytes(fileIO.read_bytes_total));
    setRuntimeText('runtime-file-write-total', formatRuntimeBytes(fileIO.write_bytes_total));
    setRuntimeText('runtime-file-read-speed', formatRuntimeRate(fileIO.read_bytes_sec));
    setRuntimeText('runtime-file-write-speed', formatRuntimeRate(fileIO.write_bytes_sec));
    setRuntimeText('runtime-file-read-active', `当前活跃进程合计 ${formatRuntimeBytes(fileIO.active_read_bytes_total)}`);
    setRuntimeText('runtime-file-write-active', `当前活跃进程合计 ${formatRuntimeBytes(fileIO.active_write_bytes_total)}`);
    const fileIOProcessCount = runtimeNumber(fileIO.process_count);
    const fileIOUnavailableCount = runtimeNumber(fileIO.unavailable_count);
    setRuntimeText('runtime-file-io-state', fileIO.supported
        ? `${fileIOProcessCount.toLocaleString('zh-CN')} 个关联进程${fileIOUnavailableCount ? ` · ${fileIOUnavailableCount} 个采样失败` : ''} · ${formatRuntimeTime(fileIO.sampled_at)}`
        : (fileIO.error || `已识别 ${fileIOProcessCount.toLocaleString('zh-CN')} 个进程，等待磁盘 I/O 计数器`));
    renderRuntimeFileIOProcesses(fileIO);
    renderRuntimeFileTraceSummary(fileIO.detail_trace || {});
    loadRuntimeFileTraceDetails();
    setRuntimeText('runtime-query-p50', `${runtimeNumber(queryPerformance.p50_ms).toFixed(1)} ms`);
    setRuntimeText('runtime-query-p95', `${runtimeNumber(queryPerformance.p95_ms).toFixed(1)} ms`);
    setRuntimeText('runtime-query-p99', `${runtimeNumber(queryPerformance.p99_ms).toFixed(1)} ms`);
    setRuntimeText('runtime-query-errors', runtimeNumber(queryPerformance.errors).toLocaleString('zh-CN'));
    setRuntimeText('runtime-query-row-count', `累计返回 ${runtimeNumber(queryPerformance.rows_total).toLocaleString('zh-CN')} 行`);
    setRuntimeText('runtime-query-sample-count', `${runtimeNumber(queryPerformance.samples).toLocaleString('zh-CN')} 个样本 · 慢查询阈值 ${runtimeNumber(queryPerformance.slow_threshold_ms).toFixed(0)} ms`);
    const slowQueryContainer = document.getElementById('runtime-slow-queries');
    if (slowQueryContainer) {
        const slowQueries = Array.isArray(queryPerformance.slow_queries) ? queryPerformance.slow_queries : [];
        slowQueryContainer.innerHTML = slowQueries.length ? `
            <div class="table-scroll"><table>
                <thead><tr><th>耗时</th><th>接口</th><th>数据库组</th><th>表/策略</th><th>行数</th><th>时间</th></tr></thead>
                <tbody>${slowQueries.map(item => `<tr>
                    <td><strong>${runtimeNumber(item.duration_ms).toFixed(1)} ms</strong></td>
                    <td class="cell-monospace">${escapeHtml(item.operation || '-')}</td>
                    <td>${escapeHtml(item.group || '-')}</td>
                    <td class="cell-monospace">${escapeHtml(item.table || item.path || '-')}</td>
                    <td>${runtimeNumber(item.rows).toLocaleString('zh-CN')}</td>
                    <td>${escapeHtml(formatRuntimeTime(item.at))}</td>
                </tr>`).join('')}</tbody>
            </table></div>` : '<div class="runtime-list-empty">当前采样窗口没有超过阈值的数据库查询</div>';
    }

    const cpuSeries = runtimeDashboardSamples.map(sample => sample.process?.cpu_percent);
    const rssSeries = runtimeDashboardSamples.map(sample => sample.process?.rss_bytes);
    const latencySeries = runtimeDashboardSamples.map(sample => sample.http?.average_latency_ms);
    const goroutineSeries = runtimeDashboardSamples.map(sample => sample.runtime?.goroutines);
    const databaseReadSeries = runtimeDashboardSamples.map(sample => sample.database?.io?.read_bytes_sec);
    const databaseWriteSeries = runtimeDashboardSamples.map(sample => sample.database?.io?.write_bytes_sec);
    const fileReadSeries = runtimeDashboardSamples.map(sample => sample.file_io?.read_bytes_sec);
    const fileWriteSeries = runtimeDashboardSamples.map(sample => sample.file_io?.write_bytes_sec);
    renderRuntimeSparkline('runtime-trend-cpu', cpuSeries, '#7c3aed');
    renderRuntimeSparkline('runtime-trend-rss', rssSeries, '#059669');
    renderRuntimeSparkline('runtime-trend-latency', latencySeries, '#d97706');
    renderRuntimeSparkline('runtime-trend-goroutines', goroutineSeries, '#0284c7');
    renderRuntimeSparkline('runtime-db-read-trend', databaseReadSeries, '#2563eb');
    renderRuntimeSparkline('runtime-db-write-trend', databaseWriteSeries, '#e11d48');
    renderRuntimeSparkline('runtime-file-read-trend', fileReadSeries, '#0891b2');
    renderRuntimeSparkline('runtime-file-write-trend', fileWriteSeries, '#ea580c');
    setRuntimeText('runtime-trend-cpu-value', `${runtimeNumber(process.cpu_percent).toFixed(1)}%`);
    setRuntimeText('runtime-trend-rss-value', formatRuntimeBytes(process.rss_bytes));
    setRuntimeText('runtime-trend-latency-value', `${runtimeNumber(http.average_latency_ms).toFixed(1)} ms`);
    setRuntimeText('runtime-trend-goroutines-value', runtimeNumber(goRuntime.goroutines).toLocaleString('zh-CN'));
    setRuntimeText('runtime-db-read-trend-value', formatRuntimeRate(databaseIO.read_bytes_sec));
    setRuntimeText('runtime-db-write-trend-value', formatRuntimeRate(databaseIO.write_bytes_sec));
    setRuntimeText('runtime-file-read-trend-value', formatRuntimeRate(fileIO.read_bytes_sec));
    setRuntimeText('runtime-file-write-trend-value', formatRuntimeRate(fileIO.write_bytes_sec));

    const lastRequest = http.last_request || {};
    const httpDetails = document.getElementById('runtime-http-details');
    if (httpDetails) {
        const lastRequestText = lastRequest.path
            ? `${lastRequest.method || 'GET'} ${lastRequest.path} · HTTP ${runtimeNumber(lastRequest.status)} · ${runtimeNumber(lastRequest.duration_ms).toFixed(1)} ms · ${formatRuntimeTime(lastRequest.at)}`
            : '尚无已记录的业务请求';
        httpDetails.innerHTML = `
            <div><dt>成功响应</dt><dd>${runtimeNumber(http.status_2xx).toLocaleString('zh-CN')}</dd></div>
            <div><dt>重定向</dt><dd>${runtimeNumber(http.status_3xx).toLocaleString('zh-CN')}</dd></div>
            <div><dt>客户端错误</dt><dd>${runtimeNumber(http.status_4xx).toLocaleString('zh-CN')}</dd></div>
            <div><dt>服务端错误</dt><dd>${runtimeNumber(http.status_5xx).toLocaleString('zh-CN')}</dd></div>
            <div class="runtime-detail-wide"><dt>最近请求</dt><dd>${escapeHtml(lastRequestText)}</dd></div>`;
    }

    const memoryDetails = document.getElementById('runtime-memory-details');
    if (memoryDetails) {
        memoryDetails.innerHTML = `
            <div><dt>堆已用</dt><dd>${formatRuntimeBytes(memory.heap_alloc_bytes)}</dd></div>
            <div><dt>堆保留</dt><dd>${formatRuntimeBytes(memory.heap_sys_bytes)}</dd></div>
            <div><dt>堆对象</dt><dd>${runtimeNumber(goRuntime.heap_objects).toLocaleString('zh-CN')}</dd></div>
            <div><dt>GC 次数</dt><dd>${runtimeNumber(gc.cycles).toLocaleString('zh-CN')}</dd></div>
            <div><dt>最近暂停</dt><dd>${runtimeNumber(gc.last_pause_ms).toFixed(2)} ms</dd></div>
            <div><dt>累计暂停</dt><dd>${runtimeNumber(gc.pause_total_ms).toFixed(2)} ms</dd></div>`;
    }

    const resourceUsage = document.getElementById('runtime-resource-usage');
    if (resourceUsage) {
        resourceUsage.innerHTML = [
            runtimeResourceRow('本地媒体任务', mediaWorkers.local),
            runtimeResourceRow('朋友圈媒体任务', mediaWorkers.sns)
        ].join('');
    }

    renderRuntimeHTTPErrorRecords(http.recent_errors || []);
    renderRuntimeDiagnostics(data, previousSample);
    const liveState = document.getElementById('runtime-live-state');
    if (liveState && !runtimeTerminatePending) {
        liveState.className = 'runtime-live-state is-live';
        liveState.innerHTML = '<i aria-hidden="true"></i>每 2 秒更新';
    }
    const headerStatus = document.getElementById('service-status');
    if (headerStatus) {
        headerStatus.classList.remove('offline');
        headerStatus.classList.add('online');
        headerStatus.textContent = '服务正常';
    }
}

function renderRuntimeFileIOProcesses(fileIO) {
    const container = document.getElementById('runtime-file-io-processes');
    if (!container) return;
    const processes = Array.isArray(fileIO.processes) ? fileIO.processes : [];
    if (processes.length === 0) {
        container.innerHTML = `<div class="runtime-list-empty">${escapeHtml(fileIO.error || '当前没有识别到项目关联进程')}</div>`;
        return;
    }
    container.innerHTML = `<div class="table-scroll"><table class="runtime-file-process-table">
        <thead><tr><th>进程</th><th>累计读取</th><th>累计写入</th><th>实时读取</th><th>实时写入</th></tr></thead>
        <tbody>${processes.map(item => `<tr class="${item.available ? '' : 'is-unavailable'}">
            <td>
                <div class="runtime-file-process-identity"><strong>${escapeHtml(item.role || item.name || '-')}</strong><span>${escapeHtml(item.name || '-')} · PID ${runtimeNumber(item.pid)} · PPID ${runtimeNumber(item.ppid)}</span></div>
                <div class="runtime-file-process-command" title="${escapeHtml(item.command || '')}">${escapeHtml(item.command || '-')}</div>
                ${item.error ? `<small class="runtime-file-process-error">${escapeHtml(item.error)}</small>` : ''}
            </td>
            <td>${item.available ? formatRuntimeBytes(item.read_bytes_total) : '-'}</td>
            <td>${item.available ? formatRuntimeBytes(item.write_bytes_total) : '-'}</td>
            <td class="is-read">${item.available ? formatRuntimeRate(item.read_bytes_sec) : '-'}</td>
            <td class="is-write">${item.available ? formatRuntimeRate(item.write_bytes_sec) : '-'}</td>
        </tr>`).join('')}</tbody>
    </table></div>`;
}

function runtimeFileTraceStatusLabel(status) {
    return ({
        running: '追踪中',
        authorizing: '等待授权',
        paused: '自动暂停',
        error: '追踪异常',
        stopped: '已停止'
    })[status] || '未开启';
}

function renderRuntimeFileTraceSummary(summary = {}) {
    const status = String(summary.status || 'stopped');
    const previousStatus = runtimeFileTraceLastStatus;
    runtimeFileTraceLastStatus = status;
    const message = summary.message || '详细追踪尚未开启';
    setRuntimeText('runtime-file-trace-state', `${runtimeFileTraceStatusLabel(status)} · ${message}`);
    setRuntimeText('runtime-file-trace-total', `${runtimeNumber(summary.events_total).toLocaleString('zh-CN')} 条`);
    setRuntimeText('runtime-file-trace-read', `${runtimeNumber(summary.read_operations).toLocaleString('zh-CN')} 次 · ${formatRuntimeBytes(summary.read_bytes)}`);
    setRuntimeText('runtime-file-trace-write', `${runtimeNumber(summary.write_operations).toLocaleString('zh-CN')} 次 · ${formatRuntimeBytes(summary.write_bytes)}`);
			setRuntimeText('runtime-file-trace-metadata', `${runtimeNumber(summary.metadata_operations).toLocaleString('zh-CN')} 次 / ${runtimeNumber(summary.filtered_operations).toLocaleString('zh-CN')} 次`);
    const autoStopEnabled = Boolean(summary.auto_stop_enabled);
    const autoStopThresholdMB = Math.max(0.1, runtimeNumber(summary.auto_stop_write_mb) || 50);
    const autoStopTriggered = Boolean(summary.auto_stop_triggered);
    const sessionWriteBytes = runtimeNumber(summary.session_write_bytes);
    const autoStopEnabledInput = document.getElementById('runtime-file-trace-auto-stop-enabled');
    const autoStopThresholdInput = document.getElementById('runtime-file-trace-auto-stop-mb');
    if (autoStopEnabledInput && autoStopEnabledInput.dataset.initialized !== 'true') {
        autoStopEnabledInput.checked = autoStopEnabled;
        autoStopEnabledInput.dataset.initialized = 'true';
    }
    if (autoStopThresholdInput && autoStopThresholdInput.dataset.initialized !== 'true') {
        autoStopThresholdInput.value = String(autoStopThresholdMB);
        autoStopThresholdInput.dataset.initialized = 'true';
    }
    const traceSettingsLocked = status === 'running' || status === 'authorizing';
    if (autoStopEnabledInput) autoStopEnabledInput.disabled = traceSettingsLocked;
    if (autoStopThresholdInput) autoStopThresholdInput.disabled = traceSettingsLocked;
    setRuntimeText('runtime-file-trace-auto-stop-state', autoStopTriggered
        ? `已在本轮写入 ${formatRuntimeBytes(summary.auto_stopped_bytes || sessionWriteBytes)} 时暂停`
        : autoStopEnabled
            ? `本轮 ${formatRuntimeBytes(sessionWriteBytes)} / ${autoStopThresholdMB.toLocaleString('zh-CN')} MB`
            : '自动暂停已关闭');
    const dropped = runtimeNumber(summary.dropped_events);
    const retained = runtimeNumber(summary.retained_events);
    setRuntimeText('runtime-file-trace-retention', `内存保留 ${retained.toLocaleString('zh-CN')} 条${dropped ? ` · 已滚动替换 ${dropped.toLocaleString('zh-CN')} 条` : ''} · 上限 1,000 条`);
    const targets = Array.isArray(summary.targets) ? summary.targets : [];
    setRuntimeText('runtime-file-trace-targets', targets.length
        ? `${targets.length} 个目标：${targets.map(item => `${item.role || item.name || '进程'} PID ${runtimeNumber(item.pid)}`).join('、')}`
        : '追踪目标将在开启时锁定');
    const startButton = document.getElementById('runtime-file-trace-start');
    const stopButton = document.getElementById('runtime-file-trace-stop');
    const clearButton = document.getElementById('runtime-file-trace-clear');
    if (startButton) {
        startButton.disabled = !summary.supported || status === 'running' || status === 'authorizing';
        startButton.textContent = status === 'authorizing' ? '等待系统授权…' : status === 'running' ? '详细追踪已开启' : status === 'paused' ? '重新开始追踪' : '开启详细追踪';
    }
    if (stopButton) stopButton.disabled = status !== 'running';
    if (clearButton) clearButton.disabled = status === 'authorizing';
    if (status === 'paused' && previousStatus === 'running') {
        showToast(`写入达到设定阈值，追踪已自动暂停；已保留 ${retained.toLocaleString('zh-CN')} 条明细`, 'warning');
    }
}

function renderRuntimeFileTraceEvents(payload = {}) {
    renderRuntimeFileTraceSummary(payload.summary || {});
    renderRuntimeFileTraceRanking('runtime-file-read-ranking', payload.read_ranking, 'read');
    renderRuntimeFileTraceRanking('runtime-file-write-ranking', payload.write_ranking, 'write');
    const container = document.getElementById('runtime-file-trace-records');
    if (!container) return;
    const events = Array.isArray(payload.events) ? payload.events : [];
    if (events.length === 0) {
        const status = payload.summary?.status || 'stopped';
        container.innerHTML = `<div class="runtime-list-empty">${status === 'running' ? '追踪已开启，等待匹配的文件系统事件…' : '当前筛选条件下没有读写记录'}</div>`;
        return;
    }
    const kindLabel = { read: '读取', write: '写入', metadata: '元数据' };
    container.innerHTML = `<div class="table-scroll"><table class="runtime-file-trace-table">
        <thead><tr><th>时间</th><th>类型 / 操作</th><th>字节</th><th>进程</th><th>文件路径与原始事件</th><th>耗时</th></tr></thead>
        <tbody>${events.map(item => `<tr>
            <td>${escapeHtml(formatRuntimeTime(item.at))}</td>
            <td><span class="runtime-file-trace-kind is-${escapeHtml(item.kind || 'metadata')}">${escapeHtml(kindLabel[item.kind] || item.kind || '元数据')}</span><code>${escapeHtml(item.operation || '-')}</code></td>
            <td class="is-${escapeHtml(item.kind || 'metadata')}">${runtimeNumber(item.bytes) > 0 ? formatRuntimeBytes(item.bytes) : '-'}</td>
            <td><strong>${escapeHtml(item.process || '-')}</strong>${runtimeNumber(item.pid) > 0 ? `<small>PID ${runtimeNumber(item.pid)}</small>` : ''}</td>
            <td>
                <div class="runtime-file-trace-path" title="${escapeHtml(item.path || item.raw || '')}">${escapeHtml(item.path || '路径未单独解析，展开查看内核原始记录')}</div>
                <details><summary>原始记录</summary><pre>${escapeHtml(item.raw || '-')}</pre></details>
            </td>
            <td>${runtimeNumber(item.duration_ms).toFixed(3)} ms</td>
        </tr>`).join('')}</tbody>
    </table></div>`;
}

function renderRuntimeFileTraceRanking(containerID, ranking, kind) {
    const container = document.getElementById(containerID);
    if (!container) return;
    const items = Array.isArray(ranking) ? ranking : [];
    if (!items.length) {
        container.innerHTML = '<div class="runtime-list-empty">本轮暂无记录</div>';
        return;
    }
    container.innerHTML = `<div class="table-scroll"><table class="runtime-file-ranking-table">
        <thead><tr><th>#</th><th>文件路径</th><th>累计</th><th>次数</th><th>进程</th></tr></thead>
        <tbody>${items.map(item => `<tr>
            <td>${runtimeNumber(item.rank)}</td>
            <td><div class="runtime-file-trace-path" title="${escapeHtml(item.path || '')}">${escapeHtml(item.path || '路径未解析')}</div></td>
            <td class="is-${kind}">${formatRuntimeBytes(item.bytes)}</td>
            <td>${runtimeNumber(item.operations).toLocaleString('zh-CN')}</td>
            <td>${escapeHtml(item.process || '-')}${runtimeNumber(item.pid) > 0 ? `<small>PID ${runtimeNumber(item.pid)}</small>` : ''}</td>
        </tr>`).join('')}</tbody>
    </table></div>`;
}

async function loadRuntimeFileTraceDetails(options = {}) {
    if (runtimeFileTracePromise && !options.force) return runtimeFileTracePromise;
    const kind = document.getElementById('runtime-file-trace-kind')?.value || 'all';
    const query = document.getElementById('runtime-file-trace-query')?.value?.trim() || '';
    const request = (async () => {
        try {
            const payload = await requestJSON(`/api/v1/runtime/file-io/details?kind=${encodeURIComponent(kind)}&query=${encodeURIComponent(query)}&limit=300`);
            renderRuntimeFileTraceEvents(payload);
            return payload;
        } catch (error) {
            const container = document.getElementById('runtime-file-trace-records');
            if (container) container.innerHTML = `<div class="runtime-list-empty is-error">读取明细失败：${escapeHtml(error.message || String(error))}</div>`;
            return null;
        }
    })();
    runtimeFileTracePromise = request;
    try {
        return await request;
    } finally {
        if (runtimeFileTracePromise === request) runtimeFileTracePromise = null;
    }
}

function scheduleRuntimeFileTraceFilter() {
    if (runtimeFileTraceFilterTimer) clearTimeout(runtimeFileTraceFilterTimer);
    runtimeFileTraceFilterTimer = setTimeout(() => loadRuntimeFileTraceDetails({ force: true }), 220);
}

async function startRuntimeFileTrace() {
    const autoStopEnabled = Boolean(document.getElementById('runtime-file-trace-auto-stop-enabled')?.checked);
    const thresholdInput = document.getElementById('runtime-file-trace-auto-stop-mb');
    const autoStopWriteMB = Number(String(thresholdInput?.value || '50').trim());
    if (autoStopEnabled && (!Number.isFinite(autoStopWriteMB) || autoStopWriteMB < 0.1 || autoStopWriteMB > 102400)) {
        if (thresholdInput) {
            thresholdInput.setCustomValidity('请输入 0.1–102400 MB 之间的数值');
            thresholdInput.reportValidity();
            thresholdInput.focus();
        }
        showToast('请设置有效的自动暂停写入阈值', 'warning');
        return;
    }
    if (thresholdInput) thresholdInput.setCustomValidity('');
    const button = document.getElementById('runtime-file-trace-start');
    if (button) {
        button.disabled = true;
        button.textContent = '等待系统授权…';
    }
    setRuntimeText('runtime-file-trace-state', '系统授权窗口已打开，请使用 macOS 管理员凭据确认');
    try {
        const payload = await requestJSON('/api/v1/runtime/file-io/trace/start', {
            method: 'POST',
            json: { auto_stop_enabled: autoStopEnabled, auto_stop_write_mb: autoStopWriteMB },
        });
        renderRuntimeFileTraceSummary(payload.summary || {});
        await loadRuntimeFileTraceDetails({ force: true });
        showToast('逐文件读写追踪已开启');
    } catch (error) {
        showToast(`开启详细追踪失败：${error.message || String(error)}`, 'error');
        await loadRuntimeDashboard({ manual: false });
    }
}

async function stopRuntimeFileTrace() {
    try {
        const payload = await requestJSON('/api/v1/runtime/file-io/trace/stop', { method: 'POST' });
        renderRuntimeFileTraceSummary(payload.summary || {});
        await loadRuntimeFileTraceDetails({ force: true });
        showToast('逐文件读写追踪已停止，明细记录已保留');
    } catch (error) {
        showToast(`停止详细追踪失败：${error.message || String(error)}`, 'error');
    }
}

async function clearRuntimeFileTrace() {
    try {
        const payload = await requestJSON('/api/v1/runtime/file-io/trace', { method: 'DELETE' });
        renderRuntimeFileTraceSummary(payload.summary || {});
        renderRuntimeFileTraceEvents({ summary: payload.summary || {}, events: [] });
        showToast('逐文件读写明细已清空');
    } catch (error) {
        showToast(`清空读写明细失败：${error.message || String(error)}`, 'error');
    }
}

function renderRuntimeDashboardError(error) {
    if (runtimeTerminatePending) return;
    const overallDot = document.getElementById('runtime-overall-dot');
    if (overallDot) overallDot.className = 'runtime-overall-dot is-error';
    setRuntimeText('runtime-overall-state', '实时状态连接中断');
    setRuntimeText('runtime-overall-detail', error?.message || '请检查本地 HTTP 服务');
    const liveState = document.getElementById('runtime-live-state');
    if (liveState) {
        liveState.className = 'runtime-live-state is-error';
        liveState.innerHTML = `<i aria-hidden="true"></i>连续失败 ${runtimeDashboardFailures} 次`;
    }
}

function renderRuntimeHTTPErrorRecords(entries) {
    const records = Array.isArray(entries) ? entries : [];
    setRuntimeText('runtime-http-error-record-count', `${records.length} 条`);
    const container = document.getElementById('runtime-http-error-records');
    if (!container) return;
    if (records.length === 0) {
        container.innerHTML = '<div class="runtime-list-empty">暂未记录 HTTP 错误</div>';
        return;
    }
    container.innerHTML = records.map(entry => `
        <article class="runtime-http-error-entry">
            <div>
                <span class="runtime-http-status is-${runtimeNumber(entry.status) >= 500 ? 'server' : 'client'}">${runtimeNumber(entry.status)}</span>
                <strong>${escapeHtml(entry.method || 'GET')} ${escapeHtml(entry.path || '-')}</strong>
            </div>
            <div>
                <span>${runtimeNumber(entry.duration_ms).toFixed(1)} ms</span>
                <time>${escapeHtml(formatRuntimeTime(entry.at))}</time>
            </div>
            ${entry.request_id ? `<small title="${escapeHtml(entry.request_id)}">请求 ID ${escapeHtml(entry.request_id)}</small>` : ''}
        </article>`).join('');
}

function renderRuntimeLogs(data) {
    const entries = Array.isArray(data.entries) ? data.entries : [];
    const counts = data.categories || {};
    const categoryLabels = { system: '系统', http: 'HTTP', database: '数据库', cache: '缓存', media: '媒体', push: '推送' };
    const summary = document.getElementById('runtime-log-category-summary');
    if (summary) {
        summary.innerHTML = Object.entries(categoryLabels).map(([key, label]) =>
            `<span><strong>${runtimeNumber(counts[key]).toLocaleString('zh-CN')}</strong>${label}</span>`
        ).join('');
    }
    const container = document.getElementById('runtime-log-list');
    if (!container) return;
    if (entries.length === 0) {
        container.innerHTML = '<div class="runtime-list-empty">当前筛选条件下暂无日志</div>';
        return;
    }
    container.innerHTML = entries.map(entry => `
        <article class="runtime-log-entry level-${escapeHtml(entry.level || 'info')}">
            <div class="runtime-log-meta">
                <time>${escapeHtml(formatRuntimeTime(entry.time))}</time>
                <span class="runtime-log-level">${escapeHtml(String(entry.level || 'info').toUpperCase())}</span>
                <span class="runtime-log-category">${escapeHtml(categoryLabels[entry.category] || entry.category || '系统')}</span>
            </div>
            <p>${escapeHtml(entry.message || '-')}</p>
        </article>`).join('');
}

function databaseAuditWatermarkLabel(status) {
    return {
        current: '已同步',
        near_current: '接近同步',
        stale: '落后',
        incomplete: '审计不完整',
        missing: '缺少分片',
        empty: '分片为空',
        session_missing: '缺少会话水位'
    }[status] || status || '-';
}

function renderRuntimeDatabaseAudit(data) {
    const messages = data.messages || {};
    const watermark = data.watermark || {};
    const inventory = data.inventory || {};
    const resources = data.resources || {};
    const fts = data.fts || {};
    const scan = data.scan || {};
    const alerts = Array.isArray(data.alerts) ? data.alerts : [];
    const warnings = Array.isArray(data.warnings) ? data.warnings : [];
    const samples = Array.isArray(messages.unknown_samples) ? messages.unknown_samples : [];
    const byType = Array.isArray(messages.by_type) ? messages.by_type : [];
    const unsupportedTypes = byType.filter(item => !item.supported);
    const coverage = runtimeNumber(messages.coverage_percent);
    const coverageClass = runtimeNumber(messages.unsupported_rows) > 0 || runtimeNumber(messages.parse_errors) > 0 ? 'is-warning' : 'is-ok';
    setRuntimeText(
        'runtime-audit-updated',
        `${data.cached ? '缓存审计' : '完成审计'} · ${scan.mode || 'full'} · ${formatRuntimeTime(data.generated_at)} · ${runtimeNumber(data.duration_ms).toFixed(0)} ms`
    );
    const container = document.getElementById('runtime-database-audit');
    if (!container) return;
    container.innerHTML = `
        <div class="runtime-audit-metrics">
            <article class="${coverageClass}">
                <span>解析覆盖率</span>
                <strong>${coverage.toFixed(3)}%</strong>
                <small>${runtimeNumber(messages.supported_rows).toLocaleString('zh-CN')} / ${runtimeNumber(messages.total_rows).toLocaleString('zh-CN')} 条已覆盖</small>
            </article>
            <article class="${runtimeNumber(messages.parse_errors) > 0 ? 'is-error' : 'is-ok'}">
                <span>内容解析异常</span>
                <strong>${runtimeNumber(messages.parse_errors).toLocaleString('zh-CN')}</strong>
                <small>zstd ${runtimeNumber(messages.zstd_errors)} · packed ${runtimeNumber(messages.packed_errors)}</small>
            </article>
            <article class="${watermark.status === 'current' || watermark.status === 'near_current' ? 'is-ok' : 'is-warning'}">
                <span>分片水位</span>
                <strong>${escapeHtml(databaseAuditWatermarkLabel(watermark.status))}</strong>
                <small>${runtimeNumber(inventory.message_shards)} 个分片 · ${runtimeNumber(inventory.message_tables)} 张消息表 · 差值 ${runtimeNumber(watermark.gap_seconds)} 秒</small>
            </article>
            <article class="${resources.available ? 'is-ok' : 'is-warning'}">
                <span>资源关联覆盖率</span>
                <strong>${resources.available ? `${runtimeNumber(resources.link_coverage_percent).toFixed(3)}%` : '-'}</strong>
                <small>${runtimeNumber(resources.detail_rows).toLocaleString('zh-CN')} 条资源 · ${formatRuntimeBytes(resources.bytes_total)}</small>
            </article>
        </div>
        <div class="runtime-audit-details">
            <div>
                <strong>增量扫描</strong>
                <span>模式 ${escapeHtml(scan.mode || '-')} · 重扫 ${runtimeNumber(scan.scanned_shards)} 个分片 · 复用 ${runtimeNumber(scan.reused_shards)} 个分片${Array.isArray(scan.changed_files) && scan.changed_files.length ? ` · 变化：${scan.changed_files.map(escapeHtml).join('、')}` : ' · 数据指纹未变化'}</span>
            </div>
            <div>
                <strong>格式分布</strong>
                <span>${unsupportedTypes.length
                    ? unsupportedTypes.map(item => `type ${runtimeNumber(item.type)}/${runtimeNumber(item.sub_type)}：${runtimeNumber(item.rows).toLocaleString('zh-CN')} 条`).join(' · ')
                    : '当前已发现类型均已进入结构化解析'}</span>
            </div>
            <div>
                <strong>控制记录研究状态</strong>
                <span>${escapeHtml(messages.opaque_control_status || 'none')} · 共 ${runtimeNumber(messages.opaque_control_rows)} 条 · 空载荷 ${runtimeNumber(messages.opaque_control_empty_rows)} 条</span>
            </div>
            <div>
                <strong>压缩与附加数据</strong>
                <span>zstd ${runtimeNumber(messages.zstd_rows).toLocaleString('zh-CN')} 条 · packed_info ${runtimeNumber(messages.packed_rows).toLocaleString('zh-CN')} 条 · 原始内容保留 ${runtimeNumber(messages.raw_preserved_rows).toLocaleString('zh-CN')} 条</span>
            </div>
            <div>
                <strong>全文索引</strong>
                <span>${runtimeNumber(fts.files)} 个 FTS 库 · SQLite FTS5 ${fts.module_available ? '已加载' : '未加载'} · 微信私有索引直查 ${fts.native_query ? '通过' : '普通消息表直查'} · ${runtimeNumber(fts.mm_tokenizer_tables)} 张 MMFtsTokenizer 表 · ${runtimeNumber(fts.shadow_content_tables)} 张内容影子表 · ${runtimeNumber(fts.message_content_rows).toLocaleString('zh-CN')} 条可搜索消息 · 水位 ${escapeHtml(fts.message_watermark_status || '-')} · 路径 ${escapeHtml(fts.fallback_path || 'direct_message_tables')}</span>
            </div>
            <div>
                <strong>审计提示</strong>
                <span>${warnings.length ? warnings.map(escapeHtml).join('；') : '当前审计未发现额外提示'}</span>
            </div>
        </div>
        ${alerts.length ? `<div class="runtime-audit-alerts">${alerts.map(alert => `
            <div class="runtime-diagnostic is-${alert.level === 'error' ? 'error' : alert.level === 'warning' ? 'warning' : 'neutral'}">
                <i aria-hidden="true"></i>
                <div><strong>${escapeHtml(alert.title || alert.code || '审计提示')}</strong><span>${escapeHtml(alert.detail || '-')}</span></div>
            </div>`).join('')}</div>` : ''}
        ${samples.length ? `
            <details class="runtime-audit-samples">
                <summary>查看 ${samples.length} 条待解析样本元数据</summary>
                <div class="table-scroll"><table>
                    <thead><tr><th>库 / 表</th><th>local_id</th><th>type</th><th>原因</th><th>内容指纹</th></tr></thead>
                    <tbody>${samples.map(item => `<tr>
                        <td>${escapeHtml(item.file || '-')} / ${escapeHtml(item.table || '-')}</td>
                        <td>${runtimeNumber(item.local_id)}</td>
                        <td>${runtimeNumber(item.type)} / ${runtimeNumber(item.sub_type)}</td>
                        <td>${escapeHtml(item.reason || '-')}</td>
                        <td class="cell-monospace">${escapeHtml(item.content_hash || '-')}</td>
                    </tr>`).join('')}</tbody>
                </table></div>
            </details>` : ''}`;
}

async function loadRuntimeDatabaseAudit(options = {}) {
    if (runtimeDatabaseAuditPromise) return runtimeDatabaseAuditPromise;
    const button = document.getElementById('runtime-audit-refresh');
    const container = document.getElementById('runtime-database-audit');
    if (button && options.manual) button.disabled = true;
    if (container && options.manual) container.classList.add('is-loading');
    runtimeDatabaseAuditPromise = (async () => {
        try {
            const params = new URLSearchParams();
            if (options.manual) params.set('refresh', 'true');
            const suffix = params.toString() ? `?${params.toString()}` : '';
            const data = await requestJSON(`/api/v1/db/audit${suffix}`);
            renderRuntimeDatabaseAudit(data);
            if (options.manual) showToast('全库解析审计已完成');
            return data;
        } catch (error) {
            if (container) container.innerHTML = `<div class="runtime-list-empty is-error">数据库审计失败：${escapeHtml(error.message || String(error))}</div>`;
            return null;
        } finally {
            if (button) button.disabled = false;
            if (container) container.classList.remove('is-loading');
        }
    })();
    try {
        return await runtimeDatabaseAuditPromise;
    } finally {
        runtimeDatabaseAuditPromise = null;
    }
}

async function loadMessageResources() {
    const kind = document.getElementById('message-resource-filter')?.value || 'message_id';
    const input = document.getElementById('message-resource-value');
    const value = String(input?.value || '').trim();
    const result = document.getElementById('message-resource-result');
    if (value && !/^\d+$/.test(value)) {
        showToast('资源关联值需填写非负整数', 'warning');
        input?.focus();
        return;
    }
    if (result) result.innerHTML = '<div class="runtime-list-empty">正在查询资源关联...</div>';
    try {
        const params = new URLSearchParams({ limit: '50' });
        if (value) params.set(kind, value);
        const data = await requestJSON(`/api/v1/db/message_resources?${params.toString()}`);
        const items = Array.isArray(data.items) ? data.items : [];
        if (!result) return data;
        if (!items.length) {
            result.innerHTML = '<div class="runtime-list-empty">当前条件下没有资源关联记录</div>';
            return data;
        }
        result.innerHTML = `
            <div class="runtime-resource-result-meta">${items.length} 条关联${data.has_more ? ' · 还有更多结果' : ''}</div>
            <div class="table-scroll"><table>
                <thead><tr><th>message_id</th><th>local / server</th><th>消息类型</th><th>资源 ID</th><th>资源类型</th><th>状态</th><th>大小</th><th>data_index</th></tr></thead>
                <tbody>${items.map(item => `<tr>
                    <td>${escapeHtml(String(item.message_id ?? '-'))}</td>
                    <td>${escapeHtml(String(item.message_local_id ?? '-'))} / ${escapeHtml(String(item.message_svr_id ?? '-'))}</td>
                    <td>${runtimeNumber(item.message_type)} / ${runtimeNumber(item.message_sub_type)}</td>
                    <td>${escapeHtml(String(item.resource_id ?? '-'))}</td>
                    <td>${runtimeNumber(item.resource_type_base)} / ${runtimeNumber(item.resource_sub_type)}</td>
                    <td>${escapeHtml(String(item.resource_status ?? '-'))}</td>
                    <td>${formatRuntimeBytes(item.resource_size)}</td>
                    <td class="cell-monospace">${escapeHtml(String(item.data_index ?? '-'))}</td>
                </tr>`).join('')}</tbody>
            </table></div>`;
        return data;
    } catch (error) {
        if (result) result.innerHTML = `<div class="runtime-list-empty is-error">资源关联查询失败：${escapeHtml(error.message || String(error))}</div>`;
        return null;
    }
}

function filterRuntimeLogStream(data) {
    const category = document.getElementById('runtime-log-category')?.value || 'all';
    const level = document.getElementById('runtime-log-level')?.value || 'all';
    const entries = (Array.isArray(data?.entries) ? data.entries : []).filter(entry =>
        (category === 'all' || entry.category === category) &&
        (level === 'all' || entry.level === level)
    ).slice(0, 120);
    return { ...data, entries };
}

function parseRuntimeEvent(event) {
    try {
        return JSON.parse(event.data);
    } catch (error) {
        console.warn('Invalid realtime event payload', event.type, error);
        return null;
    }
}

function startRuntimeEventStream() {
    if (runtimeEventSource || typeof EventSource === 'undefined' || runtimeTerminatePending) return;
    runtimeEventSource = new EventSource('/api/v1/events?topics=runtime,hook,ocr,log,message');
    runtimeEventSource.onopen = () => {
        updateHookPollState('实时连接正常');
    };
    runtimeEventSource.onerror = () => {
        updateHookPollState('实时连接重连中', true);
    };
    runtimeEventSource.addEventListener('runtime', event => {
        const data = parseRuntimeEvent(event);
        if (!data) return;
        runtimeDashboardStreamData = data;
        runtimeDashboardFailures = 0;
        if (!document.hidden && document.getElementById('dashboard')?.classList.contains('active')) {
            renderRuntimeDashboard(data);
        }
    });
    runtimeEventSource.addEventListener('log', event => {
        const data = parseRuntimeEvent(event);
        if (!data) return;
        runtimeLogsStreamData = data;
        if (!document.hidden && document.getElementById('dashboard')?.classList.contains('active')) {
            renderRuntimeLogs(filterRuntimeLogStream(data));
        }
    });
    runtimeEventSource.addEventListener('hook_status', event => {
        const data = parseRuntimeEvent(event);
        if (data) renderHookStatus(data);
    });
    runtimeEventSource.addEventListener('hook_events', event => {
        const data = parseRuntimeEvent(event);
        if (data) applyHookEvents(data);
    });
    runtimeEventSource.addEventListener('ocr_status', event => {
        const data = parseRuntimeEvent(event);
        if (data) dispatchEvent(new CustomEvent('chatlog:ocr-status', { detail: data }));
    });
    runtimeEventSource.addEventListener('message', event => {
        const data = parseRuntimeEvent(event);
        if (data) dispatchEvent(new CustomEvent('chatlog:new-message', { detail: data }));
    });
}

function stopRuntimeEventStream() {
    if (runtimeEventSource) runtimeEventSource.close();
    runtimeEventSource = null;
}

async function loadRuntimeLogs(options = {}) {
    if (!options.manual && runtimeLogsStreamData) {
        const data = filterRuntimeLogStream(runtimeLogsStreamData);
        renderRuntimeLogs(data);
        return data;
    }
    if (runtimeLogsPromise) return runtimeLogsPromise;
    const category = document.getElementById('runtime-log-category')?.value || 'all';
    const level = document.getElementById('runtime-log-level')?.value || 'all';
    runtimeLogsPromise = (async () => {
        try {
            const params = new URLSearchParams({ category, level, limit: '120' });
            const data = await requestJSON(`/api/v1/runtime/logs?${params.toString()}`);
            renderRuntimeLogs(data);
            if (options.manual) showToast('分类日志已刷新');
            return data;
        } catch (error) {
            const container = document.getElementById('runtime-log-list');
            if (container) container.innerHTML = `<div class="runtime-list-empty is-error">日志读取失败：${escapeHtml(error.message || String(error))}</div>`;
            return null;
        }
    })();
    try {
        return await runtimeLogsPromise;
    } finally {
        runtimeLogsPromise = null;
    }
}

function renderRuntimeCacheDetails(data) {
    const categories = Array.isArray(data.categories) ? data.categories : [];
    setRuntimeText('runtime-cache-summary', `${runtimeNumber(data.total_entries).toLocaleString('zh-CN')} 项 · ${formatRuntimeBytes(data.total_bytes)}`);
    const container = document.getElementById('runtime-cache-categories');
    if (!container) return;
    if (categories.length === 0) {
        container.innerHTML = '<div class="runtime-list-empty">当前未发现缓存</div>';
        return;
    }
    container.innerHTML = categories.map(category => {
        const isMemory = category.kind === 'memory';
        const usage = isMemory
            ? `${runtimeNumber(category.entries).toLocaleString('zh-CN')} / ${runtimeNumber(category.capacity).toLocaleString('zh-CN')} 项`
            : `${runtimeNumber(category.entries).toLocaleString('zh-CN')} 个文件 · ${formatRuntimeBytes(category.bytes)}`;
        const ratio = isMemory && runtimeNumber(category.capacity) > 0
            ? Math.min(100, runtimeNumber(category.entries) / runtimeNumber(category.capacity) * 100)
            : 0;
        const paths = Array.isArray(category.paths) ? category.paths : [];
        return `
            <article class="runtime-cache-card">
                <div class="runtime-cache-card-heading">
                    <span class="runtime-cache-kind is-${isMemory ? 'memory' : 'disk'}">${isMemory ? '内存' : '磁盘'}</span>
                    <div class="runtime-cache-card-actions">
                        ${isMemory ? '' : `<button class="btn btn-secondary btn-sm" type="button" data-category="${escapeHtml(category.id)}" data-label="${escapeHtml(category.label)}" data-on-click="showRuntimeCacheFilesFromElement">文件</button>
                        <button class="btn btn-secondary btn-sm" type="button" data-category="${escapeHtml(category.id)}" data-on-click="openRuntimeCachePathFromElement">打开</button>`}
                        <button class="btn btn-secondary btn-sm" type="button" data-category="${escapeHtml(category.id)}" data-label="${escapeHtml(category.label)}" data-on-click="clearRuntimeCacheFromElement">清理</button>
                    </div>
                </div>
                <strong>${escapeHtml(category.label || category.id)}</strong>
                <span>${escapeHtml(usage)}</span>
                <p>${escapeHtml(category.description || '')}</p>
                ${paths.map(path => `<code class="runtime-cache-path" title="${escapeHtml(path)}">${escapeHtml(path)}</code>`).join('')}
                ${isMemory ? `<div class="runtime-resource-track"><i style="width:${ratio.toFixed(2)}%"></i></div>` : ''}
            </article>`;
    }).join('');
}

async function showRuntimeCacheFiles(category, label = '') {
    const box = document.getElementById('runtime-cache-files');
    if (!box || !category) return;
    box.classList.remove('hidden');
    box.innerHTML = '<div class="loading">正在读取缓存文件路径...</div>';
    try {
        const data = await requestJSON(`/api/v1/cache/files?category=${encodeURIComponent(category)}&limit=5000`);
        const files = Array.isArray(data.files) ? data.files : [];
        const roots = Array.isArray(data.roots) ? data.roots : [];
        box.innerHTML = `
            <div class="runtime-cache-files-head">
                <div><span class="runtime-eyebrow">CACHE FILES</span><h4>${escapeHtml(label || category)}</h4><p>${files.length} / ${Number(data.total || 0).toLocaleString('zh-CN')} 个文件</p></div>
                <button class="btn btn-secondary btn-sm" type="button" data-category="${escapeHtml(category)}" data-on-click="openRuntimeCachePathFromElement">打开缓存目录</button>
            </div>
            <div class="runtime-cache-root-list">${roots.map(path => `<code>${escapeHtml(path)}</code>`).join('')}</div>
            <div class="runtime-cache-file-list">
                ${files.length ? files.map(file => `
                    <button type="button" class="runtime-cache-file-row" data-category="${escapeHtml(category)}"
                        data-path="${escapeHtml(encodeURIComponent(file.path || ''))}"
                        data-on-click="openRuntimeCachePathFromElement">
                        <code title="${escapeHtml(file.path || '')}">${escapeHtml(file.path || '')}</code>
                        <span>${formatRuntimeBytes(file.bytes)} · ${escapeHtml(formatRuntimeTime(file.modified_at))}</span><i>打开 ›</i>
                    </button>`).join('') : '<div class="runtime-list-empty">该分类当前没有缓存文件</div>'}
            </div>
            ${data.has_more ? '<div class="runtime-list-empty">文件数量超过 5000，请清理或缩小缓存后查看剩余路径。</div>' : ''}`;
        box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (error) {
        box.innerHTML = `<div class="runtime-list-empty is-error">缓存文件读取失败：${escapeHtml(error.message || String(error))}</div>`;
    }
}

async function openRuntimeCachePath(category, path = '') {
    try {
        const params = new URLSearchParams({ category });
        if (path) params.set('path', path);
        const data = await requestJSON(`/api/v1/cache/open?${params.toString()}`, { method: 'POST' });
        showToast(`已打开：${data.path}`);
    } catch (error) {
        showToast(`打开缓存路径失败：${error.message || String(error)}`, 'error');
    }
}

async function loadRuntimeCacheDetails(manual = false) {
    if (runtimeCachePromise) return runtimeCachePromise;
    const container = document.getElementById('runtime-cache-categories');
    if (manual && container) container.classList.add('is-loading');
    runtimeCachePromise = (async () => {
        try {
            const data = await requestJSON('/api/v1/cache');
            renderRuntimeCacheDetails(data);
            if (manual) showToast('缓存详情已重新扫描');
            return data;
        } catch (error) {
            if (container) container.innerHTML = `<div class="runtime-list-empty is-error">缓存扫描失败：${escapeHtml(error.message || String(error))}</div>`;
            return null;
        } finally {
            if (container) container.classList.remove('is-loading');
        }
    })();
    try {
        return await runtimeCachePromise;
    } finally {
        runtimeCachePromise = null;
    }
}

function stopRuntimePollingForTermination() {
    runtimeTerminatePending = true;
    stopRuntimeEventStream();
    if (runtimeDashboardController) runtimeDashboardController.abort();
    runtimeDashboardController = null;
}

async function terminateChatlogAndRestartWeChat() {
    if (runtimeTerminatePending) return;
    const confirmed = confirm('将结束 Chatlog、OCR、Frida Hook 及其他关联进程，然后完全重启微信。\n\n执行后当前页面会断开，确定继续吗？');
    if (!confirmed) return;
    const button = document.getElementById('runtime-terminate-button');
    if (button) {
        button.disabled = true;
        button.textContent = '正在结束…';
    }
    try {
        const data = await requestJSON('/api/v1/runtime/terminate', {
            method: 'POST',
            json: { confirmation: 'terminate-and-restart' },
        });
        if (!data.accepted) throw new Error(data.error || '结束任务未被接受');
        stopRuntimePollingForTermination();
        const liveState = document.getElementById('runtime-live-state');
        if (liveState) {
            liveState.className = 'runtime-live-state is-stopping';
            liveState.innerHTML = '<i aria-hidden="true"></i>清理进程中';
        }
        const overallDot = document.getElementById('runtime-overall-dot');
        if (overallDot) overallDot.className = 'runtime-overall-dot is-loading';
        setRuntimeText('runtime-overall-state', '正在结束 Chatlog');
        setRuntimeText('runtime-overall-detail', '正在停止 OCR、释放 Frida 注入、清理关联进程并重启微信…');
        showToast('结束任务已启动，微信将自动重启');
    } catch (error) {
        if (button) {
            button.disabled = false;
            button.textContent = '结束 Chatlog 并重启微信';
        }
        showToast(`启动结束流程失败：${error.message || String(error)}`, 'error');
    }
}

async function clearRuntimeCache(category, label) {
    const displayLabel = label || category;
    if (!confirm(`确定清理“${displayLabel}”吗？清理后相关内容会按需重新生成。`)) return;
    try {
        const data = await requestJSON(`/api/v1/cache/clear?category=${encodeURIComponent(category)}`, { method: 'POST' });
        const totals = (Array.isArray(data.results) ? data.results : []).reduce((result, item) => {
            result.files += runtimeNumber(item.deleted_files);
            result.bytes += runtimeNumber(item.freed_bytes);
            return result;
        }, { files: 0, bytes: 0 });
        showToast(`${displayLabel}已清理：${totals.files.toLocaleString('zh-CN')} 项，释放 ${formatRuntimeBytes(totals.bytes)}`);
        await Promise.all([loadRuntimeCacheDetails(), loadRuntimeDashboard({ manual: false })]);
    } catch (error) {
        showToast(`缓存清理失败：${error.message || String(error)}`, 'error');
    }
}

async function loadRuntimeDashboard(options = {}) {
    if (runtimeDashboardPromise) return runtimeDashboardPromise;
    const button = document.getElementById('runtime-refresh-button');
    const controller = new AbortController();
    runtimeDashboardController = controller;
    if (button && options.manual) button.disabled = true;
    runtimeDashboardPromise = (async () => {
        try {
            const data = await requestJSON('/api/v1/runtime/status', { signal: controller.signal, timeoutMs: 1800 });
            runtimeDashboardFailures = 0;
            renderRuntimeDashboard(data);
            if (options.manual) showToast('实时状态已刷新');
            return data;
        } catch (error) {
            if (error?.name === 'AbortError' && !document.getElementById('dashboard')?.classList.contains('active')) return null;
            runtimeDashboardFailures += 1;
            renderRuntimeDashboardError(error);
            return null;
        } finally {
            if (runtimeDashboardController === controller) runtimeDashboardController = null;
            if (button) button.disabled = false;
        }
    })();
    try {
        return await runtimeDashboardPromise;
    } finally {
        runtimeDashboardPromise = null;
    }
}

function syncRuntimeDashboardPolling(tabId = '') {
    const activeTab = tabId || document.querySelector('.tab-content.active')?.id || '';
    if (activeTab !== 'dashboard' || document.hidden) {
        if (runtimeDashboardController) runtimeDashboardController.abort();
        return;
    }
    if (runtimeDashboardStreamData) renderRuntimeDashboard(runtimeDashboardStreamData);
    else loadRuntimeDashboard();
    if (runtimeLogsStreamData) renderRuntimeLogs(filterRuntimeLogStream(runtimeLogsStreamData));
    else loadRuntimeLogs();
}

function disposeRuntime() {
    runtimeDashboardController?.abort();
    stopRuntimeEventStream();
}

const runtimeActions = {
    ...createActionHandlers({
        clearRuntimeCache,
        clearRuntimeFileTrace,
        loadMessageResources,
        loadRuntimeCacheDetails,
        loadRuntimeDashboard,
        loadRuntimeDatabaseAudit,
        loadRuntimeFileTraceDetails,
        loadRuntimeLogs,
        scheduleRuntimeFileTraceFilter,
        startRuntimeFileTrace,
        stopRuntimeFileTrace,
        terminateChatlogAndRestartWeChat,
    }),
    showRuntimeCacheFilesFromElement: ({ element }) => showRuntimeCacheFiles(element.dataset.category, element.dataset.label),
    openRuntimeCachePathFromElement: ({ element }) => openRuntimeCachePath(
        element.dataset.category,
        element.dataset.path ? decodeURIComponent(element.dataset.path) : '',
    ),
    clearRuntimeCacheFromElement: ({ element }) => clearRuntimeCache(element.dataset.category, element.dataset.label),
};

export {
    disposeRuntime,
    loadRuntimeCacheDetails,
    loadRuntimeDashboard,
    loadRuntimeLogs,
    startRuntimeEventStream,
    syncRuntimeDashboardPolling,
    runtimeActions,
};
