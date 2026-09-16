'use strict';


import { encodeActionArgs, escapeHtml, finiteNumber, showToast } from './ui.js';
import { createActionHandlers } from './events.js';
import { createMessageBubble } from './features.js';
import { request, requestJSON } from './api.js';

let hookEventsCache = [];
const hookSelectedEventIDs = new Set();
let hookDirectoryContacts = [];
let hookDirectoryChatrooms = [];
let hermesWeixinEditable = false;
let hermesQQEditable = false;

async function loadHookPanel() {
    await loadHookConfig();
    await loadHookRuleSuggestions();
    await Promise.all([loadHermesWeixinConfig(), loadHermesQQConfig()]);
    await Promise.all([loadHookStatus(), loadHookEvents()]);
}

function splitHookKeywordInput(raw) {
    return Array.from(new Set(String(raw || '').replaceAll('|', '｜').split('｜').map(item => item.trim()).filter(Boolean)));
}

function splitHookTargetInput(raw) {
    return Array.from(new Set(String(raw || '').split(/[,，;；|\n\r]+/).map(item => item.trim()).filter(Boolean)));
}

function renderHookRuleChips(containerID, items, emptyText, warning = '') {
    const container = document.getElementById(containerID);
    if (!container) return;
    if (!items.length) {
        container.innerHTML = `<span class="hook-rule-empty">${escapeHtml(emptyText)}</span>`;
        return;
    }
    container.innerHTML = `${items.map(item => `<span class="hook-rule-chip">${escapeHtml(item)}</span>`).join('')}${warning ? `<span class="hook-rule-warning">${escapeHtml(warning)}</span>` : ''}`;
}

function renderHookRulePreview() {
    const keywordRaw = document.getElementById('hook-keywords')?.value || '';
    const keywords = splitHookKeywordInput(keywordRaw);
    const suspicious = !/[|｜]/.test(keywordRaw) && /[,，;；\n\r]/.test(keywordRaw);
    renderHookRuleChips(
        'hook-keywords-preview',
        keywords,
        '尚未配置关键词',
        suspicious ? '当前被视为 1 个完整关键词；拆分请使用 ｜' : '',
    );
    renderHookRuleChips('hook-contacts-preview', splitHookTargetInput(document.getElementById('hook-forward-contacts')?.value), '不限联系人');
    renderHookRuleChips('hook-chatrooms-preview', splitHookTargetInput(document.getElementById('hook-forward-chatrooms')?.value), '不限群聊');
    const mode = document.getElementById('hook-keyword-mode')?.value || 'text';
    const help = document.getElementById('hook-keyword-mode-help');
    if (help) help.textContent = mode === 'image_ocr'
        ? '只对生效时间后的新增图片进行 OCR 匹配；关键词规则只推送命中的图片。'
        : mode === 'mixed'
            ? '同时匹配生效时间后的新增文字消息和新增图片 OCR 内容；图片仍仅在 OCR 命中时推送。'
            : '只在生效时间后的新增文字消息中匹配关键词。';
}

async function loadHookRuleSuggestions() {
    if (hookDirectoryContacts.length || hookDirectoryChatrooms.length) return;
    try {
        const [contactsResponse, chatroomsResponse] = await Promise.all([
            requestJSON('/api/v1/contacts?limit=1000&offset=0&is_friend=true'),
            requestJSON('/api/v1/chatrooms?limit=1000&offset=0'),
        ]);
        hookDirectoryContacts = (Array.isArray(contactsResponse.contacts) ? contactsResponse.contacts : [])
            .filter(item => !String(item?.username || '').toLowerCase().endsWith('@chatroom'))
            .map(item => ({
                id: String(item.username || '').trim(),
                name: String(item.display || item.remark || item.nickname || item.username || '').trim(),
                search: `${item.display || ''} ${item.remark || ''} ${item.nickname || ''} ${item.username || ''}`.toLowerCase(),
            })).filter(item => item.id);
        hookDirectoryChatrooms = (Array.isArray(chatroomsResponse.chatrooms) ? chatroomsResponse.chatrooms : [])
            .map(item => ({
                id: String(item.name || '').trim(),
                name: String(item.display || item.remark || item.nickname || item.name || '').trim(),
                search: `${item.display || ''} ${item.remark || ''} ${item.nickname || ''} ${item.name || ''}`.toLowerCase(),
            })).filter(item => item.id);
    } catch (error) {
        console.warn('hook rule suggestions unavailable', error);
    }
}

