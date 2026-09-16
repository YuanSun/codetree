'use strict';

import { showToast } from './ui.js';
import { navigateToTab } from './navigation.js';
import { requestJSON } from './api.js';

let controlSnapshot = null;
let controlAccounts = [];
let controlFormDirty = false;
let controlRefreshPromise = null;
let controlActiveAction = '';
const controlJobTimers = new Map();
const controlJobStoragePrefix = 'chatlog.control.job.';

function controlElement(id) {
    return document.getElementById(id);
}

function setControlText(id, value, title = '') {
    const element = controlElement(id);
    if (!element) return;
    element.textContent = String(value ?? '');
    if (title) element.title = title;
    else element.removeAttribute('title');
}

function controlNotify(message, kind = 'success') {
    if (typeof showToast === 'function') {
        showToast(message, kind);
        return;
    }
    setControlText('control-page-state', message);
}

function controlDatabaseLabel(snapshot) {
    if (snapshot?.database_ready) return '数据库就绪';
    if (snapshot?.database_error) return '数据库待处理';
    return '数据库准备中';
}

function renderControlHeader(snapshot) {
    const account = String(snapshot?.account || '').trim();
    const version = String(snapshot?.full_version || '').trim();
    setControlText('control-header-account', account || '尚未选择账号');
    setControlText(
        'control-header-detail',
        account
            ? [snapshot.pid ? `PID ${snapshot.pid}` : '已保存账号', version].filter(Boolean).join(' · ')
            : '打开系统设置完成初始化'
    );
    const database = controlElement('control-header-database');
    if (database) {
        database.textContent = snapshot?.database_ready ? 'DB 就绪' : snapshot?.database_error ? 'DB 待处理' : 'DB 准备中';
        database.className = `control-database-state ${snapshot?.database_ready ? 'is-ready' : snapshot?.database_error ? 'is-error' : 'is-loading'}`;
        database.title = snapshot?.database_error || controlDatabaseLabel(snapshot);
    }
}

function renderControlKeyState(kind, present) {
    const prefix = kind === 'image-key' ? 'control-image-key' : 'control-database-key';
    const indicator = controlElement(`${prefix}-indicator`);
    const label = controlElement(`${prefix}-label`);
    if (indicator) {
        indicator.textContent = present ? '已配置' : '待配置';
        indicator.className = `control-key-indicator ${present ? 'is-present' : 'is-missing'}`;
    }
    if (label) label.textContent = present ? '密钥已安全保存' : '当前账号尚无密钥';
}

function populateControlConfig(snapshot, force = false) {
    if (controlFormDirty && !force) return;
    const values = {
        'control-data-dir': snapshot?.data_dir || '',
        'control-work-dir': snapshot?.work_dir || '',
        'control-http-addr': snapshot?.http_addr || '',
        'control-log-retention': snapshot?.log_retention_days || 7,
    };
    Object.entries(values).forEach(([id, value]) => {
        const input = controlElement(id);
        if (input) input.value = String(value);
    });
    controlFormDirty = false;
    setControlText('control-config-state', '没有待保存的修改。');
}

function renderControlSnapshot(snapshot, options = {}) {
    controlSnapshot = snapshot || {};
    renderControlHeader(controlSnapshot);

    const ready = Boolean(controlSnapshot.database_ready);
    const hasError = Boolean(controlSnapshot.database_error);
    const dot = controlElement('control-status-dot');
    if (dot) dot.className = `control-status-dot ${ready ? 'is-ready' : hasError ? 'is-error' : 'is-loading'}`;
    setControlText('control-status-title', ready ? '数据库与控制台运行正常' : hasError ? '控制台在线，数据库需要处理' : '控制台在线，数据库正在准备');
    setControlText(
        'control-status-subtitle',
        controlSnapshot.database_error || (ready ? '查询、媒体与自动化功能均可使用' : '控制平面保持在线，可继续完成账号配置')
    );
    setControlText('control-status-account', controlSnapshot.account || '未选择');
    setControlText('control-status-pid', controlSnapshot.pid ? `PID ${controlSnapshot.pid}` : '未连接运行进程');
    setControlText('control-status-version', controlSnapshot.full_version || controlSnapshot.version || '-');
    setControlText('control-status-http', controlSnapshot.http_addr || '-');
    renderControlKeyState('image-key', Boolean(controlSnapshot.image_key_present));
    renderControlKeyState('database-key', Boolean(controlSnapshot.data_key_present));

    const restart = controlElement('control-config-restart');
    restart?.classList.toggle('hidden', !controlSnapshot.restart_required);
    populateControlConfig(controlSnapshot, Boolean(options.forceForm));
    setControlText('control-page-state', ready ? '运行正常' : hasError ? '需要配置' : '正在准备');
}

