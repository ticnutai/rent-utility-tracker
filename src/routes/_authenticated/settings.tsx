import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { saveSettings, settingsQuery, type FullSettings } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
