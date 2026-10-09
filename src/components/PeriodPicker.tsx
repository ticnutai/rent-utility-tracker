import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HE_MONTHS, monthRange, periodLabel } from "@/lib/periodLabel";

type Mode = "single" | "bi" | "custom";

function detectMode(start: string, end: string): Mode {
  const l = periodLabel(start, end);
  if (!l) return "custom";
  return l.includes("–") ? "bi" : "single";
}

const selectCls = "h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground";

export function PeriodPicker({ start, end, onChange }: { start: string; end: string; onChange: (s: string, e: string) => void }) {
  const [mode, setMode] = useState<Mode>(() => detectMode(start, end));
  const year = Number(start?.slice(0, 4)) || new Date().getFullYear();
  const month = start ? Number(start.slice(5, 7)) - 1 : new Date().getMonth();
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 12 }, (_, i) => thisYear + 1 - i);

  const apply = (m: Mode, y: number, mo: number) => {
    if (m === "custom") return;
    const r = monthRange(y, mo, m === "bi" ? 2 : 1);
    onChange(r.start, r.end);
  };
  const switchMode = (m: Mode) => { setMode(m); apply(m, year, month); };

  const modes: [Mode, string][] = [["single", "חודש בודד"], ["bi", "דו-חודשי"], ["custom", "תאריכים מותאמים"]];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
        {modes.map(([m, l]) => (
          <button key={m} type="button" onClick={() => switchMode(m)}
            className={`rounded-lg py-2 text-xs transition-colors ${mode === m ? "bg-card font-semibold text-foreground shadow-sm" : "text-muted-foreground"}`}>
            {l}
          </button>
        ))}
      </div>

      {mode !== "custom" ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{mode === "bi" ? "צמד חודשים" : "חודש"}</Label>
            <select className={selectCls} value={month} onChange={(e) => apply(mode, year, Number(e.target.value))}>
              {HE_MONTHS.map((n, i) => (
                <option key={i} value={i}>{mode === "bi" ? `${n}–${HE_MONTHS[(i + 1) % 12]}` : n}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">שנה</Label>
            <select className={selectCls} value={year} onChange={(e) => apply(mode, Number(e.target.value), month)}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">מתאריך</Label>
            <Input type="date" className="h-11" value={start} onChange={(e) => onChange(e.target.value, end)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">עד תאריך</Label>
            <Input type="date" className="h-11" value={end} onChange={(e) => onChange(start, e.target.value)} />
          </div>
        </div>
      )}
      <PeriodTitle start={start} end={end} />
    </div>
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
