import { describe, expect, it } from "vitest";
import type { Contract } from "./data";
import { contractForMonth, effectiveEnd, expiringContracts, openRent, rentMonth, rentReminderText, rentYear, type RentPayment } from "./rent";

const contract = (over: Partial<Contract> = {}): Contract => ({
  id: "c1",
  apartment: "a",
  tenant_name: "דייר",
  tenant_phone: "",
  tenant_id_number: "",
  landlord_name: "",
  landlord_id_number: "",
  start_date: "2026-01-01",
  end_date: "2026-06-30",
  monthly_rent: 4000,
  option_months: 3,
  option_rent: 4200,
  option_exercised: false,
  occupants: 0,
  area_m2: 0,
  arnona_included: true,
  notes: "",
  file_path: null,
  file_name: null,
  ...over,
});

const pay = (over: Partial<RentPayment> = {}): RentPayment => ({
  id: "p1",
  apartment: "a",
  month: "2026-03-01",
  amount_due: 4000,
  amount_paid: 0,
  paid: true,
  paid_date: "2026-03-02",
  notes: "",
  ...over,
});

const today = new Date(2026, 9, 9);

describe("contractForMonth", () => {
  it("regular month uses the monthly rent", () => {
    expect(contractForMonth([contract()], "a", "2026-03-01")).toMatchObject({ inOption: false, due: 4000 });
  });
  it("months after the end within the option use the option rent", () => {
    expect(contractForMonth([contract()], "a", "2026-08-01")).toMatchObject({ inOption: true, due: 4200 });
  });
  it("nothing before the start, after the option, or for the other apartment", () => {
    expect(contractForMonth([contract()], "a", "2025-12-01")).toBeUndefined();
    expect(contractForMonth([contract()], "a", "2026-10-01")).toBeUndefined();
    expect(contractForMonth([contract()], "b", "2026-03-01")).toBeUndefined();
  });
});

describe("rentMonth", () => {
  it("paid without an amount counts as paid in full", () => {
    expect(rentMonth([contract()], [pay()], "a", "2026-03-01", today)).toMatchObject({ status: "paid", balance: 0 });
  });
  it("partial payment leaves the remainder", () => {
    const r = rentMonth([contract()], [pay({ paid: false, amount_paid: 1500 })], "a", "2026-03-01", today);
    expect(r).toMatchObject({ status: "partial", balance: 2500 });
  });
  it("unpaid past month is late after the grace days, open before", () => {
    expect(rentMonth([contract()], [], "a", "2026-03-01", today).status).toBe("late");
    expect(rentMonth([contract()], [], "a", "2026-03-01", new Date(2026, 2, 5)).status).toBe("open");
  });
  it("future months are not owed yet", () => {
    expect(rentMonth([contract({ end_date: "2027-12-31" })], [], "a", "2026-11-01", today)).toMatchObject({ status: "future", balance: 0 });
  });
  it("option months are not owed until a payment is recorded", () => {
    expect(rentMonth([contract()], [], "a", "2026-08-01", today)).toMatchObject({ status: "option", balance: 0 });
  });
  it("an exercised option is owed like a regular month, at the option rent", () => {
    expect(rentMonth([contract({ option_exercised: true })], [], "a", "2026-08-01", today)).toMatchObject({ status: "late", balance: 4200 });
  });
  it("a recorded month keeps its own amount due", () => {
    const r = rentMonth([contract({ monthly_rent: 5000 })], [pay({ paid: false, amount_due: 4000 })], "a", "2026-03-01", today);
    expect(r.due).toBe(4000);
  });
});

describe("rentYear and openRent", () => {
  it("returns 12 months", () => expect(rentYear([contract()], [], "a", 2026, today)).toHaveLength(12));
  it("lists only months with money owed", () => {
    const open = openRent([contract()], [pay(), pay({ month: "2026-01-01" })], today);
    expect(open.map((r) => r.month)).toEqual(["2026-02-01", "2026-04-01", "2026-05-01", "2026-06-01"]);
  });
  it("reminder lists the months and the total", () => {
    const text = rentReminderText("דייר", openRent([contract()], [], today).slice(0, 2));
    expect(text).toContain("ינואר 2026");
    expect(text).toContain("8,000.00");
  });
});

describe("expiringContracts", () => {
  it("finds contracts ending within the window, soonest first", () => {
    const list = expiringContracts(
      [contract({ id: "x", end_date: "2026-11-30" }), contract({ id: "y", end_date: "2026-10-20" }), contract({ id: "z", end_date: "2027-05-01" })],
      today,
    );
    expect(list.map((e) => [e.contract.id, e.daysLeft])).toEqual([["y", 11], ["x", 52]]);
  });
  it("an exercised option moves the end to the option's end", () => {
    const c = contract({ end_date: "2026-10-31", option_months: 12, option_exercised: true });
    expect(effectiveEnd(c)).toBe("2027-10-31");
    expect(expiringContracts([c], today)).toEqual([]);
  });
});
