export class ApiError extends Error { status: number; detail: any; constructor(m: string, s: number, d: any) { super(m); this.status = s; this.detail = d; } }
const DOWN = "Backend tidak dapat dihubungi. Pastikan uvicorn berjalan di 127.0.0.1:8000.";

function toError(status: number, d: any): ApiError {
  if (d?.detail === undefined && [502, 503, 504].includes(status)) return new ApiError(DOWN, 0, null);
  const det = d?.detail;
  const msg = typeof det === "string" ? det : det?.message ?? (Array.isArray(det) ? "Input tidak valid." : `Kesalahan ${status}`);
  return new ApiError(msg, status, det);
}
async function req<T>(url: string, init?: RequestInit): Promise<T> {
  let r: Response;
  try { r = await fetch(url, init); } catch { throw new ApiError(DOWN, 0, null); }
  if (!r.ok) { let d: any = null; try { d = await r.json(); } catch { /* bukan JSON */ } throw toError(r.status, d); }
  return r.json() as Promise<T>;
}
const json = (method: string, body?: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
export const get = <T = any>(u: string) => req<T>(u);
export const post = <T = any>(u: string, b?: unknown) => req<T>(u, json("POST", b ?? {}));
export const del = <T = any>(u: string) => req<T>(u, { method: "DELETE" });
export const upload = <T = any>(u: string, f: FormData) => req<T>(u, { method: "POST", body: f });

/** Unggah dengan progres (XHR; fetch tidak menyediakan progres unggah). onPhase("uploading" | "processing"). */
export function uploadProgress<T = any>(url: string, form: FormData, onPhase: (p: "uploading" | "processing", pct: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest(); x.open("POST", url); x.responseType = "json";
    x.upload.onprogress = e => { if (e.lengthComputable) onPhase("uploading", e.loaded / e.total); };
    x.upload.onload = () => onPhase("processing", 1);
    x.onerror = () => reject(new ApiError(DOWN, 0, null));
    x.onload = () => { if (x.status >= 200 && x.status < 300) resolve(x.response as T); else reject(toError(x.status, x.response)); };
    onPhase("uploading", 0); x.send(form);
  });
}
export const errText = (e: unknown) => {
  if (e instanceof ApiError) { const r = e.detail?.reasons; return e.message + (Array.isArray(r) && r.length ? "\n- " + r.join("\n- ") : ""); }
  return e instanceof Error ? e.message : String(e);
};
export const isDown = (e: unknown) => e instanceof ApiError && e.status === 0;

export const pct = (x: number | null | undefined, d = 1) => (x == null ? "-" : (100 * x).toFixed(d) + "%");
export const f4 = (x: number | null | undefined) => (x == null ? "-" : x.toFixed(4));
export const ms = (x: number | null | undefined) => (x == null ? "-" : x < 10 ? x.toFixed(2) + " ms" : x.toFixed(0) + " ms");
export const bytes = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`);
export const when = (iso: string) => { const d = new Date(iso); return isNaN(+d) ? iso : d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }); };
export const histThumb = (id: string) => `/api/history/${id}/thumbnail`;
export const dsThumb = (path: string, size = 256) => `/api/dataset/thumbnail?path=${encodeURIComponent(path)}&size=${size}`;

export const FRUITS = [
  { id: "apple", en: "Apple", id_: "Apel" }, { id: "banana", en: "Banana", id_: "Pisang" }, { id: "grape", en: "Grape", id_: "Anggur" }, { id: "guava", en: "Guava", id_: "Jambu biji" },
  { id: "jujube", en: "Jujube", id_: "Bidara" }, { id: "orange", en: "Orange", id_: "Jeruk" }, { id: "pomegranate", en: "Pomegranate", id_: "Delima" }, { id: "strawberry", en: "Strawberry", id_: "Stroberi" },
] as const;
export const fruitName = (id?: string | null) => FRUITS.find(f => f.id === id)?.en ?? (id ?? "-");
export const condName = (c?: string | null) => (c === "fresh" ? "Fresh" : c === "rotten" ? "Rotten" : (c ?? "-"));

// Tipe respons (ringkas; hanya field yang dipakai UI)
export interface Pred { label: string; confidence: number; top: { label: string; probability: number }[]; joint_label?: string; joint_confidence?: number }
export interface Classification {
  accepted: boolean; reason: string | null; detail?: string; fruit: Pred | null; condition: Pred | null; models: Record<string, string>; note: string; confidence_note?: string;
  segmentation?: { methods: string[]; preview: string; preview_is_segmented: boolean }; processing_ms: number; history_id?: string | null;
}
export interface HistoryItem {
  id: string; created_at: string; filename: string; bytes: number; width: number; height: number; accepted: boolean; reason: string | null;
  fruit: { label: string; confidence: number } | null; condition: { label: string; confidence: number } | null; models: Record<string, string>; processing_ms: number | null;
}
export interface HistorySummary {
  total: number; accepted: number; failed: number; by_condition: Record<string, number>; by_fruit: Record<string, number>; by_fruit_condition: Record<string, number>;
  mean_confidence: { fruit: number | null; condition: number | null }; per_day: { date: string; count: number }[]; first: string | null; last: string | null;
}
export interface ModelRow { id: string; task: string; active: boolean; feature?: string; classifier?: string; segmentation?: string; val_macro_f1?: number; test_macro_f1?: number; test_accuracy?: number; trained_at?: string }
export interface Experiment {
  id: string; task: string; feature: string; feature_dim: number; classifier: string; segmentation: string; best_params: Record<string, any>; val_macro_f1: number; test_accuracy: number; test_macro_f1: number;
  test_macro_precision: number; test_macro_recall: number; timing: { extract_ms_per_image: number; predict_ms_per_image_batch: number; predict_ms_per_image_single: number; train_seconds: number }; trained_at: string;
  n_train: number; n_val: number; n_test: number; derived?: Record<string, any> | null;
}
export interface Readiness { ready: boolean; reasons: string[]; dataset_path: string; validation: any; manifest: any; segmentation_selection: any; artifacts_exist: boolean }
