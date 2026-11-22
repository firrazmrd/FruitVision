import io, unittest
import cv2, numpy as np
from PIL import Image
import support
from support import fruit_image
from app.cv.pipeline import BLOCK_DIMS, extract, feature_dim, load_resize, pipeline_hash, segment, segment_none
from app.ml.scaling import BlockScaler

IMG = cv2.resize(fruit_image(np.random.RandomState(0), "orange", False), (224, 224))


class CV(unittest.TestCase):
    def test_segmentation_finds_foreground(self):
        for m in ("hsv", "grabcut"):
            self.assertTrue(0.05 < (segment(IMG, m) > 0).mean() < 0.7, m)

    def test_none_is_full_mask_and_never_fails(self):
        self.assertTrue((segment(np.full((224, 224, 3), 250, np.uint8), "none") == 255).all())

    def test_blank_image_fails_loudly(self):
        for m in ("hsv", "grabcut"):
            with self.assertRaises(ValueError): segment(np.full((224, 224, 3), 250, np.uint8), m)

    def test_feature_dimensions(self):
        mk = segment(IMG, "hsv")
        self.assertEqual([len(extract(IMG, mk, s)) for s in ("color", "hog", "glcm", "all")], [128, 1296, 4, 1428])
        self.assertEqual(feature_dim("all"), 1428); self.assertEqual(BLOCK_DIMS, dict(color=128, hog=1296, glcm=4))

    def test_load_resize_bad_input_and_exif_and_big(self):
        with self.assertRaises(ValueError): load_resize(b"junk")
        a = np.zeros((400, 600, 3), np.uint8); a[:, :300] = 255; ex = Image.Exif(); ex[274] = 6; buf = io.BytesIO(); Image.fromarray(a).save(buf, "JPEG", exif=ex)
        o = load_resize(buf.getvalue()); self.assertEqual(o.shape, (224, 224, 3))
        self.assertGreater(o[:112].mean(), o[112:].mean() + 100)    # rotasi EXIF 6 (90 derajat) memindahkan sisi putih ke atas
        big = np.random.RandomState(0).randint(0, 255, (300, 400, 3), np.uint8); big = cv2.resize(big, (6000, 4000)); buf = io.BytesIO(); Image.fromarray(big).save(buf, "JPEG", quality=50)
        self.assertEqual(load_resize(buf.getvalue()).shape, (224, 224, 3))

    def test_pipeline_hash_changes_with_params(self):
        import app.cv.pipeline as P
        h = pipeline_hash(); old = P.PIPELINE_PARAMS["size"]; P.PIPELINE_PARAMS["size"] = 999
        try: self.assertNotEqual(h, pipeline_hash())
        finally: P.PIPELINE_PARAMS["size"] = old

    def test_block_scaler_equal_weighting_and_train_only(self):
        rs = np.random.RandomState(0); tr = rs.randn(50, 10) * 5 + 3; te = rs.randn(20, 10) * 5 + 3
        s = BlockScaler([8, 2], "equal").fit(tr); self.assertTrue(np.allclose(s.mean_, tr.mean(0)))
        Z = s.transform(tr); self.assertAlmostEqual(Z[:, :8].var(0).sum(), 1.0, places=6); self.assertAlmostEqual(Z[:, 8:].var(0).sum(), 1.0, places=6)
        self.assertFalse(np.allclose(s.mean_, np.vstack([tr, te]).mean(0)))
        self.assertTrue(np.allclose(BlockScaler([8, 2], "none").fit(tr).transform(tr).var(0), 1.0))


if __name__ == "__main__":
    unittest.main()
