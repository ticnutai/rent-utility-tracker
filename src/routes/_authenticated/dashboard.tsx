import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock, Wallet, Zap, Droplets } from "lucide-react";
import { periodsQuery, settingsQuery } from "@/lib/data";
import { calcPeriod, fmtDate, ils, type Period, type Payment } from "@/lib/billing";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "ראשי — ניהול דירות" },
      { name: "description", content: "יתרות פתוחות, תשלומים באיחור ומצב החשבונות של שתי הדירות." },
      { property: "og:title", content: "ראשי — ניהול דירות" },
      { property: "og:description", content: "יתרות פתוחות, תשלומים באיחור ומצב החשבונות של שתי הדירות." },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([context.queryClient.ensureQueryData(periodsQuery), context.queryClient.ensureQueryData(settingsQuery)]),
  component: DashboardPage,
});

const LATE_DAYS = 7;

type Row = {
  period: Period;
  who: "a" | "b";
  total: number;
  pay: Payment;
  balance: number;
  late: boolean;
};

function DashboardPage() {
  const { data: periods } = useSuspenseQuery(periodsQuery);
  const { data: settings } = useSuspenseQuery(settingsQuery);

  const today = new Date().toISOString().slice(0, 10);
  const lateCutoff = new Date(Date.now() - LATE_DAYS * 86400000).toISOString().slice(0, 10);

  const rows: Row[] = periods.flatMap((p) => {
    const c = calcPeriod(p, settings.vatRate);
    return (["a", "b"] as const).map((who) => {
      const total = who === "a" ? c.totalA : c.totalB;
      const pay = who === "a" ? p.payA : p.payB;
      const balance = pay.paid ? Math.max(0, total - pay.amount) : total;
      return { period: p, who, total, pay, balance, late: !pay.paid && p.end < lateCutoff };
    });
  });

  const open = rows.filter((r) => r.balance > 0.005);
  const late = rows.filter((r) => r.late);
  const sum = (list: Row[]) => list.reduce((s, r) => s + r.balance, 0);

  const apt = (who: "a" | "b") => {
    const mine = rows.filter((r) => r.who === who);
    const openMine = mine.filter((r) => r.balance > 0.005);
    return {
      name: who === "a" ? settings.nameA : settings.nameB,
      openCount: openMine.length,
      openSum: sum(openMine),
      lateCount: openMine.filter((r) => r.late).length,
      lastPaid: mine.filter((r) => r.pay.paid && r.pay.date).sort((x, y) => y.pay.date.localeCompare(x.pay.date))[0]?.pay.date ?? "",
    };
  };
  const apts = [apt("a"), apt("b")];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">ראשי</h1>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Wallet className="h-4 w-4" /> יתרות פתוחות
          </div>
          <div className="mt-1 text-2xl font-bold">{ils(sum(open))}</div>
          <div className="text-xs text-muted-foreground">{open.length} חיובים ממתינים</div>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4" /> באיחור
          </div>
          <div className={`mt-1 text-2xl font-bold ${late.length ? "text-destructive" : ""}`}>{late.length}</div>
          <div className="text-xs text-muted-foreground">מעל {LATE_DAYS} ימים אחרי סוף התקופה</div>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">מצב הדירות</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {apts.map((a) => (
            <div key={a.name} className="rounded-2xl border bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="font-bold">{a.name}</span>
                {a.openCount === 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success px-2 py-0.5 text-xs text-success-foreground">
                    <CheckCircle2 className="h-3 w-3" /> הכל שולם
                  </span>
                ) : a.lateCount > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-xs text-destructive-foreground">
                    <AlertTriangle className="h-3 w-3" /> {a.lateCount} באיחור
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-warning px-2 py-0.5 text-xs text-warning-foreground">
                    <Clock className="h-3 w-3" /> ממתין
                  </span>
                )}
              </div>
              <div className="mt-2 text-xl font-bold">{ils(a.openSum)}</div>
              <div className="text-xs text-muted-foreground">
                {a.openCount === 0 ? "אין יתרות פתוחות" : `${a.openCount} תקופות פתוחות`}
                {a.lastPaid ? ` · תשלום אחרון ${fmtDate(a.lastPaid)}` : ""}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">חיובים פתוחים</h2>
        {open.length === 0 && (
          <div className="rounded-2xl border border-dashed bg-card p-8 text-center text-muted-foreground">
            אין חיובים פתוחים — כל התשלומים התקבלו.
          </div>
        )}
        {open
          .sort((x, y) => x.period.end.localeCompare(y.period.end))
          .map((r) => (
            <Link
              key={`${r.period.id}-${r.who}`}
              to="/bills"
              className="block rounded-2xl border bg-card p-4 transition-colors hover:bg-accent/40"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">{r.who === "a" ? settings.nameA : settings.nameB}</span>
                <span className="font-bold">{ils(r.balance)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {fmtDate(r.period.start)} – {fmtDate(r.period.end)}
                </span>
                {r.late && (
                  <span className="inline-flex items-center gap-1 text-destructive">
                    <AlertTriangle className="h-3 w-3" /> באיחור
                  </span>
                )}
              </div>
            </Link>
          ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">צריכה אחרונה</h2>
        {periods.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card p-8 text-center text-muted-foreground">
            עדיין אין תקופות. מוסיפים תקופה ראשונה במסך החשבונות.
          </div>
        ) : (
          (() => {
            const p = periods[0];
            const c = calcPeriod(p, settings.vatRate);
            return (
              <div className="rounded-2xl border bg-card p-4">
                <div className="text-sm text-muted-foreground">
                  {fmtDate(p.start)} – {fmtDate(p.end)}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 rounded-xl bg-muted p-3">
                    <Zap className="h-5 w-5 text-primary" />
                    <div>
                      <div className="text-xs text-muted-foreground">חשמל</div>
                      <div className="font-semibold">{c.elec.main} קוט"ש</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl bg-muted p-3">
                    <Droplets className="h-5 w-5 text-primary" />
                    <div>
                      <div className="text-xs text-muted-foreground">מים</div>
                      <div className="font-semibold">{c.water.main} קוב</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()
        )}
      </section>
    </div>
  );
}
