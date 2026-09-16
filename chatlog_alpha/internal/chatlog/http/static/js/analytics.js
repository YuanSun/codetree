'use strict';

// --- Analytics workspace ---

import { encodeActionArgs, escapeHtml, showToast } from './ui.js';
import { createActionHandlers } from './events.js';
import { messageCenterSearch } from './features.js';
import { navigateToTab } from './navigation.js';
import { requestJSON } from './api.js';

let dashboardSessions = [];
let dashboardStatsRange = '1d';
let dashboardAnalyticsPromise = null;
let dashboardAnalyticsLoaded = false;
let dashboardOverviewController = null;
let dashboardOverviewRunID = 0;
const dashboardDetailControllers = { private: null, group: null };
const dashboardStatsCache = new Map();
const dashboardAutomaticGroupLimit = 20;
const dashboardRenderedGroupLimit = 30;
const dashboardStatsConcurrency = 4;
const dashboardMsgTypeMap = {
    text: '1',
    image: '3',
    voice: '34',
    card: '42',
    video: '43',
    sticker: '47',
    location: '48',
    share: '49',
    voip: '50',
    system: '10000'
};

function formatTimestamp(ts) {
    if (!ts) return '-';
    const dt = new Date(Number(ts) * 1000);
    if (Number.isNaN(dt.getTime())) return '-';
    return dt.toLocaleString();
}

	        function getDashboardTimeRange(kind) {
	            const rangeSelect = document.getElementById(`dashboard-${kind}-range`);
	            const val = rangeSelect ? String(rangeSelect.value || 'all') : 'all';
	            return dashboardRangeToHistoryTime(val);
	        }

	        function dashboardRangeToHistoryTime(val) {
	            val = String(val || 'all');
	            if (val === 'all') return 'all';
	            const now = new Date();
	            const pad = (v) => String(v).padStart(2, '0');
	            const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
	            if (val === '1d') return today;
	            const days = val === '7d' ? 6 : (val === '90d' ? 89 : (val === '1y' ? 364 : 29));
	            const start = new Date(now.getTime() - days * 24 * 3600 * 1000);
	            const s = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
	            return `${s}~${today}`;
	        }

	        function getDashboardJumpMsgType(kind) {
	            const select = document.getElementById(`dashboard-${kind}-jump-type`);
	            return select ? String(select.value || '').trim() : '';
	        }

	        function setChatlogFilters(chat, sender = '', title = '', msgType = '', options = {}) {
	            document.getElementById('chatlog-talker').value = chat || '';
	            document.getElementById('chatlog-sender').value = sender || '';
	            document.getElementById('chatlog-msg-type').value = msgType || '';
	            if (!options.preserveAdvanced) {
	                document.getElementById('chatlog-sub-type').value = '';
	                document.getElementById('chatlog-is-self').value = '';
	                document.getElementById('chatlog-has-media').value = '';
	            }
	            if (Object.prototype.hasOwnProperty.call(options, 'hour')) {
	                document.getElementById('chatlog-hour').value = options.hour || '';
	            }
	            const timeEl = document.getElementById('chatlog-time');
	            const explicitRange = String(options.timeRange || '').trim();
	            if (explicitRange) {
	                timeEl.value = explicitRange;
	            } else if (!timeEl.value.trim()) {
	                const now = new Date();
	                const start = new Date(now.getFullYear(), now.getMonth(), 1);
	                const pad = (v) => String(v).padStart(2, '0');
	                timeEl.value = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}~${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
	            }
	            navigateToTab('chatlog');
	            if (title) {
        const result = document.getElementById('chatlog-result');
        result.classList.remove('hidden');
        result.innerHTML = `<div class="result-header"><strong>${escapeHtml(title)}</strong></div><div class="text-gray">已填入聊天条件，可直接点击“查询消息”。</div>`;
    }
}

	        function openDashboardChat(kind) {
	            const select = document.getElementById(`dashboard-${kind}-select`);
	            if (!select || !select.value) return;
	            const label = kind === 'group' ? '群聊' : '私聊';
	            setChatlogFilters(
	                select.value,
	                '',
	                `${label}分析已跳转`,
	                getDashboardJumpMsgType(kind),
	                { timeRange: getDashboardTimeRange(kind), hour: '' }
	            );
	        }

	        function openDashboardGroupSender(sender) {
	            const select = document.getElementById('dashboard-group-select');
	            if (!select || !select.value) return;
	            setChatlogFilters(
	                select.value,
	                sender || '',
	                `群成员 ${sender || ''} 已跳转`,
	                getDashboardJumpMsgType('group'),
	                { timeRange: getDashboardTimeRange('group'), hour: '' }
	            );
	        }

	        function openDashboardTypeFilter(kind, typeLabel) {
	            const select = document.getElementById(`dashboard-${kind}-select`);
	            if (!select || !select.value) return;
	            const msgType = dashboardMsgTypeMap[String(typeLabel || '').toLowerCase()] || '';
	            setChatlogFilters(
	                select.value,
	                '',
	                `${kind === 'group' ? '群聊' : '私聊'} ${typeLabel} 类型已跳转`,
	                msgType,
	                { timeRange: getDashboardTimeRange(kind), hour: '' }
	            );
	        }

	        function openDashboardHourFilter(kind, hour) {
	            const select = document.getElementById(`dashboard-${kind}-select`);
	            if (!select || !select.value) return;
	            setChatlogFilters(
	                select.value,
	                '',
	                `${kind === 'group' ? '群聊' : '私聊'} ${hour} 时段已跳转`,
	                getDashboardJumpMsgType(kind),
	                { timeRange: getDashboardTimeRange(kind), hour: String(hour ?? '') }
	            );
	        }

