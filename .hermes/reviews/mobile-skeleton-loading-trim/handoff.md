# Feature Handoff: Mobile skeleton loading trim

## Original request

User reported that Leadra loading skeletons keep animating even when pages are already rendered, and that some fast pages do not need skeletons. Request: explain why and fix it.

## Implementation summary

- Removed the always-running decorative shimmer pseudo-elements from real image containers (`scope-card-visual`, unit row thumbnails, upload previews). These were not real loading skeletons; they animated forever whenever an image existed, which made rendered pages look like they were still loading.
- Removed the forced Unit Details deferred skeleton. Details deep sections now render immediately with the rest of the page instead of showing a 320ms artificial skeleton despite the page already having data.
- Updated Units list behavior so loading skeleton rows only replace the list when there are no units to show yet. If rows are already rendered during a quick refresh/search, the app keeps the visible rows instead of swapping back to skeletons.
- Kept true initial-load skeletons intact for workspace/auth gating and empty list waits.

## Changed files

- `src/index.css`: removed persistent image shimmer pseudo-elements and stale details-loading skeleton CSS.
- `src/features/details/UnitDetailsPage.tsx`: removed forced detail-depth timeout/skeleton and renders deep detail sections immediately.
- `src/features/units/UnitsPage.tsx`: only shows `UnitListSkeleton` when `loading && units.length === 0`.
- `src/features/units/UnitsPage.skeleton.test.tsx`: adjusted controlled wait test to use empty rows, added regression that rendered rows stay visible during quick loading refreshes.
- `src/App.test.tsx`: updated details test to assert the removed details skeleton is absent and adjusted duplicated BUA assertion caused by immediate detail rendering.

## How to test

- Local URL: `http://127.0.0.1:5187/dashboard`
- Demo login: Continue as Admin.
- Expected:
  - Dashboard with loaded data has no animated skeleton/image shimmer surfaces.
  - Units list with rendered rows has no `unit-list-skeleton` during normal browsing/quick refreshes.
  - Unit Details renders details immediately; no `details-loading-skeleton` flash.
  - Initial workspace/auth waits can still show page skeletons.

## Tests run

- `npm run typecheck`: PASS
- `npm run lint`: PASS
- `npm run test -- src/App.test.tsx src/features/units/UnitsPage.skeleton.test.tsx src/App.mobileHydration.test.tsx src/components/LeadraUi.test.tsx --testTimeout=20000`: PASS, 65 tests
- `npm run build`: PASS
- `npm run e2e -- e2e/mobile-touch-reliability.spec.ts --project=android-chrome --project=iphone-safari`: PASS, 2 tests
- `git diff --check`: PASS
- Browser verification on local dev server:
  - Dashboard after demo admin login: no matching animated skeleton/image shimmer elements.
  - Units page after View All Units: no matching animated skeleton/image shimmer elements.
  - Details deep link after demo admin login: no `details-loading-skeleton`; no matching animated skeleton elements.

## Git info

- Branch: `main`
- Commit SHA: not committed in this feature session.
- Note: unrelated iOS files were already modified in the working tree and are intentionally excluded from this handoff. Feature diff is limited to the five `src/` files listed above.

## Frontend/backend/database notes

- Frontend only.
- No backend endpoint changes.
- No database/schema changes.

## Reviewer focus areas

- Verify no real loading protection was removed from initial auth/workspace waits.
- Verify rendered rows/details are not hidden behind unnecessary skeletons.
- Verify decorative image surfaces no longer animate forever after content is loaded.
- Verify mobile touch behavior remains unaffected.

## Fix cycle notes

Initial review request.
