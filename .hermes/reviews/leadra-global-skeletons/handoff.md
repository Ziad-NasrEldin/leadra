# Feature Handoff: Leadra global skeleton loading states

## Original request

User asked: "in the leadra project i wnat you to add skeletons to everything /plan" and then asked to implement/continue the plan.

## Implementation summary

- Added shared skeleton UI primitives to the existing Leadra UI component module.
- Added global skeleton/shimmer CSS that matches the Leadra surface/card language and respects reduced-motion preferences.
- Replaced or augmented visible async/loading surfaces with layout-matched skeletons:
  - auth/login initial loading screen
  - unit remote-search/loading rows
  - analytics metric loading
  - deferred unit-details deep sections
  - media/image placeholder shimmer styling for lazy-loaded images
- Added behavioral loading coverage for units: skeleton visible while `loading=true`, then removed when data renders.
- Added primitive tests to ensure skeleton wrappers expose stable DOM/test hooks.

## Changed files

Skeleton feature files:

- `src/components/LeadraUi.tsx`: added `SkeletonBlock`, `TextSkeleton`, `MetricSkeletonGrid`, `UnitRowSkeleton`, `UnitListSkeleton`, and `PageSkeleton` shared primitives.
- `src/index.css`: added global skeleton styles, shimmer animation, page/form/metric/unit-row/details skeleton styling, media image shimmer, and reduced-motion handling.
- `src/App.tsx`: imported skeleton primitives; added `remoteSearchLoading`; wired unit remote-search loading into units/special pages; rendered form page skeleton during auth loading; rendered metric skeleton grid during analytics loading.
- `src/features/units/UnitsPage.tsx`: added optional `loading` prop and renders `UnitListSkeleton` in the unit-list area while loading.
- `src/features/details/UnitDetailsPage.tsx`: replaced generic deferred loading spans with `TextSkeleton`-based details skeleton.
- `src/components/LeadraUi.test.tsx`: added skeleton primitive tests.
- `src/features/units/UnitsPage.skeleton.test.tsx`: added controlled loading behavioral test.

Repository note:

- The working tree already contains many unrelated modified/untracked files from previous Leadra work. This review should focus on the skeleton feature files above and avoid treating unrelated permission/domain/admin/supabase/report changes as part of this feature unless they directly affect tests.

## How to test

Local app URL confirmed:

- Correct Leadra dev app: `http://127.0.0.1:5176/units`
- Port 5173 and 5174 were occupied by/still serving another Vite app (`Zoid AI`), so they are not valid for this browser spot-check.

Manual/browser check performed:

1. Opened `http://127.0.0.1:5176/units`.
2. Logged in through local role preview as Admin.
3. Confirmed the rendered app identity is Leadra (`title: Leadra`, visible `Unit desk`).
4. Inspected Unit desk layout visually: no obvious broken skeleton/style artifacts; cards/rows/buttons render cleanly.
5. Browser console check: no console messages and no JS errors.

Expected skeleton behavior:

- During auth loading: a form-shaped skeleton appears instead of blank login UI.
- During remote unit search: unit rows are replaced with row-shaped skeletons and restored after data resolves.
- During analytics loading: metric cards are replaced with metric skeleton cards.
- During deferred unit details loading: details content uses text skeleton blocks instead of generic anonymous spans.

## Tests run

- `npm run typecheck && npm run lint && npm run test && npm run build`: PASS
  - Typecheck: PASS
  - Lint: PASS
  - Vitest: PASS, 14 test files, 180 tests
  - Build: PASS, Vite production build completed
- Browser HTTP/app identity check:
  - `curl -I http://127.0.0.1:5176/`: PASS 200 OK
  - Browser snapshot showed Leadra Unit desk after Admin login
  - Browser console: PASS, no JS errors

Known non-blocking warnings:

- Vitest prints Node/localStorage experimental/deprecation warnings under Node v26. These did not fail tests.

## Git info

- Branch: `main`
- Commit SHA: not committed
- Diff base: local working tree is dirty with unrelated pre-existing changes; use changed file list above for review focus.

## Frontend/backend/database notes

- Frontend routes/components:
  - `/units`, `/special`, `/analytics`, login/auth loading surface, unit details deferred sections.
- Backend endpoints/services:
  - No backend logic changes for skeleton feature.
- Database tables/migrations:
  - No database changes for skeleton feature.

## Reviewer focus areas

- Verify skeleton primitives forward DOM props correctly and remain accessible/non-annoying.
- Verify loading branches do not hide error or empty states after loading completes.
- Verify unit remote-search loading state cannot get stuck true on error.
- Verify skeleton CSS does not unintentionally affect real cards/rows/images after data loads.
- Verify coverage is acceptable for the broad request “add skeletons to everything,” especially whether admin/create/media-specific async surfaces still need more explicit skeleton branches.
- Be careful with unrelated dirty working-tree files: focus findings on the skeleton feature unless unrelated changes break the verified test suite or runtime.

## Fix cycle notes

Initial handoff after implementation and verification. Critique approval pending.
