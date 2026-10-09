import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HE_MONTHS, monthRange, rangesOverlap, type PeriodMode } from "@/lib/periodLabel";
import { calcPeriod, ils, type Period } from "@/lib/billing";
import type { FullSettings } from "@/lib/data";
import { PeriodTitle } from "@/components/PeriodPicker";

const weekdays = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

export function BillsCalendar({ periods, settings, year, onYearChange, onEdit, onCreate }: {
  periods: Period[];
  settings: FullSettings;
  year: number;
  onYearChange: (year: number) => void;
  onEdit: (period: Period) => void;
  onCreate: (start: string, end: string) => void;
}) {
  const [mode, setMode] = useState<PeriodMode>("single");
  const selectMonth = (month: number) => {
    const range = monthRange(year, mode === "bi" ? Math.floor(month / 2) * 2 : month, mode === "bi" ? 2 : 1);
    const existing = periods.find((p) => p.start === range.start && p.end === range.end);
    if (existing) onEdit(existing);
    else onCreate(range.start, range.end);
  };

  return (
    <section className="space-y-4" aria-label={`לוח שנה ${year}`}>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="outline" size="icon" aria-label="שנה קודמת" title="שנה קודמת" onClick={() => onYearChange(year - 1)}><ChevronRight /></Button>
          <Input type="number" aria-label="שנת לוח השנה" className="h-10 w-24 text-center font-semibold" value={year} min={1900} max={2200} onChange={(e) => { const y = Number(e.target.value); if (y >= 1900 && y <= 2200) onYearChange(y); }} />
          <Button variant="outline" size="icon" aria-label="שנה הבאה" title="שנה הבאה" onClick={() => onYearChange(year + 1)}><ChevronLeft /></Button>
          <Button variant="ghost" onClick={() => onYearChange(new Date().getFullYear())}>השנה</Button>
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1 text-muted-foreground">
          {([["single", "חודש בודד"], ["bi", "דו-חודשי"], ["custom", "תאריכים מותאמים"]] as const).map(([value, label]) => (
            <Button key={value} variant="ghost" aria-pressed={mode === value} className={`h-auto min-h-10 whitespace-normal px-2 py-2 text-xs ${mode === value ? "bg-card text-card-foreground shadow-sm" : "text-muted-foreground"}`} onClick={() => setMode(value)}>{label}</Button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {HE_MONTHS.map((name, month) => {
          const range = monthRange(year, month, 1);
          const entries = periods.filter((p) => rangesOverlap(p.start, p.end, range.start, range.end));
          const days = new Date(year, month + 1, 0).getDate();
          const offset = new Date(year, month, 1).getDay();
          return (
            <article key={month} className="min-w-0 rounded-lg border bg-card p-3 text-card-foreground" aria-label={`${name} ${year}`}>
              <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <Button variant="ghost" className="justify-start px-1 text-base font-bold" onClick={() => selectMonth(month)} aria-label={`פתיחת ${name} ${year}`}>{name}</Button>
                <Button variant="ghost" size="icon" aria-label={`הוספת תקופה ${name} ${year}`} title={`הוספת תקופה ${name}`} onClick={() => { const r = monthRange(year, mode === "bi" ? Math.floor(month / 2) * 2 : month, mode === "bi" ? 2 : 1); onCreate(r.start, r.end); }}><Plus /></Button>
              </div>
              <div className="grid grid-cols-7 text-center text-xs text-muted-foreground">{weekdays.map((day) => <span key={day} className="pb-2">{day}</span>)}</div>
              <div className="grid min-h-48 grid-cols-7 auto-rows-8 gap-y-1">
                {Array.from({ length: offset }, (_, i) => <span key={`blank-${i}`} />)}
                {Array.from({ length: days }, (_, i) => {
                  const day = i + 1;
                  const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const covered = entries.filter((p) => p.start <= date && p.end >= date);
                  const unpaid = covered.some((p) => !p.payA.paid || !p.payB.paid);
                  return <Button key={day} size="icon" variant="ghost" aria-label={`${day} ${name} ${year}`} title={covered.length ? `${covered.length} תקופות` : "תקופה חדשה"} className={`h-8 w-full min-w-0 rounded-md text-xs ${covered.length ? unpaid ? "bg-warning text-warning-foreground" : "bg-success text-success-foreground" : "text-card-foreground"}`} onClick={() => { const existing = covered[0]; if (existing) onEdit(existing); else if (mode === "custom") onCreate(date, date); else selectMonth(month); }}>{day}</Button>;
                })}
              </div>
              <div className="mt-3 space-y-2 border-t pt-3">
                {entries.length === 0 ? <span className="text-xs text-muted-foreground">אין חשבונות</span> : entries.map((p) => {
                  const totals = calcPeriod(p, settings.vatRate);
                  return <Button key={p.id} variant="ghost" className="h-auto w-full min-w-0 flex-col items-stretch gap-1 whitespace-normal p-2 text-start" onClick={() => onEdit(p)}>
                    <PeriodTitle start={p.start} end={p.end} className="text-xs" />
                    <span className="grid grid-cols-2 gap-2 text-xs"><span className="min-w-0 truncate">{settings.nameA}: {ils(totals.totalA)}</span><span className="min-w-0 truncate">{settings.nameB}: {ils(totals.totalB)}</span></span>
                    <span className={`self-start rounded px-2 py-0.5 text-xs ${p.payA.paid && p.payB.paid ? "bg-success text-success-foreground" : "bg-warning text-warning-foreground"}`}>{p.payA.paid && p.payB.paid ? "שולם" : "ממתין לתשלום"}</span>
                  </Button>;
                })}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}