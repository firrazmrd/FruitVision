"""Evaluasi VISUAL terstruktur segmentasi (dataset tanpa ground-truth mask -> TIDAK ada IoU/Dice).
  python -m app.cv.seg_eval make [--per-class 8]   -> data/meta/seg_eval/evaluation.html (beri nilai di browser, Export CSV)
  python -m app.cv.seg_eval summarize [--select hsv|grabcut --reason "..."]
Sampel hanya dari split TRAIN (tidak pernah test). Kriteria 'rot_kept' hanya berlaku untuk gambar rotten."""
import argparse, base64, html, json, sys, time
import cv2, numpy as np, pandas as pd
from .pipeline import load_resize, segment
from ..data.data_splitter import load_verified_manifest
from ..data.dataset_config import META, SEED

OUT = META / "seg_eval"; METHODS = ("hsv", "grabcut")
CRIT = [("boundary", "Batas buah"), ("background", "Latar terbuang"), ("stem_leaf", "Tangkai & daun"), ("rot_kept", "Area busuk/bercak tetap terbawa (hanya rotten)"), ("noise", "Noise"), ("holes", "Lubang mask")]
COLS = [c for c, _ in CRIT]
RUBRIC = "Skala 1-5 (1 sangat buruk, 3 cukup, 5 sangat baik). Noise dan Lubang mask: 5 = tidak ada sama sekali. Area busuk: 5 = semua bercak/area busuk masih berada di dalam mask (tidak terpotong)."
JS = """const KEY='fruitvision_seg_scores';function G(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){return {}}}
function S(s){try{localStorage.setItem(KEY,JSON.stringify(s))}catch(e){}}
function upd(){const a=[...document.querySelectorAll('select:not(:disabled)')];document.getElementById('prog').textContent=a.filter(x=>x.value).length+' / '+a.length+' nilai terisi'}
document.querySelectorAll('select').forEach(e=>{const s=G();if(s[e.dataset.k])e.value=s[e.dataset.k]});upd();
document.addEventListener('change',e=>{if(e.target.tagName=='SELECT'){const s=G();s[e.target.dataset.k]=e.target.value;S(s);upd()}});
function exportCsv(){const L=['image_id,path,label,method,failed,boundary,background,stem_leaf,rot_kept,noise,holes'];
document.querySelectorAll('tr[data-method]').forEach(r=>{const d=r.closest('.item').dataset;const v=[...r.querySelectorAll('select')].map(x=>x.value);
L.push([d.id,'"'+d.path+'"','"'+d.label+'"',r.dataset.method,r.dataset.failed,...v].join(','))});
const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([L.join('\\n')],{type:'text/csv'}));a.download='seg_scores.csv';a.click()}"""


def panel(img, mask):
    if mask is None:
        p = np.full_like(img, 40); cv2.putText(p, "GAGAL", (60, 118), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2); return p
    o = np.where(mask[..., None] > 0, img, 235).astype(np.uint8)
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE); cv2.drawContours(o, cnts, -1, (0, 200, 0), 1); return o


