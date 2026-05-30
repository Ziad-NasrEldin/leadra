# Leadra Mobile Performance and Touch Reliability Detailed Implementation Plan

> **For Hermes:** Use subagent-driven-development to execute this milestone-by-milestone. Because this changes user-facing behavior, completion requires feature-critique-workflow: create `.hermes/reviews/mobile-performance-touch-optimization/handoff.md`, trigger critique-agent review, fix all Required fixes, and re-review until verdict is APPROVED.

**Goal:** Make Leadra reliable and fast on iPhone/Android, especially inside the Median-built iOS app: first taps register, app startup does not wait on full workspace hydration, Units browsing scales through server-side pagination/search, and mobile validation proves Safari + Median both pass.

**Primary runtime:** Vite/React web app deployed to production and wrapped by Median for iOS. Keep Median for this cycle; do not switch to Xcode unless Safari passes and Median remains the blocker.

**Related decision record:** `docs/adr/0001-route-scoped-mobile-data-loading.md`

**Source plan refined from:** `.hermes/plans/2026-05-30_005457-mobile-performance-touch-optimization.md`

---

## Final resolved decisions

1. Keep Median for now; audit Median settings and compare against iPhone Safari before considering Xcode.
2. First diagnostic gate is Safari production URL vs Median iOS app on same phone/account/network.
3. Prioritize perceived speed: profile/auth first, shell/current route fast, background/deferred hydration later.
4. Use server-side paginated Unit browsing/search/filter, not full upfront Unit loading.
5. Start with 20 Units/page on mobile, 50 Units/page on desktop/tablet.
6. Search/filter must query all permitted Units server-side, not just current loaded page.
7. Batch selection is page-scoped; changing search/filter/page clears selection.
8. Dashboard metrics must be exact from a lightweight role-safe summary query/RPC; no fake partial metrics from first page.
9. Unit Details fetches one Unit by ID if not already cached.
10. Admin, Master Data, User Management, Audit, Analytics, full Notifications, and PDF-heavy data load only when opened.
11. First load may fetch only a cheap unread notification count; full notifications are paginated in notification center.
12. Payment reconciliation does not block global app startup; payment-sensitive surfaces show updating/warning states.
13. Use stale-while-revalidate for mobile data, not offline-first.
14. No offline writes in this cycle.
15. First-tap reliability is a release blocker.
16. Pagination/search must use safe server-side RPC/repository methods, not scattered frontend `.range()` queries.
17. Pagination scope includes fixing directly related Archived Unit list/search visibility: Sales/Managers active Units only; Admin/Sub Admin archive/admin access.
18. Production/staging Supabase verification is required for role/privacy behavior.
19. iPhone Safari + Median iOS are primary blockers; Android Chrome/wrapper remains required before full release.
20. `CONTEXT.md` should not be updated for these implementation/performance decisions.

---

## Milestone 1: Diagnostics and first-tap reliability patch

**Objective:** Prove where the issue lives, add regression coverage, and fix any tap-blocking overlays/route races before larger data refactors.

**Can ship independently?** Yes, only if Safari + Median core one-tap flows pass and release notes clearly say broader performance work is still pending.

### Task 1.1: Baseline git/project state

**Files:**
- Inspect: `package.json`
- Output: `.hermes/reviews/mobile-performance-touch-optimization/handoff.md` later

**Steps:**
1. Run `git status --short`.
2. Create branch: `fix/mobile-performance-touch`.
3. Record existing untracked/modified files in the handoff; do not accidentally include unrelated artifacts.
4. Run baseline commands:
   - `npm run typecheck`
   - `npm run test`
   - `npm run build`
   - `npm run perf:audit`
5. Save failures as baseline if they pre-exist.

**Verification:** Baseline status is known before implementation changes.

### Task 1.2: Safari vs Median truth test

**Files:**
- Create: `reports/mobile-performance-baseline/safari-vs-median.md`

