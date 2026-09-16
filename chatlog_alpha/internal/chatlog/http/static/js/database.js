'use strict';


import { encodeActionArgs, escapeHtml, showToast } from './ui.js';
import { createActionHandlers } from './events.js';
import { runLimited, switchModalView } from './analytics.js';
import { enhanceStructuredResult } from './features.js';
import { requestBlob, requestJSON } from './api.js';

let currentDB = { group: null, file: null };
let currentTable = null;
let currentPage = 0;
let currentKeyword = '';
let globalSearchKeyword = '';
let currentPageSize = 50;
let currentPageRowCount = 0;
let currentTables = [];
let currentDBFiles = [];
let databaseBusinessModulesCache = [];
let auxiliaryDatasetsCache = [];
let currentAuxiliaryDataset = '';
let currentAuxiliaryOffset = 0;
const activeQueryControllers = new Map();
const resultDownloadURLs = new Map();
const maxInlineResultBytes = 2 * 1024 * 1024;
const maxPrettyJSONBytes = 512 * 1024;

function normalizedIntegerInput(id, fallback, minimum, maximum = null) {
    const input = document.getElementById(id);
    const raw = String(input ? input.value : '').trim();
    const fail = message => {
        if (input) {
            input.setCustomValidity(message);
            input.reportValidity();
            input.focus();
        }
        showToast(message, 'warning');
        return null;
    };
    if (!input) return String(fallback);
    input.setCustomValidity('');
    const normalized = raw === '' ? String(fallback) : raw;
    if (!/^-?\d+$/.test(normalized)) return fail('请输入整数，不能包含小数或其他字符');
    const value = Number(normalized);
    if (!Number.isSafeInteger(value)) return fail('整数超出安全范围');
    if (value < minimum || (maximum !== null && value > maximum)) {
        const range = maximum === null ? `不小于 ${minimum}` : `${minimum}–${maximum}`;
        return fail(`请输入范围 ${range} 内的整数`);
    }
    input.value = String(value);
    return String(value);
}

const databaseGroupMeta = {
    message: ['消息', '◫'],
    session: ['会话', '◷'],
    contact: ['联系人', '◎'],
    sns: ['朋友圈', '◉'],
    media: ['媒体', '▧'],
    favorite: ['收藏', '☆']
};

function databaseGroupLabel(group) {
    return databaseGroupMeta[group] || [group, '▤'];
}

// Load DB List
async function loadDBList(force = false) {
    loadDatabaseBusinessModules(force);
    loadAuxiliaryDatasets(force);
    const container = document.getElementById('db-list-container');
    const summary = document.getElementById('db-list-summary');
    if (!container) return;
    if (force) container.innerHTML = '<div class="loading">正在重新扫描数据库...</div>';
    if (summary) summary.innerHTML = '<span class="summary-chip">正在检查查询状态</span>';
    try {
        const data = await requestJSON('/api/v1/db');

        let html = '';
        const entries = Object.entries(data)
            .filter(([, files]) => Array.isArray(files) && files.length > 0);

        const order = ['message', 'session', 'contact', 'sns', 'media', 'favorite'];
        entries.sort((a, b) => {
            const ai = order.indexOf(a[0]);
            const bi = order.indexOf(b[0]);
            if (ai === -1 && bi === -1) return a[0].localeCompare(b[0]);
            if (ai === -1) return 1;
            if (bi === -1) return -1;
            return ai - bi;
        });

        // Probe queryability so dashboard can label each database.
        const statusMap = {};
        const probes = [];
        for (const [group, files] of entries) {
            files.forEach(file => {
                const key = `${group}::${file}`;
                probes.push({ group, file, key });
            });
        }
        await runLimited(probes, 6, async ({ group, file, key }) => {
            try {
                const tables = await requestJSON(`/api/v1/db/tables?group=${encodeURIComponent(group)}&file=${encodeURIComponent(file)}`);
                statusMap[key] = { ok: true, tableCount: Array.isArray(tables) ? tables.length : 0 };
            } catch (_) {
                statusMap[key] = { ok: false, tableCount: 0 };
            }
        });

        currentDBFiles = [];
        for (const [group, files] of entries) {
            const [groupLabel, groupIcon] = databaseGroupLabel(group);
            html += `
                <section class="db-group" data-db-group="${escapeHtml(group)}">
                    <div class="db-group-header">
                        <div class="db-group-title">
                            <span class="db-group-icon">${groupIcon}</span>
                            <div><strong>${escapeHtml(groupLabel)}</strong><span>${escapeHtml(group)} · ${files.length} 个文件</span></div>
                        </div>
                    </div>
                    <div class="db-file-grid">
            `;

            files.forEach(file => {
                const encodedGroup = encodeURIComponent(group);
                const encodedFile = encodeURIComponent(file);
                const key = `${group}::${file}`;
                const status = statusMap[key] || { ok: false, tableCount: 0 };
                const basename = String(file).split(/[\\/]/).pop();
                currentDBFiles.push({ group, file, basename, ok: status.ok });
                const statusBadge = status.ok
                    ? `<span class="db-status is-ready"><i></i>可查询</span>`
                    : `<span class="db-status is-error"><i></i>不可查询</span>`;
                html += `<button class="db-file-card" type="button" data-db-search="${escapeHtml(`${group} ${groupLabel} ${file}`.toLowerCase())}" data-group="${escapeHtml(encodedGroup)}" data-file="${escapeHtml(encodedFile)}" data-on-click="openDBViewerFromElement" ${status.ok ? '' : 'disabled'}>
                    <span class="db-file-icon">▤</span>
                    <span class="db-file-content">
                        <strong>${escapeHtml(basename)}</strong>
                        <span class="db-file-path" title="${escapeHtml(file)}">${escapeHtml(file)}</span>
                        <span class="db-file-meta">${statusBadge}<span>${status.tableCount} 张可浏览表</span></span>
                    </span>
                    <span class="db-file-chevron">›</span>
                </button>`;
            });

            html += `</div></section>`;
        }
        if (!html) {
            html = `<div class="empty-state"><strong>还没有发现数据库</strong><span>请先获取密钥并确认数据库文件可读。</span></div>`;
        }
        container.innerHTML = html;
        renderDatabaseSummary(entries.length);
        filterDatabaseCards();
    } catch (e) {
        container.innerHTML = `<div class="empty-state is-error"><strong>数据库列表加载失败</strong><span>${escapeHtml(e.message)}</span><button class="btn btn-secondary btn-sm" type="button" data-on-click="loadDBList" data-action-args="${encodeActionArgs(true)}">重试</button></div>`;
        if (summary) summary.innerHTML = '<span class="summary-chip is-error">加载失败</span>';
    }
}

