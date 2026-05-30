# Leadra Mobile Performance and Touch Reliability Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task. Because this changes user-facing app behavior, completion requires the feature-critique-workflow: create `.hermes/reviews/mobile-performance-touch-optimization/handoff.md`, run critique-agent review, fix every Required fix, and re-review until verdict is APPROVED.

**Goal:** Make Leadra feel reliable and fast on iPhone and Android: first taps register, login/session hydration is shorter, route changes are responsive, and heavy pages do not block the main thread.

**Architecture:** Treat this as two linked problems: (1) touch/click reliability caused by overlays, route-transition timing, delayed hydration, disabled/loading states, or expensive synchronous render work; (2) mobile performance caused by loading too much Supabase data and rendering too much UI at startup/page transitions. Add instrumentation first, reproduce on real mobile viewports, then optimize data loading, render paths, CSS overlays, and touch targets with regression tests.

**Tech Stack:** React 19, Vite 8, TypeScript, React Router 7, TanStack Query, Supabase, Vitest, Playwright, CSS in `src/index.css`.

---

## Observed context from repo inspection

- App entry/provider setup: `src/main.tsx` creates a default `QueryClient` with no mobile-friendly stale/cache/retry policy yet.
- Main app shell: `src/App.tsx` is very large and owns auth hydration, route state, refresh subscriptions, and many heavy UI flows.
- Current login/session path in `src/App.tsx:424-461` does this sequentially:
  - `loadSupabaseProfile`
  - `markSupabaseLogin`
  - `loadSupabaseAppState`
  - set full app state only after all data has loaded
- Current remote app load in `src/lib/supabaseState.ts:75-89` does all major data fetches at once after first running `repository.reconcileDueUnitPayments()`:
  - users
  - units
  - branches
  - teams
  - lookup values
  - settings
  - notifications
  - audit logs
  - analytics events
  - analytics targets
- `src/components/LeadraUi.tsx:603-635` has shared `NavButton` links/buttons but no touch instrumentation or disabled/pending guard.
- CSS has many pseudo-elements/absolute/fixed layers in `src/index.css`; prior Leadra work already has a known pitfall where decorative overlays or skeletons can intercept real controls unless `pointer-events: none` and stacking contexts are verified.
- Existing commands from `package.json`:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `npm run e2e`
  - `npm run perf:audit`

## Non-goals / boundaries

- Do not redesign the product or change Leadra domain rules.
- Do not remove existing role permissions, PDF workflows, unit archive/restore behavior, or Supabase persistence guarantees.
- Do not expose internal implementation details in production UI.
- Do not call this done after desktop-only tests; mobile viewport and real iOS app testing are required.
- Resolved boundary: the user's iPhone issue was observed in a real installed iOS app, not merely Safari/Add-to-Home-Screen. The iOS app was built with Median, a no-code WebView/app wrapper, and this repo does not contain the wrapper source. Keep Median for the current optimization cycle; first optimize the Leadra web app and audit Median settings. Future wrapper strategy: stay on Median while Leadra is mainly a wrapped web app and Median does not block touch/performance; move to an Xcode-maintained WKWebView wrapper only if Median-specific behavior remains a blocker, native features are needed, or App Store/release control becomes important enough to justify maintenance.
- Architecture decision recorded: `docs/adr/0001-route-scoped-mobile-data-loading.md`.

## Performance targets

Use these as acceptance targets unless real production data proves they need adjustment:

- Caching strategy: use stale-while-revalidate for mobile data, not offline-first. App shell/assets can be cached aggressively by normal browser/CDN caching, but operational data should revalidate on app resume/route open; writes must always hit the server and refresh affected records. Offline writes are out of scope for this optimization cycle; weak/offline connections may show safe read-only cached data, while edits/status/payment/uploads/PDF/admin actions require online server confirmation and a clear connection-required message.
- iPhone/Android tap reliability: first tap on visible enabled controls succeeds in at least 99% of tested interactions; no button requires a second tap because an overlay, route sync, or loading state ate the first tap. First-tap reliability is a release blocker: any visible enabled core-flow button/link must respond to one tap, route/nav taps must give immediate feedback, and temporarily unavailable controls must be visibly disabled/loading before the user taps.
- Initial authenticated usable UI:
  - Targets are measured on production build in iPhone Safari and the Median iOS app, using the same production/staging account and normal 4G/Wi-Fi. Cold open and warm resume should be recorded separately.
  - Shell/dashboard skeleton visible within 1 second on Fast 4G mobile profile.
  - First interactive dashboard content within 2.5 seconds for normal accounts.
  - Full background hydration may continue after first usable screen.
