# Feature Handoff: Mobile visible-screen performance

## Original request

After removing skeletons and deploying, focus on mobile performance on all visible screens, fix issues, then push and deploy again.

## Implementation summary

- Optimized touch/mobile CSS for visible screens:
  - Disabled route/page entrance, motion-stage, hero, feedback, flash, status, and analytics filter animations on coarse pointer/mobile screens.
  - Removed CSS filter work from mobile motion states.
  - Removed backdrop blur from fixed mobile controls and select menus on mobile.
  - Added `touch-action: manipulation` and transparent tap highlight to key controls.
  - Added `contain: layout paint` to repeated mobile cards/rows to isolate layout/paint work.
  - Kept iOS momentum scrolling on `.main-panel`.
- Fixed a mobile touch target regression found during audit:
  - Details gallery media buttons/toggles were only 34px tall on mobile.
  - Raised media PDF toggle/download/remove controls to at least 44x44px.
- Added async image decoding/lazy behavior where missing:
  - Brand/sidebar/login/logo images now decode async.
  - Palette sample logo lazy-loads/async-decodes.
  - Unit scope thumbnails and admin/master-data thumbnails async-decode.
  - Admin logo preview lazy-loads/async-decodes.
- Added `src/lib/mobilePerformanceCss.test.ts` to lock mobile animation/backdrop/tap/contain optimizations.
- Fixed mobile E2E coverage detection so the `iphone-safari`/`android-chrome` projects exercise the mobile more sheet branch instead of skipping it.

## Changed files

- `src/index.css`
- `src/App.tsx`
- `src/features/units/UnitsPage.tsx`
- `src/features/admin/MasterData.tsx`
- `src/features/admin/AdminPage.tsx`
- `src/lib/mobilePerformanceCss.test.ts`
- `e2e/production.spec.ts`

## Verification run

Local gates:

- `npm run typecheck`: PASS
- `npm run lint`: PASS
- `npm test -- src/lib/mobilePerformanceCss.test.ts src/App.test.tsx src/features/units/UnitsPage.loading.test.tsx --testTimeout=20000`: PASS, 60 tests
- `npm run build`: PASS
- `git diff --check`: PASS

Mobile E2E/audit:

- `npx playwright test e2e/mobile-touch-reliability.spec.ts --project=iphone-safari`: PASS
- First run of `npx playwright test e2e/production.spec.ts --project=iphone-safari -g "create wizard, units filters, details, admin tabs, master data"`: FAILED on small target `Download Performance thumbnail`.
- Fixed by raising details gallery media controls from 34px to 44px minimum.
- `npx playwright test e2e/production.spec.ts --project=iphone-safari -g "create wizard, units filters, details, admin tabs, master data"`: PASS after fixing the small target and again after enabling `iphone-safari` mobile-more-sheet coverage.
- `npx playwright test e2e/production.spec.ts --project=iphone-safari -g "routes are stable and role-scoped"`: PASS, 4 tests covering admin/sub_admin/manager/sales route sweeps across dashboard, units, details, create, notifications, special, profile, analytics, admin, master-data, palette.
- `search_files` for `<img` missing `loading` or `decoding`: PASS, zero matches.

## Known non-blocking notes

- Node/Vitest emits existing `module.register()` deprecation and localStorage experimental warnings.
- Playwright web server emits the same Node deprecation warning.

## Git info

- Branch: `main`
- Base commit: `e14121e fix: remove skeleton loading UI`
- Commit SHA after commit: pending

## Reviewer focus areas

- Confirm mobile CSS changes are broad enough for visible screens without breaking desktop.
- Confirm removing mobile animations/backdrop blur improves responsiveness and does not hide content.
- Confirm 44px gallery controls resolve the mobile touch target issue.
- Confirm added image decode/lazy attributes are safe.
- Confirm the E2E coverage is sufficient for route/touch/performance regression protection.
