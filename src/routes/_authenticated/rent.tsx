import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Clock, MessageCircle, Pencil } from "lucide-react";
import { contractsQuery, deleteRentPayment, rentPaymentsQuery, saveRentPayment, settingsQuery, type Contract, type FullSettings } from "@/lib/data";
import { fmtDate, ils, localISO } from "@/lib/billing";
import { monthLabel, openRent, rentReminderText, rentYear, type Apartment, type RentMonth, type RentPayment, type RentStatus } from "@/lib/rent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export const Route = createFileRoute("/_authenticated/rent")({
  head: () => ({ meta: [
    { title: "שכר דירה — ניהול דירות" },
    { name: "description", content: "מעקב תשלומי שכר דירה חודשיים לשתי הדירות, יתרות ותזכורות." },
    { property: "og:title", content: "שכר דירה — ניהול דירות" },
    { property: "og:description", content: "מעקב תשלומי שכר דירה חודשיים לשתי הדירות, יתרות ותזכורות." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(contractsQuery),
      context.queryClient.ensureQueryData(rentPaymentsQuery),
      context.queryClient.ensureQueryData(settingsQuery),
    ]),
  component: RentPage,
});

const STATUS: Record<RentStatus, { label: string; cls: string; icon?: typeof Check }> = {
  paid: { label: "שולם", cls: "bg-success text-success-foreground", icon: Check },
  partial: { label: "שולם חלקית", cls: "bg-warning text-warning-foreground", icon: Clock },
  open: { label: "ממתין", cls: "bg-warning text-warning-foreground", icon: Clock },
  late: { label: "באיחור", cls: "bg-destructive text-destructive-foreground", icon: AlertTriangle },
  future: { label: "עתידי", cls: "bg-muted text-muted-foreground" },
  option: { label: "תקופת אופציה", cls: "bg-muted text-muted-foreground" },
  none: { label: "אין חוזה", cls: "bg-muted text-muted-foreground" },
};

/** Whether the month is part of what the tenant owes (excludes not-yet-due and uncovered months). */
const counted = (r: RentMonth) => r.status !== "none" && r.status !== "future" && r.status !== "option";