function hookRuleInputChanged(type) {
    renderHookRulePreview();
    const contacts = type === 'contact';
    const input = document.getElementById(contacts ? 'hook-forward-contacts' : 'hook-forward-chatrooms');
    const panel = document.getElementById(contacts ? 'hook-contact-suggestions' : 'hook-chatroom-suggestions');
    if (!input || !panel) return;
    const match = String(input.value || '').match(/^(.*[,，;；|\n\r]\s*)?([^,，;；|\n\r]*)$/s);
    const prefix = match?.[1] || '';
    const query = String(match?.[2] || '').trim().toLowerCase();
    const source = contacts ? hookDirectoryContacts : hookDirectoryChatrooms;
    const selected = new Set(splitHookTargetInput(input.value).map(item => item.toLowerCase()));
    const options = source.filter(item => !selected.has(item.id.toLowerCase()) && (!query || item.search.includes(query))).slice(0, 8);
    panel.replaceChildren();
    if (!options.length) {
        panel.classList.add('hidden');
        return;
    }
    options.forEach(item => {
        const button = document.createElement('button');
        button.type = 'button';
        button.innerHTML = `<strong>${escapeHtml(item.name || item.id)}</strong><small>${escapeHtml(item.id)}</small>`;
        button.addEventListener('mousedown', event => {
            event.preventDefault();
            input.value = `${prefix}${item.id}, `;
            panel.classList.add('hidden');
            input.focus();
            renderHookRulePreview();
        });
        panel.appendChild(button);
    });
    panel.classList.remove('hidden');
}

async function loadHookConfig() {
    try {
        const data = await requestJSON('/api/v1/hook/config');
        document.getElementById('hook-keywords').value = data.keywords || '';
        document.getElementById('hook-keyword-mode').value = ['text', 'image_ocr', 'mixed'].includes(data.keyword_mode)
            ? data.keyword_mode
            : 'text';
        document.getElementById('hook-forward-all').checked = !!data.forward_all;
        document.getElementById('hook-forward-contacts').value = data.forward_contacts || '';
        document.getElementById('hook-forward-chatrooms').value = data.forward_chatrooms || '';
        applyHookNotifyMode(data.notify_mode || 'post');
        document.getElementById('hook-post-url').value = data.post_url || '';
        document.getElementById('hook-before-count').value = Number.isInteger(data.before_count) ? data.before_count : 5;
        document.getElementById('hook-after-count').value = Number.isInteger(data.after_count) ? data.after_count : 5;
        syncHookFormState();
    } catch (e) {
        const box = document.getElementById('hook-status');
        box.innerHTML = `<div class="text-danger">加载配置失败: ${escapeHtml(e.message)}</div>`;
    }
}

async function saveHookConfig() {
    syncHookFormState();
    renderHookRulePreview();
    const beforeCount = parseHookNonNegative(document.getElementById('hook-before-count').value);
    const afterCount = parseHookNonNegative(document.getElementById('hook-after-count').value);
    if (beforeCount === null) {
        alert('前文条数必须是非负整数');
        return;
    }
    if (afterCount === null) {
        alert('后文条数必须是非负整数');
        return;
    }
    const notifyMode = collectHookNotifyMode();
    const postURL = document.getElementById('hook-post-url').value.trim();
    const hasForwardRule = document.getElementById('hook-forward-all').checked
        || document.getElementById('hook-keywords').value.trim()
        || document.getElementById('hook-forward-contacts').value.trim()
        || document.getElementById('hook-forward-chatrooms').value.trim();
    if (postURL && !isAbsoluteHTTPURL(postURL)) {
        alert('POST Webhook 必须是完整的 http:// 或 https:// 地址');
        return;
    }
    if ((notifyMode === 'post' || notifyMode === 'all' || notifyMode.split(',').includes('post')) && hasForwardRule && !postURL) {
        alert('启用 HTTP POST 转发时必须填写 Webhook 地址');
        return;
    }
    const payload = {
        keywords: document.getElementById('hook-forward-all').checked ? '' : document.getElementById('hook-keywords').value.trim(),
        keyword_mode: document.getElementById('hook-keyword-mode').value || 'text',
        forward_all: document.getElementById('hook-forward-all').checked,
        forward_contacts: document.getElementById('hook-forward-all').checked ? '' : document.getElementById('hook-forward-contacts').value.trim(),
        forward_chatrooms: document.getElementById('hook-forward-all').checked ? '' : document.getElementById('hook-forward-chatrooms').value.trim(),
        notify_mode: notifyMode,
        post_url: postURL,
        before_count: beforeCount,
        after_count: afterCount
    };
    try {
        await request('/api/v1/hook/config', {
            method: 'POST',
            json: payload,
        });
        await loadHookPanel();
        alert('关键词推送配置已保存');
    } catch (e) {
        alert(`保存失败: ${e.message}`);
    }
}

