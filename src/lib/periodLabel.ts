export const HE_MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const lastDay = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

/** Range from the 1st of month `m` (0-based) through the last day of month m + count - 1. */
export function monthRange(year: number, month: number, count: 1 | 2): { start: string; end: string } {
  const endM = (month + count - 1) % 12;
  const endY = year + Math.floor((month + count - 1) / 12);
  return { start: iso(year, month, 1), end: iso(endY, endM, lastDay(endY, endM)) };
}

function parts(s: string) {
  const [y = 0, m = 1, d = 1] = s.split("-").map(Number);
  return { y, m: m - 1, d };
}

export type PeriodMode = "single" | "bi" | "custom";

export function detectPeriodMode(start: string, end: string): PeriodMode {
  const label = periodLabel(start, end);
  return label ? (label.includes("–") ? "bi" : "single") : "custom";
}

/** Custom ranges advance by their inclusive day count; calendar ranges by one/two months. */
export function shiftPeriod(start: string, end: string, mode: PeriodMode, direction: -1 | 1) {
  if (!start || !end || end < start) return { start, end };
  const s = parts(start);
  if (mode !== "custom") {
    const date = new Date(s.y, s.m + direction * (mode === "bi" ? 2 : 1), 1);
    return monthRange(date.getFullYear(), date.getMonth(), mode === "bi" ? 2 : 1);
  }
  const first = Date.parse(`${start}T00:00:00Z`);
  const last = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(first) || !Number.isFinite(last)) return { start, end };
  const offset = direction * (last - first + 86400000);
  return { start: new Date(first + offset).toISOString().slice(0, 10), end: new Date(last + offset).toISOString().slice(0, 10) };
}

export function rangesOverlap(start: string, end: string, from: string, to: string) {
  return start <= to && end >= from;
}

/** Hebrew label: "ספטמבר 2026", "יולי–אוגוסט 2026", "דצמבר 2025–ינואר 2026", or null for partial months. */
export function periodLabel(start: string, end: string): string | null {
  if (!start || !end) return null;
  const s = parts(start), e = parts(end);
  if (s.d !== 1 || e.d !== lastDay(e.y, e.m)) return null;
  const span = (e.y - s.y) * 12 + (e.m - s.m);
  if (span === 0) return `${HE_MONTHS[s.m]} ${s.y}`;
  if (span === 1) {
    return s.y === e.y
      ? `${HE_MONTHS[s.m]}–${HE_MONTHS[e.m]} ${s.y}`
      : `${HE_MONTHS[s.m]} ${s.y}–${HE_MONTHS[e.m]} ${e.y}`;
  }
  return null;
}

export function periodYear(start: string): number {
  return Number(start.slice(0, 4));
}