function controlAccountDisplay(account) {
    const name = String(account?.account || '未命名账号');
    const source = account?.source === 'process'
        ? `运行中${account.pid ? ` · PID ${account.pid}` : ''}`
        : '已保存';
    return `${name} — ${source}`;
}

function renderControlAccountDetail() {
    const select = controlElement('control-account-select');
    const account = controlAccounts[Number(select?.value)];
    if (!account) {
        setControlText('control-account-detail', controlAccounts.length ? '请选择一个账号。' : '未发现运行中或已保存的微信账号。');
        return;
    }
    const details = [
        account.source === 'process' ? '运行中进程' : '已保存配置',
        account.pid ? `PID ${account.pid}` : '',
        account.status || '',
        account.full_version || '',
        account.data_dir || '',
    ].filter(Boolean);
    setControlText('control-account-detail', details.join(' · '), account.data_dir || '');
}

function renderControlAccounts(accounts) {
    controlAccounts = Array.isArray(accounts) ? accounts : [];
    const select = controlElement('control-account-select');
    if (!select) return;
    select.replaceChildren();
    if (!controlAccounts.length) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = '未发现微信账号';
        select.appendChild(option);
        select.disabled = true;
        const apply = controlElement('control-account-apply');
        if (apply) apply.disabled = true;
        renderControlAccountDetail();
        return;
    }
    controlAccounts.forEach((account, index) => {
        const option = document.createElement('option');
        option.value = String(index);
        option.textContent = controlAccountDisplay(account);
        option.selected = Boolean(account.current);
        select.appendChild(option);
    });
    if (!controlAccounts.some(account => account.current)) select.selectedIndex = 0;
    select.disabled = false;
    const apply = controlElement('control-account-apply');
    if (apply) apply.disabled = false;
    renderControlAccountDetail();
}

async function refreshControlHeader(options = {}) {
    try {
        const payload = await requestJSON('/api/v1/control/status');
        renderControlSnapshot(payload.status || payload, { forceForm: Boolean(options.forceForm) });
        return controlSnapshot;
    } catch (error) {
        const database = controlElement('control-header-database');
        if (database) {
            database.textContent = 'DB 离线';
            database.className = 'control-database-state is-error';
        }
        if (!options.silent) controlNotify(error.message, 'error');
        throw error;
    }
}

async function loadControlWorkspace(options = {}) {
    if (controlRefreshPromise) return controlRefreshPromise;
    const refreshButton = controlElement('control-refresh-button');
    if (refreshButton) refreshButton.disabled = true;
    setControlText('control-page-state', '正在同步…');
    controlRefreshPromise = Promise.all([
        requestJSON('/api/v1/control/status'),
        requestJSON('/api/v1/control/accounts'),
    ]).then(([statusPayload, accountPayload]) => {
        renderControlSnapshot(statusPayload.status || statusPayload, { forceForm: Boolean(options.forceForm) });
        renderControlAccounts(accountPayload.accounts || []);
        return controlSnapshot;
    }).catch(error => {
        setControlText('control-page-state', '同步失败', error.message);
        controlNotify(error.message, 'error');
        throw error;
    }).finally(() => {
        controlRefreshPromise = null;
        if (refreshButton) refreshButton.disabled = false;
    });
    return controlRefreshPromise;
}

async function selectControlAccount() {
    const select = controlElement('control-account-select');
    const account = controlAccounts[Number(select?.value)];
    if (!account) {
        controlNotify('请选择可用账号', 'warning');
        return;
    }
    const button = controlElement('control-account-apply');
    if (button) {
        button.disabled = true;
        button.textContent = '正在切换…';
    }
    try {
        const selector = account.source === 'process' && Number(account.pid) > 0
            ? { pid: Number(account.pid) }
            : { account: String(account.account || '') };
        const payload = await requestJSON('/api/v1/control/account', {
            method: 'POST',
            json: selector,
        });
        controlFormDirty = false;
        renderControlSnapshot(payload.status || payload, { forceForm: true });
        await loadControlWorkspace({ forceForm: true });
        controlNotify(`已切换到 ${account.account}`, 'success');
    } catch (error) {
        controlNotify(error.message, 'error');
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = '切换账号';
        }
    }
}