function parseHookNonNegative(raw) {
    const normalized = String(raw || '').trim();
    if (normalized === '') return 0;
    if (!/^\d+$/.test(normalized)) return null;
    const value = Number(normalized);
    if (!Number.isSafeInteger(value)) return null;
    return value;
}

function isAbsoluteHTTPURL(raw) {
    try {
        const parsed = new URL(String(raw || '').trim());
        return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && !!parsed.host && !parsed.username && !parsed.password;
    } catch (_) {
        return false;
    }
}

function applyHookNotifyMode(mode) {
    const normalized = String(mode || 'post').toLowerCase();
    document.getElementById('hook-target-post').checked = normalized.includes('post') || normalized === 'all';
    document.getElementById('hook-target-weixin').checked = normalized.includes('weixin') || normalized === 'all';
    document.getElementById('hook-target-qq').checked = normalized.includes('qq') || normalized === 'all';
}

function collectHookNotifyMode() {
    const parts = [];
    if (document.getElementById('hook-target-post').checked) parts.push('post');
    if (document.getElementById('hook-target-weixin').checked) parts.push('weixin');
    if (document.getElementById('hook-target-qq').checked) parts.push('qq');
    if (parts.length === 3) return 'all';
    return parts.length ? parts.join(',') : 'post';
}

function setHermesWeixinEditable(enabled, reason = '') {
    hermesWeixinEditable = !!enabled;
    [
        'hook-weixin-home-channel',
        'hook-weixin-home-channel-name',
        'hook-weixin-account-id',
        'hook-weixin-token',
        'hook-weixin-base-url',
        'hook-weixin-cdn-base-url',
        'hook-save-hermes-btn'
    ].forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.disabled = !hermesWeixinEditable;
        if (!hermesWeixinEditable && reason) {
            el.title = reason;
        } else {
            el.removeAttribute('title');
        }
    });
}

function setHermesQQEditable(enabled, reason = '') {
    hermesQQEditable = !!enabled;
    [
        'hook-qq-home-channel',
        'hook-qq-home-channel-name',
        'hook-qq-app-id',
        'hook-qq-client-secret',
        'hook-save-hermes-qq-btn'
    ].forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.disabled = !hermesQQEditable;
        if (!hermesQQEditable && reason) {
            el.title = reason;
        } else {
            el.removeAttribute('title');
        }
    });
}

function syncHookFormState() {
    const forwardAll = !!document.getElementById('hook-forward-all').checked;
    const postTarget = document.getElementById('hook-target-post');
    const weixinTarget = document.getElementById('hook-target-weixin');
    const qqTarget = document.getElementById('hook-target-qq');
    if (!postTarget.checked && !weixinTarget.checked && !qqTarget.checked) {
        // notify_mode has no "none" value, so an empty selection uses POST mode.
        postTarget.checked = true;
    }
    const postEnabled = !!postTarget.checked;
    const weixinEnabled = !!weixinTarget.checked;
    const qqEnabled = !!qqTarget.checked;
    ['hook-keywords', 'hook-keyword-mode', 'hook-forward-contacts', 'hook-forward-chatrooms', 'hook-before-count', 'hook-after-count'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.disabled = forwardAll;
    });
    if (forwardAll) {
        document.getElementById('hook-keywords').value = '';
        document.getElementById('hook-forward-contacts').value = '';
        document.getElementById('hook-forward-chatrooms').value = '';
    }
    renderHookRulePreview();
    document.getElementById('hook-post-url').disabled = !postEnabled;
    const saveBtn = document.getElementById('hook-save-hermes-btn');
    if (saveBtn) {
        saveBtn.disabled = !weixinEnabled || !hermesWeixinEditable;
    }
    const qqSaveBtn = document.getElementById('hook-save-hermes-qq-btn');
    if (qqSaveBtn) {
        qqSaveBtn.disabled = !qqEnabled || !hermesQQEditable;
    }
}

