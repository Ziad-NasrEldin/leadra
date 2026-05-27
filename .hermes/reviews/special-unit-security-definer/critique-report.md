# Critique Report: Special-unit RPC permission fix

Verdict: APPROVED

## Scope reviewed

- Read `.hermes/reviews/special-unit-security-definer/handoff.md`.
- Inspected the special-unit migration files:
  - `supabase/migrations/20260525104743_restore_special_unit_rpc_invoker.sql`
  - `supabase/migrations/20260526213648_restore_special_unit_security_definer.sql`
  - related earlier migrations defining/restoring `public.set_unit_special`.
- Inspected the test change in `src/lib/migrations.test.ts`.
- Checked the current working tree status to separate this fix from pre-existing unrelated PDF/report changes.
- Ran the targeted migration regression test.

## Findings

No blocking or change-request findings.

The final migration restores `public.set_unit_special(bigint, boolean)` to `security definer`, which is the correct mechanism for allowing active `admin` and `sub_admin` users to update the special-unit fields even when normal unit RLS would otherwise block direct table updates. The function retains the explicit role guard:

- `actor_role public.user_role := public.current_role();`
- rejects any role outside `('admin', 'sub_admin')`
- `public.current_role()` itself checks `auth.uid()` against active profiles

The function also pins `search_path = public`, revokes public execute access, grants execute only to `authenticated`, and continues to set `special_marked_by = auth.uid()`, preserving the caller identity while bypassing table RLS only for this narrowly-scoped update.

The remote-only invoker migration is represented locally as `20260525104743_restore_special_unit_rpc_invoker.sql`, and the new later migration `20260526213648_restore_special_unit_security_definer.sql` cleanly restores the intended final state for fresh databases and migrated environments.

The regression test added to `src/lib/migrations.test.ts` checks that the restoring migration contains the function definition, `security definer`, the admin/sub_admin guard, and the authenticated execute grant. This is appropriate lightweight coverage for migration content.

The unrelated pre-existing changes in `src/lib/pdf.ts`, `src/lib/pdf.test.ts`, and report artifacts are still present in the working tree, but the reviewed special-unit diff does not depend on or modify them.

## Verification run

- `npm test -- src/lib/migrations.test.ts`: PASS, 3 tests.

## Notes / residual risk

- I did not independently re-run production Supabase verification or production E2E in this critique pass; I reviewed the handoff's reported production DB verification and the migration contents. The database migration itself is sound.
- The migration test is string-based rather than executing SQL against a test database, but this matches the existing project pattern in `src/lib/migrations.test.ts` and is sufficient for guarding against accidental reversion of the critical `security definer` and role-check clauses.
