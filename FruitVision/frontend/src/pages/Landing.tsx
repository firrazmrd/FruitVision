import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../components/icons";
import { FruitGlyph, Landscape, Logo, ScanPlate } from "../components/art";
import { Reveal, ThemeToggle } from "../components/ui";
import { useJelly } from "../lib/motion";
import { usePrefs } from "../prefs";
import { FRUITS } from "../api";

const STEPS = [
  { t: "Unggah gambar", d: "JPG atau PNG, maksimal 15 MB. Gambar divalidasi (format, ukuran, keterbacaan) sebelum diproses.", m: "JPG · PNG · ≤ 15 MB" },
  { t: "Preprocessing", d: "Orientasi EXIF diterapkan lalu gambar diubah ke ukuran tetap agar fitur sebanding antar gambar.", m: "224 × 224 · INTER_AREA" },
  { t: "Segmentasi", d: "Buah dipisahkan dari latar dengan HSV-Otsu atau GrabCut. Bila segmentasi gagal, sistem melaporkannya, tidak menebak.", m: "HSV · GrabCut" },
  { t: "Ekstraksi fitur", d: "Warna (histogram HSV), bentuk dan gradien (HOG), serta tekstur (GLCM) dihitung dari area buah.", m: "128 + 1296 + 4 dimensi" },
  { t: "Klasifikasi", d: "Dua model memprediksi jenis buah dan kondisinya (Fresh / Rotten), masing-masing dengan skor confidence.", m: "KNN · SVM" },
];

