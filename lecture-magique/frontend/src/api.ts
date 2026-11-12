// Thin JSON client for the FastAPI backend (same origin, cookie session).

export type Me = { id: number; username: string; display_name: string; role: string; settings: Record<string, unknown> };

export type ArticleCard = {
  id: number;
  slug: string;
  title: string;
  week_of: string;
  status: "draft" | "published" | "archived";
  source_note: string | null;
  chapter_count: number;
  progress: null | { last_chapter: number; chapters_done: number[]; seconds_read: number; finished: boolean };
};

// [token_id, char_start, char_end, lemma_id, sense_id]
export type TokenTuple = [number, number, number, number | null, number | null];

export type Lemma = { lemma: string; pos: string; gender: string | null; ipa: string | null; senses: number[] };
export type Sense = { key: string | null; def: string | null; ex: string[] };
export type WordState = { status: string; familiarity: number; lookups: number; exposures: number };

export type ChapterData = {
  article: { id: number; slug: string; title: string; status: string };
  chapter: { id: number; seq: number; title: string | null };
  chapters: { seq: number; title: string | null }[];
  paragraphs: { id: number; seq: number; text: string; tokens: TokenTuple[] }[];
  lemmas: Record<string, Lemma>;
  senses: Record<string, Sense>;
  words: Record<string, WordState>;
  question: string | null;
  progress: null | { last_chapter: number; last_paragraph: number; chapters_done: number[] };
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown, keepalive = false): Promise<T> {
  // Relative URL ("api/..."): resolves to /api/... on port 8090 and to /lecture/api/... behind the gateway.
  const res = await fetch(`api${path}`, {
    method,
    credentials: "same-origin",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    keepalive,
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      msg = (await res.json()).detail ?? msg;
    } catch {
      /* not JSON */
    }
    if (res.status === 401) window.dispatchEvent(new Event("lm:unauthorized"));
    throw new ApiError(res.status, typeof msg === "string" ? msg : "Erreur");
  }
  return res.json() as Promise<T>;
}

export const api = {
  me: () => call<Me>("GET", "/me"),
  login: (username: string, password: string) => call<Me>("POST", "/auth/login", { username, password }),
  logout: () => call<{ ok: boolean }>("POST", "/auth/logout"),
  articles: () => call<ArticleCard[]>("GET", "/articles"),
  chapter: (articleId: number, seq: number) => call<ChapterData>("GET", `/articles/${articleId}/chapters/${seq}`),
  progress: (articleId: number, chapter: number, paragraph: number, seconds: number, keepalive = false) =>
    call("PUT", `/progress/${articleId}`, { chapter, paragraph, seconds }, keepalive),
  complete: (chapterId: number, openedAt: string) =>
    call<{ next_seq: number | null; exposures: number; finished: boolean; chapters_done: number[] }>(
      "POST", `/chapters/${chapterId}/complete`, { opened_at: openedAt }),
  lookups: (events: LookupEvent[], keepalive = false) =>
    call<{ accepted: string[]; duplicate: string[]; rejected: string[] }>("POST", "/lookups", { events }, keepalive),
};

export type LookupEvent = {
  id: string;
  token_id: number;
  self_rating: "unknown" | "vague" | "known";
  dwell_ms: number;
  at: string;
};