**Manual test flow on same iPhone/account/network:**
1. Cold-open production Leadra URL in iPhone Safari.
2. Login/session restore.
3. Measure time from open to usable shell/dashboard.
4. Tap each core control once:
   - login submit
   - main nav: Dashboard, Units, Create Unit, Admin/Analytics if role permits
   - Units row open
   - Unit Details back/nav
   - Create wizard next/back
5. Repeat exact same flow in Median iOS app.
6. Classify:
   - Safari slow + Median slow = web app/data/rendering problem.
   - Safari fast + Median slow = Median wrapper/settings problem.
   - Safari reliable + Median double-tap = Median overlay/injected script/touch problem.
   - Both slow but Median worse = fix web app first, then tune Median.

**Verification:** `safari-vs-median.md` contains timings, device model/iOS version, account role, network, and classification.

### Task 1.3: Median settings audit

**Files:**
- Create: `reports/mobile-performance-baseline/median-settings-audit.md`

**Record:**
- Median app target URL.
- Splash/loading screen behavior and duration.
- Any injected scripts/plugins/native features.
- Native header/nav/tab settings.
- Whether any Median UI can overlay the web app.
- Pull-to-refresh/bounce/scroll settings.
- Cache settings if visible.
- Safe-area handling.
- External-link handling.
- App version/build date before and after rebuild.
- Screenshots/exported config where possible.

**Verification:** Report exists before release validation.

### Task 1.4: Add mobile Playwright projects/specs

**Files:**
- Modify: `playwright.config.ts`
- Create: `tests/e2e/mobile-touch-reliability.spec.ts`
- Optional create: `tests/e2e/helpers/mobile.ts`

**Implementation details:**
1. Add device projects:
   - iPhone 13/14 Safari-like device.
   - Pixel/Android Chrome-like device.
2. Use existing auth/test helper patterns if present; otherwise create minimal login helper using env-provided credentials.
3. Add helper `expectOneTap(locator, expectedChange)`:
   - compute target center via bounding box
   - call `document.elementFromPoint(x, y)`
   - assert element is target or child
   - tap once
   - assert URL/state/visible pending state changes
4. Core flow coverage:
   - login submit
   - mobile/sidebar nav
   - dashboard -> units
   - units pagination/search/filter controls
   - Unit row open
   - Unit Details action buttons safe for test fixture
   - Create Unit wizard step buttons
   - notification open/close if available
   - admin/master-data tabs for admin user

**Verification:** The spec fails on current issue or establishes a reliable guardrail.

### Task 1.5: Audit CSS overlays and pointer-event blockers

**Files:**
- Modify: `src/index.css`
- Possibly modify: `src/components/LeadraUi.tsx`
- Test: `tests/e2e/mobile-touch-reliability.spec.ts`

**Implementation details:**
1. Search every `::before`, `::after`, `position: fixed`, `position: absolute`, `inset: 0`, `z-index`, skeleton, shimmer, backdrop, loading, card decoration rule.
2. For decorative layers, add/verify `pointer-events: none`.
3. For real controls inside card/media/preview shells, ensure they sit above decoration with safe stacking context.
4. Confirm `.toast-region` remains `pointer-events: none` except actual toast content.
5. Ensure skeletons disappear or sit below active controls once content is available.
6. Do not weaken true modal/backdrop blocking behavior.

**Verification:** `elementFromPoint` in E2E confirms target controls receive taps.

### Task 1.6: Fix route/nav tap feedback and route-sync races

**Files:**
- Modify: `src/App.tsx`
- Inspect/modify if needed: `src/lib/routes.ts`
- Modify if needed: `src/components/LeadraUi.tsx`

**Implementation details:**
1. Inspect duplicated route state in `src/App.tsx`, especially `syncRouteFromLocation`.
2. Ensure `Link to=...` and manual `routerNavigate` do not both fight the same tap.
3. Add immediate visual active/pending feedback for nav taps.
4. Do not place a full-screen invisible loading layer over tappable content during route transitions.
5. If route-derived rendering can be simplified safely, prefer route as source of truth; otherwise guard stale state overwrites.

