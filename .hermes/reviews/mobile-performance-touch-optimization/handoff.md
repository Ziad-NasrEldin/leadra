# Feature Handoff: Mobile performance and touch optimization

## Original request

"in leadra app after i downloaded it to my iphone i noticed i half the time have to double click a button in order for it to register even though i have no touch screen issues at all,
also the performance was horrible it took ages to load after the loading screen and any page takes a lot of time to load
please make a detailed plan in order to optimize it for mobile devices like iphones and android devices too /plan"

## Implementation summary

Implemented the first safe mobile optimization milestone for Leadra:

- Added explicit iPhone Safari and Android Chrome Playwright projects.
- Added a mobile one-tap E2E gate for core nav, filters, destination/project cards, and unit opening.
- Reduced coarse-pointer/mobile transition/stagger timing and made decorative pseudo-elements non-interactive so overlays do not steal taps.
- Added `createSupabaseShellState(profile)` so authenticated users can see the app shell after profile load instead of waiting for full workspace hydration.
- Kept full Supabase workspace hydration, including payment reconciliation, in the background.
- Added hydration generation/auth-user guards so stale workspace loads cannot apply after sign-out, duplicate auth events, or a different login.
- Added remote-search request identity and route validation so stale/out-of-order debounced searches cannot overwrite newer view/route state.
- Gated workspace-dependent views behind `PageSkeleton` while `workspaceHydrating` is true, preventing false empty/not-found/payment/default-settings states before the reconciled workspace is loaded. Profile/palette remain available because they do not depend on full workspace data.
- If full workspace hydration fails, keeps workspace-dependent/payment-sensitive routes blocked behind an explicit workspace-load error state instead of exposing shell defaults.
- Clears stale remote search units/view/loading state whenever a search is invalidated by route changes, sign-out, new shell login, full workspace replacement, hydration failure, or filter reset.

This is not the full future architecture rewrite. Route-scoped pagination/RPCs and production Median-vs-Safari same-device diagnostics remain later milestones.

## Changed files

- `src/App.tsx`
  - Starts authenticated shell after Supabase profile load.
  - Tracks workspace hydration generation, active auth user, and in-flight hydrating auth user.
  - Invalidates workspace hydration and remote searches on sign-out/full refresh/navigation/reset/hydration failure.
  - Prevents duplicate full hydration for the same auth user.
  - Gates dashboard, units, special, create, details, notifications, analytics, and admin with `PageSkeleton` while workspace hydration is pending, and with a no-action error state if full hydration fails.
  - Adds debounced remote filter search with latest-request and current-route checks.
- `src/App.mobileHydration.test.tsx`
  - Adds a mocked Supabase regression test proving `/create` stays gated and does not render the create form if full workspace hydration fails after shell login.
- `src/lib/supabaseState.ts`
  - Adds `createSupabaseShellState(profile)`.
  - Preserves `repository.reconcileDueUnitPayments()` inside `loadSupabaseAppState()` before workspace state is returned.
- `src/lib/supabaseState.test.ts`
  - Covers shell state containing the authenticated profile without demo workspace data.
- `src/index.css`
  - Reduces mobile/coarse pointer animation durations/staggers.
  - Adds `pointer-events: none` to decorative pseudo-elements used by cards/surfaces.
- `playwright.config.ts`
  - Adds explicit `iphone-safari` and `android-chrome` projects.
- `e2e/mobile-touch-reliability.spec.ts`
  - Adds first-tap reliability coverage and `elementFromPoint` center-target checks.

## How to test

