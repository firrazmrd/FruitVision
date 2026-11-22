# FruitVision: The Living Orchard Lab

Analisis **jenis buah** dan **kondisi (Fresh / Rotten)** dari foto, memakai pengolahan citra klasik (segmentasi HSV / GrabCut, fitur Color Histogram + HOG + GLCM, klasifikasi KNN / SVM).
Dataset: *Fresh and Rotten Fruits* (Mendeley Data, DOI 10.17632/bdd69gyhv8.1, CC BY 4.0), 8 buah × 2 kondisi = 16 kelas.

## Status (jujur)

| Bagian | Status |
|---|---|
| Pipeline citra, eksperimen KNN/SVM, evaluasi (CLI) | Teruji pada **data sintetis** (43 tes backend) |
| API (handler) | Teruji lewat tes langsung; **lapisan FastAPI/HTTP belum dijalankan** di lingkungan pengembangan (tes `HttpLayer` otomatis berjalan di venv Anda) |
| Frontend (React + Vite + Tailwind) | Dibundel dan diuji di Chromium dengan backend nyata (86 pemeriksaan lulus, 0 console error di build produksi dan development) |
| Skrip PowerShell (`set-env`, `run-backend`, `run-frontend`) | **Belum pernah dijalankan** (tidak ada PowerShell di lingkungan pengembangan) |
| `npm install` / `vite build` / `npm run typecheck` | **Belum dijalankan** (tidak ada internet saat pengembangan) |
| Windows | **Belum pernah diuji di Windows** |
| Dataset asli, hasil eksperimen nyata | **Belum ada.** Semua angka di UI berasal dari berkas hasil/riwayat nyata; bila kosong, tampil empty state |

## Dua folder: kode dan workspace

```
...\Projek 2\Web\FruitVision\           <- KODE (folder proyek ini)
...\Projek 2\Dataset\Original Image\    <- DATASET asli (hanya dibaca, tidak pernah diubah)
...\Projek 2\FruitVision_Workspace\     <- WORKSPACE: SATU folder untuk semua yang dihasilkan
      data\      meta (mapping, laporan validasi), splits (manifest)
      cache\     cache fitur (aman dihapus)
      artifacts\ model terlatih, riwayat scan, job
      results\   hasil eksperimen (JSON/CSV)
```
Lokasi workspace dan dataset diatur di **satu berkas**: `set-env.ps1` (dua baris di bagian atas). Di balik layar ini mengisi `FRUITVISION_HOME` dan `FRUITVISION_RAW`.
`FRUITVISION_DATA / CACHE / ARTIFACTS / RESULTS` masih berlaku sebagai penimpa per-folder, tetapi `set-env.ps1` menghapusnya agar tidak ada sisa lokasi lama (mis. `D:\FruitVision\...`) yang menimpa workspace.

## Prasyarat
Python 3.10+ (dikembangkan dengan 3.12) dan Node.js 22 LTS (atau ≥ 20.19). PowerShell.
Bila skrip diblokir: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` (hanya untuk jendela itu).

## 1. Instalasi backend (sekali)
```powershell
cd "D:\Tugas\Semester 5\Pengolahan Citra\Projek 2\Web\FruitVision\backend"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt -r requirements-dev.txt
python -m pip check
```

## 2. Konfigurasi lokasi (setiap membuka jendela PowerShell baru)
```powershell
cd "D:\Tugas\Semester 5\Pengolahan Citra\Projek 2\Web\FruitVision"
. .\set-env.ps1          # titik + spasi di depan wajib
```
Variabel hanya berlaku di jendela itu. Jendela backend dan CLI harus sama-sama menjalankan baris ini (`run-backend.ps1` sudah melakukannya sendiri).

## 3. Persiapan dataset (CLI, dari folder `backend` dengan venv aktif)
```powershell
cd backend
python -m app.data.inspect_folder --root $env:FRUITVISION_RAW
notepad "$env:FRUITVISION_HOME\data\meta\folder_mapping.proposed.json"     # PERIKSA dulu
Copy-Item "$env:FRUITVISION_HOME\data\meta\folder_mapping.proposed.json" "$env:FRUITVISION_HOME\data\meta\folder_mapping.json"
python -m app.data.dataset_validator        # harus LULUS
python -m app.data.data_splitter            # SEKALI saja
```
- Di `folder_mapping.proposed.json`, nilai `null` berarti folder belum dikenali: isi dengan salah satu 16 label (mis. `apple_fresh`) atau `IGNORE`. Folder yang tampak berisi gambar augmentasi diusulkan `IGNORE` (dataset utama = gambar asli).
- Jangan menjalankan `data_splitter` lagi setelah training: hasil eksperimen terikat pada manifest. Membuat ulang butuh `--force` dan membuat hasil lama tidak sebanding.

## 4. Evaluasi segmentasi
```powershell
python -m app.cv.seg_eval make
Start-Process "$env:FRUITVISION_HOME\data\meta\seg_eval\evaluation.html"
```
Beri nilai di browser, tekan **Export CSV**, lalu **pindahkan file unduhan ke folder yang sama** (browser menyimpannya di Downloads; langkah ini mudah terlewat):
```powershell
Move-Item "$env:USERPROFILE\Downloads\seg_scores.csv" "$env:FRUITVISION_HOME\data\meta\seg_eval\seg_scores.csv" -Force
python -m app.cv.seg_eval summarize --select hsv --reason "Alasan berdasarkan hasil evaluasi visual."
```
Ganti `hsv` dengan `grabcut` sesuai hasil penilaian Anda. Kriteria "Area busuk tetap terbawa" hanya berlaku untuk gambar rotten.

## 5. Eksperimen
```powershell
python -m app.cv.experiments                 # DRY-RUN: hanya menampilkan rencana
python -m app.cv.experiments --run --ablation --n-jobs 4      # setelah rencana Anda setujui
```
Lalu aktifkan model di aplikasi (Settings) memakai Macro F1 **validation**. Detail: `EXPERIMENTS.md`.

## 6. Menjalankan aplikasi (dua jendela PowerShell)
```powershell
# Jendela A (dari folder root proyek)
.\run-backend.ps1            # API di http://127.0.0.1:8000
# Jendela B
.\run-frontend.ps1           # antarmuka di http://127.0.0.1:5173  (npm install otomatis pertama kali)
```
Buka **http://127.0.0.1:5173**. (`http://127.0.0.1:8000` hanya server API.) Tanpa model aktif, halaman tetap terbuka dan Scanner menjelaskan bahwa model belum ada.

