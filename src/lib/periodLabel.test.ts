import { describe, expect, it } from "vitest";
import { monthRange, periodLabel } from "./periodLabel";

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
