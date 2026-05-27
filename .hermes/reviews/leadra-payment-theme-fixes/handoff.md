# Leadra payment + theme fixes handoff

## Scope
Fix three client-reported issues:
1. Editing a unit installment type does not regenerate installment amount.
2. Unit payment type cannot be changed from installments to cash.
3. Light/dark theme toggle needs performance and UI improvements.

## Changes made
- Added migration `supabase/migrations/20260527171243_fix_payment_plan_edit_calculations.sql`.
  - Replaces `public.prepare_unit_calculations()` using the latest production behavior as the base.
  - Preserves unpaid maintenance handling.
  - Preserves payment timetable guard so paid/unpaid actions do not recalculate installment amount.
  - Recalculates installment amount for normal payment-plan edits.
  - Clears down payment, remaining payment, installment type/period/text/amount when payment method is cash.
  - Replaces `public.enforce_unit_edit_permissions()` so authorized pricing editors can change payment method/down payment while unauthorized roles remain blocked.
  - Preserves the installment due-day permission guard from the prior production migration.
- Updated migration regression tests to check maintenance, timetable guard, cash clearing, permission trigger behavior, and installment due-day guard.
- Added repository regression coverage proving authorized cash payment-method changes are persisted while remaining payment is left to DB triggers.
- Updated stale repository test mock for current `list_units_safe` reload behavior.
- Updated `src/lib/theme.tsx` so the heavy full-page reveal only runs when explicitly requested with `animate: true`; default toggles now use the lighter existing color transition.
- Updated `src/lib/theme.test.ts` to cover lighter default toggle behavior.

## Existing unrelated local changes noticed
- `src/lib/pdf.ts` and `src/lib/pdf.test.ts` were already modified before this work in the current working tree. They are included in local test/build verification but are not part of the payment/theme fix scope.
- There are untracked production E2E reports/scripts already present.

## Verification run
- `npm run typecheck` PASS
- `npm run lint` PASS
- `npm test` PASS: 13 files, 170 tests
- `npm run build` PASS
- After latest installment due-day fix: `npm test -- src/lib/migrations.test.ts` PASS and `npm run typecheck` PASS
- After R1 stale remaining-payment fix: `npm test -- src/lib/migrations.test.ts src/lib/repository.test.ts src/lib/theme.test.ts` PASS: 3 files, 26 tests; `npm run typecheck` PASS; `npm run lint` PASS
- Full local `npm run e2e` was rerun after the CSS touch-target fix. Result: 13 passed, 2 skipped, 15 failed because `LEADRA_QA_*` credentials are not present in `.env.local`; the failures were missing-credential errors, not product assertion failures.

## Fix cycle notes
- Re-review R1 fix: `prepare_unit_calculations()` now distinguishes normal pricing edits from paid-history/timetable behavior. If existing payment schedule rows are all unpaid, `remaining_payment` recalculates from the edited `total_amount - down_payment` base; if paid schedule history exists, it preserves progress using the unpaid schedule sum. Migration regression assertions were updated for this behavior.

## Review request
Please review the updated diff and confirm whether all previous Required fixes are now resolved. Return verdict APPROVED or REQUEST_CHANGES with specific required changes.
