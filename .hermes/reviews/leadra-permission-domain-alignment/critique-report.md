# Critique Report: Leadra permission/domain alignment

## Verdict

APPROVED

## Summary

The dev-agent fixes address the prior R1-R3 blockers. Remote repository listing/search no longer strips archived Units after the safe RPC returns them, so Admin/Sub Admin can retain archived rows while Manager/Sales scoping remains the database/domain responsibility. The Supabase migration trigger now allows current active Unit Uploaders to change Unit Status on non-archived Units while keeping Unit Uploader/Team/Branch context Admin/Sub Admin-only. The generalized deactivation Edge Function now rejects Admin targets server-side. Local focused tests, full Vitest, typecheck, lint, and production build all pass.

## What was changed

- `src/lib/repository.ts`: removed the blanket `!unit.archived` filtering from `listUnits()` and `searchUnits()`; search still applies requested filters via `matchesUnitFilters()`.
- `src/lib/repository.test.ts`: added regressions proving archived rows returned by safe list/search are preserved and that requested search filters still apply.
- `supabase/migrations/20260529152000_align_unit_uploader_permissions.sql`: updated `enforce_unit_edit_permissions()` so non-admin current Unit Uploaders can change `status` on non-archived Units, while `created_by`, `team_id`, and `branch_id` changes remain Admin/Sub Admin-only; the migration also filters list results with `actor.role in ('admin', 'sub_admin') or u.archived = false`, and existing `search_units_safe()` delegates through `list_units_safe()`.
- `src/lib/migrations.test.ts`: added static regression coverage for the migration status-permission split and Admin-target Edge Function rejection.
- `supabase/functions/admin-deactivate-sales-rep/index.ts`: added a server-side guard returning `403` for `targetProfile.role === 'admin'`.
- Previously reviewed permission/domain changes remain present: local archived visibility, current Unit Uploader operational permissions, generalized active-Unit reassignment, profile inactive-status blocking when active Units exist, duplicate phone privacy controls, and Manager dashboard active-visible Unit summaries.

## Required fixes

| ID | Severity | Area | Issue | Evidence | Required fix |
|----|----------|------|-------|----------|--------------|
| None | - | - | No required fixes remain from this re-review. | R1 evidence: `src/lib/repository.ts:48-51` and `src/lib/repository.ts:62-65` no longer filter `!unit.archived`; `src/lib/repository.test.ts:126-203` covers archived preservation. R2 evidence: `supabase/migrations/20260529152000_align_unit_uploader_permissions.sql:220-229` separates status permission from Unit Uploader/Team/Branch context changes; `src/lib/migrations.test.ts:14-23` covers the expected SQL. R3 evidence: `supabase/functions/admin-deactivate-sales-rep/index.ts:112-114`; `src/lib/migrations.test.ts:25-30` covers the guard. Verification commands below passed. | No action required. |

## Improvements

| ID | Priority | Area | Suggestion | Why it matters |
|----|----------|------|------------|----------------|
| I1 | Medium | Test/DB | Apply `supabase/migrations/20260529152000_align_unit_uploader_permissions.sql` to a disposable or staging Supabase project and run real RLS/RPC/Edge Function checks. | Current verification is strong local/static coverage, but SQL trigger/RLS behavior and Edge Function auth paths are still not exercised against a live Supabase runtime. |
| I2 | Medium | Test | Add direct Edge Function integration tests for `admin-deactivate-sales-rep`, `admin-update-user-profile`, and `normalize-owner-phone-check-duplicate` when the project has a repeatable Supabase test harness. | The most sensitive auth/privacy behavior currently relies on static review and app-level tests, not live function calls. |
| I3 | Medium | Naming/API | In a follow-up, rename legacy Sales-specific identifiers such as `deleteSalesRepresentativeWorkflow`, `onDeleteSalesRepresentative`, `salesReplacementOptions`, and the `admin-deactivate-sales-rep` route if backwards compatibility allows. | The behavior is now generalized User Deactivation; legacy names increase maintenance and future review risk. |
| I4 | Low | UX/Copy | Do one final manual copy pass for remaining generalized-deactivation labels that still say Sales Representative. | Mixed terminology can confuse Admin/Sub Admin users deactivating Managers or Sub Admins. |

## Tests performed

- Read handoff: `/Users/ziadnasreldin/Documents/GitHub/leadra/.hermes/reviews/leadra-permission-domain-alignment/handoff.md`.
- Read prior critique report to verify R1-R3 fix requirements.
- Inspected git status/diff summary in `/Users/ziadnasreldin/Documents/GitHub/leadra`.
- Reviewed `docs/domain-alignment-findings.md` against the implementation scope.
- Reviewed relevant code paths: `src/lib/repository.ts`, `src/lib/repository.test.ts`, `src/lib/migrations.test.ts`, `src/lib/domain.ts`, `src/lib/workflows.ts`, `src/App.tsx`, `src/features/admin/UserManagement.tsx`, `supabase/functions/admin-deactivate-sales-rep/index.ts`, `supabase/functions/admin-update-user-profile/index.ts`, `supabase/functions/normalize-owner-phone-check-duplicate/index.ts`, and `supabase/migrations/20260529152000_align_unit_uploader_permissions.sql`.
- Ran `npm run test -- src/lib/domain.test.ts src/lib/workflows.test.ts src/lib/repository.test.ts src/lib/migrations.test.ts`: PASS, 4 files / 79 tests passed.
- Ran `npm run typecheck`: PASS.
- Ran `npm run lint`: PASS.
- Ran `npm run build`: PASS; Vite production build completed successfully.
- Ran `npm run test`: PASS, 14 files / 180 tests passed.

## Tests still needed

- Live Supabase migration application against a disposable/staging database to validate SQL syntax, RLS policy behavior, trigger behavior, RPC grants, and PostgREST schema reload behavior. Blocker: no disposable/staging Supabase credentials or target were provided in this critique session.
- Remote integration check that Admin/Sub Admin can list/search archived Units and Manager/Sales cannot through `LeadraRepository` against a real Supabase project. Blocker: no live Supabase test target was provided.
- Remote integration check that a Manager/Sales current Unit Uploader can update Unit Status, while a non-uploader Manager/Sales cannot. Blocker: no live Supabase test target was provided.
- Direct Edge Function checks for admin-target rejection, active-only reassignment, legacy payload compatibility, blank Team/Branch preservation, archived Unit preservation, duplicate phone privacy-safe responses, and active-Unit profile deactivation blocking. Blocker: no live Supabase Edge Function test target was provided.

## Dev-agent instructions

1. No required fixes remain for R1-R3.
2. Treat the feature as locally approved based on this critique.
3. Before production deployment, run the live Supabase migration/Edge Function integration checks listed in Tests still needed, or document the specific environment/access blocker in the deployment handoff.
