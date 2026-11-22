# Panduan Menggunakan FruitVision

Urutan: **Open Workspace → pilih model → Fruit Scanner → Image Lab**.

## Sebelum mulai (harus sudah beres)

1. Backend dan frontend berjalan (`run-all.ps1`, atau `run-backend.ps1` dan `run-frontend.ps1` di dua jendela).
2. Training sudah dijalankan, yaitu `python -m app.cv.experiments --run ...` (lihat README langkah 5). Tanpa ini, daftar model di Settings kosong dan Scanner menolak menganalisis.

Buka **http://127.0.0.1:5173** (bukan port 8000; itu hanya server API).

---

## 1. Masuk ke workspace

1. Di halaman utama, klik **Open Workspace** (pojok kanan atas).
2. Anda masuk ke **Overview**. Periksa dua hal:
   - Lencana **Backend online** di bar atas. Bila "Backend offline", jalankan backend dulu.
   - Kartu **Kesiapan sistem**. Item "Model terlatih tersedia" harus **Selesai**.

## 2. Pilih dan aktifkan model

Aplikasi memakai **dua model**: satu untuk jenis buah, satu untuk kondisi (Fresh/Rotten). Keduanya harus diaktifkan.

### 2a. Cari model terbaik di Analytics (disarankan)

Daftar di Settings tidak diurutkan menurut skor, jadi lihat dulu ranking-nya.

1. Sidebar → **Analytics**.
2. Di bagian **Eksperimen model**, pilih tab **Jenis buah**. Urutan teratas pada grafik "Macro F1 validation" adalah yang terbaik, dan ditandai lencana **terpilih**. Catat nama eksperimennya (mis. `fruit-all-svm-hsv`).
3. Pindah ke tab **Kondisi** dan catat yang teratas juga.

**Rekomendasi: pilih berdasarkan F1 *validation*, bukan F1 *test*.**
Angka test hanya laporan akhir. Bila Anda memilih model dari angka test, hasil test tidak lagi jujur (model "mengintip" test).
Bila dua model memiliki F1 validation yang sama, pilih yang waktu inferensinya lebih kecil (kolom *Inferensi* di tabel). Ini saran saya, bukan aturan dari sistem.

### 2b. Aktifkan di Settings

1. Sidebar → **Settings** → bagian **Model aktif**.
2. **Model jenis buah**: pilih model yang tadi Anda catat. Setiap pilihan menampilkan `nama (F1 val x.xxx)`; cocokkan nama dan angkanya.
3. **Model kondisi**: lakukan hal yang sama.
4. Klik **Aktifkan pasangan ini**. Muncul pesan **"Model aktif diperbarui."**
5. Pastikan: di bar atas lencana berubah menjadi **Model aktif**, dan di **Overview** kartu "Model aktif" menampilkan dua model tadi.

> Bila Anda juga melatih model 16 kelas (`--tasks joint`), muncul tombol **Pakai model 16 kelas**. Itu pembanding; untuk pemakaian biasa gunakan pasangan dua model.

## 3. Fruit Scanner (analisis satu gambar)

1. Sidebar → **Fruit Scanner**.
2. Seret gambar ke area putus-putus, atau klik untuk memilih file (**JPG/PNG, maksimal 15 MB**).
3. Klik **Analyze**. Panel **Alur pemrosesan** menunjukkan tahapnya.
4. Baca **Hasil prediksi**:
   - **Jenis buah** dan **Kondisi** (Fresh/Rotten), masing-masing dengan *confidence*.
   - "Kemungkinan lain" menampilkan 5 kandidat teratas.
   - Waktu proses dan nama model yang dipakai.
5. Kartu **Perbandingan segmentasi** → tab **HSV vs GrabCut** untuk melihat kedua metode berdampingan pada gambar yang sama.
6. Hasil otomatis tersimpan di **Scan History** (bisa dimatikan di Settings → Riwayat).

Cara membaca hasil:
- Confidence adalah probabilitas model, **bukan jaminan** prediksi benar.
- Model hanya mengenal 8 buah × 2 kondisi. Gambar di luar itu tetap dijawab salah satu kelas.
- "Segmentasi gagal, tidak ada prediksi" berarti buah tidak bisa dipisahkan dari latar. Coba foto dengan latar lebih polos.

## 4. Image Lab (melihat tiap tahap pengolahan citra)

1. Sidebar → **Image Lab**.
2. Klik **Pilih file** (atau buka dari **Fruit Library** → *Lihat contoh dataset* → klik gambar).
3. Pilih **Metode untuk fitur**: GrabCut, HSV-Otsu, atau Tanpa segmentasi. Hasil langsung dihitung ulang.
4. Jelajahi tab:
   - **Segmentasi**: mask mentah, mask setelah morfologi, dan hasil untuk HSV serta GrabCut.
   - **Fitur**: histogram warna (hue), visualisasi HOG, nilai GLCM, dan dimensi fitur (128 + 1296 + 4 = 1428).
   - **Parameter**: parameter HOG dan GLCM yang dipakai.

Fungsi yang dipakai Image Lab sama dengan yang dipakai saat training dan inferensi, jadi yang Anda lihat adalah yang dihitung model.

## 5. Tinjau hasil (opsional)

| Halaman | Fungsi |
|---|---|
| **Scan History** | Daftar analisis, filter buah/kondisi, detail, dan hapus |
| **Analytics** | Perbandingan eksperimen, confusion matrix, dan statistik scan |
| **About Model** | Parameter pipeline dan detail model yang aktif |

---

## Masalah umum

| Gejala | Solusi |
|---|---|
| Settings: "Belum ada model" | Training belum dijalankan. Jalankan `python -m app.cv.experiments --run` lalu muat ulang halaman. |
| Settings: "Dua model terpisah ... belum lengkap" | Hanya satu tugas yang dilatih. Latih ulang dengan tugas `fruit` dan `condition`. |
| Scanner: "Belum ada model aktif" | Lakukan langkah 2b (klik **Aktifkan pasangan ini**). |
| Tombol Analyze nonaktif | Backend offline, belum ada model aktif, atau belum ada gambar valid. |
| "Format tidak didukung" / "melebihi 15 MB" | Gunakan JPG atau PNG di bawah 15 MB. |
| Analytics kosong | Belum ada hasil eksperimen di folder `results`. |