function renderDashboardCharts(kind, typeItems, hourItems, ratioItems) {
    const typeEl = document.getElementById(`dashboard-${kind}-type-chart`);
    const hourEl = document.getElementById(`dashboard-${kind}-hour-chart`);
    const ratioEl = document.getElementById(`dashboard-${kind}-ratio-chart`);
    if (typeEl) typeEl.innerHTML = renderBarList(typeItems, { fillClass: kind === 'private' ? '' : 'pink', chartKind: kind });
    if (hourEl) hourEl.innerHTML = renderHourlyBars(hourItems, kind);
    if (ratioEl) ratioEl.innerHTML = kind === 'private'
        ? renderBarList(ratioItems, { fillClass: 'success' })
        : '';
}

function getDashboardSince(kind) {
    const rangeSelect = document.getElementById(`dashboard-${kind}-range`);
    const val = rangeSelect ? String(rangeSelect.value || 'all') : 'all';
    if (val === 'all') return '';
    const now = Math.floor(Date.now() / 1000);
    if (val === '30d') return String(now - 30 * 24 * 3600);
    if (val === '90d') return String(now - 90 * 24 * 3600);
    return '';
}

function getRecentSessionRankings(kind, selectedChat) {
    return dashboardSessions
        .filter(item => isDashboardSessionKind(item, kind) && item.username !== selectedChat)
        .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0))
        .slice(0, 8)
        .map(item => ({
            label: String(item.chat || item.username || ''),
            value: String(item.time || ''),
            username: String(item.username || '')
        }));
}

function renderBarList(items, options = {}) {
    if (!Array.isArray(items) || items.length === 0) {
        return '<div class="analytics-empty">暂无数据</div>';
    }
    const max = Math.max(...items.map(item => Number(item.value || 0)), 1);
    const fillClass = options.fillClass || '';
    return `
        <div class="bar-list">
            ${items.map(item => {
                const action = options.chartKind
                    ? ` data-on-click="openDashboardTypeFilter" data-action-args="${encodeActionArgs(options.chartKind, String(item.label || ''))}"`
                    : '';
                return `
                <div class="bar-row${action ? ' is-clickable' : ''}"${action}>
                    <span class="bar-label" title="${escapeHtml(item.label)}">${escapeHtml(item.label)}</span>
                    <div class="bar-track"><div class="bar-fill ${fillClass}" style="width:${Math.max(6, (Number(item.value || 0) / max) * 100)}%"></div></div>
                    <span class="bar-value">${Number(item.value || 0)}</span>
                </div>`;
            }).join('')}
        </div>
    `;
}

