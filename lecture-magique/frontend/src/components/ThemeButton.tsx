import { ThemePref } from "../prefs";

const NEXT: Record<ThemePref, ThemePref> = { auto: "light", light: "dark", dark: "auto" };
const LABEL: Record<ThemePref, string> = { auto: "Auto (nuit après 19 h)", light: "Jour", dark: "Nuit" };

export default function ThemeButton({ theme }: { theme: [ThemePref, (t: ThemePref) => void, boolean] }) {
  const [pref, setPref, dark] = theme;
  return (
    <button className="btn ghost icon" title={`Mode : ${LABEL[pref]}`} aria-label={`Mode : ${LABEL[pref]}`}
            onClick={() => setPref(NEXT[pref])}>
      {dark ? "🌙" : "☀️"}
      {pref === "auto" && <span className="auto-dot">A</span>}
    </button>
  );
}
