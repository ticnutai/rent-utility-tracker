import type { Contract } from "./data";
import { ils, localISO } from "./billing";
import { HE_MONTHS } from "./periodLabel";

export type Apartment = "a" | "b";

export type RentPayment = {
  id: string;
  apartment: Apartment;
  /** First day of the month, YYYY-MM-01. */
  month: string;
  amount_due: number;
  amount_paid: number;
  paid: boolean;
  paid_date: string | null;
  notes: string;
};

/**
 * none: no contract covers the month. future: not due yet. option: inside the option
 * period, counted only once a payment is recorded (the option may not have been taken).
 */
export type RentStatus = "none" | "future" | "option" | "paid" | "partial" | "open" | "late";

export type RentMonth = {
  month: string;
  contract: Contract | undefined;
  inOption: boolean;
  due: number;
  payment: RentPayment | undefined;
  paidAmount: number;
  balance: number;
  status: RentStatus;
};

/** Rent is due on the 1st; it counts as late this many days later. */
export const RENT_LATE_DAYS = 10;

const pad = (n: number) => String(n).padStart(2, "0");
export const monthKey = (year: number, month: number) => `${year}-${pad(month + 1)}-01`;

function parse(iso: string) {
  const [y = 0, m = 1, d = 1] = iso.split("-").map(Number);
  return { y, m: m - 1, d };
}

const monthEnd = (month: string) => {
  const { y, m } = parse(month);
  return localISO(new Date(y, m + 1, 0));
};

const addMonths = (iso: string, n: number) => {
  const { y, m, d } = parse(iso);
  return localISO(new Date(y, m + n, d));
};

/** Last day the tenant is committed to: the option's end once it was exercised, else the contract end. */
export function effectiveEnd(c: Contract) {
  if (!c.end_date) return null;
  return c.option_exercised && c.option_months > 0 ? addMonths(c.end_date, c.option_months) : c.end_date;
}

/** The contract covering a month for an apartment, and whether the month falls in its option period. */
export function contractForMonth(contracts: Contract[], apt: Apartment, month: string) {
  const last = monthEnd(month);
  for (const c of contracts) {
    if (c.apartment !== apt || !c.start_date || c.start_date > last) continue;
    if (!c.end_date || c.end_date >= month) return { contract: c, inOption: false, due: Number(c.monthly_rent) || 0 };
    if (c.option_months > 0 && addMonths(c.end_date, c.option_months) >= month) {
      return { contract: c, inOption: true, due: Number(c.option_rent) || Number(c.monthly_rent) || 0 };
    }
  }
  return undefined;
}

/** A paid flag without an amount means paid in full; an amount without the flag is a partial payment. */
export const rentPaid = (p: RentPayment | undefined, due: number) =>
  !p ? 0 : p.paid ? Number(p.amount_paid) || due : Number(p.amount_paid) || 0;

export function rentMonth(contracts: Contract[], payments: RentPayment[], apt: Apartment, month: string, today = new Date()): RentMonth {
  const match = contractForMonth(contracts, apt, month);
  const payment = payments.find((p) => p.apartment === apt && p.month === month);
  // A recorded month keeps the amount that was due when it was recorded.
  const due = payment ? Number(payment.amount_due) || match?.due || 0 : match?.due ?? 0;
  const paidAmount = rentPaid(payment, due);
  const base = { month, contract: match?.contract, inOption: !!match?.inOption, due, payment, paidAmount };
  const now = localISO(today);
  const settle = (status: RentStatus): RentMonth => ({ ...base, status, balance: 0 });

  if (!match && !payment) return settle("none");
  const balance = Math.max(0, Math.round((due - paidAmount) * 100) / 100);
  if (balance <= 0.005 && payment) return settle("paid");
  if (month > now) return settle("future");
  // An option the tenant hasn't (yet) taken is only owed once a payment is recorded.
  if (match?.inOption && !match.contract.option_exercised && !payment) return settle("option");
  if (balance <= 0.005) return settle("paid");
  const lateFrom = `${month.slice(0, 8)}${pad(RENT_LATE_DAYS + 1)}`;
  const status: RentStatus = paidAmount > 0 ? "partial" : now >= lateFrom ? "late" : "open";
  return { ...base, status, balance };
}

export function rentYear(contracts: Contract[], payments: RentPayment[], apt: Apartment, year: number, today = new Date()) {
  return HE_MONTHS.map((_, m) => rentMonth(contracts, payments, apt, monthKey(year, m), today));
}

/** Every month with money still owed, from the first contract up to the current month. */
export function openRent(contracts: Contract[], payments: RentPayment[], today = new Date()) {
  const starts = contracts.map((c) => c.start_date).filter((d): d is string => !!d).sort();
  if (!starts[0]) return [];
  const out: (RentMonth & { apartment: Apartment })[] = [];
  const first = parse(starts[0]);
  for (let i = 0; ; i++) {
    const d = new Date(first.y, first.m + i, 1);
    if (d > today) break;
    const month = monthKey(d.getFullYear(), d.getMonth());
    for (const apt of ["a", "b"] as const) {
      const r = rentMonth(contracts, payments, apt, month, today);
      if (r.balance > 0.005) out.push({ ...r, apartment: apt });
    }
  }
  return out;
}

export const monthLabel = (month: string) => {
  const { y, m } = parse(month);
  return `${HE_MONTHS[m]} ${y}`;
};

export function rentReminderText(name: string, months: RentMonth[]) {
  const total = months.reduce((s, r) => s + r.balance, 0);
  return [
    `שלום ${name},`,
    `תזכורת ידידותית: נשארה יתרת שכר דירה פתוחה.`,
    ``,
    ...months.map((r) => `• ${monthLabel(r.month)}: ${ils(r.balance)}`),
    ``,
    `💰 *סה"כ: ${ils(total)}*`,
    `תודה!`,
  ].join("\n");
}

/** Contracts ending within `days` days (an exercised option counts as the end), soonest first. */
export function expiringContracts(contracts: Contract[], today = new Date(), days = 60) {
  const now = localISO(today);
  const limit = localISO(new Date(today.getFullYear(), today.getMonth(), today.getDate() + days));
  return contracts
    .map((c) => ({ contract: c, end: effectiveEnd(c) }))
    .filter((x): x is { contract: Contract; end: string } => !!x.end && x.end >= now && x.end <= limit)
    .map(({ contract, end }) => ({
      contract,
      end,
      daysLeft: Math.round((Date.parse(`${end}T00:00:00`) - Date.parse(`${now}T00:00:00`)) / 86400000),
    }))
    .sort((a, b) => a.daysLeft - b.daysLeft);
}
