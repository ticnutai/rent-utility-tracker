import { describe, expect, it } from "vitest";
import type { Contract } from "./data";
import { calcMeter, calcPeriod, newPeriod, summaryText, type Period } from "./billing";
import { applyOfficialTariffs, daysIn, prorate, type Tariff } from "./tariffs";

const t = (kind: Tariff["kind"], value: number, valid_from: string): Tariff => ({ id: `${kind}-${valid_from}`, kind, value, valid_from, source: "", notes: "" });

const tariffs: Tariff[] = [
  t("elec_kwh", 0.6432, "2026-01-01"),
  t("elec_kwh", 0.6352, "2026-07-01"),
  t("elec_fixed_month", 30, "2026-01-01"),
  t("water_low", 8.5, "2026-01-01"),
  t("water_high", 15.6, "2026-01-01"),
  t("water_quota", 3.5, "2020-01-01"),
  t("arnona_m2_year", 60, "2026-01-01"),
];

const contract = (over: Partial<Contract>): Contract => ({
  id: "c", apartment: "a", tenant_name: "", tenant_phone: "", tenant_id_number: "", landlord_name: "", landlord_id_number: "",
  start_date: "2025-01-01", end_date: "2027-12-31", monthly_rent: 0, option_months: 0, option_rent: 0, option_exercised: false,
  occupants: 0, area_m2: 0, arnona_included: true, notes: "", file_path: null, file_name: null, ...over,
});

describe("prorate", () => {
  it("weights each version by the days it was in effect", () => {
    const pr = prorate(tariffs, "elec_kwh", "2026-06-01", "2026-07-31")!;
    expect(pr.parts.map((x) => [x.value, x.days])).toEqual([[0.6432, 30], [0.6352, 31]]);
    expect(pr.value).toBe(Math.round(((0.6432 * 30 + 0.6352 * 31) / 61) * 10000) / 10000);
    expect(pr.missing).toBe(false);
  });
  it("flags a range that starts before the earliest version", () => {
    expect(prorate(tariffs, "elec_kwh", "2025-11-02", "2026-03-14")!.missing).toBe(true);
  });
  it("counts days inclusively", () => expect(daysIn("2026-01-01", "2026-01-31")).toBe(31));
  it("stretches at the same price are reported once", () => {
    expect(prorate(tariffs, "elec_kwh", "2025-11-02", "2026-03-14")!.parts).toHaveLength(1);
  });
});

describe("tiers and splits", () => {
  const water = { mainPrev: 18, mainCurr: 76.4, aPrev: 0, aCurr: 0, rate: 0, vat: false, fixed: 0 };
  it("splits a shared meter by occupants", () => {
    const r = calcMeter({ ...water, split: "persons", personsA: 1, personsB: 3 }, 18);
    expect([r.a, r.b]).toEqual([14.6, 43.8]);
  });
  it("bills the quota at the low price and the rest at the high price", () => {
    const r = calcMeter({ ...water, split: "half", tiers: { low: 8.5, high: 15.6, quotaA: 20, quotaB: 40 } }, 18);
    expect(r.tierA).toEqual({ lowQty: 20, highQty: 9.2 });
    expect(r.costA).toBe(Math.round((20 * 8.5 + 9.2 * 15.6) * 100) / 100);
    expect(r.tierB).toEqual({ lowQty: 29.2, highQty: 0 });
  });
});

describe("applyOfficialTariffs", () => {
  const base: Period = {
    ...newPeriod(undefined, 18, new Date(2026, 0, 1)),
    start: "2026-01-01",
    end: "2026-02-28",
    elec: { mainPrev: 0, mainCurr: 1000, aPrev: 0, aCurr: 400, rate: 0, vat: true, fixed: 0 },
    water: { mainPrev: 0, mainCurr: 30, aPrev: 0, aCurr: 0, rate: 0, vat: true, fixed: 0 },
  };
  const contracts = [contract({ apartment: "a", occupants: 1, area_m2: 30, arnona_included: false }), contract({ id: "d", apartment: "b", occupants: 3 })];

  it("prices electricity, water tiers and municipal tax from the tariffs", () => {
    const { period, warnings } = applyOfficialTariffs(base, contracts, tariffs, "persons");
    expect(warnings).toEqual([]);
    expect(period.elec).toMatchObject({ rate: 0.6432, vat: false });
    expect(period.elec.fixed).toBeCloseTo(30 * (59 / (365 / 12)), 2);
    expect(period.water.tiers?.quotaA).toBeCloseTo(1 * 3.5 * (59 / (365 / 12)), 2);
    expect(period.arnona).toEqual({ a: Math.round(((30 * 60 * 59) / 365) * 100) / 100, b: 0 });
    const c = calcPeriod(period, 18);
    expect(c.water.a).toBe(7.5);
    expect(c.totalA).toBe(Math.round((c.elec.costA + c.water.costA + c.arnonaA) * 100) / 100);
  });
  it("falls back to two occupants when none were entered, and says so", () => {
    const { period, warnings } = applyOfficialTariffs(base, [], tariffs, "half");
    expect(period.water.personsA).toBe(2);
    expect(warnings.some((w) => w.includes("נפשות"))).toBe(true);
  });
  it("the tenant's message shows the tiers and the municipal tax", () => {
    const { period } = applyOfficialTariffs(base, contracts, tariffs, "persons");
    const text = summaryText(period, { nameA: "קטנה", nameB: "גדולה", vatRate: 18 }, "a");
    expect(text).toContain("בתעריף המוזל");
    expect(text).toContain("ארנונה לתקופה");
    expect(text).toContain("חלוקה לפי נפשות");
  });
});
