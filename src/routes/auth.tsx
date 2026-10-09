import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "כניסה — ניהול דירות" },
      { name: "description", content: "כניסה למערכת ניהול חשבונות חשמל, מים וחוזים לדירות." },
      { property: "og:title", content: "כניסה — ניהול דירות" },
      { property: "og:description", content: "כניסה למערכת ניהול חשבונות חשמל, מים וחוזים לדירות." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (error) throw error;
        nav({ to: "/bills" });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: pw,
          options: { emailRedirectTo: window.location.origin + "/bills" },
        });
        if (error) throw error;
        if (data.session) nav({ to: "/bills" });
        else toast.success("נשלח אליך מייל לאישור החשבון");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) { toast.error("הכניסה עם Google נכשלה"); return; }
    if (r.redirected) return;
    nav({ to: "/bills" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-card-foreground">ניהול הדירות שלי</h1>
        <p className="mt-1 text-sm text-muted-foreground">חשמל, מים, תשלומים וחוזים — במקום אחד</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">אימייל</Label>
            <Input id="email" type="email" dir="ltr" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw">סיסמה</Label>
            <Input id="pw" type="password" dir="ltr" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} />
          </div>
          <Button type="submit" className="h-11 w-full" disabled={busy}>
            {mode === "in" ? "כניסה" : "הרשמה"}
          </Button>
        </form>
        <Button variant="outline" className="mt-3 h-11 w-full" onClick={google}>
          המשך עם Google
        </Button>
        <button
          className="mt-4 w-full text-center text-sm text-primary"
          onClick={() => setMode(mode === "in" ? "up" : "in")}
        >
          {mode === "in" ? "אין לך חשבון? הרשמה" : "כבר רשום? כניסה"}
        </button>
      </div>
    </div>
  );
}
