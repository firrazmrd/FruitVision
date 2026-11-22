"""Konstanta dan lokasi bersama. Semua lokasi dapat dipindah lewat environment variable (mis. ke drive D:):

  FRUITVISION_HOME       SATU folder induk untuk semua data kerja. Bila diset, otomatis:
                           HOME/data (meta, splits), HOME/cache, HOME/artifacts (model, job, riwayat), HOME/results
                         Variabel di bawah (jika diset) menimpa lokasi turunan dari HOME.
  FRUITVISION_DATA       akar data kerja: meta/, splits/ (default backend/data)
  FRUITVISION_RAW        folder dataset hasil ekstraksi (hanya dibaca, tidak pernah diubah)
  FRUITVISION_CACHE      cache fitur (default <DATA>/cache)
  FRUITVISION_ARTIFACTS  model terlatih, job, kalibrasi (default backend/artifacts)
  FRUITVISION_RESULTS    hasil eksperimen JSON/CSV (default backend/experiments/results)
  FRUITVISION_EXPECTED   (opsional) JSON {label: jumlah_gambar_yang_diharapkan}
  FRUITVISION_MIN_PER_CLASS   jumlah gambar minimum per kelas (default 20)
  FRUITVISION_NEAR       ambang Hamming near-duplicate (default 12 dari 256 bit)
"""
import json, os, re
from pathlib import Path
from .labels import LABELS

BACKEND = Path(__file__).resolve().parents[2]
HOME = Path(os.environ["FRUITVISION_HOME"]) if os.environ.get("FRUITVISION_HOME") else None


def _loc(var, sub, default):
    """Prioritas: variabel spesifik > FRUITVISION_HOME/<sub> > default."""
    if os.environ.get(var):
        return Path(os.environ[var])
    return HOME / sub if HOME else default


DATA = _loc("FRUITVISION_DATA", "data", BACKEND / "data")
META, SPLITS = DATA / "meta", DATA / "splits"
CACHE = _loc("FRUITVISION_CACHE", "cache", DATA / "cache")
ART = _loc("FRUITVISION_ARTIFACTS", "artifacts", BACKEND / "artifacts")
MODELS = ART / "models"
HISTORY = ART / "history"
RES = _loc("FRUITVISION_RESULTS", "results", BACKEND / "experiments" / "results")


def locations():
    """Lokasi penyimpanan aktif (ditampilkan di UI agar jelas ke mana file pergi)."""
    return dict(home=str(HOME) if HOME else None, data=str(DATA), cache=str(CACHE), artifacts=str(ART), results=str(RES), dataset=str(raw_root()))


def _raw():  # prioritas: env FRUITVISION_RAW > data/meta/dataset_path.txt > data/raw
    if os.environ.get("FRUITVISION_RAW"):
        return Path(os.environ["FRUITVISION_RAW"])
    f = META / "dataset_path.txt"
    return Path(f.read_text(encoding="utf-8-sig").strip()) if f.exists() else DATA / "raw"


RAW = _raw()  # akar dataset pada saat import; gunakan raw_root() untuk nilai terkini
raw_root = _raw
CLASSES = LABELS
MIN_PER_CLASS = int(os.environ.get("FRUITVISION_MIN_PER_CLASS", 20))
IMG_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
EXT_FMT = {".jpg": "JPEG", ".jpeg": "JPEG", ".png": "PNG", ".bmp": "BMP", ".webp": "WEBP"}
SEED, RATIOS = 42, (0.70, 0.15, 0.15)
JUNK_NAMES = {"thumbs.db", ".ds_store", "desktop.ini"}


def expected_counts():
    """Jumlah per kelas yang diharapkan (opsional). Tidak ada angka bawaan: jumlah asli dataset harus diperiksa dulu."""
    p = os.environ.get("FRUITVISION_EXPECTED")
    return json.loads(Path(p).read_text(encoding="utf-8-sig")) if p else None


def load_folder_mapping():
    p = META / "folder_mapping.json"
    return json.loads(p.read_text(encoding="utf-8-sig")) if p.exists() else None


def norm(s):
    return re.sub(r"[^a-z0-9]", "", s.lower())
