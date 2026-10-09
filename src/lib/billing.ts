export type Meter = {
  mainPrev: number;
  mainCurr: number;
  aPrev: number;
  aCurr: number;
  rate: number;
  vat: boolean;
  fixed: number;
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

export function calcMeter(m: Meter, vatRate: number): MeterResult {
  const mult = m.vat ? 1 + vatRate / 100 : 1;
  const main = (m.mainCurr || 0) - (m.mainPrev || 0);
  const a = (m.aCurr || 0) - (m.aPrev || 0);
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

export function calcPeriod(p: Period, vatRate: number) {
  const elec = calcMeter(p.elec, vatRate);
  const water = calcMeter(p.water, vatRate);
  return { elec, water, totalA: r2(elec.costA + water.costA), totalB: r2(elec.costB + water.costB) };
}

const emptyMeter = (): Meter => ({ mainPrev: 0, mainCurr: 0, aPrev: 0, aCurr: 0, rate: 0, vat: true, fixed: 0 });
const emptyPay = (): Payment => ({ paid: false, amount: 0, date: "", notes: "" });

/** New period; carries previous readings, rates and fixed fees from the latest prior period. */
export function newPeriod(prev?: Period): Period {
  const today = new Date();
  const start = prev?.end ?? new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const carry = (m?: Meter): Meter =>
    m ? { ...emptyMeter(), mainPrev: m.mainCurr, mainCurr: m.mainCurr, aPrev: m.aCurr, aCurr: m.aCurr, rate: m.rate, vat: m.vat, fixed: m.fixed } : emptyMeter();
  return {
    id: crypto.randomUUID(),
    start,
    end: today.toISOString().slice(0, 10),
    elec: carry(prev?.elec),
    water: carry(prev?.water),
    payA: emptyPay(),
    payB: emptyPay(),
  };
}

export const fmtDate = (d: string) => (d ? d.split("-").reverse().join("/") : "");
export const ils = (n: number) => `₪${n.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function summaryText(p: Period, s: Settings, who: "a" | "b") {
  const c = calcPeriod(p, s.vatRate);
  const name = who === "a" ? s.nameA : s.nameB;
  const e = c.elec, w = c.water;
  const cons = (r: MeterResult) => (who === "a" ? r.a : r.b);
  const cost = (r: MeterResult) => (who === "a" ? r.costA : r.costB);
  const vat = (m: Meter) => (m.vat ? ` (כולל מע"מ ${s.vatRate}%)` : "");
  const meterLines = (m: Meter) =>
    who === "a"
      ? `מונה דירה: ${m.aPrev} ← ${m.aCurr}`
      : `מונה ראשי: ${m.mainPrev} ← ${m.mainCurr}\nמונה דירה א': ${m.aPrev} ← ${m.aCurr}`;
  return [
    `שלום ${name},`,
    `פירוט חשבון חשמל ומים לתקופה ${fmtDate(p.start)} – ${fmtDate(p.end)}:`,
    ``,
    `⚡ *חשמל*`,
    meterLines(p.elec),
    `צריכה: ${cons(e)} קוט"ש × ${ils(e.effRate)}${vat(p.elec)}`,
    `חצי דמי חיבור: ${ils(e.fixedEach)}`,
    `סה"כ חשמל: *${ils(cost(e))}*`,
    ``,
    `💧 *מים*`,
    meterLines(p.water),
    `צריכה: ${cons(w)} קוב × ${ils(w.effRate)}${vat(p.water)}`,
    `חצי דמי חיבור: ${ils(w.fixedEach)}`,
    `סה"כ מים: *${ils(cost(w))}*`,
    ``,
    `💰 *סה"כ לתשלום: ${ils(who === "a" ? c.totalA : c.totalB)}*`,
    `תודה!`,
  ].join("\n");
}