function validateControlPath(input) {
    const value = String(input?.value || '').trim();
    input?.setCustomValidity('');
    if (value && !value.startsWith('/')) {
        input?.setCustomValidity('请输入以 / 开头的 macOS 绝对路径');
        input?.reportValidity();
        input?.focus();
        return false;
    }
    return true;
}

async function saveControlConfig(event) {
    event?.preventDefault();
    const form = controlElement('control-config-form');
    const dataDir = controlElement('control-data-dir');
    const workDir = controlElement('control-work-dir');
    const retention = controlElement('control-log-retention');
    if (!form?.reportValidity() || !validateControlPath(dataDir) || !validateControlPath(workDir)) return;
    const days = Number(retention?.value || 0);
    if (!Number.isInteger(days) || days < 1 || days > 365) {
        retention?.setCustomValidity('日志保留天数应为 1–365 的整数');
        retention?.reportValidity();
        return;
    }
    retention?.setCustomValidity('');

    const button = controlElement('control-config-save');
    if (button) {
        button.disabled = true;
        button.textContent = '正在保存…';
    }
    setControlText('control-config-state', '正在保存并应用配置…');
    try {
        const next = {
            data_dir: String(dataDir?.value || '').trim(),
            work_dir: String(workDir?.value || '').trim(),
            http_addr: String(controlElement('control-http-addr')?.value || '').trim(),
            log_retention_days: days,
        };
        const patch = {};
        if (next.data_dir !== String(controlSnapshot?.data_dir || '')) patch.data_dir = next.data_dir;
        if (next.work_dir !== String(controlSnapshot?.work_dir || '')) patch.work_dir = next.work_dir;
        if (next.http_addr !== String(controlSnapshot?.http_addr || '')) patch.http_addr = next.http_addr;
        if (next.log_retention_days !== Number(controlSnapshot?.log_retention_days || 0)) {
            patch.log_retention_days = next.log_retention_days;
        }
        if (!Object.keys(patch).length) {
            controlFormDirty = false;
            setControlText('control-config-state', '配置没有变化。');
            return;
        }
        const payload = await requestJSON('/api/v1/control/config', {
            method: 'PATCH',
            json: patch,
        });
        controlFormDirty = false;
        renderControlSnapshot(payload.status || payload, { forceForm: true });
        setControlText('control-config-state', '配置已保存。');
        controlNotify('系统设置已保存', 'success');
    } catch (error) {
        setControlText('control-config-state', `保存失败：${error.message}`, error.message);
        controlNotify(error.message, 'error');
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = '保存设置';
        }
    }
}

function controlJobElements(action) {
    const image = action === 'image-key';
    return {
        container: controlElement(image ? 'control-image-key-job' : 'control-database-key-job'),
        button: controlElement(image ? 'control-image-key-start' : 'control-database-key-start'),
    };
}

function controlJobStatusLabel(status) {
    return ({ queued: '等待执行', running: '正在执行', succeeded: '任务完成', failed: '任务失败' })[status] || '状态更新';
}

function syncControlActionButtons(activeStatus = '') {
    for (const action of ['image-key', 'database-key']) {
        const { button } = controlJobElements(action);
        if (!button) continue;
        button.disabled = Boolean(controlActiveAction);
        if (action === controlActiveAction) {
            button.textContent = activeStatus === 'queued' ? '等待执行…' : '提取中…';
        } else {
            button.textContent = action === 'image-key' ? '提取图片密钥' : '提取数据库密钥';
        }
    }
}

function renderControlJob(job) {
    if (!job?.action) return;
    const { container } = controlJobElements(job.action);
    const active = job.status === 'queued' || job.status === 'running';
    if (active) controlActiveAction = job.action;
    else if (controlActiveAction === job.action) controlActiveAction = '';
    if (container) {
        container.className = `control-job is-${job.status || 'idle'}`;
        container.replaceChildren();
        const title = document.createElement('strong');
        title.textContent = controlJobStatusLabel(job.status);
        const detail = document.createElement('span');
        detail.textContent = job.error || job.message || (active ? '等待系统返回进度…' : '任务状态已更新');
        container.append(title, detail);
        if (job.finished_at || job.started_at || job.created_at) {
            const time = document.createElement('time');
            const raw = job.finished_at || job.started_at || job.created_at;
            const date = new Date(raw);
            time.textContent = Number.isNaN(date.getTime()) ? '' : date.toLocaleString('zh-CN', { hour12: false });
            if (time.textContent) container.appendChild(time);
        }
    }
    syncControlActionButtons(job.status);
}

