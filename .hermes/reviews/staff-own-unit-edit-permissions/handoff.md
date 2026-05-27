# Handoff: Staff own-unit edit permissions

## Summary
Implemented the requested Leadra unit edit permission change:

- Sales representatives can freely edit units they personally uploaded.
- Managers can freely edit units they personally uploaded.
- Sales representatives and managers cannot edit units uploaded by other users, even if the manager is in the same team.
- Admins and sub-admins can edit any unit freely.
- Own-upload staff edit access includes property details, owner details, payment method/payment plan/pricing fields, and sales notes.
- Existing admin/sub-admin unrestricted edit behavior is preserved.

## Files changed
- `src/lib/domain.ts`
  - Added shared own-active-upload helper for sales/manager edit permissions.
  - Updated owner visibility for manager-owned units.
  - Restricted manager edit access from same-team units to only own uploaded units.

- `src/features/details/UnitDetailsPage.tsx`
  - Payment method and payment plan controls now use `canEditUnitPricing`, allowing own-upload sales/managers and admin/sub-admins.
  - Total amount is editable for users with pricing permission instead of always readonly.

- `supabase/migrations/20260527183000_restrict_staff_unit_edits_to_own_uploads.sql`
  - Updates safe unit list owner visibility so managers can see owner data for their own uploads.
  - Replaces backend edit guard so admin/sub-admin can edit any unit, while manager/sales can edit only own active uploaded units.
  - Extends staff own-upload edit access to owner and pricing fields.

- Tests updated:
  - `src/lib/domain.test.ts`
  - `src/lib/workflows.test.ts`
  - `src/lib/migrations.test.ts`
  - `src/App.test.tsx`

## Validation run
- `npm test` passed: 13 files, 171 tests.
- `npm run build` passed.
- `npm run lint` passed.
- `npm run e2e -- --project=desktop` passed: 10 tests.

## Review focus
Please verify:
1. The frontend and backend permission rules match the requested business behavior.
2. Managers no longer retain same-team edit access for units uploaded by others.
3. Sales/managers can edit their own units freely enough to cover owner details and payment fields.
4. Admin/sub-admin unrestricted edit behavior is preserved.
5. The new migration is safe to deploy on top of the current production migration chain.
