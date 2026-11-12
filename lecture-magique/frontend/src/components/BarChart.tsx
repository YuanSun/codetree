import { useState } from "react";

/**
 * Single-series weekly bar chart (one measure per chart, one axis).
 * Thin bars with 4px rounded tops on the baseline, a 2px surface gap, a recessive grid,
 * a tap/hover tooltip per bar, the latest value labelled, and a table view for exact numbers.
 */
export type Bar = { label: string; value: number | null; tip: string };

// Drawn at roughly the size it is shown (a third of a 960px page), so 12-13px text stays legible.
const W = 320;
const H = 190;
const PAD = { top: 20, right: 6, bottom: 24, left: 28 };

function niceMax(v: number): number {
  if (v <= 5) return 5;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

function topRounded(x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export default function BarChart({ title, bars, color, unit, max }: {
  title: string; bars: Bar[]; color: "c1" | "c2"; unit: string; max?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const top = max ?? niceMax(Math.max(0, ...bars.map((b) => b.value ?? 0)));
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const slot = iw / bars.length;
  const bw = Math.min(22, slot * 0.6);
  const every = bars.length > 6 ? 2 : 1; // label every other week when space is tight (latest always labelled)
  const y = (v: number) => PAD.top + ih - (ih * v) / top;
  const ticks = [0, top / 2, top];
  let lastWithValue = -1;
  bars.forEach((b, i) => { if (b.value !== null) lastWithValue = i; });

  return (
    <figure className="chart">
      <figcaption>
        <span className="chart-title">{title}</span>
        <button className="link small" onClick={() => setTable(!table)}>{table ? "Graphique" : "Tableau"}</button>
      </figcaption>
      {table ? (
        <table className="chart-table">
          <tbody>
            {bars.map((b) => <tr key={b.label}><th>{b.label}</th><td>{b.value === null ? "—" : `${b.value} ${unit}`}</td></tr>)}
          </tbody>
        </table>
      ) : (
        <div className="chart-wrap">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className={t === 0 ? "axis" : "grid"} />
                <text x={PAD.left - 6} y={y(t) + 4} className="tick" textAnchor="end">{Math.round(t)}</text>
              </g>
            ))}
            {bars.map((b, i) => {
              const cx = PAD.left + slot * i + slot / 2;
              const v = b.value ?? 0;
              const h = Math.max(0, y(0) - y(v));
              return (
                <g key={b.label}>
                  {b.value !== null && h > 0 && (
                    <path d={topRounded(cx - bw / 2, y(v), bw, h, 4)} className={`bar ${color}${hover === i ? " on" : ""}`} />
                  )}
                  {b.value === null && <text x={cx} y={y(0) - 4} className="tick" textAnchor="middle">–</text>}
                  {i === lastWithValue && b.value !== null && hover === null && (
                    <text x={cx} y={y(v) - 5} className="val" textAnchor="middle">{b.value}</text>
                  )}
                  {((bars.length - 1 - i) % every === 0) && (
                    <text x={cx} y={H - 7} className="tick" textAnchor="middle">{b.label}</text>
                  )}
                  {/* hit target: the whole column, bigger than the bar */}
                  <rect x={cx - slot / 2} y={PAD.top} width={slot} height={ih} className="hit"
                        onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                        onClick={() => setHover(hover === i ? null : i)} />
                </g>
              );
            })}
          </svg>
          {hover !== null && (
            <div className="tooltip" style={{ left: `${((PAD.left + slot * hover + slot / 2) / W) * 100}%` }}>
              <b>{bars[hover].label}</b><br />{bars[hover].tip}
            </div>
          )}
        </div>
      )}
    </figure>
  );
}
