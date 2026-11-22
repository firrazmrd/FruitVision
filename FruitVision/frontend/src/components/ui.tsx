import { createContext, useCallback, useContext, useEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import { Icon, type IconName } from "./icons";
import { isReduced } from "../lib/motion";

/* ---------- Reveal: fade-in + slide-up + blur-in saat masuk viewport (IntersectionObserver, sekali) ---------- */
export function Reveal({ children, delay = 0, className = "", as: Tag = "div" }: { children: ReactNode; delay?: number; className?: string; as?: ElementType }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (isReduced() || typeof IntersectionObserver === "undefined") { el.classList.add("in"); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add("in"); io.disconnect(); } }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    io.observe(el); return () => io.disconnect();
  }, []);
  return <Tag ref={ref} className={`reveal ${className}`} style={{ ["--d" as any]: `${delay}ms` }}>{children}</Tag>;
}

/* ---------- dasar ---------- */
export const Spinner = ({ label }: { label?: string }) => <span role="status" className="inline-flex items-center gap-2"><span className="spinner" />{label && <span className="small soft">{label}</span>}</span>;
export const Skeleton = ({ h = 16, w = "100%" }: { h?: number; w?: number | string }) => <div className="skeleton" style={{ height: h, width: w }} aria-hidden="true" />;
export const Badge = ({ tone = "neutral", children }: { tone?: "fresh" | "rotten" | "warn" | "neutral" | "info"; children: ReactNode }) => <span className={`badge ${tone}`}>{children}</span>;
export const CondBadge = ({ c }: { c?: string | null }) => c ? <Badge tone={c === "fresh" ? "fresh" : "rotten"}><Icon name={c === "fresh" ? "check" : "alert"} size={13} />{c === "fresh" ? "Fresh" : "Rotten"}</Badge> : <span className="muted">-</span>;
export const Bar = ({ value, tone = "" }: { value: number; tone?: "" | "fresh" | "rotten" | "sun" }) => <div className={`bar ${tone}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}><i style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} /></div>;

export function Alert({ kind = "info", title, children, action }: { kind?: "info" | "err" | "warn"; title?: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className={`alert ${kind === "info" ? "" : kind}`} role={kind === "err" ? "alert" : "status"}>
      <Icon name={kind === "info" ? "info" : "alert"} className="ico" />
      <div style={{ flex: 1, minWidth: 0 }}>{title && <strong style={{ display: "block" }}>{title}</strong>}<div style={{ whiteSpace: "pre-line" }}>{children}</div></div>{action}
    </div>
  );
}
export const ErrorState = ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
  <Alert kind="err" title="Terjadi kesalahan" action={onRetry && <button className="btn btn-secondary btn-sm" onClick={onRetry}><Icon name="refresh" size={15} />Coba lagi</button>}>{message}</Alert>
);
export function Empty({ icon = "leaf", title, children, action }: { icon?: IconName; title: string; children?: ReactNode; action?: ReactNode }) {
  return <div className="empty"><div className="ico-wrap"><Icon name={icon} size={28} /></div><h3 className="h3" style={{ margin: 0 }}>{title}</h3>{children && <p className="small soft" style={{ maxWidth: "34rem", margin: 0 }}>{children}</p>}{action}</div>;
}
export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: ReactNode; children?: ReactNode }) {
  return <header style={{ margin: "0 0 1.75rem", display: "grid", gap: ".5rem" }}>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2 className="h2" style={{ margin: 0 }}>{title}</h2>{children && <p className="soft" style={{ margin: 0, maxWidth: "46rem" }}>{children}</p>}</header>;
}

/* ---------- tabs (ARIA, panah kiri/kanan) ---------- */
export function Tabs<T extends string>({ value, onChange, items, label }: { value: T; onChange: (v: T) => void; items: { id: T; label: string }[]; label: string }) {
  const onKey = (e: React.KeyboardEvent) => {
    const i = items.findIndex(x => x.id === value); if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return; e.preventDefault();
    const n = items[(i + (e.key === "ArrowRight" ? 1 : items.length - 1)) % items.length]; onChange(n.id); (document.getElementById(`tab-${n.id}`) as HTMLElement | null)?.focus();
  };
  return <div className="tabs" role="tablist" aria-label={label} onKeyDown={onKey}>{items.map(t => <button key={t.id} id={`tab-${t.id}`} role="tab" className="tab" aria-selected={t.id === value} tabIndex={t.id === value ? 0 : -1} onClick={() => onChange(t.id)}>{t.label}</button>)}</div>;
}

/* ---------- modal dengan focus trap ---------- */
export function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null; const q = () => Array.from(box.current?.querySelectorAll<HTMLElement>("button,[href],input,select,textarea,[tabindex]:not([tabindex='-1'])") ?? []);
    q()[0]?.focus(); document.body.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
      if (e.key === "Tab") { const f = q(); if (!f.length) return; const a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
    };
    document.addEventListener("keydown", key); return () => { document.removeEventListener("keydown", key); document.body.style.overflow = ""; prev?.focus(); };
  }, [onClose]);
  return (
    <div className="modal-veil" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-t" ref={box}>
        <div className="flex items-start justify-between gap-3" style={{ marginBottom: ".75rem" }}><h3 id="modal-t" className="h3" style={{ margin: 0 }}>{title}</h3><button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Tutup"><Icon name="close" size={18} /></button></div>
        <div>{children}</div>{footer && <div className="flex justify-end gap-2" style={{ marginTop: "1.25rem" }}>{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- toast ---------- */
type T = { id: number; msg: string; kind: "ok" | "err" };
const Ctx = createContext<(m: string, k?: "ok" | "err") => void>(() => {});
export const useToast = () => useContext(Ctx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<T[]>([]);
  const push = useCallback((msg: string, kind: "ok" | "err" = "ok") => { const id = Date.now() + Math.random(); setList(l => [...l.slice(-3), { id, msg, kind }]); setTimeout(() => setList(l => l.filter(x => x.id !== id)), kind === "err" ? 6500 : 3500); }, []);
  return <Ctx.Provider value={push}>{children}<div className="toasts" role="status" aria-live="polite">{list.map(t => <div key={t.id} className={`toast ${t.kind === "err" ? "err" : ""}`}><Icon name={t.kind === "err" ? "alert" : "check"} size={18} /><span>{t.msg}</span></div>)}</div></Ctx.Provider>;
}

/* ---------- tombol tema ---------- */
export function ThemeToggle({ theme, toggle }: { theme: "light" | "dark"; toggle: () => void }) {
  return <button className="btn btn-ghost btn-icon" onClick={toggle} aria-label={theme === "dark" ? "Beralih ke mode terang" : "Beralih ke mode gelap"} aria-pressed={theme === "dark"} title={theme === "dark" ? "Mode terang" : "Mode gelap"}><Icon name={theme === "dark" ? "sun" : "moon"} /></button>;
}

export const Stat = ({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) => (
  <div style={{ display: "grid", gap: ".15rem" }}><span className="eyebrow">{label}</span><span className="mono" style={{ fontSize: "1.9rem", lineHeight: 1.1, color: "var(--head)" }}>{value}</span>{hint && <span className="xs muted">{hint}</span>}</div>
);
export const Mono = ({ children }: { children: ReactNode }) => <span className="mono">{children}</span>;
