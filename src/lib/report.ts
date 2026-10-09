import { calcPeriod, fmtDate, type Period, type Settings } from "./billing";
import { HE_MONTHS, monthRange, periodLabel, periodYear, rangesOverlap } from "./periodLabel";

/** Latest period (by end date) ending on/before `start`; falls back to the overall latest when no start given. */
export function latestBefore(periods: Period[], start?: string): Period | undefined {
  return [...periods]
    .filter((p) => !start || p.end <= start)
    .sort((a, b) => b.end.localeCompare(a.end))[0];
}

/** Month indexes (0-11) in `year` not covered by any period, up to and including `today`'s month (past months only). */
export function missingMonths(periods: Period[], year: number, today = new Date()): number[] {
  const lastMonth = year < today.getFullYear() ? 11 : year > today.getFullYear() ? -1 : today.getMonth() - 1;
  const out: number[] = [];
  for (let m = 0; m <= lastMonth; m++) {
    const r = monthRange(year, m, 1);
    if (!periods.some((p) => rangesOverlap(p.start, p.end, r.start, r.end))) out.push(m);
  }
  return out;
}

export type ReportRow = (string | number)[];

export function yearlyReport(periods: Period[], s: Settings, year: number) {
  const list = periods.filter((p) => periodYear(p.start) === year).sort((a, b) => a.start.localeCompare(b.start));
  const header = ["תקופה", "מתאריך", "עד תאריך", `חשמל ${s.nameA} (קוט"ש)`, `חשמל ${s.nameB} (קוט"ש)`, `מים ${s.nameA} (קוב)`, `מים ${s.nameB} (קוב)`, `סה"כ ${s.nameA} (₪)`, `סה"כ ${s.nameB} (₪)`, `שולם ${s.nameA}`, `שולם ${s.nameB}`];
  const t = { ea: 0, eb: 0, wa: 0, wb: 0, ta: 0, tb: 0, pa: 0, pb: 0 };
  const rows: ReportRow[] = list.map((p) => {
    const c = calcPeriod(p, s.vatRate);
    t.ea += c.elec.a; t.eb += c.elec.b; t.wa += c.water.a; t.wb += c.water.b; t.ta += c.totalA; t.tb += c.totalB;
    if (p.payA.paid) t.pa += p.payA.amount || c.totalA;
    if (p.payB.paid) t.pb += p.payB.amount || c.totalB;
    return [periodLabel(p.start, p.end) ?? `${fmtDate(p.start)}–${fmtDate(p.end)}`, fmtDate(p.start), fmtDate(p.end), c.elec.a, c.elec.b, c.water.a, c.water.b, c.totalA, c.totalB, p.payA.paid ? "כן" : "לא", p.payB.paid ? "כן" : "לא"];
  });
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const summary: ReportRow[] = [
    ["", s.nameA, s.nameB],
    ['צריכת חשמל (קוט"ש)', r2(t.ea), r2(t.eb)],
    ["צריכת מים (קוב)", r2(t.wa), r2(t.wb)],
    ['סה"כ חיובים (₪)', r2(t.ta), r2(t.tb)],
    ["שולם (₪)", r2(t.pa), r2(t.pb)],
    ["יתרה (₪)", r2(t.ta - t.pa), r2(t.tb - t.pb)],
  ];
  const missing = missingMonths(periods, year).map((m) => HE_MONTHS[m]);
  return { header, rows, summary, missing, count: list.length };
}
