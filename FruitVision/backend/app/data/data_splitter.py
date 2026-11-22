"""Split 70/15/15 berstrata (per label gabungan 16 kelas) yang sadar-duplikat: klaster duplikat persis/near-duplicate tidak pernah terpecah antar split.
  Stratifikasi per label gabungan menjaga jenis buah DAN kondisi tetap seimbang di tiap split.
  Hanya gambar yang lolos validasi (gambar asli) yang masuk manifest; gambar augmentasi tidak pernah ada di split mana pun.
python -m app.data.data_splitter [--force] | --verify"""
import argparse, hashlib, json, random, sys, time
from collections import defaultdict, Counter
import numpy as np, pandas as pd
from .dataset_config import *
POP = np.array([bin(i).count("1") for i in range(256)], dtype=np.uint8)
NAMES = ("train", "val", "test")

def _report():
    p = META / "validation_report.json"
    if not p.exists(): sys.exit("Jalankan dataset_validator dulu.")
    r = json.loads(p.read_text(encoding="utf-8"))
    if not r["passed"]: sys.exit("Validasi dataset GAGAL; split/training diblokir.")
    return r

def build(force):
    rep = _report(); out = SPLITS / "manifest.csv"
    if out.exists() and not force: sys.exit("manifest.csv sudah ada (tidak dibuat ulang). Gunakan --force hanya jika sadar akan konsekuensinya.")
    df = pd.read_csv(META / "hashes.csv"); n = len(df); par = list(range(n))
    def find(x):
        while par[x] != x: par[x] = par[par[x]]; x = par[x]
        return x
    for _, g in df.groupby("sha256"):
        ix = list(g.index); [par.__setitem__(find(i), find(ix[0])) for i in ix[1:]]
    H = np.stack([np.frombuffer(bytes.fromhex(h), np.uint8) for h in df.dhash])
    for i in range(n - 1):
        for j in np.where(POP[H[i] ^ H[i + 1:]].sum(axis=1) <= rep["near_threshold"])[0]: par[find(i)] = find(i + 1 + j)
    df["cluster"] = [find(i) for i in range(n)]; csz = df.groupby("cluster").size().sort_values(ascending=False); df["split"] = ""; rng = random.Random(SEED)
    for lab, g in df.groupby("label"):
        cl = sorted(g.groupby("cluster").groups.items()); rng.shuffle(cl); cl.sort(key=lambda kv: -len(kv[1]))
        tgt = [len(g) * r for r in RATIOS]; cur = [0, 0, 0]
        for _, idx in cl:
            s = max(range(3), key=lambda k: tgt[k] - cur[k]); cur[s] += len(idx); df.loc[idx, "split"] = NAMES[s]
        if min(cur) == 0: sys.exit(f"Kelas {lab} kosong pada salah satu split.")
    SPLITS.mkdir(parents=True, exist_ok=True)
    df[["path", "label", "split", "sha256", "cluster"]].to_csv(out, index=False, lineterminator="\n")
    meta = dict(seed=SEED, ratios=RATIOS, created=time.strftime("%Y-%m-%dT%H:%M:%S"), validation_fingerprint=rep["fingerprint"],
                manifest_sha256=hashlib.sha256(out.read_bytes()).hexdigest(), total=n, cluster_stats=dict(n_clusters=int(len(csz)), n_multi_image_clusters=int((csz > 1).sum()), largest=[int(x) for x in csz.head(5)]), split_counts=dict(Counter(df.split)),
                split_pct={k: round(100 * v / n, 2) for k, v in Counter(df.split).items()},
                per_class={l: dict(Counter(g.split)) for l, g in df.groupby("label")}, near_threshold=rep["near_threshold"])
    (SPLITS / "split_meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8"); print(json.dumps({k: meta[k] for k in ("split_counts", "split_pct", "cluster_stats")}))

def load_verified_manifest():
    """Used by training: fails unless validation passed and manifest matches the validated data."""
    rep = _report(); mf, mm = SPLITS / "manifest.csv", SPLITS / "split_meta.json"
    if not mf.exists() or not mm.exists(): sys.exit("Manifest split belum dibuat (python -m app.data.data_splitter).")
    meta = json.loads(mm.read_text(encoding="utf-8"))
    if hashlib.sha256(mf.read_bytes()).hexdigest() != meta["manifest_sha256"]: sys.exit("manifest.csv berubah dari saat dibuat.")
    if meta["validation_fingerprint"] != rep["fingerprint"]: sys.exit("Dataset berubah sejak manifest dibuat; validasi ulang dan buat manifest baru.")
    df = pd.read_csv(mf)
    if (df.groupby("cluster").split.nunique() > 1).any() or (df.groupby("sha256").split.nunique() > 1).any(): sys.exit("Kebocoran data terdeteksi.")
    df["rel"] = df.path; df["path"] = [str(RAW / p) for p in df.path]; return df

if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--force", action="store_true"); ap.add_argument("--verify", action="store_true"); a = ap.parse_args()
    if a.verify: d = load_verified_manifest(); print("Manifest valid:", dict(Counter(d.split)))
    else: build(a.force)
