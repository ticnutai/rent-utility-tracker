CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE TABLE public.account_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  member_email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, member_email)
);
GRANT SELECT, INSERT, DELETE ON public.account_members TO authenticated;
GRANT ALL ON public.account_members TO service_role;
ALTER TABLE public.account_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages members" ON public.account_members FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "member sees own invites" ON public.account_members FOR SELECT TO authenticated
  USING (lower(member_email) = lower(auth.jwt() ->> 'email'));

CREATE OR REPLACE FUNCTION public.can_access(_owner uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() = _owner OR EXISTS (
    SELECT 1 FROM public.account_members
    WHERE owner_id = _owner AND lower(member_email) = lower(auth.jwt() ->> 'email')
  )
$$;

DROP POLICY "own periods" ON public.periods;
CREATE POLICY "shared periods" ON public.periods FOR ALL TO authenticated
  USING (public.can_access(user_id)) WITH CHECK (public.can_access(user_id));
DROP POLICY "own contracts" ON public.contracts;
CREATE POLICY "shared contracts" ON public.contracts FOR ALL TO authenticated
  USING (public.can_access(user_id)) WITH CHECK (public.can_access(user_id));
DROP POLICY "own settings" ON public.settings;
CREATE POLICY "shared settings" ON public.settings FOR ALL TO authenticated
  USING (public.can_access(user_id)) WITH CHECK (public.can_access(user_id));

DROP POLICY "own contract files read" ON storage.objects;
DROP POLICY "own contract files insert" ON storage.objects;
DROP POLICY "own contract files delete" ON storage.objects;
CREATE POLICY "shared contract files read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'contracts' AND public.can_access(((storage.foldername(name))[1])::uuid));
CREATE POLICY "shared contract files insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contracts' AND public.can_access(((storage.foldername(name))[1])::uuid));
CREATE POLICY "shared contract files delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'contracts' AND public.can_access(((storage.foldername(name))[1])::uuid));