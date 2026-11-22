"""Validasi dataset hasil ekstraksi (read-only): pemetaan, jumlah per kelas, format, keterbacaan, duplikat persis + near-duplicate.
  python -m app.data.dataset_validator [--near 12]

Jumlah per kelas yang diharapkan TIDAK di-hard-code (tidak diketahui sebelum dataset diperiksa). Opsional: FRUITVISION_EXPECTED.
Tanpa itu, syaratnya: ke-16 kelas ada dan masing-masing >= FRUITVISION_MIN_PER_CLASS gambar. Gambar yang tampak hasil
augmentasi (nama berisi 'augment'/'aug') yang terpetakan ke suatu kelas dianggap MASALAH (dataset utama = gambar asli)."""
import argparse, csv, hashlib, json, os, sys, time, warnings
from collections import Counter, defaultdict
import numpy as np
from PIL import Image
from .dataset_config import *
from .labels import LABELS, looks_augmented

Image.MAX_IMAGE_PIXELS = 200_000_000
warnings.simplefilter("ignore", Image.DecompressionBombWarning)
POP = np.array([bin(i).count("1") for i in range(256)], dtype=np.uint8)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--near", type=int, default=int(os.environ.get("FRUITVISION_NEAR", 12)), help="maks jarak Hamming (dari 256 bit) kandidat near-duplicate"); a = ap.parse_args()
    exp = expected_counts(); probs, warns = [], []
    root = raw_root()
    if not root.exists():
        sys.exit(f"Folder dataset tidak ditemukan: {root}")
    fm, unmapped = load_folder_mapping(), set()
    if fm is None:
        sys.exit("data/meta/folder_mapping.json belum ada. Jalankan inspect_folder, tinjau usulan, lalu simpan sebagai folder_mapping.json.")
    ep = META / "exclusions.csv"   # kolom: path,reason (relatif terhadap akar dataset). File tidak pernah dihapus, hanya dilewati.
    excl = {r["path"]: r.get("reason", "") for r in csv.DictReader(open(ep, encoding="utf-8-sig"))} if ep.exists() else {}
    allow_aug = os.environ.get("FRUITVISION_ALLOW_AUG_NAMES") == "1"
    recs, ext, unsupported, corrupt, mism, big, fmts, excluded, ignored, aug_named = [], Counter(), [], [], [], [], Counter(), Counter(), 0, []
    for f in sorted(root.rglob("*")):
        if not f.is_file():
            continue
        rel = f.relative_to(root).as_posix()
        if f.suffix.lower() == ".part":
            probs.append(f"Ekstraksi tidak lengkap: {rel}"); continue
        if f.suffix.lower() not in IMG_EXT:
            unsupported.append(rel); continue
        parent = rel.rsplit("/", 1)[0] if "/" in rel else ""
        label = fm.get(parent)
        if parent not in fm:
            unmapped.add(parent or "<root>"); continue
        if label is None:
            unmapped.add(parent or "<root>"); continue
        if label == "IGNORE":
            ignored += 1; continue
        if label not in LABELS:
            probs.append(f"Label di luar 16 kelas pada mapping: {label!r} (folder {parent!r})"); continue
        if rel in excl:
            excluded[label] += 1; continue
        if looks_augmented(rel) and not allow_aug:
            aug_named.append(rel); continue
        ext[f.suffix.lower()] += 1
        try:
            with Image.open(f) as im: im.verify()
            with Image.open(f) as im:
                fmt = im.format
                if im.width * im.height > 50_000_000: big.append(f"{rel} ({im.width * im.height / 1e6:.0f} MP)")
                if fmt == "JPEG": im.draft("L", (512, 512))
                im.load(); bits = np.asarray(im.convert("L").resize((17, 16), Image.LANCZOS), dtype=np.int16)
            fmts[fmt] += 1
            if fmt != EXT_FMT[f.suffix.lower()]: mism.append(f"{rel} ({fmt})")
        except Exception as e:
            corrupt.append(f"{rel}: {e}"); continue
        recs.append((rel, label, hashlib.sha256(f.read_bytes()).hexdigest(), np.packbits((bits[:, 1:] > bits[:, :-1]).flatten())))
    counts = Counter(r[1] for r in recs)
    if aug_named: probs.append(f"{len(aug_named)} gambar bernama 'augment/aug' terpetakan ke kelas (contoh: {aug_named[:3]}). Dataset utama harus gambar asli: petakan foldernya ke IGNORE atau masukkan ke exclusions.csv. Jika ini false positive, set FRUITVISION_ALLOW_AUG_NAMES=1.")
    if unmapped: probs.append(f"Folder berisi gambar tapi belum dipetakan: {sorted(unmapped)[:20]}")
    missing = sorted(set(LABELS) - set(counts))
    if missing: probs.append(f"Kelas tidak ditemukan: {missing}")
    if exp:
        diff = {c: {"found": counts.get(c, 0), "excluded": excluded.get(c, 0), "expected": n} for c, n in exp.items() if counts.get(c, 0) + excluded.get(c, 0) != n}
        if diff: probs.append(f"Jumlah per kelas tidak sesuai FRUITVISION_EXPECTED: {diff}")
    else:
        low = {c: n for c, n in counts.items() if n < MIN_PER_CLASS}
        if low: probs.append(f"Kelas dengan gambar < {MIN_PER_CLASS}: {low}")
    if corrupt: probs.append(f"{len(corrupt)} gambar tidak dapat dibaca")
    if ignored: warns.append(f"{ignored} gambar diabaikan (folder dipetakan IGNORE)")
    if unsupported: warns.append(f"{len(unsupported)} file non-gambar/format tidak didukung diabaikan")
    if mism: warns.append(f"{len(mism)} file dengan format isi != ekstensi")
    if counts:
        mx, mn = max(counts.values()), min(counts.values())
        if mx > 2 * mn: warns.append(f"Kelas tidak seimbang (min {mn}, maks {mx}); gunakan Macro F1 dan class_weight pada SVM.")
    byhash = defaultdict(list)
    for r in recs: byhash[r[2]].append(r)
    exact = [[x[0] for x in g] for g in byhash.values() if len(g) > 1]
    H = np.stack([r[3] for r in recs]) if recs else np.zeros((0, 32), np.uint8); near = []
    for i in range(len(recs) - 1):
        d = POP[H[i] ^ H[i + 1:]].sum(axis=1)
        for j in np.where(d <= a.near)[0]:
            r2 = recs[i + 1 + j]
            if r2[2] != recs[i][2]: near.append((recs[i][0], r2[0], int(d[j])))
    lab = {r[0]: r[1] for r in recs}; cross = []
    for g in exact: cross += [("exact", g[0], p, 0, lab[g[0]], lab[p]) for p in g[1:] if lab[p] != lab[g[0]]]
    cross += [("near", p, q, d, lab[p], lab[q]) for p, q, d in near if lab[p] != lab[q]]
    if cross: probs.append(f"{len(cross)} duplikat/near-duplikat LINTAS KELAS (potensi label konflik) - lihat cross_class_conflicts.csv")
    META.mkdir(parents=True, exist_ok=True)
    with open(META / "cross_class_conflicts.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f); w.writerow(["type", "a", "b", "hamming", "label_a", "label_b"]); w.writerows(cross)
    with open(META / "hashes.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f); w.writerow(["path", "label", "sha256", "dhash"]); [w.writerow([r[0], r[1], r[2], r[3].tobytes().hex()]) for r in recs]
    with open(META / "duplicates.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f); w.writerow(["type", "a", "b", "hamming"])
        for g in exact: [w.writerow(["exact", g[0], p, 0]) for p in g[1:]]
        for p, q, d in near: w.writerow(["near", p, q, d])
    fp = hashlib.sha256("\n".join(f"{r[0]}\t{r[2]}" for r in sorted(recs)).encode()).hexdigest()
    rep = dict(passed=not probs, problems=probs, warnings=warns, counts=dict(counts), total=len(recs), expected=exp, min_per_class=MIN_PER_CLASS, extensions=dict(ext),
               unsupported=unsupported[:50], corrupt=corrupt[:50], exact_duplicate_groups=len(exact), near_duplicate_pairs=len(near), cross_class_conflicts=len(cross),
               near_threshold=a.near, fingerprint=fp, formats_actual=dict(fmts), format_mismatch_examples=mism[:10], oversized_over_50MP=big[:20], excluded=dict(excluded), ignored_images=ignored,
               exact_duplicate_extra_images=sum(len(g) - 1 for g in exact), near_distance_histogram=dict(sorted(Counter(d for *_, d in near).items())), checked_at=time.strftime("%Y-%m-%dT%H:%M:%S"))
    (META / "validation_report.json").write_text(json.dumps(rep, indent=2), encoding="utf-8")
    print(json.dumps({k: rep[k] for k in ("passed", "total", "counts", "extensions", "exact_duplicate_groups", "near_duplicate_pairs", "cross_class_conflicts", "formats_actual", "excluded", "ignored_images")}, indent=1))
    [print("MASALAH:", p) for p in probs]; [print("  lintas-kelas:", r) for r in cross[:10]]; [print("peringatan:", w_) for w_ in warns]
    print("LULUS" if not probs else "GAGAL - training diblokir"); sys.exit(0 if not probs else 1)


if __name__ == "__main__":
    main()
