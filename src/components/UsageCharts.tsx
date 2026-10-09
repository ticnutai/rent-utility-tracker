import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { calcPeriod, fmtDate, ils, type Period } from "@/lib/billing";
import { periodLabel } from "@/lib/periodLabel";
import type { FullSettings } from "@/lib/data";

type Row = { label: string; a: number; b: number };

const shortLabel = (p: Period) => periodLabel(p.start, p.end) ?? `${fmtDate(p.start)}–${fmtDate(p.end)}`;

/** One chart per measure (never two scales on one axis); apartments are the two series. */
export function UsageCharts({ periods, settings }: { periods: Period[]; settings: FullSettings }) {
  if (periods.length === 0) return null;
  const ordered = [...periods].sort((x, y) => x.start.localeCompare(y.start));
  const rows = ordered.map((p) => ({ p, c: calcPeriod(p, settings.vatRate) }));
  const charts: { title: string; unit: string; money?: boolean; data: Row[] }[] = [
    { title: "צריכת חשמל", unit: 'קוט"ש', data: rows.map(({ p, c }) => ({ label: shortLabel(p), a: c.elec.a, b: c.elec.b })) },
    { title: "צריכת מים", unit: "קוב", data: rows.map(({ p, c }) => ({ label: shortLabel(p), a: c.water.a, b: c.water.b })) },
    { title: "סה״כ חיוב", unit: "₪", money: true, data: rows.map(({ p, c }) => ({ label: shortLabel(p), a: c.totalA, b: c.totalB })) },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {charts.map((chart) => (
        <section key={chart.title} className="rounded-2xl border bg-card p-4 text-card-foreground">
          <h2 className="mb-3 text-base font-bold">
            {chart.title} <span className="text-sm font-normal text-muted-foreground">({chart.unit})</span>
          </h2>
          <div className="h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart.data} barGap={2} barCategoryGap="25%" margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                {/* Right-to-left: time runs from the right edge, values sit on the right axis. */}
                <XAxis dataKey="label" reversed tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
                <YAxis orientation="right" width={52} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)", direction: "rtl", textAlign: "right" }}
                  formatter={(v: number) => (chart.money ? ils(v) : `${v} ${chart.unit}`)}
                />
                <Legend wrapperStyle={{ direction: "rtl", fontSize: 12, color: "var(--foreground)" }} />
                <Bar dataKey="a" name={settings.nameA} fill="var(--apt-a)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="b" name={settings.nameB} fill="var(--apt-b)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      ))}
    </div>
  );
}
