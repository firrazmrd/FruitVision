import { Link } from "react-router-dom";
import { Icon } from "../components/icons";
import { HBars, StackBar } from "../components/charts";
import { Badge, CondBadge, Empty, ErrorState, PageHeader, Reveal, Skeleton, Stat } from "../components/ui";
import { useAsync } from "../hooks";
import { FRUITS, fruitName, get, histThumb, pct, when, type HistoryItem, type HistorySummary, type ModelRow, type Readiness } from "../api";

export default function Overview() {
  const sum = useAsync(() => get<HistorySummary>("/api/history/summary"));
  const recent = useAsync(() => get<{ total: number; items: HistoryItem[] }>("/api/history?limit=5"));
  const models = useAsync(() => get<ModelRow[]>("/api/models"));
  const ready = useAsync(() => get<Readiness>("/api/dataset/status"));
  if (sum.error && sum.status === 0) return <ErrorState message={sum.error} onRetry={() => { sum.reload(); recent.reload(); models.reload(); ready.reload(); }} />;
  const s = sum.data; const active = (models.data ?? []).filter(m => m.active); const maxF = Math.max(1, ...Object.values(s?.by_fruit ?? {}));
  const checks: [string, boolean | null][] = ready.data ? [
    ["Dataset tervalidasi", !!ready.data.validation?.passed], ["Manifest split dibuat", ready.data.manifest?.status === "ok"], ["Metode segmentasi dipilih", !!ready.data.segmentation_selection],
    ["Model terlatih tersedia", ready.data.artifacts_exist], ["Model aktif dipilih", active.length > 0]] : [];

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <Reveal><section className="plate grid-paper" style={{ padding: "clamp(1.25rem,3vw,2.25rem)" }}>
        <div className="split" style={{ alignItems: "center" }}>
          <div style={{ display: "grid", gap: ".8rem", justifyItems: "start" }}><span className="eyebrow">Workspace</span>
            <h2 className="display" style={{ fontSize: "clamp(2rem,4.2vw,3.3rem)", margin: 0 }}>Selamat datang di <em>Orchard Lab.</em></h2>
            <p className="lead" style={{ margin: 0 }}>Periksa jenis dan kesegaran buah dari foto, lihat segmentasinya, dan tinjau riwayat analisis Anda.</p>
            <div className="flex flex-wrap gap-3"><Link to="/app/scanner" className="btn btn-primary"><Icon name="scan" size={18} />Mulai scan</Link><Link to="/app/lab" className="btn btn-secondary">Buka Image Lab</Link></div></div>
          <div className="card flat" style={{ background: "var(--surface-3)" }}>
            <div className="flex items-center justify-between" style={{ marginBottom: ".6rem" }}><span className="eyebrow">Model aktif</span><Link to="/app/settings" className="xs">Kelola</Link></div>
            {models.loading ? <Skeleton h={60} /> : active.length ? <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: ".6rem" }}>{active.map(m => <li key={m.id} className="flex justify-between gap-3 small"><span><Badge tone="info">{m.task}</Badge> <span className="mono">{m.id}</span></span><span className="mono muted" title="Macro F1 validation">F1 val {m.val_macro_f1 != null ? m.val_macro_f1.toFixed(3) : "-"}</span></li>)}</ul>
              : <p className="small soft" style={{ margin: 0 }}>Belum ada model aktif. Latih model lewat CLI lalu aktifkan di Settings.</p>}
          </div>
        </div>
      </section></Reveal>

      <div className="even-4">
        {sum.loading ? [0, 1, 2, 3].map(i => <div key={i} className="card"><Skeleton h={54} /></div>) : <>
          <Reveal><div className="card"><Stat label="Total analisis" value={s?.total ?? 0} hint={s?.last ? `Terakhir ${when(s.last)}` : "Belum ada"} /></div></Reveal>
          <Reveal delay={60}><div className="card"><Stat label="Fresh" value={s?.by_condition.fresh ?? 0} hint="prediksi" /></div></Reveal>
          <Reveal delay={120}><div className="card"><Stat label="Rotten" value={s?.by_condition.rotten ?? 0} hint="prediksi" /></div></Reveal>
          <Reveal delay={180}><div className="card"><Stat label="Segmentasi gagal" value={s?.failed ?? 0} hint="tanpa prediksi" /></div></Reveal></>}
      </div>

      <div className="split">
        <Reveal><div className="card"><h3 className="h3" style={{ marginTop: 0 }}>Distribusi hasil</h3>
          {sum.loading ? <Skeleton h={120} /> : !s || s.accepted === 0 ? <Empty icon="chart" title="Belum ada data analisis" action={<Link to="/app/scanner" className="btn btn-primary btn-sm">Analisis gambar pertama</Link>}>Grafik distribusi akan muncul dari hasil analisis nyata Anda. Tidak ada angka contoh.</Empty> : (
            <div style={{ display: "grid", gap: "1.5rem" }}>
              <StackBar label="Kondisi" parts={[{ key: "f", label: "Fresh", value: s.by_condition.fresh ?? 0, tone: "fresh" }, { key: "r", label: "Rotten", value: s.by_condition.rotten ?? 0, tone: "rotten" }]} />
              <HBars label="Jenis buah" rows={FRUITS.filter(f => (s.by_fruit[f.id] ?? 0) > 0).map(f => ({ key: f.id, label: f.en, value: (s.by_fruit[f.id] ?? 0) / maxF, text: String(s.by_fruit[f.id]) }))} />
              <p className="xs muted" style={{ margin: 0 }}>Rata-rata confidence: jenis {pct(s.mean_confidence.fruit)} · kondisi {pct(s.mean_confidence.condition)} (probabilitas model, bukan akurasi).</p></div>)}</div></Reveal>

        <div style={{ display: "grid", gap: "1.25rem" }}>
          <Reveal delay={80}><div className="card"><div className="flex items-center justify-between"><h3 className="h3" style={{ margin: 0 }}>Analisis terbaru</h3><Link to="/app/history" className="xs">Semua</Link></div>
            {recent.loading ? <div style={{ marginTop: ".8rem" }}><Skeleton h={52} /></div> : !recent.data?.items.length ? <p className="small soft">Belum ada riwayat.</p> :
              <ul style={{ listStyle: "none", margin: ".8rem 0 0", padding: 0, display: "grid", gap: ".7rem" }}>{recent.data.items.map(r => (
                <li key={r.id} className="flex items-center gap-3"><img className="thumb" src={histThumb(r.id)} alt="" loading="lazy" /><div style={{ minWidth: 0, flex: 1 }}><div className="small" style={{ fontWeight: 600 }}>{r.accepted ? fruitName(r.fruit?.label) : "Segmentasi gagal"}</div><div className="xs muted">{when(r.created_at)}</div></div>{r.accepted && <CondBadge c={r.condition?.label} />}</li>))}</ul>}</div></Reveal>
          <Reveal delay={140}><div className="card"><h3 className="h3" style={{ marginTop: 0 }}>Kesiapan sistem</h3>
            {ready.loading ? <Skeleton h={100} /> : ready.error ? <p className="small soft">{ready.error}</p> : <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: ".5rem" }}>{checks.map(([l, ok]) => <li key={l} className="flex items-center justify-between gap-3 small"><span>{l}</span><Badge tone={ok ? "fresh" : "warn"}>{ok ? "Selesai" : "Belum"}</Badge></li>)}</ul>}</div></Reveal>
        </div>
      </div>
    </div>
  );
}
