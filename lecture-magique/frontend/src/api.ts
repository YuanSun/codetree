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

// [token_id, char_start, char_end, lemma_id, sense_id, morph (verb forms only, e.g. "Mood=Ind|…|Tense=Pres")]
export type TokenTuple = [number, number, number, number | null, number | null, string | null];

// en: English glosses from Wiktionary (shown when Petit Robert has no entry)
export type Lemma = { lemma: string; pos: string; gender: string | null; ipa: string | null; senses: number[]; en: string[] };
export type Sense = { key: string | null; def: string | null; ex: string[]; en?: string };

export type Conjugation = {
  lemma: string;
  infinitive: string[];
  participle_present: string[];
  participle_past: string[];
  tenses: { key: string; label: string; forms: Record<string, string[]> }[];
  source: string;
};
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

export type QuizItem = {
  id: number;
  seq: number;
  type: "meaning" | "cloze" | "definition" | "dictation";
  prompt: { word?: string; sentence?: string; definition?: string; say?: string; hint?: string | null;
            choices?: string[]; retry?: boolean };
  answered: boolean;
  correct: boolean | null;
};
export type Quiz = {
  id: number; week_of: string; status: "open" | "done"; items: QuizItem[];
  summary: { total: number; correct: number; gold: string[]; practice: string[] };
};
export type AnswerResult = {
  correct: boolean; answer: string; hint: string | null; sentence: string | null; familiarity: number | null;
  left: number; already: boolean;
};
export type BagWord = {
  lemma_id: number; lemma: string; pos: string; gender: string | null; ipa: string | null;
  group: "new" | "learning" | "mastered" | "known"; familiarity: number; lookups: number; due: string | null;
  definition: string | null; gloss: string | null; sentence: string | null; surface: string | null;
};

export type ChildReport = {
  child: { id: number; display_name: string };
  bag: { new: number; learning: number; mastered: number; known: number; due_soon: number };
  weeks: {
    week: string; taps: number; words: number; unknown: number; active_days: number; minutes: number;
    defi: null | { status: string; questions: number; answered: number; correct: number };
  }[];
  hard_words: {
    lemma: string; pos: string; lookups: number; lapses: number; familiarity: number; errors: number; asked: number;
    definition: string | null; gloss: string | null; sentence: string | null; surface: string | null; since: string;
  }[];
  books: { title: string; chapters_done: number; chapters: number; last_chapter: number; minutes: number;
           finished: boolean; started: string; lookups: number }[];
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
  quiz: () => call<{ quiz: Quiz | null; message?: string }>("GET", "/quiz/current"),
  answer: (itemId: number, response: string, responseMs: number) =>
    call<AnswerResult>("POST", `/quiz/items/${itemId}/answer`, { response, response_ms: responseMs }),
  words: () => call<BagWord[]>("GET", "/words"),
  children: () => call<{ id: number; username: string; display_name: string }[]>("GET", "/parent/children"),
  report: (childId: number, weeks = 8) => call<ChildReport>("GET", `/parent/children/${childId}/report?weeks=${weeks}`),
  conjugation: (lemmaId: number) => call<Conjugation>("GET", `/lemmas/${lemmaId}/conjugation`),
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
