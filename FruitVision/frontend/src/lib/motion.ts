// Satu hub scroll bersama (rAF, passive listener). Parallax, apel scrollbar, dan jelly berlangganan ke sini,
// sehingga hanya ada SATU loop animasi yang aktif, dan loop berhenti saat tidak ada yang bergerak.
import { useEffect, useRef } from "react";

export const isReduced = () => document.documentElement.dataset.motion === "reduced";

export interface ScrollState { y: number; max: number; p: number; v: number; dt: number; vh: number }
type Sub = (s: ScrollState) => boolean | void;   // mengembalikan true bila masih butuh frame berikutnya
const subs = new Set<Sub>();
let raf = 0, last = 0, lastY = 0, vSm = 0, started = false;

function frame(now: number) {
  raf = 0;
  const dt = Math.min(0.05, (now - (last || now)) / 1000) || 0.016; last = now;
  const y = window.scrollY, vh = window.innerHeight, max = Math.max(1, document.documentElement.scrollHeight - vh);
  const dy = y - lastY; lastY = y; vSm = vSm * 0.8 + (dy / dt) * 0.2;
  const s: ScrollState = { y, max, p: Math.min(1, Math.max(0, y / max)), v: vSm, dt, vh };
  let busy = dy !== 0 || Math.abs(vSm) > 1;
  subs.forEach(cb => { if (cb(s)) busy = true; });
  if (busy) schedule(); else last = 0;
}
function schedule() { if (!raf) raf = requestAnimationFrame(frame); }
export function kick() { schedule(); }
export function subscribe(cb: Sub) {
  subs.add(cb);
  if (!started) {
    started = true; lastY = window.scrollY;
    window.addEventListener("scroll", schedule, { passive: true }); window.addEventListener("resize", schedule);
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(schedule).observe(document.body);
  }
  schedule();
  return () => { subs.delete(cb); };
}

/** Parallax berlapis: mengisi CSS var --out (0..1 saat elemen keluar lewat atas) dan --in (0..1 saat masuk dari bawah). */
export function useParallax<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    let visible = true; const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { rootMargin: "200px" }); io.observe(el);
    const off = subscribe(s => {
      if (!visible || isReduced()) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--out", String(Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)))));
      el.style.setProperty("--in", String(Math.min(1, Math.max(0, (s.vh - r.top) / Math.max(1, r.height)))));
    });
    return () => { off(); io.disconnect(); };
  }, []);
  return ref;
}

/** Jelly: skew/scale elemen dekoratif berdasarkan kecepatan scroll (transform saja). */
export function useJelly<T extends HTMLElement>(strength = 1) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    let cur = 0, vel = 0;
    const off = subscribe(s => {
      if (isReduced()) { el.style.removeProperty("--jelly"); return; }
      const target = Math.max(-1, Math.min(1, s.v / 2200)) * strength;
      vel += (-(cur - target) * 90 - vel * 11) * s.dt; cur += vel * s.dt;
      el.style.setProperty("--jelly", cur.toFixed(4));
      return Math.abs(cur - target) > 0.002 || Math.abs(vel) > 0.01;
    });
    return off;
  }, [strength]);
  return ref;
}
