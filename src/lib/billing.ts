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
  /** Total of the supplier's bill (₪ incl. VAT) the rate was derived from, kept for reference. */
  supplierBill?: number;
  /**
   * How apartment A's share of the main meter is found: its own sub-meter readings (default),
   * half of the main meter, or in proportion to the occupants (personsA / personsB).
   */
  split?: MeterSplit;
  personsA?: number;
  personsB?: number;
  /** Tiered pricing (water): each unit's quota at `low`, the rest at `high`. Replaces `rate`. */
  tiers?: Tiers;
};

export type MeterSplit = "meter" | "half" | "persons";
export type Tiers = { low: number; high: number; quotaA: number; quotaB: number };

/**
 * Average price per unit from the supplier's bill: bill total ÷ main-meter consumption.
 * Tiered tariffs (e.g. water's discounted quota) and fixed charges are spread fairly by usage.
 */
export function rateFromBill(billTotal: number, mainUsage: number) {
  if (!(billTotal > 0) || !(mainUsage > 0)) return null;
  return Math.round((billTotal / mainUsage) * 10000) / 10000;
}

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
  /** Municipal tax charged for the period (₪), only for units whose rent doesn't include it. */
  arnona?: { a: number; b: number };
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
  /** With tiers: how much of each unit's usage was billed at the low and the high price. */
  tierA?: TierSplit;
  tierB?: TierSplit;
};

export type TierSplit = { lowQty: number; highQty: number };

/** Usage up to the quota at the low price, the rest at the high price. */
export function tierSplit(qty: number, quota: number): TierSplit {
  const lowQty = Math.max(0, Math.min(qty, quota));
  return { lowQty: r2(lowQty), highQty: r2(Math.max(0, qty - lowQty)) };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Consumption between two readings; after a replacement it is the old meter's tail plus the new meter's usage. */
export function usage(prev: number, curr: number, swap?: MeterSwap) {
  return swap
    ? (swap.oldEnd || 0) - (prev || 0) + ((curr || 0) - (swap.newStart || 0))
    : (curr || 0) - (prev || 0);
}

/** Apartment A's usage: its sub-meter, or a share of the main meter when there is no sub-meter. */
function shareA(m: Meter, main: number) {
  if (m.split === "half") return main / 2;
  if (m.split === "persons") {
    const pa = m.personsA || 0, pb = m.personsB || 0;
    return pa + pb > 0 ? (main * pa) / (pa + pb) : main / 2;
  }
  return usage(m.aPrev, m.aCurr, m.aSwap);
}

export function calcMeter(m: Meter, vatRate: number): MeterResult {
  const mult = m.vat ? 1 + vatRate / 100 : 1;
  const main = usage(m.mainPrev, m.mainCurr, m.mainSwap);
  const a = r2(shareA(m, main));
  const b = r2(main - a);
  const fixedEach = ((m.fixed || 0) * mult) / 2;
  if (m.tiers) {
    const t = m.tiers;
    const tierA = tierSplit(a, t.quotaA), tierB = tierSplit(b, t.quotaB);
    const cost = (s: TierSplit) => (s.lowQty * t.low + s.highQty * t.high) * mult;
    const costA = cost(tierA), costB = cost(tierB);
    return {
      main: r2(main), a, b,
      effRate: main > 0 ? (costA + costB) / main : t.low * mult,
      fixedEach: r2(fixedEach),
      costA: r2(costA + fixedEach),
      costB: r2(costB + fixedEach),
      tierA, tierB,
    };
  }
  const effRate = (m.rate || 0) * mult;
  return {
    main: r2(main),
    a,
    b,
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
  const arnonaA = r2(p.arnona?.a ?? 0), arnonaB = r2(p.arnona?.b ?? 0);
  return {
    elec,
    water,
    arnonaA,
    arnonaB,
    totalA: r2(elec.costA + water.costA + arnonaA),
    totalB: r2(elec.costB + water.costB + arnonaB),
  };
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
  const main = (m: Meter) => `מונה ראשי: ${reading(m.mainPrev, m.mainCurr, m.mainSwap)}`;
  const meterLines = (m: Meter): string[] => {
    // Without a sub-meter the share comes from the agreed split, not from readings.
    if (m.split === "half") return [main(m), `חלוקה: חצי־חצי בין שתי היחידות`];
    if (m.split === "persons") return [main(m), `חלוקה לפי נפשות: ${s.nameA} ${m.personsA || 0}, ${s.nameB} ${m.personsB || 0}`];
    const sub = `מונה ${s.nameA}: ${reading(m.aPrev, m.aCurr, m.aSwap)}`;
    return who === "a" ? [sub] : [main(m), sub];
  };
  const usageLines = (r: MeterResult, m: Meter, unit: string) => {
    const t = who === "a" ? r.tierA : r.tierB;
    if (!m.tiers || !t) return [`צריכה: ${cons(r)} ${unit} × ${ils(r.effRate)}${vat(m)}`];
    const mult = m.vat ? 1 + vatRate / 100 : 1;
    return [
      `צריכה: ${cons(r)} ${unit}`,
      `• ${t.lowQty} ${unit} בתעריף המוזל × ${ils(m.tiers.low * mult)}`,
      ...(t.highQty > 0 ? [`• ${t.highQty} ${unit} מעל המכסה × ${ils(m.tiers.high * mult)}`] : []),
    ];
  };
  // No fixed-charge line when there is no fixed charge.
  const fee = (r: MeterResult) => (r.fixedEach ? [`חלקך בתשלום הקבוע: ${ils(r.fixedEach)}`] : []);
  const arnona = who === "a" ? c.arnonaA : c.arnonaB;
  return [
    `שלום ${tenant || name},`,
    `פירוט חשבון ${arnona ? "חשמל, מים וארנונה" : "חשמל ומים"} לתקופה ${fmtDate(p.start)} – ${fmtDate(p.end)}:`,
    ``,
    `⚡ *חשמל*`,
    ...meterLines(p.elec),
    ...usageLines(e, p.elec, 'קוט"ש'),
    ...fee(e),
    `סה"כ חשמל: *${ils(cost(e))}*`,
    ``,
    `💧 *מים*`,
    ...meterLines(p.water),
    ...usageLines(w, p.water, "קוב"),
    ...fee(w),
    `סה"כ מים: *${ils(cost(w))}*`,
    ...(arnona ? [``, `🏠 *ארנונה לתקופה: ${ils(arnona)}*`] : []),
    ``,
    `💰 *סה"כ לתשלום: ${ils(who === "a" ? c.totalA : c.totalB)}*`,
    `תודה!`,
  ].join("\n");
}
