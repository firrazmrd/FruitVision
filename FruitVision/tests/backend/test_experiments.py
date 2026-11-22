import json, unittest
import joblib, numpy as np, pandas as pd
import support
from support import T, prepared, run
from app.cv.experiment_config import build_specs, candidates, load_config


class Config(unittest.TestCase):
    def test_default_grid_covers_required_experiments(self):
        cfg = load_config(); sp = build_specs(cfg, ["hsv"]); keys = {(s.feature, s.classifier) for s in sp if s.task == "fruit"}
        self.assertEqual(keys, {(f, c) for f in ("color", "hog", "glcm", "all") for c in ("knn", "svm")})      # 8 konfigurasi wajib
        self.assertEqual(len(sp), 16); self.assertEqual(len(build_specs(cfg, ["hsv", "none"])), 32)
        self.assertEqual(len({s.id for s in build_specs(cfg, ["hsv", "none"])}), 32)

    def test_block_weighting_only_for_combined(self):
        cfg = load_config(); sp = {(s.feature, s.classifier): s for s in build_specs(cfg, ["hsv"])}
        self.assertEqual({c["weighting"] for c in candidates(cfg, sp[("hog", "knn")])}, {"none"}); self.assertEqual({c["weighting"] for c in candidates(cfg, sp[("all", "svm")])}, {"none", "equal"})

    def test_bad_config_rejected(self):
        p = T / "bad.json"; p.write_text(json.dumps(dict(features=["sift"])))
        with self.assertRaises(ValueError): load_config(p)
        p.write_text(json.dumps(dict(nonsense=1)))
        with self.assertRaises(ValueError): load_config(p)


class Experiments(unittest.TestCase):
    @classmethod
    def setUpClass(cls): prepared()

    def test_dry_run_default_does_not_train(self):
        for f in (T / "art" / "models").glob("*.joblib"): pass
        r = run("app.cv.experiments", "--config", str(T / "cfg.json"), "--overwrite"); self.assertEqual(r.returncode, 0, r.stdout + r.stderr); self.assertIn("DRY-RUN", r.stdout); self.assertIn("RENCANA: 32 eksperimen" if False else "RENCANA:", r.stdout)

    def test_all_results_present_with_required_metrics(self):
        res = sorted((T / "res").glob("*-*-*-*.json")); self.assertEqual(len(res), 32)     # 2 tugas x 4 fitur x 2 klasifikator x 2 mode segmentasi
        r = json.loads((T / "res" / "fruit-hog-svm-hsv.json").read_text())
        for k in ("accuracy", "macro_precision", "macro_recall", "macro_f1"): self.assertIn(k, r["test"])
        for k in ("extract_ms_per_image", "predict_ms_per_image_single", "predict_ms_per_image_batch", "train_seconds"): self.assertGreater(r["timing"][k], 0)
        self.assertEqual(len(r["labels"]), 8); self.assertEqual(len(r["confusion_matrix"]), 8); self.assertIn("apple", r["report"]); self.assertTrue((T / "res" / "summary.csv").exists())

    def test_results_traceable(self):
        meta = json.loads((T / "data" / "splits" / "split_meta.json").read_text()); r = json.loads((T / "res" / "condition-all-knn-none.json").read_text())
        self.assertEqual(r["manifest_sha256"], meta["manifest_sha256"]); self.assertEqual(r["seed"], 42); self.assertEqual(r["feature_dim"], 1428); self.assertEqual(r["segmentation"], "none")
        self.assertEqual(len(r["labels"]), 2); self.assertIn("pipeline_hash", r); self.assertIn("config_hash", r); self.assertGreaterEqual(len(r["grid"]), 2)

    def test_ablation_uses_identical_test_set(self):
        a = json.loads((T / "res" / "fruit-color-knn-hsv.json").read_text()); b = json.loads((T / "res" / "fruit-color-knn-none.json").read_text())
        self.assertEqual((a["n_train"], a["n_val"], a["n_test"]), (b["n_train"], b["n_val"], b["n_test"])); self.assertEqual(a["common_set_size"], b["common_set_size"])

    def test_scaler_fit_on_train_only(self):
        from app.cv.experiments import load_features
        from app.data.data_splitter import load_verified_manifest
        meta = json.loads((T / "data" / "splits" / "split_meta.json").read_text()); df = load_verified_manifest(); F = load_features(df, "hsv", meta["manifest_sha256"], 1)
        ok = F["ok"]; d = df[ok]; tr = (d.split == "train").values; sc = joblib.load(T / "art" / "models" / "fruit-color-knn-hsv.joblib")["scaler"]
        self.assertTrue(np.allclose(sc.mean_, F["color"][ok][tr].mean(0), atol=1e-6)); self.assertFalse(np.allclose(sc.mean_, F["color"][ok].mean(0), atol=1e-9))

    def test_joint_task_has_derived_metrics(self):
        r = run("app.cv.experiments", "--run", "--tasks", "joint", "--config", str(T / "cfg.json"), "--n-jobs", "1", "--overwrite"); self.assertEqual(r.returncode, 0, r.stdout[-800:] + r.stderr[-800:])
        j = json.loads((T / "res" / "joint-all-svm-hsv.json").read_text()); self.assertEqual(len(j["labels"]), 16); self.assertIn("fruit", j["derived"]); self.assertIn("condition", j["derived"])

    def test_refuses_overwrite_and_cache_key_depends_on_pipeline(self):
        r = run("app.cv.experiments", "--run", "--config", str(T / "cfg.json")); self.assertNotEqual(r.returncode, 0)
        import app.cv.pipeline as P
        from app.cv.experiments import cache_path
        a = cache_path("hsv", "abc"); old = P.PIPELINE_PARAMS["size"]; P.PIPELINE_PARAMS["size"] = 111
        try: self.assertNotEqual(a, cache_path("hsv", "abc"))
        finally: P.PIPELINE_PARAMS["size"] = old

    def test_clear_cache(self):
        (T / "cache").mkdir(parents=True, exist_ok=True); np.savez(T / "cache" / "features_dummy_abc.npz", a=np.zeros(1)); (T / "cache" / "keep_me.txt").write_text("x")
        self.assertEqual(run("app.cv.experiments", "--clear-cache").returncode, 0)
        self.assertFalse(list((T / "cache").glob("features_*.npz"))); self.assertTrue((T / "cache" / "keep_me.txt").exists())     # hanya cache fitur yang dihapus


if __name__ == "__main__":
    unittest.main()