export default function Landing() {
  const { theme, toggleTheme } = usePrefs(); const [scrolled, setScrolled] = useState(false); const jelly = useJelly<HTMLDivElement>(1);
  useEffect(() => { const f = () => setScrolled(window.scrollY > 12); f(); window.addEventListener("scroll", f, { passive: true }); return () => window.removeEventListener("scroll", f); }, []);

  return (
    <div>
      <a href="#how" className="skip">Lewati ke konten</a>
      <header className={`lnav ${scrolled ? "scrolled" : ""}`}>
        <div className="container-x row">
          <Link to="/" className="flex items-center gap-2" style={{ textDecoration: "none" }} aria-label="FruitVision"><Logo size={30} /><span style={{ fontFamily: "var(--f-display)", fontSize: "1.4rem", color: "var(--head)" }}>FruitVision</span></Link>
          <nav className="links flex gap-5" style={{ marginLeft: "auto" }} aria-label="Bagian halaman"><a className="link" href="#how">How it works</a><a className="link" href="#fruits">Fruits</a><a className="link" href="#tech">Technology</a></nav>
          <div className="flex items-center gap-2" style={{ marginLeft: "auto" }}><ThemeToggle theme={theme} toggle={toggleTheme} /><Link to="/app" className="btn btn-primary btn-sm">Open Workspace</Link></div>
        </div>
      </header>

      <section className="hero orchard-sky" aria-labelledby="hero-h">
        <Landscape height="clamp(260px, 40vw, 540px)" seed={3} />
        <div className="container-x copy" style={{ flex: 1, display: "flex", alignItems: "center" }}>
          <div className="hero-grid" style={{ width: "100%" }}>
            <div style={{ display: "grid", gap: "1.4rem", justifyItems: "start" }}>
              <Reveal><span className="eyebrow">Nature Meets Intelligence</span></Reveal>
              <Reveal delay={80}><h1 id="hero-h" className="display" style={{ fontSize: "clamp(2.8rem, 7.2vw, 5.6rem)", margin: 0 }}>The Living<br /><em>Orchard</em> Lab.</h1></Reveal>
              <Reveal delay={160}><p className="lead">Explore fruit freshness through intelligent computer vision. Unggah foto buah, lihat bagaimana ia disegmentasi, lalu baca jenis dan kondisinya.</p></Reveal>
              <Reveal delay={240} className="flex flex-wrap gap-3"><Link to="/app/scanner" className="btn btn-primary">Start Analyzing<Icon name="arrow" size={18} /></Link><a href="#tech" className="btn btn-secondary">Explore Technology</a></Reveal>
            </div>
            <Reveal delay={200}><div ref={jelly} className="jelly" style={{ maxWidth: 440, marginInline: "auto", width: "100%" }}><ScanPlate /></div></Reveal>
          </div>
        </div>
      </section>

      <section id="how" className="band" aria-labelledby="how-h">
        <div className="container-x">
          <div className="split-r" style={{ marginBottom: "2.5rem" }}>
            <Reveal><span className="eyebrow">How FruitVision works</span><h2 id="how-h" className="h2" style={{ margin: ".6rem 0 0" }}>Dari foto ke keputusan, lima langkah yang bisa dilihat.</h2></Reveal>
            <Reveal delay={100}><p className="soft" style={{ margin: 0, maxWidth: "34rem" }}>Setiap langkah memakai pengolahan citra klasik yang dapat dijelaskan dan diuji. Di Image Lab Anda dapat melihat hasil tiap tahap pada gambar sendiri.</p></Reveal>
          </div>
          <div className="steps-editorial">{STEPS.map((s, i) => (
            <Reveal key={s.t} delay={i * 60} className="se"><span className="no">{String(i + 1).padStart(2, "0")}</span><div><h3 className="h3" style={{ margin: 0 }}>{s.t}</h3><p className="soft small" style={{ margin: ".4rem 0 0" }}>{s.d}</p></div><div className="mono small" style={{ color: "var(--accent-ink)", paddingTop: ".35rem" }}>{s.m}</div></Reveal>))}
          </div>
        </div>
      </section>

      <section id="fruits" className="band alt" aria-labelledby="fruits-h">
        <div className="container-x">
          <Reveal><span className="eyebrow">Supported fruit categories</span><h2 id="fruits-h" className="h2" style={{ margin: ".6rem 0 .6rem", maxWidth: "30rem" }}>Delapan buah, dua kondisi.</h2><p className="soft" style={{ maxWidth: "40rem", marginTop: 0 }}>Model hanya mengenali 16 kelas dari dataset <em>Fresh and Rotten Fruits</em>. Label <strong>Fresh</strong> dan <strong>Rotten</strong> mengikuti dataset dan bukan tingkat kematangan.</p></Reveal>
          <div className="fruit-grid" style={{ marginTop: "2rem" }}>{FRUITS.map((f, i) => (
            <Reveal key={f.id} delay={(i % 4) * 70}><div className="fruit-tile"><FruitGlyph name={f.id} size={58} /><div><div className="h3" style={{ lineHeight: 1.1 }}>{f.en}</div><div className="xs muted">{f.id_}</div></div><div className="chip-row"><span className="badge fresh">Fresh</span><span className="badge rotten">Rotten</span></div></div></Reveal>))}
          </div>
        </div>
      </section>

      <section id="tech" className="band" aria-labelledby="tech-h">
        <div className="container-x split">
          <Reveal><span className="eyebrow">Computer vision technology</span><h2 id="tech-h" className="h2" style={{ margin: ".6rem 0 1rem" }}>Presisi laboratorium, dengan batas yang dinyatakan terang.</h2>
            <div className="plate" style={{ marginTop: "1.5rem" }}><h3 className="h3" style={{ marginTop: 0 }}>Yang perlu diketahui</h3><ul className="small soft" style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: ".4rem" }}>
              <li>Hasil adalah prediksi probabilistik, bukan kepastian.</li><li>Model dilatih pada satu dataset; foto dengan kondisi sangat berbeda dapat memberi hasil kurang tepat.</li><li>Gambar buah di luar 8 jenis akan tetap dijawab salah satu kelas yang ada.</li></ul></div>
          </Reveal>
          <div style={{ display: "grid", gap: "1rem" }}>
            {[["Segmentation", "HSV-Otsu & GrabCut", "Memisahkan buah dari latar. Keduanya dapat dibandingkan langsung di Image Lab."], ["Feature extraction", "Color Histogram · HOG · GLCM", "Warna untuk jenis dan perubahan kecoklatan, bentuk dan gradien untuk siluet, tekstur untuk bercak."], ["Classification", "KNN & SVM", "Satu model untuk jenis buah, satu untuk kondisi. Hyperparameter dipilih pada data validation."]].map(([e, t, d], i) => (
              <Reveal key={e} delay={i * 90}><div className="card flat" style={{ marginLeft: i === 1 ? "clamp(0px, 4vw, 3rem)" : 0 }}><span className="eyebrow">{e}</span><h3 className="h3" style={{ margin: ".3rem 0" }}>{t}</h3><p className="small soft" style={{ margin: 0 }}>{d}</p></div></Reveal>))}
          </div>
        </div>
      </section>

      <footer className="orchard orchard-sky" aria-label="Footer">
        <div className="container-x over">
          <Reveal><div className="split" style={{ alignItems: "end" }}>
            <div><div className="flex items-center gap-2" style={{ marginBottom: ".75rem" }}><Logo size={34} /><span style={{ fontFamily: "var(--f-display)", fontSize: "1.8rem", color: "var(--head)" }}>FruitVision</span></div>
              <p className="display" style={{ fontSize: "clamp(1.6rem,3vw,2.3rem)", margin: 0 }}>Nature Meets <em>Intelligence.</em></p>
              <div style={{ marginTop: "1.25rem" }}><Link to="/app/scanner" className="btn btn-primary">Start Analyzing<Icon name="arrow" size={18} /></Link></div></div>
            <p className="xs soft" style={{ margin: 0, maxWidth: "26rem" }}>Dataset: <em>Fresh and Rotten Fruits Dataset</em> (Mendeley Data, lisensi CC BY 4.0). FruitVision adalah proyek Pengolahan Citra Digital dan berjalan lokal di komputer Anda.</p>
          </div></Reveal>
        </div>
        <Landscape height="clamp(240px, 36vw, 480px)" seed={9} />
      </footer>
    </div>
  );
}
