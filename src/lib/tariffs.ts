import type { Contract } from "./data";
import { calcMeter, ils, type MeterSplit, type Period } from "./billing";
import { contractForRange } from "./rent";

export type TariffKind = "elec_kwh" | "elec_fixed_month" | "water_low" | "water_high" | "water_quota" | "arnona_m2_year";

export type Tariff = {
  id: string;
  kind: TariffKind;
  value: number;
  valid_from: string;
  source: string;
  notes: string;
};

export const TARIFF_KINDS: { kind: TariffKind; label: string; unit: string }[] = [
  { kind: "elec_kwh", label: "חשמל – מחיר לקוט\"ש", unit: "₪ לקוט\"ש כולל מע\"מ" },
  { kind: "elec_fixed_month", label: "חשמל – תשלום קבוע", unit: "₪ לחודש כולל מע\"מ" },
  { kind: "water_low", label: "מים – תעריף מוזל", unit: "₪ לקוב כולל מע\"מ" },
  { kind: "water_high", label: "מים – מעל המכסה", unit: "₪ לקוב כולל מע\"מ" },
  { kind: "water_quota", label: "מים – מכסה מוזלת", unit: "קוב לנפש לחודש" },
  { kind: "arnona_m2_year", label: "ארנונה", unit: "₪ למ\"ר לשנה" },
];

/** A household that didn't declare its occupants is counted as two people by the water rules. */
export const DEFAULT_OCCUPANTS = 2;

const DAY = 86400000;
const toMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const toISO = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const r2 = (n: number) => Math.round(n * 100) / 100;
const r4 = (n: number) => Math.round(n * 10000) / 10000;

/** Inclusive day count of a date range. */
export const daysIn = (start: string, end: string) => Math.round((toMs(end) - toMs(start)) / DAY) + 1;
/** Months in a range, by days (a bi-monthly bill is ~2). */
export const monthsIn = (start: string, end: string) => daysIn(start, end) / (365 / 12);

export type Proration = {
  /** Day-weighted average of the versions in effect over the range. */
  value: number;
  parts: { from: string; to: string; value: number; days: number }[];
  /** Part of the range falls before the earliest known version (that version was used). */
  missing: boolean;
};

/** Tariff of `kind` over [start, end], weighted by the days each dated version was in effect. */
export function prorate(tariffs: Tariff[], kind: TariffKind, start: string, end: string): Proration | null {
  const versions = tariffs.filter((t) => t.kind === kind).sort((a, b) => a.valid_from.localeCompare(b.valid_from));
  if (!versions.length || end < start) return null;
  const at = (day: string) => [...versions].reverse().find((v) => v.valid_from <= day) ?? versions[0]!;
  const cuts = versions.map((v) => v.valid_from).filter((d) => d > start && d <= end);
  const bounds = [start, ...cuts];
  const parts: Proration["parts"] = [];
  bounds.forEach((from, i) => {
    const to = i + 1 < bounds.length ? toISO(toMs(bounds[i + 1]!) - DAY) : end;
    const value = Number(at(from).value);
    const last = parts[parts.length - 1];
    // Neighbouring stretches at the same price are one stretch.
    if (last && last.value === value) Object.assign(last, { to, days: last.days + daysIn(from, to) });
    else parts.push({ from, to, value, days: daysIn(from, to) });
  });
  const total = parts.reduce((s, p) => s + p.days, 0);
  return {
    value: r4(parts.reduce((s, p) => s + p.value * p.days, 0) / total),
    parts,
    missing: versions[0]!.valid_from > start,
  };
}

export type OfficialResult = {
  period: Period;
  lines: string[];
  warnings: string[];
};

/**
 * Re-prices a period with the official tariffs: electricity per kWh plus the fixed charge,
 * water in tiers by each unit's occupants, and municipal tax for units whose rent excludes it.
 * Readings are untouched; `waterSplit` decides A's water share when there is no water sub-meter.
 */
