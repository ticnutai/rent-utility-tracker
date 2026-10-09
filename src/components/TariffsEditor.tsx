import { useState } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { deleteTariff, saveTariff, tariffsQuery } from "@/lib/data";
import { fmtDate, localISO } from "@/lib/billing";
import { TARIFF_KINDS, type Tariff, type TariffKind } from "@/lib/tariffs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Dated tariff versions; a new value with a new date keeps old bills priced as they were. */
export function TariffsEditor() {
  const { data: tariffs } = useSuspenseQuery(tariffsQuery);
  const qc = useQueryClient();
  const [adding, setAdding] = useState<TariffKind | null>(null);
  const [draft, setDraft] = useState({ value: 0, valid_from: localISO(), source: "", notes: "" });
  const today = localISO();

  const refresh = () => qc.invalidateQueries({ queryKey: ["tariffs"] });
  const add = async (kind: TariffKind) => {
    if (!(draft.value >= 0) || !draft.valid_from) { toast.error("צריך ערך ותאריך"); return; }
    try {
      await saveTariff({ kind, ...draft });
      await refresh();
      toast.success("התעריף נשמר");
      setAdding(null);
    } catch {
      toast.error("השמירה נכשלה");
    }
  };
  const remove = async (t: Tariff) => {
    if (!confirm(`למחוק את התעריף מ־${fmtDate(t.valid_from)}?`)) return;
    try {
      await deleteTariff(t.id);
      await refresh();
    } catch {
      toast.error("המחיקה נכשלה");
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-4">
      <div>
        <Label className="text-base">תעריפים רשמיים</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          כשתעריף מתעדכן, מוסיפים ערך חדש עם תאריך התחלה. חשבונות ישנים ממשיכים להיות מחושבים לפי התעריף שהיה בתוקף.
        </p>
      </div>
      {TARIFF_KINDS.map(({ kind, label, unit }) => {
        const versions = tariffs.filter((t) => t.kind === kind);
        const current = [...versions].reverse().find((t) => t.valid_from <= today);
        return (
          <section key={kind} className="space-y-2 border-t pt-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold">{label}</div>
                <div className="text-xs text-muted-foreground">{unit}{current ? ` · בתוקף: ${current.value}` : " · לא הוזן"}</div>
              </div>
              <Button variant="outline" size="sm" onClick={() => { setAdding(kind); setDraft({ value: current?.value ?? 0, valid_from: today, source: "", notes: "" }); }}>
                <Plus className="h-4 w-4" /> עדכון
              </Button>
            </div>
            <ul className="space-y-1">
              {versions.map((t) => (
                <li key={t.id} className={`flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs ${t === current ? "bg-accent text-accent-foreground" : "bg-muted"}`}>
                  <span className="shrink-0 font-semibold">{t.value}</span>
                  <span className="min-w-0 flex-1">
                    מ־{fmtDate(t.valid_from)}
                    {t.source && <span className="block text-muted-foreground">מקור: {t.source}</span>}
                    {t.notes && <span className="block text-muted-foreground">{t.notes}</span>}
                  </span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label="מחיקת התעריף" onClick={() => void remove(t)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
            {adding === kind && (
              <div className="space-y-2 rounded-xl border border-dashed p-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">ערך ({unit})</Label>
                    <Input type="number" inputMode="decimal" dir="ltr" step="any" value={draft.value} onChange={(e) => setDraft({ ...draft, value: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">בתוקף מתאריך</Label>
                    <Input type="date" value={draft.valid_from} onChange={(e) => setDraft({ ...draft, valid_from: e.target.value })} />
                  </div>
                </div>
                <Input placeholder="מקור (למשל: חשבון חברת החשמל מאוקטובר)" value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })} />
                <Input placeholder="הערה" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => void add(kind)}>שמירה</Button>
                  <Button size="sm" variant="ghost" onClick={() => setAdding(null)}>ביטול</Button>
                </div>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
