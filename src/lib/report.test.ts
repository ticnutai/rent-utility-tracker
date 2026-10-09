import { describe, it, expect } from "vitest";
import { newPeriod, type Period } from "./billing";
import { latestBefore, missingMonths, yearlyReport } from "./report";

const mk = (start: string, end: string, mainCurr = 0, aCurr = 0): Period => {
  const p = newPeriod();
  return { ...p, start, end, elec: { ...p.elec, mainCurr, aCurr } };
};

describe("missingMonths", () => {
  const periods = [mk("2026-01-01", "2026-02-28"), mk("2026-04-01", "2026-04-30")];
  it("lists past months without a bill, excluding current month", () => {
    expect(missingMonths(periods, 2026, new Date(2026, 5, 15))).toEqual([2, 4]);
  });
  it("covers whole year for past years and nothing for future", () => {
    expect(missingMonths([], 2025, new Date(2026, 0, 1))).toHaveLength(12);
    expect(missingMonths([], 2027, new Date(2026, 0, 1))).toEqual([]);
  });
});

describe("latestBefore", () => {
  it("picks the most recent period ending before the new start", () => {
    const a = mk("2026-01-01", "2026-01-31", 100, 40);
    const b = mk("2026-03-01", "2026-03-31", 300, 90);
    expect(latestBefore([b, a], "2026-02-01")).toBe(a);
    expect(latestBefore([a, b])).toBe(b);
    expect(newPeriod(latestBefore([a, b])).elec.mainPrev).toBe(300);
    expect(newPeriod(latestBefore([a, b])).elec.aPrev).toBe(90);
  });
});

describe("yearlyReport", () => {
  it("only includes the requested year", () => {
    const r = yearlyReport([mk("2026-01-01", "2026-01-31"), mk("2025-05-01", "2025-05-31")], { nameA: "א", nameB: "ב", vatRate: 18 }, 2026);
    expect(r.count).toBe(1);
  });
});
