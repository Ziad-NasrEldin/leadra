# Feature Handoff: Mobile performance follow-up optimization

## Original request

After the first mobile optimization was deployed and production E2E reported remaining slower timings, the user asked: "then continue on, use delegation and sub agents whenever you feel its the best to do so"

## Implementation summary

Implemented a focused follow-up optimization for the remaining slow mobile route transitions:

- Used two investigation subagents to profile/read the code and identify root causes.
- Reduced the artificial Unit Details deep-content delay from 1800ms to 320ms, while preserving a short deferred render for heavy sections.
- Reworked the Unit Details deferred state so switching units resets to skeleton without a synchronous setState inside an effect.
- Memoized expensive authenticated App unit computations before render:
  - route state
  - visible units
  - destination summaries
  - project summaries
  - selected unit
  - effective inventory filters
  - inventory search results
  - special-unit search results
  - displayed special units
  - selected batch units using a Set
- Scoped heavy destination/project summaries and unit search work to the relevant active views, so details/dashboard/profile renders do not recompute full inventory lists unnecessarily.
- Changed project-card selection to navigate first, then the route-change effect deterministically clears stale remote state and schedules a cancelable project remote search on the next task.
- Updated the existing UnitDetailsPage timer-backed test from 1800ms to 320ms.
- Added a Supabase-mode regression test proving project route navigation settles before the project remote search runs with the intended destination/project IDs.

## Changed files

- `src/App.tsx`
  - Adds pre-auth-return memoized computation block for route/unit/search/summaries.
  - Reuses memoized values after authenticated guard.
  - Restricts inventory/special search work to relevant views.
  - Schedules project remote search from the route-change effect after clearing stale remote state, using the existing cancelable `remoteSearchDebounceRef`/request-id guards.
- `src/features/details/UnitDetailsPage.tsx`
  - Changes deep details deferral from 1800ms to 320ms.
  - Tracks `{ unitId, visible }` so a new unit hides deep content until the short timer completes without synchronous effect reset.
- `src/App.test.tsx`
  - Updates the details payment schedule test timer to 320ms.
- `src/App.mobileHydration.test.tsx`
  - Adds a configured-Supabase regression test for project route navigation followed by remote project search.

## How to test

Run from `/Users/ziadnasreldin/Documents/GitHub/leadra`:

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run test -- src/App.test.tsx src/App.mobileHydration.test.tsx src/lib/supabaseState.test.ts --testTimeout=20000`
- `npm run e2e -- e2e/mobile-touch-reliability.spec.ts --project=android-chrome`
- `npm run e2e -- e2e/mobile-touch-reliability.spec.ts --project=iphone-safari`

Expected behavior:

- Mobile controls still work with one tap.
- Unit details deep sections appear after ~320ms instead of 1800ms.
- Details route changes do not perform full units/project summary/search recomputation unless needed for the active view.
- Project card navigation paints route state before remote project search starts.
- Workspace hydration/error safety from the previous approved milestone remains intact.

## Tests run

- `npm run typecheck` — PASS
- `npm run lint` — PASS
- `npm run build` — PASS
- `npm run test -- src/App.test.tsx src/App.mobileHydration.test.tsx src/lib/supabaseState.test.ts --testTimeout=20000` — PASS, 59 tests
- `npm run e2e -- e2e/mobile-touch-reliability.spec.ts --project=android-chrome` — PASS, 1 test
- `npm run e2e -- e2e/mobile-touch-reliability.spec.ts --project=iphone-safari` — PASS, 1 test

## Git info

- Branch: `main`
- Commit SHA: not committed yet for this follow-up
- Diff base: current working tree against `HEAD`

## Frontend/backend/database notes

- Frontend routes/components:
  - `App.tsx` authenticated route state, inventory summaries/search, project navigation.
  - `UnitDetailsPage.tsx` deep details render deferral.
- Backend endpoints/services:
  - No backend API changes.
  - Existing remote search still uses `loadRemoteUnitSearch`; it is scheduled by the route-change effect after navigation and stale-state cleanup.
- Database tables/migrations:
  - No migrations.

## Reviewer focus areas

- Confirm no React Hooks rule violation from moving memoized work before the authenticated return.
- Confirm memoized search/summaries do not break units/special/details rendering.
- Confirm details deep sections still reset when switching between units.
- Confirm the route-effect remote project search avoids stale/racy project-page results and remains cancelable on rapid navigation.
- Confirm mobile one-tap E2E and hydration safety still pass.

## Fix cycle notes

Addressed first critique (`REQUEST_CHANGES`):

- Fixed racy project remote-search deferral by moving scheduling into the route-change effect after stale remote state/request IDs are cleared and `activeRouteRef` is updated.
- Uses the existing `remoteSearchDebounceRef` cleanup path, so rapid route changes clear the scheduled project search before it fires.
- Added `src/App.mobileHydration.test.tsx` coverage for configured-Supabase project route navigation followed by one remote search with the expected destination/project IDs.
- Re-ran typecheck, lint, build, focused tests, and Android/iPhone mobile E2E successfully.
