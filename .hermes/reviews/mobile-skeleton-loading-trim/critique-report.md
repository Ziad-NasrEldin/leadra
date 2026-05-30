# Critique Report: mobile-skeleton-loading-trim

Verdict: APPROVED

## Summary

The implementation satisfies the request to stop unnecessary skeleton/shimmer animation on already-rendered or fast-loading pages. The feature removes the forced Unit Details deferred skeleton, prevents rendered unit rows from being replaced by loading skeletons during quick refreshes, and removes the persistent decorative shimmer pseudo-elements from real image containers while preserving true initial-load skeleton states.

## Findings

### Required fixes

None.

### Suggested fixes

None.

## Verification

Reviewed locally:

- Feature handoff: `.hermes/reviews/mobile-skeleton-loading-trim/handoff.md`
- Current diff for the intended feature files:
  - `src/index.css`
  - `src/features/details/UnitDetailsPage.tsx`
  - `src/features/units/UnitsPage.tsx`
  - `src/features/units/UnitsPage.skeleton.test.tsx`
  - `src/App.test.tsx`
- Confirmed unrelated iOS working-tree changes are outside this review scope.

Passed locally:

- `npm run test -- src/App.test.tsx src/features/units/UnitsPage.skeleton.test.tsx --testTimeout=20000` — 58 tests passed
- `git diff --check -- src/index.css src/features/details/UnitDetailsPage.tsx src/features/units/UnitsPage.tsx src/features/units/UnitsPage.skeleton.test.tsx src/App.test.tsx`

## Review notes

- `UnitDetailsPage` now renders `UnitDetailsDeepSections` immediately and no longer mounts `details-loading-skeleton` behind a fixed 320ms timeout.
- `UnitsPage` now shows `UnitListSkeleton` only when `loading && units.length === 0`, so already-rendered rows remain visible during refresh/search loading states.
- The updated unit skeleton tests cover both the empty initial loading case and the quick-refresh case where rows remain visible.
- `src/index.css` no longer applies the always-running shimmer pseudo-elements to `.scope-card-visual`, unit row thumbnails, or upload preview images. The remaining `.skeleton-block` animation is still scoped to actual skeleton components and disabled under `prefers-reduced-motion`.
- No evidence found that initial workspace/auth loading protection was removed.
