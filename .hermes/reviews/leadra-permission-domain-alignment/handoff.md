# Feature Handoff: Leadra permission/domain alignment

## Original request

read /tmp/leadra-hermes-session-handoff.md and continue the Leadra permission/domain alignment task exactly from there.

It includes suggested skills, repo paths, resolved domain rules, files inspected, findings summary, and next implementation order.

## Implementation summary

- Aligned local permission helpers with the resolved Unit Uploader model:
  - Admin/Sub Admin can view active and Archived Units.
  - Manager/Sales can browse active Units only.
  - Operational actions are Admin/Sub Admin or current active Unit Uploader only, and not on archived Units.
- Reworked local deactivation/reassignment semantics from Sales-only to general User Deactivation:
  - Any user with active Units must go through reassignment before deactivation.
  - Reassignment can target any active replacement user.
  - Only active Units are reassigned; Archived Units remain assigned to inactive users.
  - Replacement blank Team/Branch preserves existing Unit Team/Branch.
- Blocked generic profile status edits from deactivating users who still own active Units.
- Updated Admin user-management UI and copy to require reassignment for any active user with active Units, not just Sales Representatives.
- Updated Manager dashboard Unit summaries to use all active visible Units, not team-scoped Units, while retaining Team activity where explicitly team analytics.
- Added remote Supabase alignment:
  - Forward migration for safe list/search archived filtering, RLS/policy changes, protected-field trigger checks, and payment RPC permission checks.
  - Edge Functions updated for general deactivation, active-unit deactivation block, and privacy-safe duplicate phone identity disclosure.
- Added/updated loading skeleton behavior/tests that were present in current worktree and verified with full suite.

## Changed files

- `src/lib/domain.ts`: archived visibility and current Unit Uploader operational permissions.
- `src/lib/domain.test.ts`: permission matrix regression tests.
- `src/lib/workflows.ts`: general deactivation/reassignment, active-unit blocking, payment/status permission errors.
- `src/lib/workflows.test.ts`: user deactivation/reassignment and operational permission tests.
- `src/App.tsx`: profile deactivation block, generic reassignment flash text, manager dashboard active-visible-unit summaries, loading skeleton wiring.
- `src/App.test.tsx`: admin user-management reassignment/status tests updated for general deactivation.
- `src/features/admin/AdminPage.tsx`: replacement pool changed from Sales-only to any active user; passes active assigned-unit flag.
- `src/features/admin/UserManagement.tsx`: reassignment form shown when any active non-admin user owns active Units; inactive option hidden in that case.
- `src/lib/i18nCatalog.ts`: English/Arabic reassignment/deactivation copy generalized from Sales Representative to User/Replacement User.
- `src/lib/repository.ts`, `src/lib/repository.test.ts`: remote repository/domain behavior updates for aligned permissions and duplicate/deactivation handling.
- `src/features/details/UnitDetailsPage.tsx`: aligned UI behavior with permission changes.
- `src/features/units/UnitsPage.tsx`, `src/components/LeadraUi.tsx`, `src/components/LeadraUi.test.tsx`, `src/features/units/UnitsPage.skeleton.test.tsx`, `src/index.css`: skeleton/loading UI support present in current implementation and covered by tests.
- `supabase/migrations/20260529152000_align_unit_uploader_permissions.sql`: forward migration for list/search/RLS/RPC/trigger alignment; current Unit Uploaders may change Unit Status while Unit Uploader/Team/Branch remain Admin/Sub Admin-only.
- `supabase/functions/admin-deactivate-sales-rep/index.ts`: accepts general user/replacement fields plus legacy field names; reassigns active Units only; preserves archived Units and blank context; rejects Admin targets server-side.
- `supabase/functions/admin-update-user-profile/index.ts`: blocks active -> inactive profile updates while active Units remain assigned.
- `supabase/functions/normalize-owner-phone-check-duplicate/index.ts`: requires caller auth and only returns duplicate Unit identity to Admin/Sub Admin or the current Unit Uploader.
- `.hermes/plans/leadra-permission-domain-alignment.md`: implementation plan created from findings.

## How to test

Commands from repo root `/Users/ziadnasreldin/Documents/GitHub/leadra`:

