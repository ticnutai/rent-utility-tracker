import { describe, expect, it } from "vitest";
import { monthRange, periodLabel, shiftPeriod, rangesOverlap, detectPeriodMode } from "./periodLabel";

describe("monthRange", () => {
  it("single month fills 1st to last day", () => {
    expect(monthRange(2026, 8, 1)).toEqual({ start: "2026-09-01", end: "2026-09-30" });
  });
  it("bi-monthly covers both months", () => {
    expect(monthRange(2026, 6, 2)).toEqual({ start: "2026-07-01", end: "2026-08-31" });
  });
  it("bi-monthly crosses year end", () => {
    expect(monthRange(2025, 11, 2)).toEqual({ start: "2025-12-01", end: "2026-01-31" });
  });
  it("handles leap February", () => {
    expect(monthRange(2028, 1, 1).end).toBe("2028-02-29");
  });
});

describe("periodLabel", () => {
  it("names a full month", () => expect(periodLabel("2026-09-01", "2026-09-30")).toBe("ספטמבר 2026"));
  it("names a month pair", () => expect(periodLabel("2026-07-01", "2026-08-31")).toBe("יולי–אוגוסט 2026"));
  it("partial month has no name", () => expect(periodLabel("2026-09-05", "2026-09-30")).toBeNull());
});

describe("period navigation", () => {
  it("advances a single month across year end", () => {
    expect(shiftPeriod("2026-12-01", "2026-12-31", "single", 1)).toEqual({ start: "2027-01-01", end: "2027-01-31" });
  });
  it("moves a month pair back by two months", () => {
    expect(shiftPeriod("2026-01-01", "2026-02-28", "bi", -1)).toEqual({ start: "2025-11-01", end: "2025-12-31" });
  });
  it("advances custom ranges by the same inclusive number of days", () => {
    expect(shiftPeriod("2026-09-05", "2026-09-14", "custom", 1)).toEqual({ start: "2026-09-15", end: "2026-09-24" });
    expect(shiftPeriod("2026-09-05", "2026-09-14", "custom", -1)).toEqual({ start: "2026-08-26", end: "2026-09-04" });
  });
  it("keeps leap February a full calendar month", () => {
    expect(shiftPeriod("2028-01-01", "2028-01-31", "single", 1)).toEqual({ start: "2028-02-01", end: "2028-02-29" });
  });
  it("detects all three modes", () => {
    expect(detectPeriodMode("2026-09-01", "2026-09-30")).toBe("single");
    expect(detectPeriodMode("2026-07-01", "2026-08-31")).toBe("bi");
    expect(detectPeriodMode("2026-07-05", "2026-08-04")).toBe("custom");
  });
  it("shows a cross-year period in every covered month", () => {
    expect(rangesOverlap("2025-12-01", "2026-01-31", "2026-01-01", "2026-01-31")).toBe(true);
    expect(rangesOverlap("2025-12-01", "2026-01-31", "2026-02-01", "2026-02-28")).toBe(false);
  });
});