function storeControlJob(action, id) {
    try {
        if (id) sessionStorage.setItem(`${controlJobStoragePrefix}${action}`, id);
        else sessionStorage.removeItem(`${controlJobStoragePrefix}${action}`);
    } catch (_) {
        // Session persistence is optional; the running task remains server-owned.
    }
}

function scheduleControlJobPoll(action, id, delay = 900) {
    const existing = controlJobTimers.get(action);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => pollControlJob(action, id), delay);
    controlJobTimers.set(action, timer);
}

async function pollControlJob(action, id) {
    try {
        const payload = await requestJSON(`/api/v1/control/actions/${encodeURIComponent(id)}`);
        const job = payload.job || payload;
        renderControlJob(job);
        if (job.status === 'queued' || job.status === 'running') {
            scheduleControlJobPoll(action, id, 1000);
            return;
        }
        controlJobTimers.delete(action);
        storeControlJob(action, '');
        if (job.status === 'succeeded') {
            controlNotify(job.message || '密钥任务已完成', 'success');
            await loadControlWorkspace({ forceForm: true });
        } else {
            controlNotify(job.error || job.message || '密钥任务执行失败', 'error');
        }
    } catch (error) {
        if (error.status === 404) {
            controlJobTimers.delete(action);
            storeControlJob(action, '');
            renderControlJob({ action, status: 'failed', error: '任务记录已结束，请重新发起。' });
            return;
        }
        const { container } = controlJobElements(action);
        if (container) {
            const detail = container.querySelector('span');
            if (detail) detail.textContent = `状态连接中断，正在重试：${error.message}`;
        }
        scheduleControlJobPoll(action, id, 2200);
    }
}

async function startControlAction(action) {
    renderControlJob({ action, status: 'queued', message: '正在向本机提交任务…' });
    try {
        const payload = await requestJSON('/api/v1/control/actions', {
            method: 'POST',
            json: { action },
        });
        const job = payload.job || payload;
        renderControlJob(job);
        storeControlJob(action, job.id);
        scheduleControlJobPoll(action, job.id, 500);
        controlNotify(action === 'image-key' ? '图片密钥任务已开始' : '数据库密钥任务已开始', 'success');
    } catch (error) {
        renderControlJob({ action, status: 'failed', error: error.message });
        controlNotify(error.message, 'error');
    }
}

function restoreControlJobs() {
    for (const action of ['image-key', 'database-key']) {
        try {
            const id = sessionStorage.getItem(`${controlJobStoragePrefix}${action}`);
            if (id) scheduleControlJobPoll(action, id, 0);
        } catch (_) {
            return;
        }
    }
}

function initializeControlUI() {
    const settingsButton = controlElement('control-summary-button');
    settingsButton?.addEventListener('click', () => {
        navigateToTab('settings');
        try { localStorage.setItem('chatlog.console.activeTab', 'settings'); } catch (_) { /* optional */ }
    });
    controlElement('control-refresh-button')?.addEventListener('click', () => loadControlWorkspace({ forceForm: !controlFormDirty }));
    controlElement('control-account-select')?.addEventListener('change', renderControlAccountDetail);
    controlElement('control-account-apply')?.addEventListener('click', selectControlAccount);
    controlElement('control-config-form')?.addEventListener('submit', saveControlConfig);
    controlElement('control-config-reset')?.addEventListener('click', () => {
        controlFormDirty = false;
        if (controlSnapshot) populateControlConfig(controlSnapshot, true);
    });
    controlElement('control-config-form')?.addEventListener('input', () => {
        controlFormDirty = true;
        setControlText('control-config-state', '有尚未保存的修改。');
    });
    controlElement('control-image-key-start')?.addEventListener('click', () => startControlAction('image-key'));
    controlElement('control-database-key-start')?.addEventListener('click', () => startControlAction('database-key'));
    restoreControlJobs();
    refreshControlHeader({ silent: true }).catch(() => {});
}

export { initializeControlUI, loadControlWorkspace, refreshControlHeader };