**Verification:** One tap updates URL/page heading exactly once on mobile E2E.

### Task 1.7: Milestone 1 validation

**Commands:**
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e -- tests/e2e/mobile-touch-reliability.spec.ts`

**Manual validation:**
- iPhone Safari production URL core one-tap flow.
- Median iOS app core one-tap flow.

**Exit criteria:**
- No core visible enabled button/link needs double tap.
- Median failure remains blocker unless explicitly waived.

---

## Milestone 2: Startup hydration split

**Objective:** Stop blocking app entry on full workspace hydration.

### Task 2.1: Define loading state model

**Files:**
- Modify: `src/App.tsx`
- Possibly create: `src/lib/loadingState.ts`

**Target states:**
- `authLoading`: only session/profile resolution.
- `criticalDataLoading`: current route critical data.
- `backgroundHydrating`: deferred data loading.
- `routeDataLoading`: per-route/page loading.
- `routeDataError`: per-route/page error.

**Rules:**
- Full-screen loading is allowed only before profile/session is known.
- Once profile is valid, render shell/current route skeleton.
- Non-critical data never blocks shell.

**Tests:**
- Add controlled-delay tests in `src/App.test.tsx` proving shell renders after profile while background data is pending.

### Task 2.2: Split Supabase loaders

**Files:**
- Modify: `src/lib/supabaseState.ts`
- Modify: `src/lib/repository.ts`
- Modify: `src/App.tsx`
- Test: `src/lib/supabaseState.test.ts`

**Create/adjust functions:**
1. `loadSupabaseCriticalState(client, route, user)`
   - current route's critical data only
   - lookup values needed for visible filters/display
   - settings needed for visible UI
   - dashboard summary request or skeleton state
2. `loadSupabaseDeferredState(client)`
   - old notifications/full notification list only when opened
   - audit logs only when audit/admin opened
   - analytics events/targets only on analytics route
   - PDF-heavy data only on action
3. `loadSupabaseAdminState(client)`
   - users/master-data/audit for Admin/Sub Admin route only
4. Keep `loadSupabaseAnalyticsDashboard(client, filters)` route-specific.

**Rules:**
- Normal users never fetch admin-only data.
- Lazy loading is not a security boundary; server still enforces permissions.

**Verification:** Tests assert initial load does not call admin/audit/analytics/full-notification loaders.

### Task 2.3: Update `completeSupabaseLogin`

**Files:**
- Modify: `src/App.tsx`

**Implementation details:**
1. Load profile.
2. If inactive, sign out and show existing error.
3. Set `currentUser` immediately after valid profile.
4. Route to allowed view.
5. Start critical current-route load.
6. Start background/deferred hydration without blocking shell.
7. Run `markSupabaseLogin` in background after first render or in non-blocking path.

**Verification:** Controlled test proves `currentUser`/shell appears before deferred loader resolves.

### Task 2.4: Move payment reconciliation off global startup

**Files:**
- Modify: `src/lib/supabaseState.ts`
- Modify: `src/lib/repository.ts`
- Modify: `src/features/details/UnitDetailsPage.tsx`
- Possible migration/RPC if server-side schedule/background path is added

**Implementation details:**
1. Remove `await repository.reconcileDueUnitPayments()` from global critical startup.
2. Run reconciliation in background or per payment-sensitive surface.
3. On Unit Details/Payment Timetable, show “Updating payments…” if relevant reconciliation pending.
4. Refresh affected Unit/payment data after reconciliation.
5. If reconciliation fails, show warning on payment-sensitive surface only.

**Verification:** Startup timing improves; payment-sensitive screens do not present stale payment data as final.

### Task 2.5: Lazy-load notifications/admin/analytics/PDF-heavy surfaces

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/features/admin/AdminPage.tsx`
- Modify: notification UI location in `src/App.tsx`
- Modify analytics route handling in `src/App.tsx`
- Possibly code split route components with `React.lazy`

