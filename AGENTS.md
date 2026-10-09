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
