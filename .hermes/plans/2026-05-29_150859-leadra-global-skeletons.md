# Plan: Leadra global skeleton coverage

## Goal

Add skeleton loading states across Leadra so every user-visible async/data-wait surface shows a layout-matched placeholder instead of blank content, sudden jumps, generic text-only loading, or stale-looking empty states.

Important boundary: skeletons are for data/layout waits. Submit/action waits should keep explicit disabled buttons, progress labels, or spinners because the user needs action feedback, not fake page content.

## Current context found

- Project: `/Users/ziadnasreldin/Documents/GitHub/leadra`
- Stack: React, Vite, TypeScript, Supabase, TanStack Query, Vitest, Playwright, Tailwind CSS v4.
- Main UI files discovered:
  - `src/App.tsx`
  - `src/index.css`
  - `src/components/LeadraUi.tsx`
  - `src/features/units/UnitsPage.tsx`
  - `src/features/details/UnitDetailsPage.tsx`
  - `src/features/create/CreateUnitPage.tsx`
  - `src/features/admin/AdminPage.tsx`
  - `src/features/admin/MasterData.tsx`
  - `src/features/admin/UserManagement.tsx`
- Existing skeleton/loading patterns already exist but are partial:
  - `AnalyticsSkeleton` in `src/App.tsx`
  - `DetailsLoadingSkeleton` in `src/features/details/UnitDetailsPage.tsx`
  - CSS around `.analytics-skeleton` in `src/index.css`
- Existing loading flags found:
  - `authLoading` for login/auth profile resolution.
  - `analyticsLoading` for analytics RPC refresh/load.
  - `remoteSearchUnits` / `remoteSearchView` for remote unit search states.
  - Media download/remove flags: `downloadingMediaId`, `removingMediaId`.
  - Several deferred/local staged renders in details/admin.

## Product/UX rules

1. Use skeletons only when the app is waiting for content that will occupy the page/card/table/list/form area.
2. Do not replace submit feedback with skeletons. Keep labels like `Signing in...`, `Downloading...`, `Saving...`, disabled states, or spinner-like indicators for active commands.
3. Skeletons must match the final layout closely enough to prevent layout shift.
4. Skeletons must be theme-aware, mobile-first, RTL-safe, and accessible.
5. Skeletons must be `aria-hidden="true"` unless the surrounding region needs an accessible status message.
6. User-facing screen readers should get one concise loading/status label per region, not a noisy set of skeleton bars.
7. Avoid internal implementation wording in UI copy.

## Proposed approach

### 1. Create shared skeleton primitives

Add reusable skeleton primitives to `src/components/LeadraUi.tsx` or a new small file under `src/components/` if the existing file is too crowded.

Likely components:

- `SkeletonBlock`
  - Generic rounded shimmer block.
  - Props: `className`, `style`, `width`, `height`, `radius`, DOM passthrough props.
- `SkeletonText`
  - Multiple text lines with variable widths.
- `SkeletonAvatar`
  - Circular/square media placeholder.
- `SkeletonMetricCard`
  - Metric card placeholder for dashboards/analytics.
- `SkeletonList`
  - Repeated row/card placeholders.
- `SkeletonTable`
  - Header + rows placeholder for admin/audit/user lists.
- `SkeletonForm`
  - Label/input/select-style placeholders for form-dependent data waits.
- `SkeletonMediaGrid`
  - Image/video/file card placeholders.
- `ScreenSkeleton` / `PageSkeletonShell`
  - Optional page-level wrapper for route-sized waits.

CSS additions in `src/index.css`:

- `.skeleton`, `.skeleton-text`, `.skeleton-card`, `.skeleton-row`, `.skeleton-media`, `.skeleton-table`, `.skeleton-form`
- One shared shimmer keyframe or soft pulse.
- `prefers-reduced-motion: reduce` fallback to static gradient/no animation.
- Dark/light tokens using existing CSS variables.

### 2. Inventory every user-visible surface before coding

Build and check off a complete inventory before editing behavior. Do not rely only on routes.

Route-level screens:

- Login screen in `src/App.tsx` (`LoginScreen`)
- Dashboard in `src/App.tsx`
- Admin dashboard in `src/App.tsx`
- Manager dashboard in `src/App.tsx`
- Notifications page in `src/App.tsx`
- Analytics page in `src/App.tsx`
- Profile page in `src/App.tsx`
- Palette sample page in `src/App.tsx`
- Units/inventory page in `src/features/units/UnitsPage.tsx`
- Special units view if separate from inventory state in `UnitsPage`
- Unit details page in `src/features/details/UnitDetailsPage.tsx`
- Create unit page in `src/features/create/CreateUnitPage.tsx`
- Admin settings/master data/users/audit sections in `src/features/admin/AdminPage.tsx`

Shared/layout components and global behavior:

