-- Contract parties and option state.
--  * tenant/landlord ID numbers and landlord name, editable in the contract form;
--  * option_exercised: once true, the option months are owed like regular months
--    (before that they only count when a payment is recorded).
-- Idempotent.
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS tenant_id_number   text    NOT NULL DEFAULT '';
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS landlord_name      text    NOT NULL DEFAULT '';
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS landlord_id_number text    NOT NULL DEFAULT '';
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS option_exercised   boolean NOT NULL DEFAULT false;