Run from `/Users/ziadnasreldin/Documents/GitHub/leadra`:

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run test -- src/lib/repository.test.ts src/lib/supabaseState.test.ts src/App.mobileHydration.test.tsx`
- `npm run test -- src/App.test.tsx --testTimeout=20000`
- `npm run e2e -- e2e/mobile-touch-reliability.spec.ts --project=android-chrome`
- `npm run e2e -- e2e/mobile-touch-reliability.spec.ts --project=iphone-safari`

Expected behavior:

- Mobile controls respond to one tap in both mobile browser projects.
- During Supabase background hydration, workspace-dependent pages show a loading skeleton, not empty dashboards/create forms/details unavailable states.
- If full workspace hydration fails, workspace-dependent pages show an explicit workspace-load error and do not expose unit/payment/admin/create actions against shell defaults.
- Sign-out or a new login invalidates any pending full workspace load.
- Remote search results/loading state are cleared on invalidation, and async results only apply for the latest request and matching route/view.

## Tests run

- `npm run typecheck` — PASS
- `npm run lint` — PASS
- `npm run build` — PASS
- `npm run test -- src/lib/repository.test.ts src/lib/supabaseState.test.ts src/App.mobileHydration.test.tsx` — PASS, 23 tests
- `npm run test -- src/App.test.tsx --testTimeout=20000` — PASS, 56 tests
- `npm run e2e -- e2e/mobile-touch-reliability.spec.ts --project=android-chrome` — PASS, 1 test
- `npm run e2e -- e2e/mobile-touch-reliability.spec.ts --project=iphone-safari` — PASS, 1 test

Notes:

- Build/test output includes Node `DEP0205` warnings from dependencies/tooling, not application test failures.
- `src/App.mobileHydration.test.tsx` intentionally logs the mocked rejected workspace-load error while asserting the guarded error state; the test passes.
- Earlier WebKit E2E required `npx playwright install webkit`; after installation, iPhone Safari E2E passed.

## Git info

- Branch: `main`
- Commit SHA: not committed
- Diff base: current working tree against `HEAD`

## Frontend/backend/database notes

- Frontend routes/components:
  - `App.tsx` authenticated shell, workspace gating, route/search invalidation, mobile nav/touch paths.
  - `PageSkeleton` is used during workspace hydration for workspace-dependent views.
- Backend endpoints/services:
  - No backend API or Supabase schema changes.
  - Existing Supabase repository calls remain in use.
- Database tables/migrations:
  - No migrations.
  - Payment reconciliation remains inside `loadSupabaseAppState()` before reconciled workspace state is applied.

## Reviewer focus areas

- Verify the previous critique items are addressed:
  1. Workspace-dependent views do not render false empty/default/payment-sensitive states while `workspaceHydrating` is true.
  2. Background workspace hydration cannot apply stale state after sign-out, duplicate auth events, or a different auth user login.
  3. Debounced remote searches cannot apply stale/out-of-order results after navigation/view/route changes.
  4. Payment-sensitive screens/actions remain gated until the reconciled full workspace state is applied.
- Check whether additional component/integration tests are required beyond the current mobile E2E and unit coverage.
- Confirm the mobile tap E2E selectors remain robust and cover the core reported double-tap surfaces.

## Fix cycle notes

Previous critique verdict: `REQUIRED_FIXES` in `.hermes/reviews/mobile-performance-touch-optimization/critique.md`.

Fixes made since that critique:

- Added auth-user/generation guards for background workspace hydration.
- Kept duplicate auth-user protection active until full hydration finishes.
- Invalidated hydration and searches on explicit sign-out and Supabase `SIGNED_OUT`.
- Added latest-request and route matching checks to remote unit search.
- Moved route-change remote-search invalidation into an effect to avoid render-time ref writes and pass lint.
- Added `shouldGateWorkspaceView` and skeleton rendering for all workspace-dependent views during hydration.
- Added `workspaceLoadFailed` so failed full hydration keeps workspace-dependent routes blocked behind an explicit error state.
- Cleared `remoteSearchUnits`, `remoteSearchView`, and `remoteSearchLoading` on route-change invalidation, new shell login, sign-out, full workspace refresh, hydration success/failure, and filter reset.
- Added `src/App.mobileHydration.test.tsx` regression coverage for failed full hydration not exposing the create form/shell defaults.
- Re-ran all verification commands listed above after final edits.
