import io, json, unittest
import cv2, numpy as np
import support
from support import T, fruit_image, prepared


def jpg(fruit, rotten, seed=5): return cv2.imencode(".jpg", fruit_image(np.random.RandomState(seed), fruit, rotten))[1].tobytes()


class Inference(unittest.TestCase):
    @classmethod
    def setUpClass(cls): prepared()

    def test_requires_active_model(self):
        from app.services import inference
        (T / "art" / "active.json").unlink(missing_ok=True)
        with self.assertRaises(LookupError): inference.classify(jpg("apple", False))

    def test_two_model_mode(self):
        from app.services import inference
        inference.set_active({"fruit": "fruit-all-svm-hsv", "condition": "condition-all-svm-hsv"})
        r = inference.classify(jpg("banana", True)); self.assertTrue(r["accepted"])
        for t in ("fruit", "condition"): self.assertTrue(0 <= r[t]["confidence"] <= 1 and len(r[t]["top"]) >= 1)
        self.assertIn(r["fruit"]["label"], support.FRUITS); self.assertIn(r["condition"]["label"], ("fresh", "rotten")); self.assertTrue(r["segmentation"]["preview"].startswith("data:image/png")); self.assertTrue(r["segmentation"]["preview_is_segmented"])
        self.assertEqual(r["fruit"]["label"], "banana"); self.assertEqual(r["condition"]["label"], "rotten")     # data sintetis sangat mudah; hanya memeriksa alur

    def test_joint_mode_and_wrong_task_rejected(self):
        from app.services import inference
        with self.assertRaises(ValueError): inference.set_active({"fruit": "condition-all-svm-hsv", "condition": "condition-all-svm-hsv"})
        with self.assertRaises(ValueError): inference.set_active({"fruit": "x"})
        if (T / "art" / "models" / "joint-all-svm-hsv.joblib").exists():
            inference.set_active({"joint": "joint-all-svm-hsv"}); r = inference.classify(jpg("grape", False)); self.assertIn("joint_label", r["condition"]); self.assertIn(r["fruit"]["label"], support.FRUITS)

    def test_segmentation_failure_reported_not_hidden(self):
        from app.services import inference
        inference.set_active({"fruit": "fruit-all-svm-hsv", "condition": "condition-all-svm-hsv"})
        r = inference.classify(cv2.imencode(".png", np.full((200, 200, 3), 250, np.uint8))[1].tobytes()); self.assertFalse(r["accepted"]); self.assertEqual(r["reason"], "segmentation_failed")
        with self.assertRaises(ValueError): inference.classify(b"junk")

    def test_no_segmentation_model_can_be_active(self):
        from app.services import inference
        inference.set_active({"fruit": "fruit-hog-knn-none", "condition": "condition-hog-knn-none"}); r = inference.classify(jpg("apple", False))
        self.assertTrue(r["accepted"]); self.assertFalse(r["segmentation"]["preview_is_segmented"])

    def test_processing_lab_matches_pipeline(self):
        from app.services import processing
        r = processing.analyze(jpg("orange", False), "hsv"); self.assertEqual(r["features"]["dims"], dict(color=128, hog=1296, glcm=4, combined=1428)); self.assertTrue(r["methods"]["hsv"]["result"].startswith("data:image/png"))
        self.assertEqual(processing.analyze(jpg("orange", False), "none")["features"]["method"], "none")
        blank = cv2.imencode(".png", np.full((200, 200, 3), 250, np.uint8))[1].tobytes(); self.assertTrue(processing.analyze(blank, "hsv")["methods"]["hsv"]["failed"])

    def test_readiness_and_job_progress_parser(self):
        from app.services.readiness import readiness
        from app.jobs import manager
        r = readiness(); self.assertTrue(r["ready"], r["reasons"]); self.assertTrue(r["artifacts_exist"])
        import time; jid = "t-1"; (manager.JOBS).mkdir(parents=True, exist_ok=True); (manager.JOBS / f"{jid}.log").write_text("RENCANA: 4 eksperimen\nGambar gagal diproses: {}\nDONE a-b (1/4) val\nDONE c-d (2/4) val\n")
        j = manager.describe(dict(id=jid, kind="train", status="running", started=time.time(), ended=None)); self.assertEqual(j["progress"], dict(stage="training_models", experiments_done=["a-b", "c-d"], experiments_total=4))


if __name__ == "__main__":
    unittest.main()
