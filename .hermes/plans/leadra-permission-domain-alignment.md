# Leadra Permission/Domain Alignment Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task if delegation is needed.

**Goal:** Align local permissions, workflows, Supabase policies/functions, and manager dashboard behavior with the resolved Leadra domain rules in `CONTEXT.md` and `docs/domain-alignment-findings.md`.

**Architecture:** Keep `CONTEXT.md` as the canonical domain source. Put shared local permissions in `src/lib/domain.ts`, enforce workflow behavior in `src/lib/workflows.ts`, and add a forward Supabase migration for remote enforcement instead of editing old applied migrations. Edge Functions must use caller auth plus service-role data reads without leaking sensitive unit identity.

**Tech Stack:** Vite/React, TypeScript, Vitest, Supabase/Postgres/RLS, Deno Edge Functions.

---

## Acceptance criteria

- Sales/Manager users see only active Units; Admin/Sub Admin see active and Archived Units where appropriate.
- Unit operational actions (Unit Status, Payment Timetable) are allowed only for Admin/Sub Admin or the current Unit Uploader, and not for archived Units except dedicated admin restore/archive flows.
- User Deactivation applies to all roles. Active Units block deactivation unless reassigned; archived Units do not block and can remain assigned to inactive users.
- Reassignment can target any active user and preserves Unit Team/Branch when the target has no specific context.
- Remote list/search/RLS/RPC/payment behavior matches local permissions.
- Duplicate phone Edge Function returns duplicate unit identity only to Admin/Sub Admin or the current Unit Uploader of the duplicate Unit.
- Manager dashboard Unit visibility summaries use all active visible Units, not team-scoped Units, unless a widget explicitly says it is team activity.
- Tests cover the permission changes before implementation and pass after implementation.
- Feature critique workflow reaches APPROVED before the feature is called complete.

## Task 1: Local domain permission RED tests

**Objective:** Lock the resolved permission matrix in Vitest before production code changes.

**Files:**
- Modify: `src/lib/domain.test.ts`

**Steps:**
1. Change the existing archived visibility test so Sales/Manager expect archived Units to be hidden and Admin/Sub Admin can view them.
2. Extend `canUseUnitOperationalActions()` tests:
   - Admin/Sub Admin can operate on active Units.
   - Sales current Unit Uploader can operate on their active Unit.
   - Manager current Unit Uploader can operate on their active Unit.
   - Manager/Sales cannot operate on active Units uploaded by someone else.
   - No non-admin operational action on archived Units.
3. Run: `npm run test -- src/lib/domain.test.ts`
4. Expected: FAIL on current code because archived visibility and manager operational permissions are still wrong.

## Task 2: Implement local domain helpers

**Objective:** Make local permission helpers match `CONTEXT.md`.

**Files:**
- Modify: `src/lib/domain.ts`

**Steps:**
1. Implement `canViewUnit(user, unit)` as:
   - Admin/Sub Admin: true.
   - Manager/Sales: `!unit.archived`.
2. Replace role-special-cased ownership helper with current uploader logic that allows any active user assigned as `unit.createdBy` while preserving Admin/Sub Admin override.
3. Implement `canUseUnitOperationalActions(user, unit)` as:
   - false for archived units.
   - true for Admin/Sub Admin on active units.
   - true for current Unit Uploader on active units.
   - false otherwise.
4. Run: `npm run test -- src/lib/domain.test.ts`
5. Expected: PASS.

## Task 3: Workflow RED tests for User Deactivation and operations

**Objective:** Lock deactivation/reassignment and operational workflow behavior before changes.

**Files:**
- Modify: `src/lib/workflows.test.ts`

**Steps:**
1. Add tests showing Manager cannot change Unit Status or Payment Timetable on someone else’s Unit.
2. Add tests showing Manager current Unit Uploader can change Unit Status and Payment Timetable on their own active Unit.
3. Replace Sales-only deactivation test expectations with general User Deactivation:
   - A Manager with active Units can be deactivated only through reassignment to any active replacement user.
   - Active Units assigned to target are reassigned.
   - Archived Units assigned to target remain assigned to the inactive user.
   - Replacement with blank/no Team/Branch preserves existing Unit Team/Branch.
4. Add a test that direct managed-user deactivation blocks any user with active Units and points to reassignment.
5. Run: `npm run test -- src/lib/workflows.test.ts`
6. Expected: FAIL on current code.

## Task 4: Implement local workflow alignment