**Implementation details:**
1. Initial load can fetch cheap unread notification count only.
2. Full notification list loads when notification center opens; paginate old notifications.
3. Admin data loads on Admin/Master Data/User Management/Audit screens only.
4. Analytics data loads only on Analytics route and refetches on filter/window changes.
5. PDF generation/import-heavy logic runs only on PDF action.
6. Add `PageSkeleton`/specific skeletons for every deferred surface.

**Verification:** E2E and unit tests prove general startup does not load these resources.

### Task 2.6: Milestone 2 validation

**Commands:**
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- mobile performance script if already added

**Manual validation:**
- iPhone Safari and Median show shell quickly after profile.
- No one-tap regression.

---

## Milestone 3: Server-side Units pagination/search/details and exact dashboard summary

**Objective:** Replace full Unit upfront loading with scalable role-safe server-side queries.

### Task 3.1: Inventory current Unit data flow

**Files to inspect:**
- `src/lib/repository.ts`
- `src/lib/supabaseState.ts`
- `src/lib/domain.ts`
- `src/features/units/UnitsPage.tsx`
- `src/features/details/UnitDetailsPage.tsx`
- `src/features/dashboard/dashboardSummaries.ts`
- Supabase migrations/functions defining `list_units_safe`, `search_units_safe`, detail RPCs if present
- `docs/domain-alignment-findings.md`

**Output:**
- Add notes to handoff: current list/search/detail paths and permission assumptions.

### Task 3.2: Design safe paginated RPC contracts

**Files:**
- Create/modify Supabase migration under `supabase/migrations/`
- Modify: `src/lib/repository.ts`
- Test: migration/RPC tests if present (`src/lib/migrations.test.ts` or new tests)

**Required RPC behavior:**
1. `list_units_page_safe(args)` or equivalent:
   - page number/cursor
   - page size
   - destination/project/status filters
   - text search query
   - sort option if current UI supports it
   - context: active browsing vs archive/admin if needed
   - returns rows + total count/hasMore
2. Enforce role visibility:
   - Sales Representative: active Units only; owner data only for current Unit Uploader.
   - Manager: active Units only; owner data only where current Unit Uploader if canonical rule applies.
   - Admin/Sub Admin: active + archived where appropriate.
3. Preserve Original Owner masking.
4. Do not leak archived or sensitive duplicate/owner information through counts/search snippets.
5. Support direct Unit detail fetch by ID with same masking/permission rules.

**Important scope:** Fix list/search Archived Unit visibility as part of this milestone. Do not expand into unrelated permission bugs unless tests reveal direct dependency.

### Task 3.3: Repository API for paginated Units

**Files:**
- Modify: `src/lib/repository.ts`
- Modify: `src/lib/types.ts` if new result types needed

**Implement:**
- `listUnitsPage(params): Promise<{ units; totalCount?; hasMore; page; pageSize }>`
- `searchUnitsPage(params)` if separate, or single list method with filters/search.
- `getUnitById(unitId)` for direct details.
- Mapping from RPC rows to `LeadraUnit` should reuse existing converters where possible.

**Tests:**
- Unit tests for mapping and parameter formation.
- Mock Supabase client tests for no full list call in mobile initial route.

### Task 3.4: Units page UI pagination/search

**Files:**
- Modify: `src/features/units/UnitsPage.tsx`
- Modify: `src/App.tsx` props/state passed to UnitsPage
- Modify: `src/features/units/UnitsPage.skeleton.test.tsx`
- Create: `src/features/units/UnitsPage.mobile-performance.test.tsx`

**Implementation details:**
1. Replace local full-array filter/search for production Supabase mode with server query state.
2. Search input debounces 250–400ms.
3. Filters trigger server query and reset to page 1.
4. Page controls or infinite/load-more UX must be mobile-friendly.
5. Selection semantics:
   - selection applies only to visible page/results
   - changing page/search/filter clears selection
   - UI copy says “selected on this page” or equivalent
   - no “select all across all results” in this cycle
