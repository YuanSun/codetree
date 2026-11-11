// Per-device conveniences (localStorage): theme and the dotted underline on words already looked up.
import { useEffect, useState } from "react";

export type ThemePref = "auto" | "light" | "dark";

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}

function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

export function usePref<T>(key: string, fallback: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => read(key, fallback));
  return [v, (nv: T) => { setV(nv); write(key, nv); }];
}

/** Night mode from 19:00 to 07:00 when the preference is "auto". */
export const isNight = (d = new Date()) => d.getHours() >= 19 || d.getHours() < 7;

export function useTheme(): [ThemePref, (t: ThemePref) => void, boolean] {
  const [pref, setPref] = usePref<ThemePref>("lm.theme", "auto");
  const [night, setNight] = useState(isNight());
  useEffect(() => {
    const id = window.setInterval(() => setNight(isNight()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const dark = pref === "dark" || (pref === "auto" && night);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#1c1a17" : "#fdf6e9");
  }, [dark]);
  return [pref, setPref, dark];
}
