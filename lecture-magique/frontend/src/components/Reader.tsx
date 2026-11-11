import { CSSProperties, memo, MouseEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { api, ChapterData, TokenTuple, WordState } from "../api";
import { go } from "../App";
import { usePref, ThemePref } from "../prefs";
import { lookupQueue, uuid4 } from "../queue";
import { speak } from "../speech";
import ThemeButton from "./ThemeButton";
import WordCard, { CardInfo, Rating } from "./WordCard";

const IDLE_MS = 120_000; // reading time stops counting after 2 minutes without any interaction
const REPORT_MS = 30_000;

/** One paragraph: the original text with each word wrapped in <span data-t>. Gaps are copied verbatim. */
const Paragraph = memo(function Paragraph({ text, tokens, seen, active, underline }: {
  text: string; tokens: TokenTuple[]; seen: Record<string, WordState>; active: number | null; underline: boolean;
}) {
  const out: (string | JSX.Element)[] = [];
  let pos = 0;
  for (const [id, s, e, lemmaId] of tokens) {
    if (s > pos) out.push(text.slice(pos, s));
    const w = lemmaId ? seen[lemmaId] : undefined;
    const cls = ["w", underline && w && w.status !== "known" ? "seen" : "", id === active ? "active" : ""]
      .filter(Boolean).join(" ");
    out.push(<span key={id} data-t={id} className={cls}>{text.slice(s, e)}</span>);
    pos = e;
  }
  if (pos < text.length) out.push(text.slice(pos));
  return <p className={text.startsWith("–") ? "dialogue" : undefined}>{out}</p>;
});

type Open = CardInfo & { openedAt: number; style: CSSProperties; sheet: boolean };

export default function Reader({ articleId, seq, theme }: {
  articleId: number; seq: number; theme: [ThemePref, (t: ThemePref) => void, boolean];
}) {
  const [data, setData] = useState<ChapterData | null>(null);
  const [error, setError] = useState("");
  const [words, setWords] = useState<Record<string, WordState>>({});
  const [card, setCard] = useState<Open | null>(null);
  const [underline, setUnderline] = usePref("lm.underline", true);
  const [done, setDone] = useState<null | { next: number | null; finished: boolean }>(null);
  const [completing, setCompleting] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const cardState = useRef<Open | null>(null);
  const tokenIndex = useRef(new Map<number, TokenTuple>());
  const openedAt = useRef(new Date().toISOString());
  const currentPara = useRef(1);
  const lastActive = useRef(Date.now());
  const lastTick = useRef(Date.now());
  const finishedAt = useRef<{ chapter: number } | null>(null); // after "j'ai fini", the bookmark is the next chapter

  cardState.current = card;

  useEffect(() => {
    api.chapter(articleId, seq).then((d) => {
      tokenIndex.current = new Map(d.paragraphs.flatMap((p) => p.tokens.map((t) => [t[0], t] as const)));
      setWords(d.words);
      setData(d);
      document.title = `${d.article.title} · ${seq}`;
    }, (e) => setError(e.message));
    window.scrollTo(0, 0);
  }, [articleId, seq]);

  // Resume where she stopped in this chapter.
  useLayoutEffect(() => {
    if (!data?.progress || data.progress.last_chapter !== seq) return;
    const want = data.progress.last_paragraph;
    if (want > 1) textRef.current?.children[want - 1]?.scrollIntoView({ block: "start" });
  }, [data, seq]);

  // ---- reading time + position -------------------------------------------------------------
  const report = useCallback((keepalive = false) => {
    const now = Date.now();
    const active = now - lastActive.current < IDLE_MS && document.visibilityState === "visible";
    const secs = active || keepalive ? Math.round((now - lastTick.current) / 1000) : 0;
    lastTick.current = now;
    const where = finishedAt.current ?? { chapter: seq };
    const para = finishedAt.current ? 1 : currentPara.current;
    void api.progress(articleId, where.chapter, para, Math.min(secs, 600), keepalive).catch(() => undefined);
  }, [articleId, seq]);

  useEffect(() => {
    const bump = () => { lastActive.current = Date.now(); };
    const onScroll = () => {
      bump();
      const ps = textRef.current?.children;
      if (!ps) return;
      for (let i = 0; i < ps.length; i++) {
        if ((ps[i] as HTMLElement).getBoundingClientRect().bottom > 90) { currentPara.current = i + 1; break; }
      }
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") { closeCard("unknown"); report(true); }
      else { lastTick.current = Date.now(); bump(); }
    };
    const id = window.setInterval(() => report(), REPORT_MS);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointerdown", bump, { passive: true });
    window.addEventListener("keydown", bump);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onVis);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointerdown", bump);
      window.removeEventListener("keydown", bump);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onVis);
      closeCard("unknown");
      report();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report]);

  // ---- word card ------------------------------------------------------------------------------
  const closeCard = useCallback((rating: Rating) => {
    const c = cardState.current;
    if (!c) return;
    cardState.current = null;
    setCard(null);
    lookupQueue.push({
      id: uuid4(), token_id: c.tokenId, self_rating: rating,
      dwell_ms: Math.round(performance.now() - c.openedAt), at: new Date().toISOString(),
    });
    const lemmaId = tokenIndex.current.get(c.tokenId)?.[3];
    if (lemmaId) {
      setWords((w) => {
        const prev = w[lemmaId];
        return {
          ...w,
          [lemmaId]: prev
            ? { ...prev, lookups: prev.lookups + 1 }
            : { status: rating === "known" ? "known" : "learning", familiarity: 0, lookups: 1, exposures: 0 },
        };
      });
    }
  }, []);

  const openCard = useCallback((span: HTMLElement) => {
    if (!data) return;
    const tid = Number(span.dataset.t);
    const tok = tokenIndex.current.get(tid);
    if (!tok) return;
    const [, , , lemmaId, senseId] = tok;
    const root = rootRef.current!.getBoundingClientRect();
    const r = span.getBoundingClientRect();
    const sheet = window.innerWidth < 640;
    const width = Math.min(420, root.width - 24);
    const left = Math.max(12, Math.min(r.left - root.left - 24, root.width - width - 12));
    const below = window.innerHeight - r.bottom > 300 || r.top < 320;
    const style: CSSProperties = sheet ? {} : below
      ? { left, top: r.bottom - root.top + 8, width }
      : { left, bottom: root.bottom - r.top + 8, width };
    setCard({
      tokenId: tid, surface: span.textContent ?? "", senseId,
      lemma: lemmaId ? data.lemmas[lemmaId] ?? null : null,
      word: lemmaId ? words[lemmaId] ?? null : null,
      openedAt: performance.now(), style, sheet,
    });
  }, [data, words]);

  // One delegated handler for the whole reader: tap a word -> card; tap anywhere else -> close.
  const onClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (cardRef.current?.contains(target)) return;
    const span = target.closest<HTMLElement>("[data-t]");
    const hadCard = !!cardState.current;
    if (hadCard) closeCard("unknown");
    if (span && textRef.current?.contains(span)) {
      if (hadCard && Number(span.dataset.t) === card?.tokenId) return; // tapping the same word again just closes
      openCard(span);
    }
  };

  // ---- keyboard (Chromebook) -----------------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "Escape") closeCard("unknown");
      else if (e.key === " " && cardState.current) { e.preventDefault(); speak(cardState.current.surface); }
      else if (!cardState.current && data) {
        if (e.key === "ArrowRight" && seq < data.chapters.length) go(`/lire/${articleId}/${seq + 1}`);
        if (e.key === "ArrowLeft" && seq > 1) go(`/lire/${articleId}/${seq - 1}`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [data, seq, articleId, closeCard]);

  async function complete() {
    if (!data) return;
    setCompleting(true);
    closeCard("unknown");
    await lookupQueue.flush(); // exposures must not count words tapped in this reading
    try {
      const r = await api.complete(data.chapter.id, openedAt.current);
      finishedAt.current = { chapter: r.next_seq ?? seq };
      setDone({ next: r.next_seq, finished: r.finished });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setCompleting(false);
    }
  }

  if (error) return <main className="reader"><p className="error">{error}</p><button className="btn" onClick={() => go("/")}>← Bibliothèque</button></main>;
  if (!data) return <div className="splash">📖</div>;

  const total = data.chapters.length;
  const alreadyDone = data.progress?.chapters_done.includes(seq);

  return (
    <div className="reader" ref={rootRef} onClick={onClick}>
      <header className="reader-bar">
        <button className="btn ghost small" onClick={() => go("/")}>← Bibliothèque</button>
        <div className="reader-title">
          <span className="rt-book">{data.article.title}</span>
          <span className="rt-ch">Chapitre {seq} / {total}</span>
        </div>
        <div className="topbar-actions">
          <button className={`btn ghost icon${underline ? " on" : ""}`} onClick={() => setUnderline(!underline)}
                  title="Souligner les mots déjà cherchés" aria-label="Souligner les mots déjà cherchés">
            <span className="u-icon">a͟b</span>
          </button>
          <ThemeButton theme={theme} />
        </div>
      </header>

      <article className="page">
        {data.article.status === "draft" && <p className="draft-note">Brouillon — visible seulement par les parents</p>}
        <h1 className="chapter-title"><span className="ch-num">{seq}</span> {data.chapter.title}</h1>
        <div className="text" ref={textRef}>
          {data.paragraphs.map((p) => (
            <Paragraph key={p.id} text={p.text} tokens={p.tokens} seen={words}
                       active={card?.tokenId ?? null} underline={underline} />
          ))}
        </div>

        <footer className="chapter-end">
          {data.question && (
            <div className="card think">
              <div className="think-title">💭 À toi de réfléchir</div>
              <p>{data.question}</p>
              <p className="muted small">Relis bien la question : qu’est-ce qu’elle demande exactement ?</p>
            </div>
          )}
          {done ? (
            <div className="card bravo">
              <div className="bravo-pop">{done.finished ? "🏆" : "⭐"}</div>
              <p>{done.finished ? "Bravo, tu as fini toute l’histoire !" : "Chapitre terminé, bravo !"}</p>
              {done.next ? (
                <button className="btn primary" onClick={() => go(`/lire/${articleId}/${done.next}`)}>
                  Chapitre {done.next} →
                </button>
              ) : (
                <button className="btn primary" onClick={() => go("/")}>Retour à la bibliothèque</button>
              )}
            </div>
          ) : (
            <button className="btn primary big" onClick={complete} disabled={completing}>
              {alreadyDone ? "J’ai relu ce chapitre ✓" : "J’ai fini ce chapitre ✓"}
            </button>
          )}
          <nav className="ch-nav">
            {seq > 1 ? <button className="btn ghost" onClick={() => go(`/lire/${articleId}/${seq - 1}`)}>← Chapitre {seq - 1}</button> : <span />}
            {seq < total && <button className="btn ghost" onClick={() => go(`/lire/${articleId}/${seq + 1}`)}>Chapitre {seq + 1} →</button>}
          </nav>
        </footer>
      </article>

      {card && (
        <>
          {card.sheet && <div className="sheet-backdrop" />}
          <WordCard ref={cardRef} info={card} senses={data.senses} style={card.style} sheet={card.sheet}
                    onRate={(r) => closeCard(r)} />
        </>
      )}
    </div>
  );
}
