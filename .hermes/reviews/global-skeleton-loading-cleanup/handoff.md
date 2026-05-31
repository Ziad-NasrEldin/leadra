# Feature Handoff: Global skeleton loading cleanup

## User issue

User clarified that the bad skeleton behavior was global, not just Unit Details: admin pages, profile, analytics, create, and other screens could be delayed by animated skeleton screens even when the final page would render faster without them.

## Scope

Treat skeletons as an explicit cost on mobile. Remove route-level and analytics skeleton gates that were making screen transitions feel slower across the app. Preserve only non-animated/static waits for real auth/workspace hydration and preserve unit-list skeletons only for true empty initial data waits.

## Current changes

### `src/App.tsx`

1. Removed app-level route skeleton dependency:
   - Removed `PageSkeleton` import.
   - Removed `MetricSkeletonGrid` import.
   - Removed `workspaceSkeletonKind` mapping for dashboard/create/details/admin/analytics/units/special.

2. Replaced workspace hydration route skeletons:
   - Before: while `workspaceHydrating`, every route except profile/palette showed `<PageSkeleton kind={workspaceSkeletonKind} />`.
   - After: while `workspaceHydrating`, app shows a static `EmptyState`-based workspace loading card with `data-testid="workspace-loading-state"`.
   - On failure it shows the existing workspace error copy with `data-testid="workspace-error-state"`.
   - This keeps workspace-dependent routes gated during real remote hydration, but does not run animated skeleton layouts.

3. Replaced auth-loading form skeleton:
   - Before: `LoginScreen` returned `<PageSkeleton kind="form" />` during `authLoading`.
   - After: it returns a static branded login shell with logo/theme/heading/copy and no skeleton blocks.

4. Removed analytics skeleton gates:
   - Removed `showAnalyticsDepth` state that always initialized to `true` and existed only to support a dead skeleton branch.
   - Removed `MetricSkeletonGrid` during analytics refresh.
   - Analytics metrics now remain rendered and use `aria-busy={analyticsLoading}` while refreshing.
   - Removed `AnalyticsSkeleton` component and its fallback branches.

### `src/App.mobileHydration.test.tsx`

Updated hydration failure test to expect `workspace-loading-state` instead of `form-page-skeleton` after sign-in begins workspace hydration.

## Verification already run

1. Typecheck/lint/tests/build:

```bash
npm run typecheck && npm run lint && npm run test -- src/App.test.tsx src/App.mobileHydration.test.tsx src/features/units/UnitsPage.skeleton.test.tsx src/components/LeadraUi.test.tsx --testTimeout=20000 && npm run build
```

Result: PASS
- 4 test files passed
- 65 tests passed
- Build passed

2. Mobile E2E:

```bash
npm run e2e -- e2e/mobile-touch-reliability.spec.ts --project=android-chrome --project=iphone-safari
```

Result: PASS
- iPhone Safari: passed
- Android Chrome: passed

3. Diff hygiene:

```bash
git diff --check
```

Result: PASS

4. Browser route scan on local dev server:

Visited/scanned:
- `/dashboard`
- `/units`
- `/special`
- `/create`
- `/alerts`
- `/analytics`
- `/admin`
- `/profile`

Result: no `.skeleton-block` or `[class*=skeleton]` elements with active animation or skeleton classes on rendered pages.

## Important reviewer checks

- Verify that no `PageSkeleton` or `MetricSkeletonGrid` is imported or used by `src/App.tsx`.
- Verify that workspace hydration still gates workspace-dependent routes; do not allow admin/units/create/etc to render incomplete shell data while `workspaceHydrating` is true.
- Verify that the replacement loading state is static, not shimmer/skeleton based.
- Verify analytics refresh no longer swaps metrics/charts for skeletons.
- Verify profile remains available during workspace hydration, matching previous behavior.
- Confirm no unrelated files were edited by this feature beyond `src/App.tsx` and `src/App.mobileHydration.test.tsx` for this global pass.

## Current git state expected

Modified:
- `src/App.tsx`
- `src/App.mobileHydration.test.tsx`

There may also be review files created under `.hermes/reviews/global-skeleton-loading-cleanup/`.
