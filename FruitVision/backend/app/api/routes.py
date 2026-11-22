import json
from typing import Dict, Literal, Optional
from fastapi import APIRouter, File, Form, Query, UploadFile
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel
from ..jobs import manager
from ..services import history
from ..services.readiness import readiness
from . import handlers as H
from .handlers import ApiError

router = APIRouter()


class ActivateBody(BaseModel):
    fruit: Optional[str] = None
    condition: Optional[str] = None
    joint: Optional[str] = None


def _read(f: UploadFile) -> bytes:
    return f.file.read(H.MAX_UPLOAD + 1)


@router.get("/health")
def health(): return H.health()
@router.get("/storage")
def storage(): return H.storage()
@router.delete("/storage/cache")
def clear_cache(): return H.clear_cache()
@router.get("/pipeline")
def pipeline(): return H.pipeline_info()

# ---- dataset (hanya baca; penyiapan dataset memakai CLI)
@router.get("/dataset/status")
def dataset_status(): return readiness()
@router.get("/dataset/classes")
def dataset_classes(): return H.dataset_classes()
@router.get("/dataset/images")
def dataset_images(label: Optional[str] = None, limit: int = Query(12, ge=1, le=200), offset: int = Query(0, ge=0)): return H.dataset_images(label, limit, offset)
@router.get("/dataset/thumbnail")
def dataset_thumbnail(path: str, size: int = Query(256, ge=32, le=512)): return Response(H.thumbnail_bytes(path, size), media_type="image/jpeg")

# ---- model
@router.get("/models")
def models(): return H.models_list()
@router.get("/models/active")
def models_active(): return H.models_active()
@router.post("/models/activate")
def models_activate(b: ActivateBody): return H.models_activate({k: v for k, v in b.model_dump().items() if v})

# ---- klasifikasi + riwayat
@router.post("/classify")
def classify(file: UploadFile = File(...), save: bool = Query(True)): return H.classify(_read(file), file.filename or "upload", save)
@router.get("/history")
def history_list(limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0), fruit: Optional[str] = None, condition: Optional[str] = None): return H.history_list(limit, offset, fruit, condition)
@router.get("/history/summary")
def history_summary(): return history.summary()
@router.get("/history/{rid}/thumbnail")
def history_thumb(rid: str):
    p = history.thumb_path(rid)
    if p is None: raise ApiError(404, "Thumbnail tidak ditemukan.")
    return FileResponse(p, media_type="image/jpeg")
@router.delete("/history/{rid}")
def history_delete(rid: str):
    if not history.delete(rid): raise ApiError(404, "Riwayat tidak ditemukan.")
    return dict(deleted=rid)
@router.delete("/history")
def history_clear(): return dict(deleted=history.clear())

# ---- image lab (fungsi yang sama dengan training/inferensi)
@router.post("/processing/analyze")
def p_analyze(file: Optional[UploadFile] = File(None), path: Optional[str] = Form(None), method: Literal["none", "hsv", "grabcut"] = Form("grabcut")):
    return H.processing_analyze(_read(file) if file is not None else None, path, method)
@router.post("/processing/compare-segmentation")
def p_compare(file: Optional[UploadFile] = File(None), path: Optional[str] = Form(None)):
    r = H.processing_analyze(_read(file) if file is not None else None, path, "grabcut")
    return dict(original_resized=r["original_resized"], hsv_representation=r["hsv_representation"], methods=r["methods"])

# ---- hasil eksperimen (hanya berkas hasil nyata; daftar kosong = empty state)
@router.get("/benchmark/summary")
def bench_summary(): return H.benchmark_summary()
@router.get("/benchmark/experiment")
def bench_experiment(id: str):
    r = H.experiment(id); return dict(id=id, labels=r["labels"], confusion_matrix=r["confusion_matrix"], report=r["report"], best_params=r["best_params"], timing=r["timing"], pipeline_hash=r["pipeline_hash"],
                                       config_hash=r["config_hash"], seed=r["seed"], n_train=r["n_train"], n_val=r["n_val"], n_test=r["n_test"], derived=r.get("derived"))
@router.get("/benchmark/export")
def bench_export(): return Response(H.benchmark_export(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=fruitvision_benchmark.csv"})
@router.get("/training/jobs")
def jobs(): return manager.list_jobs()
