import io, json, os, subprocess, sys, unittest
import cv2, numpy as np
import support
from support import BACKEND, T, fruit_image, prepared

try:
    import fastapi, httpx  # noqa: F401
    HAVE_FASTAPI = True
except Exception:
    HAVE_FASTAPI = False


def jpg(fruit="apple", rotten=False, seed=3): return cv2.imencode(".jpg", fruit_image(np.random.RandomState(seed), fruit, rotten))[1].tobytes()


class Home(unittest.TestCase):
    def test_single_home_derives_all_locations(self):
        env = {k: v for k, v in os.environ.items() if not k.startswith("FRUITVISION_")}; env["FRUITVISION_HOME"] = str(T / "ws one")
        out = subprocess.run([sys.executable, "-c", "import json,app.data.dataset_config as c; print(json.dumps(c.locations()))"], cwd=BACKEND, env=env, capture_output=True, text=True); self.assertEqual(out.returncode, 0, out.stderr)
        loc = json.loads(out.stdout); base = str(T / "ws one")
        for k, sub in (("data", "data"), ("cache", "cache"), ("artifacts", "artifacts"), ("results", "results")): self.assertEqual(loc[k], os.path.join(base, sub))

    def test_specific_variable_overrides_home(self):
        env = {k: v for k, v in os.environ.items() if not k.startswith("FRUITVISION_")}; env.update(FRUITVISION_HOME=str(T / "h"), FRUITVISION_CACHE=str(T / "elsewhere"))
        out = subprocess.run([sys.executable, "-c", "import app.data.dataset_config as c; print(c.CACHE, c.DATA)"], cwd=BACKEND, env=env, capture_output=True, text=True)
        self.assertIn(str(T / "elsewhere"), out.stdout); self.assertIn(os.path.join(str(T / "h"), "data"), out.stdout)


