import json
from ..data.dataset_config import ART, META, MODELS, SPLITS, raw_root


def _mt(p): return p.stat().st_mtime if p.exists() else 0


def readiness(require_selection=True):
    from ..data.data_splitter import load_verified_manifest
    r, rep, rp = [], None, META / "validation_report.json"
    if not ((META / "dataset_path.txt").exists() or raw_root().exists()): r.append("Folder dataset belum dikonfigurasi.")
    stale = False
    if not rp.exists(): r.append("Dataset belum divalidasi.")
    else:
        rep = json.loads(rp.read_text(encoding="utf-8"))
        stale = max(_mt(META / n) for n in ("exclusions.csv", "folder_mapping.json", "dataset_path.txt")) > _mt(rp)
        if stale: r.append("Konfigurasi/pemetaan/exclusions berubah setelah validasi terakhir; validasi ulang.")
        if not rep["passed"]: r.append("Validasi dataset GAGAL: " + "; ".join(rep["problems"])[:300])
    try:
        load_verified_manifest(); manifest = dict(status="ok", **json.loads((SPLITS / "split_meta.json").read_text(encoding="utf-8")))
    except SystemExit as e:
        manifest = dict(status="missing_or_invalid", message=str(e.code)); r.append("Manifest: " + str(e.code))
    sel = META / "seg_eval" / "selection.json"; selection = json.loads(sel.read_text(encoding="utf-8")) if sel.exists() else None
    if require_selection and selection is None: r.append("Metode segmentasi belum dipilih (evaluasi visual).")
    return dict(ready=not r, reasons=r, dataset_path=str(raw_root()),
                validation=None if rep is None else dict(passed=rep["passed"], stale=stale, total=rep["total"], checked_at=rep["checked_at"], problems=rep["problems"], warnings=rep["warnings"],
                                                         exact_duplicate_groups=rep["exact_duplicate_groups"], near_duplicate_pairs=rep["near_duplicate_pairs"], extensions=rep["extensions"]),
                manifest=manifest, segmentation_selection=selection, artifacts_exist=MODELS.exists() and any(MODELS.glob("*.joblib")))
