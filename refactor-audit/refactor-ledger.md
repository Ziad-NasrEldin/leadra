# Refactor Ledger

| File | Risk | Action | Summary | Validation | Follow-up |
|---|---|---|---|---|---|
| `refactor-audit/*.md` | Low | added | Added discovery, inventory, risk map, plan, ledger, changed-files, deferred items, validation log, and final report artifacts. | Lint pass, typecheck pass, unit tests pass, build pass. | Keep updated after every batch. |
| `src/assets/react.svg` | Low | deleted | Removed unused Vite template asset. | Lint pass, typecheck pass, build pass. | None. |
| `src/assets/vite.svg` | Low | deleted | Removed unused Vite template asset. | Lint pass, typecheck pass, build pass. | None. |
| `src/lib/pdf.ts` | High | refactored | Restored tested PDF export contract for displayed paid/remaining amounts and unit-code/month-day filenames. | PDF tests pass; lint, typecheck, full unit suite, and build pass. | None. |
| `src/App.tsx` | High | deferred | Main app shell and workflow orchestration. | Lint, typecheck, unit tests, and build pass. | Split only in focused follow-up with route/session tests. |
| `src/lib/pdf.ts` | High | refactored | PDF behavior now follows existing test contract. | Full validation green. | Keep file naming contract documented through tests. |
| `src/features/shared/formUtils.ts` | Medium | refactored | Centralized installment lookup tables and reused optional number parsing. | Domain tests pass; lint, typecheck, full unit suite, and build pass. | None. |
| `src/lib/pdfWorkflow.ts` | Medium | extracted | Added cache-or-generate helpers plus PDF action record construction/mapping. | App tests pass; lint, typecheck, full unit suite, and build pass. | None. |
| `src/App.tsx` | High | refactored | Replaced duplicated PDF cache/generate loops and record construction with `pdfWorkflow` helpers. | App tests pass; lint, typecheck, full unit suite, and build pass. | Continue extracting one workflow at a time. |
| `src/lib/domain.ts` | High | unchanged | Broad business-rule module. | Baseline lint/typecheck pass. | Target pure functions only with domain tests. |
| `src/lib/repository.ts` | High | deferred | Supabase table/RPC access layer. | Baseline lint/typecheck pass. | Preserve remote contracts; edit only with repository tests. |
| `src/lib/i18nCatalog.ts` | Medium | extracted | Translation catalog data moved out of provider/formatting module. | Typecheck pass; App tests pass. | Keep key additions in catalog module. |
| `src/lib/i18n.tsx` | Medium | refactored | Locale provider and formatting API preserved with catalog import. | Typecheck pass; App tests pass. | Consider typed message-key coverage in a separate task. |
| `src/lib/legacyRoutes.ts` | Medium | extracted | Legacy hash route mapping isolated while `routes.ts` re-exports `legacyHashPath`. | `src/lib/routes.test.ts` pass. | Do not remove until route migration is explicit. |
| `src/lib/legacyAuth.ts` | High | extracted | Legacy admin password compatibility isolated while `adminAuth.ts` re-exports existing APIs. | Typecheck pass; App/admin tests pass through targeted App suite. | Treat removal as auth migration. |
| `src/features/dashboard/dashboardSummaries.ts` | Medium | extracted | Dashboard rollup and lookup-backed destination/project summaries moved out of `App.tsx`. | `src/App.test.tsx` pass. | Candidate for direct unit tests if dashboard logic grows. |
| `src/lib/repositoryHelpers.ts` | High | extracted | Repository helper logic moved out of the Supabase class without changing method signatures. | `src/lib/repository.test.ts` and `src/lib/functionErrors.test.ts` pass. | Keep Supabase RPC names and filters stable. |
| `src/lib/workflowHelpers.ts` | Medium | extracted | Workflow guard and audit diff helpers moved out of workflow entrypoint module. | `src/lib/workflows.test.ts` pass. | Keep workflow exports stable. |
| `src/lib/domainUnitTypes.ts` | Medium | extracted | PRD unit-type and area-field rules moved behind stable `domain.ts` re-exports. | `src/lib/domain.test.ts` pass. | Payment and permission domains can be split later. |
| `src/features/admin/AdminPage.tsx` | Medium | refactored | Settings FormData parsing now uses shared typed readers. | `src/App.test.tsx` pass. | Continue migrating remaining admin form reads later. |
| `src/features/admin/UserManagement.tsx` | Medium | refactored | User edit FormData parsing now uses shared typed readers. | `src/App.test.tsx` pass. | Continue migrating password/delete forms only if useful. |
| `supabase/functions/*` | Critical | deferred | Auth/service-role/public Edge Functions. | Not changed. | Require focused Supabase verification before edits. |
| `supabase/migrations/*` | Critical | deferred | Database schema/RLS/RPC/storage history. | Not changed. | Do not modify in broad cleanup pass. |