- Route transitions:
  - Tapping bottom/sidebar/nav buttons gives immediate visual feedback within 100ms.
  - Target page skeleton/content appears within 500ms even if data is still loading.
  - Units first page appears within 2 seconds after route open on normal connection.
  - Server-side search results appear within 1.5 seconds after debounce on normal connection.
- Main-thread responsiveness:
  - No Long Task above 100ms during common navigation on mobile profile, or each remaining Long Task is documented with a mitigation/follow-up.
- Bundle/runtime:
  - Production build passes.
  - No large, page-specific work is loaded/executed before it is needed if it can be route/lazy loaded safely.

---

## Implementation milestones

### Milestone 1: Diagnostics and first-tap fixes

- Run Safari-vs-Median truth test.
- Capture Median settings audit.
- Add mobile E2E tap tests.
- Fix CSS overlay/pointer-event blockers.
- Fix route/nav tap feedback and route-sync races.
- May ship independently as an urgent patch only if production build passes, core one-tap flows pass in both iPhone Safari and Median, auth/Units/Create/Admin basics do not regress, and release notes clearly state broader performance optimization is still pending.

### Milestone 2: Startup hydration split

- Load auth/profile first.
- Render app shell/current route quickly after valid profile.
- Defer notifications, admin, analytics, audit, and PDF-heavy data.
- Move payment reconciliation off global startup and protect payment-sensitive surfaces with updating/warning states.

### Milestone 3: Units pagination/search/details

- Implement server-side paginated Unit list/search/filter.
- Use 20 Units/page mobile and 50 desktop/tablet initially.
- Add direct Unit Details fetch by ID.
- Keep batch selection page-scoped.
- Add exact role-safe Dashboard summary query/RPC.

### Milestone 4: Mobile validation/release

- Validate production URL in iPhone Safari.
- Validate Median iOS app with same core flows.
- Validate Android Chrome production URL.
- Validate Android Median/app wrapper if one exists in production.
- iPhone Safari + Median iOS are the primary blockers because the observed issue came from the installed iPhone app; Android remains required before full release but is secondary during initial diagnosis unless an Android wrapper is already in production.
- Produce before/after performance report.
- Complete feature handoff and critique approval loop.

---

## Phase 1: Reproduce and measure before changing code

### Task 0: Run Safari-vs-Median truth test first

**Objective:** Determine whether the main bottleneck is Leadra web code, Median wrapper behavior, or both before optimizing deeply.

**Files:**
- Output: `reports/mobile-performance-baseline/safari-vs-median.md`

**Steps:**
1. On the same iPhone, same account, same network, open the production Leadra URL in iPhone Safari.
2. Run the exact same flow in the Median-installed iOS app:
   - cold open
   - login/session restore
   - wait past loading screen
   - tap the suspected buttons once
   - navigate dashboard -> units -> details -> create/admin if permitted
3. Record timings and tap reliability separately for Safari and Median.
4. Classify the bottleneck:
   - Safari slow + Median slow = web app/data/rendering problem
   - Safari fast + Median slow = Median wrapper/settings problem
   - Safari reliable + Median double-tap = Median overlay/injected script/touch handling problem
   - Both slow but Median worse = fix Leadra first, then tune Median

**Expected result:** The implementation path is chosen from evidence instead of guessing.

### Task 0B: Capture Median wrapper settings audit

**Objective:** Treat Median as part of the production runtime, not a black box, and preserve evidence for wrapper-specific touch/performance issues.

**Files:**
- Output: `reports/mobile-performance-baseline/median-settings-audit.md`

**Steps:**
1. Record Median app target URL.
2. Record splash/loading screen behavior and duration settings.
3. Record injected scripts/plugins/native features enabled.
4. Record native navigation/header/tab settings and whether any Median UI can overlay the web app.
5. Record pull-to-refresh, bounce/scroll, cache, safe-area, external-link, and WebView-related settings visible in Median.
6. Record iOS app version/build date before and after rebuilding.
7. Attach screenshots or exported config where Median allows it.

