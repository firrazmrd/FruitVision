import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../components/icons";
import { Alert, Badge, Bar, CondBadge, Empty, Skeleton, Spinner, Tabs, useToast } from "../components/ui";
import { usePrefs } from "../prefs";
import { useAsync, usePoll } from "../hooks";
import { bytes, condName, errText, fruitName, get, isDown, ApiError, pct, ms, upload, uploadProgress, type Classification, type Pred } from "../api";

type Phase = "idle" | "selected" | "uploading" | "processing" | "done" | "error";
const MAX = 15 * 1024 * 1024, OK_TYPES = ["image/jpeg", "image/png"];
type StepState = "pending" | "active" | "done" | "fail";

function Steps({ phase, res, failedAt }: { phase: Phase; res: Classification | null; failedAt: number | null }) {
  const names = ["Validasi & unggah", "Preprocessing (224 × 224)", "Segmentasi", "Inferensi model", "Hasil"];
  const st = (i: number): StepState => {
    if (failedAt === i) return "fail";
    if (phase === "idle" || phase === "selected") return "pending";
    if (phase === "uploading") return i === 0 ? "active" : "pending";
    if (phase === "processing") return i === 0 ? "done" : i <= 3 ? "active" : "pending";   // server menjalankan langkah 2-4 dalam satu permintaan
    if (phase === "done") { if (res && !res.accepted) return i < 2 ? "done" : i === 2 ? "fail" : "pending"; return "done"; }
    return "pending";
  };
  return (
    <ol className="steps" aria-label="Alur pemrosesan">{names.map((n, i) => { const s = st(i); return (
      <li key={n} className={`step ${s === "pending" ? "" : s}`} aria-current={s === "active" ? "step" : undefined}>
        <span className="dot">{s === "done" ? <Icon name="check" size={14} /> : s === "fail" ? <Icon name="close" size={14} /> : s === "active" ? <span className="spinner" style={{ width: 12, height: 12 }} /> : i + 1}</span><span>{n}</span>
        <span className="sr-only">{s === "done" ? "selesai" : s === "fail" ? "gagal" : s === "active" ? "berjalan" : "menunggu"}</span></li>); })}</ol>
  );
}

function PredBlock({ title, p, kind }: { title: string; p: Pred; kind: "fruit" | "condition" }) {
  const tone = kind === "condition" ? (p.label === "fresh" ? "fresh" : "rotten") : "";
  return (
    <div className={`verdict ${tone}`}>
      <span className="eyebrow">{title}</span>
      <div className="flex items-center justify-between gap-3 flex-wrap"><span className="big">{kind === "fruit" ? fruitName(p.label) : condName(p.label)}</span>{kind === "condition" && <CondBadge c={p.label} />}</div>
      <div style={{ display: "grid", gap: ".3rem", marginTop: ".4rem" }}><div className="flex justify-between small"><span className="soft">Confidence</span><span className="mono" style={{ fontWeight: 500 }}>{pct(p.confidence)}</span></div><Bar value={p.confidence} tone={tone as any} /></div>
      <details style={{ marginTop: ".4rem" }}><summary>Kemungkinan lain</summary>
        <ul style={{ listStyle: "none", margin: ".4rem 0 0", padding: 0, display: "grid", gap: ".25rem" }}>{p.top.map(t => <li key={t.label} className="flex justify-between small"><span>{kind === "fruit" ? fruitName(t.label) : condName(t.label)}</span><span className="mono">{pct(t.probability)}</span></li>)}</ul></details>
    </div>
  );
}

