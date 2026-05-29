# Leadra domain alignment findings

This file records code/doc mismatches found during the Leadra grill session. It is not a glossary; canonical domain language lives in `CONTEXT.md`.

## Open implementation bugs

### 1. Archived Unit visibility is too broad

Canonical rule:
- Admin/Sub Admin can view active and Archived Units.
- Sales Representatives and Managers can browse active Units only.

Observed mismatch:
- `src/lib/domain.ts` has `canViewUnit()` always return `true`.
- `filterUnitsForUser()` therefore includes Archived Units for Sales Representatives and Managers.
- `src/lib/domain.test.ts` currently expects Sales/Manager users to see archived Units.

Required fix later:
- Update `canViewUnit()` / `filterUnitsForUser()` and tests so archived Units are hidden from Sales Representatives and Managers.

### 2. User Deactivation workflow is still Sales-only

Canonical rule:
- **User Deactivation** applies to users generally, not only Sales Representatives.
- A user with active Units cannot be deactivated until those active Units are reassigned.
- Unit Uploader can be any active user.
- Archived Units do not block deactivation and do not need reassignment.

Observed mismatch:
- `supabase/functions/admin-deactivate-sales-rep/index.ts` is named and shaped around Sales Representatives only.
- Request fields are `salesUserId` and `replacementSalesUserId`.
- Target user must have role `sales`.
- Replacement user must have role `sales`.
- Error text says “sales representative.”
- Unit update targets all Units by `created_by`, not only active Units.

Required fix later:
- Rename/rework workflow to “Deactivate User” / “Reassign active Units.”
- Allow replacement Unit Uploader to be any active user.
- Only active Units require reassignment.
- Preserve Archived Units assigned to inactive users.

### 3. Remote safe listing/search still returns Archived Units to Sales/Managers

Canonical rule:
- Admin/Sub Admin can view active and Archived Units.
- Sales Representatives and Managers browse active Units only.
- Owner data masking should still allow Sales/Manager current Unit Uploaders to see their own Original Owner data.

Observed mismatch:
- Latest `list_units_safe()` in `supabase/migrations/20260527183000_restrict_staff_unit_edits_to_own_uploads.sql` correctly allows owner data for `(actor.role in ('manager', 'sales') and u.created_by = actor.id)`.
- But it does not filter out Archived Units for Sales Representatives or Managers.
- Latest `search_units_safe()` definitions should be checked/fixed the same way because older definitions repeatedly returned all visible Units without the new archived boundary.

Required fix later:
- Filter archived Units out for Sales Representatives and Managers in remote listing/search results.
- Keep Admin/Sub Admin access to active and Archived Units.

### 4. Manager operational actions are too broad

Canonical rule:
- Unit Status and payment/timetable changes are allowed for the current Unit Uploader.
- Admin/Sub Admin can override.
- Managers who are not the current Unit Uploader can view all active Units and add manager notes, but cannot manage/edit them.

Observed mismatch:
- `src/lib/domain.ts` has `canUseUnitOperationalActions()` return `true` for Managers on every Unit because it only blocks Sales users viewing other users’ Units.
- `src/lib/workflows.ts` uses `canUseUnitOperationalActions()` for `updateUnitStatusWorkflow()` and `updatePaymentScheduleWorkflow()`.
- Result: Manager can change Unit Status and payment timetable rows for Units they did not upload.
- Because archived visibility is currently too broad, Sales/Managers may also be able to run some operational actions on archived Units they should not operationally manage.

Required fix later:
- Replace `canUseUnitOperationalActions()` with a permission that allows Admin/Sub Admin or current Unit Uploader only.
- Ensure operational actions reject archived Units unless the specific restore/admin workflow allows them.

### 5. Database Unit update enforcement still has permission gaps

Canonical rule:
- Managers can view all active Units and add manager notes.
- Managers can edit/manage only Units where they are the current Unit Uploader.
- Team membership does not grant edit access or sensitive owner data access.
- Unit Status changes require current Unit Uploader or Admin/Sub Admin override.

Observed mismatch:
- Early `unit edit by role` RLS policy grants Manager update access when `team_id = public.current_team_id()`.
- Latest `20260527183000_restrict_staff_unit_edits_to_own_uploads.sql` adds trigger-level field restrictions for most details, but the trigger does not explicitly protect `status`.
- Result: same-team Manager update access may still allow status changes for Units they did not upload, depending on the underlying RLS path.
- The trigger also does not explicitly protect `created_by`, `team_id`, or `branch_id`, which matters now that Reassignment changes Unit Uploader/Team/Branch context.

Required fix later:
- Replace the old team-wide Manager update policy with Admin/Sub Admin or current Unit Uploader only.
- Add explicit trigger checks for `status`, `created_by`, `team_id`, and `branch_id`.
- Keep Reassignment as a controlled Admin/Sub Admin workflow rather than a normal Unit edit.

