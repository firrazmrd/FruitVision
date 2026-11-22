"""Logika endpoint (tanpa ketergantungan FastAPI) supaya dapat diuji langsung. routes.py hanya menghubungkan HTTP -> fungsi ini."""
import csv, io, json
from typing import Optional
import pandas as pd
from PIL import Image
from ..cv import pipeline as P
from ..data.dataset_config import ART, CACHE, HISTORY, META, MODELS, RES, locations, raw_root
from ..data.labels import CONDITIONS, FRUITS, LABELS
from ..jobs import manager
from ..services import history, inference, processing
from ..services.readiness import readiness

VERSION = "0.4.0"
MAX_UPLOAD, MAX_PIXELS = 15 * 1024 * 1024, 60_000_000


class ApiError(Exception):
    def __init__(self, status: int, detail):
        super().__init__(str(detail)); self.status, self.detail = status, detail


def _read_json(p, msg):
    if not p.exists(): raise ApiError(404, msg)
    return json.loads(p.read_text(encoding="utf-8"))


# ---------------------------------------------------------------- upload
def check_upload(data: bytes) -> bytes:
    if len(data) > MAX_UPLOAD: raise ApiError(413, "File terlalu besar (maks 15 MB).")
    if not data: raise ApiError(422, "File kosong.")
    try:
        with Image.open(io.BytesIO(data)) as im:
            if im.format not in ("JPEG", "PNG", "MPO"): raise ApiError(415, "Hanya JPG/PNG.")
            if im.width * im.height > MAX_PIXELS: raise ApiError(413, "Resolusi terlalu besar.")
            im.verify()
    except ApiError: raise
    except Exception: raise ApiError(422, "Gambar rusak atau tidak dapat dibaca.")
    return data


# ---------------------------------------------------------------- status
def health():
    return dict(status="ok", version=VERSION, job_running=manager.active(), locations=locations())


def storage():
    def size(d, pat="*"):
        return sum(f.stat().st_size for f in d.rglob(pat) if f.is_file()) if d.exists() else 0
    return dict(locations=locations(), bytes=dict(cache=size(CACHE), models=size(MODELS), results=size(RES), history=size(HISTORY)), cache_files=len(list(CACHE.glob("features_*.npz"))) if CACHE.exists() else 0)


def clear_cache():
    if manager.active(): raise ApiError(409, "Ada job yang sedang berjalan; cache tidak dihapus.")
    n = 0
    for f in CACHE.glob("features_*.npz") if CACHE.exists() else []: f.unlink(); n += 1
    return dict(deleted=n)


def pipeline_info():
    return dict(params=P.PIPELINE_PARAMS, hash=P.pipeline_hash(), block_dims=P.BLOCK_DIMS, seg_methods=list(P.SEG_METHODS))


# ---------------------------------------------------------------- dataset
def dataset_classes():
    rep = _read_json(META / "validation_report.json", "Belum divalidasi.")
    return [dict(name=l, fruit=l.split("_")[0], condition=l.split("_")[1], found=rep["counts"].get(l, 0), excluded=rep.get("excluded", {}).get(l, 0)) for l in LABELS]


_hc = {}


def _hashes():
    p = META / "hashes.csv"
    if not p.exists(): raise ApiError(404, "Dataset belum divalidasi.")
    if _hc.get("m") != (p, p.stat().st_mtime): _hc.update(m=(p, p.stat().st_mtime), df=pd.read_csv(p, encoding="utf-8"))
    return _hc["df"]


def safe_image(rel):
    if rel not in set(_hashes().path): raise ApiError(404, "Gambar tidak ada dalam dataset tervalidasi.")
    root = raw_root().resolve(); full = (root / rel).resolve()
    if root not in full.parents or not full.is_file(): raise ApiError(404, "Berkas tidak ditemukan.")
    return full


def dataset_images(label: Optional[str], limit: int, offset: int):
    d = _hashes()
    if label: d = d[d.label == label]
    return dict(total=len(d), items=d.iloc[offset:offset + limit][["path", "label"]].to_dict("records"))


def thumbnail_bytes(rel, size=256):
    with Image.open(safe_image(rel)) as im:
        if im.format == "JPEG": im.draft("RGB", (size * 2, size * 2))
        im = im.convert("RGB"); im.thumbnail((size, size)); buf = io.BytesIO(); im.save(buf, "JPEG", quality=80)
    return buf.getvalue()


