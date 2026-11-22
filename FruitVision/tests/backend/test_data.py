import csv, hashlib, json, unittest
import support
from support import T, prepared, run
from app.data.labels import LABELS, propose_label, task_labels


class Labels(unittest.TestCase):
    def test_16_labels_and_derivation(self):
        self.assertEqual(len(LABELS), 16); self.assertEqual(task_labels(["apple_fresh", "guava_rotten"], "fruit"), ["apple", "guava"]); self.assertEqual(task_labels(["apple_fresh", "guava_rotten"], "condition"), ["fresh", "rotten"])

    def test_folder_proposals(self):
        self.assertEqual(propose_label(["Original Images", "Fresh Apple"]), ("apple_fresh", "exact"))
        self.assertEqual(propose_label(["Rotten_Strawberries"])[0], "strawberry_rotten"); self.assertEqual(propose_label(["Apple", "Fresh"]), ("apple_fresh", "SUGGESTED-REVIEW"))
        self.assertEqual(propose_label(["Augmented Images", "Fresh Apple"]), ("IGNORE", "AUGMENTED-IGNORE")); self.assertEqual(propose_label(["pineapple"])[0], None)
        for bad in (["Fresh"], ["Apple"], ["Mystery"]): self.assertIsNone(propose_label(bad)[0])


class DataPipeline(unittest.TestCase):
    @classmethod
    def setUpClass(cls): prepared()

    def test_augmented_folder_is_ignored_and_validation_passes(self):
        rep = json.loads((T / "data" / "meta" / "validation_report.json").read_text())
        self.assertTrue(rep["passed"], rep["problems"]); self.assertEqual(rep["total"], 16 * 24); self.assertEqual(rep["ignored_images"], 16 * 3)
        man = list(csv.DictReader(open(T / "data" / "splits" / "manifest.csv")))
        self.assertFalse(any("Augmented" in r["path"] for r in man)); self.assertEqual(len(man), 16 * 24)

    def test_validator_blocks_augmented_images_mapped_to_a_class(self):
        mp = T / "data" / "meta" / "folder_mapping.json"; orig = mp.read_text(); m = json.loads(orig)
        k = next(k for k in m if k.startswith("Augmented Images")); m[k] = "apple_fresh"; mp.write_text(json.dumps(m))
        try:
            r = run("app.data.dataset_validator"); self.assertNotEqual(r.returncode, 0); self.assertIn("augment", r.stdout.lower())
        finally:
            mp.write_text(orig); self.assertEqual(run("app.data.dataset_validator").returncode, 0)

    def test_validator_blocks_unmapped_and_bad_label(self):
        mp = T / "data" / "meta" / "folder_mapping.json"; orig = mp.read_text(); m = json.loads(orig)
        k = next(k for k in m if m[k] == "banana_rotten")
        try:
            m[k] = "pineapple_fresh"; mp.write_text(json.dumps(m)); self.assertNotEqual(run("app.data.dataset_validator").returncode, 0)
            m[k] = None; mp.write_text(json.dumps(m)); self.assertNotEqual(run("app.data.dataset_validator").returncode, 0)
        finally:
            mp.write_text(orig); self.assertEqual(run("app.data.dataset_validator").returncode, 0)

    def test_split_ratio_stratified_no_leakage(self):
        from app.data.data_splitter import load_verified_manifest
        d = load_verified_manifest(); self.assertTrue(all(set(g.split) == {"train", "val", "test"} for _, g in d.groupby("label")))
        self.assertTrue((d.groupby("cluster").split.nunique() == 1).all() and (d.groupby("sha256").split.nunique() == 1).all()); self.assertLess(abs((d.split == "train").mean() - 0.70), 0.03)

    def test_split_is_reproducible(self):
        f = T / "data" / "splits" / "manifest.csv"; before = hashlib.sha256(f.read_bytes()).hexdigest()
        self.assertEqual(run("app.data.data_splitter", "--force").returncode, 0); self.assertEqual(hashlib.sha256(f.read_bytes()).hexdigest(), before)

    def test_training_blocked_without_validation(self):
        v = T / "data" / "meta" / "validation_report.json"; v.rename(v.with_suffix(".bak"))
        try: self.assertNotEqual(run("app.cv.experiments", "--run", "--overwrite").returncode, 0)
        finally: v.with_suffix(".bak").rename(v)


if __name__ == "__main__":
    unittest.main()
