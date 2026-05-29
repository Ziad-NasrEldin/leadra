# Critique Report: Leadra global skeleton loading states

## Verdict

APPROVED

## Summary

The skeleton loading feature adds reusable skeleton primitives and wires them into the main async loading surfaces identified in the handoff: auth/login initialization, remote unit search, analytics metrics, deferred unit-details sections, and media/image placeholders. The implementation is small, typed, and consistent with existing Leadra component/CSS patterns. Relevant automated checks passed, and a browser spot-check confirmed the local Leadra app renders without console errors after Admin role login.

No blocking issues were found in the reviewed skeleton feature scope. The broad request (“add skeletons to everything”) is inherently open-ended; this implementation covers the primary layout/data-loading states but still has optional opportunities to add more polished placeholders for action-level pending states and admin/create-specific flows.

## What was changed

- `src/components/LeadraUi.tsx`: added `SkeletonBlock`, `TextSkeleton`, `MetricSkeletonGrid`, `UnitRowSkeleton`, `UnitListSkeleton`, and `PageSkeleton` primitives.
- `src/index.css`: added global shimmer/skeleton styling, reduced-motion handling, row/form/metric/page skeleton styling, and lazy image placeholder styling.
- `src/App.tsx`: added `remoteSearchLoading`, wired unit/special list skeletons during remote search, rendered a form-shaped skeleton during auth loading, and swapped analytics metric cards for metric skeleton cards while analytics RPC loading is active.
- `src/features/units/UnitsPage.tsx`: added an optional `loading` prop and renders `UnitListSkeleton` in the unit list area while loading.
- `src/features/details/UnitDetailsPage.tsx`: replaced generic details loading spans with `TextSkeleton`-based skeleton content.
- `src/components/LeadraUi.test.tsx`: added primitive/test-hook coverage for skeleton components.
- `src/features/units/UnitsPage.skeleton.test.tsx`: added behavioral coverage that unit skeletons appear during controlled loading and disappear once loading resolves.
- Repository observation: `git status --short` shows many unrelated modified/untracked files in the worktree. I reviewed the skeleton files listed in the handoff and did not treat unrelated dirty files as part of this feature, except where shared checks exercised them.

## Required fixes

| ID | Severity | Area | Issue | Evidence | Required fix |
|----|----------|------|-------|----------|--------------|
| None | - | - | No blocking skeleton-feature issues found. | `npm run typecheck`, `npm run lint`, focused Vitest, full Vitest, and production build all passed. Browser spot-check at `http://127.0.0.1:5176/units` rendered Leadra Unit desk after Admin login with no console errors. | None required. |

## Improvements

| ID | Priority | Area | Suggestion | Why it matters |
|----|----------|------|------------|----------------|
| I1 | Medium | UX/Test | Add an integration-style test around the real `loadRemoteUnitSearch` flow, ideally with a mocked repository/Supabase delay, to prove `remoteSearchLoading` appears during the async wait and clears on success and failure. | Current behavior is covered at the `UnitsPage` prop level, but not through the actual App remote-search path where stuck-loading/race regressions are most likely. |
| I2 | Low | UX | Consider skeleton or more structured pending states for remaining action-level waits such as create-unit submission, PDF generation/download/share, and admin password/profile saves if the product expectation is literally “skeletons everywhere.” | These are not layout/data-loading blockers, but the original request was broad; documenting or covering these surfaces would make the scope feel more complete. |
| I3 | Low | Release hygiene | Before committing/releasing, isolate skeleton changes from the unrelated dirty working-tree changes or explicitly include those changes in a separate reviewed handoff. | `git status --short` shows unrelated admin/domain/repository/Supabase/report changes. Separating them reduces review and deployment risk. |
| I4 | Low | Accessibility | If skeleton loading persists for more than a moment, consider `role="status"`/polite live text on the loading container instead of only `aria-label` on generic wrappers. | Existing labels are observable, but a status role can make longer loading waits clearer to assistive technology without exposing every decorative skeleton block. |

## Tests performed

- Read handoff: `/Users/ziadnasreldin/Documents/GitHub/leadra/.hermes/reviews/leadra-global-skeletons/handoff.md`.
- Inspected git status and skeleton-related diffs with:
  - `git status --short`
  - `git diff -- src/components/LeadraUi.tsx src/index.css src/App.tsx src/features/units/UnitsPage.tsx src/features/details/UnitDetailsPage.tsx src/components/LeadraUi.test.tsx src/features/units/UnitsPage.skeleton.test.tsx`
- Ran focused verification:
  - `npm run typecheck && npm run lint && npm test -- --run src/components/LeadraUi.test.tsx src/features/units/UnitsPage.skeleton.test.tsx`
  - Result: PASS. Typecheck passed, lint passed, 2 focused test files passed, 5 tests passed.
- Ran broader verification:
  - `npm test && npm run build`
  - Result: PASS. Vitest passed 14 files / 180 tests. Production build passed; Vite emitted built assets under `dist/`.
- Browser/runtime spot-check:
  - Confirmed a dev server was listening on `127.0.0.1:5176` via `lsof -iTCP:5176 -sTCP:LISTEN -n -P`.
  - Opened `http://127.0.0.1:5176/units`.
  - Logged in through local role preview as Admin.
  - Observed Leadra Unit desk rendered with unit rows and navigation.
  - Browser console check returned no console messages and no JavaScript errors.

## Tests still needed

- Optional manual slow-network or mocked-delay browser check to visually confirm the transient auth, analytics, and remote-search skeleton states during real async waits.
- Optional mobile viewport visual QA for the new skeleton rows/cards, especially the `:has(img)` media placeholder styling and selectable unit-row skeleton layout.
- Optional accessibility pass with a screen reader if long-running skeleton states become common.

## Dev-agent instructions

1. No required fixes are needed for the skeleton feature scope.
2. Consider adding an App-level remote-search loading test that covers success and error cleanup of `remoteSearchLoading`.
3. Consider documenting whether action-level pending states are intentionally out of scope for “skeletons everywhere,” or add placeholders where product wants them.
4. Keep skeleton changes separated from unrelated dirty-tree changes before commit/deployment, or create separate handoffs for the unrelated work.
5. If any improvements are implemented, update the handoff and request re-review.
