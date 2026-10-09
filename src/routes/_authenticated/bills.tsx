import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { PeriodPicker, PeriodTitle } from "@/components/PeriodPicker";
import { BillsCalendar } from "@/components/BillsCalendar";
import { periodYear } from "@/lib/periodLabel";
import { toast } from "sonner";
import { Plus, Zap, Droplets, Copy, MessageCircle, Trash2, ChevronLeft, Check, Clock, LayoutGrid, Table2, Scale, CalendarDays } from "lucide-react";
import { periodsQuery, savePeriod, deletePeriod, settingsQuery, type FullSettings } from "@/lib/data";
import { calcPeriod, calcMeter, newPeriod, fmtDate, ils, summaryText, type Period, type Meter, type Payment } from "@/lib/billing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/bills")({
  head: () => ({ meta: [
    { title: "חשבונות ולוח שנה — ניהול דירות" },
    { name: "description", content: "ניהול תקופות חשמל ומים, לוח שנה שנתי, תשלומים והשוואה בין שתי הדירות." },
    { property: "og:title", content: "חשבונות ולוח שנה — ניהול דירות" },
    { property: "og:description", content: "חשבונות, תקופות ותשלומים לשתי דירות בתצוגת לוח שנה, כרטיסים וטבלה." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  loader: ({ context }) =>
    Promise.all([context.queryClient.ensureQueryData(periodsQuery), context.queryClient.ensureQueryData(settingsQuery)]),
  component: BillsPage,
});

type ViewMode = "cards" | "table" | "compare" | "calendar";

const viewModes: { id: ViewMode; label: string; icon: typeof LayoutGrid }[] = [
  { id: "cards", label: "כרטיסים", icon: LayoutGrid },
  { id: "table", label: "טבלה", icon: Table2 },
  { id: "compare", label: "השוואה", icon: Scale },
  { id: "calendar", label: "לוח שנה", icon: CalendarDays },
];

function BillsPage() {
  const { data: allPeriods } = useSuspenseQuery(periodsQuery);
  const years = [...new Set(allPeriods.map((p) => periodYear(p.start)))].sort((a, b) => b - a);
  const [year, setYear] = useState<number | "all">("all");
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const periods = year === "all" ? allPeriods : allPeriods.filter((p) => periodYear(p.start) === year);
  const { data: settings } = useSuspenseQuery(settingsQuery);
  const [editing, setEditing] = useState<{ p: Period; isNew: boolean } | null>(null);
  const [view, setView] = useState<ViewMode>("cards");
  useEffect(() => {
    const v = localStorage.getItem("bills-view");
    if (v === "table" || v === "compare" || v === "calendar") setView(v);
  }, []);

  const pick = (v: ViewMode) => {
    setView(v);
    localStorage.setItem("bills-view", v);
  };

  const createFromCalendar = (start: string, end: string) => {
    const previous = allPeriods.filter((p) => p.end < start).sort((a, b) => b.end.localeCompare(a.end))[0];
    setEditing({ p: { ...newPeriod(previous), start, end }, isNew: true });
  };

  if (editing) return <Editor initial={editing.p} isNew={editing.isNew} settings={settings} onClose={() => setEditing(null)} />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
        <h1 className="min-w-0 truncate text-2xl font-bold">חשבונות</h1>
        <Button onClick={() => setEditing({ p: newPeriod(periods[0]), isNew: true })}>
          <Plus className="h-4 w-4" /> תקופה חדשה
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-muted-foreground sm:grid-cols-4">
        {viewModes.map((m) => (
          <Button
            key={m.id}
            variant="ghost"
            aria-pressed={view === m.id}
            onClick={() => pick(m.id)}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm transition-colors ${
              view === m.id ? "bg-card text-card-foreground font-semibold shadow-sm" : "text-muted-foreground"
            }`}
          >
            <m.icon className="h-4 w-4" /> {m.label}
          </Button>
        ))}
      </div>

      {view !== "calendar" && years.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(["all", ...years] as const).map((y) => (
            <Button key={y} variant="outline" aria-pressed={year === y} onClick={() => setYear(y)}
              className={`shrink-0 rounded-full border px-4 py-1.5 text-sm transition-colors ${year === y ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground"}`}>
              {y === "all" ? "הכול" : y}
            </Button>
          ))}
        </div>
      )}

      {view !== "calendar" && periods.length === 0 && (
        <div className="rounded-2xl border border-dashed bg-card p-8 text-center text-muted-foreground">
          עדיין אין תקופות. אפשר להוסיף גם תקופות מהעבר.
        </div>
      )}

      {view === "cards" && <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {periods.map((p) => {
          const c = calcPeriod(p, settings.vatRate);
          return (
            <Button variant="ghost"
              key={p.id}
              onClick={() => setEditing({ p, isNew: false })}
              className="block h-auto w-full min-w-0 whitespace-normal rounded-lg border bg-card p-4 text-start text-card-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <PeriodTitle start={p.start} end={p.end} />
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <TenantChip name={settings.nameA} total={c.totalA} pay={p.payA} />
                <TenantChip name={settings.nameB} total={c.totalB} pay={p.payB} />
              </div>
            </Button>
          );
        })}</div>}

      {view === "table" && <TableView periods={periods} settings={settings} onEdit={(p) => setEditing({ p, isNew: false })} />}
      {view === "compare" && <CompareView periods={periods} settings={settings} />}
      {view === "calendar" && <BillsCalendar periods={allPeriods} settings={settings} year={calendarYear} onYearChange={setCalendarYear} onEdit={(p) => setEditing({ p, isNew: false })} onCreate={createFromCalendar} />}
    </div>
  );
}

function PayBadge({ pay }: { pay: Payment }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${pay.paid ? "bg-success text-success-foreground" : "bg-warning text-warning-foreground"}`}>
      {pay.paid ? <Check className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      {pay.paid ? "שולם" : "ממתין"}
    </span>
  );
}

function TableView({ periods, settings, onEdit }: { periods: Period[]; settings: FullSettings; onEdit: (p: Period) => void }) {
  if (periods.length === 0) return null;
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card" dir="rtl">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th className="p-3 text-start font-medium">תקופה</th>
            <th className="p-3 text-end font-medium">חשמל א׳</th>
            <th className="p-3 text-end font-medium">חשמל ב׳</th>
            <th className="p-3 text-end font-medium">מים א׳</th>
            <th className="p-3 text-end font-medium">מים ב׳</th>
            <th className="p-3 text-end font-medium">סה״כ {settings.nameA}</th>
            <th className="p-3 text-end font-medium">סה״כ {settings.nameB}</th>
            <th className="p-3 text-center font-medium">סטטוס</th>
          </tr>
        </thead>
        <tbody>
          {periods.map((p) => {
            const c = calcPeriod(p, settings.vatRate);
            return (
              <tr key={p.id} onClick={() => onEdit(p)} className="cursor-pointer border-b last:border-0 hover:bg-accent/40">
                <td className="p-3 whitespace-nowrap"><PeriodTitle start={p.start} end={p.end} /></td>
                <td className="p-3 text-end whitespace-nowrap">{c.elec.a} קוט״ש · {ils(c.elec.costA)}</td>
                <td className="p-3 text-end whitespace-nowrap">{c.elec.b} קוט״ש · {ils(c.elec.costB)}</td>
                <td className="p-3 text-end whitespace-nowrap">{c.water.a} קוב · {ils(c.water.costA)}</td>
                <td className="p-3 text-end whitespace-nowrap">{c.water.b} קוב · {ils(c.water.costB)}</td>
                <td className="p-3 text-end font-semibold whitespace-nowrap">{ils(c.totalA)}</td>
                <td className="p-3 text-end font-semibold whitespace-nowrap">{ils(c.totalB)}</td>
                <td className="p-3">
                  <div className="flex flex-col items-center gap-1">
                    <PayBadge pay={p.payA} />
                    <PayBadge pay={p.payB} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CompareView({ periods, settings }: { periods: Period[]; settings: FullSettings }) {
  if (periods.length === 0) return null;
  const sums = periods.reduce(
    (acc, p) => {
      const c = calcPeriod(p, settings.vatRate);
      acc.elecA += c.elec.a; acc.elecB += c.elec.b;
      acc.waterA += c.water.a; acc.waterB += c.water.b;
      acc.costA += c.totalA; acc.costB += c.totalB;
      acc.paidA += p.payA.paid ? p.payA.amount : 0;
      acc.paidB += p.payB.paid ? p.payB.amount : 0;
      return acc;
    },
    { elecA: 0, elecB: 0, waterA: 0, waterB: 0, costA: 0, costB: 0, paidA: 0, paidB: 0 },
  );

  const Row = ({ label, a, b }: { label: string; a: string; b: string }) => (
    <tr className="border-b last:border-0">
      <td className="p-3 text-sm text-muted-foreground">{label}</td>
      <td className="p-3 text-end font-semibold">{a}</td>
      <td className="p-3 text-end font-semibold">{b}</td>
    </tr>
  );

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-2xl border bg-card" dir="rtl">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="p-3 text-start font-medium">סיכום {periods.length} תקופות</th>
              <th className="p-3 text-end font-medium">{settings.nameA}</th>
              <th className="p-3 text-end font-medium">{settings.nameB}</th>
            </tr>
          </thead>
          <tbody>
            <Row label='חשמל (קוט"ש)' a={String(Math.round(sums.elecA))} b={String(Math.round(sums.elecB))} />
            <Row label="מים (קוב)" a={String(Math.round(sums.waterA))} b={String(Math.round(sums.waterB))} />
            <Row label="סה״כ חיובים" a={ils(sums.costA)} b={ils(sums.costB)} />
            <Row label="שולם בפועל" a={ils(sums.paidA)} b={ils(sums.paidB)} />
            <Row label="יתרה פתוחה" a={ils(Math.max(0, sums.costA - sums.paidA))} b={ils(Math.max(0, sums.costB - sums.paidB))} />
          </tbody>
        </table>
      </div>
      {periods.slice(0, 6).map((p) => {
        const c = calcPeriod(p, settings.vatRate);
        const max = Math.max(c.totalA, c.totalB, 1);
        return (
          <div key={p.id} className="rounded-2xl border bg-card p-4">
            <PeriodTitle start={p.start} end={p.end} className="text-sm" />
            {([["a", settings.nameA, c.totalA], ["b", settings.nameB, c.totalB]] as const).map(([k, name, total]) => (
              <div key={k} className="mt-2 flex items-center gap-2">
                <span className="w-20 shrink-0 truncate text-xs">{name}</span>
                <div className="h-3 min-w-0 flex-1 rounded-full bg-muted">
                  <div className="h-3 rounded-full bg-primary" style={{ width: `${Math.round((total / max) * 100)}%` }} />
                </div>
                <span className="shrink-0 text-xs font-semibold">{ils(total)}</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function TenantChip({ name, total, pay }: { name: string; total: number; pay: Payment }) {
  return (
    <div className="rounded-xl bg-muted p-3">
      <div className="text-xs text-muted-foreground">{name}</div>
      <div className="text-lg font-bold">{ils(total)}</div>
      <div className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${pay.paid ? "bg-success text-success-foreground" : "bg-warning text-warning-foreground"}`}>
        {pay.paid ? <Check className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
        {pay.paid ? "שולם" : "ממתין"}
      </div>
    </div>
  );
}

function Num({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        inputMode="decimal"
        dir="ltr"
        className="h-11 text-end"
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        onFocus={(e) => e.target.select()}
      />
    </div>
  );
}

function MeterCard({ kind, m, set, settings }: { kind: "elec" | "water"; m: Meter; set: (m: Meter) => void; settings: FullSettings }) {
  const unit = kind === "elec" ? 'קוט"ש' : "קוב";
  const r = calcMeter(m, settings.vatRate);
  const u = (k: keyof Meter) => (v: number) => set({ ...m, [k]: v });
  const Icon = kind === "elec" ? Zap : Droplets;
  return (
    <section className="space-y-3 rounded-2xl border bg-card p-4">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <Icon className="h-5 w-5 text-primary" /> {kind === "elec" ? "חשמל" : "מים"}
      </h2>
      <div className="text-sm font-medium">מונה ראשי</div>
      <div className="grid grid-cols-2 gap-3">
        <Num label="קריאה קודמת" value={m.mainPrev} onChange={u("mainPrev")} />
        <Num label="קריאה נוכחית" value={m.mainCurr} onChange={u("mainCurr")} />
      </div>
      <div className="text-sm font-medium">מונה דירה א' ({settings.nameA})</div>
      <div className="grid grid-cols-2 gap-3">
        <Num label="קריאה קודמת" value={m.aPrev} onChange={u("aPrev")} />
        <Num label="קריאה נוכחית" value={m.aCurr} onChange={u("aCurr")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Num label={`תעריף ל${unit} (₪)`} value={m.rate} onChange={u("rate")} />
        <Num label="דמי חיבור/קבוע (₪)" value={m.fixed} onChange={u("fixed")} />
      </div>
      <label className="flex items-center justify-between rounded-xl bg-muted px-3 py-2.5 text-sm">
        <span>הוספת מע"מ ({settings.vatRate}%)</span>
        <Switch checked={m.vat} onCheckedChange={(v) => set({ ...m, vat: v })} />
      </label>
      {r.b < 0 && <p className="text-sm text-destructive">שימו לב: צריכת דירה א' גבוהה מהמונה הראשי.</p>}
      <div className="grid grid-cols-3 gap-2 rounded-xl bg-accent p-3 text-center text-accent-foreground">
        <Stat t="סה״כ ראשי" v={`${r.main} ${unit}`} />
        <Stat t={settings.nameA} v={`${r.a} ${unit}`} sub={ils(r.costA)} />
        <Stat t={settings.nameB} v={`${r.b} ${unit}`} sub={ils(r.costB)} />
      </div>
    </section>
  );
}

function Stat({ t, v, sub }: { t: string; v: string; sub?: string }) {
  return (
    <div>
      <div className="truncate text-xs opacity-80">{t}</div>
      <div className="font-semibold">{v}</div>
      {sub && <div className="text-sm font-bold">{sub}</div>}
    </div>
  );
}

function PayCard({ name, phone, total, pay, set, text }: { name: string; phone: string; total: number; pay: Payment; set: (p: Payment) => void; text: string }) {
  const wa = () => {
    const num = phone.replace(/\D/g, "").replace(/^0/, "972");
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(text)}`, "_blank");
  };
  return (
    <section className="space-y-3 rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">{name}</h3>
        <span className="text-xl font-bold text-primary">{ils(total)}</span>
      </div>
      <label className="flex items-center justify-between rounded-xl bg-muted px-3 py-2.5 text-sm">
        <span>שולם</span>
        <Switch
          checked={pay.paid}
          onCheckedChange={(v) =>
            set({ ...pay, paid: v, amount: v && !pay.amount ? total : pay.amount, date: v && !pay.date ? new Date().toISOString().slice(0, 10) : pay.date })
          }
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <Num label="סכום ששולם (₪)" value={pay.amount} onChange={(n) => set({ ...pay, amount: n })} />
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">תאריך תשלום</Label>
          <Input type="date" className="h-11" value={pay.date} onChange={(e) => set({ ...pay, date: e.target.value })} />
        </div>
      </div>
      <Textarea placeholder="הערות" value={pay.notes} onChange={(e) => set({ ...pay, notes: e.target.value })} />
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            toast.success("הפירוט הועתק");
          }}
        >
          <Copy className="h-4 w-4" /> העתקה
        </Button>
        <Button variant="secondary" onClick={wa}>
          <MessageCircle className="h-4 w-4" /> וואטסאפ
        </Button>
      </div>
    </section>
  );
}

function Editor({ initial, isNew, settings, onClose }: { initial: Period; isNew: boolean; settings: FullSettings; onClose: () => void }) {
  const qc = useQueryClient();
  const [p, setP] = useState<Period>(initial);
  const [busy, setBusy] = useState(false);
  const c = calcPeriod(p, settings.vatRate);

  async function save() {
    if (!p.start || !p.end || p.end < p.start) { toast.error("טווח תאריכים לא תקין"); return; }
    setBusy(true);
    try {
      await savePeriod(p, isNew);
      await qc.invalidateQueries({ queryKey: ["periods"] });
      toast.success("התקופה נשמרה");
      onClose();
    } catch {
      toast.error("השמירה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("למחוק את התקופה?")) return;
    await deletePeriod(p.id);
    await qc.invalidateQueries({ queryKey: ["periods"] });
    onClose();
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{isNew ? "תקופה חדשה" : "עריכת תקופה"}</h1>
        <Button variant="ghost" onClick={onClose}>ביטול</Button>
      </div>

      <section className="space-y-3 rounded-lg border-b bg-background p-4 text-foreground">
        <PeriodPicker start={p.start} end={p.end} onChange={(start, end) => setP({ ...p, start, end })} />
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <MeterCard kind="elec" m={p.elec} set={(elec) => setP({ ...p, elec })} settings={settings} />
        <MeterCard kind="water" m={p.water} set={(water) => setP({ ...p, water })} settings={settings} />
      </div>

      <h2 className="pt-2 text-lg font-bold">תשלומים ושליחה</h2>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <PayCard name={settings.nameA} phone={settings.phoneA} total={c.totalA} pay={p.payA} set={(payA) => setP({ ...p, payA })} text={summaryText(p, settings, "a")} />
        <PayCard name={settings.nameB} phone={settings.phoneB} total={c.totalB} pay={p.payB} set={(payB) => setP({ ...p, payB })} text={summaryText(p, settings, "b")} />
      </div>

      {!isNew && (
        <Button variant="ghost" className="w-full text-destructive" onClick={remove}>
          <Trash2 className="h-4 w-4" /> מחיקת תקופה
        </Button>
      )}

      <div className="fixed inset-x-0 bottom-[68px] z-30 border-t bg-card/95 p-3 text-card-foreground backdrop-blur sm:px-6 lg:px-10">
        <div className="w-full">
          <Button className="h-12 w-full text-base" onClick={save} disabled={busy}>
            שמירה
          </Button>
        </div>
      </div>
    </div>
  );
}