export function applyOfficialTariffs(p: Period, contracts: Contract[], tariffs: Tariff[], waterSplit: MeterSplit): OfficialResult {
  const lines: string[] = [];
  const warnings: string[] = [];
  const months = monthsIn(p.start, p.end);
  const days = daysIn(p.start, p.end);
  const get = (kind: TariffKind, label: string) => {
    const pr = prorate(tariffs, kind, p.start, p.end);
    if (!pr) warnings.push(`אין תעריף "${label}" – התעריף הקיים בתקופה נשאר`);
    else if (pr.missing) warnings.push(`"${label}": אין תעריף לתחילת התקופה, נעשה שימוש בתעריף הוותיק ביותר (${pr.parts[0]!.value})`);
    return pr;
  };
  const describe = (pr: Proration, unit: string) =>
    pr.parts.length > 1 ? pr.parts.map((x) => `${x.value} ${unit} × ${x.days} ימים`).join(" + ") + ` = ממוצע ${pr.value}` : `${pr.value} ${unit}`;

  const next: Period = { ...p, elec: { ...p.elec }, water: { ...p.water } };

  // Electricity: price per kWh and the bill's fixed charge (split half-half), all incl. VAT.
  const kwh = get("elec_kwh", "חשמל – מחיר לקוט\"ש");
  const fixedMonth = get("elec_fixed_month", "חשמל – תשלום קבוע");
  if (kwh) {
    next.elec.rate = kwh.value;
    next.elec.vat = false;
    lines.push(`חשמל: ${describe(kwh, "₪ לקוט\"ש")}`);
  }
  if (fixedMonth) {
    next.elec.fixed = r2(fixedMonth.value * months);
    lines.push(`תשלום קבוע לחשמל: ${fixedMonth.value} ₪ לחודש × ${months.toFixed(2)} חודשים = ${ils(next.elec.fixed)} (חצי לכל יחידה)`);
  }

  // Water: each unit's discounted quota comes from its occupants.
  const cA = contractForRange(contracts, "a", p.start, p.end);
  const cB = contractForRange(contracts, "b", p.start, p.end);
  const persons = (c: Contract | undefined, name: string) => {
    if (c && c.occupants > 0) return c.occupants;
    warnings.push(`לא הוזן מספר נפשות ל${name} – לפי ברירת המחדל של רשות המים נחשבות ${DEFAULT_OCCUPANTS} נפשות`);
    return DEFAULT_OCCUPANTS;
  };
  const pA = persons(cA, "יחידה א'"), pB = persons(cB, "יחידה ב'");
  const low = get("water_low", "מים – תעריף מוזל");
  const high = get("water_high", "מים – מעל המכסה");
  const quota = get("water_quota", "מים – מכסה מוזלת");
  next.water.split = waterSplit;
  next.water.personsA = pA;
  next.water.personsB = pB;
  if (low && high && quota) {
    const q = (n: number) => r2(n * quota.value * months);
    next.water.tiers = { low: low.value, high: high.value, quotaA: q(pA), quotaB: q(pB) };
    next.water.vat = false;
    lines.push(`מים: מוזל ${describe(low, "₪")}, מעל המכסה ${describe(high, "₪")}`);
    lines.push(`מכסה מוזלת: ${quota.value} קוב לנפש לחודש × ${months.toFixed(2)} חודשים → יחידה א' (${pA} נפשות) ${q(pA)} קוב, יחידה ב' (${pB} נפשות) ${q(pB)} קוב`);
  }
  if (waterSplit === "half") lines.push("חלוקת המים: חצי־חצי");
  if (waterSplit === "persons") lines.push(`חלוקת המים לפי נפשות: ${pA} מול ${pB}`);

  // Municipal tax: area × yearly rate × share of the year, only where the rent doesn't include it.
  const needsArnona = [cA, cB].some((c) => c && !c.arnona_included);
  const arnonaRate = needsArnona ? get("arnona_m2_year", "ארנונה") : null;
  const arnonaFor = (c: Contract | undefined, name: string) => {
    if (!c || c.arnona_included || !arnonaRate) return 0;
    if (!(c.area_m2 > 0)) { warnings.push(`לא הוזן שטח ל${name} – לא חושבה ארנונה`); return 0; }
    const amount = r2((c.area_m2 * arnonaRate.value * days) / 365);
    lines.push(`ארנונה ל${name}: ${c.area_m2} מ"ר × ${arnonaRate.value} ₪ לשנה × ${days}/365 ימים = ${ils(amount)}`);
    return amount;
  };
  const arnona = { a: arnonaFor(cA, "יחידה א'"), b: arnonaFor(cB, "יחידה ב'") };
  if (arnona.a || arnona.b) next.arnona = arnona;
  else delete next.arnona;

  // Sanity: the split must not leave a unit with negative water.
  const w = calcMeter(next.water, 0);
  if (w.b < 0) warnings.push("צריכת המים של יחידה א' גבוהה מהמונה הראשי – לבדוק את הקריאות");

  return { period: next, lines, warnings };
}