6. Render only current page rows; keep thumbnails lazy and bounded.
7. Keep local/demo mode compatible with in-memory data for tests/demo.

**Verification:** Search across all permitted Units; not only loaded page.

### Task 3.5: Direct Unit Details fetch

**Files:**
- Modify: `src/features/details/UnitDetailsPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/lib/repository.ts`
- Tests: App/details tests and E2E

**Rules:**
- If Unit in cache: render quickly and revalidate.
- If not in cache: show details skeleton and fetch by ID.
- Missing Unit: show “Unit not found.”
- Not permitted: show privacy-safe “You don’t have access to this Unit.”
- Never load all Units to resolve one details URL.
- Optionally merge fetched Unit into cache.

**Verification:** Direct URL E2E for allowed/missing/not-permitted cases.

### Task 3.6: Dashboard exact summary query

**Files:**
- Modify/create Supabase migration/RPC for dashboard summary
- Modify: `src/features/dashboard/dashboardSummaries.ts` if needed
- Modify: `src/App.tsx`
- Tests: dashboard summary role tests

**Rules:**
- Dashboard cards show skeleton until exact summary arrives.
- Do not show first-page partial metrics as complete.
- Summary must be role-safe.
- Summary should not require loading all Units into frontend memory.

**Verification:** Dashboard summary exactness checked against controlled test dataset.

### Task 3.7: Supabase role/privacy verification

**Files:**
- Create/modify E2E or script under `scripts/` if useful
- Update handoff with target Supabase verification results

**Role matrix:**
- Sales sees active Units only.
- Manager sees active Units only.
- Admin/Sub Admin can access archive/admin contexts.
- Original Owner data masked/unmasked correctly.
- Direct Unit Details respects permission.
- Search results and counts do not leak inaccessible Archived Units.

**Target environment:**
- Local tests first.
- Staging/production Supabase verification before launch using safe E2E-tagged test data only.

### Task 3.8: Milestone 3 validation

**Commands:**
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- focused E2E for Units pagination/search/details
- production/staging role matrix script/E2E

**Manual validation:**
- iPhone Safari Units first page within 2s on normal connection.
- Search results within 1.5s after debounce.
- Median app has no one-tap regression.

---

## Milestone 4: Mobile performance audit, production deployment, Median validation, critique approval

### Task 4.1: Add mobile performance audit script

**Files:**
- Create: `scripts/mobile-performance-audit.mjs`
- Modify: `package.json`
- Output: `reports/mobile-performance/`

**Script should measure:**
- cold open to login/shell/dashboard skeleton
- first interactive dashboard content
- route transition durations
- Units first page duration
- search duration after debounce
- Long Tasks if available
- JS heap/DOM node counts where available
- separate mobile device profiles where possible

**Add script:**
- `"perf:mobile": "node scripts/mobile-performance-audit.mjs"`

### Task 4.2: Run full validation gates

