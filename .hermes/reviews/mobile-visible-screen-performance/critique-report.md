# Critique Report: Mobile visible-screen performance

## Verdict

APPROVED

## Summary

The mobile visible-screen performance pass is approved. The implementation reduces mobile animation/filter/backdrop work, improves tap responsiveness, fixes a real mobile 44px touch-target failure found by E2E, adds safer image decoding/lazy attributes, and fixes E2E mobile project detection so the mobile more sheet is covered on `iphone-safari`/`android-chrome`.

## Review evidence

- Mobile CSS changes are scoped to coarse pointer / max-width 768px.
- Motion/page/hero/feedback/filter animations are neutralized on mobile while forcing content visible with `opacity: 1`, `transform: none`, and `filter: none`.
- Backdrop blur is removed from fixed mobile controls/select menus.
- Repeated cards/rows get `contain: layout paint`.
- Key controls get `touch-action: manipulation` and transparent tap highlight.
- Details gallery media controls now meet 44px minimum target sizing on mobile.
- All current `<img>` usages under `src/` have either `decoding` or `loading`/`decoding` attributes.
- `e2e/production.spec.ts` now treats `iphone-safari` and `android-chrome` projects as mobile, so the mobile-more-sheet branch is actually exercised.

## Required fixes

| ID | Severity | Area | Issue | Evidence | Required fix |
|----|----------|------|-------|----------|--------------|
| None | - | - | No blocking issues remain. | Critique and re-review both approved. | None. |

## Tests/reviews run

Implementation verification:

- `npm run typecheck`: PASS
- `npm run lint`: PASS
- `npm test -- src/lib/mobilePerformanceCss.test.ts src/App.test.tsx src/features/units/UnitsPage.loading.test.tsx --testTimeout=20000`: PASS, 60 tests
- `npm run build`: PASS
- `git diff --check`: PASS
- `npx playwright test e2e/mobile-touch-reliability.spec.ts --project=iphone-safari`: PASS
- `npx playwright test e2e/production.spec.ts --project=iphone-safari -g "create wizard, units filters, details, admin tabs, master data"`: initially FAILED on small target `Download Performance thumbnail`; fixed; re-run PASS.
- `npx playwright test e2e/production.spec.ts --project=iphone-safari -g "routes are stable and role-scoped"`: PASS, 4 role route sweeps.
- After E2E coverage fix: `npm run typecheck && npm run lint && npx playwright test e2e/production.spec.ts --project=iphone-safari -g "create wizard, units filters, details, admin tabs, master data"`: PASS.

Independent review:

- First critique: APPROVED, with note that mobile-more-sheet coverage was dead because project names did not equal `mobile`.
- Follow-up implemented E2E coverage fix.
- Re-review: APPROVED.

## Known non-blocking notes

- Existing Node/Vitest warnings appeared during test runs:
  - `module.register()` deprecation warning.
  - localStorage experimental warning in Vitest.
