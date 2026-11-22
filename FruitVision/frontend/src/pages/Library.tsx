import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FruitGlyph } from "../components/art";
import { Alert, PageHeader, Reveal, Skeleton, Spinner } from "../components/ui";
import { useAsync } from "../hooks";
import { FRUITS, dsThumb, errText, get } from "../api";

interface Cls { name: string; fruit: string; condition: string; found: number; excluded: number }
type Img = { path: string; label: string };

function FruitCard({ f, counts }: { f: (typeof FRUITS)[number]; counts?: Record<string, number> }) {
  const nav = useNavigate(); const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null), [imgs, setImgs] = useState<Img[] | null>(null);
  const toggle = async () => {
    if (open) return setOpen(false); setOpen(true); if (imgs) return; setBusy(true); setErr(null);
    try { const [a, b] = await Promise.all(["fresh", "rotten"].map(c => get<{ items: Img[] }>(`/api/dataset/images?label=${f.id}_${c}&limit=4`))); setImgs([...a.items, ...b.items]); } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  };
  return (
    <article className="card" style={{ display: "grid", gap: ".8rem", alignContent: "start" }}>
      <div className="flex items-center gap-3"><FruitGlyph name={f.id} size={52} /><div><h3 className="h3" style={{ margin: 0 }}>{f.en}</h3><span className="xs muted">{f.id_}</span></div></div>
      <div className="chip-row"><span className="badge fresh">Fresh{counts ? ` · ${counts.fresh ?? 0}` : ""}</span><span className="badge rotten">Rotten{counts ? ` · ${counts.rotten ?? 0}` : ""}</span></div>
      <button className="btn btn-secondary btn-sm" onClick={toggle} aria-expanded={open}>{open ? "Sembunyikan contoh" : "Lihat contoh dataset"}</button>
      {open && (busy ? <Spinner label="Memuat…" /> : err ? <Alert kind="warn">{err}</Alert> : imgs && imgs.length ? (
        <div><div className="even-4" style={{ gap: ".4rem" }}>{imgs.map(i => <button key={i.path} className="frame" style={{ cursor: "pointer", padding: 0 }} onClick={() => nav(`/app/lab?path=${encodeURIComponent(i.path)}`)} aria-label={`Buka ${i.label.replace("_", " ")} di Image Lab`}><img src={dsThumb(i.path, 128)} alt={i.label.replace("_", " ")} loading="lazy" style={{ objectFit: "cover" }} /></button>)}</div>
          <p className="xs muted" style={{ marginBottom: 0 }}>4 pertama per kondisi (Fresh lalu Rotten). Klik untuk membukanya di Image Lab.</p></div>) : <p className="xs muted" style={{ margin: 0 }}>Tidak ada contoh.</p>)}
    </article>
  );
}

export default function Library() {
  const cls = useAsync(() => get<Cls[]>("/api/dataset/classes")); const by: Record<string, Record<string, number>> = {};
  (cls.data ?? []).forEach(c => { (by[c.fruit] ??= {})[c.condition] = c.found; });
  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <PageHeader eyebrow="Fruit library" title="Delapan buah, dua kondisi">Model hanya mengenali kelas berikut. <strong>Fresh</strong> dan <strong>Rotten</strong> adalah label dataset (segar vs busuk), bukan tingkat kematangan.</PageHeader>
      {cls.loading ? <Skeleton h={30} w={260} /> : cls.error ? <Alert kind="info" title="Jumlah gambar belum tersedia">Dataset belum divalidasi atau backend belum tersambung ({cls.error}). Daftar buah di bawah tetap berlaku.</Alert> : <p className="small muted" style={{ margin: 0 }}>Angka pada lencana = jumlah gambar asli tervalidasi per kelas.</p>}
      <div className="fruit-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>{FRUITS.map((f, i) => <Reveal key={f.id} delay={(i % 3) * 70}><FruitCard f={f} counts={by[f.id]} /></Reveal>)}</div>
    </div>
  );
}
