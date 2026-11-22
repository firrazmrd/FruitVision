# 🍎 FruitVision

**FruitVision** adalah aplikasi berbasis web untuk melakukan klasifikasi jenis buah dan mendeteksi kondisi kesegarannya menggunakan teknologi *Digital Image Processing* dan *Machine Learning*.

Proyek ini dikembangkan sebagai bagian dari tugas mata kuliah **Pengolahan Citra Digital**. FruitVision dirancang untuk mengidentifikasi jenis buah serta mengklasifikasikan kondisinya ke dalam dua kategori, yaitu **Fresh (Segar)** dan **Rotten (Busuk)** berdasarkan karakteristik visual pada gambar.

## 🎯 Tujuan Proyek

FruitVision bertujuan untuk menerapkan teknik pengolahan citra digital dan machine learning dalam proses identifikasi buah secara otomatis. Melalui proyek ini, pengguna dapat memahami bagaimana citra digital diproses, diekstraksi fiturnya, dan digunakan sebagai data untuk proses klasifikasi.

## ✨ Fitur Utama

- **Fruit Classification** — Mengidentifikasi jenis buah berdasarkan gambar.
- **Freshness Detection** — Mengklasifikasikan kondisi buah menjadi Fresh atau Rotten.
- **Image Processing** — Melakukan preprocessing dan segmentasi citra.
- **Feature Extraction** — Mengekstraksi karakteristik citra menggunakan metode pengolahan citra digital.
- **Machine Learning** — Menerapkan algoritma klasifikasi untuk proses prediksi.
- **Web Interface** — Menyediakan antarmuka berbasis web untuk berinteraksi dengan sistem.

## 🧪 Metode yang Digunakan

Tahapan pengembangan sistem meliputi:

1. **Dataset Preparation** — Menyiapkan dan mengorganisasi dataset citra buah.
2. **Preprocessing** — Menyesuaikan citra sebelum diproses lebih lanjut.
3. **Image Segmentation** — Memisahkan objek buah dari latar belakang.
4. **Feature Extraction** — Mengambil informasi visual dari citra, seperti warna, tekstur, dan bentuk.
5. **Classification** — Melakukan klasifikasi menggunakan algoritma Machine Learning.
6. **Evaluation** — Mengukur performa model menggunakan metrik evaluasi yang sesuai.

## 🗂️ Struktur Repository

```text
FruitVision/
├── backend/       # Backend dan pemrosesan citra
├── frontend/      # Antarmuka aplikasi web
├── data/          # Metadata dan kebutuhan data proyek
├── docs/          # Dokumentasi proyek
├── experiments/  # Eksperimen pengolahan citra dan model
├── models/        # Model hasil pelatihan
├── scripts/       # Script pendukung
├── tests/         # Pengujian aplikasi
├── README.md
└── .gitignore
```

## 🛠️ Teknologi

Teknologi yang digunakan dalam proyek ini mencakup:

- **Python** — Pemrosesan citra dan pengembangan backend.
- **Computer Vision** — Pengolahan dan analisis citra digital.
- **Machine Learning** — Klasifikasi jenis dan kondisi buah.
- **HTML, CSS, JavaScript** — Pengembangan antarmuka web.

*Catatan: Daftar teknologi dapat disesuaikan dengan library dan framework yang benar-benar digunakan dalam implementasi.*

## 📊 Dataset

Dataset yang digunakan dalam proyek ini adalah **Fresh and Rotten Fruits**, yang diperoleh dari Mendeley Data.

Dataset tersebut digunakan sebagai sumber citra untuk proses pelatihan, pengujian, dan evaluasi sistem.

## 🚀 Menjalankan Proyek

Pastikan Python dan kebutuhan dependensi proyek telah terpasang.

Jalankan backend dan frontend melalui dua terminal terpisah dari direktori `FruitVision`:

**Terminal 1 — Backend**
```powershell
.\run-backend.ps1
```

**Terminal 2 — Frontend**
```powershell