function renderHourlyBars(items, kind = '') {
    const list = Array.isArray(items) ? items : [];
    if (list.length === 0) {
        return '<div class="analytics-empty">暂无时段数据</div>';
    }
    const max = Math.max(...list.map(item => Number(item.count || 0)), 1);
    return `
        <div class="hour-bars">
            ${list.map(item => {
                const count = Number(item.count || 0);
                const height = max === 0 ? 2 : Math.max(2, (count / max) * 110);
                return `
                    <div class="hour-bar-col${kind ? ' is-clickable' : ''}" title="${item.hour}时: ${count}"${kind ? ` data-on-click="openDashboardHourFilter" data-action-args="${encodeActionArgs(kind, Number(item.hour || 0))}"` : ''}>
                        <span class="hour-count">${count}</span>
                        <div class="hour-bar" style="height:${height}px"></div>
                        <span class="hour-label">${item.hour}</span>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function openKeywordAnalyticsMessages(username = '', messageType = '') {
    const keyword = String(document.getElementById('keyword-analytics-keyword')?.value || '').trim();
    if (!keyword) return;
    const chats = String(username || document.getElementById('keyword-analytics-chats')?.value || '').trim();
    const timeRange = String(document.getElementById('keyword-analytics-time')?.value || '').trim();
    document.getElementById('mc-search-keyword').value = keyword;
    document.getElementById('mc-search-chats').value = chats;
    document.getElementById('mc-search-time').value = timeRange === 'all' ? '' : timeRange;
    document.getElementById('mc-search-msg-type').value = String(messageType || document.getElementById('keyword-analytics-type')?.value || '0');
    document.getElementById('mc-search-match').value = 'phrase';
    document.getElementById('mc-search-sort').value = 'time';
    document.getElementById('mc-search-offset').value = '0';
    navigateToTab('message-center');
    setTimeout(() => {
        messageCenterSearch();
    }, 0);
}

function renderKeywordAnalytics(data) {
    const body = document.getElementById('keyword-analytics-body');
    const state = document.getElementById('keyword-analytics-state');
    if (!body) return;
    const total = Number(data?.total || 0);
    const chatCount = Number(data?.chat_count || 0);
    const dayCount = Number(data?.day_count || 0);
    const byType = Array.isArray(data?.by_type) ? data.by_type : [];
    const byChat = Array.isArray(data?.by_chat) ? data.by_chat : [];
    const byDay = Array.isArray(data?.by_day) ? data.by_day : [];
    if (state) {
        const mode = data?.cache_mode === 'hit' ? '缓存命中' : 'FTS 完整聚合';
        state.textContent = `${mode} · ${total.toLocaleString('zh-CN')} 条`;
    }
    if (total <= 0) {
        body.innerHTML = '<div class="analytics-empty">当前关键词和筛选范围内没有匹配消息</div>';
        return;
    }
    const maxType = Math.max(1, ...byType.map(item => Number(item.count || 0)));
    const maxChat = Math.max(1, ...byChat.map(item => Number(item.count || 0)));
    const recentDays = byDay.slice(-60);
    const maxDay = Math.max(1, ...recentDays.map(item => Number(item.count || 0)));
    const typeRows = byType.map(item => {
        const count = Number(item.count || 0);
        const encodedType = encodeURIComponent(String(item.type_num || ''));
        return `<div class="bar-row">
            <button class="analytics-link-btn" data-on-click="openKeywordAnalyticsMessages" data-action-args="${encodeActionArgs('', decodeURIComponent(encodedType))}">${escapeHtml(String(item.type || '其他'))}</button>
            <div class="bar-track"><div class="bar-fill" style="width:${Math.max(4, count / maxType * 100).toFixed(1)}%"></div></div>
            <span class="bar-value">${count.toLocaleString('zh-CN')}</span>
        </div>`;
    }).join('');
    const chatRows = byChat.map(item => {
        const count = Number(item.count || 0);
        const username = String(item.username || '');
        return `<div class="bar-row">
            <button class="analytics-link-btn" title="${escapeHtml(username)}" data-on-click="openKeywordAnalyticsMessages" data-action-args="${encodeActionArgs(username)}">${escapeHtml(String(item.chat || username || '-'))}</button>
            <div class="bar-track"><div class="bar-fill success" style="width:${Math.max(4, count / maxChat * 100).toFixed(1)}%"></div></div>
            <span class="bar-value">${count.toLocaleString('zh-CN')}</span>
        </div>`;
    }).join('');
    const dayBars = recentDays.map(item => {
        const count = Number(item.count || 0);
        const height = Math.max(3, count / maxDay * 76);
        return `<div class="hour-bar-col" title="${escapeHtml(String(item.date || ''))}：${count.toLocaleString('zh-CN')} 条">
            <span class="hour-count">${count.toLocaleString('zh-CN')}</span>
            <div class="hour-bar" style="height:${height.toFixed(1)}px"></div>
            <span class="hour-label">${escapeHtml(String(item.date || '').slice(5))}</span>
        </div>`;
    }).join('');
    body.innerHTML = `
        <div class="kpi-grid">
            <div class="kpi-card"><span class="kpi-value">${total.toLocaleString('zh-CN')}</span><span class="kpi-label">关键词消息量</span></div>
            <div class="kpi-card"><span class="kpi-value">${chatCount.toLocaleString('zh-CN')}</span><span class="kpi-label">聊天对象</span></div>
            <div class="kpi-card"><span class="kpi-value">${dayCount.toLocaleString('zh-CN')}</span><span class="kpi-label">活跃天数</span></div>
        </div>
        <div class="range-text">检索链路：${escapeHtml(String(data.search_path || '-'))} · 数据范围：${escapeHtml(formatTimestamp(data.first_message_time))} - ${escapeHtml(formatTimestamp(data.last_message_time))}</div>
        <div class="actions"><button class="btn btn-secondary btn-sm" data-on-click="openKeywordAnalyticsMessages">查看全部匹配消息与媒体</button></div>
        <div class="analytics-grid">
            <section class="analytics-section"><h4>类型分布</h4><div class="bar-list">${typeRows || '<div class="analytics-empty">暂无类型数据</div>'}</div></section>
            <section class="analytics-section"><h4>聊天对象 Top ${byChat.length}</h4><div class="bar-list">${chatRows || '<div class="analytics-empty">暂无聊天对象</div>'}</div></section>
        </div>
        <div class="analytics-section"><h4>时间趋势（最近 ${recentDays.length} 个活跃日）</h4><div class="analytics-scroll"><div class="hour-bars" style="grid-template-columns:repeat(${Math.max(recentDays.length, 1)}, minmax(18px, 1fr)); min-width:${Math.max(520, recentDays.length * 24)}px;">${dayBars}</div></div></div>
    `;
}

async function loadKeywordAnalytics(force = false) {
    const keyword = String(document.getElementById('keyword-analytics-keyword')?.value || '').trim();
    const body = document.getElementById('keyword-analytics-body');
    const state = document.getElementById('keyword-analytics-state');
    if (!keyword) {
        showToast('请输入要分析的关键词', 'warning');
        document.getElementById('keyword-analytics-keyword')?.focus();
        return;
    }
    const params = new URLSearchParams({ keyword });
    const chats = String(document.getElementById('keyword-analytics-chats')?.value || '').trim();
    const timeRange = String(document.getElementById('keyword-analytics-time')?.value || '').trim();
    const messageType = String(document.getElementById('keyword-analytics-type')?.value || '0');
    if (chats) params.set('chats', chats);
    if (timeRange) params.set('time', timeRange);
    if (messageType !== '0') params.set('msg_type', messageType);
    if (force) params.set('force', '1');
    if (body) body.innerHTML = '<div class="analytics-empty">正在通过 FTS 候选集聚合...</div>';
    if (state) state.textContent = '分析中';
    try {
        const data = await requestJSON(`/api/v1/analytics/keywords?${params}`, { timeoutMs: 60000 });
        renderKeywordAnalytics(data);
    } catch (error) {
        const message = String(error?.message || error);
        if (body) body.innerHTML = `<div class="analytics-empty">分析失败：${escapeHtml(message)}</div>`;
        if (state) state.textContent = '分析失败';
    }
}

	        function renderDashboardStats(kind, data) {
	            const body = document.getElementById(`dashboard-${kind}-body`);
	            if (!body) return;
	            if (!data || typeof data !== 'object') {
	                body.innerHTML = '<div class="analytics-empty">暂无统计数据</div>';
	                return;
	            }
	            const total = Number(data.total || 0);
	            if (total <= 0) {
                body.innerHTML = `<div class="analytics-empty">当前口径下暂无消息。<div class="analytics-empty-actions"><button class="btn btn-secondary btn-sm" data-on-click="loadDashboardStats" data-action-args="${encodeActionArgs(kind, true)}">刷新</button></div></div>`;
	                return;
	            }

	            const typeItems = Array.isArray(data.by_type)
	                ? data.by_type.slice(0, 6).map(item => ({ label: String(item.type || '其他'), value: Number(item.count || 0) }))
	                : [];
    const hourItems = Array.isArray(data.by_hour)
        ? data.by_hour.map(item => ({ hour: Number(item.hour || 0), count: Number(item.count || 0) }))
        : [];
    const senderItems = Array.isArray(data.top_senders)
        ? data.top_senders.slice(0, 8).map(item => ({ label: String(item.sender || '未知'), value: Number(item.count || 0) }))
        : [];
    const ratioItems = [
        { label: '发送', value: Number(data.sent_count || 0) },
        { label: '接收', value: Number(data.received_count || 0) }
    ].filter(item => item.value > 0);
	            const selectedChat = String(data.username || '');
	            const recentRankings = getRecentSessionRankings(kind, selectedChat);
	            const defaultJumpType = getDashboardJumpMsgType(kind);
	            const defaultRange = getDashboardTimeRange(kind);

	            const kpiThirdValue = data.chat_type === 'group'
	                ? Number(data.active_senders || 0)
	                : Math.round((Number(data.sent_count || 0) / Math.max(Number(data.total || 0), 1)) * 100);
	            const kpiThirdLabel = data.chat_type === 'group' ? '活跃成员数' : '发送占比';

    body.innerHTML = `
        <div class="kpi-grid">
	                    <div class="kpi-card">
	                        <span class="kpi-value">${total}</span>
	                        <span class="kpi-label">消息总数</span>
	                    </div>
            <div class="kpi-card">
                <span class="kpi-value">${Number(data.active_days || 0)}</span>
                <span class="kpi-label">活跃天数</span>
            </div>
            <div class="kpi-card">
                <span class="kpi-value">${kpiThirdValue}${data.chat_type === 'group' ? '' : '%'}</span>
                <span class="kpi-label">${kpiThirdLabel}</span>
            </div>
	                </div>
	                <div class="range-text">统计口径：${escapeHtml(String(data.query_range_label || '全部时间'))}</div>
	                <div class="range-text">数据范围：${escapeHtml(formatTimestamp(data.first_message_time))} - ${escapeHtml(formatTimestamp(data.last_message_time))}</div>
	                ${kind === 'private' ? `
            <div class="analytics-section">
                <h4>发送 / 接收比例</h4>
                <div id="dashboard-private-ratio-chart" class="chart-container"></div>
            </div>
            <div class="analytics-section">
                <h4>最近活跃联系人</h4>
	                        <div class="bar-list">
	                            ${recentRankings.length ? recentRankings.map(item => `
	                                <div class="bar-row bar-row-wide-label">
	                                    <button class="analytics-link-btn analytics-link-compact" data-on-click="setChatlogFilters" data-action-args="${encodeActionArgs(String(item.username || ''), '', `私聊 ${item.label} 已跳转`, String(defaultJumpType || ''), { timeRange: String(defaultRange || '') })}">${escapeHtml(item.label)}</button>
	                                    <div class="bar-track"><div class="bar-fill success is-full"></div></div>
	                                    <span class="bar-value">${escapeHtml(item.value)}</span>
	                                </div>
	                            `).join('') : '<div class="analytics-empty">暂无其他活跃联系人</div>'}
                </div>
            </div>
        ` : `
            <div class="analytics-section">
                <h4>群聊发言排行</h4>
                <div class="bar-list">
                    ${senderItems.length ? senderItems.map(item => `
                        <div class="bar-row">
	                                    <button class="analytics-link-btn analytics-link-compact" data-on-click="openDashboardGroupSender" data-action-args="${encodeActionArgs(String(item.label || ''))}" title="查看 ${escapeHtml(String(item.label || ''))} 的群聊消息">${escapeHtml(String(item.label || ''))}</button>
                            <div class="bar-track"><div class="bar-fill warning" style="width:${Math.max(6, (Number(item.value || 0) / Math.max(...senderItems.map(x => Number(x.value || 0)), 1)) * 100)}%"></div></div>
                            <span class="bar-value">${Number(item.value || 0)}</span>
                        </div>
                    `).join('') : '<div class="analytics-empty">暂无排行数据</div>'}
                </div>
            </div>
        `}
        <div class="analytics-section">
            <h4>消息类型分布</h4>
            <div id="dashboard-${kind}-type-chart" class="chart-container"></div>
            <div class="range-text">点击类型条目可直接带入消息检索。</div>
        </div>
	                <div class="analytics-section">
	                    <h4>${kind === 'private' ? '每小时消息分布' : '群聊活跃时段'}</h4>
	                    <div id="dashboard-${kind}-hour-chart" class="chart-container wide"></div>
	                    <div class="range-text">点击小时柱可直接带入消息检索。</div>
	                </div>
	            `;
    renderDashboardCharts(kind, typeItems, hourItems, ratioItems);
}


// ==================== Dashboard Overview / Comparison / Leaderboard ====================

function getStatsTimeParam() {
    switch (dashboardStatsRange) {
        case '1d': return 'last-1d';
        case '7d': return 'last-7d';
        case '30d': return 'last-30d';
        case '90d': return 'last-3m';
        case '1y': return 'last-1y';
        case 'all': return 'all';
        default: return 'last-1d';
    }
}

function setupDashboardTimeRange(containerId, stateKey, onChange) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (container.dataset.bound === 'true') return;
    container.dataset.bound = 'true';
    container.querySelectorAll('.time-range-tab').forEach(function(btn) {
        btn.addEventListener('click', function() {
            container.querySelectorAll('.time-range-tab').forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
            const range = btn.getAttribute('data-range');
            dashboardStatsRange = range;
            if (typeof onChange === 'function') onChange(range);
        });
    });
}

