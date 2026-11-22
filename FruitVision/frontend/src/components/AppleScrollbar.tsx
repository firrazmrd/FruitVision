import { useEffect, useRef, useState } from "react";
import { AppleGlyph } from "./art";
import { isReduced, kick, subscribe } from "../lib/motion";

const SIZE = 24;
/** Indikator scroll berbentuk apel. Hanya VISUAL: scroll native (wheel, trackpad, sentuh, keyboard) tidak diganti.
 *  Klik/drag pada track memanggil window.scrollTo. Fisika: pegas teredam (squash-and-stretch saat cepat, elastic settle saat berhenti). */
export default function AppleScrollbar({ enabled = true }: { enabled?: boolean }) {
  const track = useRef<HTMLDivElement>(null), thumb = useRef<HTMLDivElement>(null), dragging = useRef(false);
  const [wide, setWide] = useState(() => typeof matchMedia !== "undefined" && matchMedia("(min-width: 640px)").matches);
  useEffect(() => { const mq = matchMedia("(min-width: 640px)"); const f = () => setWide(mq.matches); mq.addEventListener("change", f); return () => mq.removeEventListener("change", f); }, []);
  const on = enabled && wide;

  useEffect(() => {
    if (!on) return;
    const html = document.documentElement; html.classList.add("apple-sb");
    let pos = 0, vel = 0, init = false, H = 0; const measure = () => { H = track.current?.clientHeight ?? 0; }; measure();
    const ro = new ResizeObserver(() => { measure(); kick(); }); if (track.current) ro.observe(track.current);
    const put = (p: number, v: number) => {
      const st = Math.min(0.36, Math.abs(v) / 2400), rot = Math.max(-16, Math.min(16, v / 180));
      if (thumb.current) thumb.current.style.transform = `translate3d(0,${p.toFixed(2)}px,0) rotate(${rot.toFixed(2)}deg) scale(${(1 - st * 0.5).toFixed(3)},${(1 + st).toFixed(3)})`;
    };
    const off = subscribe(s => {
      const tr = track.current; if (!tr || !thumb.current) return;
      tr.style.opacity = s.max > 2 ? "1" : "0"; tr.style.pointerEvents = s.max > 2 ? "auto" : "none";
      const target = s.p * Math.max(0, H - SIZE);
      if (isReduced() || !init) { pos = target; vel = 0; init = true; put(pos, 0); return false; }
      vel += (-(pos - target) * 240 - vel * 19) * s.dt; pos += vel * s.dt; put(pos, vel);
      return Math.abs(pos - target) > 0.05 || Math.abs(vel) > 0.5;
    });
    return () => { off(); ro.disconnect(); html.classList.remove("apple-sb"); };
  }, [on]);

  if (!on) return null;
  const seek = (clientY: number) => {
    const r = track.current!.getBoundingClientRect(), travel = Math.max(1, r.height - SIZE), p = Math.min(1, Math.max(0, (clientY - r.top - SIZE / 2) / travel));
    window.scrollTo({ top: p * (document.documentElement.scrollHeight - window.innerHeight), behavior: "auto" });
  };
  return (
    <div ref={track} className="apple-track" aria-hidden="true"
      onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); dragging.current = true; thumb.current?.classList.add("hot"); seek(e.clientY); }}
      onPointerMove={e => { if (dragging.current) seek(e.clientY); }}
      onPointerUp={() => { dragging.current = false; thumb.current?.classList.remove("hot"); }} onPointerCancel={() => { dragging.current = false; thumb.current?.classList.remove("hot"); }}>
      <div ref={thumb} className="apple-thumb"><AppleGlyph /></div>
    </div>
  );
}