**Expected result:** Wrapper behavior can be compared against Safari and Leadra web code instead of guessed.

### Task 1: Establish clean branch and baseline

**Objective:** Start from a known state and capture current performance/touch behavior.

**Files:**
- Inspect: `package.json`
- Create later: `.hermes/reviews/mobile-performance-touch-optimization/handoff.md`
- Create later: `reports/mobile-performance-baseline/`

**Steps:**
1. Run `git status --short` and record existing changes/untracked files.
2. Create a working branch such as `fix/mobile-performance-touch`.
3. Run baseline gates:
   - `npm run typecheck`
   - `npm run test`
   - `npm run build`
4. Run existing app performance audit:
   - `npm run perf:audit`
5. Save outputs or note failures in the handoff.

**Expected result:** Current failures, if any, are separated from new regressions.

### Task 2: Add mobile diagnostic Playwright specs

**Objective:** Reproduce “tap needs double click” and slow post-loading navigation using automated mobile viewports.

**Files:**
- Create: `tests/e2e/mobile-touch-reliability.spec.ts`
- Create or modify if present: `playwright.config.ts`
- Optional create: `tests/e2e/helpers/mobile.ts`

**Steps:**
1. Add iPhone and Android-sized projects if they do not already exist:
   - iPhone 13/14 viewport/device descriptor
   - Pixel 7/Android viewport/device descriptor
2. Add a helper that logs in using existing test credentials/env conventions.
3. Test first-tap behavior on high-value controls:
   - login submit
   - sidebar/mobile menu toggle
   - dashboard nav
   - Units nav
   - Unit row/details link
   - Create Unit step navigation
   - Admin/Master Data tabs if role permits
   - status/special/archive action buttons where safe fixtures exist
4. For every tested button/link, evaluate at its center:
   - `document.elementFromPoint(x, y)` before tapping
   - the returned element is the button/link itself or a valid child
   - not a pseudo/overlay container, toast region, skeleton, shimmer, modal backdrop, or decoration
5. Perform one tap only and assert the intended state changes.

**Expected result:** At least one failing/diagnostic test captures the double-tap issue, or the tests prove automation cannot reproduce it and manual device logging is needed.

### Task 3: Add mobile performance trace script

**Objective:** Capture timings for startup and route transitions on mobile CPU/network profiles.

**Files:**
- Create: `scripts/mobile-performance-audit.mjs`
- Modify: `package.json`
- Output: `reports/mobile-performance/`

**Steps:**
1. Add `npm run perf:mobile` script.
2. Use Playwright against production build preview, not dev server only.
3. Capture:
   - auth/session load duration
   - time to login screen
   - time to first dashboard skeleton
   - time to first dashboard content
   - route transition durations for dashboard -> units -> details -> create -> admin
   - Long Tasks via PerformanceObserver or trace parsing
   - JS heap/DOM node counts where available
4. Save JSON and HTML/text summary under `reports/mobile-performance/`.

**Expected result:** A repeatable before/after benchmark exists.

---

## Phase 2: Fix first-tap/touch reliability

### Task 4: Inventory every mobile-interactive surface

**Objective:** Make sure the fix covers all visible controls, not only the one the user happened to notice.

**Files to inspect:**
- `src/App.tsx`
- `src/components/LeadraUi.tsx`
- `src/features/units/UnitsPage.tsx`
- `src/features/details/UnitDetailsPage.tsx`
- `src/features/create/CreateUnitPage.tsx`
- `src/features/admin/AdminPage.tsx`
- `src/features/admin/UserManagement.tsx`
- `src/features/admin/MasterData.tsx`
- `src/index.css`

**Inventory must include:**
- route-level pages/screens
- shared layout/sidebar/topbar/mobile menu
- `NavButton`
- `BrandedSelect` / native lookup select
- password toggle
- unit list row actions
- PDF/share/download controls
- upload/remove media controls
- create-unit wizard buttons
- admin tabs/actions
- toast area
- loading/skeleton states
- empty/error/disabled states
- authenticated and unauthenticated states

