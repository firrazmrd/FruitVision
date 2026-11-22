import { useState } from "react";
import { Alert, Badge, ErrorState, Modal, PageHeader, Skeleton, useToast } from "../components/ui";
import { Icon } from "../components/icons";
import { usePrefs } from "../prefs";
import { useAsync } from "../hooks";
import { bytes, del, errText, get, post, type ModelRow } from "../api";

const Row = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-4 flex-wrap" style={{ padding: ".85rem 0", borderTop: "1px solid var(--line)" }}><div style={{ maxWidth: "28rem" }}><div style={{ fontWeight: 600 }}>{title}</div>{hint && <div className="xs muted">{hint}</div>}</div><div>{children}</div></div>
);
export default function Settings() {
  const toast = useToast(); const p = usePrefs();
  const models = useAsync(() => get<ModelRow[]>("/api/models")); const store = useAsync(() => get<any>("/api/storage")); const health = useAsync(() => get<any>("/api/health"));
  const [pick, setPick] = useState<Record<string, string>>({}); const [confirm, setConfirm] = useState<"history" | "cache" | null>(null), [busy, setBusy] = useState(false);
  const ms_ = models.data ?? []; const by = (t: string) => ms_.filter(m => m.task === t); const cur = (t: string) => pick[t] ?? by(t).find(m => m.active)?.id ?? by(t)[0]?.id ?? "";
  const activate = async (body: Record<string, string>) => { setBusy(true); try { await post("/api/models/activate", body); toast("Model aktif diperbarui."); models.reload(); } catch (e) { toast(errText(e), "err"); } finally { setBusy(false); } };
  const doConfirm = async () => { try { if (confirm === "history") { const r = await del<any>("/api/history"); toast(`${r.deleted} riwayat dihapus.`); } else { const r = await del<any>("/api/storage/cache"); toast(`${r.deleted} berkas cache dihapus.`); store.reload(); } } catch (e) { toast(errText(e), "err"); } setConfirm(null); };
  const opt = (m: ModelRow) => `${m.id}${m.val_macro_f1 != null ? ` (F1 val ${m.val_macro_f1.toFixed(3)})` : ""}`;

  return (
    <div style={{ display: "grid", gap: "1.5rem", maxWidth: 860 }}>
      <PageHeader eyebrow="Settings" title="Preferensi dan penyimpanan">Preferensi tampilan disimpan di browser ini. Model, riwayat, dan cache disimpan di komputer Anda.</PageHeader>

      <section className="card" aria-labelledby="s-ap"><h3 id="s-ap" className="h3" style={{ marginTop: 0 }}>Tampilan</h3>
        <Row title="Tema" hint="Mode gelap memakai palet perkebunan senja."><div className="tabs" role="radiogroup" aria-label="Tema">{(["light", "dark", "system"] as const).map(t => <button key={t} role="radio" aria-checked={p.themePref === t} className="tab" style={p.themePref === t ? { background: "var(--surface)", color: "var(--head)" } : undefined} onClick={() => p.setThemePref(t)}>{t === "light" ? "Terang" : t === "dark" ? "Gelap" : "Sistem"}</button>)}</div></Row>
        <Row title="Animasi" hint="'Sistem' mengikuti pengaturan mengurangi gerakan di perangkat Anda."><select className="select" aria-label="Animasi" value={p.motionPref} onChange={e => p.setMotionPref(e.target.value as any)}><option value="system">Ikuti sistem</option><option value="full">Penuh</option><option value="reduced">Dikurangi</option></select></Row>
        <Row title="Scrollbar apel" hint="Indikator scroll dekoratif. Scroll bawaan browser tetap dipakai."><input type="checkbox" className="switch" role="switch" aria-label="Scrollbar apel" checked={p.apple} onChange={e => p.setApple(e.target.checked)} /></Row>
      </section>

      <section className="card" aria-labelledby="s-md"><h3 id="s-md" className="h3" style={{ marginTop: 0 }}>Model aktif</h3>
        {models.loading ? <Skeleton h={90} /> : models.error ? <ErrorState message={models.error} onRetry={models.reload} /> : !ms_.length ? <Alert kind="warn" title="Belum ada model">Latih model dengan <span className="mono">python -m app.cv.experiments --run</span>, lalu muat ulang halaman ini.</Alert> : (
          <div style={{ display: "grid", gap: "1rem" }}>
            {by("fruit").length > 0 && by("condition").length > 0 ? <div className="even-2"><div className="field"><label htmlFor="m-f">Model jenis buah</label><select id="m-f" className="select" value={cur("fruit")} onChange={e => setPick({ ...pick, fruit: e.target.value })}>{by("fruit").map(m => <option key={m.id} value={m.id}>{opt(m)}</option>)}</select></div>
              <div className="field"><label htmlFor="m-c">Model kondisi</label><select id="m-c" className="select" value={cur("condition")} onChange={e => setPick({ ...pick, condition: e.target.value })}>{by("condition").map(m => <option key={m.id} value={m.id}>{opt(m)}</option>)}</select></div></div> : <Alert kind="warn">Dua model terpisah (jenis buah dan kondisi) belum lengkap.</Alert>}
            <div className="flex flex-wrap gap-2"><button className="btn btn-primary btn-sm" disabled={busy || !cur("fruit") || !cur("condition")} onClick={() => activate({ fruit: cur("fruit"), condition: cur("condition") })}>Aktifkan pasangan ini</button>
              {by("joint").length > 0 && <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => activate({ joint: cur("joint") })}>Pakai model 16 kelas ({cur("joint")})</button>}</div>
            <p className="xs muted" style={{ margin: 0 }}>Untuk memilih model, gunakan Macro F1 pada <strong>validation</strong> (angka test hanya untuk pelaporan). Aktif sekarang: {ms_.filter(m => m.active).map(m => <Badge key={m.id} tone="info">{m.id}</Badge>)}{!ms_.some(m => m.active) && "belum ada"}</p></div>)}</section>

      <section className="card" aria-labelledby="s-hi"><h3 id="s-hi" className="h3" style={{ marginTop: 0 }}>Riwayat</h3>
        <Row title="Simpan hasil scan" hint="Menyimpan hasil ringkas + thumbnail 256 px di komputer ini. Gambar asli tidak disimpan."><input type="checkbox" className="switch" role="switch" aria-label="Simpan hasil scan" checked={p.saveHistory} onChange={e => p.setSaveHistory(e.target.checked)} /></Row>
        <Row title="Hapus seluruh riwayat"><button className="btn btn-danger btn-sm" onClick={() => setConfirm("history")}><Icon name="trash" size={15} />Hapus</button></Row></section>

      <section className="card" aria-labelledby="s-st"><h3 id="s-st" className="h3" style={{ marginTop: 0 }}>Penyimpanan</h3>
        {store.loading ? <Skeleton h={120} /> : store.error ? <ErrorState message={store.error} onRetry={store.reload} /> : (<>
          <dl className="kv"><dt>Folder induk</dt><dd>{store.data.locations.home ?? "(tidak diatur; memakai default per folder)"}</dd><dt>Dataset (hanya baca)</dt><dd>{store.data.locations.dataset}</dd><dt>Data (meta, split)</dt><dd>{store.data.locations.data}</dd><dt>Cache fitur</dt><dd>{store.data.locations.cache} ({bytes(store.data.bytes.cache)}, {store.data.cache_files} berkas)</dd>
            <dt>Model</dt><dd>{store.data.locations.artifacts} ({bytes(store.data.bytes.models)})</dd><dt>Hasil eksperimen</dt><dd>{store.data.locations.results} ({bytes(store.data.bytes.results)})</dd><dt>Riwayat</dt><dd>{bytes(store.data.bytes.history)}</dd></dl>
          <Row title="Hapus cache fitur" hint="Aman: cache dihitung ulang otomatis saat eksperimen berikutnya. Model dan hasil tidak terhapus."><button className="btn btn-danger btn-sm" disabled={!store.data.cache_files} onClick={() => setConfirm("cache")}><Icon name="trash" size={15} />Hapus cache</button></Row></>)}</section>

      <section className="card" aria-labelledby="s-bk"><h3 id="s-bk" className="h3" style={{ marginTop: 0 }}>Backend</h3>{health.loading ? <Skeleton h={30} /> : health.error ? <ErrorState message={health.error} onRetry={health.reload} /> : <dl className="kv"><dt>Status</dt><dd>online</dd><dt>Versi API</dt><dd>{health.data.version}</dd><dt>Job berjalan</dt><dd>{health.data.job_running ? "ya" : "tidak"}</dd></dl>}</section>

      {confirm && <Modal title={confirm === "history" ? "Hapus seluruh riwayat?" : "Hapus cache fitur?"} onClose={() => setConfirm(null)} footer={<><button className="btn btn-ghost btn-sm" onClick={() => setConfirm(null)}>Batal</button><button className="btn btn-danger btn-sm" onClick={doConfirm}>Hapus</button></>}>
        <p className="soft" style={{ margin: 0 }}>{confirm === "history" ? "Semua hasil scan dan thumbnail dihapus permanen." : "Berkas cache fitur (features_*.npz) dihapus. Training berikutnya akan menghitung ulang fitur."}</p></Modal>}
    </div>
  );
}
