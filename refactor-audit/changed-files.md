# Changed Files

| File | Change Type | Summary | Risk |
|---|---|---|---|
| `refactor-audit/executive-summary.md` | documentation | Added audit summary and baseline status. | Low |
| `refactor-audit/repository-discovery.md` | documentation | Added discovered stack, architecture, tooling, and critical behavior. | Low |
| `refactor-audit/file-inventory.md` | documentation | Added source/config inventory and risk classification. | Low |
| `refactor-audit/dependency-risk-map.md` | documentation | Added dependency/risk map by subsystem. | Low |
| `refactor-audit/refactor-plan.md` | documentation | Added safe execution order and validation cadence. | Low |
| `refactor-audit/refactor-ledger.md` | documentation | Added initial file-by-file action ledger. | Low |
| `refactor-audit/deferred-items.md` | documentation | Added deferred high-risk items. | Low |
| `refactor-audit/validation-results.md` | documentation | Added baseline validation results. | Low |
| `refactor-audit/final-report.md` | documentation | Added current final report snapshot. | Low |
| `src/assets/react.svg` | deletion | Removed unused Vite template asset with zero repo references. | Low |
| `src/assets/vite.svg` | deletion | Removed unused Vite template asset with zero repo references. | Low |
| `src/lib/pdf.ts` | refactor | Uses displayed payment totals in PDF export and restores unit-code/month-day generated filenames. | High |
| `src/features/shared/formUtils.ts` | refactor | Centralized installment frequency/label lookup and reused optional number parsing. | Medium |
| `src/lib/pdfWorkflow.ts` | extraction | Added reusable cache-or-generate helpers and PDF action record builders. | Medium |
| `src/App.tsx` | refactor | Uses extracted PDF workflow helpers for PDF cache/generation and action records. | High |
| `src/lib/i18nCatalog.ts` | extraction | Moved translation catalogs out of the locale provider while preserving `translate`, `useLocale`, and formatter APIs. | Medium |
| `src/lib/i18n.tsx` | refactor | Reduced to locale provider, formatting helpers, and public i18n API. | Medium |
| `src/lib/legacyRoutes.ts` | extraction | Isolated legacy hash-route compatibility behind the existing `legacyHashPath` export. | Medium |
| `src/lib/legacyAuth.ts` | extraction | Isolated legacy admin password padding/candidate behavior behind existing admin auth exports. | High |
| `src/features/dashboard/dashboardSummaries.ts` | extraction | Moved dashboard rollup and lookup-backed summary helpers out of `App.tsx`. | Medium |
| `src/lib/repositoryHelpers.ts` | extraction | Moved repository filter compaction, remote error wrapping, RPC fallback detection, and client-side filter parity helpers out of the repository class. | High |
| `src/lib/workflowHelpers.ts` | extraction | Moved workflow admin guards, empty-user fallback, and unit edit audit diff helpers out of the workflow entrypoint module. | Medium |
| `src/lib/domainUnitTypes.ts` | extraction | Moved PRD unit type constants, area-mode specs, floor options, and area-field rules behind stable `domain.ts` re-exports. | Medium |
| `src/features/admin/AdminPage.tsx` | refactor | Uses shared FormData readers for settings updates. | Medium |
| `src/features/admin/UserManagement.tsx` | refactor | Uses shared FormData readers for user profile updates. | Medium |