**Commands:**
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run perf:mobile`
- existing `npm run perf:audit`

**Expected:** All pass, or failures are documented with blocker/waiver status.

### Task 4.3: Production/staging deploy verification

**Required status report fields:**
- commit/push status
- Supabase migrations/RPC deployment status
- frontend deploy trigger/completion status
- Median rebuild/version status if applicable
- production/staging URL tested
- Safari iPhone result
- Median iOS app result
- Android Chrome result
- Android wrapper result if applicable
- known blockers/waivers

**Production E2E requirement:**
- Verify frontend/backend/database paths, especially new RPCs and role visibility.

### Task 4.4: Real-device validation

**iPhone Safari + Median core flows:**
1. Cold open.
2. Login/session restore.
3. Dashboard shell/content.
4. Main nav taps.
5. Units pagination/search/filter.
6. Unit Details direct/opened from list.
7. Create Unit wizard navigation and safe test submit if environment allows.
8. Unit Media with sanitized fixture if safe.
9. Unit PDF generate/share/download if safe.
10. Notifications open/close/read.
11. Admin/Master Data basics for Admin/Sub Admin.

**Release blockers:**
- Any core visible enabled control needing double tap.
- Safari passes but Median fails.
- Role/privacy regression in paginated/search/detail RPCs.
- Dashboard showing partial metrics as complete.
- Production build/deploy not verified.

### Task 4.5: Feature handoff and critique loop

**Files:**
- Create: `.hermes/reviews/mobile-performance-touch-optimization/handoff.md`
- Wait for/create: `.hermes/reviews/mobile-performance-touch-optimization/critique-report.md`

**Handoff must include:**
- original request
- resolved grill decisions
- ADR path
- changed files
- Supabase migrations/RPCs
- Median settings audit path
- before/after performance reports
- tests run with pass/fail
- production/staging verification
- real-device Safari/Median/Android results
- known limitations

**Completion rule:** Feature is not complete until critique report verdict is `APPROVED`.

---

## Files likely to change

Core app/data:
- `src/App.tsx`
- `src/main.tsx`
- `src/lib/supabaseState.ts`
- `src/lib/repository.ts`
- `src/lib/routes.ts`
- `src/lib/types.ts`

UI/components/CSS:
- `src/index.css`
- `src/components/LeadraUi.tsx`
- `src/features/units/UnitsPage.tsx`
- `src/features/details/UnitDetailsPage.tsx`
- `src/features/create/CreateUnitPage.tsx`
- `src/features/admin/AdminPage.tsx`
- `src/features/admin/UserManagement.tsx`
- `src/features/admin/MasterData.tsx`

Backend/Supabase:
- `supabase/migrations/*.sql`
- possible Supabase functions only if RPC alone is insufficient

Tests/scripts/reports:
- `package.json`
- `playwright.config.ts`
- `scripts/mobile-performance-audit.mjs`
- `tests/e2e/mobile-touch-reliability.spec.ts`
- `tests/e2e/mobile-performance.spec.ts`
- `tests/e2e/helpers/mobile.ts`
- `src/lib/supabaseState.test.ts`
- `src/features/units/UnitsPage.mobile-performance.test.tsx`
- `src/App.test.tsx`
- `src/components/LeadraUi.test.tsx`
- `src/features/units/UnitsPage.skeleton.test.tsx`
- `reports/mobile-performance-baseline/safari-vs-median.md`
- `reports/mobile-performance-baseline/median-settings-audit.md`
- `reports/mobile-performance/`

Docs/review:
- `docs/adr/0001-route-scoped-mobile-data-loading.md`
- `.hermes/reviews/mobile-performance-touch-optimization/handoff.md`

---

## Definition of done

- Baseline Safari-vs-Median report exists.
- Median settings audit exists.
- ADR exists and matches implementation.
- First-tap mobile E2E tests pass.
- Core one-tap manual flows pass in iPhone Safari and Median iOS app.
- Startup no longer blocks on full workspace hydration.
- Units list/search/filter are server-side paginated through safe RPC/repository methods.
- Dashboard uses exact role-safe summary; no partial first-page metric is shown as complete.
- Direct Unit Details fetch works for allowed/missing/not-permitted cases.
- Notifications/admin/analytics/audit/PDF-heavy data are lazy-loaded.
- Payment reconciliation does not block global startup and payment-sensitive surfaces handle updating/failure states.
- Archived Unit list/search visibility boundary is fixed for Sales/Managers vs Admin/Sub Admin.
- Production/staging Supabase role/privacy matrix passes.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, relevant E2E, and mobile performance audit pass.
- Production deployment status distinguishes commit/push, Supabase migration/RPC deploy, frontend deploy, Median rebuild, and verification.
- Critique report verdict is `APPROVED`.
