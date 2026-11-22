"""Runner eksperimen FruitVision. Prasyarat: dataset tervalidasi + manifest terverifikasi + metode segmentasi terpilih.

  python -m app.cv.experiments                      # DRY-RUN (default): tampilkan rencana, tanpa ekstraksi/training
  python -m app.cv.experiments --run [--seg hsv|grabcut] [--ablation] [--tasks fruit condition joint]
                               [--config cfg.json] [--n-jobs 4] [--overwrite]
  python -m app.cv.experiments --clear-cache

Fitur dihitung SEKALI per gambar per mode segmentasi lalu di-cache (kunci: parameter pipeline + manifest). Test split hanya
dipakai untuk metrik akhir. Pada --ablation semua mode dievaluasi pada himpunan gambar BERSAMA (gambar yang berhasil
disegmentasi oleh semua metode) agar perbandingan dengan/tanpa segmentasi memakai set uji yang identik."""
import argparse, hashlib, json, sys, time
import joblib, numpy as np, pandas as pd, sklearn
from joblib import Parallel, delayed
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score, precision_score, recall_score
from sklearn.neighbors import KNeighborsClassifier
from sklearn.svm import SVC
from .experiment_config import Spec, build_specs, candidates, config_hash, load_config
from .pipeline import BLOCK_DIMS, BLOCKS, BLOCK_FN, FEATURE_SETS, PIPELINE_PARAMS, load_resize, pipeline_hash, segment
from ..data.data_splitter import load_verified_manifest
from ..data.dataset_config import ART, CACHE, META, MODELS, RES, SEED, SPLITS
from ..data.labels import task_classes, task_labels
from ..ml.scaling import BlockScaler

TIMING = ("t_seg", "t_color", "t_hog", "t_glcm")


def one(path, seg):
    """Fitur satu gambar + waktu tiap tahap (detik). Mengembalikan dict atau string galat."""
    try:
        t0 = time.perf_counter(); img = load_resize(path); t1 = time.perf_counter(); m = segment(img, seg); t2 = time.perf_counter()
        out = dict(t_load=t1 - t0, t_seg=t2 - t1)
        for b in BLOCKS:
            s = time.perf_counter(); out[b] = BLOCK_FN[b](img, m); out["t_" + b] = time.perf_counter() - s
        return out
    except Exception as e:
        return f"{type(e).__name__}: {e}"


def cache_path(seg, manifest_sha):
    key = hashlib.sha1(f"{pipeline_hash()}|{seg}|{manifest_sha}".encode()).hexdigest()[:12]
    return CACHE / f"features_{seg}_{key}.npz"


def load_features(df, seg, manifest_sha, n_jobs):
    """Muat/hitung fitur untuk SEMUA baris manifest (baris gagal = NaN, ok=False). Selalu dibaca lewat cache (float32)."""
    f = cache_path(seg, manifest_sha)
    if not f.exists():
        print(f"Menghitung fitur ({seg}) untuk {len(df)} gambar, n_jobs={n_jobs} ...", flush=True)
        res = Parallel(n_jobs=n_jobs, verbose=5)(delayed(one)(p, seg) for p in df.path)
        ok = np.array([not isinstance(r, str) for r in res]); n = len(df)
        arr = {b: np.full((n, BLOCK_DIMS[b]), np.nan, np.float32) for b in BLOCKS}; tim = {k: np.full(n, np.nan, np.float32) for k in TIMING}
        for i, r in enumerate(res):
            if isinstance(r, str): continue
            for b in BLOCKS: arr[b][i] = r[b]
            for k in TIMING: tim[k][i] = r[k]
        fails = [dict(path=p, error=r) for p, r in zip(df.rel, res) if isinstance(r, str)]
        CACHE.mkdir(parents=True, exist_ok=True)
        np.savez(f, ok=ok, rel=np.array(list(df.rel)), fails_json=np.array(json.dumps(fails)), **arr, **tim)
    z = np.load(f, allow_pickle=False)
    if list(z["rel"]) != list(df.rel): sys.exit(f"Cache {f.name} tidak cocok dengan manifest; hapus cache (--clear-cache).")
    return dict(ok=z["ok"], fails=json.loads(str(z["fails_json"])), file=f.name, **{b: z[b].astype(np.float64) for b in BLOCKS}, **{k: z[k] for k in TIMING})


def _metrics(y, p, labels):
    return dict(accuracy=float(accuracy_score(y, p)), macro_precision=float(precision_score(y, p, average="macro", zero_division=0, labels=labels)),
                macro_recall=float(recall_score(y, p, average="macro", zero_division=0, labels=labels)), macro_f1=float(f1_score(y, p, average="macro", labels=labels, zero_division=0)),
                weighted_f1=float(f1_score(y, p, average="weighted", labels=labels, zero_division=0)))


def make_model(spec, cand, Xtr, proba):
    if spec.classifier == "knn":
        return KNeighborsClassifier(n_neighbors=cand["k"], weights=cand["knn_weights"])
    kw = dict(C=cand["C"], kernel=cand["kernel"], class_weight="balanced", probability=proba, random_state=SEED)
    if cand["kernel"] == "rbf":
        kw["gamma"] = cand["gamma_mult"] / max(float(Xtr.var(axis=0).sum()), 1e-12)
    return SVC(**kw)


