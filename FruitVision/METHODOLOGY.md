# Metodologi FruitVision

Semua keputusan di bawah adalah **rancangan yang belum divalidasi pada dataset asli**. Yang membuktikan kesesuaiannya adalah eksperimen (EXPERIMENTS.md), bukan dokumen ini.

## 1. Data
- Dataset utama = **gambar asli** (3.200 gambar menurut publikasi dataset; jumlah per kelas dan struktur folder belum diverifikasi karena dataset belum tersedia). 12.335 gambar augmentasi dari penyedia **tidak dipakai**.
- Validator menolak gambar bernama `augment`/`aug` yang terpetakan ke suatu kelas.
- Label mengikuti dataset: `fresh` / `rotten` (bukan matang/belum matang). Label gabungan `<buah>_<kondisi>`.
- **Split** 70/15/15, seed 42, berstrata per label gabungan. Gambar dengan hash identik atau dHash mirip (Hamming ≤ 12/256) digabung dalam satu klaster dan **tidak pernah terpecah antar split**. Batasan: foto buah/objek yang sama dari sudut berbeda tidak terdeteksi hash perseptual, sehingga kebocoran jenis ini tidak dapat dikesampingkan; sumber objek tidak tercatat di dataset.

## 2. Preprocessing
Muat dengan Pillow (EXIF diterapkan; JPEG besar didekode skala kecil agar hemat RAM) → BGR → resize 224×224 (INTER_AREA, **tanpa menjaga rasio**; konsisten antara training dan inferensi). Gambar rusak ditolak dengan galat eksplisit.

## 3. Segmentasi
| Metode | Cara kerja | Risiko untuk buah |
|---|---|---|
| `none` | mask penuh | latar ikut masuk fitur; berfungsi sebagai pembanding ablasi |
| `hsv` | warna latar dari piksel tepi, ambang Otsu pada jarak HSV | gagal bila latar mirip buah atau tidak seragam (foto toko/lapangan) |
| `grabcut` | inisialisasi persegi margin 5%, 5 iterasi | asumsi buah memenuhi bingkai; bisa memotong bercak gelap |

Pasca-proses: opening/closing, **komponen terbesar saja**, lubang diisi. Untuk gambar dengan beberapa buah (tandan anggur, banyak jujube) hanya satu komponen yang dipertahankan; ini **keterbatasan yang diketahui** dan perlu dinilai pada evaluasi visual. Foreground < 2% = gagal (tidak ada fallback diam-diam).
Pemilihan antara `hsv` dan `grabcut` memakai **evaluasi visual terstruktur** (rubrik 1–5, split train saja; tanpa IoU/Dice karena tidak ada ground-truth mask). Kriteria khusus buah: `rot_kept` (bercak/area busuk tidak boleh terbuang oleh mask; hanya dinilai untuk gambar rotten). Bandingkan juga dengan `none` lewat `--ablation`.

## 4. Fitur
| Fitur | Dimensi | Alasan (hipotesis, diuji lewat eksperimen) |
|---|---|---|
| Color Histogram HSV 8×4×4 | 128 | jenis buah (hue) dan perubahan warna saat membusuk (kecoklatan) |
| HOG (9 orientasi, sel 32×32, blok 2×2) | 1296 | bentuk/siluet (pisang vs apel); pada gambar bermask, tepi mask ikut tertangkap |
| GLCM (jarak 1; 0/45/90/135°; 32 level; rata-rata 4 sudut) | 4 | tekstur bercak/kerut pada buah rotten |
| Gabungan | 1428 | pelengkap |

GLCM 4 dimensi hanya baseline sederhana; **tidak diklaim** mampu membedakan 8 jenis buah. **Fitur tambahan yang direkomendasikan (belum diimplementasikan):** color moments (mean/std/skew per kanal HSV dan Lab), statistik tekstur LBP, rasio area gelap di dalam mask.
Pada fitur gabungan, setelah standardisasi HOG (1296 kolom) mendominasi GLCM (4 kolom). Karena itu **pembobotan blok sama rata** (`equal`: tiap blok dibagi √dimensi) dijadikan hyperparameter yang dipilih di validation, bukan diasumsikan.

## 5. Klasifikasi: satu model 16 kelas atau dua model?
**Pilihan utama: dua model terpisah** (jenis buah 8 kelas; kondisi 2 kelas), dengan satu model 16 kelas sebagai **pembanding** (`--tasks joint`; metrik turunan fruit/condition dihitung dari prediksinya).
Alasan: (1) dua keluaran yang diminta dievaluasi terpisah dan sebanding; (2) fitur yang membedakan jenis (bentuk/hue) berbeda dengan yang membedakan kondisi (warna gelap/tekstur), sehingga tiap tugas dapat memilih fitur terbaiknya; (3) kesalahan jenis dan kondisi tidak bercampur. Konsekuensi: dua model berarti dua kali training dan dua inferensi; model kondisi harus berlaku lintas jenis (penampilan "rotten" berbeda tiap buah), sehingga bisa lebih lemah daripada model per-jenis. Ini bukan klaim: perbandingan empiris dengan model 16 kelas disediakan. Pendekatan hierarkis (model kondisi per jenis) tidak diimplementasikan.

KNN (k, bobot) dan SVM (rbf: C dan γ = m / total varians; linear: C; `class_weight=balanced`) dipilih **hanya di validation set** dengan Macro F1; seri → kandidat pertama pada urutan grid. Model akhir dilatih pada train saja. Prediksi aplikasi = `argmax predict_proba` (aturan yang sama dengan evaluasi). Confidence adalah probabilitas model (SVM: skala Platt), bukan jaminan kebenaran.

## 6. Evaluasi
Accuracy, Macro Precision/Recall/F1 (metrik utama), Weighted F1, classification report per kelas, confusion matrix; waktu ekstraksi fitur (ms/gambar: segmentasi + fitur yang dipakai, diukur saat paralel sehingga indikatif), waktu inferensi (ms/gambar: batch dan sampel tunggal), waktu training. Hanya test split untuk pelaporan. Pada ablasi, semua mode dievaluasi pada **himpunan gambar bersama** (gambar yang berhasil disegmentasi semua metode) agar set uji identik; jumlah gambar gagal dicatat. Evaluasi tunggal pada satu split (belum ada cross-validation atau interval kepercayaan).

## 7. Hal yang tidak dilakukan
Tidak mengenali buah/kondisi di luar 16 kelas; penolakan "unknown" **belum** diadaptasi dari FishVision; tidak ada pengukuran tingkat kematangan.