- Topbar/header/navigation shell in `src/App.tsx`
- Mobile nav/menu state
- Bottom/mobile nav if present
- Flash/toast/error banners
- Empty states from `EmptyState` in `src/components/LeadraUi.tsx`
- Branded select/dropdowns in `src/components/LeadraUi.tsx`
- Theme toggle / locale switcher
- Route/page transitions
- Auth guard/no-user state
- Remote refresh / realtime refresh state
- Error and unavailable states

Nested/local components to account for by name:

- `LoginStoryItem`
- `Dashboard`
- `AdminDashboard`
- `AdminRollupPanel`
- `ManagerDashboard`
- `ManagerPanel`
- `NotificationsPage`
- `AnalyticsPage`
- `AnalyticsSkeleton`
- `AnalyticsDeepSections`
- `AnalyticsFiltersPanel`
- `StatusDonutChart`
- `LeaderboardChart`
- `LineChart`
- `BarChart`
- `ProfilePage`
- `LocaleSwitcher`
- `ThemeToggle`
- `UnitsPage`
- `UnitResultsSection`
- `InventoryScopeCard`
- `NumberFilter`
- `RangeFilter`
- `UnitDetailsPage`
- `UnitDetailsHero`
- `UnitDetailsActions`
- `UnitDetailsEditForm`
- `UnitDetailsDeepSections`
- `DetailsLoadingSkeleton`
- `CreateUnitPage`
- `CreateWizardSteps`
- `CreateWizardActions`
- `AdminPage`
- `UserManagementCard`
- `MasterDataPanel`
- `DirectoryCreateForm`
- `LookupThumbnailPicker`
- `DirectoryList`
- `DirectoryCard`

State variants to explicitly check:

- Initial auth/profile loading
- App workspace loading after Supabase auth
- Remote refresh in authenticated shell
- Search/filter pending or remote-search loading
- Empty results after loading
- Error after loading
- Details route with unit missing/loading
- Analytics initial load and refresh
- Admin data lists loading/empty/error
- Master-data image thumbnail preview loading
- Media grid image loading vs missing media
- Mobile and desktop layouts
- RTL/Arabic layout
- Dark and light themes
- Reduced motion

### 3. Add top-level workspace loading state if missing

In `src/App.tsx`, make the Supabase workspace/profile loading path explicit enough to render a layout skeleton after login rather than showing partial demo/local data or a blank jump.

Likely implementation:

- Add a state such as `workspaceLoading` or derive it from the existing auth/workspace loading flow.
- During authenticated workspace hydration, render `AppShellSkeleton` or route-specific skeletons inside the normal app chrome when possible.
- Keep login button action feedback separate from page skeletons.

### 4. Replace route-level blank/text loading with layout skeletons

Implement route-specific skeletons:

- Dashboard/admin/manager dashboard:
  - Header skeleton, metric cards, rollup rows, list cards.
- Units page:
  - Search/filter controls skeleton if lookup values are loading.
  - Destination/project scope cards skeleton.
  - Unit result rows/cards skeleton during remote search/load.
- Unit details page:
  - Expand current `DetailsLoadingSkeleton` into a full details skeleton: hero, action strip, info panels, media grid, financial sections.
- Create unit page:
  - If lookup/master-data options are still loading, skeleton the dependent form sections/selects rather than showing broken empty selects.
  - Do not skeleton while the create submit is saving; keep explicit submit feedback.
- Analytics page:
  - Replace existing analytics-only bars with chart-shaped skeletons: filter sheet/header, metric cards, donut/line/bar chart placeholders, leaderboard rows.
- Admin page:
  - Settings panels, user management, audit log, master data directories, and thumbnail previews get table/list/form skeletons when data is not ready.
- Notifications/profile/login:
  - Add only where real async waiting exists. Do not add ornamental skeletons for static content.

### 5. Handle media/image loading without layout jumps

For unit thumbnails, media grids, directory thumbnails, and preview images:

- Reserve the final media box dimensions.
- Show a media skeleton until the image loads or errors.
- On error, show the existing icon/fallback state.
- Avoid per-image skeleton state that causes excessive rerenders; use a small `ImageWithSkeleton` helper if it stays simple.

Candidate files:

- `src/features/units/UnitsPage.tsx`
- `src/features/details/UnitDetailsPage.tsx`
- `src/features/create/CreateUnitPage.tsx`
- `src/features/admin/MasterData.tsx`

### 6. Normalize empty/error/loading branching

For every list/table/card region, use the same order:

1. Loading skeleton
2. Error state
3. Empty state
4. Loaded content

Apply this especially to:

- Unit results
- Analytics deep sections
- Admin users
- Audit logs
- Master data directories
- Notifications
- Media lists

### 7. Tests and validation

Add focused tests first or alongside implementation.

Unit/component tests:

