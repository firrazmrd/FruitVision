# Catatan Redesain Frontend: Botanical Laboratory

## Yang dikerjakan
- **Audit:** frontend FishVision (React 19, Vite, Tailwind 4, React Router, 8 halaman, tema laut) dan kontrak API (~40 endpoint). Framework dipertahankan. FruitVision belum punya frontend sebelumnya, jadi seluruh UI dibangun di atas kontrak API FishVision yang diadaptasi.
- **Backend (secukupnya untuk frontend):** `api/handlers.py` (logika, teruji), `api/routes.py` (FastAPI tipis), `main.py`, **riwayat scan server-side** (`services/history.py`; FishVision tidak punya), `FRUITVISION_HOME` (satu folder induk), UTF-8 eksplisit untuk Windows, perbaikan urutan ID riwayat.
- **Design system:** token semantik light/dark di `src/index.css` (palet Forest/Leaf/Cream/Harvest/Sage; dark dirancang terpisah). Newsreader (display), Manrope (UI), IBM Plex Mono (angka teknis). Komponen: tombol, input, select, tab (ARIA), modal (focus trap), toast, badge, tooltip (CSS), skeleton, empty/error state, tabel, kartu "plate" (sudut registrasi sebagai identitas laboratorium), grafik SVG sendiri.
- **Halaman:** Landing; Overview; Fruit Scanner; Image Lab (fitur lama yang dipertahankan); Scan History; Analytics; Fruit Library; About Model; Settings.
- **Gerak:** satu hub scroll (rAF, passive) untuk parallax lanskap, apel scrollbar, dan jelly; blur reveal awal (≈0,8 dtk, tanpa loading palsu); fade/slide/blur-in via IntersectionObserver; footer lanskap SVG (bukit berlapis, pohon berbuah, rumput bergoyang per-rumpun, daun melayang; mode gelap = senja dengan bulan, bintang, kunang-kunang; animasi dijeda saat di luar layar). `prefers-reduced-motion` dan pengaturan Animasi dihormati.
- **Apel scrollbar:** hanya indikator visual; scroll native tidak diganti. Pegas teredam (squash-and-stretch saat cepat, elastic settle saat berhenti), klik/drag pada track memanggil `scrollTo`, disembunyikan di layar sentuh (<640 px), dapat dimatikan di Settings.

## Dependensi
Dipertahankan: react, react-dom, react-router-dom, vite, @vitejs/plugin-react, tailwindcss, @tailwindcss/vite, typescript, @types/react(-dom).
**Dihapus** dari FishVision: recharts, lucide-react, motion, vitest, jsdom, @testing-library/*. Alasan: aturan "jangan menumpuk library animasi", bundle lebih kecil, dan grafik/ikon sederhana cukup dengan SVG sendiri. **Tidak ada dependensi baru.** `package-lock.json` tidak disertakan (akan dibuat `npm install`).
Versi di `package.json` mengikuti FishVision dan **belum diverifikasi lewat `npm install`**.

## Cakupan uji (yang benar-benar dijalankan)
- Backend: 43 tes `unittest` (42 berjalan, 1 dilewati: lapisan HTTP FastAPI), stabil 3× berturut-turut.
- Frontend: bundel esbuild + CSS Tailwind (`compile`) disajikan oleh server uji yang memanggil handler backend asli dengan model hasil pipeline nyata (data sintetis); 86 pemeriksaan Chromium lulus: boot reveal, scroll native, apel (posisi, squash, settle, ujung track, klik track), tema + persistensi tanpa flash, reduced-motion, sidebar (collapse, tooltip, persist), scanner (initial, file tidak valid/besar/rusak, terpilih, memproses, sukses, segmentasi gagal, backend mati, tanpa model), perbandingan HSV vs GrabCut, riwayat (filter, detail, hapus, focus trap, Esc), analytics (tabel, ablasi, confusion matrix, report), library (thumbnail dataset), Image Lab (`method=none`), settings (tema, animasi, apel, aktivasi model), mobile 390 px (tanpa overflow, drawer), keyboard (skip link, focus ring). 0 console error/warning di build produksi dan development (kecuali error yang sengaja dibuat saat mensimulasikan backend mati).
- Kontras: 34 pasangan warna teks dihitung (light + dark), semua ≥ 4,5:1.
- Dua bug nyata ditemukan dan diperbaiki oleh uji: elemen `.sr-only` di tabel melebarkan halaman di mobile; urutan ID riwayat dalam detik yang sama.

## Keterbatasan
- `npm install`, `vite build`, `tsc`/`npm run typecheck`, skrip PowerShell, lapisan FastAPI, dan Windows **belum dijalankan**. Pengujian browser memakai shim `react-router-dom` (hanya di harness uji; paket asli tidak tersedia offline), jadi perilaku router asli belum teruji.
- Data uji sintetis; belum ada dataset/hasil nyata. Tampilan dengan data nyata (mis. nama file panjang, banyak riwayat) belum dilihat.
- **Foto asli tidak disertakan** (tidak ada akses internet untuk mengunduh, dan lisensi perlu Anda pilih). Hero memakai ilustrasi vektor; slot foto disiapkan (`public/photos/README.txt`).
- Font dimuat dari Google Fonts (tanpa salinan lokal); offline memakai font cadangan.
- Tidak ada status "low confidence": definisi/ambang belum ada di backend, dan tidak dikarang. Penolakan "unknown" belum diadaptasi.
- UI untuk penyiapan dataset dan memulai training **tidak** dibuat (CLI adalah alur resmi, sesuai urutan instal Anda); endpoint backend-nya pun belum dipindahkan dari FishVision.
- Pengujian aksesibilitas otomatis penuh (axe/screen reader) tidak dilakukan; yang diperiksa: kontras terhitung, label/ARIA, fokus keyboard, reduced-motion.
- Ukuran bundel produksi (Vite, minify) belum diukur; bundel esbuild non-minify uji ≈ 760 KB.
