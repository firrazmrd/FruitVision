"""Riwayat analisis (lokal, satu pengguna). Tiap analisis = <id>.json (hasil ringkas) + <id>.jpg (thumbnail 256 px).
Disimpan di ARTIFACTS/history. Hanya hasil ringkas yang disimpan (bukan gambar asli penuh, bukan pratinjau segmentasi)."""
import io, json, re, time, uuid
from collections import Counter
from PIL import Image, ImageOps
from ..data.dataset_config import HISTORY

ID_RE = re.compile(r"^\d{8}-\d{6}-[0-9a-f]{6}$")


def _thumb(data: bytes, size=256) -> bytes:
    with Image.open(io.BytesIO(data)) as im:
        if im.format == "JPEG":
            im.draft("RGB", (size * 2, size * 2))
        w, h = im.size
        im = ImageOps.exif_transpose(im).convert("RGB"); im.thumbnail((size, size)); buf = io.BytesIO(); im.save(buf, "JPEG", quality=80)
    return buf.getvalue(), w, h


def add(filename: str, data: bytes, result: dict) -> dict:
    HISTORY.mkdir(parents=True, exist_ok=True)
    tb, w, h = _thumb(data); rid = time.strftime("%Y%m%d-%H%M%S-") + f"{int((time.time() % 1) * 1000):03x}" + uuid.uuid4().hex[:3]   # milidetik dulu: urutan terbaru-ke-lama selalu benar
    pick = lambda t: None if not result.get(t) else dict(label=result[t]["label"], confidence=result[t]["confidence"])
    rec = dict(id=rid, created_at=time.strftime("%Y-%m-%dT%H:%M:%S"), filename=(filename or "upload")[-120:], bytes=len(data), width=w, height=h, accepted=bool(result.get("accepted")),
               reason=result.get("reason"), fruit=pick("fruit"), condition=pick("condition"), models=result.get("models", {}), processing_ms=result.get("processing_ms"))
    (HISTORY / f"{rid}.jpg").write_bytes(tb); (HISTORY / f"{rid}.json").write_text(json.dumps(rec, ensure_ascii=False), encoding="utf-8")
    return rec


def _all():
    if not HISTORY.exists():
        return []
    out = []
    for p in sorted(HISTORY.glob("*.json"), reverse=True):
        try:
            out.append(json.loads(p.read_text(encoding="utf-8")))
        except Exception:
            continue          # berkas rusak dilewati, tidak menjatuhkan daftar
    return out


def list_items(limit=20, offset=0, fruit=None, condition=None):
    items = _all()
    if fruit: items = [r for r in items if r["fruit"] and r["fruit"]["label"] == fruit]
    if condition: items = [r for r in items if r["condition"] and r["condition"]["label"] == condition]
    return dict(total=len(items), items=items[offset:offset + limit])


def thumb_path(rid):
    if not ID_RE.match(rid): return None
    p = HISTORY / f"{rid}.jpg"; return p if p.is_file() else None


def delete(rid) -> bool:
    if not ID_RE.match(rid): return False
    ok = False
    for ext in ("json", "jpg"):
        p = HISTORY / f"{rid}.{ext}"
        if p.exists(): p.unlink(); ok = True
    return ok


def clear() -> int:
    n = 0
    for r in _all():
        n += delete(r["id"])
    return n


def summary():
    items = _all(); ok = [r for r in items if r["accepted"] and r["fruit"] and r["condition"]]
    by_cond = Counter(r["condition"]["label"] for r in ok); by_fruit = Counter(r["fruit"]["label"] for r in ok)
    cross = Counter(f'{r["fruit"]["label"]}|{r["condition"]["label"]}' for r in ok); days = Counter(r["created_at"][:10] for r in items)
    mean = lambda k: round(sum(r[k]["confidence"] for r in ok) / len(ok), 4) if ok else None
    return dict(total=len(items), accepted=len(ok), failed=len(items) - len(ok), by_condition=dict(by_cond), by_fruit=dict(by_fruit), by_fruit_condition=dict(cross),
                mean_confidence=dict(fruit=mean("fruit"), condition=mean("condition")), per_day=[dict(date=d, count=c) for d, c in sorted(days.items())][-14:],
                first=items[-1]["created_at"] if items else None, last=items[0]["created_at"] if items else None)
