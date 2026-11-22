"""Pemindaian READ-ONLY folder dataset yang sudah diekstrak. Menyimpan path-nya dan mengusulkan pemetaan folder -> label.
  python -m app.data.inspect_folder --root "D:/FruitVision/dataset"     (tidak ada file yang dipindah/disalin/diubah)

Struktur folder dataset TIDAK diasumsikan: setiap folder yang berisi gambar dilaporkan apa adanya, dan usulan label
(termasuk usulan IGNORE untuk folder yang tampak berisi gambar augmentasi) harus ditinjau pengguna."""
import argparse, json, sys
from collections import Counter, defaultdict
from pathlib import Path
from .dataset_config import IMG_EXT, META
from .labels import propose_label


def scan(root: Path):
    dirs, other = defaultdict(Counter), Counter()
    for f in root.rglob("*"):
        if not f.is_file():
            continue
        rel = f.relative_to(root).as_posix(); parent = rel.rsplit("/", 1)[0] if "/" in rel else ""
        if f.suffix.lower() in IMG_EXT:
            dirs[parent][f.suffix.lower()] += 1
        else:
            other[f.suffix.lower() or "(none)"] += 1
    return dirs, other


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--root", required=True); a = ap.parse_args()
    root = Path(a.root)
    if not root.is_dir():
        sys.exit(f"Folder tidak ditemukan: {root}")
    dirs, other = scan(root)
    if not dirs:
        sys.exit("Tidak ada gambar (jpg/jpeg/png/bmp/webp) ditemukan.")
    prop = {}
    print(f"{'FOLDER (relatif)':58} {'IMG':>5}  {'USULAN':22} STATUS")
    for d, c in sorted(dirs.items()):
        parts = [p for p in d.split("/") if p] or [root.name]
        label, st = propose_label(parts); prop[d] = label
        print(f"{(d or '<root>')[:58]:58} {sum(c.values()):>5}  {str(label):22} {st}")
    META.mkdir(parents=True, exist_ok=True)
    (META / "dataset_path.txt").write_text(str(root.resolve()), encoding="utf-8")
    (META / "folder_mapping.proposed.json").write_text(json.dumps(prop, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nTotal gambar: {sum(sum(c.values()) for c in dirs.values())}. File non-gambar: {dict(other)}")
    print("Path dataset disimpan. Tinjau data/meta/folder_mapping.proposed.json: isi nilai null (kelas manual) dan periksa SUGGESTED-REVIEW.")
    print("Nilai yang sah: salah satu dari 16 label (mis. apple_fresh) atau IGNORE. Simpan sebagai data/meta/folder_mapping.json.")
    print("Dataset utama = gambar ASLI. Folder augmentasi harus dipetakan ke IGNORE.")


if __name__ == "__main__":
    main()