async function loadDatabaseBusinessModules(force = false) {
    const container = document.getElementById('db-business-modules');
    if (!container) return;
    if (force) container.innerHTML = '<div class="loading">正在重新核对业务模块...</div>';
    try {
        const data = await requestJSON('/api/v1/db/modules');
        const modules = Array.isArray(data.modules) ? data.modules : [];
        databaseBusinessModulesCache = modules;
        if (modules.length === 0) {
            container.innerHTML = '<div class="empty-state"><strong>尚未识别业务模块</strong><span>数据库就绪后重新刷新。</span></div>';
            return;
        }
        container.innerHTML = modules.map(module => {
            const files = Array.isArray(module.files) ? module.files : [];
            const capabilities = Array.isArray(module.capabilities) ? module.capabilities : [];
            const missing = Array.isArray(module.missing) ? module.missing : [];
            const statusLabel = module.status === 'ready' ? '完整' : module.status === 'partial' ? '部分' : '缺失';
            return `<button class="database-business-card is-${escapeHtml(module.status || 'missing')}" type="button"
                data-module="${escapeHtml(module.id || '')}" data-on-click="showDatabaseBusinessModuleFromElement">
                <div class="database-business-card-head">
                    <div><strong>${escapeHtml(module.label || module.id || '')}</strong><span>${escapeHtml(module.description || '')}</span></div>
                    <em>${statusLabel}</em>
                </div>
                <div class="database-business-metrics">
                    <span><b>${files.length}</b> 个数据库</span>
                    <span><b>${capabilities.length}</b> 项能力</span>
                </div>
                <div class="database-business-capabilities">${capabilities.map(item => `<code>${escapeHtml(item)}</code>`).join('')}</div>
                ${missing.length ? `<small>待补：${escapeHtml(missing.join('、'))}</small>` : ''}
            </button>`;
        }).join('');
    } catch (error) {
        container.innerHTML = `<div class="empty-state is-error"><strong>业务模块核对失败</strong><span>${escapeHtml(error.message)}</span></div>`;
    }
}

