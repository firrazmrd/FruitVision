"""Definisi label FruitVision.

Dataset: Fresh and Rotten Fruits (Sultana et al., Mendeley Data, DOI 10.17632/bdd69gyhv8.1, CC BY 4.0).
8 jenis buah x 2 kondisi = 16 kelas. Istilah kondisi mengikuti dataset: ``fresh`` dan ``rotten``
(BUKAN matang / belum matang; itu konsep yang berbeda).

Label gabungan memakai format ``<fruit>_<condition>``, mis. ``apple_fresh``.
"""
import re

FRUITS = ("apple", "banana", "grape", "guava", "jujube", "orange", "pomegranate", "strawberry")
CONDITIONS = ("fresh", "rotten")
LABELS = tuple(f"{f}_{c}" for f in FRUITS for c in CONDITIONS)
TASKS = ("fruit", "condition", "joint")


def make_label(fruit: str, condition: str) -> str:
    return f"{fruit}_{condition}"


def split_label(label: str):
    fruit, condition = label.split("_", 1)
    return fruit, condition


def task_labels(labels, task: str):
    """Turunkan label tugas (fruit / condition / joint) dari label gabungan."""
    if task == "joint":
        return list(labels)
    i = {"fruit": 0, "condition": 1}[task]
    return [split_label(l)[i] for l in labels]


def task_classes(task: str):
    return {"fruit": FRUITS, "condition": CONDITIONS, "joint": LABELS}[task]


# ---- pengenalan nama folder (dipakai inspect_folder; hasilnya hanya USULAN yang harus ditinjau pengguna) ----
_FRUIT_WORDS = {
    "apple": "apple", "apples": "apple", "banana": "banana", "bananas": "banana", "grape": "grape", "grapes": "grape",
    "guava": "guava", "guavas": "guava", "jujube": "jujube", "jujubes": "jujube", "orange": "orange", "oranges": "orange",
    "pomegranate": "pomegranate", "pomegranates": "pomegranate", "strawberry": "strawberry", "strawberries": "strawberry",
}
AUG_PAT = re.compile(r"augment|(?<![a-z])aug(?![a-z])", re.I)


def looks_augmented(text: str) -> bool:
    return bool(AUG_PAT.search(text))


def parse_component(name: str):
    """(fruit|None, condition|None) dari satu komponen path. Mengenali 'Fresh Apple', 'rotten_apples', 'freshapples'."""
    low = name.lower()
    cond = [c for c in CONDITIONS if c in low]
    cond = cond[0] if len(cond) == 1 else None
    letters = re.sub(r"[^a-z]", "", low.replace("fresh", "").replace("rotten", ""))
    fruit = _FRUIT_WORDS.get(letters)
    if fruit is None:  # nama berisi kata lain, mis. 'Apple_001': cari tepat satu kata buah yang berdiri sendiri
        hits = {v for w, v in _FRUIT_WORDS.items() if re.search(rf"(?<![a-z]){w}(?![a-z])", low.replace("_", " "))}
        fruit = hits.pop() if len(hits) == 1 else None
    return fruit, cond


def propose_label(parts):
    """Usulan label untuk sebuah folder dari komponen path-nya (dari terdalam ke terluar).

    Mengembalikan (label | 'IGNORE' | None, status). Status:
      exact              buah + kondisi ditemukan pada komponen yang sama
      SUGGESTED-REVIEW   buah dan kondisi berasal dari komponen berbeda (mis. Apple/Fresh)
      AUGMENTED-IGNORE   path tampak berisi gambar augmentasi -> diusulkan IGNORE (dataset utama = gambar asli)
      UNMAPPED           tidak dapat ditentukan; pengguna harus memetakan manual
    """
    if any(looks_augmented(p) for p in parts):
        return "IGNORE", "AUGMENTED-IGNORE"
    fruit = cond = None
    same = False
    for p in reversed(parts):
        f, c = parse_component(p)
        if f and c and fruit is None and cond is None:
            same = True
        fruit, cond = fruit or f, cond or c
    if fruit and cond:
        return make_label(fruit, cond), "exact" if same else "SUGGESTED-REVIEW"
    return None, "UNMAPPED"
