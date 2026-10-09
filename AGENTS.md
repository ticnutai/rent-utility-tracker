<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Data is per-user in Lovable Cloud tables (settings, periods, contracts) read from the browser client under RLS; billing math lives in src/lib/billing.ts (pure, unit-tested) so UI and WhatsApp summaries share one calculation.
- Period meter/payment details are stored as a jsonb `data` column on `periods` to keep the schema stable while the form evolves.
- Contract files go to the private `contracts` bucket under `<user_id>/...` and are opened via short-lived signed URLs.
- The authenticated shell is full width with responsive gutters; page-level grids arrange repeated content so wide screens are used without stretching form fields unnecessarily.
- Calendar view reuses the existing period editor and persistence; pure range helpers in periodLabel.ts own navigation and overlap logic so calendar and picker share tested date rules.
- Account sharing: `account_members` (owner + invited email) and `can_access(owner)` gate periods/contracts/settings/contract files; browser queries filter by `activeOwnerId()` and inserts set `user_id` to it, so partners read and write the owner's data.
- Roles live in `user_roles` checked via `has_role`; admin-only user management runs in server functions that verify the role before using the admin client.
- Rent tracking: `rent_payments` (one row per owner + apartment + month, shared via `can_access`). Pure rules in src/lib/rent.ts: the covering contract sets the amount due (option rent after `end_date` within `option_months`, counted only once a payment is recorded); a recorded month keeps its own `amount_due`; late after `RENT_LATE_DAYS`.
- Meter replacement is stored per reading pair (`mainSwap` / `aSwap` = old meter's last reading + new meter's first) inside the period's jsonb; `usage()` in billing.ts is the only place that turns readings into consumption.
- Meter photos live in the private `contracts` bucket under `<owner>/meters/...` so the existing storage rules apply; the path is kept on the meter (`photo`).
- Chart series colors per apartment are `--apt-a` / `--apt-b` in styles.css (validated for color-blind separation in light and dark); one measure per chart.
- Migrations run from this machine with the lovable-supabase-migrations runner live in supabase/migrations/; the repo is public, so they never contain emails or passwords.
- Contracts carry tenant/landlord names and ID numbers and `option_exercised`; `effectiveEnd()` in rent.ts is the commitment end (option end once exercised) and drives the contract status and expiry reminders.
- Official tariffs live in `tariffs` as dated versions per account (kinds in src/lib/tariffs.ts). `applyOfficialTariffs()` re-prices a period without touching readings: electricity rate + fixed charge (day-weighted across tariff changes), water `tiers` with each unit's quota from contract `occupants` (default 2), `split` for a shared water meter, and `arnona` only where `arnona_included` is false. The result is stored on the period, so every screen and report reads the same numbers.
