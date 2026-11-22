"""Konfigurasi eksperimen FruitVision (terpusat, dapat di-override lewat JSON: --config file.json).

Grid eksperimen = tugas x fitur x klasifikator x mode segmentasi.
  tugas      fruit (8 kelas) | condition (2 kelas) | joint (16 kelas, sebagai pembanding)
  fitur      color | hog | glcm | all (gabungan)
  klasifikator  knn | svm
  segmentasi    metode terpilih (hsv/grabcut), + "none" bila --ablation
Hyperparameter DIPILIH hanya pada VALIDATION split (Macro F1); test split hanya untuk pelaporan akhir.
"""
import copy, hashlib, json
from dataclasses import dataclass
from pathlib import Path
from ..data.dataset_config import SEED

DEFAULTS = dict(
    tasks=["fruit", "condition"],
    features=["color", "hog", "glcm", "all"],
    classifiers=["knn", "svm"],
    knn=dict(k=[3, 5, 7, 9], weights=["uniform", "distance"]),
    # SVM: rbf dengan gamma = mult / total varians data train terskala; linear dengan C kecil. class_weight="balanced".
    svm=dict(C_rbf=[1, 10, 100], gamma_mult=[0.25, 1, 4], C_linear=[0.01, 0.1, 1]),
    block_weighting_for_all=["none", "equal"],   # dipilih di validation; hanya berlaku untuk fitur gabungan
    seed=SEED,
)
FEATURES, CLASSIFIERS, TASKS = {"color", "hog", "glcm", "all"}, {"knn", "svm"}, {"fruit", "condition", "joint"}


@dataclass(frozen=True)
class Spec:
    task: str
    feature: str
    classifier: str
    seg: str

    @property
    def id(self):
        return f"{self.task}-{self.feature}-{self.classifier}-{self.seg}"


def load_config(path=None):
    cfg = copy.deepcopy(DEFAULTS)
    if path:
        over = json.loads(Path(path).read_text(encoding="utf-8-sig"))
        for k, v in over.items():
            if k not in cfg:
                raise ValueError(f"Kunci konfigurasi tidak dikenal: {k}")
            cfg[k] = {**cfg[k], **v} if isinstance(cfg[k], dict) else v
    bad = (set(cfg["tasks"]) - TASKS) | (set(cfg["features"]) - FEATURES) | (set(cfg["classifiers"]) - CLASSIFIERS)
    if bad:
        raise ValueError(f"Nilai konfigurasi tidak valid: {sorted(bad)}")
    return cfg


def config_hash(cfg):
    return hashlib.sha1(json.dumps(cfg, sort_keys=True).encode()).hexdigest()[:12]


def build_specs(cfg, seg_modes):
    return [Spec(t, f, c, s) for s in seg_modes for t in cfg["tasks"] for f in cfg["features"] for c in cfg["classifiers"]]


def candidates(cfg, spec):
    """Daftar kandidat (params, weighting) untuk satu eksperimen; urutan deterministik (seri -> kandidat pertama)."""
    weights = cfg["block_weighting_for_all"] if spec.feature == "all" else ["none"]
    out = []
    for w in weights:
        if spec.classifier == "knn":
            out += [dict(weighting=w, k=k, knn_weights=kw) for k in cfg["knn"]["k"] for kw in cfg["knn"]["weights"]]
        else:
            out += [dict(weighting=w, kernel="rbf", C=C, gamma_mult=g) for C in cfg["svm"]["C_rbf"] for g in cfg["svm"]["gamma_mult"]]
            out += [dict(weighting=w, kernel="linear", C=C) for C in cfg["svm"]["C_linear"]]
    return out