async function loadHermesWeixinConfig() {
    try {
        const data = await requestJSON('/api/v1/hook/hermes/weixin');
        document.getElementById('hook-hermes-home').value = data.hermes_home || '';
        document.getElementById('hook-weixin-home-channel').value = data.home_channel || '';
        document.getElementById('hook-weixin-home-channel-name').value = data.home_channel_name || '';
        document.getElementById('hook-weixin-account-id').value = data.account_id || '';
        document.getElementById('hook-weixin-token').value = '';
        document.getElementById('hook-weixin-token').placeholder = data.has_token ? '已保存；留空保持不变' : '尚未保存 token';
        document.getElementById('hook-weixin-base-url').value = data.base_url || '';
        document.getElementById('hook-weixin-cdn-base-url').value = data.cdn_base_url || '';
        setHermesWeixinEditable(!!data.editable, data.error || '无法读取 Hermes Weixin 配置');
        syncHookFormState();
    } catch (e) {
        setHermesWeixinEditable(false, e.message);
        const box = document.getElementById('hook-status');
        if (box && !box.innerHTML) {
            box.innerHTML = `<div class="text-danger">加载 Hermes 微信配置失败: ${escapeHtml(e.message)}</div>`;
        }
    }
}

async function loadHermesQQConfig() {
    try {
        const data = await requestJSON('/api/v1/hook/hermes/qq');
        document.getElementById('hook-hermes-home').value = data.hermes_home || document.getElementById('hook-hermes-home').value || '';
        document.getElementById('hook-qq-home-channel').value = data.home_channel || '';
        document.getElementById('hook-qq-home-channel-name').value = data.home_channel_name || '';
        document.getElementById('hook-qq-app-id').value = data.app_id || '';
        document.getElementById('hook-qq-client-secret').value = '';
        document.getElementById('hook-qq-client-secret').placeholder = data.has_client_secret ? '已保存；留空保持不变' : '尚未保存 secret';
        setHermesQQEditable(!!data.editable, data.error || '无法读取 Hermes QQ 配置');
        syncHookFormState();
    } catch (e) {
        setHermesQQEditable(false, e.message);
    }
}

async function saveHermesWeixinConfig() {
    if (!hermesWeixinEditable) {
        alert('当前无法读取 Hermes Weixin 配置，已禁止编辑');
        return;
    }
    const payload = {
        hermes_home: document.getElementById('hook-hermes-home').value.trim(),
        home_channel: document.getElementById('hook-weixin-home-channel').value.trim(),
        home_channel_name: document.getElementById('hook-weixin-home-channel-name').value.trim(),
        account_id: document.getElementById('hook-weixin-account-id').value.trim(),
        token: document.getElementById('hook-weixin-token').value.trim(),
        base_url: document.getElementById('hook-weixin-base-url').value.trim(),
        cdn_base_url: document.getElementById('hook-weixin-cdn-base-url').value.trim()
    };
    if (payload.base_url && !isAbsoluteHTTPURL(payload.base_url)) {
        alert('Weixin Base URL 必须是完整的 http:// 或 https:// 地址');
        return;
    }
    if (payload.cdn_base_url && !isAbsoluteHTTPURL(payload.cdn_base_url)) {
        alert('Weixin CDN Base URL 必须是完整的 http:// 或 https:// 地址');
        return;
    }
    try {
        const data = await requestJSON('/api/v1/hook/hermes/weixin', {
            method: 'POST',
            json: payload,
        });
        document.getElementById('hook-hermes-home').value = data.hermes_home || payload.hermes_home || '';
        document.getElementById('hook-weixin-token').value = '';
        document.getElementById('hook-weixin-token').placeholder = data.has_token ? '已保存；留空保持不变' : '尚未保存 token';
        setHermesWeixinEditable(!!data.editable, data.error || '');
        syncHookFormState();
        await loadHookStatus();
        alert('Hermes 微信配置已保存');
    } catch (e) {
        alert(`保存 Hermes 微信配置失败: ${e.message}`);
    }
}

