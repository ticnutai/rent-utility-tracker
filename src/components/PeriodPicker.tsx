import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { he } from "date-fns/locale";
import { format, parseISO } from "date-fns";
import { HE_MONTHS, monthRange, periodLabel, detectPeriodMode, shiftPeriod, type PeriodMode as Mode } from "@/lib/periodLabel";

const selectCls = "h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground";

export function PeriodPicker({ start, end, onChange }: { start: string; end: string; onChange: (s: string, e: string) => void }) {
  const [mode, setMode] = useState<Mode>(() => detectPeriodMode(start, end));
  const year = Number(start?.slice(0, 4)) || new Date().getFullYear();
  const month = start ? Number(start.slice(5, 7)) - 1 : new Date().getMonth();
  const thisYear = new Date().getFullYear();
  const years = [...new Set([year, ...Array.from({ length: 12 }, (_, i) => thisYear + 1 - i)])].sort((a, b) => b - a);

  const apply = (m: Mode, y: number, mo: number) => {
    if (m === "custom") return;
    const r = monthRange(y, mo, m === "bi" ? 2 : 1);
    onChange(r.start, r.end);
  };
  const switchMode = (m: Mode) => { setMode(m); apply(m, year, month); };

  const modes: [Mode, string][] = [["single", "חודש בודד"], ["bi", "דו-חודשי"], ["custom", "תאריכים מותאמים"]];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1 text-muted-foreground">
        {modes.map(([m, l]) => (
          <Button key={m} type="button" variant="ghost" onClick={() => switchMode(m)} aria-pressed={mode === m}
            className={`h-auto min-h-10 whitespace-normal px-1 py-2 text-xs ${mode === m ? "bg-card font-semibold text-card-foreground shadow-sm" : "text-muted-foreground"}`}>
            {l}
          </Button>
        ))}
      </div>

      {mode !== "custom" ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="period-month" className="text-xs text-muted-foreground">{mode === "bi" ? "צמד חודשים" : "חודש"}</Label>
            <select id="period-month" className={selectCls} value={month} onChange={(e) => apply(mode, year, Number(e.target.value))}>
              {HE_MONTHS.map((n, i) => (
                <option key={i} value={i}>{mode === "bi" ? `${n}–${HE_MONTHS[(i + 1) % 12]}` : n}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="period-year" className="text-xs text-muted-foreground">שנה</Label>
            <select id="period-year" className={selectCls} value={year} onChange={(e) => apply(mode, Number(e.target.value), month)}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">מתאריך</Label>
            <DateControl label="מתאריך" value={start} onChange={(value) => onChange(value, end)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">עד תאריך</Label>
            <DateControl label="עד תאריך" value={end} onChange={(value) => onChange(start, value)} />
          </div>
        </div>
      )}
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-t pt-3">
        <Button type="button" variant="outline" size="icon" aria-label="תקופה קודמת" title="תקופה קודמת" onClick={() => { const r = shiftPeriod(start, end, mode, -1); onChange(r.start, r.end); }}><ChevronRight /></Button>
        <PeriodTitle start={start} end={end} className="min-w-0 text-center" />
        <Button type="button" variant="outline" size="icon" aria-label="תקופה הבאה" title="תקופה הבאה" onClick={() => { const r = shiftPeriod(start, end, mode, 1); onChange(r.start, r.end); }}><ChevronLeft /></Button>
      </div>
    </div>
  );
}

function DateControl({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const date = value ? parseISO(value) : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild><Button type="button" variant="outline" aria-label={label} className="h-11 w-full justify-between px-2"><span>{value ? value.split("-").reverse().join("/") : "בחירת תאריך"}</span><CalendarIcon /></Button></PopoverTrigger>
      <PopoverContent className="pointer-events-auto w-auto p-0" align="start" dir="rtl">
        <Calendar locale={he} dir="rtl" mode="single" captionLayout="dropdown" selected={date} defaultMonth={date} startMonth={new Date(1990, 0)} endMonth={new Date(new Date().getFullYear() + 10, 11)} onSelect={(day) => { if (!day) return; onChange(format(day, "yyyy-MM-dd")); setOpen(false); }} />
      </PopoverContent>
    </Popover>
  );
}

export function PeriodTitle({ start, end, className = "" }: { start: string; end: string; className?: string }) {
  const label = periodLabel(start, end);
  const fmt = (s: string) => (s ? s.split("-").reverse().join("/") : "");
  return (
    <div className={className}>
      <div className="font-semibold text-foreground">{label ?? `${fmt(start)} – ${fmt(end)}`}</div>
      {label && <div className="text-xs text-muted-foreground">{fmt(start)} – {fmt(end)}</div>}
    </div>
  );
}