## 7. Memindahkan data dari lokasi lama (`D:\FruitVision\...`)
Jika langkah 5-8 sudah pernah dijalankan dengan empat folder lama, pindahkan isinya ke workspace baru agar tidak mengulang:
```powershell
. .\set-env.ps1
foreach ($d in "data","cache","artifacts","results") { if (Test-Path "D:\FruitVision\$d") { robocopy "D:\FruitVision\$d" "$env:FRUITVISION_HOME\$d" /E /MOVE | Out-Null } }
```
(`data\meta\dataset_path.txt` berisi path dataset absolut; periksa isinya bila lokasi dataset berubah.)

## 8. Tes
```powershell
python -m pytest -q      # dari folder root proyek, venv aktif. Memakai data sintetis di folder sementara; tidak menyentuh workspace Anda
```

## Pemecahan masalah
| Gejala | Penyebab / solusi |
|---|---|
| `running scripts is disabled` | `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` |
| `uvicorn`/`python` tidak ditemukan | venv belum aktif; jalankan `.\.venv\Scripts\Activate.ps1` atau pakai `run-backend.ps1` |
| UI: "Backend offline" | jendela backend belum jalan, atau port 8000 dipakai aplikasi lain |
| `Port 5173 is already in use` | tutup jendela `run-frontend.ps1` yang lama (port dikunci, tidak berpindah otomatis) |
| Validator: "Folder berisi gambar tapi belum dipetakan" | masih ada `null` di `folder_mapping.json` |
| Validator: "gambar bernama augment/aug" | folder augmentasi belum `IGNORE`; atau set `$env:FRUITVISION_ALLOW_AUG_NAMES=1` bila false positive |
| `seg_eval summarize`: seg_scores.csv belum ada | CSV belum dipindah dari Downloads (langkah 4) |
| Scanner: "Belum ada model aktif" | belum training, atau belum diaktifkan di Settings |
| Font tampak berbeda | font memuat dari Google Fonts; offline memakai Georgia/system-ui/Consolas (tampilan tetap berfungsi) |

## Evaluasi urutan instal Anda (`urutan instal p2 phase 6.txt`)
Urutan Anda sudah benar secara garis besar. Temuan dan perubahan:
1. **Empat variabel lokasi terpisah** di `D:\FruitVision` diganti **satu** `FRUITVISION_HOME` di dalam folder Semester 5 (permintaan Anda). Variabel sesi hilang saat jendela ditutup, jadi dibuat `set-env.ps1`.
2. **Langkah 10 kurang satu langkah:** CSV yang diekspor browser harus dipindah ke folder `seg_eval` (tanpa itu `summarize` gagal). Sudah ditambahkan.
3. **Langkah 6 menyalin proposal apa adanya.** Bila ada `null`, validator akan menolak; periksa dulu (sudah Anda tulis "periksa terlebih dahulu").
4. **Langkah 8 (split) hanya sekali.** Ditegaskan di README.
5. Urutan Anda berhenti di dry-run (langkah 11); langkah menjalankan eksperimen, mengaktifkan model, dan membuka aplikasi ditambahkan (bagian 5-6).
6. Tidak ada yang saya ubah pada langkah 1-3, 5, 7.

## Dokumen lain
`REDESIGN_NOTES.md` (desain, perubahan, dependensi, cakupan uji, keterbatasan) · `METHODOLOGY.md` · `EXPERIMENTS.md` · `MIGRATION_NOTES.md`
