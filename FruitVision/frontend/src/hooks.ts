import { useCallback, useEffect, useRef, useState } from "react";

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null); const [error, setError] = useState<string | null>(null); const [status, setStatus] = useState<number | null>(null);
  const [loading, setLoading] = useState(true); const [n, setN] = useState(0);
  useEffect(() => {
    let off = false; setLoading(true);
    fn().then(d => { if (!off) { setData(d); setError(null); setStatus(null); } })
      .catch((e: any) => { if (!off) { setData(null); setError(e?.message ?? String(e)); setStatus(typeof e?.status === "number" ? e.status : null); } })
      .finally(() => { if (!off) setLoading(false); });
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);
  return { data, error, status, loading, reload: useCallback(() => setN(x => x + 1), []) };
}

export function usePoll<T>(fn: () => Promise<T>, ms: number, active = true) {
  const [data, setData] = useState<T | null>(null); const [error, setError] = useState<string | null>(null); const f = useRef(fn); f.current = fn;
  useEffect(() => {
    if (!active) return; let stop = false;
    const tick = async () => { try { const d = await f.current(); if (!stop) { setData(d); setError(null); } } catch (e: any) { if (!stop) setError(e?.message ?? String(e)); } };
    tick(); const id = setInterval(tick, ms); return () => { stop = true; clearInterval(id); };
  }, [ms, active]);
  return { data, error };
}

type Pref = "light" | "dark" | "system";
const mqDark = () => matchMedia("(prefers-color-scheme: dark)");
function applyTheme(p: Pref) { document.documentElement.dataset.theme = p === "system" ? (mqDark().matches ? "dark" : "light") : p; }

export function useTheme() {
  const [pref, setPref] = useState<Pref>(() => { try { return (localStorage.getItem("fv-theme") as Pref) || "system"; } catch { return "system"; } });
  const [theme, setTheme] = useState<"light" | "dark">(() => (document.documentElement.dataset.theme === "dark" ? "dark" : "light"));
  useEffect(() => {
    applyTheme(pref); setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    try { localStorage.setItem("fv-theme", pref); } catch { /* storage tidak tersedia */ }
    if (pref !== "system") return;
    const mq = mqDark(); const on = () => { applyTheme("system"); setTheme(mq.matches ? "dark" : "light"); }; mq.addEventListener("change", on); return () => mq.removeEventListener("change", on);
  }, [pref]);
  const toggle = useCallback(() => setPref(theme === "dark" ? "light" : "dark"), [theme]);
  return { pref, theme, setPref, toggle };
}

type MotionPref = "system" | "reduced" | "full";
export function useMotionPref() {
  const [pref, setPref] = useState<MotionPref>(() => { try { return (localStorage.getItem("fv-motion") as MotionPref) || "system"; } catch { return "system"; } });
  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => { document.documentElement.dataset.motion = pref === "reduced" || (pref === "system" && mq.matches) ? "reduced" : "full"; };
    apply(); try { localStorage.setItem("fv-motion", pref); } catch { /* ignore */ }
    mq.addEventListener("change", apply); return () => mq.removeEventListener("change", apply);
  }, [pref]);
  return { pref, setPref };
}

/** State kecil yang disimpan di localStorage (aman bila storage diblokir). */
export function useStored<T extends string | boolean>(key: string, initial: T) {
  const [v, setV] = useState<T>(() => { try { const s = localStorage.getItem(key); return s === null ? initial : (typeof initial === "boolean" ? (s === "1") : s) as T; } catch { return initial; } });
  useEffect(() => { try { localStorage.setItem(key, typeof v === "boolean" ? (v ? "1" : "0") : String(v)); } catch { /* ignore */ } }, [key, v]);
  return [v, setV] as const;
}
