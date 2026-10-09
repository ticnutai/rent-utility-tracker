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
  const [y, m, d] = s.split("-").map(Number);
  return { y: y!, m: m! - 1, d: d! };
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
