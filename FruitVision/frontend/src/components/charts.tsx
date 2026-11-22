// Grafik ringan (HTML/SVG, tanpa library). Semua data berasal dari props; tidak ada nilai bawaan.
import type { ReactNode } from "react";

export interface BarRow { key: string; label: ReactNode; value: number; text: string; tone?: "" | "fresh" | "rotten" | "sun" }

/** Batang horizontal; value 0..1. Teks angka selalu ditampilkan (warna bukan satu-satunya penanda). */
export function HBars({ rows, label }: { rows: BarRow[]; label: string }) {
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: ".7rem" }} aria-label={label}>
      {rows.map(r => (
        <li key={r.key} style={{ display: "grid", gap: ".25rem" }}>
          <div className="flex items-baseline justify-between gap-3"><span className="small" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{r.label}</span><span className="mono small">{r.text}</span></div>
          <div className={`bar ${r.tone ?? ""}`}><i style={{ width: `${Math.max(0, Math.min(1, r.value)) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

export function StackBar({ parts, label }: { parts: { key: string; label: string; value: number; tone: "fresh" | "rotten" | "sun" | "neutral" }[]; label: string }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1; const col = { fresh: "var(--fresh)", rotten: "var(--rotten)", sun: "var(--sun)", neutral: "var(--line-strong)" } as const;
  return (
    <div role="img" aria-label={`${label}: ` + parts.map(p => `${p.label} ${p.value}`).join(", ")}>
      <div style={{ display: "flex", height: 14, borderRadius: 999, overflow: "hidden", background: "var(--surface-2)", gap: 2 }}>{parts.filter(p => p.value > 0).map(p => <div key={p.key} style={{ width: `${(100 * p.value) / total}%`, background: col[p.tone], transition: "width .7s cubic-bezier(.2,.7,.2,1)" }} />)}</div>
      <div className="chip-row" style={{ marginTop: ".6rem" }}>{parts.map(p => <span key={p.key} className="small flex items-center gap-2"><i style={{ width: 10, height: 10, borderRadius: 3, background: col[p.tone], display: "inline-block" }} /><span>{p.label}</span><span className="mono">{p.value}</span></span>)}</div>
    </div>
  );
}

export function Columns({ data, label }: { data: { label: string; value: number }[]; label: string }) {
  const max = Math.max(1, ...data.map(d => d.value)); const w = 36, gap = 10, h = 120;
  return (
    <div className="xscroll">
      <svg role="img" aria-label={label} width={Math.max(220, data.length * (w + gap))} height={h + 34} style={{ display: "block" }}>
        {data.map((d, i) => { const bh = Math.max(3, (d.value / max) * h); const x = i * (w + gap) + gap / 2; return (
          <g key={d.label}><rect x={x} y={h - bh + 16} width={w} height={bh} rx="4" fill="var(--accent)" /><text x={x + w / 2} y={h - bh + 10} textAnchor="middle" fontSize="11" fontFamily="var(--f-mono)" fill="var(--ink)">{d.value}</text>
            <text x={x + w / 2} y={h + 30} textAnchor="middle" fontSize="10" fontFamily="var(--f-mono)" fill="var(--ink-3)">{d.label.slice(5)}</text></g>); })}
      </svg>
    </div>
  );
}

/** Confusion matrix sebagai <table> (dapat dibaca screen reader). Intensitas = proporsi baris; sel salah memakai warna berbeda + angka. */
export function ConfusionMatrix({ labels, matrix }: { labels: string[]; matrix: number[][] }) {
  return (
    <div className="xscroll">
      <table className="mono" style={{ borderCollapse: "separate", borderSpacing: 2, fontSize: ".72rem" }}>
        <caption className="sr-only">Confusion matrix: baris = label sebenarnya, kolom = prediksi</caption>
        <thead><tr><th scope="col" className="xs muted" style={{ textAlign: "left", paddingRight: 8 }}>true \ pred</th>{labels.map(l => <th key={l} scope="col" className="xs muted" style={{ padding: "0 4px 4px", fontWeight: 500, maxWidth: 74, overflow: "hidden", textOverflow: "ellipsis" }} title={l}>{l.length > 9 ? l.slice(0, 8) + "." : l}</th>)}</tr></thead>
        <tbody>{matrix.map((row, i) => { const sum = row.reduce((a, b) => a + b, 0) || 1; return (
          <tr key={labels[i]}><th scope="row" className="xs muted" style={{ textAlign: "left", paddingRight: 8, fontWeight: 500, whiteSpace: "nowrap" }}>{labels[i]}</th>
            {row.map((v, j) => { const p = v / sum; const diag = i === j; const mix = v === 0 ? 0 : 10 + 80 * p;
              return <td key={j} title={`${labels[i]} -> ${labels[j]}: ${v}`} style={{ minWidth: 30, height: 30, textAlign: "center", borderRadius: 4, color: "var(--ink)", background: v === 0 ? "var(--surface-3)" : `color-mix(in srgb, ${diag ? "var(--accent)" : "var(--rotten)"} ${mix}%, var(--surface))`, outline: !diag && v > 0 ? "1.5px solid var(--rotten)" : undefined, outlineOffset: -1.5 }}>{v}</td>; })}</tr>); })}</tbody>
      </table>
    </div>
  );
}