function dashboardStatsCacheKey(username, timeParam) {
    return `${timeParam}::${username}`;
}

async function fetchDashboardGroupStats(group, timeParam, signal) {
    const key = dashboardStatsCacheKey(group.username, timeParam);
    if (dashboardStatsCache.has(key)) return dashboardStatsCache.get(key);
    const url = `/api/v1/stats?chat=${encodeURIComponent(group.username)}&time=${encodeURIComponent(timeParam)}`;
    try {
        const data = await requestJSON(url, { signal, timeoutMs: 20000 });
        dashboardStatsCache.set(key, data);
        return data;
    } catch (error) {
        // A stale overview run should stop immediately. A timeout for
        // one group should only omit that group from the aggregate.
        if (signal && signal.aborted) throw error;
        return null;
    }
}

async function loadDashboardOverview(includeAll = false) {
    const runID = ++dashboardOverviewRunID;
    if (dashboardOverviewController) dashboardOverviewController.abort();
    const controller = new AbortController();
    dashboardOverviewController = controller;
    const status = document.getElementById('dashboard-overview-time');
    const loadAllButton = document.getElementById('dashboard-overview-load-all');
    try {
        const groups = dashboardSessions.filter(s => s.chat_type === 'group');
        if (!groups.length) {
            document.getElementById('dashboard-ov-msgs').textContent = '0';
            document.getElementById('dashboard-ov-groups').textContent = '0';
            document.getElementById('dashboard-ov-senders').textContent = '0';
            document.getElementById('dashboard-comparison-grid').innerHTML =
                '<div class="analytics-empty analytics-grid-wide">暂无群聊统计数据</div>';
            document.getElementById('dashboard-leaderboard-body').innerHTML = '<div class="analytics-empty">暂无发言数据</div>';
            if (loadAllButton) loadAllButton.classList.add('hidden');
            return;
        }

        const targetGroups = includeAll ? groups : groups.slice(0, dashboardAutomaticGroupLimit);
        if (loadAllButton) {
            loadAllButton.classList.toggle('hidden', groups.length <= dashboardAutomaticGroupLimit);
            loadAllButton.disabled = includeAll;
            loadAllButton.textContent = includeAll ? '正在统计全部群聊…' : `统计全部 ${groups.length} 个群聊`;
        }
        const timeParam = getStatsTimeParam();
        const results = new Array(targetGroups.length);
        let completed = 0;
        if (status) status.textContent = `正在统计 0/${targetGroups.length}（并发 ${dashboardStatsConcurrency}）`;

        await runLimited(targetGroups.map((group, index) => ({ group, index })), dashboardStatsConcurrency, async ({ group, index }) => {
            results[index] = await fetchDashboardGroupStats(group, timeParam, controller.signal);
            completed++;
            if (runID === dashboardOverviewRunID && status) {
                status.textContent = `正在统计 ${completed}/${targetGroups.length}（并发 ${dashboardStatsConcurrency}）`;
            }
        });
        if (runID !== dashboardOverviewRunID || controller.signal.aborted) return;

        const statsList = results.filter(d => d && d.total > 0);
        const renderedStats = statsList
            .slice()
            .sort((a, b) => Number(b.total || 0) - Number(a.total || 0))
            .slice(0, dashboardRenderedGroupLimit);
        const totalMsgs = statsList.reduce((sum, item) => sum + Number(item.total || 0), 0);
        const activeSenderSlots = statsList.reduce((sum, item) => sum + Number(item.active_senders || 0), 0);

        document.getElementById('dashboard-ov-msgs').textContent = totalMsgs.toLocaleString();
        document.getElementById('dashboard-ov-groups').textContent = statsList.length;
        document.getElementById('dashboard-ov-senders').textContent = activeSenderSlots.toLocaleString();
        document.getElementById('dashboard-ov-senders').title = '按群累加活跃发言成员；同一成员在多个群会重复计入。';

        const rangeLabels = { '1d': '今天', '7d': '近7天', '30d': '近1月', '90d': '近季度', '1y': '近1年', 'all': '全部' };
        const scope = targetGroups.length < groups.length
            ? `最近活跃 ${targetGroups.length}/${groups.length} 个群`
            : `全部 ${groups.length} 个群`;
        if (status) {
            status.textContent = `${rangeLabels[dashboardStatsRange] || ''} · ${scope} · 更新于 ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
        }
        if (loadAllButton) {
            loadAllButton.disabled = false;
            loadAllButton.textContent = includeAll ? '重新统计全部群聊' : `统计全部 ${groups.length} 个群聊`;
        }

        renderDashboardComparison(renderedStats);
        renderDashboardLeaderboard(statsList);
        renderDashboardCrossCharts(renderedStats);
    } catch (error) {
        if (!error || error.name !== 'AbortError') {
            console.error('loadDashboardOverview error:', error);
            if (status) status.textContent = `统计失败：${String(error && error.message ? error.message : error)}`;
        }
    } finally {
        if (runID === dashboardOverviewRunID) dashboardOverviewController = null;
        if (loadAllButton && runID === dashboardOverviewRunID) loadAllButton.disabled = false;
    }
}

function renderDashboardComparison(statsList) {
    const grid = document.getElementById('dashboard-comparison-grid');
    if (!statsList.length) {
        grid.innerHTML = '<div class="analytics-empty analytics-grid-wide">暂无群聊统计数据</div>';
        return;
    }
    grid.innerHTML = statsList.map(d => {
        const typeCounts = (d.by_type || []).slice(0, 5);
        const total = d.total || 1;
        const typeBarHtml = typeCounts.map(t => {
            const cls = typeClass(t.type);
            const pct = (t.count / total * 100).toFixed(1);
            return `<span class="${cls}" style="width:${pct}%" title="${t.type}: ${t.count} (${pct}%)"></span>`;
        }).join('');
        const legendHtml = typeCounts.map(t =>
            `<span><span class="dot ${typeClass(t.type)}"></span>${t.type} ${(t.count/total*100).toFixed(0)}%</span>`
        ).join('');

        const topSender = (d.top_senders || [])[0];
        const peakHour = (d.by_hour || []).reduce((a, b) => (a.count > b.count ? a : b), { hour: '?', count: 0 });

        return `
        <div class="comparison-card" data-on-click="setChatlogFilters" data-action-args="${encodeActionArgs(d.username || '', '', `群聊 ${d.chat || ''} 已跳转`, '', { timeRange: dashboardRangeToHistoryTime(dashboardStatsRange) })}">
            <h4 title="${escapeHtml(d.chat || d.username || '')}">${escapeHtml(d.chat || d.username || '')}</h4>
            <div class="comparison-stats">
                <div class="comparison-stat">
                    <div class="val">${(d.total || 0).toLocaleString()}</div>
                    <div class="lbl">消息总量</div>
                </div>
                <div class="comparison-stat">
                    <div class="val">${d.active_senders || 0}</div>
                    <div class="lbl">活跃人数</div>
                </div>
                <div class="comparison-stat">
                    <div class="val">${d.active_days || 0}</div>
                    <div class="lbl">活跃天数</div>
                </div>
                <div class="comparison-stat">
                    <div class="val">${peakHour.hour}时</div>
                    <div class="lbl">高峰时段</div>
                </div>
            </div>
            <div class="comparison-type-bar">${typeBarHtml}</div>
            <div class="comparison-type-legend">${legendHtml}</div>
            ${topSender ? `<div class="comparison-top-sender">最多发言: <strong>${escapeHtml(topSender.sender || '?')}</strong> (${topSender.count}条)</div>` : ''}
        </div>`;
    }).join('');
}

function renderDashboardLeaderboard(statsList) {
    const body = document.getElementById('dashboard-leaderboard-body');
    const agg = new Map();
    statsList.forEach(d => {
        (d.top_senders || []).forEach(s => {
            const name = (s.sender || '').trim();
            if (!name) return;
            const cur = agg.get(name) || { name, count: 0, groups: new Set() };
            cur.count += s.count || 0;
            cur.groups.add(d.chat || d.username || '');
            agg.set(name, cur);
        });
    });
    const sorted = Array.from(agg.values()).sort((a, b) => b.count - a.count).slice(0, 15);
    if (!sorted.length) {
        body.innerHTML = '<div class="analytics-empty">暂无发言数据</div>';
        return;
    }
    const maxCount = sorted[0].count;
    body.innerHTML = `\n            <table class="leaderboard-table">\n                <thead><tr><th>#</th><th>发言人</th><th>来源群</th><th>消息数</th></tr></thead>\n                <tbody>\n                ${sorted.map((s, i) => `\n                <tr>\n                    <td class="rank rank-${i+1 <= 3 ? i+1 : ''}">${i + 1}</td>\n                    <td>${escapeHtml(s.name)}</td>\n                    <td class="group-name">${s.groups.size > 1 ? s.groups.size + ' 个群' : escapeHtml([...s.groups][0] || '')}</td>\n                    <td class="count">\n                        <div class="leaderboard-count-value">\n                            <div class="bar-track leaderboard-bar-track"><div class="bar-fill ${i < 3 ? 'warning' : ''}" style="width:${(s.count/maxCount*100).toFixed(0)}%"></div></div>\n                            ${s.count.toLocaleString()}\n                        </div>\n                    </td>\n                </tr>`).join('')}\n                </tbody>\n            </table>`;
}

function typeClass(type) {
    const m = { image: 'img', text: 'txt', video: 'vid', share: 'share' };
    return m[type] || 'other';
}

function renderDashboardCrossCharts(statsList) {
    const typeEl = document.getElementById('dashboard-cross-type-chart');
    const hourEl = document.getElementById('dashboard-cross-hour-chart');
    if (!statsList.length) {
        if (typeEl) typeEl.innerHTML = '<div class="analytics-empty">暂无消息类型统计</div>';
        if (hourEl) hourEl.innerHTML = '<div class="analytics-empty">暂无活跃时段统计</div>';
        return;
    }
    const typeMeta = [
        ['text', '文本'],
        ['image', '图片'],
        ['video', '视频'],
        ['share', '分享'],
        ['system', '系统']
    ];
    const groups = statsList.map(item => {
        const byType = {};
        (item.by_type || []).forEach(value => { byType[value.type] = Number(value.count || 0); });
        const hours = new Array(24).fill(0);
        (item.by_hour || []).forEach(value => {
            const hour = Number(value.hour);
            if (hour >= 0 && hour < 24) hours[hour] = Number(value.count || 0);
        });
        const typedTotal = typeMeta.reduce((sum, entry) => sum + (byType[entry[0]] || 0), 0);
        return {
            name: String(item.chat || item.username || '-'),
            total: Math.max(Number(item.total || 0), typedTotal, 1),
            byType,
            hours
        };
    });

    if (typeEl) {
        const legend = typeMeta.map(([key, label]) =>
            `<span class="chart-legend-item"><i class="chart-swatch type-${key}"></i>${label}</span>`
        ).join('');
        const rows = groups.map(group => {
            const segments = typeMeta.map(([key, label]) => {
                const value = group.byType[key] || 0;
                const width = value > 0 ? Math.max(1.2, value / group.total * 100) : 0;
                return `<span class="native-stack-segment type-${key}" style="width:${width.toFixed(2)}%" title="${escapeHtml(label)}：${value.toLocaleString()} 条"></span>`;
            }).join('');
            return `<div class="native-stack-row">
                <span class="native-chart-label" title="${escapeHtml(group.name)}">${escapeHtml(group.name)}</span>
                <div class="native-stacked-bar" aria-label="${escapeHtml(group.name)}消息类型分布">${segments}</div>
                <strong>${group.total.toLocaleString()}</strong>
            </div>`;
        }).join('');
        typeEl.innerHTML = `<div class="native-chart"><div class="native-chart-legend">${legend}</div><div class="native-chart-rows">${rows}</div></div>`;
    }

    if (hourEl) {
        const maxHour = Math.max(1, ...groups.flatMap(group => group.hours));
        const header = Array.from({ length: 24 }, (_, hour) => `<span>${hour}</span>`).join('');
        const rows = groups.map(group => {
            const cells = group.hours.map((count, hour) => {
                const heat = count > 0 ? Math.max(0.12, count / maxHour) : 0.04;
                const label = `${group.name} · ${hour}:00：${count.toLocaleString()} 条`;
                return `<span class="hour-heat-cell" style="--heat:${heat.toFixed(3)}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}"></span>`;
            }).join('');
            return `<div class="heatmap-row"><span class="native-chart-label" title="${escapeHtml(group.name)}">${escapeHtml(group.name)}</span><div class="heatmap-grid">${cells}</div></div>`;
        }).join('');
        hourEl.innerHTML = `<div class="heatmap-scroll"><div class="hour-heatmap"><div class="heatmap-row heatmap-header"><span></span><div class="heatmap-grid">${header}</div></div>${rows}</div></div>`;
    }
}

function isDashboardSessionKind(item, kind) {
    const chatType = String(item && item.chat_type || '').toLowerCase();
    if (kind === 'private') {
        // BrandSessionHolder is a folded container without its own
        // message table. Its gh_* children are real, queryable chats.
        return chatType === 'private' || chatType === 'official_account';
    }
    return chatType === kind;
}

function buildSessionOptions(kind, select, preserveValue = '') {
    const filtered = dashboardSessions.filter(item => isDashboardSessionKind(item, kind));
    if (!filtered.length) {
        select.innerHTML = '<option value="">暂无会话</option>';
        return '';
    }
    const nextValue = filtered.some(item => item.username === preserveValue) ? preserveValue : filtered[0].username;
    select.innerHTML = filtered.map(item => {
        const accountLabel = item.chat_type === 'official_account' ? ' · 公众号' : '';
        const label = `${item.chat || item.username}${accountLabel} · ${item.time || ''}`;
        return `<option value="${escapeHtml(item.username)}">${escapeHtml(label)}</option>`;
    }).join('');
    select.value = nextValue;
	            return nextValue;
	        }

	        function renderDashboardLoadError(kind, err) {
	            const body = document.getElementById(`dashboard-${kind}-body`);
	            if (!body) return;
	            const raw = String(err && err.message ? err.message : err || 'unknown error');
	            const lower = raw.toLowerCase();
	            let tip = '';
	            if (lower.includes('abort') || lower.includes('timeout') || lower.includes('504')) {
	                tip = '查询超时，建议缩小统计口径（例如最近 30 天）。';
	            } else if (lower.includes('500') || lower.includes('database') || lower.includes('query failed')) {
	                tip = '数据库当前不可用，请稍后重试。';
	            }
	            body.innerHTML = `
	                <div class="analytics-empty">
	                    加载失败: ${escapeHtml(raw)}
	                    ${tip ? `<div class="analytics-error-tip">${escapeHtml(tip)}</div>` : ''}
	                    <div class="analytics-error-actions">
	                        <button class="btn btn-secondary btn-sm" data-on-click="loadDashboardStats" data-action-args="${encodeActionArgs(kind, true)}">重试</button>
	                        <button class="btn btn-secondary btn-sm" data-on-click="loadDashboardStats30Days" data-action-args="${encodeActionArgs(kind)}">切换到最近30天</button>
	                    </div>
	                </div>
	            `;
	        }

	        async function loadDashboardAnalytics(force = false) {
        if (!force && dashboardAnalyticsLoaded) return;
        if (dashboardAnalyticsPromise) return dashboardAnalyticsPromise;
        dashboardAnalyticsPromise = (async () => {
	                try {
                if (force) {
                    dashboardAnalyticsLoaded = false;
                    dashboardStatsCache.clear();
                    if (dashboardOverviewController) dashboardOverviewController.abort();
                }
	                    if (force || dashboardSessions.length === 0) {
	                        const data = await requestJSON('/api/v1/sessions?limit=500', { timeoutMs: 20000 });
	                        dashboardSessions = Array.isArray(data.sessions) ? data.sessions : [];
                }
                setupDashboardTimeRange('dashboard-stats-range', 'stats', function() {
                    loadDashboardOverview(false);
                    const privateSelect = document.getElementById('dashboard-private-select');
                    const groupSelect = document.getElementById('dashboard-group-select');
                    if (privateSelect && privateSelect.value) loadDashboardStats('private');
                    if (groupSelect && groupSelect.value) loadDashboardStats('group');
                });
                const privateSelect = document.getElementById('dashboard-private-select');
                const groupSelect = document.getElementById('dashboard-group-select');
                const privateValue = buildSessionOptions('private', privateSelect, privateSelect.value);
                const groupValue = buildSessionOptions('group', groupSelect, groupSelect.value);
                if (privateValue) loadDashboardStats('private');
                else document.getElementById('dashboard-private-body').innerHTML = '<div class="analytics-empty">暂无私聊会话</div>';
                if (groupValue) loadDashboardStats('group');
                else document.getElementById('dashboard-group-body').innerHTML = '<div class="analytics-empty">暂无群聊会话</div>';
                loadDashboardOverview(false);
                dashboardAnalyticsLoaded = true;
	                } catch (e) {
	                    renderDashboardLoadError('private', e);
	                    renderDashboardLoadError('group', e);
	                }
        })();
        try {
            return await dashboardAnalyticsPromise;
        } finally {
            dashboardAnalyticsPromise = null;
        }
	        }

async function loadDashboardStats(kind, forceReloadSessions = false) {
    if (forceReloadSessions) {
        if (dashboardDetailControllers[kind]) dashboardDetailControllers[kind].abort();
        await loadDashboardAnalytics(true);
        return;
    }
    const select = document.getElementById(`dashboard-${kind}-select`);
    const body = document.getElementById(`dashboard-${kind}-body`);
    if (!select || !body) return;
    const chat = (select.value || '').trim();
    if (!chat) {
        body.innerHTML = `<div class="analytics-empty">暂无${kind === 'private' ? '私聊' : '群聊'}会话</div>`;
        return;
    }
    if (dashboardDetailControllers[kind]) dashboardDetailControllers[kind].abort();
    const controller = new AbortController();
    dashboardDetailControllers[kind] = controller;
    body.innerHTML = '<div class="analytics-empty">统计中...</div>';
	            try {
	                const since = getDashboardSince(kind);
	                const params = new URLSearchParams();
	                params.set('chat', chat);
	                if (since) params.set('since', since);
	                const url = `/api/v1/stats?${params.toString()}`;
	                const data = await requestJSON(url, { signal: controller.signal, timeoutMs: 20000 });
	                if (dashboardDetailControllers[kind] === controller) renderDashboardStats(kind, data);
	            } catch (e) {
	                if ((!e || e.name !== 'AbortError') && dashboardDetailControllers[kind] === controller) {
	                    renderDashboardLoadError(kind, e);
	                }
	            } finally {
	                if (dashboardDetailControllers[kind] === controller) dashboardDetailControllers[kind] = null;
	            }
	        }

// Modal View Switching
function switchModalView(view) {
    document.querySelectorAll('.modal-nav .nav-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btn-view-${view}`).classList.add('active');

    document.querySelectorAll('.modal-view').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${view}`).classList.add('active');
}

async function runLimited(items, limit, worker) {
    const list = Array.isArray(items) ? items : [];
    const concurrency = Math.max(1, Number(limit || 1));
    let cursor = 0;
    const runners = Array.from({ length: Math.min(concurrency, list.length) }, async () => {
        while (cursor < list.length) {
            const item = list[cursor++];
            await worker(item);
        }
    });
    await Promise.all(runners);
}

function disposeAnalytics() {
    if (dashboardOverviewController) dashboardOverviewController.abort();
    Object.values(dashboardDetailControllers).forEach(controller => controller?.abort());
}

async function refreshChatAnalytics() {
    dashboardStatsCache.clear();
    dashboardAnalyticsLoaded = false;
    await loadDashboardAnalytics(true);
    showToast('聊天数据分析已刷新');
}

function loadDashboardStats30Days(kind) {
    const range = document.getElementById(`dashboard-${kind}-range`);
    if (range) range.value = '30d';
    return loadDashboardStats(kind);
}

const analyticsActions = createActionHandlers({
    loadDashboardOverview,
    loadDashboardStats,
    loadDashboardStats30Days,
    loadKeywordAnalytics,
    openDashboardChat,
    openDashboardGroupSender,
    openDashboardHourFilter,
    openDashboardTypeFilter,
    openKeywordAnalyticsMessages,
    refreshChatAnalytics,
    setChatlogFilters,
    switchModalView,
});

export { analyticsActions, disposeAnalytics, loadDashboardAnalytics, runLimited, switchModalView };
