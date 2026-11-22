import json, unittest
import pandas as pd
import support
from support import T, prepared, run


class SegEval(unittest.TestCase):
    @classmethod
    def setUpClass(cls): prepared()

    def test_sheet_scoring_and_selection(self):
        r = run("app.cv.seg_eval", "make", "--per-class", "2"); self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        d = T / "data" / "meta" / "seg_eval"; html = (d / "evaluation.html").read_text(encoding="utf-8"); self.assertIn("rot_kept", html); self.assertNotIn("fins_tail", html)
        s = pd.read_csv(d / "sample.csv"); cols = ["boundary", "background", "stem_leaf", "rot_kept", "noise", "holes"]; rows = []
        for _, x in s.iterrows():
            for m, v in (("hsv", 4), ("grabcut", 3)):
                row = dict(image_id=x.image_id, path=x.path, label=x.label, method=m, failed=0, **{c: v for c in cols}); row["rot_kept"] = None if x.label.endswith("_fresh") else v; rows.append(row)
        pd.DataFrame(rows).to_csv(d / "seg_scores.csv", index=False)
        r = run("app.cv.seg_eval", "summarize", "--select", "hsv", "--reason", "uji sintetis"); self.assertEqual(r.returncode, 0, r.stdout[-600:])    # baris fresh tanpa rot_kept dianggap lengkap
        sm = json.loads((d / "seg_eval_summary.json").read_text()); self.assertEqual(sm["hsv"]["overall_mean"], 4.0); self.assertEqual(sm["grabcut"]["scored_incomplete"], 0)
        self.assertEqual(json.loads((d / "selection.json").read_text())["method"], "hsv")
        bad = pd.read_csv(d / "seg_scores.csv"); bad.loc[bad.index[0], "boundary"] = None; bad.to_csv(d / "seg_scores.csv", index=False)
        self.assertNotEqual(run("app.cv.seg_eval", "summarize", "--select", "hsv", "--reason", "uji sintetis").returncode, 0)   # penilaian tidak lengkap ditolak


if __name__ == "__main__":
    unittest.main()
