import { createContext, useContext, type ReactNode } from "react";
import { useMotionPref, useStored, useTheme } from "./hooks";

interface Prefs {
  theme: "light" | "dark"; themePref: "light" | "dark" | "system"; setThemePref: (p: "light" | "dark" | "system") => void; toggleTheme: () => void;
  motionPref: "system" | "reduced" | "full"; setMotionPref: (p: "system" | "reduced" | "full") => void;
  apple: boolean; setApple: (b: boolean) => void; saveHistory: boolean; setSaveHistory: (b: boolean) => void;
}
const Ctx = createContext<Prefs | null>(null);
export const usePrefs = () => { const c = useContext(Ctx); if (!c) throw new Error("PrefsProvider belum dipasang"); return c; };

export function PrefsProvider({ children }: { children: ReactNode }) {
  const t = useTheme(); const m = useMotionPref(); const [apple, setApple] = useStored<boolean>("fv-apple", true); const [saveHistory, setSaveHistory] = useStored<boolean>("fv-save-history", true);
  return <Ctx.Provider value={{ theme: t.theme, themePref: t.pref, setThemePref: t.setPref, toggleTheme: t.toggle, motionPref: m.pref, setMotionPref: m.setPref, apple, setApple, saveHistory, setSaveHistory }}>{children}</Ctx.Provider>;
}
