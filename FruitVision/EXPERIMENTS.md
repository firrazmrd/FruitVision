# Eksperimen FruitVision

## Hasil
**Belum ada hasil eksperimen nyata.** Dataset belum tersedia dan training belum dijalankan. Tabel hasil sengaja dikosongkan; `summary.csv` dan `<id>.json` di folder results dibuat oleh runner dan menjadi satu-satunya sumber angka.
(Data sintetis pada tes tidak boleh dikutip sebagai hasil.)

## Grid (konfigurasi default di `app/cv/experiment_config.py`; override: `--config file.json`)
ID eksperimen: `<tugas>-<fitur>-<klasifikator>-<segmentasi>`, mis. `condition-hog-svm-grabcut`.

| Dimensi | Nilai |
|---|---|
| Tugas | `fruit` (8 kelas), `condition` (2 kelas); opsional `joint` (16 kelas, `--tasks joint`) |
| Fitur | `color`, `hog`, `glcm`, `all` |
| Klasifikator | `knn`, `svm` |
| Segmentasi | metode terpilih (`hsv`/`grabcut`); `--ablation` menambah `none` |

Per tugas ini mencakup kedelapan konfigurasi: Color/HOG/GLCM/Gabungan × KNN/SVM. Default = 16 eksperimen (1 mode segmentasi); dengan `--ablation` 32.

## Hyperparameter (dipilih di validation, Macro F1)
- KNN: k ∈ {3,5,7,9} × bobot ∈ {uniform, distance}
- SVM: rbf C ∈ {1,10,100} × γ-mult ∈ {0.25,1,4}; linear C ∈ {0.01,0.1,1}; `class_weight=balanced`
- Fitur gabungan: pembobotan blok ∈ {none, equal}
Banyaknya kandidat per eksperimen dilaporkan saat DRY-RUN. **Lama training pada dataset asli belum diukur.**

## Reprodusibilitas
Seed 42; split via manifest ber-hash; scaler/bobot blok hanya dari train; tiap hasil JSON memuat `manifest_sha256`, `pipeline_hash`, `config_hash`, konfigurasi lengkap, seluruh grid validation, versi scikit-learn, dan metode segmentasi terpilih. Cache fitur dikunci oleh parameter pipeline + manifest.

Semua keluaran (cache, model, hasil) berada di `FRUITVISION_HOME` (lihat README; diatur lewat `set-env.ps1`).

## Menjalankan (setelah dataset siap dan konfigurasi disetujui)
```powershell
python -m app.cv.experiments                                 # dry-run: periksa rencana
python -m app.cv.experiments --run --n-jobs 4                # training; default n_jobs 4 untuk RAM 16 GB
python -m app.cv.experiments --run --ablation --overwrite    # dengan pembanding tanpa segmentasi
python -m app.cv.experiments --run --tasks joint --overwrite
python -m app.cv.experiments --clear-cache                   # hapus cache fitur
```
