// State shared by the popup and the service worker: shared tabs, agent-opened
// tabs, the site allowlist and the activity log.
//
// Both contexts import this file, so every rule about what may be shared or
// allowlisted lives in one place.

export const ACTION_WINDOW_MS = 10 * 60 * 1000;
// actionsUntil value meaning "on until the user switches it off" (JSON cannot store Infinity).
export const NO_EXPIRY = Number.MAX_SAFE_INTEGER;

export function actionsUntilFor(noExpiry) {
  return noExpiry ? NO_EXPIRY : Date.now() + ACTION_WINDOW_MS;
}
export const MAX_AGENT_TABS = 5;
export const LOG_LIMIT = 100;

// Sign-in hosts that can never be allowlisted (decision D3). Exact origins.
export const DENYLIST = [
  'https://accounts.google.com',
  'https://login.microsoftonline.com',
  'https://appleid.apple.com',
];

export function originOf(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.origin : null;
  } catch {
    return null;
  }
}

// Checks that an origin may go on the allowlist: https only (D4), an exact
// origin with no path, and not on the denylist (D3).
export function checkAllowable(input) {
  let u;
  try {
    u = new URL(String(input));
  } catch {
    return { ok: false, error: 'Not a valid URL.' };
  }
  if (u.protocol !== 'https:') return { ok: false, error: 'Only https sites can be allowed.' };
  if (DENYLIST.includes(u.origin)) {
    return { ok: false, error: `${u.host} is a sign-in site and can never be allowed.` };
  }
  return { ok: true, origin: u.origin };
}

// ------------------------------------------------------------ list storage ----

// Read-modify-write on a storage key, one at a time per key so concurrent
// commands cannot overwrite each other's change.
const queues = new Map();
function updateKey(area, key, fn, fallback) {
  const qk = area + ':' + key;
  const run = (queues.get(qk) || Promise.resolve()).then(async () => {
    const got = await chrome.storage[area].get(key);
    const next = fn(key in got ? got[key] : fallback);
    await chrome.storage[area].set({ [key]: next });
    return next;
  });
  queues.set(qk, run.catch(() => {}));
  return run;
}

export async function getShared() {
  const { shared = [] } = await chrome.storage.session.get('shared');
  return shared;
}

export async function getAgentTabs() {
  const { agentTabs = [] } = await chrome.storage.session.get('agentTabs');
  return agentTabs;
}

export async function getAllowed() {
  const { allowedOrigins = [] } = await chrome.storage.local.get('allowedOrigins');
  return allowedOrigins;
}

export async function setBadge(tabId, text) {
  try {
    await chrome.action.setBadgeText({ tabId, text });
  } catch {
    // tab may be gone
  }
}

export async function addShared(tabId) {
  await updateKey('session', 'shared', (l) => (l.includes(tabId) ? l : [...l, tabId]), []);
  await setBadge(tabId, 'ON');
  await refreshBadges();
}

export async function removeShared(tabId) {
  await updateKey('session', 'shared', (l) => l.filter((id) => id !== tabId), []);
  await updateKey('session', 'agentTabs', (l) => l.filter((id) => id !== tabId), []);
}

export async function addAgentTab(tabId) {
  await updateKey('session', 'agentTabs', (l) => (l.includes(tabId) ? l : [...l, tabId]), []);
}

// Badge is red while actions are on, green otherwise.
export async function refreshBadges() {
  const { actionsUntil = 0 } = await chrome.storage.session.get('actionsUntil');
  const color = Date.now() < actionsUntil ? '#cf222e' : '#1a7f37';
  for (const tabId of await getShared()) {
    try {
      await chrome.action.setBadgeBackgroundColor({ tabId, color });
    } catch {
      // tab may be gone, or the API is unavailable
    }
  }
}

async function tabOrigin(tabId) {
  try {
    return originOf((await chrome.tabs.get(tabId)).url || '');
  } catch {
    return null;
  }
}

async function removePermission(origin) {
  try {
    await chrome.permissions.remove({ origins: [origin + '/*'] });
  } catch {
    // nothing to remove
  }
}

// Stops sharing one tab. The site permission goes too, unless the site is
// allowlisted or another shared tab still uses it.
export async function unshareTab(tabId) {
  const origin = await tabOrigin(tabId);
  await removeShared(tabId);
  await setBadge(tabId, '');
  if (!origin || (await getAllowed()).includes(origin)) return;
  for (const id of await getShared()) {
    if ((await tabOrigin(id)) === origin) return;
  }
  await removePermission(origin);
}

// ---------------------------------------------------------------- allowlist ----

export async function allowOrigin(input) {
  const chk = checkAllowable(input);
  if (!chk.ok) return chk;
  await updateKey('local', 'allowedOrigins', (l) => (l.includes(chk.origin) ? l : [...l, chk.origin]), []);
  return chk;
}

// Removing a site unshares its tabs, closes the tabs the agent opened there,
// and drops Chrome's permission for it.
export async function removeOrigin(origin) {
  await updateKey('local', 'allowedOrigins', (l) => l.filter((o) => o !== origin), []);
  const agent = await getAgentTabs();
  for (const id of await getShared()) {
    if ((await tabOrigin(id)) !== origin) continue;
    const wasAgent = agent.includes(id);
    await removeShared(id);
    await setBadge(id, '');
    if (wasAgent) {
      try {
        await chrome.tabs.remove(id);
      } catch {
        // already closed
      }
    }
  }
  await removePermission(origin);
}

// Stop sharing everything, close agent-opened tabs, switch actions off.
// Allowlisted sites keep their permission, everything else loses it.
export async function stopAll() {
  const agent = await getAgentTabs();
  for (const id of await getShared()) await setBadge(id, '');
  await chrome.storage.session.set({ shared: [], agentTabs: [], actionsUntil: 0 });
  for (const id of agent) {
    try {
      await chrome.tabs.remove(id);
    } catch {
      // already closed
    }
  }
  const keep = new Set((await getAllowed()).map((o) => o + '/*'));
  const perms = await chrome.permissions.getAll();
  const drop = (perms.origins || []).filter((o) => !keep.has(o));
  if (drop.length) {
    try {
      await chrome.permissions.remove({ origins: drop });
    } catch {
      // ignore
    }
  }
}

// ------------------------------------------------------------- activity log ----

// Records what was asked, never page content or typed text: method, tab,
// origin, time, and the outcome.
export async function logActivity({ method, tabId = null, origin = null, ok, error = null }) {
  const entry = {
    t: Date.now(),
    method: String(method),
    tabId: tabId == null ? null : Number(tabId),
    origin: origin || null,
    ok: !!ok,
    error: error ? String(error).slice(0, 200) : null,
  };
  await updateKey('session', 'activityLog', (l) => [...l, entry].slice(-LOG_LIMIT), []);
}

export async function getLog() {
  const { activityLog = [] } = await chrome.storage.session.get('activityLog');
  return activityLog;
}

export async function clearLog() {
  await chrome.storage.session.set({ activityLog: [] });
}
