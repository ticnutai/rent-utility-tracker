import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { activeOwnerId, setActiveOwner } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Member = { id: string; owner_id: string; member_email: string };

export function AccountSharing() {
  const qc = useQueryClient();
  const [me, setMe] = useState<{ id: string; email: string } | null>(null);
  const [rows, setRows] = useState<Member[]>([]);
  const [active, setActive] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState("");

  const load = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setMe({ id: u.user.id, email: u.user.email ?? "" });
    const [{ data }, owner, { data: admin }] = await Promise.all([
      supabase.from("account_members").select("id, owner_id, member_email").order("created_at"),
      activeOwnerId(),
      supabase.rpc("has_role", { _user_id: u.user.id, _role: "admin" }),
    ]);
    setRows(data ?? []);
    setActive(owner);
    setIsAdmin(!!admin);
  };
  useEffect(() => { void load(); }, []);

  if (!me) return null;
  const mine = rows.filter((r) => r.owner_id === me.id);
  const sharedWithMe = [...new Set(rows.filter((r) => r.owner_id !== me.id).map((r) => r.owner_id))];

  const add = async () => {
    const e = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e)) return toast.error("כתובת מייל לא תקינה");
    if (e === me.email.toLowerCase()) return toast.error("זה המייל שלך");
    const { error } = await supabase.from("account_members").insert({ member_email: e });
    if (error) return toast.error(error.code === "23505" ? "המייל כבר משותף" : "ההוספה נכשלה");
    setEmail("");
    toast.success("השותף נוסף");
    void load();
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from("account_members").delete().eq("id", id);
    if (error) return toast.error("ההסרה נכשלה");
    void load();
  };
  const switchTo = async (owner: string) => {
    setActiveOwner(owner);
    setActive(owner);
    await qc.invalidateQueries();
    toast.success("החשבון הוחלף");
  };

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-4 text-card-foreground">
      <Label>שיתוף עם שותף</Label>
      <p className="text-sm text-muted-foreground">שותף שנרשם עם המייל הזה יוכל לראות ולערוך את הדירות, החשבונות והחוזים שלך.</p>
      <div className="flex gap-2">
        <Input dir="ltr" type="email" placeholder="partner@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button onClick={add}><UserPlus className="h-4 w-4" /> הוספה</Button>
      </div>
      {mine.length > 0 && (
        <ul className="space-y-2">
          {mine.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-muted-foreground">
              <span dir="ltr" className="min-w-0 truncate text-sm">{m.member_email}</span>
              <Button variant="ghost" size="icon" aria-label={`הסרת ${m.member_email}`} onClick={() => remove(m.id)}><Trash2 className="h-4 w-4" /></Button>
            </li>
          ))}
        </ul>
      )}
      {sharedWithMe.length > 0 && (
        <div className="space-y-2 border-t pt-3">
          <Label>החשבון המוצג</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {[me.id, ...sharedWithMe].map((id, i) => (
              <Button key={id} variant={active === id ? "default" : "outline"} aria-pressed={active === id} onClick={() => switchTo(id)}>
                {id === me.id ? "החשבון שלי" : `חשבון משותף ${i}`}
              </Button>
            ))}
          </div>
        </div>
      )}
      {isAdmin && (
        <Button asChild variant="outline" className="w-full">
          <Link to="/admin"><ShieldCheck className="h-4 w-4" /> ניהול משתמשים</Link>
        </Button>
      )}
    </div>
  );
}
