# Feature review handoff: unit edit permissions

## User request
- Admins must be able to edit all editable unit fields after creation.
- The reported bedroom edit failure was: `Unit could not be saved: permission denied for table units`.
- Sales and managers must be able to edit all editable fields of their own uploaded units just like an admin can.
- Admin and sub_admin have the same role capabilities.
- Verify every editable unit field saves successfully on production, then deploy to Vercel.

## Code changes
- `src/lib/repository.ts`
  - `LeadraRepository.updateUnitDetails` now calls guarded RPC `update_unit_details` instead of direct `from('units').update(...)`.
  - This removes the direct PostgREST table update path that triggered production `permission denied for table units`.
- `src/lib/domain.ts`
  - `canEditUnitCommission` now allows current active uploader, in addition to admin/sub_admin, so manager/sales own uploaded units can edit commission too.
- `src/lib/repository.test.ts`
  - Added/updated tests to assert update saves go through `update_unit_details` and permission-filtered payloads are preserved.
- `src/lib/domain.test.ts`
  - Updated commission edit permission expectations for own uploaded manager/sales units.
- `supabase/migrations/20260601120000_unit_details_update_rpc.sql`
  - Adds `public.update_unit_details(target_unit_id bigint, unit_payload jsonb)` SECURITY DEFINER RPC.
  - RPC checks authenticated active role and allows admin/sub_admin or current unit uploader.
  - RPC updates all editable unit fields.
  - Updates trigger permission logic so current uploader can edit unit details, owner details, pricing fields, and commission; admin/sub_admin remain fully allowed.
  - Leaves archive/special and uploader/team/branch context as admin/sub_admin-only.

## Production verification already run
Production Supabase project: linked project `rurujgdcihgmdiqbgbbv`.

Created test users/units on production:
- `hermes-prod-subadmin-20260601173319@leadra.test`
- `hermes-prod-manager-20260601173319@leadra.test`
- `hermes-prod-sales-20260601173319@leadra.test`
- Unit 142 manager-owned
- Unit 143 sales-owned

Fixed test profile roles in production after seed issue:
- subadmin -> `sub_admin`
- manager -> `manager`
- sales -> `sales`

Production all-field verification command run with anon JWT saves and service readback:
- Script path used: `scripts/tmp-verify-leadra-all-edit-fields.mjs` (temporary; should not be committed)
- Output: `{ "ok": true, ... }`
- Cases succeeded:
  - admin edits sales-owned unit
  - sub_admin edits manager-owned unit
  - manager edits own uploaded unit
  - sales edits own uploaded unit
- Each case attempted and read back every editable field:
  - developer_id
  - project_id
  - destination_id
  - unit_type
  - floor
  - bua
  - roof_garden_area
  - garden_area
  - terrace_area
  - view_id
  - bedrooms
  - bathrooms
  - elevator
  - land_area
  - furnished
  - finish
  - delivery_month
  - delivery_year
  - sales_notes
  - original_owner_name
  - country_code
  - original_owner_phone
  - payment_method
  - total_amount
  - down_payment
  - transfer_fees
  - maintenance_paid
  - maintenance_cost
  - maintenance_due_date
  - installment_type
  - installment_years
  - installment_start_month
  - installment_end_month
  - installment_due_day
  - custom_installment_text
  - commission_percentage

## Local verification run
- `npm test -- --run src/lib/domain.test.ts src/lib/repository.test.ts`
  - 2 files passed, 48 tests passed.
- `npm run build`
  - passed, Vite production build completed.
- `npm test`
  - 17 files passed, 189 tests passed.

## Review focus
Please review for:
- Any missed editable unit field in the RPC or UI permission model.
- Security regressions from SECURITY DEFINER RPC or trigger changes.
- Whether sales/manager own-uploader permissions now match admin for editable fields but do not accidentally grant admin-only operations like archive/special/uploader context changes.
- Whether repository tests sufficiently guard against reverting to direct `units` table update.

## Known cleanup before commit
- Do not commit temporary verification scripts:
  - `scripts/tmp-verify-leadra-all-edit-fields.mjs`
  - `scripts/verify-prod-unit-edit-permissions.mjs` unless intentionally wanted.
