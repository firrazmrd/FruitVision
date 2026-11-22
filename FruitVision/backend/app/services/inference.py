"""Inferensi: satu gambar -> jenis buah + kondisi (fresh/rotten) + confidence + pratinjau segmentasi.

Model aktif (ART/active.json): {"fruit": id, "condition": id} (dua model, utama) ATAU {"joint": id} (satu model 16 kelas).
Prediksi = argmax predict_proba, aturan yang sama dengan evaluasi. Kegagalan segmentasi dilaporkan, tidak ada fallback diam-diam."""
import base64, json, time
import cv2, joblib, numpy as np
from ..cv.pipeline import extract, load_resize, segment
from ..data.dataset_config import ART, MODELS
from ..data.labels import split_label

_b = {}
NOTE = "Model hanya mengenali 8 jenis buah dan 2 kondisi pada dataset; gambar di luar itu tetap akan dijawab salah satu kelas (penolakan 'unknown' belum dikalibrasi)."
CONF_NOTE = "Confidence adalah probabilitas model, bukan jaminan prediksi benar."


def active():
    p = ART / "active.json"; return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


def set_active(sel: dict):
    ok = ({"fruit", "condition"} == set(sel)) or ({"joint"} == set(sel))
    if not ok: raise ValueError("Pilih {fruit, condition} atau {joint}.")
    for task, eid in sel.items():
        f = MODELS / f"{eid}.joblib"
        if not f.exists(): raise FileNotFoundError(f"Model {eid} tidak ada.")
        if bundle(eid)["meta"]["task"] != task: raise ValueError(f"Model {eid} bukan model tugas '{task}'.")
    ART.mkdir(parents=True, exist_ok=True); (ART / "active.json").write_text(json.dumps(dict(sel, activated_at=time.strftime("%Y-%m-%dT%H:%M:%S"))), encoding="utf-8"); return active()


def bundle(eid):
    f = MODELS / f"{eid}.joblib"; k = (eid, f.stat().st_mtime)
    if k not in _b: _b.clear(); _b[k] = joblib.load(f)
    return _b[k]


def _png(img): return "data:image/png;base64," + base64.b64encode(cv2.imencode(".png", img)[1]).decode()


def _proba(b, img, masks):
    meta = b["meta"]; seg = meta["segmentation"]
    if seg not in masks: masks[seg] = segment(img, seg)           # ValueError bila gagal
    p = b["model"].predict_proba(b["scaler"].transform([extract(img, masks[seg], meta["feature"])]))[0]
    return p, [str(c) for c in b["model"].classes_]


def _top(p, cls, n=5):
    o = np.argsort(p)[::-1][:n]; return [dict(label=cls[i], probability=float(p[i])) for i in o]


def classify(data: bytes):
    t0 = time.perf_counter(); act = active()
    if not act: raise LookupError("Belum ada model aktif.")
    img = load_resize(data); masks, out = {}, dict(accepted=True, reason=None, note=NOTE, confidence_note=CONF_NOTE, models={})
    try:
        if "joint" in act:
            b = bundle(act["joint"]); p, cls = _proba(b, img, masks); i = int(np.argmax(p)); fruit, cond = split_label(cls[i]); out["models"] = dict(joint=b["meta"]["id"])
            fp, cp = {}, {}
            for pi, c in zip(p, cls): f, k = split_label(c); fp[f] = fp.get(f, 0) + pi; cp[k] = cp.get(k, 0) + pi
            out["fruit"] = dict(label=fruit, confidence=float(fp[fruit]), top=_top(np.array(list(fp.values())), list(fp)))
            out["condition"] = dict(label=cond, confidence=float(cp[cond]), top=_top(np.array(list(cp.values())), list(cp)), joint_label=cls[i], joint_confidence=float(p[i]))
            segs = {b["meta"]["segmentation"]}
        else:
            segs = set()
            for task in ("fruit", "condition"):
                b = bundle(act[task]); p, cls = _proba(b, img, masks); i = int(np.argmax(p)); out["models"][task] = b["meta"]["id"]; segs.add(b["meta"]["segmentation"])
                out[task] = dict(label=cls[i], confidence=float(p[i]), top=_top(p, cls))
    except ValueError as e:
        return dict(accepted=False, reason="segmentation_failed", detail=str(e), fruit=None, condition=None, note=NOTE, models=out["models"], processing_ms=round(1000 * (time.perf_counter() - t0), 1))
    seg = next((s for s in ("grabcut", "hsv") if s in masks), None)
    out["segmentation"] = dict(methods=sorted(segs), preview=_png(np.where(masks[seg][..., None] > 0, img, 235).astype(np.uint8)) if seg else _png(img), preview_is_segmented=seg is not None)
    out["processing_ms"] = round(1000 * (time.perf_counter() - t0), 1)
    return out
