import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { saveSettings, settingsQuery, type FullSettings } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { applyTheme, getStoredMode, getStoredTheme, THEMES, type ThemeId, type ThemeMode } from "@/lib/theme";
import { Moon, Sun } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "הגדרות — ניהול דירות" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(settingsQuery),
  component: SettingsPage,
});

function SettingsPage() {
  const { data } = useSuspenseQuery(settingsQuery);
  const qc = useQueryClient();
  const nav = useNavigate();
  const [s, setS] = useState<FullSettings>(data);
  const f = (k: keyof FullSettings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setS({ ...s, [k]: k === "vatRate" ? Number(e.target.value) : e.target.value });

  async function save() {
    try {
      await saveSettings(s);
      await qc.invalidateQueries({ queryKey: ["settings"] });
      toast.success("נשמר");
    } catch {
      toast.error("השמירה נכשלה");
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">הגדרות</h1>
      <ThemePicker />
      <div className="space-y-4 rounded-2xl border bg-card p-4">
        <Field label="שם דייר דירה א' (מונה משנה)"><Input value={s.nameA} onChange={f("nameA")} /></Field>
        <Field label="טלפון דייר א' (לוואטסאפ)"><Input dir="ltr" inputMode="tel" placeholder="0501234567" value={s.phoneA} onChange={f("phoneA")} /></Field>
        <Field label="שם דייר דירה ב'"><Input value={s.nameB} onChange={f("nameB")} /></Field>
        <Field label="טלפון דייר ב' (לוואטסאפ)"><Input dir="ltr" inputMode="tel" placeholder="0501234567" value={s.phoneB} onChange={f("phoneB")} /></Field>
        <Field label='שיעור מע"מ (%)'><Input type="number" inputMode="decimal" value={s.vatRate} onChange={f("vatRate")} /></Field>
        <Button className="h-11 w-full" onClick={save}>שמירה</Button>
      </div>
      <Button
        variant="outline"
        className="w-full"
        onClick={async () => {
          await supabase.auth.signOut();
          nav({ to: "/auth" });
        }}
      >
        התנתקות
      </Button>
    </div>
  );
}

function ThemePicker() {
  const [theme, setTheme] = useState<ThemeId>(getStoredTheme);
  const [mode, setMode] = useState<ThemeMode>(getStoredMode);

  const pickTheme = (t: ThemeId) => { setTheme(t); applyTheme(t, mode); };
  const pickMode = (m: ThemeMode) => { setMode(m); applyTheme(theme, m); };

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-4">
      <Label>ערכת נושא</Label>
      <div className="grid grid-cols-2 gap-2">
        {THEMES.map((t) => (
          <button
            key={t.id}
            onClick={() => pickTheme(t.id)}
            className={`flex items-center gap-2 rounded-xl border p-3 text-sm transition-colors ${
              theme === t.id ? "border-primary bg-accent font-semibold" : "hover:bg-accent/50"
            }`}
          >
            <span className="h-5 w-5 shrink-0 rounded-full border" style={{ backgroundColor: t.swatch }} />
            {t.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        {([["light", "בהיר", Sun], ["dark", "כהה", Moon]] as const).map(([m, label, Icon]) => (
          <button
            key={m}
            onClick={() => pickMode(m)}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm transition-colors ${
              mode === m ? "bg-card font-semibold shadow-sm" : "text-muted-foreground"
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
