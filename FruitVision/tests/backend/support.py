"""Lingkungan sintetis terisolasi. Variabel lingkungan diset SEBELUM app diimpor sehingga tes tidak bisa menyentuh data/model/hasil asli.
Seluruh data di sini SINTETIS: hanya untuk menguji alur kode, BUKAN hasil penelitian."""
import json, os, subprocess, sys, tempfile
from pathlib import Path
import cv2, numpy as np

T = Path(os.environ.get("FRUITVISION_TEST_DIR") or tempfile.mkdtemp(prefix="fvtest_"))
T.mkdir(parents=True, exist_ok=True)
BACKEND = Path(__file__).resolve().parents[2] / "backend"
os.environ.update(FRUITVISION_DATA=str(T / "data"), FRUITVISION_RAW=str(T / "raw"), FRUITVISION_CACHE=str(T / "cache"), FRUITVISION_ARTIFACTS=str(T / "art"),
                  FRUITVISION_RESULTS=str(T / "res"), FRUITVISION_MIN_PER_CLASS="10", FRUITVISION_NEAR="2")
os.environ.pop("FRUITVISION_EXPECTED", None)
sys.path.insert(0, str(BACKEND))
from app.data.labels import FRUITS, LABELS, split_label  # noqa: E402

DISPLAY = lambda lab: " ".join(reversed(lab.split("_"))).title()     # apple_fresh -> "Fresh Apple"
SMALL_CFG = dict(tasks=["fruit", "condition"], features=["color", "hog", "glcm", "all"], classifiers=["knn", "svm"], knn=dict(k=[3], weights=["uniform"]),
                 svm=dict(C_rbf=[10], gamma_mult=[1], C_linear=[0.1]), block_weighting_for_all=["none", "equal"])


def fruit_image(rs, fruit, rotten, big=False):
    h, w = (300, 420)
    im = np.full((h, w, 3), 245, np.uint8); fi = FRUITS.index(fruit)
    hue = (fi * 22 + rs.randint(0, 6)) % 180; sat, val = (110, 95) if rotten else (200, 210)
    col = cv2.cvtColor(np.uint8([[[hue, sat + rs.randint(-10, 10), val + rs.randint(-10, 10)]]]), cv2.COLOR_HSV2BGR)[0, 0].tolist()
    c = (210 + rs.randint(-15, 15), 150 + rs.randint(-10, 10)); ax = (60 + 10 * (fi % 4) + rs.randint(-5, 5), 55 + 8 * (fi // 4) + rs.randint(-5, 5))
    cv2.ellipse(im, c, ax, rs.randint(-15, 15), 0, 360, col, -1)
    if rotten:
        for _ in range(8): cv2.circle(im, (c[0] + rs.randint(-ax[0] // 2, ax[0] // 2), c[1] + rs.randint(-ax[1] // 2, ax[1] // 2)), rs.randint(4, 9), (20, 25, 30), -1)
    return np.clip(im.astype(int) + rs.randint(-5, 5, im.shape), 0, 255).astype(np.uint8)


def run(*args):
    return subprocess.run([sys.executable, "-m", *args], cwd=BACKEND, capture_output=True, text=True, env=os.environ)


_state = {}


def prepared():
    """Bangun dataset sintetis + jalankan: inspect -> mapping -> validate -> split -> seleksi segmentasi -> eksperimen kecil (+ablasi)."""
    if _state: return T
    rs = np.random.RandomState(1)
    for lab in LABELS:
        fruit, cond = split_label(lab)
        (T / "raw" / "Original Images" / DISPLAY(lab)).mkdir(parents=True, exist_ok=True); (T / "raw" / "Augmented Images" / DISPLAY(lab)).mkdir(parents=True, exist_ok=True)
        for k in range(24): cv2.imwrite(str(T / "raw" / "Original Images" / DISPLAY(lab) / f"{DISPLAY(lab)} ({k}).jpg"), fruit_image(rs, fruit, cond == "rotten"))
        for k in range(3): cv2.imwrite(str(T / "raw" / "Augmented Images" / DISPLAY(lab) / f"aug_{k}.jpg"), fruit_image(rs, fruit, cond == "rotten"))
    r = run("app.data.inspect_folder", "--root", str(T / "raw")); assert r.returncode == 0, r.stdout + r.stderr
    prop = json.loads((T / "data" / "meta" / "folder_mapping.proposed.json").read_text()); (T / "data" / "meta" / "folder_mapping.json").write_text(json.dumps(prop))
    r = run("app.data.dataset_validator"); assert r.returncode == 0, r.stdout[-1500:]
    r = run("app.data.data_splitter"); assert r.returncode == 0, r.stdout + r.stderr
    sel = T / "data" / "meta" / "seg_eval"; sel.mkdir(parents=True, exist_ok=True); (sel / "selection.json").write_text(json.dumps(dict(method="hsv", reason="synthetic test")))
    (T / "cfg.json").write_text(json.dumps(SMALL_CFG))
    r = run("app.cv.experiments", "--run", "--ablation", "--config", str(T / "cfg.json"), "--n-jobs", "1"); assert r.returncode == 0, r.stdout[-1500:] + r.stderr[-1500:]
    _state["out"] = r.stdout
    return T