def deployed_predict(model, X):
    """Prediksi yang dipakai aplikasi = argmax predict_proba (evaluasi dan inferensi memakai aturan yang sama)."""
    P = model.predict_proba(X); return model.classes_[np.argmax(P, axis=1)], P


def run_spec(spec, cfg, F, d, meta, seg_info):
    t0 = time.time(); blocks = FEATURE_SETS[spec.feature]; X = np.hstack([F[b] for b in blocks]); dims = [BLOCK_DIMS[b] for b in blocks]
    y = np.array(task_labels(d.label, spec.task)); labels = list(task_classes(spec.task)); m = {s: (d.split == s).values for s in ("train", "val", "test")}
    cands = candidates(cfg, spec); Xs_cache, grid = {}, []
    for c in cands:
        w = c["weighting"]
        if w not in Xs_cache:
            sc = BlockScaler(dims, w).fit(X[m["train"]]); Xs_cache[w] = (sc, sc.transform(X))     # scaler/bobot: HANYA dari train
        sc, Xs = Xs_cache[w]; mdl = make_model(spec, c, Xs[m["train"]], False).fit(Xs[m["train"]], y[m["train"]])
        grid.append(dict(candidate=c, val_macro_f1=float(f1_score(y[m["val"]], mdl.predict(Xs[m["val"]]), average="macro", labels=labels, zero_division=0))))
    best = grid[int(np.argmax([g["val_macro_f1"] for g in grid]))]["candidate"]     # seri -> kandidat pertama
    sc, Xs = Xs_cache[best["weighting"]]; tt = time.time(); model = make_model(spec, best, Xs[m["train"]], True).fit(Xs[m["train"]], y[m["train"]]); fit_s = time.time() - tt
    pv, _ = deployed_predict(model, Xs[m["val"]]); ts = time.perf_counter(); pt, _ = deployed_predict(model, sc.transform(X[m["test"]])); batch_ms = 1000 * (time.perf_counter() - ts) / m["test"].sum()
    idx = np.where(m["test"])[0][:30]; single = []
    for i in idx:
        s = time.perf_counter(); deployed_predict(model, sc.transform(X[i:i + 1])); single.append(1000 * (time.perf_counter() - s))
    ext = np.nanmean(F["t_seg"] + sum(F["t_" + b] for b in blocks)) * 1000
    r = dict(id=spec.id, task=spec.task, feature=spec.feature, feature_dim=int(X.shape[1]), classifier=spec.classifier, segmentation=spec.seg, best_params=best,
             n_candidates=len(cands), grid=grid, val=_metrics(y[m["val"]], pv, labels), val_macro_f1=float(f1_score(y[m["val"]], pv, average="macro", labels=labels, zero_division=0)),
             test=_metrics(y[m["test"]], pt, labels), test_accuracy=float(accuracy_score(y[m["test"]], pt)), test_macro_f1=float(f1_score(y[m["test"]], pt, average="macro", labels=labels, zero_division=0)),
             report=classification_report(y[m["test"]], pt, labels=labels, output_dict=True, zero_division=0), confusion_matrix=confusion_matrix(y[m["test"]], pt, labels=labels).tolist(), labels=labels,
             timing=dict(extract_ms_per_image=float(ext), predict_ms_per_image_batch=float(batch_ms), predict_ms_per_image_single=float(np.median(single)), train_seconds=round(fit_s, 2), total_seconds=round(time.time() - t0, 1)),
             n_train=int(m["train"].sum()), n_val=int(m["val"].sum()), n_test=int(m["test"].sum()), segmentation_info=seg_info, **meta)
    if spec.task == "joint":   # metrik turunan agar sebanding dengan dua model terpisah
        r["derived"] = {t: _metrics(task_labels(y[m["test"]], t), task_labels(pt, t), list(task_classes(t))) for t in ("fruit", "condition")}
    return r, dict(model=model, scaler=sc, meta=dict(id=spec.id, task=spec.task, feature=spec.feature, classifier=spec.classifier, segmentation=spec.seg, classes=[str(c) for c in model.classes_],
                                                     manifest_sha256=meta["manifest_sha256"], pipeline_hash=meta["pipeline_hash"], config_hash=meta["config_hash"]))