**Expected result:** A checklist in the handoff/report names every surface and confirms whether it was tested/fixed.

### Task 5: Audit CSS overlays and pseudo-elements for pointer blocking

**Objective:** Remove the most likely cause of “first tap does nothing”: invisible overlays covering controls.

**Files:**
- Modify: `src/index.css`
- Test: `tests/e2e/mobile-touch-reliability.spec.ts`

**Steps:**
1. Search `src/index.css` for every `::before`, `::after`, `position: fixed`, `position: absolute`, `inset: 0`, `z-index`, skeleton, shimmer, backdrop, loading, and card decoration rule.
2. For every decorative/non-interactive layer, require:
   - `pointer-events: none`
   - lower stacking than actual controls
3. For every interactive child inside media/cards, ensure controls have explicit stacking if needed:
   - `position: relative`
   - `z-index` above decorative layer
4. Verify `.toast-region` remains non-blocking except actual toast content.
5. Verify skeletons never render above active controls after content is available.

**Expected result:** `elementFromPoint` tests show actual controls receive taps.

### Task 6: Add immediate pending feedback without swallowing navigation taps

**Objective:** Make taps feel instant while avoiding repeated async actions.

**Files:**
- Modify: `src/components/LeadraUi.tsx`
- Modify likely: `src/App.tsx`
- Modify likely feature components that receive busy props
- Test: `tests/e2e/mobile-touch-reliability.spec.ts`

**Steps:**
1. Extend shared button/nav patterns only where useful; do not globally disable links before navigation starts.
2. For async mutation buttons, set a local pending state synchronously inside the first tap handler.
3. Never set a full-screen invisible loading layer over the current page during route navigation.
4. Keep disabled states visible and explainable.
5. Add tests that tap once and see either navigation or a visible pending state immediately.

**Expected result:** No user-visible enabled control needs a second tap to confirm intent.

### Task 7: Remove route-sync races that can undo the first tap

**Objective:** Ensure a tap on navigation changes route once and is not immediately reset by `hashchange`, `popstate`, deferred state, or stale view state.

**Files:**
- Modify likely: `src/App.tsx`
- Inspect: `src/lib/routes.ts`
- Test: `tests/e2e/mobile-touch-reliability.spec.ts`

**Steps:**
1. Inspect `syncRouteFromLocation` in `src/App.tsx:485-510`.
2. Confirm `Link to=...` and manual `routerNavigate(...)` paths do not double-handle the same navigation.
3. Prefer route-derived rendering where possible instead of duplicated `view` state for page selection.
4. If full removal is too risky, add guards so the first route update is not overwritten by stale state.
5. Add E2E test: tap each nav once, assert URL and page heading update once.

**Expected result:** Route changes are deterministic on mobile taps.

---

## Phase 3: Speed up auth/session loading

### Task 8: Split critical auth profile from full workspace hydration

