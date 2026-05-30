# Feature critique: mobile-performance-touch-optimization

Verdict: REQUIRED_FIXES

## Scope reviewed

Read `.hermes/reviews/mobile-performance-touch-optimization/handoff.md` and inspected the changed files called out there:

- `src/App.tsx`
- `src/lib/supabaseState.ts`
- `src/lib/supabaseState.test.ts`
- `src/index.css`
- `playwright.config.ts`
- `e2e/mobile-touch-reliability.spec.ts`

I did not modify application code.

## Summary

The mobile touch/CSS changes are directionally safe, and payment reconciliation is still present inside `loadSupabaseAppState()`. However, the immediate authenticated shell introduces production-risk race conditions and exposes empty-state/payment-sensitive screens before workspace hydration has completed. The debounced remote search also lacks cancellation/request identity, so stale mobile filter results can overwrite newer navigation/search state. These issues are correctness risks, not just polish issues, so this should not be considered complete yet.

## Required fixes

### 1. Empty authenticated shell exposes actions and false empty states before hydration

Relevant code:

- `src/App.tsx:447-455` sets `createSupabaseShellState(profile)`, clears lookup values, sets the current user, sets the route, then drops `authLoading` before full workspace data is loaded.
- `src/App.tsx:1701-1709` renders `CreateUnitPage` with empty `lookupValues` and default shell settings during hydration.
- `src/App.tsx:1712-1749` renders the details unavailable empty state whenever `selectedUnit` is null; with shell state, all units are empty until hydration completes.
- `src/App.tsx:1761-1769` and `1771-1780` render analytics/admin against empty shell data.

Risk:

- A deep link to `/units/:id` or equivalent details route can briefly show “unavailable” instead of a loading state even though the unit may exist once hydration finishes.
- The create route is accessible with empty master data. Users can interact with a form that cannot validate expected lookup values yet, or see misleading validation/errors.
- Analytics/admin/notifications/dashboard can display zero/empty data before hydration, which is a misleading state and can affect user decisions.
- Shell settings use hard-coded defaults, so payment/media/settings-sensitive flows may briefly render with values that differ from production configuration.

Expected fix:

Gate workspace-dependent views/actions while `workspaceHydrating` is true. At minimum, details, create, admin, analytics, notifications, dashboard data summaries, and any unit mutation/payment/media action should show a loading/skeleton/disabled state until the full workspace has loaded or a deliberate route-scoped fetch has completed. Avoid rendering “not found/unavailable” until hydration is known complete.

### 2. Background workspace hydration is not guarded against sign-out/unmount/new-login races

Relevant code:

- `src/App.tsx:456-468` starts `loadSupabaseAppState(supabase)` and applies the result later without checking whether the user is still signed in, whether the same auth user is current, or whether the component/session is still valid.
- `src/App.tsx:553-562` handles `SIGNED_OUT` by resetting state, but does not invalidate the already-started login hydration promise.
- `src/App.tsx:475-478` clears `completingAuthUserRef` immediately after scheduling background hydration, so a later duplicate auth event can schedule another full load while the first is still running.

Risk:

- If the user signs out before the background load resolves, the promise can still call `setAppState(remote.state)` and `setActiveLookupValues(...)` after sign-out. The login screen may be shown, but authenticated workspace data can be reintroduced into app state after sign-out.
- If a different user logs in before a previous hydration resolves, stale workspace data from the previous auth session can overwrite the new shell/full state.
- Duplicate login/session events can trigger multiple full loads and payment reconciliation calls.

Expected fix:

Track a hydration generation/session token or abort/cancel flag. Before applying full workspace state, verify the current auth user/session still matches the hydration that started. Invalidate pending hydration on sign-out and on new login. Keep duplicate login protection active until the full hydration finishes or explicitly support a single in-flight hydration per auth user.

### 3. Debounced remote search can apply stale/out-of-order results across route/view changes

Relevant code:

