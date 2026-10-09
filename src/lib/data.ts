import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Period, Settings } from "./billing";
import type { RentPayment } from "./rent";
import type { Tariff } from "./tariffs";

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
  if (stored === u.user.id) return stored;
  if (stored) {
    const { data } = await supabase.from("account_members").select("id").eq("owner_id", stored).limit(1);
    if (data?.length) return stored;
  }
  // No explicit choice yet: a partner lands on the account they were invited to, not on their empty own one.
  const email = (u.user.email ?? "").toLowerCase();
  if (email) {
    const { data } = await supabase
      .from("account_members")
      .select("owner_id")
      .eq("member_email", email)
      .neq("owner_id", u.user.id)
      .order("created_at")
      .limit(1);
    if (data?.[0]) return data[0].owner_id;
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

export async function deletePeriod(p: Period) {
  const { error } = await supabase.from("periods").delete().eq("id", p.id);
  if (error) throw error;
  const photos = [p.elec.photo, p.water.photo].filter((x): x is string => !!x);
  if (photos.length) await supabase.storage.from("contracts").remove(photos);
}

/** Meter photos share the private contracts bucket, under the owner's folder so the same access rules apply. */
export async function uploadMeterPhoto(file: File) {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${await activeOwnerId()}/meters/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("contracts").upload(path, file);
  if (error) throw error;
  return path;
}

export async function signedFileUrl(path: string, seconds = 300) {
  const { data, error } = await supabase.storage.from("contracts").createSignedUrl(path, seconds);
  if (error || !data) throw error ?? new Error("no url");
  return data.signedUrl;
}

export const tariffsQuery = queryOptions({
  queryKey: ["tariffs"],
  queryFn: async (): Promise<Tariff[]> => {
    const { data, error } = await supabase.from("tariffs").select("*").eq("user_id", await activeOwnerId()).order("kind").order("valid_from");
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id,
      kind: r.kind as Tariff["kind"],
      value: Number(r.value),
      valid_from: r.valid_from,
      source: r.source,
      notes: r.notes,
    }));
  },
});

/** One version per kind and start date; saving the same date again updates it. */
export async function saveTariff(t: Omit<Tariff, "id">) {
  const { error } = await supabase
    .from("tariffs")
    .upsert({ ...t, user_id: await activeOwnerId() }, { onConflict: "user_id,kind,valid_from" });
  if (error) throw error;
}

export async function deleteTariff(id: string) {
  const { error } = await supabase.from("tariffs").delete().eq("id", id);
  if (error) throw error;
}

export const rentPaymentsQuery = queryOptions({
  queryKey: ["rent-payments"],
  queryFn: async (): Promise<RentPayment[]> => {
    const { data, error } = await supabase.from("rent_payments").select("*").eq("user_id", await activeOwnerId()).order("month");
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id,
      apartment: r.apartment as RentPayment["apartment"],
      month: r.month,
      amount_due: Number(r.amount_due),
      amount_paid: Number(r.amount_paid),
      paid: r.paid,
      paid_date: r.paid_date,
      notes: r.notes,
    }));
  },
});

/** One row per apartment and month; saving again updates it. */
export async function saveRentPayment(p: Omit<RentPayment, "id">) {
  const { error } = await supabase
    .from("rent_payments")
    .upsert({ ...p, user_id: await activeOwnerId(), updated_at: new Date().toISOString() }, { onConflict: "user_id,apartment,month" });
  if (error) throw error;
}

export async function deleteRentPayment(id: string) {
  const { error } = await supabase.from("rent_payments").delete().eq("id", id);
  if (error) throw error;
}

export type Contract = {
  id: string;
  apartment: "a" | "b";
  tenant_name: string;
  tenant_phone: string;
  tenant_id_number: string;
  landlord_name: string;
  landlord_id_number: string;
  start_date: string | null;
  end_date: string | null;
  monthly_rent: number;
  option_months: number;
  option_rent: number;
  option_exercised: boolean;
  /** People living in the unit – sets its discounted water quota. 0 = not entered. */
  occupants: number;
  area_m2: number;
  /** Municipal tax is part of the rent (the default), so it isn't billed separately. */
  arnona_included: boolean;
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
