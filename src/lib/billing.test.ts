import { describe, expect, it } from "vitest";
import { calcMeter, calcPeriod, localISO, newPeriod, paidAmount, rateFromBill, summaryText, type Period } from "./billing";

const m = { mainPrev: 1000, mainCurr: 1500, aPrev: 200, aCurr: 400, rate: 0.5, vat: false, fixed: 40 };

describe("calcMeter", () => {
  it("apartment B gets main consumption minus apartment A", () => {
    const r = calcMeter(m, 18);
    expect(r.a).toBe(200);
    expect(r.b).toBe(300);
  });
  it("fixed fee split half-half", () => {
    const r = calcMeter(m, 18);
    expect(r.costA).toBe(200 * 0.5 + 20);
    expect(r.costB).toBe(300 * 0.5 + 20);
  });
  it("VAT applied when enabled", () => {
    const r = calcMeter({ ...m, vat: true }, 18);
    expect(r.costA).toBe(Math.round((200 * 0.5 * 1.18 + 20 * 1.18) * 100) / 100);
  });
});

describe("meter replacement", () => {
  it("adds the old meter's tail to the new meter's usage", () => {
    const r = calcMeter({ ...m, mainSwap: { oldEnd: 1200, newStart: 0 }, mainCurr: 300 }, 18);
    expect(r.main).toBe(200 + 300);
    expect(r.b).toBe(500 - 200);
  });
  it("the sub-meter can be replaced on its own", () => {
    expect(calcMeter({ ...m, aSwap: { oldEnd: 250, newStart: 10 }, aCurr: 160 }, 18).a).toBe(50 + 150);
  });
});

describe("summaryText", () => {
  const s = { nameA: "יחידה קטנה", nameB: "יחידה גדולה", vatRate: 18 };
  const p: Period = { ...newPeriod(undefined, 18, new Date(2026, 0, 1)), elec: { ...m, vat: false, fixed: 0 }, water: { ...m, vat: false, fixed: 0 } };
  it("greets the tenant by name and names the sub-meter by its unit", () => {
    const text = summaryText(p, s, "b", "משה");
    expect(text).toContain("שלום משה,");
    expect(text).toContain("מונה יחידה קטנה:");
  });
  it("leaves out the connection-fee line when there is no fee", () => {
    expect(summaryText(p, s, "a")).not.toContain("התשלום הקבוע");
  });
});

describe("localISO", () => {
  it("keeps the local calendar day just after midnight", () => {
    expect(localISO(new Date(2026, 9, 1, 0, 30))).toBe("2026-10-01");
  });
});

describe("paidAmount", () => {
  const pay = { paid: true, amount: 0, date: "", notes: "" };
  it("paid without an amount counts as the full total", () => expect(paidAmount(pay, 120)).toBe(120));
  it("partial payment counts as given", () => expect(paidAmount({ ...pay, amount: 50 }, 120)).toBe(50));
  it("unpaid counts as zero even with an amount", () => expect(paidAmount({ ...pay, paid: false, amount: 50 }, 120)).toBe(0));
});

describe("newPeriod", () => {
  const today = new Date(2026, 9, 9);
  it("first period starts on the 1st of the current month", () => {
    const p = newPeriod(undefined, 18, today);
    expect(p.start).toBe("2026-10-01");
    expect(p.end).toBe("2026-10-09");
    expect(p.vatRate).toBe(18);
  });
  it("monthly period continues with the next month", () => {
    const prev = { ...newPeriod(undefined, 18, today), start: "2026-08-01", end: "2026-08-31" };
    expect(newPeriod(prev, 18, today)).toMatchObject({ start: "2026-09-01", end: "2026-09-30" });
  });
  it("two-month period continues with the next two months", () => {
    const prev = { ...newPeriod(undefined, 18, today), start: "2026-11-01", end: "2026-12-31" };
    expect(newPeriod(prev, 18, today)).toMatchObject({ start: "2027-01-01", end: "2027-02-28" });
  });
  it("custom range starts the day after the previous one ends", () => {
    const prev = { ...newPeriod(undefined, 18, today), start: "2026-08-15", end: "2026-09-14" };
    expect(newPeriod(prev, 18, today)).toMatchObject({ start: "2026-09-15", end: "2026-10-09" });
  });
  it("carries the previous current readings as the new previous readings", () => {
    const prev = newPeriod(undefined, 18, today);
    prev.elec = { ...prev.elec, mainCurr: 1500, aCurr: 400 };
    const next = newPeriod(prev, 18, today);
    expect(next.elec).toMatchObject({ mainPrev: 1500, aPrev: 400 });
  });
});

describe("period VAT", () => {
  const base = (vatRate?: number): Period => ({
    ...newPeriod(undefined, vatRate, new Date(2026, 0, 1)),
    elec: { ...m, vat: true },
  });
  it("a period with its own rate ignores the settings rate", () => {
    expect(calcPeriod(base(17), 18).totalA).toBe(calcPeriod(base(17), 17).totalA);
  });
  it("older periods without a rate fall back to the settings rate", () => {
    expect(calcPeriod(base(undefined), 18).totalA).toBe(calcPeriod(base(18), 0).totalA);
  });
});

describe("rateFromBill", () => {
  it("divides the bill by the main-meter usage", () => expect(rateFromBill(545.2, 58.4)).toBe(9.3356));
  it("needs both a bill and usage", () => {
    expect(rateFromBill(0, 58)).toBeNull();
    expect(rateFromBill(500, 0)).toBeNull();
  });
});
