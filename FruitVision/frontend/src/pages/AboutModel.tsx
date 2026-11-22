import { Link } from "react-router-dom";
import { Alert, Badge, Empty, ErrorState, PageHeader, Reveal, Skeleton } from "../components/ui";
import { useAsync } from "../hooks";
import { f4, get, ms, type Experiment, type ModelRow } from "../api";

export default function AboutModel() {
  const pipe = useAsync(() => get<any>("/api/pipeline")); const models = useAsync(() => get<ModelRow[]>("/api/models")); const bench = useAsync(() => get<{ experiments: Experiment[] }>("/api/benchmark/summary"));
  const active = (models.data ?? []).filter(m => m.active); const P = pipe.data?.params;
  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <PageHeader eyebrow="About model" title="Bagaimana FruitVision menilai sebuah buah">Ringkasan pipeline dan model yang sedang aktif. Parameter di bawah dibaca langsung dari kode backend.</PageHeader>
      {pipe.error && pipe.status === 0 && <ErrorState message={pipe.error} onRetry={pipe.reload} />}

      <Reveal><section className="card" aria-labelledby="ab-pipe"><h3 id="ab-pipe" className="h3" style={{ marginTop: 0 }}>Pipeline pengolahan citra</h3>
        {pipe.loading ? <Skeleton h={160} /> : !P ? <p className="small soft">Parameter belum dapat dimuat.</p> : (
          <div className="even-2"><dl className="kv"><dt>Ukuran</dt><dd>{P.size} × {P.size}</dd><dt>Resize</dt><dd>{P.resize}</dd><dt>Segmentasi</dt><dd>{pipe.data.seg_methods.join(" / ")}</dd><dt>Morfologi</dt><dd>open {P.morph.open}, close {P.morph.close}; {P.morph.keep}</dd><dt>GrabCut</dt><dd>{P.grabcut.iters} iterasi, margin {P.grabcut.rect_margin}</dd><dt>Gagal bila foreground</dt><dd>&lt; {(P.min_fg * 100).toFixed(0)}%</dd></dl>
            <dl className="kv"><dt>Color Histogram</dt><dd>HSV {P.hsv_bins.join("×")} = {pipe.data.block_dims.color}</dd><dt>HOG</dt><dd>{pipe.data.block_dims.hog} dim; sel {P.hog.pixels_per_cell}, blok {P.hog.cells_per_block}</dd><dt>GLCM</dt><dd>{pipe.data.block_dims.glcm} dim; {P.glcm.levels} level, {P.glcm.props.join(", ")}</dd><dt>Hash pipeline</dt><dd>{pipe.data.hash}</dd></dl></div>)}</section></Reveal>

      <Reveal delay={60}><section className="card" aria-labelledby="ab-act"><h3 id="ab-act" className="h3" style={{ marginTop: 0 }}>Model aktif</h3>
        {models.loading ? <Skeleton h={100} /> : !active.length ? <Empty icon="cpu" title="Belum ada model aktif">Latih model lewat CLI lalu aktifkan di <Link to="/app/settings">Settings</Link>.</Empty> : (
          <div style={{ display: "grid", gap: "1rem" }}>{active.map(m => { const e = bench.data?.experiments.find(x => x.id === m.id); return (
            <div key={m.id} className="plate"><div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: ".6rem" }}><Badge tone="info">{m.task}</Badge><span className="mono">{m.id}</span></div>
              {e ? <dl className="kv"><dt>Fitur</dt><dd>{e.feature} ({e.feature_dim} dim)</dd><dt>Klasifikator</dt><dd>{e.classifier.toUpperCase()}</dd><dt>Segmentasi</dt><dd>{e.segmentation}</dd><dt>Hyperparameter</dt><dd>{JSON.stringify(e.best_params)}</dd><dt>Macro F1 validation</dt><dd>{f4(e.val_macro_f1)}</dd><dt>Macro F1 test</dt><dd>{f4(e.test_macro_f1)}</dd><dt>Accuracy test</dt><dd>{f4(e.test_accuracy)}</dd><dt>Inferensi (1 sampel)</dt><dd>{ms(e.timing.predict_ms_per_image_single)}</dd><dt>Data train/val/test</dt><dd>{e.n_train}/{e.n_val}/{e.n_test}</dd></dl>
                : <p className="small soft" style={{ margin: 0 }}>Berkas hasil eksperimen untuk model ini tidak ditemukan.</p>}</div>); })}</div>)}</section></Reveal>

      <div className="even-2">
        <Reveal delay={60}><section className="card" aria-labelledby="ab-data"><h3 id="ab-data" className="h3" style={{ marginTop: 0 }}>Data dan label</h3><ul className="small soft" style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: ".4rem" }}>
          <li>Dataset <em>Fresh and Rotten Fruits</em> (Mendeley Data, CC BY 4.0): 8 jenis buah × 2 kondisi = 16 kelas.</li><li>Hanya gambar asli yang dipakai; gambar augmentasi tidak dimasukkan ke split.</li><li>Split 70/15/15 berstrata dengan seed tetap; gambar duplikat atau sangat mirip dijaga tetap dalam satu split.</li><li>Fresh/Rotten mengikuti label dataset dan bukan tingkat kematangan.</li></ul></section></Reveal>
        <Reveal delay={120}><section className="card" aria-labelledby="ab-lim"><h3 id="ab-lim" className="h3" style={{ marginTop: 0 }}>Batasan</h3><ul className="small soft" style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: ".4rem" }}>
          <li>Output adalah prediksi probabilistik; confidence bukan jaminan kebenaran.</li><li>Gambar di luar 8 jenis buah tetap dijawab salah satu kelas karena penolakan "unknown" belum dikalibrasi.</li><li>Evaluasi memakai satu split tanpa cross-validation.</li><li>Foto buah yang sama dari sudut berbeda dapat tidak terdeteksi sebagai duplikat.</li><li>Hanya satu komponen terbesar yang dipertahankan setelah segmentasi, sehingga tandan atau banyak buah dapat terpotong.</li></ul></section></Reveal>
      </div>
      <Alert kind="info">Metode, rancangan eksperimen, dan alasan pemilihan dijelaskan di <span className="mono">METHODOLOGY.md</span> dan <span className="mono">EXPERIMENTS.md</span>.</Alert>
    </div>
  );
}
