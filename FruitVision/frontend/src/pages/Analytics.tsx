import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ConfusionMatrix, Columns, HBars, StackBar } from "../components/charts";
import { Badge, Empty, ErrorState, PageHeader, Skeleton, Tabs } from "../components/ui";
import { Icon } from "../components/icons";
import { useAsync } from "../hooks";
import { FRUITS, f4, get, ms, type Experiment, type HistorySummary } from "../api";

interface Bench { experiments: Experiment[]; best_by_validation: Record<string, string>; empty: boolean; note: string }
const label = (e: Experiment) => `${e.feature === "all" ? "Gabungan" : e.feature} + ${e.classifier.toUpperCase()} · ${e.segmentation === "none" ? "tanpa segmentasi" : e.segmentation}`;

export default function Analytics() {
  const bench = useAsync(() => get<Bench>("/api/benchmark/summary")); const sum = useAsync(() => get<HistorySummary>("/api/history/summary"));
  const [taskSel, setTask] = useState<string | null>(null), [sel, setSel] = useState<string | null>(null);
  const exps = bench.data?.experiments ?? []; const tasks = useMemo(() => Array.from(new Set(exps.map(e => e.task))), [exps]); const task = taskSel && tasks.includes(taskSel) ? taskSel : tasks[0] ?? "";
  const rows = useMemo(() => exps.filter(e => e.task === task).sort((a, b) => b.val_macro_f1 - a.val_macro_f1), [exps, task]);
  const detail = useAsync(() => (sel ? get<any>(`/api/benchmark/experiment?id=${encodeURIComponent(sel)}`) : Promise.resolve(null)), [sel]);
  const ablation = useMemo(() => { const m = new Map<string, Experiment[]>(); rows.forEach(e => { const k = `${e.feature}|${e.classifier}`; m.set(k, [...(m.get(k) ?? []), e]); }); return Array.from(m.values()).filter(v => v.some(x => x.segmentation === "none") && v.some(x => x.segmentation !== "none")); }, [rows]);
  const s = sum.data;

  if (bench.error && bench.status === 0) return <ErrorState message={bench.error} onRetry={() => { bench.reload(); sum.reload(); }} />;
  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <PageHeader eyebrow="Analytics" title="Perbandingan eksperimen dan aktivitas scan">Semua angka berasal dari berkas hasil eksperimen dan riwayat scan nyata. Bila belum ada, bagian terkait kosong.</PageHeader>

      <section aria-labelledby="exp-h" style={{ display: "grid", gap: "1rem" }}>
        <h3 id="exp-h" className="h3" style={{ margin: 0 }}>Eksperimen model</h3>
        {bench.loading ? <Skeleton h={220} /> : bench.data?.empty ? <div className="card"><Empty icon="chart" title="Belum ada hasil eksperimen">Jalankan <span className="mono">python -m app.cv.experiments --run</span> (lihat README). Hasil akan tampil di sini setelah training selesai.</Empty></div> : (<>
          <div className="flex items-center justify-between flex-wrap gap-3"><Tabs value={task} onChange={setTask} label="Tugas" items={tasks.map(t => ({ id: t, label: t === "fruit" ? "Jenis buah" : t === "condition" ? "Kondisi" : "16 kelas (joint)" }))} />
            <a className="btn btn-secondary btn-sm" href="/api/benchmark/export" download><Icon name="download" size={15} />Ekspor CSV</a></div>
          <div className="split">
            <div className="card"><h4 className="h3" style={{ marginTop: 0 }}>Macro F1 validation</h4><p className="xs muted">Dasar pemilihan model dan hyperparameter. Urut dari tertinggi.</p>
              <HBars label="Macro F1 validation" rows={rows.map(e => ({ key: e.id, label: <>{label(e)} {bench.data!.best_by_validation[task] === e.id && <Badge tone="info">terpilih</Badge>}</>, value: e.val_macro_f1, text: f4(e.val_macro_f1) }))} /></div>
            <div className="card"><h4 className="h3" style={{ marginTop: 0 }}>Catatan</h4><p className="small soft" style={{ margin: 0 }}>{bench.data?.note}</p><p className="xs muted">Satu split data (tanpa cross-validation), sehingga selisih kecil antar eksperimen belum tentu bermakna.</p></div>
          </div>
          <div className="table-wrap"><table className="table"><caption className="sr-only">Hasil eksperimen untuk tugas {task}</caption>
            <thead><tr><th scope="col">Eksperimen</th><th scope="col" className="num">Dim</th><th scope="col" className="num">F1 val</th><th scope="col" className="num">F1 test</th><th scope="col" className="num">Acc test</th><th scope="col" className="num">Ekstraksi</th><th scope="col" className="num">Inferensi</th><th scope="col"><span className="sr-only">Aksi</span></th></tr></thead>
            <tbody>{rows.map(e => <tr key={e.id}><td className="small">{label(e)}</td><td className="num">{e.feature_dim}</td><td className="num">{f4(e.val_macro_f1)}</td><td className="num">{f4(e.test_macro_f1)}</td><td className="num">{f4(e.test_accuracy)}</td><td className="num">{ms(e.timing.extract_ms_per_image)}</td><td className="num">{ms(e.timing.predict_ms_per_image_single)}</td>
              <td><button className="btn btn-secondary btn-sm" onClick={() => setSel(e.id)} aria-pressed={sel === e.id}>Detail</button></td></tr>)}</tbody></table></div>
          {ablation.length > 0 && <div className="card"><h4 className="h3" style={{ marginTop: 0 }}>Dengan vs tanpa segmentasi</h4><p className="xs muted">Dievaluasi pada himpunan gambar yang sama. Selisih = F1 test (segmentasi) dikurangi F1 test (tanpa).</p>
            <div className="table-wrap"><table className="table"><thead><tr><th scope="col">Fitur + klasifikator</th><th scope="col" className="num">Tanpa</th><th scope="col" className="num">Dengan</th><th scope="col" className="num">Selisih</th></tr></thead><tbody>{ablation.map(g => { const n = g.find(x => x.segmentation === "none")!, w = g.find(x => x.segmentation !== "none")!, d = w.test_macro_f1 - n.test_macro_f1;
              return <tr key={n.id}><td className="small">{n.feature === "all" ? "Gabungan" : n.feature} + {n.classifier.toUpperCase()} ({w.segmentation})</td><td className="num">{f4(n.test_macro_f1)}</td><td className="num">{f4(w.test_macro_f1)}</td><td className="num">{d >= 0 ? "+" : ""}{d.toFixed(4)}</td></tr>; })}</tbody></table></div></div>}

          {sel && (detail.loading ? <Skeleton h={260} /> : detail.error ? <ErrorState message={detail.error} /> : detail.data && (
            <div className="card"><div className="flex items-center justify-between gap-3 flex-wrap"><h4 className="h3" style={{ margin: 0 }}>Detail: <span className="mono small">{sel}</span></h4><button className="btn btn-ghost btn-sm" onClick={() => setSel(null)}>Tutup</button></div>
              <div className="even-2" style={{ marginTop: "1rem" }}>
                <div><h5 className="eyebrow">Confusion matrix (test)</h5><ConfusionMatrix labels={detail.data.labels} matrix={detail.data.confusion_matrix} /></div>
                <div><h5 className="eyebrow">Classification report (test)</h5><div className="table-wrap"><table className="table"><thead><tr><th scope="col">Kelas</th><th scope="col" className="num">P</th><th scope="col" className="num">R</th><th scope="col" className="num">F1</th><th scope="col" className="num">n</th></tr></thead>
                  <tbody>{[...detail.data.labels, "macro avg", "weighted avg"].map((k: string) => { const r = detail.data.report[k]; return r ? <tr key={k}><td className="small">{k}</td><td className="num">{r.precision.toFixed(3)}</td><td className="num">{r.recall.toFixed(3)}</td><td className="num">{r["f1-score"].toFixed(3)}</td><td className="num">{r.support}</td></tr> : null; })}</tbody></table></div></div></div>
              <dl className="kv" style={{ marginTop: "1rem" }}><dt>Hyperparameter terpilih</dt><dd>{JSON.stringify(detail.data.best_params)}</dd><dt>Data (train/val/test)</dt><dd>{detail.data.n_train} / {detail.data.n_val} / {detail.data.n_test}</dd><dt>Seed</dt><dd>{detail.data.seed}</dd><dt>Pipeline hash</dt><dd>{detail.data.pipeline_hash}</dd><dt>Waktu training</dt><dd>{detail.data.timing.train_seconds}s</dd>
                {detail.data.derived && Object.entries(detail.data.derived).map(([k, v]: [string, any]) => [<dt key={k + "t"}>Turunan: {k} (Macro F1)</dt>, <dd key={k + "d"}>{f4(v.macro_f1)}</dd>])}</dl></div>))}
        </>)}
      </section>

      <section aria-labelledby="scan-h" style={{ display: "grid", gap: "1rem" }}>
        <h3 id="scan-h" className="h3" style={{ margin: 0 }}>Aktivitas scan</h3>
        {sum.loading ? <Skeleton h={160} /> : !s || s.total === 0 ? <div className="card"><Empty icon="clock" title="Belum ada riwayat scan" action={<Link to="/app/scanner" className="btn btn-primary btn-sm">Mulai scan</Link>}>Statistik muncul dari hasil analisis nyata.</Empty></div> : (
          <div className="even-3">
            <div className="card"><h4 className="h3" style={{ marginTop: 0 }}>Kondisi</h4><StackBar label="Kondisi" parts={[{ key: "f", label: "Fresh", value: s.by_condition.fresh ?? 0, tone: "fresh" }, { key: "r", label: "Rotten", value: s.by_condition.rotten ?? 0, tone: "rotten" }, { key: "x", label: "Gagal", value: s.failed, tone: "neutral" }]} /></div>
            <div className="card"><h4 className="h3" style={{ marginTop: 0 }}>Jenis buah</h4><HBars label="Jenis buah" rows={FRUITS.filter(f => s.by_fruit[f.id]).map(f => ({ key: f.id, label: f.en, value: s.by_fruit[f.id] / Math.max(...Object.values(s.by_fruit)), text: String(s.by_fruit[f.id]) }))} /></div>
            <div className="card"><h4 className="h3" style={{ marginTop: 0 }}>Scan per hari</h4><Columns label="Scan per hari" data={s.per_day.map(d => ({ label: d.date, value: d.count }))} /></div>
          </div>)}
      </section>
    </div>
  );
}