def clear_cache():
    n = 0
    for f in CACHE.glob("features_*.npz") if CACHE.exists() else []: f.unlink(); n += 1
    print(f"Cache fitur dihapus: {n} berkas ({CACHE}).")


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--run", action="store_true", help="jalankan ekstraksi + training (tanpa ini: dry-run)"); ap.add_argument("--seg", choices=["hsv", "grabcut"])
    ap.add_argument("--ablation", action="store_true", help="tambahkan pembanding tanpa segmentasi"); ap.add_argument("--tasks", nargs="+", choices=["fruit", "condition", "joint"]); ap.add_argument("--config")
    ap.add_argument("--overwrite", action="store_true"); ap.add_argument("--n-jobs", type=int, default=4); ap.add_argument("--clear-cache", action="store_true"); a = ap.parse_args()
    if a.clear_cache: return clear_cache()
    cfg = load_config(a.config)
    if a.tasks: cfg["tasks"] = a.tasks
    sel = META / "seg_eval" / "selection.json"; chosen = json.loads(sel.read_text(encoding="utf-8")) if sel.exists() else None; seg = a.seg or (chosen or {}).get("method")
    if not seg: sys.exit("Metode segmentasi belum dipilih. Jalankan evaluasi (app.cv.seg_eval) atau beri --seg secara eksplisit.")
    if chosen and a.seg and a.seg != chosen["method"]: print(f"PERINGATAN: --seg {a.seg} berbeda dari metode terpilih ({chosen['method']}); dicatat pada hasil.")
    modes = [seg] + (["none"] if a.ablation else []); specs = build_specs(cfg, modes)
    df = load_verified_manifest(); meta_s = json.loads((SPLITS / "split_meta.json").read_text(encoding="utf-8")); sha = meta_s["manifest_sha256"]
    nfit = sum(len(candidates(cfg, s)) + 1 for s in specs)
    print(f"RENCANA: {len(specs)} eksperimen, mode segmentasi {modes}, tugas {cfg['tasks']}, ~{nfit} fitting model; config_hash={config_hash(cfg)} pipeline_hash={pipeline_hash()}")
    print(f"Manifest: {meta_s['split_counts']} (seed {meta_s['seed']}). Cache fitur: " + ", ".join(f"{m}={'ada' if cache_path(m, sha).exists() else 'belum'}" for m in modes))
    if not a.run: print("DRY-RUN: tidak ada ekstraksi/training. Tambahkan --run setelah konfigurasi diperiksa."); return
    if not a.overwrite and any(RES.glob("*.json")) and any((RES / f"{s.id}.json").exists() for s in specs): sys.exit("Hasil eksperimen yang sama sudah ada. Gunakan --overwrite jika sengaja menimpa.")
    RES.mkdir(parents=True, exist_ok=True); MODELS.mkdir(parents=True, exist_ok=True)
    Fs = {m: load_features(df, m, sha, a.n_jobs) for m in modes}; ok = np.logical_and.reduce([Fs[m]["ok"] for m in modes]); nfail = {m: len(Fs[m]["fails"]) for m in modes}
    for m in modes: pd.DataFrame(Fs[m]["fails"], columns=["path", "error"]).to_csv(RES / f"feature_failures_{m}.csv", index=False)
    print(f"Gambar gagal diproses: {nfail}; himpunan bersama dipakai: {int(ok.sum())}/{len(df)}")
    if ok.sum() < 0.95 * len(df): print("PERINGATAN: >5% gambar dikeluarkan; periksa feature_failures_*.csv sebelum menafsirkan hasil.")
    d = df[ok].reset_index(drop=True)
    for t in cfg["tasks"]:
        for s in ("train", "val", "test"):
            if set(task_labels(d.label[d.split == s], t)) != set(task_classes(t)): sys.exit(f"Tugas {t}: split {s} kehilangan kelas setelah gambar gagal dikeluarkan.")
    base = dict(manifest_sha256=sha, validation_fingerprint=meta_s["validation_fingerprint"], seed=SEED, sklearn=sklearn.__version__, pipeline_hash=pipeline_hash(), pipeline_params=PIPELINE_PARAMS,
                config=cfg, config_hash=config_hash(cfg), segmentation_selection=chosen, n_failed_feature_extraction=nfail, common_set_size=int(ok.sum()), trained_at=time.strftime("%Y-%m-%dT%H:%M:%S"))
    summary = []
    for i, spec in enumerate(specs, 1):
        F = {k: Fs[spec.seg][k][ok] for k in (*BLOCKS, *TIMING)}; r, bundle = run_spec(spec, cfg, F, d, base, dict(n_failed=nfail[spec.seg]))
        joblib.dump(bundle, MODELS / f"{spec.id}.joblib"); (RES / f"{spec.id}.json").write_text(json.dumps(r, indent=2, default=str), encoding="utf-8")
        print(f"DONE {spec.id} ({i}/{len(specs)}) val_macro_f1={r['val_macro_f1']:.4f} ({r['timing']['total_seconds']}s)", flush=True)
        summary.append(dict(id=spec.id, task=spec.task, feature=spec.feature, classifier=spec.classifier, segmentation=spec.seg, feature_dim=r["feature_dim"], val_macro_f1=r["val_macro_f1"], test_accuracy=r["test_accuracy"],
                            test_macro_f1=r["test_macro_f1"], test_macro_precision=r["test"]["macro_precision"], test_macro_recall=r["test"]["macro_recall"], extract_ms=r["timing"]["extract_ms_per_image"],
                            predict_ms_single=r["timing"]["predict_ms_per_image_single"], train_seconds=r["timing"]["train_seconds"]))
    pd.DataFrame(summary).to_csv(RES / "summary.csv", index=False); print(pd.DataFrame(summary).round(4).to_string(index=False))


if __name__ == "__main__":
    main()