### 6. Duplicate phone check leaks duplicate Unit identity

Canonical rule:
- Same-Project duplicate Original Owner phone should block creation.
- If the actor lacks permission to view the existing Original Owner data, Leadra should show only a privacy-safe duplicate warning.

Observed mismatch:
- `supabase/functions/normalize-owner-phone-check-duplicate/index.ts` uses the service role and returns `duplicateUnit` with `id` and `unit_code` for any duplicate.
- The function does not inspect the caller or check whether the caller can view owner data for the duplicate Unit.
- A Sales Representative or Manager could learn exactly which Unit matched a sensitive phone they are not allowed to see.

Required fix later:
- Authenticate the caller and return duplicate identity only when the caller is Admin/Sub Admin or current Unit Uploader of the duplicate Unit.
- Otherwise return a generic duplicate-blocked response with no Unit id/code.

### 7. Generic profile update can bypass User Deactivation rules

Canonical rule:
- A user with active Units cannot be deactivated until those Units are reassigned.
- User Deactivation is not a simple status edit when active Units exist.

Observed mismatch:
- `supabase/functions/admin-update-user-profile/index.ts` lets Admin/Sub Admin set any user status to `inactive` without checking active Units.
- `src/App.tsx` only blocks direct status deactivation for active Sales users, not Managers/Sub Admins/Admins who may also be Unit Uploaders under the resolved model.
- This bypasses the forced reassignment rule and can leave active Units assigned to inactive users.

Required fix later:
- Block `active -> inactive` profile updates when the target user has active Units.
- Route those cases through the reworked User Deactivation/Reassignment workflow.
- Apply to all user roles that can be current Unit Uploader, not Sales only.

### 8. Payment timetable RPCs do not enforce current Unit Uploader permission

Canonical rule:
- Payment/timetable changes are allowed for the current Unit Uploader.
- Admin/Sub Admin can override.
- Other active users, including Managers viewing someone else’s Unit, cannot change payments.

Observed mismatch:
- Latest `set_unit_payment_paid()` in `supabase/migrations/20260521141204_payment_schedule_monthly_displayed_paid.sql` only checks that `actor_role` is not null and that the Unit is not archived.
- It does not require Admin/Sub Admin or current Unit Uploader.
- `set_unit_payment_amount()` in `supabase/migrations/20260523160929_add_installment_due_day.sql` allows Admin/Sub Admin/Sales, but excludes Manager current Unit Uploaders and only checks Sales ownership.
- Result: payment permissions are inconsistent with the resolved Unit Uploader model.

Required fix later:
- For both payment RPCs, allow Admin/Sub Admin or `unit.created_by = auth.uid()` for active Units.
- Do not restrict current-uploader payment edits by role; any active current Unit Uploader can be Sales, Manager, Sub Admin, or Admin.

### 9. Reassignment Team/Branch handling is too simplistic

Canonical rule:
- Reassignment changes the Unit Uploader and sometimes Team/Branch context.
- If the target user has one clear Team/Branch context, the Unit follows that context.
- If the target user has no specific Team/Branch, keep the existing Unit Team/Branch.
- If multiple possible contexts exist, Admin/Sub Admin must choose.

Observed mismatch:
- `deleteSalesRepresentativeWorkflow()` in `src/lib/workflows.ts` always sets `teamId: replacement.teamId` and `branchId: replacement.branchId`.
- `supabase/functions/admin-deactivate-sales-rep/index.ts` similarly writes replacement Team/Branch directly.
- If the replacement user has no Team/Branch, this can erase the Unit’s existing Team/Branch context instead of preserving it.
- There is no modeled path for Admin/Sub Admin choosing among multiple possible contexts.

Required fix later:
- Reassignment workflow should preserve existing Team/Branch when the target has no specific context.
- Add explicit Team/Branch choice only when the target has multiple possible contexts.

### 10. Manager dashboard still presents Team-scoped Unit visibility

Canonical rule:
- Managers can view all active Units.
- Branch and Team do not restrict Unit visibility.

Observed mismatch:
- `ManagerDashboard` in `src/App.tsx` computes `teamUnits = units.filter((unit) => unit.teamId === user.teamId)`.
- The dashboard metric labeled `visibleUnits`, latest uploads panel, and installment updates are based on `teamUnits`.
- That makes the Manager dashboard language/summary still imply Team-scoped Unit visibility even though the resolved domain says Manager Unit visibility is global for active Units.

Required fix later:
- Either rename these widgets to explicitly say Team activity, or change dashboard summaries to use all active visible Units.
- Keep Team analytics only where the product intentionally means team performance, not Unit visibility.