**Objective:** Rework local workflows around User Deactivation and current Unit Uploader.

**Files:**
- Modify: `src/lib/workflows.ts`
- Modify callers in `src/App.tsx` only if function names/shape require it.

**Steps:**
1. Keep backward-compatible exported function name if needed, but rework semantics to accept `targetUserId` and `replacementUserId`.
2. Allow target user to be any non-deleted user and replacement to be any active, non-deleted, different user.
3. Reassign only active Units (`unit.createdBy === target.id && !unit.archived`).
4. Preserve archived Units assigned to target.
5. For each reassigned Unit, set `createdBy`, `createdByName`, and `updatedAt`; set `teamId`/`branchId` only when replacement has a non-empty value, otherwise preserve current Unit values.
6. Block `deleteManagedUserWorkflow()` from directly deactivating users with active Units.
7. Update workflow error text away from “sales representative” when the workflow is general.
8. Run: `npm run test -- src/lib/workflows.test.ts`
9. Expected: PASS.

## Task 5: Manager dashboard alignment

**Objective:** Stop implying manager Unit visibility is team-scoped.

**Files:**
- Modify: `src/App.tsx`
- Add/modify test if there is an existing App/dashboard test harness.

**Steps:**
1. Find `ManagerDashboard` and `teamUnits`.
2. Use all active visible Units for manager visible-unit counts/latest uploads/installment updates.
3. Keep separate team analytics only if copy explicitly says Team activity.
4. Run a targeted test if available; otherwise rely on `npm run typecheck` and `npm run test`.

## Task 6: Supabase forward migration

**Objective:** Enforce the domain remotely without editing old migrations.

**Files:**
- Create: `supabase/migrations/<timestamp>_align_unit_uploader_permissions.sql`

**Steps:**
1. Redefine `list_units_safe()` and `search_units_safe()` so Manager/Sales results exclude archived Units; Admin/Sub Admin can see archived Units.
2. Replace team-wide Manager update policy with Admin/Sub Admin or current Unit Uploader for normal Unit updates.
3. Add trigger checks for protected fields: `status`, `created_by`, `team_id`, `branch_id`, plus existing sensitive fields; only Admin/Sub Admin or current Unit Uploader can perform allowed normal updates, and reassignment should remain an Admin/Sub Admin workflow.
4. Redefine payment RPCs (`set_unit_payment_paid`, `set_unit_payment_amount`) to allow Admin/Sub Admin or `units.created_by = auth.uid()` on active Units.
5. Add SQL comments documenting User Deactivation/Reassignment semantics.
6. Run any local Supabase validation available; if Docker/Supabase is unavailable, run textual/static SQL checks and report the blocker.

## Task 7: Edge Function alignment

**Objective:** Align remote functions with general User Deactivation and privacy-safe duplicate checks.

**Files:**
- Modify: `supabase/functions/admin-deactivate-sales-rep/index.ts`
- Modify: `supabase/functions/admin-update-user-profile/index.ts`
- Modify: `supabase/functions/normalize-owner-phone-check-duplicate/index.ts`

**Steps:**
1. For deactivate function, accept both legacy (`salesUserId`, `replacementSalesUserId`) and general (`userId`, `replacementUserId`) request fields to avoid frontend breakage.
2. Permit any active replacement role; reassign only active Units; preserve Team/Branch when replacement has null/blank values; update audit text to User Deactivation.
3. For profile update, when status changes to inactive, query active Units assigned to target and block with a clear error if any exist.
4. For duplicate phone function, require bearer auth, load caller profile, query duplicate Unit with `created_by`, and return `duplicateUnit` identity only if caller is Admin/Sub Admin or current Unit Uploader; otherwise return `duplicateUnit: null` with a generic duplicate blocked indicator.
5. Run static/type checks where possible.

## Task 8: Verification and critique handoff

**Objective:** Verify and submit for critique approval.

**Files:**
- Create: `.hermes/reviews/leadra-permission-domain-alignment/handoff.md`

**Steps:**
1. Run:
   - `npm run test -- src/lib/domain.test.ts src/lib/workflows.test.ts`
   - `npm run test`
   - `npm run typecheck`
   - `npm run lint`
   - `npm run build`
2. Record pass/fail output in the handoff.
3. Include changed files, original request, domain rules, database notes, and known risks.
4. Trigger/wait for critique report at `.hermes/reviews/leadra-permission-domain-alignment/critique-report.md`.
5. Fix every Required fix and re-review until verdict is `APPROVED`.
