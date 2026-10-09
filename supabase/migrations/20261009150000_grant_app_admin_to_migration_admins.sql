-- Gives the app's "admin" role (user_roles, used by the admin screen) to every
-- user who may already run migrations. Lists no emails, so it is safe in a public repo.
-- Idempotent: re-running adds nothing.
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'admin'::public.app_role
FROM public.migration_admins
ON CONFLICT (user_id, role) DO NOTHING;