function showDatabaseBusinessModule(moduleID) {
    const box = document.getElementById('db-business-result');
    if (!box) return;
    const module = databaseBusinessModulesCache.find(item => String(item.id || '') === String(moduleID || ''));
    box.classList.remove('hidden');
    if (!module) {
        box.innerHTML = '<div class="runtime-list-empty is-error">业务模块详情不存在，请重新刷新数据库列表。</div>';
        return;
    }
    const files = Array.isArray(module.files) ? module.files : [];
    const capabilities = Array.isArray(module.capabilities) ? module.capabilities : [];
    const missing = Array.isArray(module.missing) ? module.missing : [];
    const statusLabel = module.status === 'ready' ? '完整可用' : module.status === 'partial' ? '部分可用' : '等待数据库';
    box.innerHTML = `
        <div class="database-business-detail-head">
            <div><span class="page-kicker">MODULE DETAIL</span><h4>${escapeHtml(module.label || module.id || '')}</h4><p>${escapeHtml(module.description || '')}</p></div>
            <span class="summary-chip ${module.status === 'ready' ? 'is-success' : module.status === 'missing' ? 'is-error' : ''}">${escapeHtml(statusLabel)}</span>
        </div>
        <div class="database-business-capabilities">${capabilities.map(item => `<code>${escapeHtml(item)}</code>`).join('')}</div>
        ${missing.length ? `<div class="database-business-missing"><strong>待补能力</strong><span>${escapeHtml(missing.join('、'))}</span></div>` : ''}
        <div class="database-business-file-list">
            ${files.length ? files.map(file => `
                <button type="button" class="database-business-file"
                    data-group="${escapeHtml(encodeURIComponent(file.group || ''))}"
                    data-file="${escapeHtml(encodeURIComponent(file.file || ''))}"
                    data-on-click="openDBViewerFromElement">
                    <span><strong>${escapeHtml(file.role || '数据库')}</strong><small>${escapeHtml(file.group || '')}</small></span>
                    <code title="${escapeHtml(file.file || '')}">${escapeHtml(file.file || file.name || '')}</code><i>打开 ›</i>
                </button>`).join('') : '<div class="runtime-list-empty">当前模块还没有可打开的数据库文件。</div>'}
        </div>`;
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function loadAuxiliaryDatasets(force = false) {
    const container = document.getElementById('db-auxiliary-datasets');
    if (!container) return;
    if (force) container.innerHTML = '<div class="loading">正在重新发现辅助数据集...</div>';
    try {
        const data = await requestJSON('/api/v1/db/auxiliary');
        const datasets = Array.isArray(data.datasets) ? data.datasets : [];
        auxiliaryDatasetsCache = datasets;
        container.innerHTML = datasets.map(dataset => `
            <button class="database-business-card is-${escapeHtml(dataset.status || 'missing')}" type="button"
                data-dataset="${escapeHtml(dataset.id || '')}"
                data-on-click="loadAuxiliaryDatasetFromElement">
                <div class="database-business-card-head">
                    <div><strong>${escapeHtml(dataset.label || dataset.id || '')}</strong><span>${escapeHtml(dataset.description || '')}</span></div>
                    <em>${dataset.status === 'ready' ? '可查询' : dataset.status === 'missing_table' ? '缺少数据表' : '缺少文件'}</em>
                </div>
                <div class="database-business-capabilities">
                    <code>${escapeHtml(dataset.group || '')}</code><code>${escapeHtml(dataset.table || '')}</code>
                </div>
                <small class="database-auxiliary-path" title="${escapeHtml(dataset.path || '')}">${escapeHtml(dataset.path || dataset.file || '')}</small>
            </button>`).join('') || '<div class="empty-state"><strong>暂无辅助数据集</strong></div>';
    } catch (error) {
        container.innerHTML = `<div class="empty-state is-error"><strong>辅助数据集加载失败</strong><span>${escapeHtml(error.message)}</span></div>`;
    }
}

function formatAuxiliaryCell(value) {
    if (value == null) return '';
    if (typeof value === 'object') {
        try { return JSON.stringify(value); } catch (_) { return String(value); }
    }
    return String(value);
}

async function loadAuxiliaryDataset(dataset, offset = 0) {
    const box = document.getElementById('db-auxiliary-result');
    if (!box || !dataset) return;
    currentAuxiliaryDataset = dataset;
    currentAuxiliaryOffset = Math.max(0, Number(offset || 0));
    const previousQuery = document.getElementById('db-auxiliary-query')?.value || '';
    box.classList.remove('hidden');
    box.innerHTML = '<div class="loading">正在读取语义数据...</div>';
    try {
        const params = new URLSearchParams({ limit: '50', offset: String(currentAuxiliaryOffset) });
        if (previousQuery.trim()) params.set('query', previousQuery.trim());
        const data = await requestJSON(`/api/v1/db/auxiliary/${encodeURIComponent(dataset)}?${params.toString()}`);
        const items = Array.isArray(data.items) ? data.items : [];
        const columns = items.length ? Object.keys(items[0]) : [];
        const source = data.source || auxiliaryDatasetsCache.find(item => item.id === dataset) || {};
        const status = data.status || 'missing';
        const total = Number(data.total || 0);
        box.innerHTML = `
            <div class="result-header database-auxiliary-header">
                <div><strong>${escapeHtml(data.label || source.label || dataset)}</strong><span>${items.length} / ${total.toLocaleString('zh-CN')} 条 · ${escapeHtml(source.group || '')}/${escapeHtml(source.table || '')}</span></div>
                ${source.file || source.path ? `<button class="btn btn-secondary btn-sm" type="button"
                    data-group="${escapeHtml(encodeURIComponent(source.group || ''))}"
                    data-file="${escapeHtml(encodeURIComponent(source.file || source.path || ''))}"
                    data-on-click="openDBViewerFromElement">打开来源数据库</button>` : ''}
            </div>
            <div class="database-auxiliary-toolbar">
                <input id="db-auxiliary-query" type="search" value="${escapeHtml(previousQuery)}" placeholder="筛选当前语义数据"
                    data-on-keydown="searchCurrentAuxiliaryDataset" data-action-key="Enter">
                <button class="btn btn-secondary btn-sm" type="button" data-on-click="searchCurrentAuxiliaryDataset">搜索</button>
            </div>
            ${status !== 'ready' ? `<div class="runtime-list-empty"><strong>数据源尚未就绪</strong><span>${escapeHtml(data.reason || source.reason || '数据库文件或数据表尚未发现')}</span></div>` :
            items.length ? `<div class="table-scroll"><table>
                <thead><tr>${columns.map(column => `<th>${escapeHtml(column)}</th>`).join('')}</tr></thead>
                <tbody>${items.map(item => `<tr>${columns.map(column => `<td title="${escapeHtml(formatAuxiliaryCell(item[column]))}">${escapeHtml(formatAuxiliaryCell(item[column]))}</td>`).join('')}</tr>`).join('')}</tbody>
            </table></div>` : '<div class="runtime-list-empty">当前数据集为空</div>'}
            ${status === 'ready' ? `<div class="pagination database-auxiliary-pagination">
                <button class="btn btn-secondary btn-sm" type="button" ${currentAuxiliaryOffset === 0 ? 'disabled' : ''} data-on-click="previousAuxiliaryPage">上一页</button>
                <span>第 ${Math.floor(currentAuxiliaryOffset / 50) + 1} 页</span>
                <button class="btn btn-secondary btn-sm" type="button" ${data.has_more ? '' : 'disabled'} data-on-click="nextAuxiliaryPage">下一页</button>
            </div>` : ''}`;
        box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (error) {
        box.innerHTML = `<div class="text-danger">读取失败: ${escapeHtml(error.message)}</div>`;
    }
}

function renderDatabaseSummary(groupCount = new Set(currentDBFiles.map(item => item.group)).size) {
    const summary = document.getElementById('db-list-summary');
    if (!summary) return;
    const ready = currentDBFiles.filter(item => item.ok).length;
    summary.innerHTML = `
        <span class="summary-chip"><strong>${currentDBFiles.length}</strong> 个数据库</span>
        <span class="summary-chip is-success"><strong>${ready}</strong> 个可查询</span>
        <span class="summary-chip"><strong>${groupCount}</strong> 个业务分组</span>`;
}

function filterDatabaseCards() {
    const input = document.getElementById('db-list-filter');
    const query = (input ? input.value : '').trim().toLowerCase();
    let visible = 0;
    document.querySelectorAll('.db-group').forEach(group => {
        let groupVisible = 0;
        group.querySelectorAll('.db-file-card').forEach(card => {
            const matches = !query || (card.dataset.dbSearch || '').includes(query);
            card.classList.toggle('hidden', !matches);
            if (matches) { groupVisible++; visible++; }
        });
        group.classList.toggle('hidden', groupVisible === 0);
    });
    const summary = document.getElementById('db-list-summary');
    if (summary && query) {
        summary.innerHTML = `<span class="summary-chip"><strong>${visible}</strong> / ${currentDBFiles.length} 个匹配</span>`;
    } else if (summary) {
        renderDatabaseSummary();
    }
}

async function runGlobalSearch() {
    const keyword = document.getElementById('global-search-keyword').value.trim();
    const limit = normalizedIntegerInput('global-search-limit', 100, 1, 500);
    if (limit === null) return;
    const mode = document.getElementById('global-search-mode').value || 'quick';
    const match = document.getElementById('global-search-match').value || 'phrase';
    const sortMode = document.getElementById('global-search-sort').value || 'relevance';
    const group = document.getElementById('global-search-group').value.trim();
    const file = document.getElementById('global-search-file').value.trim();
    const offset = normalizedIntegerInput('global-search-offset', 0, 0, 5000);
    if (offset === null) return;
    const box = document.getElementById('global-search-result');

    if (!keyword) {
        showToast('请输入搜索关键词', 'warning');
        return;
    }

    globalSearchKeyword = keyword;
    box.classList.remove('hidden');
    box.innerHTML = '<div class="loading">搜索中...</div>';

    try {
        const params = new URLSearchParams();
        params.append('keyword', keyword);
        params.append('limit', limit);
        params.append('mode', mode);
        params.append('match', match);
        params.append('sort', sortMode);
        params.append('offset', offset);
        if (group) params.append('group', group);
        if (file) params.append('file', file);
        const url = `/api/v1/db/search?${params.toString()}`;
        const data = await requestJSON(url);
        renderGlobalSearchResult(url, data);
    } catch (e) {
        box.innerHTML = `<div class="text-danger">搜索失败: ${escapeHtml(e.message)}</div>`;
    }
}

async function loadSearchConsistency() {
    const container = document.getElementById('global-search-consistency');
    if (!container) return;
    container.innerHTML = '<span class="summary-chip">正在检查搜索水位与解析覆盖率...</span>';
    try {
        const data = await requestJSON('/api/v1/db/search/consistency');
        const checks = Array.isArray(data.checks) ? data.checks : [];
        container.innerHTML = checks.map(check => `
            <span class="summary-chip ${check.status === 'pass' ? 'is-success' : check.status === 'fail' ? 'is-error' : ''}"
                title="${escapeHtml(check.detail || '')}">
                <strong>${escapeHtml(check.id || '')}</strong> ${escapeHtml(check.status || '')}
            </span>`).join('');
    } catch (error) {
        container.innerHTML = `<span class="summary-chip is-error">一致性检查失败：${escapeHtml(error.message)}</span>`;
    }
}

function renderGlobalSearchResult(url, data) {
    const box = document.getElementById('global-search-result');
    const items = Array.isArray(data.items) ? data.items : [];
    const stats = data.stats || {};
    const statsSummary = `${Number(stats.duration_ms || 0).toFixed(1)} ms · ${Number(stats.files_scanned || 0)} 个文件 · ${Number(stats.tables_scanned || 0)} 张表 · 路径 ${stats.path || 'direct'}`;

    if (items.length === 0) {
        box.innerHTML = `
            <div class="result-header">
                <span class="url-display">${url}</span>
            </div>
            <div class="text-gray">未找到匹配结果。${escapeHtml(statsSummary)}</div>
        `;
        return;
    }

    let rows = '';
    items.forEach((item, index) => {
        const rowId = item.row_id === null || item.row_id === undefined ? '-' : escapeHtml(item.row_id);
        const previewRunes = Array.from(String(item.preview || ''));
        const ranges = Array.isArray(item.highlights) ? item.highlights.slice().sort((a, b) => Number(a.start || 0) - Number(b.start || 0)) : [];
        let preview = '';
        let previewCursor = 0;
        ranges.forEach(range => {
            const start = Math.max(previewCursor, Number(range.start || 0));
            const end = Math.max(start, Number(range.end || start));
            preview += escapeHtml(previewRunes.slice(previewCursor, start).join(''));
            preview += `<mark>${escapeHtml(previewRunes.slice(start, end).join(''))}</mark>`;
            previewCursor = end;
        });
        preview += escapeHtml(previewRunes.slice(previewCursor).join(''));
        const group = String(item.group || '');
        const file = String(item.file || '');
        const table = String(item.table || '');
        rows += `
            <tr>
                <td>${index + 1}</td>
                <td>${escapeHtml(group)}</td>
                <td class="cell-monospace">${escapeHtml(item.db_name || '')}</td>
                <td class="cell-monospace">${escapeHtml(table)}</td>
                <td class="cell-monospace">${escapeHtml(item.column || '')}</td>
                <td class="cell-monospace">${rowId}</td>
                <td class="global-search-preview">${preview}</td>
                <td>
                    <button class="btn btn-secondary btn-sm" data-on-click="openSearchResult" data-action-args="${encodeActionArgs(group, file, table)}">查看</button>
                </td>
            </tr>
        `;
    });

    box.innerHTML = `
        <div class="result-header">
            <span class="url-display">${url}</span>
            <button class="btn btn-secondary text-sm" data-on-click="copyText" data-action-args="${encodeActionArgs(url)}">复制URL</button>
        </div>
        <div class="global-search-summary">
            <strong>本页 ${items.length} 条命中 / 总候选 ${Number(data.total || items.length).toLocaleString('zh-CN')} / 模式：${escapeHtml(data.mode || 'quick')} · ${escapeHtml(data.match || 'phrase')} · ${escapeHtml(data.sort || 'relevance')}</strong>
            <span class="text-gray">${escapeHtml(statsSummary)}${stats.partial ? ' · 部分扫描结果' : ''}${stats.candidate_capped ? ' · 候选结果已达本页采样上限' : ''}</span>
            <span class="text-gray">${data.mode === 'deep' ? '深度模式会分批扫描行并尝试解码压缩/二进制消息内容，速度较慢但覆盖更全。' : '快速模式优先读取 FTS 内容影子表，再扫描普通业务表。'}</span>
        </div>
        <div class="table-scroll">
            <table id="global-search-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>数据库组</th>
                        <th>数据库文件</th>
                        <th>表</th>
                        <th>列</th>
                        <th>行</th>
                        <th>命中内容</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

async function openSearchResult(group, file, table) {
    await openDBViewer(encodeURIComponent(group), encodeURIComponent(file));
    await loadTableData(encodeURIComponent(table));
    if (globalSearchKeyword) {
        document.getElementById('data-search-input').value = globalSearchKeyword;
        currentKeyword = globalSearchKeyword;
        currentPage = 0;
        await fetchTableData();
    }
}

async function openDBViewer(groupEncoded, fileEncoded) {
    const group = decodeURIComponent(groupEncoded);
    const file = decodeURIComponent(fileEncoded);
    currentDB = { group, file };
    const basename = file.split(/[\\/]/).pop();
    document.getElementById('modal-title').textContent = basename;
    document.getElementById('modal-database-meta').textContent = `${databaseGroupLabel(group)[0]} · ${file}`;
    document.getElementById('db-viewer-modal').classList.remove('hidden');
    document.body.classList.add('modal-open');

    // Reset state
    switchModalView('browser');
    backToTableList();
    currentTables = [];
    document.getElementById('table-list-filter').value = '';
    document.getElementById('sql-input').value = '';
    document.getElementById('sql-result-table').querySelector('thead').innerHTML = '';
    document.getElementById('sql-result-table').querySelector('tbody').innerHTML = '';
    document.getElementById('sql-msg').textContent = '请执行查询以查看结果';
    document.getElementById('sql-msg').className = 'table-empty-state';

    // Load tables
    const listContainer = document.getElementById('table-list');
    listContainer.innerHTML = '<div class="loading">正在读取表结构...</div>';

    try {
        const tables = await requestJSON(`/api/v1/db/tables?group=${encodeURIComponent(group)}&file=${encodeURIComponent(file)}`);
        currentTables = Array.isArray(tables) ? tables.map(String) : [];
        renderTableCards(currentTables);
    } catch(e) {
        listContainer.innerHTML = `<div class="empty-state is-error"><strong>表结构加载失败</strong><span>${escapeHtml(e.message)}</span></div>`;
        document.getElementById('table-list-count').textContent = '无法读取表结构';
    }
}

function renderTableCards(tables) {
    const listContainer = document.getElementById('table-list');
    const count = document.getElementById('table-list-count');
    count.textContent = tables.length === currentTables.length
        ? `共 ${tables.length} 张可浏览表，选择后即可浏览数据`
        : `显示 ${tables.length} / ${currentTables.length} 张可浏览表`;
    if (!tables.length) {
        listContainer.innerHTML = '<div class="empty-state"><strong>没有匹配的数据表</strong><span>换一个关键词再试。</span></div>';
        return;
    }
    listContainer.innerHTML = tables.map(table => {
        const encodedTable = encodeURIComponent(table);
        return `<button class="db-table-item" type="button" data-table="${escapeHtml(encodedTable)}" data-on-click="loadTableDataFromElement">
            <span class="db-table-icon">▦</span>
            <span><strong>${escapeHtml(table)}</strong><small>打开并浏览数据</small></span>
            <i>›</i>
        </button>`;
    }).join('');
}

function filterTableCards() {
    const query = document.getElementById('table-list-filter').value.trim().toLowerCase();
    renderTableCards(currentTables.filter(table => table.toLowerCase().includes(query)));
}

function closeModal() {
    document.getElementById('db-viewer-modal').classList.add('hidden');
    document.body.classList.remove('modal-open');
    currentDB = { group: null, file: null };
    currentTable = null;
}

function backToTableList() {
    document.getElementById('table-list-view').classList.remove('hidden');
    document.getElementById('table-data-view').classList.add('hidden');
    currentTable = null;
    document.getElementById('table-list-filter').focus();
}

async function loadTableData(tableEncoded) {
    const table = decodeURIComponent(tableEncoded);
    currentTable = table;
    currentPage = 0;
    currentKeyword = '';
    document.getElementById('data-search-input').value = '';

    document.getElementById('table-list-view').classList.add('hidden');
    document.getElementById('table-data-view').classList.remove('hidden');
    document.getElementById('current-table-name').textContent = table;
    document.getElementById('current-table-meta').textContent = '正在加载...';

    await fetchTableData();
}

function performTableSearch() {
    const val = document.getElementById('data-search-input').value.trim();
    currentKeyword = val;
    currentPage = 0;
    fetchTableData();
}

async function fetchTableData() {
    if(!currentTable || !currentDB.file) return;

    const tbody = document.querySelector('#data-table tbody');
    const thead = document.querySelector('#data-table thead');
    const indicator = document.getElementById('browser-loading');

    indicator.classList.remove('hidden');
    tbody.innerHTML = '';

    const offset = currentPage * currentPageSize;

    try {
        let url = `/api/v1/db/data?group=${encodeURIComponent(currentDB.group)}&file=${encodeURIComponent(currentDB.file)}&table=${encodeURIComponent(currentTable)}&limit=${currentPageSize}&offset=${offset}`;
        if(currentKeyword) {
            url += `&keyword=${encodeURIComponent(currentKeyword)}`;
        }

        const data = await requestJSON(url);
        currentPageRowCount = Array.isArray(data) ? data.length : 0;
        renderTable(data, thead, tbody, currentPage);
        updateDBPagination();
    } catch(e) {
        currentPageRowCount = 0;
        thead.innerHTML = '';
        tbody.innerHTML = `<tr><td class="table-error-cell">数据读取失败：${escapeHtml(e.message)}</td></tr>`;
        updateDBPagination();
    } finally {
        indicator.classList.add('hidden');
    }
}

function renderTable(data, thead, tbody, page) {
    thead.innerHTML = '';
    if(data && data.length > 0) {
        const headers = Object.keys(data[0]);
        thead.innerHTML = `<tr>${headers.map(header => `<th>${escapeHtml(header)}</th>`).join('')}</tr>`;
        tbody.innerHTML = data.map(row => `<tr>${headers.map(header => {
            const raw = row[header];
            if (raw === null || raw === undefined) return '<td><span class="null-value">NULL</span></td>';
            let value;
            if (typeof raw === 'object') {
                try { value = JSON.stringify(raw); } catch (_) { value = String(raw); }
            } else {
                value = String(raw);
            }
            const preview = value.length > 240 ? `${value.slice(0, 240)}…` : value;
            const title = value.length > 240 ? ` title="${escapeHtml(value.slice(0, 1000))}"` : '';
            return `<td${title}>${escapeHtml(preview)}</td>`;
        }).join('')}</tr>`).join('');
    } else {
        tbody.innerHTML = `<tr><td class="table-empty-cell">${page === 0 ? '当前条件下暂无数据' : '已经到最后一页'}</td></tr>`;
    }
}

function updateDBPagination() {
    const start = currentPage * currentPageSize + (currentPageRowCount ? 1 : 0);
    const end = currentPage * currentPageSize + currentPageRowCount;
    document.getElementById('page-info').textContent = `第 ${currentPage + 1} 页`;
    document.getElementById('db-row-summary').textContent = currentPageRowCount
        ? `本页 ${currentPageRowCount} 行 · 第 ${start}–${end} 行${currentKeyword ? ` · 筛选“${currentKeyword}”` : ''}`
        : '本页没有数据';
    document.getElementById('current-table-meta').textContent = `${currentPageRowCount} 行 · ${currentPageSize} 行/页`;
    document.getElementById('db-prev-page').disabled = currentPage === 0;
    document.getElementById('db-next-page').disabled = currentPageRowCount < currentPageSize;
}

function changePageSize() {
    currentPageSize = Number.parseInt(document.getElementById('db-page-size').value, 10) || 50;
    currentPage = 0;
    fetchTableData();
}

function prevPage() {
    if(currentPage > 0) {
        currentPage--;
        fetchTableData();
    }
}

function nextPage() {
    if (currentPageRowCount < currentPageSize) return;
    currentPage++;
    fetchTableData();
}

function exportTableData(format) {
    if(!currentTable || !currentDB.file) return;
    let url = `/api/v1/db/data?group=${encodeURIComponent(currentDB.group)}&file=${encodeURIComponent(currentDB.file)}&table=${encodeURIComponent(currentTable)}&format=${encodeURIComponent(format)}`;
    if(currentKeyword) {
        url += `&keyword=${encodeURIComponent(currentKeyword)}`;
    }
    location.assign(url);
}

// --- SQL Console Logic ---
function setSQLTemplate(kind) {
    const input = document.getElementById('sql-input');
    if (kind === 'count' && currentTable) {
        input.value = `SELECT COUNT(*) AS total FROM "${currentTable.replaceAll('"', '""')}";`;
    } else {
        input.value = "SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') ORDER BY type, name LIMIT 200;";
    }
    input.focus();
}

async function runSQL() {
    const sql = document.getElementById('sql-input').value.trim();
    if(!sql) {
        showToast('请输入 SQL 语句', 'warning');
        return;
    }

    const tbody = document.querySelector('#sql-result-table tbody');
    const thead = document.querySelector('#sql-result-table thead');
    const msg = document.getElementById('sql-msg');

    tbody.innerHTML = '';
    thead.innerHTML = '';
    msg.textContent = '执行中...';
    msg.className = 'table-empty-state is-loading';

    try {
        const url = `/api/v1/db/query?group=${encodeURIComponent(currentDB.group)}&file=${encodeURIComponent(currentDB.file)}&sql=${encodeURIComponent(sql)}`;
        const data = await requestJSON(url);

        msg.className = 'table-empty-state hidden';
        renderTable(data, thead, tbody, 0);

        if(!data || data.length === 0) {
            msg.textContent = '执行成功，无结果返回';
            msg.className = 'table-empty-state';
        } else {
            showToast(`查询完成，共 ${data.length} 行`);
        }

    } catch(e) {
        msg.textContent = `执行错误: ${e.message}`;
        msg.className = 'table-empty-state is-error';
    }
}

function exportSQLResult(format) {
    const sql = document.getElementById('sql-input').value.trim();
    if(!sql) {
        showToast('请输入 SQL 语句', 'warning');
        return;
    }
     const url = `/api/v1/db/query?group=${encodeURIComponent(currentDB.group)}&file=${encodeURIComponent(currentDB.file)}&sql=${encodeURIComponent(sql)}&format=${encodeURIComponent(format)}`;
     location.assign(url);
}

async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast('已复制到剪贴板');
    } catch (_) {
        showToast('复制失败，请手动复制', 'error');
    }
}