function RentPage() {
  const { data: contracts } = useSuspenseQuery(contractsQuery);
  const { data: payments } = useSuspenseQuery(rentPaymentsQuery);
  const { data: settings } = useSuspenseQuery(settingsQuery);
  const [year, setYear] = useState(new Date().getFullYear());
  const [editing, setEditing] = useState<{ apt: Apartment; r: RentMonth } | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">שכר דירה</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label="שנה קודמת" onClick={() => setYear(year - 1)}><ChevronRight /></Button>
          <span className="w-14 text-center font-semibold">{year}</span>
          <Button variant="outline" size="icon" aria-label="שנה הבאה" onClick={() => setYear(year + 1)}><ChevronLeft /></Button>
        </div>
      </div>

      {contracts.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-8 text-center text-muted-foreground">
          כדי לעקוב אחרי שכר הדירה צריך קודם להוסיף חוזה עם סכום שכירות.{" "}
          <Link to="/contracts" className="text-primary underline">למסך החוזים</Link>
        </div>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {(["a", "b"] as const).map((apt) => (
            <ApartmentRent key={apt} apt={apt} year={year} contracts={contracts} payments={payments} settings={settings} onEdit={(r) => setEditing({ apt, r })} />
          ))}
        </div>
      )}

      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-2xl" dir="rtl">
          <SheetHeader>
            <SheetTitle>{editing ? `${editing.apt === "a" ? settings.nameA : settings.nameB} · ${monthLabel(editing.r.month)}` : ""}</SheetTitle>
          </SheetHeader>
          {editing && <PaymentForm apt={editing.apt} r={editing.r} onDone={() => setEditing(null)} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ApartmentRent({ apt, year, contracts, payments, settings, onEdit }: {
  apt: Apartment;
  year: number;
  contracts: Contract[];
  payments: RentPayment[];
  settings: FullSettings;
  onEdit: (r: RentMonth) => void;
}) {
  const qc = useQueryClient();
  const months = rentYear(contracts, payments, apt, year);
  const owedRows = months.filter(counted);
  const due = owedRows.reduce((s, r) => s + r.due, 0);
  const paid = owedRows.reduce((s, r) => s + r.paidAmount, 0);
  const allOpen = openRent(contracts, payments).filter((r) => r.apartment === apt);
  const current = months.find((r) => r.contract)?.contract ?? contracts.find((c) => c.apartment === apt);
  const name = current?.tenant_name || (apt === "a" ? settings.nameA : settings.nameB);
  const phone = current?.tenant_phone || (apt === "a" ? settings.phoneA : settings.phoneB);

  const markPaid = async (r: RentMonth) => {
    try {
      await saveRentPayment({ apartment: apt, month: r.month, amount_due: r.due, amount_paid: r.due, paid: true, paid_date: localISO(), notes: r.payment?.notes ?? "" });
      await qc.invalidateQueries({ queryKey: ["rent-payments"] });
      toast.success(`${monthLabel(r.month)} סומן כשולם`);
    } catch {
      toast.error("השמירה נכשלה");
    }
  };

  const remind = () => {
    const text = rentReminderText(name, allOpen);
    const num = phone.replace(/\D/g, "").replace(/^0/, "972");
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <section className="space-y-3 rounded-2xl border bg-card p-4 text-card-foreground">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold">{apt === "a" ? "דירה א'" : "דירה ב'"} · {name}</h2>
          <p className="text-xs text-muted-foreground">
            {year}: חיוב {ils(due)} · שולם {ils(paid)}
          </p>
        </div>
        {allOpen.length > 0 && (
          <Button variant="secondary" size="sm" onClick={remind}>
            <MessageCircle className="h-4 w-4" /> תזכורת ({ils(allOpen.reduce((s, r) => s + r.balance, 0))})
          </Button>
        )}
      </div>
      <ul className="divide-y">
        {months.map((r) => {
          const st = STATUS[r.status];
          return (
            <li key={r.month} className="flex items-center gap-2 py-2">
              <span className="w-16 shrink-0 text-sm font-medium">{monthLabel(r.month).split(" ")[0]}</span>
              <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs ${st.cls}`}>
                {st.icon && <st.icon className="h-3 w-3" />}
                {st.label}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {r.status === "none" ? "" : r.balance > 0.005 ? `נשאר ${ils(r.balance)} מתוך ${ils(r.due)}` : ils(r.due)}
                {r.payment?.paid_date ? ` · ${fmtDate(r.payment.paid_date)}` : ""}
              </span>
              {r.status !== "none" && r.status !== "paid" && r.due > 0 && (
                <Button variant="outline" size="sm" className="h-8" onClick={() => void markPaid(r)}>
                  <Check className="h-3.5 w-3.5" /> שולם
                </Button>
              )}
              {(r.status !== "none" || r.payment) && (
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`עריכת ${monthLabel(r.month)}`} onClick={() => onEdit(r)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function PaymentForm({ apt, r, onDone }: { apt: Apartment; r: RentMonth; onDone: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    amount_due: r.due,
    amount_paid: r.payment?.amount_paid ?? 0,
    paid: r.payment?.paid ?? false,
    paid_date: r.payment?.paid_date ?? "",
    notes: r.payment?.notes ?? "",
  });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await saveRentPayment({ apartment: apt, month: r.month, ...f, paid_date: f.paid_date || null });
      await qc.invalidateQueries({ queryKey: ["rent-payments"] });
      toast.success("נשמר");
      onDone();
    } catch {
      toast.error("השמירה נכשלה");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!r.payment) return;
    try {
      await deleteRentPayment(r.payment.id);
      await qc.invalidateQueries({ queryKey: ["rent-payments"] });
      toast.success("הרישום נמחק");
      onDone();
    } catch {
      toast.error("המחיקה נכשלה");
    }
  };

  const num = (v: string) => (v === "" ? 0 : Number(v));

  return (
    <div className="space-y-3 p-4">
      {r.inOption && <p className="rounded-lg bg-muted p-2 text-sm">החודש בתקופת האופציה של החוזה.</p>}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>סכום לתשלום (₪)</Label>
          <Input type="number" inputMode="decimal" dir="ltr" value={f.amount_due} onChange={(e) => setF({ ...f, amount_due: num(e.target.value) })} />
        </div>
        <div className="space-y-1.5">
          <Label>סכום ששולם (₪)</Label>
          <Input type="number" inputMode="decimal" dir="ltr" value={f.amount_paid} onChange={(e) => setF({ ...f, amount_paid: num(e.target.value) })} />
        </div>
      </div>
      <label className="flex items-center justify-between rounded-xl bg-muted px-3 py-2.5 text-sm">
        <span>שולם במלואו</span>
        <Switch
          checked={f.paid}
          onCheckedChange={(v) => setF({ ...f, paid: v, amount_paid: v && !f.amount_paid ? f.amount_due : f.amount_paid, paid_date: v && !f.paid_date ? localISO() : f.paid_date })}
        />
      </label>
      <div className="space-y-1.5">
        <Label>תאריך תשלום</Label>
        <Input type="date" value={f.paid_date} onChange={(e) => setF({ ...f, paid_date: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>הערות</Label>
        <Textarea placeholder="למשל: שולם בהעברה בנקאית" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      </div>
      <Button className="h-11 w-full" onClick={save} disabled={busy}>{busy ? "שומר..." : "שמירה"}</Button>
      {r.payment && (
        <Button variant="ghost" className="w-full text-destructive" onClick={() => void remove()}>
          מחיקת הרישום של החודש
        </Button>
      )}
    </div>
  );
}
