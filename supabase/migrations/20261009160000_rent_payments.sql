-- Monthly rent tracking per apartment. Rows belong to the account owner and are
-- shared through can_access() exactly like periods/contracts (account_members).
-- The amount due is copied from the contract when a month is first recorded, so
-- later contract edits don't rewrite past months. Idempotent.
CREATE TABLE IF NOT EXISTS public.rent_payments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL DEFAULT auth.uid(),
  apartment   text NOT NULL CHECK (apartment IN ('a', 'b')),
  month       date NOT NULL CHECK (extract(day FROM month) = 1),
  amount_due  numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  paid        boolean NOT NULL DEFAULT false,
  paid_date   date,
  notes       text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, apartment, month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rent_payments TO authenticated;
GRANT ALL ON public.rent_payments TO service_role;
ALTER TABLE public.rent_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shared rent payments" ON public.rent_payments;
CREATE POLICY "shared rent payments" ON public.rent_payments FOR ALL TO authenticated
  USING (public.can_access(user_id)) WITH CHECK (public.can_access(user_id));
