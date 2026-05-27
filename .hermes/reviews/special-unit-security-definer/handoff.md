# Feature Handoff: Special unit RPC permission fix

## Original request

in leadra app repository i am having trouble with an issue : i cant mark as special on a unit even tho i am an admin or subadmin, this is probably a database migration issue, please fix it, also i would like you after finishing the fix to run a targeted E2E test on prod version (leadra.app) after deploying the fix of course , on : 1. creating a unit with all the details and image upload, 2. generate, download, share pdf, 3. mark as special on a unit , 4. test the previous on all roles 5. mark hold/sold or anything 6. creating a team member as admin and sub admin 7. selecting multiple units and generating a pdf for all of them 8. editing password for a user 9. deactivating a team member, after finishing send me an email on ziad.ahmed.25.25.25@gmail.com

## Implementation summary

- Root cause found in production database: `public.set_unit_special(bigint, boolean)` existed as `security invoker`, so admin/sub_admin calls could pass the role check but still be blocked by unit RLS on units outside their directly-updatable scope.
- Added a new migration that restores `security definer` for the RPC while preserving the admin/sub_admin role guard and authenticated execute grant.
- Fetched the remote-only bad migration `20260525104743_restore_special_unit_rpc_invoker.sql` into the repo so local migration history matches production.
- Applied the fix directly to the linked production Supabase database with `supabase db query --linked --file ...` and repaired migration history for `20260526213648` as applied because `supabase db push` was blocked by existing duplicate-version historical migrations.
- Verified the remote function now has `prosecdef = true`.

## Changed files

- `supabase/migrations/20260525104743_restore_special_unit_rpc_invoker.sql`: records the previously remote-only migration that made the RPC invoker.
- `supabase/migrations/20260526213648_restore_special_unit_security_definer.sql`: restores `set_unit_special` as `security definer` and keeps authenticated execute grant.
- `src/lib/migrations.test.ts`: adds regression coverage requiring the restoring migration to contain `security definer` and the role guard.

Note: `src/lib/pdf.ts`, `src/lib/pdf.test.ts`, and existing untracked report artifacts were already modified before this task and were not touched for this fix.

## How to test

Local:
- `npm test -- src/lib/migrations.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`

Production DB:
- `supabase db query --linked "select prosecdef as security_definer from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='set_unit_special';"`
- Expected: `true`.

Production E2E after deployment:
- Use live `https://leadra.app` / `https://www.leadra.app`.
- Requires production role credentials for admin, sub_admin, manager, and sales or a service-role-created QA user set.
- User-requested coverage: create detailed unit with image upload; generate/download/share PDF; mark special; repeat across all roles where role permissions allow; mark hold/sold; create team members as admin and sub_admin; generate PDF for multiple selected units; edit user password; deactivate team member.

## Tests run

- `npm test -- src/lib/migrations.test.ts`: PASS, 3 tests.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm test`: PASS, 166 tests.
- `npm run build`: PASS.
- Remote DB verification query: PASS, `security_definer = true`.

## Git info

- Branch: main
- Commit SHA, if committed: pending
- Diff base: current `origin/main`/local main with pre-existing local PDF changes excluded from this fix.

## Frontend/backend/database notes

- Frontend routes/components: no frontend code changed for the special-unit bug.
- Backend endpoints/services: Supabase RPC `public.set_unit_special(bigint, boolean)`.
- Database tables/migrations: `public.units` update via `set_unit_special`; migration `20260526213648_restore_special_unit_security_definer.sql`.

## Reviewer focus areas

- Confirm `security definer` is appropriate and safe because the function still checks `public.current_role()` for active `admin`/`sub_admin` before updating.
- Confirm no unrelated pre-existing PDF changes are included in the special-unit commit.
- Confirm migration history handling is acceptable: a remote-only migration was fetched locally, and the new migration was manually applied/repaired due duplicate historical migration version names blocking `supabase db push`.

## Fix cycle notes

Initial handoff for critique.
