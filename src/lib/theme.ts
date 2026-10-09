export type ThemeId = "emerald" | "blue" | "warm" | "purple";
export type ThemeMode = "light" | "dark";

export const THEMES: { id: ThemeId; label: string; swatch: string }[] = [
  { id: "emerald", label: "ירוק אמרלד", swatch: "hsl(160 84% 30%)" },
  { id: "blue", label: "כחול עסקי", swatch: "hsl(217 80% 45%)" },
  { id: "warm", label: "ניטרלי חם", swatch: "hsl(30 30% 32%)" },
  { id: "purple", label: "סגול עדין", swatch: "hsl(270 55% 50%)" },
];

const KEY = "app-theme";
const MODE_KEY = "app-theme-mode";

export function getStoredTheme(): ThemeId {
  if (typeof window === "undefined") return "emerald";
  const v = localStorage.getItem(KEY);
  return THEMES.some((t) => t.id === v) ? (v as ThemeId) : "emerald";
}

export function getStoredMode(): ThemeMode {
  if (typeof window === "undefined") return "light";
  return localStorage.getItem(MODE_KEY) === "dark" ? "dark" : "light";
}

export function applyTheme(theme: ThemeId, mode: ThemeMode) {
  if (typeof window === "undefined") return;
  const root = document.documentElement;
  root.dataset["theme"] = theme;
  root.classList.toggle("dark", mode === "dark");
  localStorage.setItem(KEY, theme);
  localStorage.setItem(MODE_KEY, mode);
}

/** Run once at app start so the stored theme applies before first paint. */
export function initTheme() {
  applyTheme(getStoredTheme(), getStoredMode());
}
