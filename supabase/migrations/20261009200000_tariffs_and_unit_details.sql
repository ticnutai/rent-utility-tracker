-- Official tariffs (electricity, water, municipal tax) as dated versions per account, plus the
-- per-unit details the tariff calculation needs. Shared with partners via can_access().
-- Kinds: elec_kwh (₪/kWh incl. VAT), elec_fixed_month (₪/month incl. VAT),
--        water_low / water_high (₪/m³ incl. VAT), water_quota (m³ per person per month),
--        arnona_m2_year (₪ per m² per year). Idempotent.
CREATE TABLE IF NOT EXISTS public.tariffs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL DEFAULT auth.uid(),
  kind       text NOT NULL CHECK (kind IN ('elec_kwh', 'elec_fixed_month', 'water_low', 'water_high', 'water_quota', 'arnona_m2_year')),
  value      numeric NOT NULL CHECK (value >= 0),
  valid_from date NOT NULL,
  source     text NOT NULL DEFAULT '',
  notes      text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, valid_from)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tariffs TO authenticated;
GRANT ALL ON public.tariffs TO service_role;
ALTER TABLE public.tariffs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shared tariffs" ON public.tariffs;
CREATE POLICY "shared tariffs" ON public.tariffs FOR ALL TO authenticated
  USING (public.can_access(user_id)) WITH CHECK (public.can_access(user_id));

ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS occupants       integer NOT NULL DEFAULT 0;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS area_m2         numeric NOT NULL DEFAULT 0;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS arnona_included boolean NOT NULL DEFAULT true;
