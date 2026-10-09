CREATE TABLE public.settings (
  user_id uuid PRIMARY KEY,
  name_a text NOT NULL DEFAULT 'דירה א''',
  name_b text NOT NULL DEFAULT 'דירה ב''',
  phone_a text NOT NULL DEFAULT '',
  phone_b text NOT NULL DEFAULT '',
  vat_rate numeric NOT NULL DEFAULT 18,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own settings" ON public.settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  start_date date NOT NULL,
  end_date date NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.periods TO authenticated;
GRANT ALL ON public.periods TO service_role;
ALTER TABLE public.periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own periods" ON public.periods FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  apartment text NOT NULL DEFAULT 'a',
  tenant_name text NOT NULL DEFAULT '',
  tenant_phone text NOT NULL DEFAULT '',
  start_date date,
  end_date date,
  monthly_rent numeric NOT NULL DEFAULT 0,
  option_months integer NOT NULL DEFAULT 0,
  option_rent numeric NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  file_path text,
  file_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contracts TO authenticated;
GRANT ALL ON public.contracts TO service_role;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own contracts" ON public.contracts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own contract files read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'contracts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own contract files insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'contracts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own contract files delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'contracts' AND (storage.foldername(name))[1] = auth.uid()::text);