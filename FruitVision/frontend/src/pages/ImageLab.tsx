import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Icon } from "../components/icons";
import { HBars } from "../components/charts";
import { Alert, Badge, Empty, Skeleton, Spinner, Tabs, PageHeader } from "../components/ui";
import { dsThumb, errText, ms, pct, upload } from "../api";

type Method = "none" | "hsv" | "grabcut";
export default function ImageLab() {
  const [sp] = useSearchParams(); const dsPath = sp.get("path");
  const [file, setFile] = useState<File | null>(null), [method, setMethod] = useState<Method>("grabcut"), [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null), [r, setR] = useState<any>(null), [tab, setTab] = useState<"seg" | "feat" | "param">("seg");
  const input = useRef<HTMLInputElement>(null);
  const run = async (f: File | null = file, m: Method = method) => {
    if (!f && !dsPath) return; setBusy(true); setErr(null); const fd = new FormData(); if (f) fd.append("file", f); else fd.append("path", dsPath!); fd.append("method", m);
    try { setR(await upload("/api/processing/analyze", fd)); } catch (e) { setErr(errText(e)); setR(null); } finally { setBusy(false); }
  };
  useEffect(() => { if (dsPath && !file) run(null); /* eslint-disable-next-line */ }, [dsPath]);
  const F = r?.features;

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <PageHeader eyebrow="Image processing lab" title="Lihat setiap tahap pengolahan citra">Fungsi yang dipakai di sini sama dengan yang dipakai saat training dan inferensi, jadi apa yang Anda lihat adalah apa yang dihitung model.</PageHeader>
      <div className="card flat"><div className="flex flex-wrap items-end gap-3">
        <div className="field" style={{ minWidth: 220 }}><label htmlFor="lab-file">Gambar</label>
          <div className="flex items-center gap-2"><button id="lab-file" className="btn btn-secondary" onClick={() => input.current?.click()}><Icon name="upload" size={17} />{file ? "Ganti file" : "Pilih file"}</button>
            <span className="small soft" style={{ overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220 }}>{file ? file.name : dsPath ? "dari dataset" : "belum dipilih"}</span></div>
          <input ref={input} type="file" accept="image/jpeg,image/png" className="sr-only" tabIndex={-1} aria-label="Pilih file gambar" onChange={e => { const f = e.target.files?.[0] ?? null; if (f) { setFile(f); run(f); } e.target.value = ""; }} /></div>
        <div className="field"><label htmlFor="lab-m">Metode untuk fitur</label><select id="lab-m" className="select" value={method} onChange={e => { const m = e.target.value as Method; setMethod(m); if (file || dsPath) run(file, m); }}><option value="grabcut">GrabCut</option><option value="hsv">HSV-Otsu</option><option value="none">Tanpa segmentasi</option></select></div>
        <button className="btn btn-primary" onClick={() => run()} disabled={busy || (!file && !dsPath)}>{busy ? <Spinner /> : <Icon name="flask" size={18} />}Analisis</button>
        {dsPath && !file && <img className="thumb" src={dsThumb(dsPath, 96)} alt="Gambar dari dataset" />}
      </div></div>
      {err && <Alert kind="err" title="Analisis gagal">{err}</Alert>}
      {busy && !r && <div className="even-3"><Skeleton h={220} /><Skeleton h={220} /><Skeleton h={220} /></div>}
      {!r && !busy && !err && <div className="card"><Empty icon="flask" title="Belum ada gambar">Pilih gambar sendiri atau buka salah satu contoh dari <Link to="/app/library">Fruit Library</Link>.</Empty></div>}
      {r && (<>
        <div className="flex items-center justify-between flex-wrap gap-3"><Tabs value={tab} onChange={setTab} label="Hasil lab" items={[{ id: "seg", label: "Segmentasi" }, { id: "feat", label: "Fitur" }, { id: "param", label: "Parameter" }]} /><span className="mono small muted">{ms(r.processing_ms)}{busy && " · memperbarui…"}</span></div>
        {tab === "seg" && (
          <div style={{ display: "grid", gap: "1rem" }}>
            <div className="even-3"><figure style={{ margin: 0 }}><div className="frame"><img src={r.original_resized} alt="Gambar asli 224 kali 224" /><span className="tag">Resized {r.size}</span></div></figure>
              <figure style={{ margin: 0 }}><div className="frame"><img src={r.hsv_representation} alt="Representasi HSV" /><span className="tag">HSV channels</span></div></figure></div>
            {(["hsv", "grabcut"] as const).map(m => { const d = r.methods[m]; return (
              <div key={m} className="plate"><div className="flex items-center gap-3" style={{ marginBottom: ".75rem" }}><h3 className="h3" style={{ margin: 0 }}>{m === "hsv" ? "HSV-Otsu" : "GrabCut"}</h3>{d.failed ? <Badge tone="rotten">Gagal</Badge> : <Badge tone="fresh">Berhasil · foreground {pct(d.foreground_ratio)}</Badge>}</div>
                {d.failed && <p className="small soft" style={{ marginTop: 0 }}>{d.message} Tidak ada fallback otomatis.</p>}
                <div className="even-3">{[["Mask mentah", d.raw_mask], ["Mask setelah morfologi", d.morph_mask], ["Hasil", d.result]].map(([t, src]) => src ? <figure key={t as string} style={{ margin: 0 }}><div className="frame"><img src={src as string} alt={`${t} ${m}`} /><span className="tag">{t}</span></div></figure> : null)}</div></div>); })}
          </div>)}
        {tab === "feat" && (!F ? <Alert kind="warn" title="Fitur tidak tersedia">Segmentasi dengan metode terpilih gagal, jadi fitur tidak dapat dihitung. Pilih metode lain.</Alert> : (
          <div className="even-2">
            <div className="card"><h3 className="h3" style={{ marginTop: 0 }}>Histogram warna (hue)</h3><p className="xs muted">Marginal 8 bin hue dari histogram HSV {F.dims.color} dimensi.</p>
              <HBars label="Marginal hue" rows={F.hue_marginal.map((v: number, i: number) => ({ key: String(i), label: `Hue ${i + 1}/8`, value: Math.min(1, v / Math.max(...F.hue_marginal)), text: v.toFixed(3) }))} /></div>
            <div className="card"><h3 className="h3" style={{ marginTop: 0 }}>HOG ({F.dims.hog} dimensi)</h3><div className="frame"><img src={F.hog_visualization} alt="Visualisasi HOG" /><span className="tag">HOG</span></div></div>
            <div className="card"><h3 className="h3" style={{ marginTop: 0 }}>GLCM ({F.dims.glcm} dimensi)</h3><dl className="kv">{Object.entries(F.glcm).map(([k, v]) => [<dt key={k + "t"}>{k}</dt>, <dd key={k + "d"}>{(v as number).toFixed(5)}</dd>])}</dl></div>
            <div className="card"><h3 className="h3" style={{ marginTop: 0 }}>Dimensi fitur</h3><dl className="kv">{Object.entries(F.dims).map(([k, v]) => [<dt key={k + "t"}>{k}</dt>, <dd key={k + "d"}>{String(v)}</dd>])}</dl></div>
          </div>))}
        {tab === "param" && (!F ? <Alert kind="warn">Parameter fitur tersedia setelah ekstraksi berhasil.</Alert> : (
          <div className="even-2"><div className="card"><h3 className="h3" style={{ marginTop: 0 }}>HOG</h3><dl className="kv">{Object.entries(F.hog_params).map(([k, v]) => [<dt key={k + "t"}>{k}</dt>, <dd key={k + "d"}>{String(v)}</dd>])}</dl></div>
            <div className="card"><h3 className="h3" style={{ marginTop: 0 }}>GLCM</h3><dl className="kv">{Object.entries(F.glcm_params).map(([k, v]) => [<dt key={k + "t"}>{k}</dt>, <dd key={k + "d"}>{Array.isArray(v) ? v.join(", ") : String(v)}</dd>])}</dl></div></div>))}
      </>)}
    </div>
  );
}
