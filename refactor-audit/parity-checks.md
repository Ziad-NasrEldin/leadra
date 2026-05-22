# Refactor Parity Checks

| Refactor Pass | Current Behavior Preserved | Structural Improvement | Validation |
|---|---|---|---|
| Dead code cleanup | Vite template assets had no repo references. | Removed unused template assets only. | Lint, typecheck, build. |
| Form parsing consolidation | Create/edit/admin settings/user forms submit the same values. | Added shared typed FormData readers and migrated high-traffic forms. | `src/App.test.tsx`, typecheck. |
| App shell decomposition | Dashboard rollups, destination/project summaries, and PDF actions render/behave the same. | Moved pure summary/PDF helpers out of `App.tsx`. | `src/App.test.tsx`. |
| Workflow simplification | Workflow exported functions and audit diff behavior stay stable. | Moved guard/audit helper code to `workflowHelpers.ts`. | `src/lib/workflows.test.ts`. |
| Domain grouping | PRD unit types, floor options, and area-field visibility stay stable. | Moved PRD unit-type rules to `domainUnitTypes.ts` with `domain.ts` re-exports. | `src/lib/domain.test.ts`. |
| Repository cleanup | Supabase method signatures, RPC names, filters, and fallback behavior stay stable. | Moved filter/error/RPC fallback helpers to `repositoryHelpers.ts`. | `src/lib/repository.test.ts`, `src/lib/functionErrors.test.ts`. |
| i18n structure | `LocaleProvider`, `useLocale`, `translate`, and formatting helpers stay stable. | Moved large catalogs to `i18nCatalog.ts`. | Typecheck, `src/App.test.tsx`. |
| Legacy compatibility | Hash routes and admin password compatibility remain active. | Moved compatibility adapters to `legacyRoutes.ts` and `legacyAuth.ts`. | `src/lib/routes.test.ts`, App tests. |

## Deferred Migration Checks

- Dependency/framework upgrades require a separate migration plan and fresh lockfile/build/browser QA.
- Supabase Edge Function, RLS, RPC, and SQL migration cleanup require staging Supabase parity checks.
- Removing legacy hash routes or password padding requires explicit product/auth migration approval.
