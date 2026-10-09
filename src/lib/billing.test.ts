import { describe, expect, it } from "vitest";
import { calcMeter } from "./billing";

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