export default function Scanner() {
  const { saveHistory } = usePrefs(); const toast = useToast();
  const [file, setFile] = useState<File | null>(null), [url, setUrl] = useState<string | null>(null), [dim, setDim] = useState<{ w: number; h: number } | null>(null), [invalid, setInvalid] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle"), [pctUp, setPctUp] = useState(0), [res, setRes] = useState<Classification | null>(null);
  const [err, setErr] = useState<{ msg: string; down: boolean; noModel: boolean } | null>(null);
  const [tab, setTab] = useState<"result" | "compare">("result"), [cmp, setCmp] = useState<any>(null), [cmpBusy, setCmpBusy] = useState(false), [cmpErr, setCmpErr] = useState<string | null>(null);
  const [drag, setDrag] = useState(false); const input = useRef<HTMLInputElement>(null);
  const health = usePoll(() => get("/api/health"), 6000); const act = useAsync(() => get<{ active: any }>("/api/models/active"), []);
  const down = !!health.error && !health.data; const noModel = !!act.data && !act.data.active; const busy = phase === "uploading" || phase === "processing";

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  const reset = useCallback(() => { setFile(null); setUrl(null); setDim(null); setInvalid(null); setPhase("idle"); setRes(null); setErr(null); setCmp(null); setCmpErr(null); setTab("result"); if (input.current) input.current.value = ""; }, []);

  const pick = useCallback((f: File | null | undefined) => {
    if (!f) return; setRes(null); setErr(null); setCmp(null); setCmpErr(null); setTab("result");
    if (!OK_TYPES.includes(f.type)) { setInvalid(`Format tidak didukung (${f.type || "tidak dikenal"}). Gunakan JPG atau PNG.`); setFile(null); setUrl(null); setPhase("idle"); return; }
    if (f.size === 0) { setInvalid("File kosong."); setFile(null); setUrl(null); setPhase("idle"); return; }
    if (f.size > MAX) { setInvalid(`File ${bytes(f.size)} melebihi batas 15 MB.`); setFile(null); setUrl(null); setPhase("idle"); return; }
    const u = URL.createObjectURL(f); const im = new Image();
    im.onload = () => { setInvalid(null); setFile(f); setUrl(u); setDim({ w: im.naturalWidth, h: im.naturalHeight }); setPhase("selected"); };
    im.onerror = () => { URL.revokeObjectURL(u); setInvalid("Gambar rusak atau tidak dapat dibaca."); setFile(null); setUrl(null); setPhase("idle"); };
    im.src = u;
  }, []);

  const run = async () => {
    if (!file || busy) return; setErr(null); setRes(null); setCmp(null); setTab("result");
    const fd = new FormData(); fd.append("file", file);
    try {
      const r = await uploadProgress<Classification>(`/api/classify?save=${saveHistory}`, fd, (p, v) => { setPhase(p); setPctUp(v); });
      setRes(r); setPhase("done"); if (r.accepted) toast("Analisis selesai."); else toast("Segmentasi gagal; tidak ada prediksi.", "err");
    } catch (e) { setErr({ msg: errText(e), down: isDown(e), noModel: e instanceof ApiError && e.status === 409 }); setPhase("error"); }
  };
  const loadCompare = async () => {
    if (!file) return; setCmpBusy(true); setCmpErr(null); const fd = new FormData(); fd.append("file", file);
    try { setCmp(await upload("/api/processing/compare-segmentation", fd)); } catch (e) { setCmpErr(errText(e)); } finally { setCmpBusy(false); }
  };
  useEffect(() => { if (tab === "compare" && !cmp && !cmpBusy && file && !cmpErr) loadCompare(); /* eslint-disable-next-line */ }, [tab]);

  const failedAt = phase === "error" && !err?.noModel && !err?.down ? 0 : null;

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <header style={{ display: "grid", gap: ".4rem" }}><span className="eyebrow">Laboratory workspace</span><h2 className="h2" style={{ margin: 0 }}>Analisis satu gambar buah</h2>
        <p className="soft" style={{ margin: 0, maxWidth: "44rem" }}>Unggah foto, jalankan analisis, lalu bandingkan hasil segmentasinya. Hasil berasal dari model yang aktif di backend.</p></header>

      {down && <Alert kind="err" title="Backend tidak terhubung">Pastikan server API berjalan di 127.0.0.1:8000 (jalankan <span className="mono">run-backend.ps1</span>). Analisis dinonaktifkan sampai backend tersedia.</Alert>}
      {!down && noModel && <Alert kind="warn" title="Belum ada model aktif" action={<Link to="/app/settings" className="btn btn-secondary btn-sm">Buka Settings</Link>}>Latih model dengan CLI (lihat README), lalu aktifkan model jenis buah dan kondisi di Settings.</Alert>}
      <div aria-live="polite" className="sr-only">{phase === "uploading" ? "Mengunggah gambar" : phase === "processing" ? "Server sedang memproses gambar" : phase === "done" ? "Analisis selesai" : phase === "error" ? "Analisis gagal" : ""}</div>

      <div className="split">
        {/* ------------------------------------------------ input + workspace */}
        <div style={{ display: "grid", gap: "1.25rem" }}>
          {!file ? (
            <div role="button" tabIndex={0} className={`dropzone ${drag ? "drag" : ""} ${invalid ? "bad" : ""}`} aria-label="Pilih atau seret gambar buah ke sini"
              onClick={() => input.current?.click()} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.current?.click(); } }}
              onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}>
              <Icon name="upload" size={34} style={{ color: "var(--accent-ink)" }} />
              <strong className="h3">Seret gambar ke sini</strong><span className="small soft">atau klik untuk memilih file (JPG / PNG, maks. 15 MB)</span>
              {invalid && <span className="badge rotten" role="alert"><Icon name="alert" size={13} />{invalid}</span>}
            </div>
          ) : (
            <div className="plate">
              <div className="even-2">
                <figure style={{ margin: 0 }}><div className="frame"><img src={url!} alt={`Pratinjau ${file.name}`} /><span className="tag">Original</span>{busy && <div className="scanline" aria-hidden="true" />}</div></figure>
                <figure style={{ margin: 0 }}><div className="frame">{res?.segmentation ? <><img src={res.segmentation.preview} alt={res.segmentation.preview_is_segmented ? "Hasil segmentasi" : "Gambar tanpa segmentasi"} /><span className="tag">{res.segmentation.preview_is_segmented ? "Segmented" : "No segmentation"}</span></> :
                  <div className="empty" style={{ padding: "1rem" }}>{busy ? <Spinner label="Memproses…" /> : <span className="small muted">{phase === "done" && res && !res.accepted ? "Segmentasi gagal" : "Hasil segmentasi muncul di sini"}</span>}</div>}</div></figure>
              </div>
              <dl className="kv" style={{ marginTop: "1rem" }}><dt>File</dt><dd>{file.name}</dd><dt>Ukuran</dt><dd>{bytes(file.size)}</dd><dt>Dimensi</dt><dd>{dim ? `${dim.w} × ${dim.h} px` : "-"}</dd><dt>Tipe</dt><dd>{file.type}</dd></dl>
              <div className="flex flex-wrap gap-2" style={{ marginTop: "1rem" }}>
                <button className="btn btn-primary" onClick={run} disabled={busy || down || noModel}>{busy ? <Spinner /> : <Icon name="scan" size={18} />}{busy ? (phase === "uploading" ? `Mengunggah ${Math.round(pctUp * 100)}%` : "Memproses…") : phase === "done" ? "Analisis ulang" : "Analyze"}</button>
                <button className="btn btn-secondary" onClick={() => input.current?.click()} disabled={busy}><Icon name="refresh" size={17} />Ganti gambar</button>
                <button className="btn btn-ghost" onClick={reset} disabled={busy}><Icon name="trash" size={17} />Hapus</button>
              </div>
              {invalid && <div style={{ marginTop: ".75rem" }}><Alert kind="err">{invalid}</Alert></div>}
            </div>
          )}
          <input ref={input} type="file" accept="image/jpeg,image/png" className="sr-only" aria-label="Pilih file gambar" tabIndex={-1} onChange={e => { pick(e.target.files?.[0]); e.target.value = ""; }} />

          {phase === "error" && err && (
            err.down ? <Alert kind="err" title="Backend tidak dapat dihubungi">{err.msg}</Alert>
            : err.noModel ? <Alert kind="warn" title="Belum ada model aktif">{err.msg}</Alert>
            : <Alert kind="err" title="Analisis gagal">{err.msg}</Alert>)}

          {phase === "done" && res && file && (
            <div className="card">
              <div className="flex items-center justify-between gap-3 flex-wrap" style={{ marginBottom: ".9rem" }}><h3 className="h3" style={{ margin: 0 }}>Perbandingan segmentasi</h3>
                <Tabs value={tab} onChange={setTab} label="Tampilan" items={[{ id: "result", label: "Ringkasan" }, { id: "compare", label: "HSV vs GrabCut" }]} /></div>
              {tab === "result" ? <p className="small soft" style={{ margin: 0 }}>{res.segmentation?.preview_is_segmented ? `Pratinjau memakai metode ${res.segmentation.methods.join(", ")} sesuai model aktif.` : "Model aktif tidak memakai segmentasi."} Buka tab <strong>HSV vs GrabCut</strong> untuk melihat kedua metode berdampingan.</p>
                : cmpBusy ? <div className="even-3"><Skeleton h={180} /><Skeleton h={180} /><Skeleton h={180} /></div> : cmpErr ? <Alert kind="err">{cmpErr}</Alert> : cmp && (
                  <div className="even-3">
                    <figure style={{ margin: 0 }}><div className="frame"><img src={cmp.original_resized} alt="Gambar asli 224 kali 224" /><span className="tag">Resized 224</span></div></figure>
                    {(["hsv", "grabcut"] as const).map(m => { const d = cmp.methods[m]; return (
                      <figure key={m} style={{ margin: 0 }}><div className="frame">{d.failed ? <div className="empty" style={{ padding: ".75rem" }}><Badge tone="rotten">Gagal</Badge><span className="xs soft">{d.message}</span></div> : <img src={d.result} alt={`Segmentasi ${m}`} />}<span className="tag">{m}</span></div>
                        {!d.failed && <figcaption className="xs muted mono" style={{ marginTop: ".3rem" }}>foreground {pct(d.foreground_ratio)}</figcaption>}</figure>); })}
                  </div>)}
            </div>)}
        </div>

        {/* ------------------------------------------------ alur + hasil */}
        <div style={{ display: "grid", gap: "1.25rem" }}>
          <div className="card"><h3 className="h3" style={{ marginTop: 0 }}>Alur pemrosesan</h3><Steps phase={phase} res={res} failedAt={failedAt} />
            {phase === "uploading" && <div style={{ marginTop: ".75rem" }}><Bar value={pctUp} /></div>}</div>

          <div className="card" aria-live="polite">
            <h3 className="h3" style={{ marginTop: 0 }}>Hasil prediksi</h3>
            {phase === "done" && res ? (res.accepted && res.fruit && res.condition ? (
              <div style={{ display: "grid", gap: ".9rem" }}>
                <PredBlock title="Jenis buah" p={res.fruit} kind="fruit" /><PredBlock title="Kondisi" p={res.condition} kind="condition" />
                <dl className="kv"><dt>Waktu proses</dt><dd>{ms(res.processing_ms)}</dd><dt>Segmentasi</dt><dd>{res.segmentation?.preview_is_segmented ? res.segmentation.methods.join(", ") : "tidak ada"}</dd>{Object.entries(res.models).map(([k, v]) => [<dt key={k + "t"}>Model {k}</dt>, <dd key={k + "d"}>{v}</dd>])}</dl>
                <p className="xs muted" style={{ margin: 0 }}>{res.confidence_note} {res.note}</p>
                {res.history_id ? <p className="xs muted" style={{ margin: 0 }}>Disimpan ke <Link to="/app/history">Scan History</Link>.</p> : !saveHistory ? <p className="xs muted" style={{ margin: 0 }}>Penyimpanan riwayat dimatikan di Settings.</p> : null}
              </div>
            ) : (
              <Alert kind="err" title="Segmentasi gagal, tidak ada prediksi">{res.detail ?? "Buah tidak dapat dipisahkan dari latar."}{"\n"}Coba foto dengan latar lebih polos, atau bandingkan metode di <Link to="/app/lab">Image Lab</Link>.</Alert>
            )) : phase === "uploading" || phase === "processing" ? <div style={{ display: "grid", gap: ".6rem" }}><Skeleton h={22} w="60%" /><Skeleton h={70} /><Skeleton h={70} /></div>
              : phase === "error" ? <p className="small soft" style={{ margin: 0 }}>Tidak ada hasil karena analisis gagal.</p>
              : <Empty icon="scan" title={file ? "Siap dianalisis" : "Belum ada gambar"}>{file ? "Tekan Analyze untuk menjalankan analisis." : "Unggah gambar buah untuk memulai."}</Empty>}
          </div>
        </div>
      </div>
    </div>
  );
}
