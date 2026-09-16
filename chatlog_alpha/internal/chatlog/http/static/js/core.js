'use strict';

import { disposeAnalytics, loadDashboardAnalytics } from './analytics.js';
import { closeModal, disposeDatabase, loadDBList, runSQL } from './database.js';
import { initializeWorkspace, ocrCenterCloseDetail } from './features.js';
import { loadHookPanel, syncHookFormState } from './hooks.js';
import {
    disposeRuntime,
    loadRuntimeCacheDetails,
    loadRuntimeDashboard,
    loadRuntimeLogs,
    startRuntimeEventStream,
    syncRuntimeDashboardPolling,
} from './runtime.js';
import { initializeControlUI, loadControlWorkspace, refreshControlHeader } from './settings.js';
import { configureTabNavigation } from './navigation.js';
import { request } from './api.js';

const initializedTabs = new Set();
const tabInitializationPromises = new Map();

function initializeTab(tabId) {
    if (!tabId || initializedTabs.has(tabId)) return Promise.resolve();
    if (tabInitializationPromises.has(tabId)) return tabInitializationPromises.get(tabId);
    const task = (async () => {
        if (tabId === 'dashboard') {
            await Promise.all([loadRuntimeDashboard(), loadRuntimeLogs(), loadRuntimeCacheDetails()]);
        } else if (tabId === 'analytics') {
            await loadDashboardAnalytics();
        } else if (tabId === 'database') {
            await loadDBList();
        } else if (tabId === 'hook') {
            syncHookFormState();
            await loadHookPanel();
        } else if (tabId === 'settings') {
            await loadControlWorkspace({ forceForm: true });
        } else {
            await initializeWorkspace(tabId);
        }
        initializedTabs.add(tabId);
    })().catch((error) => {
        console.error(`initializeTab(${tabId}) failed:`, error);
        return null;
    }).finally(() => tabInitializationPromises.delete(tabId));
    tabInitializationPromises.set(tabId, task);
    return task;
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const activeTab = document.querySelector('.tab-content.active');
        initializeTab(activeTab ? activeTab.id : 'dashboard');
    }, 0);
    startRuntimeEventStream();
    syncRuntimeDashboardPolling();
    const sqlInput = document.getElementById('sql-input');
    if (sqlInput) {
        sqlInput.addEventListener('keydown', event => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault();
                runSQL();
            }
        });
    }
});

document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
        if (!document.getElementById('ocr-detail-modal').classList.contains('hidden')) {
            ocrCenterCloseDetail();
        } else if (!document.getElementById('db-viewer-modal').classList.contains('hidden')) {
            closeModal();
        }
    }
});

document.addEventListener('visibilitychange', () => syncRuntimeDashboardPolling());

addEventListener('beforeunload', () => {
    disposeAnalytics();
    disposeRuntime();
    disposeDatabase();
});

// Tab Switching for Main Page
function switchTab(tabId) {
    const target = document.getElementById(tabId);
    if (!target || !target.classList.contains('tab-content')) return;
    document.querySelectorAll('.tab-btn').forEach(btn => {
        const selected = btn.dataset.tab === tabId;
        btn.classList.toggle('active', selected);
        btn.setAttribute('aria-selected', String(selected));
        btn.setAttribute('tabindex', selected ? '0' : '-1');
    });
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    target.classList.add('active');
    syncRuntimeDashboardPolling(tabId);
    initializeTab(tabId);
}

configureTabNavigation(switchTab);

(() => {
    const storageKey = 'chatlog.console.activeTab';
    const statusRefreshMs = 15000;

    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }

    function tabButtons() {
        return Array.from(document.querySelectorAll('.tab-btn'));
    }

    function tabID(button) {
        return String(button?.dataset?.tab || '');
    }

    function availableTab(tab) {
        return Boolean(tab && document.getElementById(tab) && tabButtons().some((button) => tabID(button) === tab));
    }

    function rememberTab(tab) {
        if (!availableTab(tab)) return;
        try {
            localStorage.setItem(storageKey, tab);
        } catch (_) {
            // Storage may be disabled; navigation still works normally.
        }
        syncTabAccessibility(tab);
    }

    function syncTabAccessibility(activeTab) {
        tabButtons().forEach((button) => {
            const selected = tabID(button) === activeTab;
            button.setAttribute('role', 'tab');
            button.setAttribute('aria-selected', String(selected));
            button.setAttribute('tabindex', selected ? '0' : '-1');
        });
    }

    async function refreshServiceStatus() {
        const badge = document.getElementById('service-status');
        if (!badge) return;
        try {
            await request('/health', { timeoutMs: 3500 });
            badge.classList.remove('offline');
            badge.classList.add('online');
            badge.textContent = '服务正常';
            badge.title = `最近检查：${new Date().toLocaleTimeString()}`;
        } catch (_) {
            badge.classList.remove('online');
            badge.classList.add('offline');
            badge.textContent = '连接中断';
            badge.title = '无法连接本地 Chatlog 服务';
        }
    }

    function openGlobalSearch() {
        switchTab('global-search');
        rememberTab('global-search');
        setTimeout(() => document.getElementById('global-search-keyword')?.focus(), 0);
    }

    document.addEventListener('DOMContentLoaded', () => {
        const requestedHashTab = decodeURIComponent(location.hash.replace(/^#/, ''));
        if (location.hash) {
            history.replaceState(null, '', `${location.pathname}${location.search}`);
        }
        const tabs = document.querySelector('.tabs');
        tabs?.setAttribute('role', 'tablist');
        tabs?.setAttribute('aria-label', '控制台功能导航');

        tabButtons().forEach((button) => {
            const tab = tabID(button);
            button.setAttribute('aria-controls', tab);
            button.addEventListener('click', () => {
                const selectedTab = tabID(button);
                switchTab(selectedTab);
                rememberTab(selectedTab);
                scrollTo({ top: 0, behavior: 'smooth' });
            });
            button.addEventListener('keydown', (event) => {
                if (event.key !== 'ArrowDown' && event.key !== 'ArrowRight' && event.key !== 'ArrowUp' && event.key !== 'ArrowLeft') return;
                event.preventDefault();
                const buttons = tabButtons();
                const direction = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1;
                const next = buttons[(buttons.indexOf(button) + direction + buttons.length) % buttons.length];
                next.focus();
                next.click();
            });
        });

        let saved = requestedHashTab;
        if (!availableTab(saved)) {
            try {
                saved = localStorage.getItem(storageKey) || '';
            } catch (_) {
                saved = '';
            }
        }
        if (availableTab(saved)) {
            switchTab(saved);
        } else {
            saved = tabID(document.querySelector('.tab-btn.active')) || 'dashboard';
        }
        rememberTab(saved);
        scrollTo(0, 0);

        document.addEventListener('keydown', (event) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                openGlobalSearch();
            } else if ((event.metaKey || event.ctrlKey) && event.key === ',') {
                event.preventDefault();
                switchTab('settings');
                rememberTab('settings');
            }
        });

        initializeControlUI();
        refreshServiceStatus();
        setInterval(refreshServiceStatus, statusRefreshMs);
        setInterval(() => {
            if (!document.hidden) refreshControlHeader({ silent: true }).catch(() => {});
        }, statusRefreshMs);
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                refreshServiceStatus();
                refreshControlHeader({ silent: true }).catch(() => {});
            }
        });
    });

    addEventListener('load', () => scrollTo(0, 0), { once: true });
})();