# ---------------------------------------------------------------- hasil eksperimen
def results():
    return [json.loads(p.read_text(encoding="utf-8")) for p in sorted(RES.glob("*-*-*-*.json"))] if RES.exists() else []


def _row(r):
    return dict(id=r["id"], task=r["task"], feature=r["feature"], feature_dim=r["feature_dim"], classifier=r["classifier"], segmentation=r["segmentation"], best_params=r["best_params"],
                val_macro_f1=r["val_macro_f1"], test_accuracy=r["test_accuracy"], test_macro_f1=r["test_macro_f1"], test_macro_precision=r["test"]["macro_precision"], test_macro_recall=r["test"]["macro_recall"],
                timing=r["timing"], trained_at=r["trained_at"], n_train=r["n_train"], n_val=r["n_val"], n_test=r["n_test"], derived=r.get("derived"))


def benchmark_summary():
    rows = [_row(r) for r in results()]; best = {}
    for t in {r["task"] for r in rows}:
        best[t] = max((r for r in rows if r["task"] == t), key=lambda r: r["val_macro_f1"])["id"]
    return dict(experiments=rows, best_by_validation=best, empty=not rows,
                note="Model dipilih berdasarkan Macro F1 VALIDATION. Angka test dilaporkan sebagai evaluasi akhir dan tidak dipakai memilih hyperparameter atau model.")


def experiment(eid):
    p = RES / f"{eid}.json"
    if "/" in eid or "\\" in eid or ".." in eid or not p.exists(): raise ApiError(404, "Eksperimen tidak ditemukan.")
    return json.loads(p.read_text(encoding="utf-8"))


def benchmark_export():
    rs = results()
    if not rs: raise ApiError(404, "Belum ada eksperimen.")
    b = io.StringIO(); w = csv.writer(b); cols = ["id", "task", "feature", "classifier", "segmentation", "val_macro_f1", "test_accuracy", "test_macro_f1"]; w.writerow(cols)
    for r in rs: w.writerow([r[c] for c in cols])
    return b.getvalue()


# ---------------------------------------------------------------- model
def models_list():
    act = inference.active() or {}; sel = {v for k, v in act.items() if k in ("fruit", "condition", "joint")}; res = {r["id"]: r for r in results()}; out = []
    for f in sorted(MODELS.glob("*.joblib")) if MODELS.exists() else []:
        e = f.stem; r = res.get(e)
        out.append(dict(id=e, task=(r or {}).get("task") or e.split("-")[0], active=e in sel,
                        **({k: r[k] for k in ("feature", "classifier", "segmentation", "val_macro_f1", "test_macro_f1", "test_accuracy", "trained_at")} if r else {})))
    return out


def models_active():
    return dict(active=inference.active())


def models_activate(sel: dict):
    try: return dict(active=inference.set_active(sel))
    except FileNotFoundError as e: raise ApiError(404, str(e))
    except ValueError as e: raise ApiError(400, str(e))


# ---------------------------------------------------------------- klasifikasi
def classify(data: bytes, filename: str, save: bool = True):
    check_upload(data)
    try: res = inference.classify(data)
    except LookupError as e: raise ApiError(409, str(e))
    except ValueError as e: raise ApiError(422, str(e))
    if save:
        try: res["history_id"] = history.add(filename, data, res)["id"]
        except Exception: res["history_id"] = None         # gagal menyimpan riwayat tidak boleh menggagalkan hasil analisis
    return res


def processing_analyze(data: Optional[bytes], path: Optional[str], method: str):
    if (data is None) == (path is None): raise ApiError(400, "Berikan tepat satu: file atau path.")
    if method not in P.SEG_METHODS: raise ApiError(400, "Metode harus none/hsv/grabcut.")
    raw = check_upload(data) if data is not None else safe_image(path).read_bytes()
    try: return processing.analyze(raw, method)
    except ValueError as e: raise ApiError(422, str(e))


def history_list(limit, offset, fruit, condition):
    if fruit and fruit not in FRUITS or condition and condition not in CONDITIONS: raise ApiError(400, "Filter tidak valid.")
    return history.list_items(limit, offset, fruit, condition)