**Objective:** Stop blocking the app after login/session restore on all app data.

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/lib/supabaseState.ts`
- Test: `src/App.test.tsx` or new `src/lib/supabaseState.test.ts`
- E2E: `tests/e2e/mobile-performance.spec.ts`

**Current issue:** `completeSupabaseLogin` waits for `loadSupabaseAppState` before setting `currentUser`; `loadSupabaseAppState` loads almost everything.

**Target behavior:**
1. Load profile first.
2. Set `currentUser` and render the app shell/dashboard skeleton immediately after profile is valid.
3. Resolved decision: prioritize perceived speed over full upfront data completeness. The first usable screen should not wait for audit logs, analytics events/targets, full admin user lists, old notifications, or other historical/background data.
4. Load only critical dashboard/unit-list data needed for the initial route.
5. Hydrate lower-priority data in the background.
6. Show targeted skeletons for not-yet-loaded sections instead of blocking the whole app.

**Implementation shape:**
- Introduce loading state such as:
  - `workspaceHydrationStatus: 'idle' | 'critical' | 'ready' | 'background' | 'error'`
  - or React Query queries keyed by data domain.
- Keep `authLoading` limited to auth/session/profile, not the entire workspace.
- Move `markSupabaseLogin` so it does not block first usable render; run it after profile load or in background.

**Expected result:** Existing loading screen disappears earlier; app shell is visible while non-critical data hydrates.

### Task 9: Split Supabase data loading into critical and deferred loaders

**Objective:** Fetch less data at startup and avoid expensive all-table hydration.

**Files:**
- Modify: `src/lib/supabaseState.ts`
- Modify: `src/lib/repository.ts`
- Modify: `src/App.tsx`
- Add tests: `src/lib/supabaseState.test.ts`

**Proposed loaders:**
1. `loadSupabaseCriticalState(client, route, user)`
   - current user profile and role must already be known before entry
   - theme/language preferences required for the shell
   - app settings only when needed for visible UI
   - active Units the user is allowed to browse, initially limited/paginated for mobile
   - lookup values needed for visible filters/display: Destinations, Projects, Developers, Unit Status labels
   - dashboard summary from the loaded active Units, or a dashboard skeleton until Units arrive
2. `loadSupabaseDeferredState(client)`
   - notifications beyond an optional cheap unread count; first load may fetch only unread count for a badge, while the full Notification list loads/paginates only when notification center opens
   - audit logs
   - analytics events
   - analytics targets
   - PDF generation/share/download data
   - payment reconciliation when safe to run in background
3. `loadSupabaseAdminState(client)`
   - admin-only users/master-data/audit data, loaded only when entering admin screens
   - normal users never fetch admin-only data
   - Admin/Sub Admin fetch admin data only when entering Admin, Master Data, User Management, or Audit screens
   - show page skeletons while admin screens load
   - cache after first load so returning is fast
   - preserve server-side permission checks; lazy loading is not a security boundary
4. `loadSupabaseAnalyticsDashboard(client, filters)` already exists; keep analytics dashboard route-specific instead of startup-wide. No analytics events/targets/dashboard loading should run during general app startup; the Analytics page should show a skeleton, then fetch exact data for the selected filters/window, and filter changes should refetch only Analytics data.

**Important:** Preserve role/RLS behavior; do not fetch admin data for non-admin users. Pagination implementation must fix the directly related Archived Unit visibility boundary for list/search: Sales Representatives and Managers cannot browse Archived Units, while Admin/Sub Admin can access Archived Units in archive/admin contexts. Broader permission bugs documented in `docs/domain-alignment-findings.md` remain separate unless directly touched.

**Expected result:** Startup does not wait on audit logs, analytics events, targets, admin users, or due-payment reconciliation unless required.

### Task 10: Move payment reconciliation off the critical path

**Objective:** Avoid `repository.reconcileDueUnitPayments()` delaying every login/app restore.

**Files:**
- Modify: `src/lib/supabaseState.ts`
- Modify possibly: Supabase migration/RPC if reconciliation must be server-side scheduled
- Test: `src/lib/supabaseState.test.ts`

**Steps:**
1. Determine whether reconciliation must run before showing any unit data.
2. Resolved decision: do not block global mobile app startup on payment reconciliation.
3. Dashboard and Units list can load without waiting for reconciliation.
4. Payment-sensitive Unit Details/Payment Timetable surfaces should show a small “Updating payments…” state if reconciliation for that Unit is pending.
5. Prefer moving reconciliation to a server-side scheduled/background path instead of a client startup job.
6. After reconciliation finishes, refresh affected Unit/payment data.
7. If reconciliation fails, show a non-blocking warning only on payment-sensitive surfaces.

**Expected result:** Login no longer waits on global reconciliation, while payment-sensitive screens avoid presenting stale payment data as final.

---

## Phase 4: Reduce page render cost and route transition time

### Task 11: Add route/page code splitting

**Objective:** Avoid loading all admin/create/details/PDF-heavy code before it is needed.

**Files:**
- Modify: `src/App.tsx`
- Possibly create: `src/routes/*.tsx` or lazy wrappers
- Test: `npm run build`, route E2E

**Steps:**
1. Use `React.lazy`/`Suspense` for heavy route components:
   - `AdminPage`
   - `CreateUnitPage`
   - `UnitDetailsPage`
   - analytics page/section if separable
2. Keep shared shell/nav eager so first screen feels stable.
3. Provide route-level skeletons using `PageSkeleton`.
4. Verify bundle chunks in `dist/assets` after build.

**Expected result:** Smaller initial JS work; route skeletons appear quickly.

### Task 12: Implement paginated/server-side Unit loading and render only visible rows

**Objective:** Prevent large Unit datasets from blocking mobile startup, filtering, and scrolling.

**Files:**
- Modify: `src/features/units/UnitsPage.tsx`
- Modify: `src/lib/repository.ts`
- Modify: `src/lib/supabaseState.ts`
- Modify possibly: Supabase RPCs/migrations for safe paginated list/search
- Modify possibly: `src/features/units/UnitsPage.skeleton.test.tsx`
- Test: new `src/features/units/UnitsPage.mobile-performance.test.tsx`
- E2E: mobile scroll/tap/search/filter test

**Resolved decision:** Use pagination/server-side loading for production Unit browsing. Do not load every visible Unit upfront on mobile. Local/demo mode can continue using in-memory data where useful for tests.

**Steps:**
1. Inspect how unit rows are rendered, filtered, searched, and selected.
2. Add repository methods backed by safe server-side RPCs/functions for paginated active Unit loading; do not scatter ad-hoc frontend `.range()` queries for production Unit search because role/privacy/archive rules must stay centralized:
   - page size appropriate for mobile: start with 20 Units per page on mobile and 50 on desktop/tablet, then adjust based on measured performance
   - filter/search by Destination/Project/status/text across all permitted Units on the server, not only within the loaded page; results remain paginated and search input should debounce around 250–400ms
   - role-safe visibility and Original Owner masking preserved
   - archived visibility boundary preserved: Admin/Sub Admin can see Archived Units in admin/archive paths; Sales Representatives and Managers browse active Units only
3. First mobile/app load fetches only the initial page or the current route's required Unit.
4. Units page filters/search trigger server queries, not full in-memory filtering of thousands of Units.
5. Unit details page fetches one Unit by ID when opened if it is not already in cache:
   - allowed Unit: show details after a details skeleton
   - missing Unit: show “Unit not found”
   - not permitted: show privacy-safe “You don’t have access to this Unit”
   - never load every Unit just to resolve one details URL
   - optionally merge the fetched Unit into cache
6. Dashboard uses a lightweight role-safe server summary RPC/query for exact metrics; show dashboard skeletons until exact metrics arrive. Do not show first-page/partial metrics as if they are complete.
7. Memoize visible rows and render only current page/visible window plus small overscan.
8. Preserve selection/batch actions with page-scoped semantics for the first implementation:
   - selected Units apply only to the currently visible page/results
   - changing page, filter, or search clears selection
   - UI copy should say “selected on this page” or equivalent
   - do not implement “select all across all results” yet
9. Ensure row checkboxes/buttons remain clickable with one tap.

**Expected result:** Units page opens quickly, filters/search scale to production data, and scrolling/tapping remains smooth on mobile.

### Task 13: Memoize expensive derived data and handlers

**Objective:** Reduce unnecessary re-renders in `src/App.tsx` and feature pages.

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/features/dashboard/dashboardSummaries.ts` if needed
- Modify: `src/lib/domain.ts` if search/filter helpers are expensive
- Tests: existing unit tests plus performance spec

**Steps:**
1. Profile rerenders during navigation/search/filter/status update.
2. Use `useMemo` for:
   - visible/filtered units
   - dashboard rollups
   - destination/project summaries
   - analytics filters derived from route
   - lookup maps
3. Use stable callbacks where child memoization depends on them.
4. Avoid memoizing prematurely; only protect known expensive paths.

**Expected result:** Fewer Long Tasks and smoother mobile route changes.

### Task 14: Optimize images and media previews for mobile

**Objective:** Prevent large images/media/PDF previews from delaying pages or blocking taps.

**Files:**
- Modify: `src/features/create/CreateUnitPage.tsx`
- Modify: `src/features/details/UnitDetailsPage.tsx`
- Modify possibly: `src/features/shared/media.ts`
- Test: upload/media E2E with sanitized fixtures

**Steps:**
1. Keep `loading="lazy"` and `decoding="async"` on images.
2. Add explicit image dimensions/aspect ratio placeholders to reduce layout shift.
3. Ensure media preview overlays have `pointer-events: none` unless intentionally interactive.
4. Defer PDF generation code/work until user requests PDF/share/download.
5. Add sanitized image/PDF fixture tests for preview controls.

**Expected result:** Media-heavy pages remain tappable and responsive.

---

## Phase 5: Mobile UX hardening

### Task 15: Add safe-area and touch-target CSS pass

**Objective:** Make the app comfortable on iPhones with notches/home indicators and Android gesture nav.

**Files:**
- Modify: `src/index.css`
- Test: visual/mobile E2E screenshots

**Steps:**
1. Use `env(safe-area-inset-top/bottom/left/right)` where fixed/sticky shell elements sit near screen edges.
2. Ensure buttons/links have at least 44px touch target height on mobile.
3. Ensure spacing between adjacent destructive/primary actions prevents accidental taps.
4. Remove hover-only affordances on mobile; active/focus-visible states should still be clear.
5. Add `touch-action: manipulation` only where appropriate for buttons/links to reduce tap delay without breaking scroll/pinch.

**Expected result:** Controls are easy to hit on iOS and Android.

### Task 16: Loading state redesign for partial hydration

**Objective:** Replace “stuck after loading screen” feeling with page-level progress.

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/LeadraUi.tsx`
- Modify page components as needed
- Test: loading-state tests with controlled delays

**Steps:**
1. Keep full-screen loading only for unauthenticated session/profile resolution.
2. Once profile is known, render shell immediately.
3. For each page, show page skeleton for its own data.
4. For background data, use small inline loading indicators or stale-while-revalidate content.
5. Add controlled-delay tests that assert skeleton visible during wait and gone after resolution.

**Expected result:** The app never feels frozen after login; users see where they are and what is loading.

---

## Phase 6: Tests and validation matrix

### Task 17: Unit/integration tests

**Commands:**
- `npm run typecheck`
- `npm run lint`
- `npm run test`

**Required test coverage:**
- critical vs deferred Supabase loader behavior
- no admin-only fetches for non-admin initial load
- loading skeleton visible while route data waits
- `NavButton`/shared controls preserve normal first-click behavior
- CSS/DOM props still forward through skeleton wrappers
- paginated Unit list/search role matrix locally and against the target Supabase environment before launch: Sales sees active Units only, Manager sees active Units only, Admin/Sub Admin can access archive/admin contexts, Original Owner data remains masked/unmasked correctly, and direct Unit Details respects permission

### Task 18: Mobile E2E tests

**Commands:**
- `npm run build`
- `npm run e2e -- tests/e2e/mobile-touch-reliability.spec.ts`
- `npm run e2e -- tests/e2e/mobile-performance.spec.ts`
- `npm run perf:mobile`

**Required devices/viewports:**
- iPhone 13/14 Safari-like viewport
- small iPhone SE-style viewport if practical
- Pixel/Android Chrome-like viewport
- tablet/narrow landscape if Leadra users use it

**Required flows:**
- login/session restore
- main navigation: Dashboard, Units, Create Unit, Admin/Analytics if role permits
- dashboard load
- Units browsing: filters/search/pagination, Unit row open
- Unit Details: status change, Special Unit if Admin/Sub Admin, notes/comments
- Create Unit wizard: step navigation, required fields, submit
- Unit Media: upload/remove/select PDF Visibility with sanitized image fixture
- Unit PDF: generate/share/download buttons if safe in test environment
- Notifications open/close/read
- Admin basics: users/master-data tabs/actions for Admin/Sub Admin

**Tap reliability checks:**
- center point element receives tap
- one tap changes URL/state or starts visible pending state
- no overlay/skeleton/backdrop covers enabled controls
- no accidental double navigation

### Task 19: Production/Median wrapper/mobile-device validation

**Objective:** Verify the issue where the user found it: Median-installed iPhone app, not only desktop browser.

**Steps:**
1. Build/deploy the optimized production version.
2. Keep Median as the current wrapper unless testing proves Median itself is the blocker.
3. Audit Median app settings before rebuilding:
   - target production URL
   - loading screen/splash duration
   - WKWebView/cache mode
   - pull-to-refresh/bounce behavior
   - safe-area handling
   - injected scripts/plugins
   - external link handling
   - any Median overlay/nav/header/tab components
4. Test the deployed URL directly in iPhone Safari.
5. Test the same deployed URL inside the Median iOS app.
6. On iPhone Median app:
   - install/open fresh
   - login
   - measure time after loading screen
   - tap the same buttons the user reported as unreliable
   - navigate 5+ common pages
7. On Android/Median or Android Chrome:
   - install/open the app fresh if Android wrapper exists
   - repeat same flow
8. Use remote debugging where possible:
   - Safari Web Inspector for iPhone WKWebView/Safari
   - Chrome remote debugging for Android
9. Record before/after timing and classify the bottleneck:
   - Safari slow + Median slow = web app/data/rendering problem
   - Safari fast + Median slow = wrapper/settings problem
   - Safari reliable + Median double-tap = Median overlay/injected script/touch handling problem

**Expected result:** Real Median iOS validation confirms the fix, or wrapper-specific blockers are documented precisely.

---

## Files likely to change

Core app/data:
- `src/App.tsx`
- `src/main.tsx`
- `src/lib/supabaseState.ts`
- `src/lib/repository.ts`
- `src/lib/routes.ts` if route-state cleanup is needed

UI/components/CSS:
- `src/index.css`
- `src/components/LeadraUi.tsx`
- `src/features/units/UnitsPage.tsx`
- `src/features/details/UnitDetailsPage.tsx`
- `src/features/create/CreateUnitPage.tsx`
- `src/features/admin/AdminPage.tsx`
- `src/features/admin/UserManagement.tsx`
- `src/features/admin/MasterData.tsx`

Tests/scripts:
- `package.json`
- `playwright.config.ts`
- `scripts/mobile-performance-audit.mjs`
- `tests/e2e/mobile-touch-reliability.spec.ts`
- `tests/e2e/mobile-performance.spec.ts`
- `src/lib/supabaseState.test.ts`
- `src/features/units/UnitsPage.mobile-performance.test.tsx`
- existing tests that encode loading behavior:
  - `src/App.test.tsx`
  - `src/components/LeadraUi.test.tsx`
  - `src/features/units/UnitsPage.skeleton.test.tsx`

Review artifacts:
- `.hermes/reviews/mobile-performance-touch-optimization/handoff.md`
- `.hermes/reviews/mobile-performance-touch-optimization/critique-report.md`

---

## Risks and tradeoffs

- Splitting hydration can expose pages to partial data; every page must handle loading/empty/error states explicitly.
- Moving reconciliation off the critical path could briefly show stale payment state unless a background refresh updates it quickly or reconciliation moves server-side.
- Virtualizing lists can break keyboard accessibility, row measurement, or selection if implemented casually.
- Code splitting can create new loading boundaries; skeletons must be fast and not block taps.
- CSS overlay fixes must not remove intended modal/backdrop behavior.
- Mobile Safari behaves differently from Chromium; Playwright mobile emulation is necessary but not sufficient.

## Open questions for implementation

1. Is the downloaded iPhone app a PWA added to home screen, a Capacitor/React Native wrapper, or a browser shortcut? The repo currently does not show Capacitor files from initial search, but it does contain `leadra-app.apk` artifacts.
2. Which production URL/build did the iPhone app point to?
3. Which exact buttons most often needed a second tap? If unknown, the implementation should test all high-value buttons listed above.
4. What is the expected maximum dataset size for units, audit logs, notifications, and analytics events in production?
5. Can due-payment reconciliation be moved to a Supabase scheduled/server-side process, or must it run client-side for now?

## Definition of done

- Baseline and after metrics are captured in `reports/mobile-performance/` or equivalent.
- First-tap mobile E2E tests pass on iPhone and Android viewport projects.
- Production build passes: `npm run build`.
- Core gates pass: `npm run typecheck`, `npm run lint`, `npm run test`.
- Mobile performance audit shows improved startup and route timings against baseline.
- Real-device/PWA validation is performed on iPhone and Android, or exact access/device blockers are documented.
- iPhone Safari production URL and Median iOS app both pass the same core-flow performance and one-tap validation. If Safari passes but Median fails, release remains blocked until Median settings/build are fixed, Median is replaced, or the user explicitly waives the blocker.
- `.hermes/reviews/mobile-performance-touch-optimization/handoff.md` exists with changed files, tests, metrics, and known risks.
- Critique report exists and final verdict is `APPROVED`.