def make(a):
    df = load_verified_manifest(); df = df[df.split == "train"]
    s = pd.concat([g.sample(n=min(a.per_class, len(g)), random_state=SEED) for _, g in df.groupby("label")]).reset_index(drop=True)
    s["image_id"] = range(len(s)); OUT.mkdir(parents=True, exist_ok=True); blocks, info = [], []
    for _, r in s.iterrows():
        img = load_resize(r.path); ps, fl, fg = [img], {}, {}
        for m in METHODS:
            try: mk = segment(img, m); fl[m] = 0; fg[m] = round(float((mk > 0).mean()), 4)
            except Exception: mk = None; fl[m] = 1; fg[m] = None
            ps.append(panel(img, mk))
        b64 = base64.b64encode(cv2.imencode(".jpg", cv2.hconcat(ps), [cv2.IMWRITE_JPEG_QUALITY, 85])[1]).decode()
        rows = ""
        for m in METHODS:
            cells = ""
            for c, n in CRIT:
                dis = fl[m] or (c == "rot_kept" and r.label.endswith("_fresh"))
                cells += f'<td>{n}<br><select data-k="{r.image_id}|{m}|{c}"{" disabled" if dis else ""}><option value="">-</option>' + "".join(f"<option>{i}</option>" for i in range(1, 6)) + "</select></td>"
            rows += f'<tr data-method="{m}" data-failed="{fl[m]}"><td><b>{m.upper()}</b>{" (GAGAL)" if fl[m] else ""}</td>{cells}</tr>'
        blocks.append(f'<div class="item" data-id="{r.image_id}" data-path="{html.escape(r.rel)}" data-label="{html.escape(r.label)}"><p>#{r.image_id} {html.escape(r.label)} - {html.escape(r.rel)}<br>Kiri: asli | tengah: HSV | kanan: GrabCut</p><img src="data:image/jpeg;base64,{b64}"><table>{rows}</table></div>')
        info.append(dict(image_id=int(r.image_id), path=r.rel, label=r.label, hsv_failed=fl["hsv"], grabcut_failed=fl["grabcut"], hsv_fg=fg["hsv"], grabcut_fg=fg["grabcut"]))
    pd.DataFrame(info).to_csv(OUT / "sample.csv", index=False)
    css = "body{font:14px sans-serif;margin:16px}.item{border:1px solid #888;margin:10px 0;padding:8px}img{max-width:100%}td{padding:2px 8px}"
    (OUT / "evaluation.html").write_text(f'<meta charset=utf-8><title>Evaluasi segmentasi</title><style>{css}</style><h1>Evaluasi visual segmentasi ({len(s)} gambar, split train)</h1><p>{RUBRIC}</p>'
        f'<button onclick="exportCsv()">Export CSV</button> <span id=prog></span>{"".join(blocks)}<script>{JS}</script>', encoding="utf-8")
    print(f"Sampel: {len(s)} gambar ({s.label.value_counts().min()}-{s.label.value_counts().max()} per kelas). Gagal: HSV {sum(i['hsv_failed'] for i in info)}, GrabCut {sum(i['grabcut_failed'] for i in info)}")
    print("Buka", OUT / "evaluation.html", "-> nilai -> Export CSV -> pindahkan seg_scores.csv ke folder yang sama dengan evaluation.html")


def _needed(row):
    return [c for c in COLS if not (c == "rot_kept" and str(row["label"]).endswith("_fresh"))]


def summarize(a):
    p = OUT / "seg_scores.csv"
    if not p.exists(): sys.exit(f"{p} belum ada.")
    d = pd.read_csv(p, encoding="utf-8-sig"); res = {}
    d["_missing"] = d.apply(lambda r: sum(pd.isna(r[c]) for c in _needed(r)), axis=1)
    for m in METHODS:
        x = d[d.method == m]; sc = x[x.failed == 0]; done = sc[sc._missing == 0]
        res[m] = dict(images=len(x), failed_segmentation=int((x.failed == 1).sum()), scored_complete=len(done), scored_incomplete=len(sc) - len(done),
                      mean_per_criterion={c: round(float(done[c].mean()), 3) for c in COLS if done[c].notna().any()} if len(done) else {}, overall_mean=round(float(done[COLS].mean(axis=1).mean()), 3) if len(done) else None)
        if len(done):
            done = done.assign(avg=done[COLS].mean(axis=1)).sort_values("avg"); res[m]["worst_examples"] = done.head(5)[["path", "avg"]].values.tolist(); res[m]["best_examples"] = done.tail(5)[["path", "avg"]].values.tolist()
    res["rubric"] = RUBRIC; res["n_images"] = int(d.image_id.nunique()); res["note"] = "Penilaian visual subjektif; bukan evaluasi kuantitatif berbasis ground-truth mask."
    (OUT / "seg_eval_summary.json").write_text(json.dumps(res, indent=2, ensure_ascii=False), encoding="utf-8"); print(json.dumps(res, indent=1, ensure_ascii=False))
    if a.select:
        if not a.reason: sys.exit("--reason wajib (alasan pemilihan).")
        if any(res[m]["scored_incomplete"] or res[m]["scored_complete"] < 0.9 * res[m]["images"] - res[m]["failed_segmentation"] for m in METHODS): sys.exit("Penilaian belum lengkap (<90%); lengkapi dulu.")
        (OUT / "selection.json").write_text(json.dumps(dict(method=a.select, reason=a.reason, summary="seg_eval_summary.json", created=time.strftime("%Y-%m-%dT%H:%M:%S")), indent=2, ensure_ascii=False), encoding="utf-8")
        print("Metode terpilih:", a.select)


def main():
    ap = argparse.ArgumentParser(); sp = ap.add_subparsers(dest="cmd", required=True)
    m = sp.add_parser("make"); m.add_argument("--per-class", type=int, default=8)
    s = sp.add_parser("summarize"); s.add_argument("--select", choices=METHODS); s.add_argument("--reason")
    a = ap.parse_args(); make(a) if a.cmd == "make" else summarize(a)


if __name__ == "__main__":
    main()
