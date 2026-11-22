// Foto asli (opsional) diletakkan di public/photos dan didaftarkan di public/photos/manifest.json.
// Hanya foto yang terdaftar yang diminta browser, jadi tidak ada gambar rusak atau 404 di konsol bila foto belum ada.
import { useEffect, useState } from "react";

export interface PhotoInfo { src: string; alt: string; credit?: string }
let cache: Promise<Record<string, { alt?: string; credit?: string }>> | null = null;
const load = () => (cache ??= fetch("/photos/manifest.json").then(r => (r.ok ? r.json() : {})).catch(() => ({})));

export function usePhoto(name: string): PhotoInfo | null {
  const [info, setInfo] = useState<PhotoInfo | null>(null);
  useEffect(() => { let off = false; load().then(m => { if (!off && m && m[name]) setInfo({ src: `/photos/${name}`, alt: m[name].alt ?? "", credit: m[name].credit }); }); return () => { off = true; }; }, [name]);
  return info;
}
