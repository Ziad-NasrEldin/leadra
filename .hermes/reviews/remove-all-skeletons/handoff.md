# Feature Handoff: Remove all skeletons

## Original request

"skeletons where not fixed at all, how about this, you remove all skeletons and all skeletons implementaion and then push and deploy afterwards focus on mobile performance on all visible screens please, after focusing and fixing then push and deploy again /goal"

## Implementation summary

- Removed all skeleton component exports from `LeadraUi.tsx`: `SkeletonBlock`, `TextSkeleton`, `MetricSkeletonGrid`, `UnitRowSkeleton`, `UnitListSkeleton`, and `PageSkeleton`.
- Removed skeleton-specific unit/component tests.
- Removed `UnitListSkeleton` usage so Units renders either actual rows or the normal empty state, even when `loading` is true.
- Removed skeleton/shimmer CSS blocks, including analytics skeleton styles, global skeleton loading states, keyframes, page/list/card skeleton selectors, and the reduced-motion skeleton override.
- Removed remaining app/test copy references to skeletons.

## Changed files

- `src/components/LeadraUi.tsx`: deleted skeleton components and unused React type import.
- `src/components/LeadraUi.test.tsx`: removed skeleton primitive tests/imports.
- `src/features/units/UnitsPage.tsx`: removed `UnitListSkeleton` import and loading replacement branch.
- `src/features/units/UnitsPage.skeleton.test.tsx`: deleted obsolete skeleton behavior spec.
- `src/features/units/UnitsPage.loading.test.tsx`: added regression coverage for static loading state without false no-match messaging.
- `src/lib/i18nCatalog.ts`: added static unit-loading copy.
- `src/App.tsx`: removed skeleton wording from workspace loading copy.
- `src/App.test.tsx`: removed obsolete detail skeleton absence assertion.
- `src/index.css`: deleted skeleton/shimmer implementation CSS.

## How to test

- Search `src/` for `Skeleton|skeleton|shimmer|skeleton-block|page-skeleton|unit-list-skeleton|analytics-skeleton`; expected zero matches.
- Run local gates listed below.
- Deploy production and verify `/` loads without console errors.

## Tests run

- `npm run typecheck`: PASS
- `npm run lint`: PASS
- `npm run test -- src/App.test.tsx src/App.mobileHydration.test.tsx src/components/LeadraUi.test.tsx src/features/units/UnitsPage.loading.test.tsx --testTimeout=20000`: PASS, 63 tests
- `npm run build`: PASS
- `git diff --check`: PASS
- `search_files` for skeleton/shimmer strings under `src/`: PASS, zero matches
- Critique pass 1: `REQUEST_CHANGES` for false no-match empty state during `loading && units.length === 0`.
- Fix: added a static `unit-list-loading-state` status for empty loading states, kept no-match empty state only for `!loading`, and added `UnitsPage.loading.test.tsx` coverage.

## Git info

- Branch: `main`
- Commit SHA, if committed: pending
- Diff base: `618668b`

## Frontend/backend/database notes

- Frontend-only UI cleanup.
- No backend endpoint changes.
- No database/schema changes.

## Reviewer focus areas

- Confirm all skeleton implementations and usage are removed from source.
- Confirm deleting the skeleton test file is correct because the feature no longer exists.
- Confirm Units still renders empty state/rows safely during loading states.
- Confirm no visible or CSS skeleton/shimmer implementation remains.

## Fix cycle notes

Initial review request.