- `npm run test -- src/lib/domain.test.ts src/lib/workflows.test.ts src/lib/repository.test.ts`
- `npm run test -- src/App.test.tsx -t "requires reassignment before removing a sales representative|requires reassignment before removing a manager|lets a sub admin deactivate a non-sales user after reassignment|keeps inactive status unavailable"`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`

Expected behavior:

- Sales/Manager do not see archived Units through local filters.
- Admin/Sub Admin can view archived Units.
- Managers can view all active Units but cannot change status/payment unless they are current Unit Uploader.
- User deactivation for active assigned Units requires reassignment to another active user.
- Direct status inactive edit is unavailable/blocked while active Units remain assigned.
- Duplicate phone function blocks duplicate creation without leaking Unit identity unless caller has permission.

## Tests run

- `npm run test -- src/lib/domain.test.ts src/lib/workflows.test.ts src/lib/repository.test.ts`: PASS.
- `npm run test -- src/lib/repository.test.ts src/lib/migrations.test.ts`: PASS, 2 files passed, 29 tests passed.
- `npm run test -- src/App.test.tsx -t "requires reassignment before removing a sales representative|requires reassignment before removing a manager|lets a sub admin deactivate a non-sales user after reassignment|keeps inactive status unavailable"`: PASS, 4 passed / 51 skipped.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm run test`: PASS, 14 files passed, 180 tests passed.
- `npm run build`: PASS.

Notes: Vitest/build emit existing Node deprecation/localStorage warnings, but commands exit 0.

## Git info

- Branch: `main`
- Base/current short SHA before committing: `647fbf6`
- Not committed in this session.
- Worktree includes pre-existing untracked artifacts (`CONTEXT.md`, `docs/`, reports/scripts) noted in `/tmp/leadra-hermes-session-handoff.md`; do not assume all untracked files are part of this feature.

## Frontend/backend/database notes

- Frontend routes/components:
  - Admin user management reassignment/deactivation UI.
  - Manager dashboard summaries.
  - Unit/details permission-gated actions.
- Backend/remote:
  - Supabase Edge Functions for deactivation, profile updates, and duplicate phone checks.
- Database:
  - New forward migration `supabase/migrations/20260529152000_align_unit_uploader_permissions.sql` rather than editing old migrations.
  - Migration should be reviewed for production Supabase compatibility before deployment.

## Reviewer focus areas

- Verify all 10 findings in `docs/domain-alignment-findings.md` are satisfied or explicitly scoped.
- Check Supabase migration correctness: no policy/function regression, correct archived filtering, correct payment RPC permission enforcement.
- Check Edge Function auth/privacy behavior, especially duplicate phone identity leakage and compatibility with legacy request field names.
- Check whether any remaining public/UI copy still says Sales Representative where the workflow is now general User Deactivation.
- Confirm skeleton/loading changes are acceptable scope and do not mask permission-related regressions.

## Fix cycle notes

Initial handoff after implementation and verification.

Re-review update after critique `REQUEST_CHANGES`:

- R1 fixed: removed the blanket `!unit.archived` filtering from `LeadraRepository.listUnits()` and `LeadraRepository.searchUnits()`. The repository now trusts the safe RPCs to scope archived rows by caller role, so Admin/Sub Admin keep archived rows returned by the backend while Manager/Sales remain active-only through RPC/database filtering. Added repository regressions proving list/search preserve archived rows returned by the safe RPC and still apply requested filters.
- R2 fixed: updated `enforce_unit_edit_permissions()` in `20260529152000_align_unit_uploader_permissions.sql` so current active Unit Uploaders on non-archived Units can change Unit Status through the direct remote update path. Unit Uploader/Team/Branch changes remain Admin/Sub Admin-only. Added static migration regression coverage for this distinction.
- R3 fixed: added server-side Admin-target rejection to `supabase/functions/admin-deactivate-sales-rep/index.ts` with the same invariant as local/UI user management. Added static Edge Function regression coverage.
- Verification after fixes: `npm run test -- src/lib/repository.test.ts src/lib/migrations.test.ts` PASS (29 tests), `npm run typecheck` PASS, `npm run lint` PASS, `npm run test` PASS (180 tests), `npm run build` PASS.
