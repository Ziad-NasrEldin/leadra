# Refactor Plan

## Phase 0 - Discovery And Audit Artifacts

- Record repository type, stack, tooling, critical behavior, and validation baseline.
- Create file inventory, dependency/risk map, ledger, deferred list, validation log, and final report.
- Do not change production source during this phase.

## Phase 1 - Mechanical Cleanup

- Limit to low-risk files and tests with clean lint/typecheck validation.
- Remove only proven unused local code or stale comments.
- Avoid all migrations, Edge Functions, public route contracts, schema/types, and app bootstrap.

## Phase 2 - Local Logic Cleanup

- Prefer isolated pure helpers with existing tests.
- Candidate areas: `src/features/shared/formUtils.ts`, `src/lib/routes.ts`, `src/lib/theme.tsx`, tests.
- Preserve exported names and return shapes.

## Phase 3 - Feature/UI Cleanup

- Tackle one feature file at a time.
- Preserve visual output, routes, labels, form field names, keyboard behavior, and permission behavior.
- Validate with lint/typecheck and targeted tests; use Playwright only when UI behavior is touched.

## Phase 4 - Domain/Repository Cleanup

- Only after baseline tests are stable or targeted tests isolate the behavior.
- Preserve database table/RPC names, payload shapes, and error semantics.
- Add/update tests before changing shared business logic.

## Phase 5 - Supabase/Config Cleanup

- Defer migrations and Edge Function behavior changes unless a focused bug fix is requested.
- If touched, verify against Supabase docs/CLI help and run relevant local or staging validation.

## Validation Cadence

- After each batch: `npm run lint`, `npm run typecheck`, targeted tests.
- Final: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run qa:preview` if UI/routing changed.