function releaseResultDownload(type) {
    const stored = resultDownloadURLs.get(type);
    if (stored) URL.revokeObjectURL(stored.url);
    resultDownloadURLs.delete(type);
}

function resultFileExtension(format) {
    return format === 'json' ? 'json' : 'txt';
}

function resultFilename(type, format) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return `${type}_export_${timestamp}.${resultFileExtension(format)}`;
}

function downloadStoredResult(type) {
    const stored = resultDownloadURLs.get(type);
    if (!stored) return;
    const anchor = document.createElement('a');
    anchor.href = stored.url;
    anchor.download = stored.filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
}

async function renderQueryBlob(type, url, format, blob) {
    const resultArea = document.getElementById(`${type}-result`);
    releaseResultDownload(type);
    let parsedJSON = null;

    if (blob.size > maxInlineResultBytes) {
        const objectURL = URL.createObjectURL(blob);
        resultDownloadURLs.set(type, {
            url: objectURL,
            filename: resultFilename(type, format)
        });
        const sizeMiB = (blob.size / 1024 / 1024).toFixed(2);
        resultArea.innerHTML = `
            <div class="result-header">
                <span class="url-display">${escapeHtml(url)}</span>
                <button class="btn btn-primary text-sm" type="button" data-on-click="downloadStoredResult" data-action-args="${encodeActionArgs(type)}">下载原始结果</button>
            </div>
            <div class="large-result-notice">
                <strong>结果大小 ${sizeMiB} MiB，已跳过页面渲染。</strong>
                <span>完整数据仍然保留，可直接下载；避免把大文本写入 DOM 导致浏览器假死。</span>
            </div>`;
        return;
    }

    let text = await blob.text();
    if (format === 'json' && blob.size <= maxPrettyJSONBytes) {
        try {
            parsedJSON = JSON.parse(text);
            text = JSON.stringify(parsedJSON, null, 2);
        } catch (_) {
            // Preserve the server response if it is not valid JSON.
        }
    }
    resultArea.innerHTML = `
        <div class="result-header">
            <span class="url-display">${escapeHtml(url)}</span>
            <div class="result-actions">
                <button class="btn btn-secondary text-sm" type="button" data-on-click="copyResult" data-action-args="${encodeActionArgs(type)}">复制</button>
                <button class="btn btn-secondary text-sm" type="button" data-on-click="downloadResult" data-action-args="${encodeActionArgs(type, format)}">下载</button>
            </div>
        </div>`;
    const pre = document.createElement('pre');
    pre.id = `${type}-pre`;
    pre.textContent = text;
    resultArea.appendChild(pre);
    if (parsedJSON) enhanceStructuredResult(resultArea, parsedJSON, type, pre);
}

