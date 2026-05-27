# Critique Report: Leadra payment/theme fixes re-review

## Verdict

APPROVED

## Summary

R1 is fixed. The updated `prepare_unit_calculations()` now distinguishes all-unpaid/no-history schedules from schedules with paid history when handling normal installment pricing edits. For normal non-timetable updates, it recalculates `base_remaining` from the edited `total_amount - down_payment`, checks whether any existing schedule row is paid, and only preserves the unpaid schedule sum when paid history exists. If all existing schedule rows are unpaid, `remaining_payment` is reset to the edited base amount plus unpaid maintenance, avoiding the stale remaining-payment bug from the prior review.

I did not find a new blocker in the bounded re-review.

## R1 re-review

| ID | Previous issue | Current finding | Status |
|----|----------------|-----------------|--------|
| R1 | Installment pricing edits with existing all-unpaid schedule rows could keep `remaining_payment` stale by preferring the old unpaid schedule sum over the edited base remaining value. | Fixed in `supabase/migrations/20260527171243_fix_payment_plan_edit_calculations.sql`: the update path selects both unpaid schedule sum and `coalesce(bool_or(paid), false)` into `unpaid_schedule_remaining, has_paid_schedule`; it sets `remaining_payment` to `unpaid_schedule_remaining + unpaid_maintenance` only when `has_paid_schedule` is true, otherwise to `base_remaining + unpaid_maintenance`. The existing timetable guard is preserved so payment timetable updates keep the old installment amount behavior. | RESOLVED |

## Files inspected

- `.hermes/reviews/leadra-payment-theme-fixes/handoff.md`
- `.hermes/reviews/leadra-payment-theme-fixes/critique-report.md` from the prior review
- `supabase/migrations/20260527171243_fix_payment_plan_edit_calculations.sql`
- `src/lib/migrations.test.ts`
- `src/lib/repository.test.ts`
- `src/lib/theme.tsx`
- `src/lib/theme.test.ts`
- `src/index.css`

## Verification performed

- Inspected the current working-tree status and relevant diffs.
- Ran bounded targeted tests:
  - `npm test -- src/lib/migrations.test.ts src/lib/repository.test.ts src/lib/theme.test.ts`
  - Result: PASS, 3 files / 26 tests.

## Notes / non-blocking observations

- The migration regression coverage remains string-based rather than an executable database trigger test, so it is not as strong as an integration test. This is not a blocker for this bounded re-review because the reviewed PL/pgSQL control flow directly addresses R1 and the targeted tests pass.
- Full E2E was not run, per instruction to keep this bounded and avoid long E2E. The handoff reports full local E2E is blocked by missing `LEADRA_QA_*` credentials.
