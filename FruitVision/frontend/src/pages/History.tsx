import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../components/icons";
import { Badge, CondBadge, Empty, ErrorState, Modal, PageHeader, Skeleton, useToast } from "../components/ui";
import { useAsync } from "../hooks";
import { FRUITS, bytes, del, errText, fruitName, get, histThumb, ms, pct, when, type HistoryItem } from "../api";

const LIMIT = 12;
export default function History() {
  const toast = useToast(); const [offset, setOffset] = useState(0), [fruit, setFruit] = useState(""), [cond, setCond] = useState(""), [sel, setSel] = useState<HistoryItem | null>(null), [confirm, setConfirm] = useState<"one" | "all" | null>(null);
  const q = new URLSearchParams({ limit: String(LIMIT), offset: String(offset), ...(fruit ? { fruit } : {}), ...(cond ? { condition: cond } : {}) });
  const list = useAsync(() => get<{ total: number; items: HistoryItem[] }>(`/api/history?${q}`), [offset, fruit, cond]);
  const total = list.data?.total ?? 0; const filtered = !!(fruit || cond);
  const remove = async () => { try { if (confirm === "one" && sel) await del(`/api/history/${sel.id}`); else if (confirm === "all") await del("/api/history"); toast(confirm === "all" ? "Seluruh riwayat dihapus." : "Riwayat dihapus."); setConfirm(null); setSel(null); setOffset(0); list.reload(); } catch (e) { toast(errText(e), "err"); setConfirm(null); } };

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <PageHeader eyebrow="Scan history" title="Riwayat analisis">Disimpan lokal di komputer Anda (hasil ringkas dan thumbnail 256 px). Gambar asli tidak disimpan.</PageHeader>
      <div className="card flat flex flex-wrap items-end gap-3">
        <div className="field"><label htmlFor="hf">Jenis buah</label><select id="hf" className="select" value={fruit} onChange={e => { setFruit(e.target.value); setOffset(0); }}><option value="">Semua</option>{FRUITS.map(f => <option key={f.id} value={f.id}>{f.en}</option>)}</select></div>
        <div className="field"><label htmlFor="hc">Kondisi</label><select id="hc" className="select" value={cond} onChange={e => { setCond(e.target.value); setOffset(0); }}><option value="">Semua</option><option value="fresh">Fresh</option><option value="rotten">Rotten</option></select></div>
        <div style={{ flex: 1 }} /><span className="small muted mono">{total} entri</span>
        <button className="btn btn-danger btn-sm" disabled={total === 0 && !filtered} onClick={() => setConfirm("all")}><Icon name="trash" size={15} />Hapus semua</button>
      </div>
      {list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : list.loading ? <Skeleton h={260} /> : !list.data?.items.length ? (
        <div className="card"><Empty icon="clock" title={filtered ? "Tidak ada entri yang cocok" : "Belum ada riwayat"} action={!filtered && <Link to="/app/scanner" className="btn btn-primary btn-sm">Mulai scan</Link>}>{filtered ? "Ubah filter untuk melihat entri lain." : "Hasil analisis dari Fruit Scanner akan tersimpan di sini (bila penyimpanan riwayat aktif di Settings)."}</Empty></div>
      ) : (<>
        <div className="table-wrap"><table className="table"><caption className="sr-only">Riwayat analisis</caption>
          <thead><tr><th scope="col">Gambar</th><th scope="col">Waktu</th><th scope="col">Buah</th><th scope="col">Kondisi</th><th scope="col" className="num">Conf. buah</th><th scope="col" className="num">Conf. kondisi</th><th scope="col" className="num">Waktu</th><th scope="col"><span className="sr-only">Aksi</span></th></tr></thead>
          <tbody>{list.data.items.map(r => (
            <tr key={r.id}><td><img className="thumb" src={histThumb(r.id)} alt={`Thumbnail ${r.filename}`} loading="lazy" /></td><td className="small">{when(r.created_at)}</td>
              <td>{r.accepted ? fruitName(r.fruit?.label) : <Badge tone="warn">Segmentasi gagal</Badge>}</td><td>{r.accepted ? <CondBadge c={r.condition?.label} /> : "-"}</td>
              <td className="num">{pct(r.fruit?.confidence)}</td><td className="num">{pct(r.condition?.confidence)}</td><td className="num">{ms(r.processing_ms)}</td>
              <td><button className="btn btn-secondary btn-sm" onClick={() => setSel(r)}>Detail</button></td></tr>))}</tbody></table></div>
        <div className="flex items-center justify-between"><button className="btn btn-secondary btn-sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - LIMIT))}><Icon name="chevL" size={16} />Sebelumnya</button>
          <span className="small muted mono">{offset + 1}-{Math.min(offset + LIMIT, total)} dari {total}</span>
          <button className="btn btn-secondary btn-sm" disabled={offset + LIMIT >= total} onClick={() => setOffset(offset + LIMIT)}>Berikutnya<Icon name="chevR" size={16} /></button></div>
      </>)}

      {sel && !confirm && <Modal title="Detail analisis" onClose={() => setSel(null)} footer={<><button className="btn btn-danger btn-sm" onClick={() => setConfirm("one")}><Icon name="trash" size={15} />Hapus</button><button className="btn btn-primary btn-sm" onClick={() => setSel(null)}>Tutup</button></>}>
        <div className="even-2" style={{ alignItems: "start" }}><div className="frame"><img src={histThumb(sel.id)} alt={`Thumbnail ${sel.filename}`} /></div>
          <dl className="kv"><dt>File</dt><dd>{sel.filename}</dd><dt>Waktu</dt><dd>{when(sel.created_at)}</dd><dt>Dimensi</dt><dd>{sel.width} × {sel.height}</dd><dt>Ukuran</dt><dd>{bytes(sel.bytes)}</dd><dt>Buah</dt><dd>{sel.accepted ? `${fruitName(sel.fruit?.label)} (${pct(sel.fruit?.confidence)})` : "-"}</dd>
            <dt>Kondisi</dt><dd>{sel.accepted ? `${sel.condition?.label} (${pct(sel.condition?.confidence)})` : "-"}</dd><dt>Waktu proses</dt><dd>{ms(sel.processing_ms)}</dd>{Object.entries(sel.models).map(([k, v]) => [<dt key={k + "t"}>Model {k}</dt>, <dd key={k + "d"}>{v}</dd>])}</dl></div>
        {!sel.accepted && <p className="small soft" style={{ marginBottom: 0 }}>Segmentasi gagal ({sel.reason}); tidak ada prediksi untuk gambar ini.</p>}</Modal>}
      {confirm && <Modal title={confirm === "all" ? "Hapus seluruh riwayat?" : "Hapus entri ini?"} onClose={() => setConfirm(null)} footer={<><button className="btn btn-ghost btn-sm" onClick={() => setConfirm(null)}>Batal</button><button className="btn btn-danger btn-sm" onClick={remove}>Hapus</button></>}>
        <p className="soft" style={{ margin: 0 }}>{confirm === "all" ? "Semua hasil dan thumbnail akan dihapus permanen dari komputer ini." : "Hasil dan thumbnail entri ini akan dihapus permanen."} Tindakan ini tidak dapat dibatalkan.</p></Modal>}
    </div>
  );
}