function changeChatlogPage(direction) {
    const offsetInput = document.getElementById('chatlog-offset');
    const limit = normalizedIntegerInput('chatlog-limit', 100, 1, 50000);
    const offset = normalizedIntegerInput('chatlog-offset', 0, 0);
    if (limit === null || offset === null) return;
    offsetInput.value = String(Math.max(0, Number(offset) + direction * Number(limit)));
    queryAPI('chatlog');
}

// --- Generic API Query ---
async function queryAPI(type) {
    const resultArea = document.getElementById(`${type}-result`);
    const previousController = activeQueryControllers.get(type);
    if (previousController) previousController.abort();
    const controller = new AbortController();
    activeQueryControllers.set(type, controller);
    releaseResultDownload(type);
    resultArea.classList.remove('hidden');
    resultArea.innerHTML = '<div class="loading">正在处理...</div>';

    try {
        let params = new URLSearchParams();
        let format = 'json';

		                if (type === 'session') {
		                    const kw = document.getElementById('session-keyword').value.trim();
                const limit = normalizedIntegerInput('session-limit', 20, 1, 500);
                if (limit === null) {
                    resultArea.classList.add('hidden');
                    return;
                }
	                    if(kw) params.append('keyword', kw);
                if(limit) params.append('limit', limit);
		                } else if (type === 'chatroom') {
		                    const kw = document.getElementById('chatroom-keyword').value.trim();
	                    const limit = normalizedIntegerInput('chatroom-limit', 500, 1);
                const offset = normalizedIntegerInput('chatroom-offset', 0, 0);
                if (limit === null || offset === null) {
                    resultArea.classList.add('hidden');
                    return;
                }
	                    if(kw) params.append('keyword', kw);
	                    if(limit) params.append('limit', limit);
                if(offset) params.append('offset', offset);
		                } else if (type === 'contact') {
		                    const kw = document.getElementById('contact-keyword').value.trim();
	                    const isFriend = document.getElementById('contact-is-friend').value;
	                    const limit = normalizedIntegerInput('contact-limit', 500, 1);
                const offset = normalizedIntegerInput('contact-offset', 0, 0);
                if (limit === null || offset === null) {
                    resultArea.classList.add('hidden');
                    return;
                }
	                    if(kw) params.append('keyword', kw);
	                    if(isFriend !== '') params.append('is_friend', isFriend);
	                    if(limit) params.append('limit', limit);
                if(offset) params.append('offset', offset);
		                } else if (type === 'chatlog') {
	                    const time = document.getElementById('chatlog-time').value.trim();
	                    const talker = document.getElementById('chatlog-talker').value.trim();
            if(!talker) {
                showToast('聊天对象是必填项', 'warning');
                resultArea.classList.add('hidden');
                return;
            }
            if(time) params.append('time', time);
            params.append('chat', talker);

	                    const sender = document.getElementById('chatlog-sender').value.trim();
            if(sender) params.append('sender', sender);

	                    const kw = document.getElementById('chatlog-keyword').value.trim();
            if(kw) params.append('keyword', kw);

            const limit = normalizedIntegerInput('chatlog-limit', 100, 1, 50000);
            if (limit === null) {
                resultArea.classList.add('hidden');
                return;
            }
            if(limit) params.append('limit', limit);
            const offset = normalizedIntegerInput('chatlog-offset', 0, 0);
            if (offset === null) {
                resultArea.classList.add('hidden');
                return;
            }
            if(offset) params.append('offset', offset);

	                    const msgType = document.getElementById('chatlog-msg-type').value;
	                    if(msgType) params.append('msg_type', msgType);
	                    const subType = document.getElementById('chatlog-sub-type').value.trim();
	                    if(subType) params.append('sub_type', subType);
	                    const hour = document.getElementById('chatlog-hour').value;
	                    if(hour !== '') params.append('hour', hour);
	                    const isSelf = document.getElementById('chatlog-is-self').value;
	                    if(isSelf !== '') params.append('is_self', isSelf);
	                    const hasMedia = document.getElementById('chatlog-has-media').value;
	                    if(hasMedia !== '') params.append('has_media', hasMedia);

	                }

        let endpoint = `/api/v1/${type}`;
        if (type === 'chatlog') {
            endpoint = '/api/v1/history';
        } else if (type === 'session') {
            endpoint = '/api/v1/sessions';
            if (params.has('keyword')) {
                params.set('query', params.get('keyword'));
                params.delete('keyword');
            }
        } else if (type === 'contact') {
            endpoint = '/api/v1/contacts';
            if (params.has('keyword')) {
                params.set('query', params.get('keyword'));
                params.delete('keyword');
            }
        } else if (type === 'chatroom') {
            endpoint = '/api/v1/chatrooms';
            if (params.has('keyword')) {
                params.set('query', params.get('keyword'));
                params.delete('keyword');
            }
        }
        const url = `${endpoint}?${params.toString()}`;

        const blob = await requestBlob(url, { signal: controller.signal });
        await renderQueryBlob(type, url, format, blob);
    } catch (e) {
        if (activeQueryControllers.get(type) === controller && (!e || e.name !== 'AbortError')) {
            resultArea.innerHTML = `<div class="text-danger">请求错误: ${escapeHtml(e.message)}</div>`;
        }
    } finally {
        if (activeQueryControllers.get(type) === controller) activeQueryControllers.delete(type);
    }
}

