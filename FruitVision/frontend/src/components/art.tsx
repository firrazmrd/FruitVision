import { useId, useMemo, useRef } from "react";
import { useEffect } from "react";
import { useParallax } from "../lib/motion";
import { usePhoto } from "../lib/photos";

/* ---------- logo + apel ---------- */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path fill="var(--brand)" d="M16 8.5c-3-3-9-2-10 4-1 7 3 14 8 14 1 0 1.5-.5 2-.5s1 .5 2 .5c5 0 9-7 8-14-1-6-7-7-10-4z" />
      <path fill="var(--accent)" d="M17 7.5c0-3 2-5 5-5 0 3-2 5-5 5z" />
      <path d="M11 14c0-2 1.5-3.5 3.5-3.7" stroke="var(--on-brand)" strokeWidth="1.4" strokeLinecap="round" fill="none" opacity=".7" />
    </svg>
  );
}

export function AppleGlyph() {
  return (
    <svg viewBox="0 0 22 24" aria-hidden="true" focusable="false">
      <path d="M11 6.2c-1.6-1.5-4.8-1.2-6 1.3C3.4 10.9 4.6 17 8 19.5c1.1.8 2.1.3 3 .3s1.9.5 3-.3c3.4-2.5 4.6-8.6 3-12-1.2-2.5-4.4-2.8-6-1.3z" fill="var(--apple-body)" />
      <path d="M14 6.6c2 .8 3.2 2.4 3 5.2-.4 3.5-2.4 6.2-4.6 7.4 2.6-.6 5-5.6 4.4-9.6-.3-1.8-1.5-2.7-2.8-3z" fill="var(--apple-shade)" opacity=".45" />
      <path d="M11 6.2c0-1.9.5-3.2 1.5-4.2" stroke="#6B4A33" strokeWidth="1.3" strokeLinecap="round" fill="none" />
      <path d="M12 5.4c.4-2 2.4-3.2 4.6-3-.1 2.2-2 3.6-4.6 3z" fill="var(--apple-leaf)" />
      <ellipse cx="7.2" cy="10.2" rx="1.1" ry="2.3" fill="#fff" opacity=".28" transform="rotate(20 7.2 10.2)" />
    </svg>
  );
}

