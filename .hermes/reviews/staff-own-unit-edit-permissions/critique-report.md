# Critique Report: Staff Own-Unit Edit Permissions

Verdict: APPROVED

## Review summary

Re-reviewed the current implementation after the migration signature fix, focusing on the prior required fix and the staff own-unit edit permission behavior.

## Findings

- The previous required migration fix is resolved. `supabase/migrations/20260527183000_restrict_staff_unit_edits_to_own_uploads.sql` now preserves `public.list_units_safe(integer, integer)` with `installment_due_day integer` in the return table signature immediately after `installment_amount numeric`.
- The same migration now selects `u.installment_due_day` in the matching position, preserving compatibility with the existing safe RPC return shape and `search_units_safe`'s `select * from public.list_units_safe(...)` dependency.
- `src/lib/migrations.test.ts` now includes assertions for both `installment_due_day integer` and `u.installment_due_day`, so the regression that caused the prior REQUIRED FIX would be caught by the targeted migration test.
- Backend edit enforcement remains aligned with the requested policy: admin/sub-admin can edit freely; manager/sales can edit non-owner details, owner fields, and pricing only for their own active uploaded units; manager same-team edit access for units uploaded by others is not present in the latest guard.
- Frontend/domain permission helpers continue to match the backend direction: staff edit permissions require own active uploaded units, while admin/sub-admin retain unrestricted edit access, and pricing/payment controls are enabled through `canEditUnitPricing`.

## Validation

Ran:

- `npm test -- src/lib/migrations.test.ts`
- `npm run build`
- `npm run lint`

All passed.

## Required fixes

None.
