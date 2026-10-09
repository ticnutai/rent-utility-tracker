import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { listUsers, setUserBlocked } from "@/lib/admin.functions";
import { fmtDate } from "@/lib/billing";
import { Button } from "@/components/ui/button";

const usersQuery = queryOptions({ queryKey: ["admin-users"], queryFn: () => listUsers() });

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [
    { title: "ניהול משתמשים — ניהול דירות" },
    { name: "description", content: "מסך מנהל לצפייה בחשבונות הרשומים וחסימת גישה." },
    { property: "og:title", content: "ניהול משתמשים — ניהול דירות" },
    { property: "og:description", content: "מסך מנהל לצפייה בחשבונות הרשומים וחסימת גישה." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(usersQuery),
  errorComponent: () => <div className="rounded-2xl border bg-card p-6 text-center text-muted-foreground">אין לך הרשאת מנהל למסך הזה.</div>,
  component: AdminPage,
});

function AdminPage() {
  const { data: users } = useSuspenseQuery(usersQuery);
  const qc = useQueryClient();
  const block = useServerFn(setUserBlocked);
  const toggle = async (id: string, blocked: boolean) => {
    try {
      await block({ data: { id, blocked } });
      await qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success(blocked ? "המשתמש נחסם" : "החסימה הוסרה");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "שגיאה");
    }
  };
  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-2xl font-bold"><ShieldCheck className="h-6 w-6" /> ניהול משתמשים</h1>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {users.map((u) => (
          <div key={u.id} className="space-y-2 rounded-2xl border bg-card p-4 text-card-foreground">
            <div className="flex flex-wrap items-center gap-2">
              <span dir="ltr" className="min-w-0 truncate font-semibold">{u.email}</span>
              {u.admin && <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">מנהל</span>}
              {u.blocked && <span className="rounded-full bg-destructive px-2 py-0.5 text-xs text-destructive-foreground">חסום</span>}
            </div>
            <div className="text-xs text-muted-foreground">נרשם: {fmtDate(u.createdAt.slice(0, 10))} · כניסה אחרונה: {u.lastSignIn ? fmtDate(u.lastSignIn.slice(0, 10)) : "—"}</div>
            {!u.self && (
              <Button variant={u.blocked ? "outline" : "destructive"} size="sm" onClick={() => toggle(u.id, !u.blocked)}>
                {u.blocked ? "הסרת חסימה" : "חסימת גישה"}
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