/* ---------- glyph 8 jenis buah (ilustrasi sederhana, bukan data) ---------- */
export function FruitGlyph({ name, size = 56 }: { name: string; size?: number }) {
  const s = { width: size, height: size };
  const leaf = <path d="M32 14c1-6 6-9 12-8-1 6-5 9-12 8z" fill="#4E8040" />;
  const shine = (cx: number, cy: number) => <ellipse cx={cx} cy={cy} rx="3" ry="6" fill="#fff" opacity=".25" transform={`rotate(25 ${cx} ${cy})`} />;
  let g: ReactNode;
  switch (name) {
    case "apple": g = (<><path d="M32 17c-5-4-15-3-17 5-2 10 3 24 11 28 2 1 4 0 6 0s4 1 6 0c8-4 13-18 11-28-2-8-12-9-17-5z" fill="#C2452D" /><path d="M42 20c5 2 8 6 7 13-1 8-5 14-10 16 7-3 12-14 10-23-.5-3-3.500-5.500-7-6z" fill="#8E2C1B" opacity=".4" /><path d="M32 17c0-4 1-7 3-9" stroke="#6B4A33" strokeWidth="2.4" strokeLinecap="round" fill="none" />{leaf}{shine(21, 29)}</>); break;
    case "banana": g = (<><path d="M9 40c4 13 27 16 43-6 4-6 4-14 2-21l-7 2c1 7-1 13-8 18-8 6-19 5-27 0z" fill="#E9B84C" /><path d="M9 40c8 5 19 6 27 0 7-5 9-11 8-18l7-2c-1 8-1 12-5 17-9 13-31 11-37 3z" fill="#B88A1C" opacity=".35" /><path d="M54 13l3-5-2 8z M9 40l-3 4 7 0z" fill="#6B4A33" /></>); break;
    case "grape": g = (<><path d="M32 14v6" stroke="#6B4A33" strokeWidth="2.4" strokeLinecap="round" /><path d="M32 16c2-6 8-9 15-7-1 6-7 9-15 7z" fill="#4E8040" />{[[22, 26], [34, 26], [46, 26], [28, 37], [40, 37], [34, 48]].map(([x, y], i) => <circle key={i} cx={x - 2} cy={y + 2} r="7.200" fill="#6B3F8F" />)}{[[22, 26], [34, 26], [28, 37], [34, 48]].map(([x, y], i) => <ellipse key={i} cx={x - 4.200} cy={y - .5} rx="1.800" ry="2.600" fill="#fff" opacity=".28" />)}</>); break;
    case "guava": g = (<><path d="M32 11c11 0 20 8 20 21 0 13-9 21-20 21S12 45 12 32c0-13 9-21 20-21z" fill="#A9C34F" /><path d="M44 18c5 4 8 10 7 18-1 8-8 15-16 16 10-3 16-15 12-26-.7-3-1.500-5.500-3-8z" fill="#6F8F2E" opacity=".4" /><circle cx="32" cy="13" r="3" fill="#6B4A33" />{leaf}{shine(22, 28)}</>); break;
    case "jujube": g = (<><ellipse cx="24" cy="38" rx="11" ry="15" fill="#8B3A2B" transform="rotate(-18 24 38)" /><ellipse cx="42" cy="32" rx="10" ry="14" fill="#A24A33" transform="rotate(16 42 32)" /><path d="M24 24c-1-4 0-7 2-9M44 20c0-4 1-6 3-8" stroke="#6B4A33" strokeWidth="2.200" strokeLinecap="round" fill="none" /><ellipse cx="19" cy="34" rx="2" ry="5" fill="#fff" opacity=".22" transform="rotate(-18 19 34)" /></>); break;
    case "orange": g = (<><circle cx="32" cy="35" r="20" fill="#E8852B" /><path d="M46 22c5 5 7 12 4 20-3 7-9 11-16 12 9-4 13-16 12-32z" fill="#B9611A" opacity=".35" />{[[24, 30], [34, 41], [41, 29], [27, 42]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1" fill="#B9611A" opacity=".6" />)}{leaf}{shine(22, 30)}</>); break;
    case "pomegranate": g = (<><circle cx="32" cy="36" r="19" fill="#B5302F" /><path d="M46 24c5 5 6 12 3 19-3 6-8 9-15 10 9-4 13-14 12-29z" fill="#7E1F1F" opacity=".4" /><path d="M24 19l3-8 5 5 5-5 3 8z" fill="#8F2323" />{shine(22, 33)}</>); break;
    case "strawberry": g = (<><path d="M32 54C16 46 11 32 14 24c2-6 10-8 18-5 8-3 16-1 18 5 3 8-2 22-18 30z" fill="#D63A3A" /><path d="M44 24c4 2 6 6 5 11-2 7-7 12-13 16 9-6 12-15 8-27z" fill="#8F2323" opacity=".35" />{[[22, 28], [30, 32], [38, 28], [26, 40], [34, 42], [42, 36], [30, 22]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx="1.200" ry="1.800" fill="#F3D87A" />)}<path d="M32 21l-9-5 6 1-3-6 6 4 0-6 3 6 5-4-2 6 6-2-5 5z" fill="#4E8040" /></>); break;
    default: g = <circle cx="32" cy="32" r="18" fill="var(--accent)" />;
  }
  return <svg viewBox="0 0 64 64" style={s} aria-hidden="true" focusable="false">{g}</svg>;
}

/* ---------- hero: pelat pemindai ---------- */
export function ScanPlate({ photoName = "hero-fruit.jpg" }: { photoName?: string }) {
  const photo = usePhoto(photoName); const hasPhoto = !!photo;
  return (
    <div className="plate hero-plate" style={{ padding: 10 }}>
      <div className="frame grid-paper" style={{ aspectRatio: "1 / 1" }} role="img" aria-label="Ilustrasi apel dengan kontur segmentasi dan penanda pemindai">
        {photo && <img src={photo.src} alt={photo.alt} decoding="async" style={{ position: "absolute", inset: 0 }} />}
        <svg viewBox="0 0 400 400" style={{ width: "100%", height: "100%", position: "relative" }} aria-hidden="true">
          {!hasPhoto && <g transform="translate(200 214) scale(8.600) translate(-11 -13)">
            <path d="M11 6.2c-1.6-1.5-4.8-1.2-6 1.3C3.4 10.9 4.6 17 8 19.5c1.1.8 2.1.3 3 .3s1.9.5 3-.3c3.4-2.5 4.6-8.6 3-12-1.2-2.5-4.4-2.8-6-1.3z" fill="var(--apple-body)" />
            <path d="M14 6.6c2 .8 3.2 2.4 3 5.2-.4 3.5-2.4 6.2-4.6 7.4 2.6-.6 5-5.6 4.4-9.6-.3-1.8-1.5-2.7-2.8-3z" fill="var(--apple-shade)" opacity=".45" />
            <path d="M11 6.2c0-1.9.5-3.2 1.5-4.2" stroke="#6B4A33" strokeWidth="1.3" strokeLinecap="round" fill="none" />
            <path d="M12 5.4c.4-2 2.4-3.2 4.6-3-.1 2.2-2 3.6-4.6 3z" fill="var(--apple-leaf)" />
            <ellipse cx="7.2" cy="10.2" rx="1.1" ry="2.3" fill="#fff" opacity=".28" transform="rotate(20 7.2 10.2)" />
          </g>}
          {!hasPhoto && <g transform="translate(200 214) scale(9.400) translate(-11 -13)" fill="none" stroke="var(--accent-ink)" strokeWidth=".26" strokeDasharray="1.1 .8">
            <path d="M11 6.2c-1.6-1.5-4.8-1.2-6 1.3C3.4 10.9 4.6 17 8 19.5c1.1.8 2.1.3 3 .3s1.9.5 3-.3c3.4-2.5 4.6-8.6 3-12-1.2-2.5-4.4-2.8-6-1.3z" />
          </g>}
          {[[34, 34, 1, 1], [366, 34, -1, 1], [34, 366, 1, -1], [366, 366, -1, -1]].map(([x, y, sx, sy], i) => <path key={i} d={`M${x} ${y + 34 * sy} V${y} H${x + 34 * sx}`} fill="none" stroke="var(--accent-ink)" strokeWidth="3" />)}
          <path d="M200 40v22M200 338v22M40 200h22M338 200h22" stroke="var(--accent-ink)" strokeWidth="1.500" opacity=".7" />
        </svg>
        <span className="tag" style={{ left: 8, top: 8 }}>Segment</span>
        <span className="tag" style={{ right: 8, bottom: 8, left: "auto", top: "auto" }}>Color · HOG · GLCM</span>
        <div className="scanline" aria-hidden="true" />
      </div>
    </div>
  );
}

/* ---------- lanskap perkebunan berlapis ---------- */
function rng(seed: number) { let a = seed; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const W = 1440, H = 480;
const hillFn = (base: number, amp: number, l1: number, p1: number, l2: number, p2: number) => (x: number) => base + amp * Math.sin(x / l1 + p1) + amp * 0.45 * Math.sin(x / l2 + p2);
const hillPath = (fn: (x: number) => number) => { let d = `M0 ${H} L0 ${fn(0).toFixed(1)}`; for (let x = 20; x <= W; x += 20) d += ` L${x} ${fn(x).toFixed(1)}`; return d + ` L${W} ${H} Z`; };

function Tree({ x, y, s, r, fruit }: { x: number; y: number; s: number; r: () => number; fruit: boolean }) {
  const fr = fruit ? Array.from({ length: 5 }, () => [(-12 + r() * 24) * s, (-38 + r() * 24) * s, r() > .5] as const) : [];
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
      <rect x={-2.2 * s} y={-16 * s} width={4.4 * s} height={18 * s} fill="var(--trunk)" />
      <circle cx={-10 * s} cy={-22 * s} r={11 * s} fill="var(--tree-a)" /><circle cx={10 * s} cy={-22 * s} r={11 * s} fill="var(--tree-a)" />
      <circle cx={0} cy={-28 * s} r={14 * s} fill="var(--tree-b)" /><circle cx={3 * s} cy={-35 * s} r={9 * s} fill="var(--tree-a)" opacity=".55" />
      {fr.map(([fx, fy, a], i) => <circle key={i} cx={fx} cy={fy} r={2.2 * s} fill={a ? "var(--fruit-a)" : "var(--fruit-b)"} />)}
    </g>
  );
}
function Tuft({ x, y, h, c, r }: { x: number; y: number; h: number; c: string; r: () => number }) {
  const blades = Array.from({ length: 5 }, (_, i) => { const o = (i - 2) * 2.6, bend = (r() - .5) * h * .5, hh = h * (.65 + r() * .4);
    return `M${(x + o - 1.5).toFixed(1)} ${y} Q${(x + o + bend * .4).toFixed(1)} ${(y - hh * .6).toFixed(1)} ${(x + o + bend).toFixed(1)} ${(y - hh).toFixed(1)} Q${(x + o + bend * .55).toFixed(1)} ${(y - hh * .5).toFixed(1)} ${(x + o + 1.5).toFixed(1)} ${y}Z`; }).join("");
  return <g className="tuft" style={{ ["--dur" as any]: `${(3.8 + r() * 3.6).toFixed(2)}s`, ["--delay" as any]: `${(-r() * 6).toFixed(2)}s`, ["--amp" as any]: (2.5 + r() * 4).toFixed(1) }}><path d={blades} fill={c} /></g>;
}

export function Landscape({ grass = true, className = "", height = "clamp(220px, 34vw, 480px)", pauseOffscreen = true, seed = 7 }: { grass?: boolean; className?: string; height?: string; pauseOffscreen?: boolean; seed?: number }) {
  const uid = useId().replace(/:/g, ""); const ref = useParallax<HTMLDivElement>(); const holder = useRef<HTMLDivElement>(null);
  const g = useMemo(() => {
    const r = rng(seed);
    const f4 = hillFn(300, 16, 190, 1, 77, 2), f3 = hillFn(345, 18, 160, 2, 61, 4), f2 = hillFn(385, 16, 140, 4, 55, 1), f1 = hillFn(425, 12, 120, 3, 47, 5), f0 = hillFn(462, 7, 90, 1, 39, 2);
    const row = (fn: (x: number) => number, n: number, s: number, fruit: boolean, x0 = 20) => Array.from({ length: n }, (_, i) => { const x = x0 + (i + r() * .7) * ((W - 2 * x0) / n); return { x, y: fn(x) + 2, s: s * (.85 + r() * .35), fruit, k: i }; });
    const tufts = (fn: (x: number) => number, n: number, hmin: number, hmax: number) => Array.from({ length: n }, () => { const x = r() * W; return { x, y: fn(x) + 1, h: hmin + r() * (hmax - hmin) }; });
    return { p4: hillPath(f4), p3: hillPath(f3), p2: hillPath(f2), p1: hillPath(f1), p0: hillPath(f0),
      t4: row(f4, 26, .42, false), t3: row(f3, 17, .72, true, 40), t2: row(f2, 11, 1.1, true, 60), t1: row(f1, 6, 1.7, true, 110),
      g1: tufts(f1, 34, 14, 26), g0: tufts(f0, 38, 26, 48),
      stars: Array.from({ length: 36 }, () => ({ x: r() * W, y: r() * 190, r: .6 + r() * 1.2, d: `${(2 + r() * 4).toFixed(1)}s`, dl: `${(-r() * 4).toFixed(1)}s` })),
      flies: Array.from({ length: 9 }, () => ({ x: 80 + r() * (W - 160), y: 330 + r() * 110, d: `${(3 + r() * 3).toFixed(1)}s`, dl: `${(-r() * 4).toFixed(1)}s` })),
      leaves: Array.from({ length: 6 }, () => ({ x: 60 + r() * (W - 120), y: 120 + r() * 200, dx: 40 + r() * 90, dy: 20 + r() * 50, rot: 30 + r() * 80, dur: 16 + r() * 12, dl: -r() * 14, a: r() > .5 })) };
  }, [seed]);

  useEffect(() => { // jeda animasi saat lanskap tidak terlihat (hemat CPU)
    if (!pauseOffscreen || !holder.current) return; const el = holder.current;
    const io = new IntersectionObserver(([e]) => el.classList.toggle("paused", !e.isIntersecting)); io.observe(el); return () => io.disconnect();
  }, [pauseOffscreen]);

  const L = (lag: number, rise: number) => ({ ["--lag" as any]: lag, ["--rise" as any]: rise });
  return (
    <div ref={(n) => { (ref as any).current = n; (holder as any).current = n; }} className={`landscape ${className}`} style={{ height }} aria-hidden="true">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" width="100%" height="100%" style={{ display: "block" }} focusable="false">
        <defs>
          <linearGradient id={`sky${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--sky-1)" /><stop offset="1" stopColor="var(--sky-2)" /></linearGradient>
          <radialGradient id={`glow${uid}`}><stop offset="0" stopColor="var(--sun-glow)" /><stop offset="1" stopColor="var(--sun-glow)" stopOpacity="0" /></radialGradient>
        </defs>
        <rect width={W} height={H} fill={`url(#sky${uid})`} opacity=".0" />
        <g className="layer" style={L(150, 0)}><circle cx="1290" cy="95" r="120" fill={`url(#glow${uid})`} /><circle cx="1290" cy="95" r="34" fill="var(--sun-core)" /></g>
        <g className="night-only" style={{ pointerEvents: "none" }}>{g.stars.map((s, i) => <circle key={i} className="twinkle" cx={s.x} cy={s.y} r={s.r} fill="#EEE8D5" style={{ ["--dur" as any]: s.d, ["--delay" as any]: s.dl }} />)}</g>
        <g className="layer" style={L(120, 6)}><path d={g.p4} fill="var(--hill-4)" />{g.t4.map(t => <Tree key={t.k} x={t.x} y={t.y} s={t.s} r={rng(t.k + 11)} fruit={t.fruit} />)}</g>
        <g className="layer" style={L(90, 14)}><path d={g.p3} fill="var(--hill-3)" />{g.t3.map(t => <Tree key={t.k} x={t.x} y={t.y} s={t.s} r={rng(t.k + 101)} fruit={t.fruit} />)}</g>
        <g className="layer" style={L(60, 26)}><path d={g.p2} fill="var(--hill-2)" />{g.t2.map(t => <Tree key={t.k} x={t.x} y={t.y} s={t.s} r={rng(t.k + 201)} fruit={t.fruit} />)}</g>
        <g className="layer" style={L(30, 40)}><path d={g.p1} fill="var(--hill-1)" />{g.t1.map(t => <Tree key={t.k} x={t.x} y={t.y} s={t.s} r={rng(t.k + 301)} fruit={t.fruit} />)}
          {grass && g.g1.map((t, i) => <Tuft key={i} x={t.x} y={t.y} h={t.h} c="var(--grass-b)" r={rng(i + 401)} />)}</g>
        <g className="layer" style={L(8, 60)}><path d={g.p0} fill="var(--hill-0)" />{grass && g.g0.map((t, i) => <Tuft key={i} x={t.x} y={t.y} h={t.h} c="var(--grass-a)" r={rng(i + 501)} />)}</g>
        <g>{g.leaves.map((l, i) => <path key={i} className="leaf-drift" d="M0 0C6-6 16-4 18 4 10 8 2 6 0 0z" fill={l.a ? "var(--grass-b)" : "var(--harvest)"} opacity=".8" transform={`translate(${l.x.toFixed(0)} ${l.y.toFixed(0)})`}
          style={{ ["--dx" as any]: `${l.dx.toFixed(0)}px`, ["--dy" as any]: `${l.dy.toFixed(0)}px`, ["--rot" as any]: `${l.rot.toFixed(0)}deg`, ["--dur" as any]: `${l.dur.toFixed(0)}s`, ["--delay" as any]: `${l.dl.toFixed(0)}s` }} />)}</g>
        <g className="night-only">{g.flies.map((f, i) => <circle key={i} className="twinkle" cx={f.x} cy={f.y} r="2.2" fill="#E9D97A" style={{ ["--dur" as any]: f.d, ["--delay" as any]: f.dl }} />)}</g>
      </svg>
    </div>
  );
}
