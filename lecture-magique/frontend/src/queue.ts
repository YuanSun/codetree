// Lookup events: kept in memory, mirrored to localStorage, sent in batches in the background.
// The log feeds phase 2 (FSRS replay), so an event is only dropped once the server has stored it
// (accepted or duplicate) or refused it as invalid (rejected). Network errors retry with backoff.
import { api, ApiError, LookupEvent } from "./api";

const KEY = "lm.pendingLookups";
const MAX_BATCH = 200;

// crypto.randomUUID() only exists in secure contexts (https); the site runs on http on the LAN.
export function uuid4(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function load(): LookupEvent[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

class LookupQueue {
  private pending: LookupEvent[] = load();
  private sending = false;
  private timer: number | undefined;
  private backoff = 2000;

  push(e: LookupEvent) {
    this.pending.push(e);
    this.save();
    this.schedule(this.pending.length >= 10 ? 0 : 1500);
  }

  size() {
    return this.pending.length;
  }

  private save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.pending));
    } catch {
      /* private mode / quota: the in-memory copy still gets sent */
    }
  }

  private schedule(ms: number) {
    if (this.timer !== undefined) return;
    this.timer = window.setTimeout(() => {
      this.timer = undefined;
      void this.flush();
    }, ms);
  }

  /** Send everything now. Resolves when the queue is empty or a send failed. */
  async flush(): Promise<boolean> {
    if (this.sending) return false;
    if (!this.pending.length) return true;
    this.sending = true;
    try {
      while (this.pending.length) {
        const batch = this.pending.slice(0, MAX_BATCH);
        const r = await api.lookups(batch);
        const done = new Set([...r.accepted, ...r.duplicate, ...r.rejected]);
        this.pending = this.pending.filter((e) => !done.has(e.id));
        this.save();
      }
      this.backoff = 2000;
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return false; // wait for login; keep events
      this.backoff = Math.min(this.backoff * 2, 60000);
      this.schedule(this.backoff);
      return false;
    } finally {
      this.sending = false;
    }
  }

  /** Last chance when the page is being hidden or closed. */
  beacon() {
    if (!this.pending.length) return;
    void api.lookups(this.pending.slice(0, MAX_BATCH), true).then(
      (r) => {
        const done = new Set([...r.accepted, ...r.duplicate, ...r.rejected]);
        this.pending = this.pending.filter((e) => !done.has(e.id));
        this.save();
      },
      () => undefined,
    );
  }
}

export const lookupQueue = new LookupQueue();

window.addEventListener("online", () => void lookupQueue.flush());
window.addEventListener("pagehide", () => lookupQueue.beacon());
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") lookupQueue.beacon();
});
// Events left over from a previous visit (closed tab, lost Wi-Fi) go out at startup.
window.setTimeout(() => void lookupQueue.flush(), 500);
