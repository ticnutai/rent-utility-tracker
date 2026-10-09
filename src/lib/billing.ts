import { detectPeriodMode, shiftPeriod } from "./periodLabel";

/** A meter replaced mid-period: last reading on the old meter and first reading on the new one. */
export type MeterSwap = { oldEnd: number; newStart: number };

export type Meter = {
  mainPrev: number;
  mainCurr: number;
  aPrev: number;
  aCurr: number;
  rate: number;
  vat: boolean;
  fixed: number;
  mainSwap?: MeterSwap;
  aSwap?: MeterSwap;
  /** Storage path (contracts bucket, under the owner's folder) of a photo of the readings. */
  photo?: string;
};

export type Payment = { paid: boolean; amount: number; date: string; notes: string };

export type Period = {
  id: string;
  start: string;
  end: string;
  elec: Meter;
  water: Meter;
  payA: Payment;
  payB: Payment;
  /** VAT % frozen when the period is created, so a later change in settings doesn't rewrite old bills. */
  vatRate?: number;
};

export type Settings = { nameA: string; nameB: string; vatRate: number };

export type MeterResult = {
  main: number;
  a: number;
  b: number;
  effRate: number;
  fixedEach: number;
  costA: number;
  costB: number;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Consumption between two readings; after a replacement it is the old meter's tail plus the new meter's usage. */
export function usage(prev: number, curr: number, swap?: MeterSwap) {
  return swap
    ? (swap.oldEnd || 0) - (prev || 0) + ((curr || 0) - (swap.newStart || 0))
    : (curr || 0) - (prev || 0);
}

export function calcMeter(m: Meter, vatRate: number): MeterResult {
  const mult = m.vat ? 1 + vatRate / 100 : 1;
  const main = usage(m.mainPrev, m.mainCurr, m.mainSwap);
  const a = usage(m.aPrev, m.aCurr, m.aSwap);
  const b = main - a;
  const effRate = (m.rate || 0) * mult;
  const fixedEach = ((m.fixed || 0) * mult) / 2;
  return {
    main: r2(main),
    a: r2(a),
    b: r2(b),
    effRate,
    fixedEach: r2(fixedEach),
    costA: r2(a * effRate + fixedEach),
    costB: r2(b * effRate + fixedEach),
  };
}

/** The period's own VAT rate; older periods saved before it existed fall back to the settings rate. */
export const periodVat = (p: Period, fallback: number) => p.vatRate ?? fallback;

export function calcPeriod(p: Period, vatRate: number) {
  const vat = periodVat(p, vatRate);
  const elec = calcMeter(p.elec, vat);
  const water = calcMeter(p.water, vat);
  return { elec, water, totalA: r2(elec.costA + water.costA), totalB: r2(elec.costB + water.costB) };
}

const emptyMeter = (): Meter => ({ mainPrev: 0, mainCurr: 0, aPrev: 0, aCurr: 0, rate: 0, vat: true, fixed: 0 });
const emptyPay = (): Payment => ({ paid: false, amount: 0, date: "", notes: "" });

/** Local-calendar YYYY-MM-DD (toISOString would shift to UTC and lose a day in Israel after midnight). */
export function localISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Amount actually received; a payment marked paid without an amount counts as paid in full. */
export const paidAmount = (pay: Payment, total: number) => (pay.paid ? pay.amount || total : 0);

/**
 * New period; carries previous readings, rates and fixed fees from the latest prior period.
 * Calendar periods (one or two whole months) continue with the next block; other ranges start the day after.
 */
export function newPeriod(prev?: Period, vatRate?: number, today = new Date()): Period {
  const now = localISO(today);
  let start = localISO(new Date(today.getFullYear(), today.getMonth(), 1));
  let end = now;
  if (prev) {
    const mode = detectPeriodMode(prev.start, prev.end);
    if (mode === "custom") {
      start = shiftPeriod(prev.end, prev.end, "custom", 1).start;
      end = now > start ? now : start;
    } else {
      ({ start, end } = shiftPeriod(prev.start, prev.end, mode, 1));
    }
  }
  const carry = (m?: Meter): Meter =>
    m ? { ...emptyMeter(), mainPrev: m.mainCurr, mainCurr: m.mainCurr, aPrev: m.aCurr, aCurr: m.aCurr, rate: m.rate, vat: m.vat, fixed: m.fixed } : emptyMeter();
  return {
    id: crypto.randomUUID(),
    start,
    end,
    elec: carry(prev?.elec),
    water: carry(prev?.water),
    payA: emptyPay(),
    payB: emptyPay(),
    ...(vatRate === undefined ? {} : { vatRate }),
  };
}

export const fmtDate = (d: string) => (d ? d.split("-").reverse().join("/") : "");
export const ils = (n: number) => `₪${n.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** `tenant` greets the tenant by name; without it the apartment name from settings is used. */
export function summaryText(p: Period, s: Settings, who: "a" | "b", tenant?: string) {
  const c = calcPeriod(p, s.vatRate);
  const vatRate = periodVat(p, s.vatRate);
  const name = who === "a" ? s.nameA : s.nameB;
  const e = c.elec, w = c.water;
  const cons = (r: MeterResult) => (who === "a" ? r.a : r.b);
  const cost = (r: MeterResult) => (who === "a" ? r.costA : r.costB);
  const vat = (m: Meter) => (m.vat ? ` (כולל מע"מ ${vatRate}%)` : "");
  const reading = (prev: number, curr: number, swap?: MeterSwap) =>
    swap ? `${prev} ← ${swap.oldEnd} (המונה הוחלף) ${swap.newStart} ← ${curr}` : `${prev} ← ${curr}`;
  const meterLines = (m: Meter) =>
    who === "a"
      ? `מונה ${s.nameA}: ${reading(m.aPrev, m.aCurr, m.aSwap)}`
      : `מונה ראשי: ${reading(m.mainPrev, m.mainCurr, m.mainSwap)}\nמונה ${s.nameA}: ${reading(m.aPrev, m.aCurr, m.aSwap)}`;
  // No connection-fee line when there is no fee.
  const fee = (r: MeterResult) => (r.fixedEach ? [`חצי דמי חיבור: ${ils(r.fixedEach)}`] : []);
  return [
    `שלום ${tenant || name},`,
    `פירוט חשבון חשמל ומים לתקופה ${fmtDate(p.start)} – ${fmtDate(p.end)}:`,
    ``,
    `⚡ *חשמל*`,
    meterLines(p.elec),
    `צריכה: ${cons(e)} קוט"ש × ${ils(e.effRate)}${vat(p.elec)}`,
    ...fee(e),
    `סה"כ חשמל: *${ils(cost(e))}*`,
    ``,
    `💧 *מים*`,
    meterLines(p.water),
    `צריכה: ${cons(w)} קוב × ${ils(w.effRate)}${vat(p.water)}`,
    ...fee(w),
    `סה"כ מים: *${ils(cost(w))}*`,
    ``,
    `💰 *סה"כ לתשלום: ${ils(who === "a" ? c.totalA : c.totalB)}*`,
    `תודה!`,
  ].join("\n");
}