- `src/components/LeadraUi.test.tsx`
  - Shared skeleton primitives render with `aria-hidden` by default.
  - DOM props such as `data-testid` pass through to actual DOM nodes.
  - Reduced-motion styles do not rely on JS.
- `src/App.test.tsx`
  - Auth/workspace loading shows shell/page skeleton and removes it after hydration.
  - Analytics controlled-delay test shows analytics skeleton during wait and removes it after data resolves.
  - Route-level loading does not expose internal provider/database wording.
- Feature-level tests if current test setup supports them:
  - Units loading/search skeleton visible during delayed remote search.
  - Details skeleton visible for delayed details/deep-section load.
  - Admin list/table skeleton visible during delayed data.

Important critique-gate requirement: include at least one behavioral controlled-delay test that observes a skeleton during an actual wait and gone after resolution. Source-string tests alone are not enough.

Manual/browser validation:

- Run local app at `http://localhost:5173` or an explicit free port if 5173 is occupied.
- Check these surfaces at desktop and mobile widths:
  - `/login` or unauthenticated root
  - `/dashboard`
  - `/units` or inventory route
  - Unit details route
  - Create unit route
  - Analytics route
  - Admin users/settings/master-data/audit sections
  - Profile and notifications
- Check dark and light themes.
- Check Arabic/RTL if locale switch is available.
- Verify no horizontal overflow and no severe layout shift when data appears.

Commands to run:

- `npm run typecheck`
- `npm test`
- `npm run lint`
- `npm run build`
- `npm run qa:preview` if the change is broad enough and the environment is available

### 8. Feature critique workflow gate

Because this is user-facing feature work, completion requires the critique workflow.

After implementation and local verification:

1. Create `.hermes/reviews/leadra-global-skeletons/handoff.md`.
2. Include original request: `in the leadra project i wnat you to add skeletons to everything /plan`.
3. Include changed files, screenshots or tested routes, commands run, and known limitations.
4. Wait for `.hermes/reviews/leadra-global-skeletons/critique-report.md`.
5. Fix every Required fix.
6. Re-run focused tests and affected full checks.
7. Re-review until verdict is `APPROVED`.

Do not call the feature complete before critique approval unless the user explicitly waives that gate.

## Files likely to change

- `src/components/LeadraUi.tsx`
  - Add shared skeleton primitives and possibly image-with-skeleton helper.
- `src/index.css`
  - Add/normalize skeleton styling, shimmer/pulse, dark/light tokens, reduced-motion behavior, responsive shapes.
- `src/App.tsx`
  - Add app/workspace/dashboard/analytics/profile/notification skeleton states.
  - Improve/replace `AnalyticsSkeleton`.
- `src/features/units/UnitsPage.tsx`
  - Unit list, scope cards, filters/search loading skeletons.
- `src/features/details/UnitDetailsPage.tsx`
  - Full unit details/media/finance skeletons; improve `DetailsLoadingSkeleton`.
- `src/features/create/CreateUnitPage.tsx`
  - Lookup-dependent form skeletons and media preview placeholders.
- `src/features/admin/AdminPage.tsx`
  - Admin panels, settings, audit/log/list skeletons.
- `src/features/admin/MasterData.tsx`
  - Directory list/card/thumbnail skeletons.
- `src/features/admin/UserManagement.tsx`
  - User list/table/card skeletons.
- `src/App.test.tsx`
  - Behavioral loading assertions.
- `src/components/LeadraUi.test.tsx`
  - Skeleton primitive tests.
- Optional new test/spec file if cleaner:
  - `tests/e2e/skeleton-loading.spec.ts` or equivalent existing Playwright location.

## Definition of done

- Every inventory item above is either:
  - given a real skeleton for async/data waiting, or
  - explicitly marked not applicable because it is static or action-only.
- No static/action-only screens get fake ornamental skeletons.
- At least one controlled-delay behavioral test proves skeleton visible during wait and gone after resolution.
- Typecheck, tests, lint, and build pass or any blocker is reported with exact output.
- Browser validation covers desktop/mobile and light/dark.
- Critique report verdict is `APPROVED`.

## Risks / tradeoffs

- The broad scope can cause scattered duplicated skeleton markup. Mitigation: build shared primitives first, then route-specific composition.
- Existing app state may not expose clean loading flags for every data source. Mitigation: add narrow loading flags at data boundaries, not global hacks.
- Skeletons can hide real empty/error states if branch ordering is wrong. Mitigation: enforce Loading -> Error -> Empty -> Content per region.
- Skeleton shimmer can be distracting. Mitigation: soft animation, reduced-motion fallback, and token-based colors.
- Tests may be hard if local demo data resolves immediately. Mitigation: use mocked promises/controlled delays in Vitest rather than weakening to source-only checks.

## Open questions

None blocking. Assumption: “everything” means every user-visible async/data-loading state across the app, not replacing every button submission or static page with skeletons.
