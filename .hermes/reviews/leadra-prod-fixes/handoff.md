# Leadra prod fixes handoff

## Scope
Fix requested production issues before deploy:
- Editing unit installment type/plan should regenerate installment amount.
- Unit payment type should be changeable from installments to cash.
- Light/dark theme toggle should avoid full-screen flicker and unnecessary heavy reveal behavior.

## Files changed
- `src/lib/workflows.ts`
- `src/lib/workflows.test.ts`
- `src/lib/theme.tsx`
- `src/lib/theme.test.ts`

## Implementation notes
- `updateUnitWorkflow` now computes `nextPaymentSummary` from the edited payment method, total amount, down payment, installment fields, and commission percentage.
- `installmentAmount` now uses that fresh summary instead of deriving from the previous unit remaining amount.
- `remainingPayment` now updates from `nextPaymentSummary.remainingPayment`, so switching to cash clears remaining/installment values via existing payment summary behavior.
- Theme switching no longer runs the circular reveal animation or writes `data-theme-transition`; it only applies the temporary `theme-transitioning` guard for actual theme changes and skips transition work when applying the same theme.

## Tests run
- `npm test -- --run src/lib/workflows.test.ts src/lib/theme.test.ts` — passed, 27 tests.
- `npm run build` — passed.

## Review focus
- Confirm no regression in edit-unit workflow permissions or pricing behavior.
- Confirm cash/installment field clearing is correct for existing edited units.
- Confirm removing the reveal animation does not leave stale CSS/data attributes or UI state.
- Confirm tests cover the requested payment fixes and theme flicker mitigation sufficiently.
