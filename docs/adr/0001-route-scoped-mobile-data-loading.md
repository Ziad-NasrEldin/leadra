# ADR 0001: Route-scoped mobile data loading

## Status

Accepted

## Context

Leadra is used on mobile devices through a Median-built installed iOS app as well as mobile browsers. The current application startup path loads the user's profile and then hydrates a broad workspace before the app becomes usable. That broad hydration includes Units, users, lookup values, settings, notifications, audit logs, analytics events, analytics targets, and payment reconciliation work.

This makes mobile startup and route transitions slow, especially as production data grows. It also encourages large in-memory filtering/searching of Units, which does not scale well on iPhone/Android WebView performance budgets.

The product still needs operational correctness: role-safe Unit visibility, Original Owner data masking, exact Dashboard metrics, reliable payment-sensitive views, and server-confirmed writes.

## Decision

Use route-scoped, paginated, stale-while-revalidate data loading instead of full upfront workspace hydration.

Specifically:

- Authentication/profile validation remains blocking before entering the app.
- The app shell and current route render as soon as the profile is valid.
- Units are loaded through paginated, server-side list/search/filter queries.
- Initial Unit page size starts at 20 Units on mobile and 50 on desktop/tablet.
- Unit search/filter runs across all Units the user is permitted to browse, not just the currently loaded page.
- Unit Details fetches a single Unit by ID when that Unit is not already cached.
- Dashboard metrics come from a lightweight role-safe summary query/RPC and show skeletons until exact metrics arrive; first-page partial counts are not presented as complete metrics.
- Admin, Master Data, User Management, Audit, Analytics, full Notifications, and PDF-heavy data load only when their routes/surfaces are opened.
- First load may fetch only a cheap unread notification count for a badge; full Notifications are paginated in the notification center.
- Mobile data uses stale-while-revalidate, not offline-first. Cached data may render quickly, but operational data revalidates on app resume/route open.
- Offline writes are out of scope. Edits, status/payment changes, uploads, PDF actions, and admin actions require online server confirmation.
- Payment reconciliation must not block global startup. Payment-sensitive surfaces should show an updating/warning state if reconciliation is pending or fails.

## Consequences

Positive:

- Faster perceived startup on iPhone/Android and inside the Median wrapper.
- Lower mobile main-thread and network pressure.
- Unit browsing/search scales better as production data grows.
- Admin/analytics/audit costs are paid only by users who open those surfaces.
- Exact Dashboard metrics are preserved without loading the entire Unit dataset.

Negative / tradeoffs:

- More data-loading states must be handled explicitly.
- Pagination changes selection semantics; first implementation keeps batch selection page-scoped.
- Server-side list/search/filter and summary queries must preserve all existing role and privacy rules.
- Tests must cover direct Unit Details URLs because the full Units array is no longer guaranteed to exist in memory.
- Offline editing remains unsupported until a future sync/conflict-resolution design exists.

## Alternatives considered

### Continue full workspace hydration

Rejected. It is simpler and preserves local filtering, but it causes slow mobile startup and will degrade as Units, audit logs, analytics events, and notifications grow.

### Keep full Unit load but virtualize rendering

Rejected as the primary strategy. Virtualization helps render cost but does not solve network payload, startup hydration, search correctness at scale, or WebView memory pressure.

### Offline-first mobile app

Rejected for this cycle. Offline writes would require queues, conflict resolution, media upload retry semantics, payment/status reconciliation rules, and careful audit behavior.

### Replace Median immediately with a custom Xcode wrapper

Rejected for this cycle. The current performance problem should first be isolated with Safari-vs-Median testing and optimized in the web app. A custom Xcode WKWebView wrapper is only justified if Median-specific behavior remains a blocker or native control becomes necessary.
