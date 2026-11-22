import base64, time, cv2, numpy as np
from skimage.feature import hog
from ..cv import pipeline as P


def png(a):
    if a.ndim == 2: a = cv2.cvtColor(a, cv2.COLOR_GRAY2BGR)
    return "data:image/png;base64," + base64.b64encode(cv2.imencode(".png", a)[1]).decode()


def analyze(data: bytes, method="grabcut"):
    """Tampilan langkah-demi-langkah dari fungsi YANG SAMA dengan training/inferensi. method: hsv | grabcut | none (fitur dari mask penuh)."""
    t0 = time.perf_counter(); img = P.load_resize(data); out = dict(original_resized=png(img), hsv_representation=png(cv2.cvtColor(img, cv2.COLOR_BGR2HSV)), size=P.SIZE, methods={}); masks = {"none": P.segment_none(img)}
    for m, fn in (("hsv", P._hsv_threshold), ("grabcut", P._grabcut_raw)):
        raw = fn(img); clean = P._clean(raw); d = dict(raw_mask=png(raw), morph_mask=png(clean), failed=False)
        if clean.sum() / 255 < P.MIN_FG * P.SIZE ** 2: d.update(failed=True, message="Foreground kosong/terlalu kecil; segmentasi gagal.")
        else: masks[m] = clean; d.update(result=png(np.where(clean[..., None] > 0, img, 235).astype(np.uint8)), foreground_ratio=round(float((clean > 0).mean()), 4))
        out["methods"][m] = d
    out["features"] = None
    if method in masks:
        mk = masks[method]; c, h, g = P.f_color(img, mk), P.f_hog(img, mk), P.f_glcm(img, mk)
        _, v = hog(cv2.cvtColor(cv2.bitwise_and(img, img, mask=mk), cv2.COLOR_BGR2GRAY), visualize=True, **P.HOG_PARAMS)
        out["features"] = dict(method=method, color_hist=c.tolist(), hue_marginal=c.reshape(*P.HSV_BINS).sum(axis=(1, 2)).tolist(), hog_visualization=png((255 * v / (v.max() + 1e-9)).astype(np.uint8)),
            glcm=dict(zip(("contrast", "correlation", "energy", "homogeneity"), map(float, g))), glcm_params=dict(distances=P.GLCM_PARAMS["distances"], angles_deg=[0, 45, 90, 135], levels=P.GLCM_PARAMS["levels"], symmetric=True, normed=True),
            hog_params={k: str(x) for k, x in P.HOG_PARAMS.items()}, dims=dict(color=len(c), hog=len(h), glcm=len(g), combined=len(c) + len(h) + len(g)))
    out["processing_ms"] = round(1000 * (time.perf_counter() - t0), 1); return out