- `src/App.tsx:1428-1436` debounces filter searches by closing over `nextFilters` and the render-time `loadRemoteUnitSearch` function.
- `src/App.tsx:1450-1472` applies results without request id, current-route validation, or stale-response protection.
- `src/App.tsx:1465-1466` sets `remoteSearchUnits` and derives `remoteSearchView` from the render-time `activeView` captured by the async function.
- Pending debounce is only cleared on reset/unmount (`src/App.tsx:1439-1448`, `528-532`), not on navigation, view changes, route destination/project changes, or sign-out.

Risk:

- A user can change filters and immediately navigate from inventory to special (or between destination/project routes); the delayed callback can still fire with the old route/view and set `remoteSearchView` to the stale view.
- Two searches can resolve out of order; the older response can overwrite the newer filter result.
- An in-flight search can complete after full workspace hydration and reapply stale remote units even after `loadSupabaseAppState()` cleared them.

Expected fix:

Use a monotonically increasing request id or abort controller for remote unit searches, and only apply the latest request if the active view/route/filter signature still matches. Clear pending debounce and invalidate in-flight searches on route/view changes, full hydration replacement, reset, sign-out, and unmount.

### 4. Payment reconciliation is preserved in function placement, but payment-sensitive screens are not protected from pre-reconciliation shell state

Relevant code:

- `src/lib/supabaseState.ts:98-101` still calls `repository.reconcileDueUnitPayments()` before loading full app state. This preserves the original ordering inside `loadSupabaseAppState()`.
- `src/App.tsx:453-458` shows the authenticated shell before `loadSupabaseAppState()` and therefore before reconciliation completes.

Risk:

- The reconciliation call itself was not removed, which is good.
- But payment-sensitive UI can render before reconciliation has finished. If details/admin/analytics/dashboard/create are available during the shell window, users can see stale/empty/default payment state or trigger actions before the reconciled workspace is applied.

Expected fix:

Keep payment-sensitive screens/actions gated until the reconciled full workspace is applied, or perform route-specific payment-safe fetch/reconciliation before enabling those routes.

## Tests and coverage notes

Positive:

- `src/lib/supabaseState.test.ts` covers that shell state contains the authenticated user and no demo workspace data.
- `e2e/mobile-touch-reliability.spec.ts` checks that key demo-mode mobile elements receive a center tap and respond to `.tap()`.
- Playwright project split to explicit iPhone and Android devices is useful.

Gaps:

- No test covers sign-out while background hydration is still pending.
- No test covers a second login/session event while the first background hydration is still pending.
- No test covers deep-link details/create/admin/analytics behavior during workspace hydration.
- No test covers debounced search stale result ordering or navigation while a debounce/in-flight query is pending.
- The mobile tap E2E runs in demo mode, so it does not exercise the new Supabase shell/hydration path where most race risk exists.
- The tap-blocking helper only checks the center point. That is useful, but it will not catch edge overlap, sticky-footer/header overlap after scroll, or elements that become blocked during animations.

Recommended additional validation before approval:

- Unit/integration test with deferred `loadSupabaseAppState()` promise: assert workspace-dependent pages render loading/disabled states and do not show false empty/not-found states.
- Test sign-out before deferred hydration resolves: assert remote state is not applied after sign-out.
- Test two deferred remote searches resolving out of order: assert only latest result is applied.
- Test route/view change while debounce is pending: assert stale result is ignored.
- Add a Supabase-auth mocked/mobile E2E or component integration path for shell hydration, not only demo sign-in.

## Mobile touch/CSS assessment

The CSS changes reducing coarse-pointer motion durations and removing stagger delays are low risk. Setting `pointer-events: none` on the listed pseudo-elements appears consistent with decorative overlays; `inventory-scope-card::before` is behind content with `z-index: -1`, and the other named pseudo-elements appear decorative. This part is acceptable, though the E2E should eventually broaden beyond center-point checks.

## Production risk

Current production risk is medium/high because the optimization changes authentication startup ordering and allows UI to render before full, reconciled workspace state is ready. The user-facing symptom may be transient, but the race windows can lead to stale data application after sign-out/new-login and misleading empty/payment states. These should be fixed before merge/completion.