function downloadResult(type, format) {
    if (resultDownloadURLs.has(type)) {
        downloadStoredResult(type);
        return;
    }
    const pre = document.getElementById(`${type}-pre`);
    if (!pre) return;
    const text = pre.innerText;
    let mimeType = 'text/plain';
    let ext = resultFileExtension(format);

    if (format === 'json') {
        mimeType = 'application/json';
    }

    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    // Filename: type_timestamp.ext
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.download = `${type}_export_${timestamp}.${ext}`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function copyResult(type) {
    const pre = document.getElementById(`${type}-pre`);
    if (!pre) return;
    copyText(pre.innerText);
}

function disposeDatabase() {
    activeQueryControllers.forEach(controller => controller.abort());
    resultDownloadURLs.forEach(item => URL.revokeObjectURL(item.url));
    resultDownloadURLs.clear();
}

const databaseActions = {
    ...createActionHandlers({
        backToTableList,
        changeChatlogPage,
        changePageSize,
        closeModal,
        copyResult,
        copyText,
        downloadResult,
        downloadStoredResult,
        exportSQLResult,
        exportTableData,
        filterDatabaseCards,
        filterTableCards,
        loadDBList,
        loadSearchConsistency,
        nextPage,
        openSearchResult,
        performTableSearch,
        prevPage,
        queryAPI,
        runGlobalSearch,
        runSQL,
        setSQLTemplate,
    }),
    openDBViewerFromElement: ({ element }) => openDBViewer(element.dataset.group, element.dataset.file),
    showDatabaseBusinessModuleFromElement: ({ element }) => showDatabaseBusinessModule(element.dataset.module),
    loadAuxiliaryDatasetFromElement: ({ element }) => loadAuxiliaryDataset(element.dataset.dataset, 0),
    searchCurrentAuxiliaryDataset: () => loadAuxiliaryDataset(currentAuxiliaryDataset, 0),
    previousAuxiliaryPage: () => loadAuxiliaryDataset(currentAuxiliaryDataset, Math.max(0, currentAuxiliaryOffset - 50)),
    nextAuxiliaryPage: () => loadAuxiliaryDataset(currentAuxiliaryDataset, currentAuxiliaryOffset + 50),
    loadTableDataFromElement: ({ element }) => loadTableData(element.dataset.table),
};

export { closeModal, databaseActions, disposeDatabase, loadDBList, runSQL };