async function saveHermesQQConfig() {
    if (!hermesQQEditable) {
        alert('当前无法读取 Hermes QQ 配置，已禁止编辑');
        return;
    }
    const payload = {
        hermes_home: document.getElementById('hook-hermes-home').value.trim(),
        home_channel: document.getElementById('hook-qq-home-channel').value.trim(),
        home_channel_name: document.getElementById('hook-qq-home-channel-name').value.trim(),
        app_id: document.getElementById('hook-qq-app-id').value.trim(),
        client_secret: document.getElementById('hook-qq-client-secret').value.trim()
    };
    try {
        const data = await requestJSON('/api/v1/hook/hermes/qq', {
            method: 'POST',
            json: payload,
        });
        document.getElementById('hook-hermes-home').value = data.hermes_home || payload.hermes_home || '';
        setHermesQQEditable(!!data.editable, data.error || '');
        syncHookFormState();
        await loadHookStatus();
        alert('Hermes QQ 配置已保存');
    } catch (e) {
        alert(`保存 Hermes QQ 配置失败: ${e.message}`);
    }
}

function renderHookStatus(data) {
    const box = document.getElementById('hook-status');
    const wx = data.weixin || {};
        const qq = data.qq || {};
        const channels = [];
        const notifyMode = String(data.notify_mode || '').toLowerCase();
        if (notifyMode === 'all' || notifyMode.split(',').includes('post')) channels.push('POST');
        if (wx.enabled) channels.push('微信');
        if (qq.enabled) channels.push('QQ');
        const health = data.running ? ['运行中', 'is-ok'] : ['未运行', 'is-error'];
        const keywordRules = Number(data.keywords_count || 0);
        const contactRules = Array.isArray(data.forward_contacts) ? data.forward_contacts.length : 0;
        const chatroomRules = Array.isArray(data.forward_chatrooms) ? data.forward_chatrooms.length : 0;
        const ruleCount = keywordRules + contactRules + chatroomRules;
        const allMode = data.forward_all ? '全部消息' : (ruleCount > 0 ? `${ruleCount} 条规则` : '未启用');
        const keywordModeLabel = data.keyword_mode === 'image_ocr'
            ? '图片 OCR'
            : data.keyword_mode === 'mixed' ? '混合：文字 + 图片 OCR' : '文字消息';
        const effectiveLabel = finiteNumber(data.effective_at) > 0
            ? new Date(finiteNumber(data.effective_at) * 1000).toLocaleString('zh-CN', { hour12: false })
            : '等待规则首次生效';
        const ruleHint = (data.forward_all
            ? '不应用联系人与群聊筛选'
            : `关键词 ${keywordRules}（${keywordModeLabel}）· 联系人 ${contactRules} · 群聊 ${chatroomRules}`) + ` · ${effectiveLabel}`;
        const lastEvent = data.last_event_at ? formatHookTime(data.last_event_at) : '暂无事件';
        const pending = Number(data.pending_deliveries || 0);
        const failed = Number(data.failed_deliveries || 0);
        const pipelineState = failed > 0 ? 'is-error' : (pending > 0 ? 'is-accent' : 'is-ok');
        const pipelineValue = failed > 0 ? `${failed} 个死信` : (pending > 0 ? `${pending} 个待投递` : '队列正常');
        const scanHint = data.last_scan_error
            ? `扫描异常：${data.last_scan_error}`
            : (data.last_scan_at
                ? `扫描 ${data.scanned_sessions || 0} 个会话 / ${data.scanned_messages || 0} 条消息，耗时 ${data.last_scan_duration_ms || 0} ms`
                : '等待首次增量扫描');
        box.innerHTML = [
            hookStatusCard('增量扫描', health[0], data.last_scan_error ? 'is-error' : health[1], scanHint),
            hookStatusCard('匹配模式', allMode, data.forward_all ? 'is-accent' : (ruleCount > 0 ? 'is-ok' : 'is-muted'), ruleHint),
            hookStatusCard('持久投递队列', pipelineValue, pipelineState, `${channels.join(' + ') || '未配置渠道'} · 累计 ${data.event_count || 0} 个事件`),
            hookStatusCard('最近事件', lastEvent, data.last_event_at ? '' : 'is-muted', `游标 ${data.cursor_count || 0} 个 · 上下文 前 ${data.before_count ?? 5} / 后 ${data.after_count ?? 5}`)
        ].join('');
        setHermesWeixinEditable(!!wx.editable, wx.error || '无法读取 Hermes Weixin 配置');
        setHermesQQEditable(!!qq.editable, qq.error || '无法读取 Hermes QQ 配置');
        syncHookFormState();
}

