# Catatan Migrasi FishVision → FruitVision

Sumber: `FishVision_phase9_4.zip` (86 berkas). Tidak diubah; FruitVision dibuat di direktori terpisah. Audit dilakukan dari source code, bukan dari README.

## Arsitektur FishVision (terverifikasi di kode)
Backend FastAPI + subprocess job manager; CV: resize 224 → HSV-Otsu / GrabCut → HSV hist (128) / HOG (1296) / GLCM (4) → KNN / SVM, eksperimen E1–E6; split 70/15/15 berbasis klaster duplikat; frontend React 19 + Vite + Tailwind, 8 halaman, tema laut; tes: 20 backend, 15 frontend (README; tidak dijalankan ulang karena sandbox tanpa internet).

## Dipakai ulang
| Bagian | Catatan |
|---|---|
| Pola split berbasis klaster duplikat + verifikasi manifest (`data_splitter.py`) | kode tetap; docstring diperbarui |
| `review_duplicates.py`, pola job manager, validasi→manifest→training bertahap | kode tetap / disesuaikan |
| Prinsip: scaler di train, tuning di validation, hasil dari berkas nyata, tanpa fallback segmentasi diam-diam | dipertahankan |
| Stack (FastAPI, React/Vite/Tailwind) | dipertahankan untuk Tahap 7 |

## Diubah
| Bagian | Perubahan | Alasan |
|---|---|---|
| Konfigurasi (`dataset_config`) | env `FISHVISION_*`→`FRUITVISION_*`; `CACHE` terpisah; tanpa jumlah per kelas hard-coded | jumlah dataset baru belum diketahui; lokasi dapat dipindah ke drive lain |
| Label | 12 spesies → 16 kelas `<buah>_<kondisi>` + tiga tugas (fruit/condition/joint) | kebutuhan dua keluaran |
| Validator | pemetaan folder→label; syarat min. gambar/kelas; **menolak gambar augmentasi** | data utama = gambar asli |
| `pipeline` | + mode `none`; hash parameter pipeline; loader Pillow (EXIF, decode draft) | ablasi; cache tidak basi; foto DSLR besar hemat RAM |
| `experiments` | grid terkonfigurasi, GLCM-saja, ablasi, tugas ganda, kandidat lebih banyak, bobot blok, metrik presisi/recall, waktu ekstraksi/inferensi, default DRY-RUN, `--clear-cache` | FishVision tidak punya GLCM-saja/ablasi; training harus butuh persetujuan |
| `seg_eval` | kriteria khusus buah (`stem_leaf`, `rot_kept`), `rot_kept` hanya untuk rotten | "sirip & ekor" tidak relevan; bercak busuk adalah sinyal klasifikasi |
| `inference` | dua model (atau joint), keluaran jenis+kondisi | kebutuhan aplikasi |
| `readiness`, `jobs/manager` | model di `artifacts/models`, parser progres baru | ID eksperimen berubah |

## Dihapus
`inspect_archives.py`, `extract_dataset.py` (ekstraksi ZIP): dataset diekstrak manual agar tidak disalin berulang; `ml/rejection.py` (kalibrasi penolakan unknown) belum diadaptasi (rencana Tahap 7, opsional). Tema laut (ikan, kelp, pancing) akan diganti di Tahap 7.

## Bug/masalah FishVision yang diperbaiki
1. Cache fitur tidak memuat parameter pipeline → kini dikunci hash parameter (tes tersedia).
2. Gambar gagal segmentasi dibuang per metode → perbandingan antar metode memakai set uji berbeda; kini himpunan bersama.
3. Fitur gabungan: HOG mendominasi GLCM → pembobotan blok sebagai hyperparameter.
4. Evaluasi memakai `predict` sedangkan aplikasi memakai `argmax predict_proba` → disamakan.
5. Versi tidak konsisten (README 9.4, `main.py`/`package.json` 0.3.0) → FruitVision memakai satu sumber versi saat Tahap 7.
6. Regex progres dan `artifacts_exist` terkunci ke E1–E6 → digeneralisasi.

## Tahap 7 (frontend + API): lihat REDESIGN_NOTES.md
Routes API, handler, riwayat scan, frontend baru, dan skrip PowerShell sudah dibuat (status uji di REDESIGN_NOTES.md). Endpoint penyiapan dataset/training FishVision (configure, mapping, exclusions, seg-eval via API, start training) sengaja **tidak** dipindahkan: CLI adalah alur resmi.

## Masih belum dikerjakan
Adaptasi penolakan "unknown" (rejection), UI penyiapan dataset/training, verifikasi di Windows (termasuk skrip PowerShell, `npm install`, `vite build`), dan pengujian pada dataset asli.
