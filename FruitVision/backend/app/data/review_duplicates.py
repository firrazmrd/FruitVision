"""Local HTML contact sheet to review duplicate candidates. Read-only: images are referenced in place (file://), never copied.
python -m app.data.review_duplicates [--per-bucket 8]   -> data/meta/duplicate_review.html"""
import argparse, csv, html
from .dataset_config import *

def fig(rel, note=""):
    return f'<figure><img loading="lazy" src="{(RAW / rel).as_uri()}" width="260"><figcaption>{html.escape(rel)}<br>{html.escape(note)}</figcaption></figure>'

def sample(rows, k):
    if len(rows) <= k: return rows
    return [rows[int(i * (len(rows) - 1) / (k - 1))] for i in range(k)]

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--per-bucket", type=int, default=8); a = ap.parse_args()
    rd = lambda n: list(csv.DictReader(open(META / n, encoding="utf-8-sig")))
    dup, cross = rd("duplicates.csv"), rd("cross_class_conflicts.csv")
    out = ['<meta charset="utf-8"><style>body{font:14px sans-serif;margin:20px}figure{display:inline-block;margin:6px;vertical-align:top;max-width:260px}'
           '.pair{border:1px solid #999;margin:8px 0;padding:6px}</style><h1>Review duplikat FruitVision</h1>']
    out.append(f"<h2>1. Konflik lintas kelas ({len(cross)}) - WAJIB diputuskan</h2><p>Gambar yang sama berlabel dua kelas. Tentukan kelas yang benar.</p>")
    for r in cross: out.append(f'<div class="pair">{fig(r["a"], r["label_a"])}{fig(r["b"], r["label_b"])}<br>{r["type"]}, jarak {r["hamming"]}</div>')
    near = sorted([r for r in dup if r["type"] == "near"], key=lambda r: int(r["hamming"]))
    out.append("<h2>2. Near-duplicate (sampel merata per rentang jarak)</h2><p>Pertanyaan: apakah pasangan ini spesimen/foto yang sama? Jika rentang 9-12 sebagian besar BUKAN, ambang terlalu longgar.</p>")
    for lo, hi in ((0, 4), (5, 8), (9, 12)):
        b = [r for r in near if lo <= int(r["hamming"]) <= hi]; out.append(f"<h3>Jarak {lo}-{hi}: {len(b)} pasangan (ditampilkan {min(len(b), a.per_bucket)})</h3>")
        for r in sample(b, a.per_bucket): out.append(f'<div class="pair">{fig(r["a"])}{fig(r["b"], "jarak " + r["hamming"])}</div>')
    ex = [r for r in dup if r["type"] == "exact"]; out.append(f"<h2>3. Duplikat persis ({len(ex)} pasangan; sampel)</h2>")
    for r in sample(ex, a.per_bucket): out.append(f'<div class="pair">{fig(r["a"])}{fig(r["b"])}</div>')
    p = META / "duplicate_review.html"; p.write_text("".join(out), encoding="utf-8"); print("Dibuat:", p)

if __name__ == "__main__": main()