async function loadHookStatus(options = {}) {
    const box = document.getElementById('hook-status');
    try {
        const data = await requestJSON('/api/v1/hook/status');
        renderHookStatus(data);
    } catch (e) {
        if (!options.silent) {
            box.innerHTML = hookStatusCard('状态读取失败', e.message, 'is-error', '检查本地服务状态');
        }
        updateHookPollState('状态异常', true);
    }
}

function hookStatusCard(label, value, state = '', hint = '') {
    return `<article class="hook-status-card ${state}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(hint)}</small></article>`;
}

function formatHookTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value || '-');
    return date.toLocaleString('zh-CN', { hour12: false });
}

function updateHookPollState(label, isError = false) {
    const state = document.getElementById('hook-poll-state');
    if (!state) return;
    state.textContent = label;
    state.classList.toggle('is-error', !!isError);
}

function applyHookEvents(data) {
    hookEventsCache = Array.isArray(data.events) ? data.events : [];
        const visibleEventIDs = new Set(hookEventsCache.map(item => String(item.event_id || '').trim()).filter(Boolean));
        Array.from(hookSelectedEventIDs).forEach(eventID => {
            if (!visibleEventIDs.has(eventID)) hookSelectedEventIDs.delete(eventID);
        });
        renderHookEvents();
        updateHookPollState(`已刷新 ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`);
}

async function loadHookEvents(options = {}) {
    try {
        syncHookEventSelectionsFromDOM();
        const data = await requestJSON('/api/v1/hook/events?limit=50');
        applyHookEvents(data);
    } catch (e) {
        updateHookPollState('刷新失败', true);
        if (!options.silent) {
            const list = document.getElementById('hook-events-list');
            list.innerHTML = `<div class="hook-empty-state is-error">加载事件失败：${escapeHtml(e.message)}</div>`;
        }
    }
}

async function refreshHookPanel(showFeedback = false) {
    await loadHookPanel();
    if (showFeedback) showToast('推送配置和事件已刷新', 'success');
}

async function clearHookEvents() {
    if (!confirm('确定清空所有推送事件记录吗？')) return;
    try {
        await request('/api/v1/hook/events/clear', { method: 'POST' });
        hookEventsCache = [];
        hookSelectedEventIDs.clear();
        renderHookEvents();
        await loadHookStatus();
        showToast('事件记录已清空', 'success');
    } catch (e) {
        showToast(`清空失败：${e.message}`, 'error');
    }
}

async function hookEventDeliveryAction(eventID, target, action) {
    if (!eventID || !action) return;
    const actionLabel = action === 'cancel' ? '取消' : action === 'delete' ? '删除' : '重试';
    if (action === 'cancel' && !confirm(`确定取消 ${target || '全部渠道'} 的待投递任务吗？`)) return;
    if (action === 'delete' && !confirm(`确定永久删除 ${target || '全部渠道'} 的投递记录吗？删除后不再出现在队列中。`)) return;
    try {
        const data = await requestJSON(`/api/v1/hook/events/${encodeURIComponent(eventID)}/action`, {
            method: 'POST',
            json: { action, target: target || '' },
        });
        showToast(`${actionLabel}完成：更新 ${Number(data.affected || 0)} 个投递任务`, data.affected ? 'success' : 'warning');
        await Promise.all([loadHookEvents(), loadHookStatus()]);
    } catch (error) {
        showToast(`${actionLabel}操作失败：${error.message || String(error)}`, 'error');
    }
}

function setHookEventSelected(eventID, selected) {
    eventID = String(eventID || '').trim();
    if (!eventID) return;
    if (selected) hookSelectedEventIDs.add(eventID);
    else hookSelectedEventIDs.delete(eventID);
}

function syncHookEventSelectionsFromDOM() {
    document.querySelectorAll('.hook-event-select').forEach(input => {
        setHookEventSelected(input.value, input.checked);
    });
}

function selectedHookEventIDs() {
    syncHookEventSelectionsFromDOM();
    return Array.from(hookSelectedEventIDs);
}

