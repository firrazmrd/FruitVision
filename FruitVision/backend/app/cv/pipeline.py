"""Pipeline pengolahan citra FruitVision: resize 224x224 -> segmentasi (none | hsv | grabcut) -> fitur (HSV hist, HOG, GLCM).

Fungsi yang sama dipakai untuk training, inferensi, dan Image Processing Lab (tidak ada implementasi demo terpisah).
"""
import hashlib, io, json
import cv2, numpy as np
from PIL import Image, ImageOps
from skimage.feature import hog, graycomatrix, graycoprops

Image.MAX_IMAGE_PIXELS = 200_000_000  # foto kamera DSLR (~24 MP) aman; batas ukuran upload ada di API

SIZE = 224
HSV_BINS = (8, 4, 4)
HOG_PARAMS = dict(orientations=9, pixels_per_cell=(32, 32), cells_per_block=(2, 2), block_norm="L2-Hys")
GLCM_PARAMS = dict(distances=[1], angles=[0, np.pi / 4, np.pi / 2, 3 * np.pi / 4], levels=32, symmetric=True, normed=True)
MIN_FG = 0.02            # foreground < 2% citra dianggap segmentasi GAGAL (tidak ada fallback diam-diam)
GRABCUT_ITERS, GRABCUT_MARGIN = 5, 0.05
SEG_METHODS = ("none", "hsv", "grabcut")   # "none" = tanpa segmentasi (mask penuh), dipakai sebagai pembanding ablasi

# Parameter yang memengaruhi nilai fitur. Hash-nya masuk kunci cache dan metadata model, sehingga
# mengubah parameter apa pun membuat cache lama tidak terpakai (di FishVision cache tidak memuat ini).
PIPELINE_PARAMS = dict(
    version=1, size=SIZE, resize="INTER_AREA, squash tanpa mempertahankan rasio", hsv_bins=list(HSV_BINS),
    hog={k: str(v) for k, v in HOG_PARAMS.items()},
    glcm=dict(distances=GLCM_PARAMS["distances"], angles_deg=[0, 45, 90, 135], levels=GLCM_PARAMS["levels"], props=["contrast", "correlation", "energy", "homogeneity"], agg="mean over angles"),
    min_fg=MIN_FG, grabcut=dict(iters=GRABCUT_ITERS, rect_margin=GRABCUT_MARGIN), morph=dict(open=5, close=9, keep="largest component, holes filled"),
)


def pipeline_hash() -> str:
    return hashlib.sha1(json.dumps(PIPELINE_PARAMS, sort_keys=True).encode()).hexdigest()[:12]


def load_resize(src):
    """Muat path/bytes -> BGR uint8 224x224. EXIF orientasi diterapkan. JPEG besar didekode dalam skala kecil (hemat RAM/waktu)."""
    try:
        with Image.open(io.BytesIO(src) if isinstance(src, (bytes, bytearray)) else str(src)) as im:
            if im.format == "JPEG":
                im.draft("RGB", (SIZE * 2, SIZE * 2))
            arr = np.asarray(ImageOps.exif_transpose(im).convert("RGB"))
    except Exception as e:
        raise ValueError("Gambar tidak valid atau rusak.") from e
    return cv2.resize(cv2.cvtColor(arr, cv2.COLOR_RGB2BGR), (SIZE, SIZE), interpolation=cv2.INTER_AREA)


# ---------------------------------------------------------------- segmentasi
def _clean(mask):
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    out = np.zeros_like(mask)
    if cnts:
        cv2.drawContours(out, [max(cnts, key=cv2.contourArea)], -1, 255, cv2.FILLED)
    return out


def _hsv_threshold(img):
    """Warna latar diestimasi dari piksel tepi; buah = piksel yang jauh dari warna itu (Otsu pada jarak HSV)."""
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV).astype(np.float32)
    border = np.concatenate([hsv[:8].reshape(-1, 3), hsv[-8:].reshape(-1, 3), hsv[:, :8].reshape(-1, 3), hsv[:, -8:].reshape(-1, 3)])
    d = np.abs(hsv - np.median(border, axis=0)); d[..., 0] = np.minimum(d[..., 0], 180 - d[..., 0])
    score = np.clip(d[..., 0] + 0.5 * d[..., 1] + 0.5 * d[..., 2], 0, 255).astype(np.uint8)
    return cv2.threshold(score, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]


def segment_hsv(img):
    return _clean(_hsv_threshold(img))


def _grabcut_raw(img, iters=GRABCUT_ITERS):
    mask = np.zeros(img.shape[:2], np.uint8)
    m = int(SIZE * GRABCUT_MARGIN); rect = (m, m, SIZE - 2 * m, SIZE - 2 * m)
    cv2.grabCut(img, mask, rect, np.zeros((1, 65)), np.zeros((1, 65)), iters, cv2.GC_INIT_WITH_RECT)
    return np.where((mask == 1) | (mask == 3), 255, 0).astype(np.uint8)


def segment_grabcut(img, iters=GRABCUT_ITERS):
    return _clean(_grabcut_raw(img, iters))


def segment_none(img):
    return np.full(img.shape[:2], 255, np.uint8)


SEGMENTERS = {"none": segment_none, "hsv": segment_hsv, "grabcut": segment_grabcut}


def segment(img, method="grabcut"):
    if method not in SEGMENTERS:
        raise ValueError(f"Metode segmentasi tidak dikenal: {method}")
    mask = SEGMENTERS[method](img)
    if method != "none" and mask.sum() / 255 < MIN_FG * SIZE * SIZE:
        raise ValueError("Foreground kosong/terlalu kecil; segmentasi gagal.")  # tanpa fallback diam-diam
    return mask


# ---------------------------------------------------------------- fitur
def f_color(img, mask):
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    h = cv2.calcHist([hsv], [0, 1, 2], mask, HSV_BINS, [0, 180, 0, 256, 0, 256]).flatten()
    return h / (h.sum() + 1e-9)


def f_hog(img, mask):
    return hog(cv2.cvtColor(cv2.bitwise_and(img, img, mask=mask), cv2.COLOR_BGR2GRAY), **HOG_PARAMS)


def f_glcm(img, mask):
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    q = np.where(mask > 0, (g // (256 // GLCM_PARAMS["levels"])) + 1, 0).astype(np.uint8)  # level 0 = latar
    P = graycomatrix(q, GLCM_PARAMS["distances"], GLCM_PARAMS["angles"], levels=GLCM_PARAMS["levels"] + 1, symmetric=True, normed=False)
    P = P[1:, 1:].astype(np.float64); P /= (P.sum(axis=(0, 1), keepdims=True) + 1e-12)
    return np.array([graycoprops(P, p).mean() for p in ("contrast", "correlation", "energy", "homogeneity")])


BLOCKS = ("color", "hog", "glcm")
BLOCK_FN = {"color": f_color, "hog": f_hog, "glcm": f_glcm}
FEATURE_SETS = {"color": ["color"], "hog": ["hog"], "glcm": ["glcm"], "all": ["color", "hog", "glcm"]}
_dummy = np.zeros((SIZE, SIZE, 3), np.uint8); _dm = np.full((SIZE, SIZE), 255, np.uint8)
BLOCK_DIMS = {b: int(len(BLOCK_FN[b](_dummy, _dm))) for b in BLOCKS}     # color 128, hog 1296, glcm 4


def feature_dim(feature_set):
    return sum(BLOCK_DIMS[b] for b in FEATURE_SETS[feature_set])


def extract(img, mask, feature_set):
    return np.concatenate([BLOCK_FN[b](img, mask) for b in FEATURE_SETS[feature_set]])
