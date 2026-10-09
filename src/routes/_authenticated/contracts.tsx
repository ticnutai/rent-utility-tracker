import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, FileText, Phone, Trash2, Upload, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { activeOwnerId, contractsQuery, settingsQuery, type Contract } from "@/lib/data";
import { fmtDate, ils } from "@/lib/billing";
import { effectiveEnd } from "@/lib/rent";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export const Route = createFileRoute("/_authenticated/contracts")({
  head: () => ({ meta: [
    { title: "דיירים וחוזים — ניהול דירות" },
    { name: "description", content: "ניהול חוזי שכירות, פרטי דיירים וקובצי חוזים לשתי הדירות." },
    { property: "og:title", content: "דיירים וחוזים — ניהול דירות" },
    { property: "og:description", content: "ניהול חוזי שכירות, פרטי דיירים וקובצי חוזים לשתי הדירות." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  loader: ({ context }) =>
    Promise.all([context.queryClient.ensureQueryData(contractsQuery), context.queryClient.ensureQueryData(settingsQuery)]),
  component: ContractsPage,
});

const blank = (apartment: "a" | "b"): Contract => ({
  id: "",
  apartment,
  tenant_name: "",
  tenant_phone: "",
  tenant_id_number: "",
  landlord_name: "",
  landlord_id_number: "",
  start_date: null,
  end_date: null,
  monthly_rent: 0,
  option_months: 0,
  option_rent: 0,
  option_exercised: false,
  notes: "",
  file_path: null,
  file_name: null,
});

function daysLeft(end: string | null) {
  if (!end) return null;
  // Parse as local midnight; a bare YYYY-MM-DD is read as UTC and shifts by the timezone offset.
  return Math.ceil((new Date(`${end}T00:00:00`).getTime() - Date.now()) / 86400000);
}

function ContractsPage() {
  const { data: contracts } = useSuspenseQuery(contractsQuery);
  const { data: settings } = useSuspenseQuery(settingsQuery);
  const [apt, setApt] = useState<"a" | "b">("a");
  const [edit, setEdit] = useState<Contract | null>(null);
  const list = contracts.filter((c) => c.apartment === apt);

  async function openFile(path: string) {
    const { data, error } = await supabase.storage.from("contracts").createSignedUrl(path, 300);
    if (error || !data) { toast.error("לא ניתן לפתוח את הקובץ"); return; }
    window.open(data.signedUrl, "_blank");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">דיירים וחוזים</h1>
        <Button onClick={() => setEdit(blank(apt))}>
          <Plus className="h-4 w-4" /> חוזה
        </Button>
      </div>
      <Tabs value={apt} onValueChange={(v) => setApt(v as "a" | "b")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="a">דירה א' · {settings.nameA}</TabsTrigger>
          <TabsTrigger value="b">דירה ב' · {settings.nameB}</TabsTrigger>
        </TabsList>
      </Tabs>

      {list.length === 0 && (
        <div className="rounded-2xl border border-dashed bg-card p-8 text-center text-muted-foreground">אין חוזים לדירה זו עדיין.</div>
      )}

      {list.map((c) => {
        const d = daysLeft(effectiveEnd(c));
        const status = d === null ? null : d < 0 ? { t: "הסתיים", cls: "bg-muted text-muted-foreground" } : d <= 60 ? { t: `נשארו ${d} ימים`, cls: "bg-warning text-warning-foreground" } : { t: "פעיל", cls: "bg-success text-success-foreground" };
        return (
          <div key={c.id} className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-lg font-bold">{c.tenant_name || "ללא שם"}</div>
                {c.tenant_phone && (
                  <a href={`tel:${c.tenant_phone}`} className="flex items-center gap-1 text-sm text-primary" dir="ltr">
                    <Phone className="h-3.5 w-3.5" /> {c.tenant_phone}
                  </a>
                )}
              </div>
              {status && <span className={`rounded-full px-2.5 py-1 text-xs ${status.cls}`}>{status.t}</span>}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Info t="תחילת שכירות" v={fmtDate(c.start_date ?? "") || "—"} />
              <Info t="סיום שכירות" v={fmtDate(c.end_date ?? "") || "—"} />
              <Info t="שכירות חודשית" v={ils(Number(c.monthly_rent))} />
              <Info
                t={c.option_exercised ? "אופציה (מומשה)" : "אופציה"}
                v={c.option_months ? `${c.option_months} חודשים · ${ils(Number(c.option_rent))}/חודש` : "—"}
              />
              <Info t="ת״ז הדייר" v={c.tenant_id_number || "—"} />
              <Info t="משכיר" v={[c.landlord_name, c.landlord_id_number && `ת״ז ${c.landlord_id_number}`].filter(Boolean).join(" · ") || "—"} />
            </div>
            {c.notes && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{c.notes}</p>}
            <div className="flex gap-2">
              {c.file_path && (
                <Button variant="secondary" size="sm" onClick={() => openFile(c.file_path!)}>
                  <FileText className="h-4 w-4" /> {c.file_name ?? "חוזה"} <ExternalLink className="h-3 w-3" />
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setEdit(c)}>עריכה</Button>
            </div>
          </div>
        );
      })}

      <Sheet open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-2xl" dir="rtl">
          <SheetHeader>
            <SheetTitle>{edit?.id ? "עריכת חוזה" : "חוזה חדש"}</SheetTitle>
          </SheetHeader>
          {edit && <ContractForm initial={edit} onDone={() => setEdit(null)} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Info({ t, v }: { t: string; v: string }) {
  return (
    <div className="rounded-xl bg-muted p-2.5">
      <div className="text-xs text-muted-foreground">{t}</div>
      <div className="font-semibold">{v}</div>
    </div>
  );
}

function ContractForm({ initial, onDone }: { initial: Contract; onDone: () => void }) {
  const qc = useQueryClient();
  const [c, setC] = useState<Contract>(initial);
  const [file, setFile] = useState<File | null>(null);
  const [dropFile, setDropFile] = useState(false);
  const [busy, setBusy] = useState(false);
  const s = (k: keyof Contract, num = false) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setC({ ...c, [k]: num ? Number(e.target.value) : e.target.value || (k.endsWith("date") ? null : "") });

  async function save() {
    setBusy(true);
    let uploaded: string | null = null;
    try {
      const owner = await activeOwnerId();
      let file_path = c.file_path, file_name = c.file_name;
      if (file) {
        const ext = file.name.split(".").pop() ?? "pdf";
        const path = `${owner}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("contracts").upload(path, file);
        if (error) throw error;
        uploaded = path;
        file_path = path;
        file_name = file.name;
      } else if (dropFile) {
        file_path = null;
        file_name = null;
      }
      const { id, ...rest } = c;
      const row = { ...rest, file_path, file_name };
      const { error } = id
        ? await supabase.from("contracts").update(row).eq("id", id)
        : await supabase.from("contracts").insert({ ...row, user_id: owner });
      if (error) throw error;
      // Remove the replaced or dropped file only once the row no longer points at it.
      if ((uploaded || dropFile) && c.file_path) await supabase.storage.from("contracts").remove([c.file_path]);
      await qc.invalidateQueries({ queryKey: ["contracts"] });
      toast.success("החוזה נשמר");
      onDone();
    } catch {
      if (uploaded) await supabase.storage.from("contracts").remove([uploaded]);
      toast.error("השמירה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("למחוק את החוזה?")) return;
    const { error } = await supabase.from("contracts").delete().eq("id", c.id);
    if (error) { toast.error("המחיקה נכשלה"); return; }
    if (c.file_path) await supabase.storage.from("contracts").remove([c.file_path]);
    await qc.invalidateQueries({ queryKey: ["contracts"] });
    toast.success("החוזה נמחק");
    onDone();
  }

  return (
    <div className="space-y-3 p-4">
      <F l="שם הדייר"><Input value={c.tenant_name} onChange={s("tenant_name")} /></F>
      <div className="grid grid-cols-2 gap-3">
        <F l="טלפון"><Input dir="ltr" inputMode="tel" value={c.tenant_phone} onChange={s("tenant_phone")} /></F>
        <F l="ת״ז הדייר"><Input dir="ltr" inputMode="numeric" value={c.tenant_id_number} onChange={s("tenant_id_number")} /></F>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <F l="שם המשכיר"><Input value={c.landlord_name} onChange={s("landlord_name")} /></F>
        <F l="ת״ז המשכיר"><Input dir="ltr" value={c.landlord_id_number} onChange={s("landlord_id_number")} /></F>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <F l="תחילת שכירות"><Input type="date" value={c.start_date ?? ""} onChange={s("start_date")} /></F>
        <F l="סיום שכירות"><Input type="date" value={c.end_date ?? ""} onChange={s("end_date")} /></F>
      </div>
      <F l="שכירות חודשית (₪)"><Input type="number" inputMode="decimal" value={c.monthly_rent} onChange={s("monthly_rent", true)} /></F>
      <div className="grid grid-cols-2 gap-3">
        <F l="אופציה — מספר חודשים"><Input type="number" inputMode="numeric" value={c.option_months} onChange={s("option_months", true)} /></F>
        <F l="שכירות באופציה (₪/חודש)"><Input type="number" inputMode="decimal" value={c.option_rent} onChange={s("option_rent", true)} /></F>
      </div>
      <label className="flex items-center justify-between rounded-xl bg-muted px-3 py-2.5 text-sm">
        <span>הדייר מימש את האופציה</span>
        <Switch checked={c.option_exercised} onCheckedChange={(v) => setC({ ...c, option_exercised: v })} />
      </label>
      <F l="הערות"><Textarea value={c.notes} onChange={s("notes")} /></F>
      <F l="קובץ החוזה (PDF / תמונה)">
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
          <Upload className="h-4 w-4" />
          {file?.name ?? (dropFile ? null : c.file_name) ?? "בחירת קובץ"}
          <input type="file" accept="application/pdf,image/*,.doc,.docx" className="hidden" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setDropFile(false); }} />
        </label>
        {(file || (c.file_path && !dropFile)) && (
          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { setFile(null); setDropFile(true); }}>
            הסרת הקובץ
          </Button>
        )}
      </F>
      <Button className="h-11 w-full" onClick={save} disabled={busy}>{busy ? "שומר..." : "שמירה"}</Button>
      {c.id && (
        <Button variant="ghost" className="w-full text-destructive" onClick={remove}>
          <Trash2 className="h-4 w-4" /> מחיקת חוזה
        </Button>
      )}
    </div>
  );
}

function F({ l, children }: { l: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{l}</Label>
      {children}
    </div>
  );
}