function toggleAllHookEvents() {
    const inputs = Array.from(document.querySelectorAll('.hook-event-select'));
    const checked = !inputs.length || !inputs.every(input => input.checked);
    inputs.forEach(input => {
        input.checked = checked;
        setHookEventSelected(input.value, checked);
    });
}

async function batchHookEventAction(action) {
    const eventIDs = selectedHookEventIDs();
    if (!eventIDs.length) {
        showToast('请先选择推送记录', 'warning');
        return;
    }
    const actionLabel = action === 'delete' ? '删除' : '重试';
    if (!confirm(`确定批量${actionLabel}已选中的 ${eventIDs.length} 条推送记录吗？`)) return;
    try {
        const data = await requestJSON('/api/v1/hook/events/batch-action', {
            method: 'POST',
            json: { action, event_ids: eventIDs },
        });
        showToast(`批量${actionLabel}完成：处理 ${Number(data.events || eventIDs.length)} 条记录，更新 ${Number(data.affected || 0)} 个投递任务`, 'success');
        hookSelectedEventIDs.clear();
        await Promise.all([loadHookEvents(), loadHookStatus()]);
    } catch (error) {
        showToast(`批量${actionLabel}失败：${error.message || String(error)}`, 'error');
    }
}

function renderHookEvents() {
    const list = document.getElementById('hook-events-list');
    if (!hookEventsCache || hookEventsCache.length === 0) {
        list.innerHTML = '<div class="hook-empty-state">暂无推送事件。命中规则后会在这里显示投递结果。</div>';
        return;
    }
    const ruleTypeMap = {
        keyword: '关键词',
        forward_all: '全部转发',
        forward_contact: '联系人',
        forward_chatroom: '群聊'
    };
    list.innerHTML = hookEventsCache.map((evt, eventIndex) => {
        const deliveries = Array.isArray(evt.deliveries) ? evt.deliveries : [];
        const deliveryHTML = deliveries.length
            ? deliveries.map((item) => {
                const status = String(item.status || (item.success ? 'sent' : 'failed')).toLowerCase();
                const state = item.success || status === 'sent'
                    ? 'is-ok'
                    : (status === 'dead' || status === 'failed' ? 'is-error' : status === 'canceled' ? 'is-muted' : 'is-pending');
                const statusLabel = {
                    sent: '已发送',
                    pending: '待处理',
                    delivering: '投递中',
                    retry: '等待重试',
                    dead: '死信',
                    canceled: '已取消',
                    failed: '失败'
                }[status] || status;
                const details = [
                    item.detail || '',
                    Number(item.attempts || 0) > 0 ? `已尝试 ${Number(item.attempts)} 次` : '',
                    item.next_retry_at ? `下次 ${formatHookTime(item.next_retry_at)}` : ''
                ].filter(Boolean).join(' · ');
                const target = item.target || 'unknown';
                const canCancel = ['pending', 'retry', 'delivering'].includes(status);
                const canRetry = ['retry', 'dead', 'canceled', 'failed'].includes(status);
                return `<span class="hook-delivery-item">
                    <span class="hook-delivery-tag ${state}"${details ? ` title="${escapeHtml(details)}"` : ''}><b>${escapeHtml(target)}</b>${escapeHtml(statusLabel)}</span>
                    ${canRetry ? `<button class="btn btn-secondary btn-xs" type="button" data-on-click="hookEventDeliveryAction" data-action-args="${encodeActionArgs(evt.event_id || '', target, 'retry')}">重试</button>` : ''}
                    ${canCancel ? `<button class="btn btn-danger btn-xs" type="button" data-on-click="hookEventDeliveryAction" data-action-args="${encodeActionArgs(evt.event_id || '', target, 'cancel')}">取消</button>` : ''}
                    <button class="btn btn-danger btn-xs" type="button" data-on-click="hookEventDeliveryAction" data-action-args="${encodeActionArgs(evt.event_id || '', target, 'delete')}">删除</button>
                </span>`;
            }).join('')
            : '<span class="hook-delivery-tag is-muted">无投递结果</span>';
        const context = Array.isArray(evt.context) ? evt.context : [];
        const contextHTML = context.length
            ? context.map((item, contextIndex) => {
                const labels = { before: '前文', trigger: '命中', after: '后文' };
                return `<div class="hook-context-message ${item.position === 'trigger' ? 'is-trigger' : ''}">
                    <span class="hook-context-position">${escapeHtml(labels[item.position] || '上下文')}</span>
                    <div data-hook-context-event="${eventIndex}" data-hook-context-index="${contextIndex}"><p>${escapeHtml(item.content || '（无文本内容）')}</p></div>
                </div>`;
            }).join('')
            : '<div class="hook-context-empty">无上下文</div>';
        const matchedRules = Array.isArray(evt.matched_rules) && evt.matched_rules.length
            ? evt.matched_rules
            : [{ rule_type: evt.rule_type, rule_label: evt.rule_label, keyword: evt.keyword }];
        const ruleBadges = matchedRules.map((item) => {
            const type = ruleTypeMap[item.rule_type] || item.rule_type || '未知规则';
            const detail = item.keyword || item.rule_label || '';
            return `<span class="hook-rule-badge">${escapeHtml(detail ? `${type} · ${detail}` : type)}</span>`;
        }).join('');
        const talker = evt.talker_name || evt.talker || '未知会话';
        const sender = evt.sender_name || evt.sender || '未知发送者';
        return `<article class="hook-event-card">
            <header><div><label class="hook-event-select-label" title="选择此记录"><input class="hook-event-select" type="checkbox" value="${escapeHtml(evt.event_id || '')}" ${hookSelectedEventIDs.has(String(evt.event_id || '').trim()) ? 'checked' : ''} data-on-change="setHookEventSelectedFromElement"><span>选择</span></label><div class="hook-rule-badges">${ruleBadges}</div><h4>${escapeHtml(talker)}</h4></div><time>${escapeHtml(formatHookTime(evt.created_at || ''))}</time></header>
            <div class="hook-event-meta"><span>发送者 <strong>${escapeHtml(sender)}</strong></span>${evt.keyword ? `<span>命中 <strong>${escapeHtml(evt.keyword)}</strong></span>` : ''}</div>
            <div class="hook-trigger-preview" data-hook-event-index="${eventIndex}"><p class="hook-trigger-content">${escapeHtml(evt.trigger_content || '（无文本内容）')}</p></div>
            <div class="hook-deliveries">${deliveryHTML}</div>
            <details class="hook-event-context"><summary>查看上下文 (${context.length})</summary><div class="hook-context-chat">${contextHTML}</div></details>
        </article>`;
    }).join('');
    list.querySelectorAll('[data-hook-event-index]').forEach(container => {
            const evt = hookEventsCache[Number(container.dataset.hookEventIndex)];
            if (!evt) return;
            container.replaceChildren(createMessageBubble({
                type_num: evt.trigger_type,
                sub_type: evt.trigger_sub_type,
                content: evt.trigger_content,
                contents: evt.trigger_contents,
                is_self: evt.trigger_is_self,
                sender: evt.sender_name || evt.sender,
                sender_id: evt.sender,
                chat: evt.talker_name || evt.talker,
                time: evt.trigger_time,
                message_id: evt.trigger_seq
            }));
    });
    list.querySelectorAll('[data-hook-context-event]').forEach(container => {
            const evt = hookEventsCache[Number(container.dataset.hookContextEvent)];
            const item = evt?.context?.[Number(container.dataset.hookContextIndex)];
            if (!item) return;
            container.replaceChildren(createMessageBubble({
                type_num: item.type,
                sub_type: item.sub_type,
                content: item.content,
                contents: item.contents,
                is_self: item.is_self,
                sender: item.sender,
                chat: evt.talker_name || evt.talker,
                time: item.time,
                message_id: item.seq
            }));
    });
}

const hookActions = {
    ...createActionHandlers({
        batchHookEventAction,
        clearHookEvents,
        hookEventDeliveryAction,
        hookRuleInputChanged,
        loadHookEvents,
        refreshHookPanel,
        renderHookRulePreview,
        saveHermesQQConfig,
        saveHermesWeixinConfig,
        saveHookConfig,
        syncHookFormState,
        toggleAllHookEvents,
    }),
    setHookEventSelectedFromElement: ({ element }) => setHookEventSelected(element.value, element.checked),
};

export { applyHookEvents, hookActions, loadHookPanel, renderHookStatus, syncHookFormState, updateHookPollState };