class Handlers(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        prepared()
        from app.services import inference
        inference.set_active({"fruit": "fruit-all-svm-hsv", "condition": "condition-all-svm-hsv"})

    def test_upload_validation(self):
        from app.api import handlers as H
        for bad, code in ((b"", 422), (b"not an image", 422), (b"GIF89a" + b"0" * 20, 422)):
            with self.assertRaises(H.ApiError) as c: H.check_upload(bad)
            self.assertEqual(c.exception.status, code)
        with self.assertRaises(H.ApiError) as c: H.check_upload(b"0" * (H.MAX_UPLOAD + 1))
        self.assertEqual(c.exception.status, 413)
        buf = io.BytesIO(); __import__("PIL.Image").Image.new("RGB", (20, 20)).save(buf, "BMP")
        with self.assertRaises(H.ApiError) as c: H.check_upload(buf.getvalue())
        self.assertEqual(c.exception.status, 415)

    def test_classify_saves_history_and_summary_is_real(self):
        from app.api import handlers as H
        from app.services import history
        history.clear(); self.assertEqual(history.summary()["total"], 0); self.assertEqual(history.list_items()["items"], [])
        r = H.classify(jpg("banana", True), "pisang.jpg"); self.assertTrue(r["accepted"]); self.assertTrue(r["history_id"])
        H.classify(jpg("grape", False, 9), "anggur.jpg", save=False)
        H.classify(cv2.imencode(".png", np.full((200, 200, 3), 250, np.uint8))[1].tobytes(), "kosong.png")      # segmentasi gagal tetap tercatat sebagai gagal
        s = history.summary(); self.assertEqual((s["total"], s["accepted"], s["failed"]), (2, 1, 1)); self.assertEqual(s["by_fruit"], {"banana": 1}); self.assertEqual(s["by_condition"], {"rotten": 1})
        items = history.list_items()["items"]; self.assertEqual(items[1]["filename"], "pisang.jpg"); self.assertTrue(history.thumb_path(items[1]["id"]).is_file())
        self.assertEqual(history.list_items(fruit="banana")["total"], 1); self.assertEqual(history.list_items(condition="fresh")["total"], 0)
        self.assertTrue(history.delete(items[1]["id"])); self.assertFalse(history.delete(items[1]["id"])); self.assertFalse(history.delete("../../etc/passwd")); self.assertIsNone(history.thumb_path("../x"))
        self.assertEqual(history.clear(), 1); self.assertEqual(history.summary()["total"], 0)

    def test_classify_without_model_is_409(self):
        from app.api import handlers as H
        a = T / "art" / "active.json"; txt = a.read_text(); a.unlink()
        try:
            with self.assertRaises(H.ApiError) as c: H.classify(jpg(), "x.jpg")
            self.assertEqual(c.exception.status, 409)
        finally: a.write_text(txt)

    def test_models_benchmark_and_experiment_endpoints(self):
        from app.api import handlers as H
        ms = H.models_list(); self.assertTrue(any(m["active"] for m in ms)); self.assertEqual(sum(m["active"] for m in ms), 2)
        b = H.benchmark_summary(); self.assertFalse(b["empty"]); self.assertEqual(set(b["best_by_validation"]), {"fruit", "condition"}); self.assertIn("VALIDATION", b["note"])
        e = H.experiment("fruit-hog-svm-hsv"); self.assertEqual(len(e["confusion_matrix"]), 8)
        for bad in ("../x", "nope", "a/b"):
            with self.assertRaises(H.ApiError): H.experiment(bad)
        self.assertIn("fruit-hog-svm-hsv", H.benchmark_export()); self.assertTrue(H.pipeline_info()["hash"])
        with self.assertRaises(H.ApiError) as c: H.models_activate({"fruit": "missing", "condition": "x"})
        self.assertEqual(c.exception.status, 404)

    def test_dataset_endpoints_and_path_traversal(self):
        from app.api import handlers as H
        cl = H.dataset_classes(); self.assertEqual(len(cl), 16); self.assertTrue(all(c["found"] == 24 for c in cl))
        im = H.dataset_images("apple_fresh", 5, 0); self.assertEqual(im["total"], 24); self.assertGreater(len(H.thumbnail_bytes(im["items"][0]["path"], 64)), 100)
        for bad in ("../../../etc/passwd", "Original Images/../../x.jpg", "C:/Windows/win.ini"):
            with self.assertRaises(H.ApiError): H.safe_image(bad)

    def test_processing_modes_and_storage(self):
        from app.api import handlers as H
        r = H.processing_analyze(jpg(), None, "none"); self.assertEqual(r["features"]["method"], "none")
        r = H.processing_analyze(None, H.dataset_images("apple_fresh", 1, 0)["items"][0]["path"], "hsv"); self.assertEqual(r["features"]["method"], "hsv")
        with self.assertRaises(H.ApiError): H.processing_analyze(jpg(), "x", "hsv")
        with self.assertRaises(H.ApiError): H.processing_analyze(jpg(), None, "sift")
        st = H.storage(); self.assertGreater(st["bytes"]["models"], 0); self.assertGreater(st["cache_files"], 0)
        n = st["cache_files"]; self.assertEqual(H.clear_cache()["deleted"], n); self.assertEqual(H.storage()["cache_files"], 0)


@unittest.skipUnless(HAVE_FASTAPI, "FastAPI/httpx tidak terpasang di lingkungan ini; jalankan di venv proyek")
class HttpLayer(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        prepared()
        from fastapi.testclient import TestClient
        from app.main import app
        from app.services import inference
        inference.set_active({"fruit": "fruit-all-svm-hsv", "condition": "condition-all-svm-hsv"}); cls.c = TestClient(app)

    def test_http_contract(self):
        c = self.c; self.assertEqual(c.get("/api/health").json()["version"], "0.4.0"); self.assertEqual(c.get("/api/models").status_code, 200)
        r = c.post("/api/classify?save=false", files={"file": ("a.jpg", jpg("orange"), "image/jpeg")}); self.assertEqual(r.status_code, 200, r.text); self.assertIn("fruit", r.json())
        self.assertEqual(c.post("/api/classify", files={"file": ("a.txt", b"hello", "text/plain")}).status_code, 422)
        self.assertEqual(c.get("/api/history/..%2f..%2fx/thumbnail").status_code, 404); self.assertEqual(c.get("/api/benchmark/experiment?id=../x").status_code, 404)
        self.assertEqual(c.post("/api/models/activate", json={"fruit": "nope", "condition": "nope"}).status_code, 404)


if __name__ == "__main__":
    unittest.main()
