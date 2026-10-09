import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Period, Settings } from "./billing";

export const DEFAULT_SETTINGS: Settings & { phoneA: string; phoneB: string } = {
  nameA: "דירה א'",
  nameB: "דירה ב'",
  vatRate: 18,
  phoneA: "",
  phoneB: "",
};
export type FullSettings = typeof DEFAULT_SETTINGS;

const OWNER_KEY = "active-owner";

/** Account whose data is shown: the user's own, or a partner's account they were invited to. */
export async function activeOwnerId(): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("לא מחובר");
  const stored = typeof window === "undefined" ? null : localStorage.getItem(OWNER_KEY);
  if (stored && stored !== u.user.id) {
    const { data } = await supabase.from("account_members").select("id").eq("owner_id", stored).limit(1);
    if (data?.length) return stored;
  }
  return u.user.id;
}
export function setActiveOwner(id: string) {
  localStorage.setItem(OWNER_KEY, id);
}

export const settingsQuery = queryOptions({
  queryKey: ["settings"],
  queryFn: async (): Promise<FullSettings> => {
    const owner = await activeOwnerId();
    const { data } = await supabase.from("settings").select("*").eq("user_id", owner).maybeSingle();
    if (!data) return DEFAULT_SETTINGS;
    return {
      nameA: data.name_a,
      nameB: data.name_b,
      vatRate: Number(data.vat_rate),
      phoneA: data.phone_a,
      phoneB: data.phone_b,
    };
  },
});

export async function saveSettings(s: FullSettings) {
  const { error } = await supabase.from("settings").upsert({
    user_id: await activeOwnerId(),
    name_a: s.nameA,
    name_b: s.nameB,
    vat_rate: s.vatRate,
    phone_a: s.phoneA,
    phone_b: s.phoneB,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export const periodsQuery = queryOptions({
  queryKey: ["periods"],
  queryFn: async (): Promise<Period[]> => {
    const { data, error } = await supabase.from("periods").select("*").eq("user_id", await activeOwnerId()).order("start_date", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => ({
      ...(r.data as unknown as Omit<Period, "id" | "start" | "end">),
      id: r.id,
      start: r.start_date,
      end: r.end_date,
    }));
  },
});

export async function savePeriod(p: Period, isNew: boolean) {
  const { id, start, end, ...rest } = p;
  const row = { start_date: start, end_date: end, data: rest as never, updated_at: new Date().toISOString() };
  const { error } = isNew
    ? await supabase.from("periods").insert({ id, ...row, user_id: await activeOwnerId() })
    : await supabase.from("periods").update(row).eq("id", id);
  if (error) throw error;
}

export async function deletePeriod(id: string) {
  const { error } = await supabase.from("periods").delete().eq("id", id);
  if (error) throw error;
}

export type Contract = {
  id: string;
  apartment: "a" | "b";
  tenant_name: string;
  tenant_phone: string;
  start_date: string | null;
  end_date: string | null;
  monthly_rent: number;
  option_months: number;
  option_rent: number;
  notes: string;
  file_path: string | null;
  file_name: string | null;
};

export const contractsQuery = queryOptions({
  queryKey: ["contracts"],
  queryFn: async (): Promise<Contract[]> => {
    const { data, error } = await supabase.from("contracts").select("*").eq("user_id", await activeOwnerId()).order("start_date", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Contract[];
  },
});
