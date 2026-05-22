# File Inventory

Generated/dependency/build folders excluded: `node_modules/`, `.git/`, `dist/`, `coverage/`, `.cache/`, `.turbo/`, `playwright-report/`, `test-results/`, `artifacts/`, `reports/`.

Risk is based on blast radius, public/user impact, persistence/security sensitivity, and validation availability.

| File | Category | Lines | Risk | Safe-To-Edit |
|---|---|---:|---|---|
| `.env.example` | config/example | 27 | Low | Yes, docs-only env clarity. |
| `AGENTS.md` | documentation | 44 | Low | Yes, instructions only. |
| `DESIGN.md` | documentation/design | 269 | Low | Yes, if documenting current UI only. |
| `LEAN-CTX.md` | documentation/tooling | 36 | Low | No, agent/tooling contract. |
| `README.md` | documentation | 129 | Low | Yes, if matching current behavior. |
| `e2e/production.spec.ts` | e2e test | 324 | Low | Yes, test-only with QA validation. |
| `eslint.config.js` | configuration | 23 | Low | Defer unless lint policy change requested. |
| `index.html` | app entry shell | 24 | High | Defer; public bootstrap. |
| `package.json` | package/tooling | 60 | High | Defer; scripts/deps contract. |
| `playwright.config.ts` | test configuration | 31 | Medium | Defer unless QA target changes. |
| `public/_headers` | deployment/security headers | 7 | High | Defer; security/deployment behavior. |
| `public/favicon.svg` | static asset | 1 | Low | Defer unless asset cleanup requested. |
| `public/icons.svg` | static asset | 25 | Low | Defer unless asset cleanup requested. |
| `public/leadra-favicon.png` | static asset | binary | Low | Defer unless asset cleanup requested. |
| `public/robots.txt` | deployment/static | 3 | Medium | Defer; indexing behavior. |
| `scripts/performance-audit.mjs` | script/tooling | 503 | Low | Yes, isolated script with manual run. |
| `scripts/qa-final.mjs` | script/tooling | 31 | Medium | Defer; release gate. |
| `scripts/qa-staging.mjs` | script/tooling | 307 | High | Defer; destructive staging QA. |
| `scripts/seed-admin-user.mjs` | script/tooling | 113 | High | Defer; service-role/admin creation. |
| `src/App.test.tsx` | test | 1142 | Low | Yes, test-only with app behavior preserved. |
| `src/App.tsx` | app shell/view orchestration | 3533 | High | Defer initially; broad blast radius. |
| `src/assets/brand/leadra-logo-dark.jpeg` | asset | binary | Low | Defer. |
| `src/assets/brand/leadra-logo-light.jpeg` | asset | binary | Low | Defer. |
| `src/assets/brand/leadra-mark-dark.png` | asset | binary | Low | Defer. |
| `src/assets/brand/leadra-mark-light.png` | asset | binary | Low | Defer. |
| `src/assets/brand/leadra-sidebar-logo-dark.png` | asset | binary | Low | Defer. |
| `src/assets/brand/leadra-sidebar-logo-light.png` | asset | binary | Low | Defer. |
| `src/assets/hero.png` | asset | binary | Low | Defer. |
| `src/assets/react.svg` | asset | 1 | Low | Deleted; no repo references found. |
| `src/assets/vite.svg` | asset | 2 | Low | Deleted; no repo references found. |
| `src/components/LeadraUi.test.tsx` | test | 67 | Low | Yes, test-only. |
| `src/components/LeadraUi.tsx` | shared component/view | 640 | Medium | Later; preserve accessibility/keyboard behavior. |
| `src/data/performanceSeed.ts` | performance/demo data | 197 | Low | Yes, if perf mode validated. |
| `src/data/seed.ts` | demo seed data | 770 | Medium | Defer; tests/demo behavior depend on it. |
| `src/features/admin/AdminPage.tsx` | feature/view | 561 | Medium | Later; admin UI and forms. |
| `src/features/admin/MasterData.tsx` | feature/view | 516 | Medium | Later; admin master data and thumbnails. |
| `src/features/admin/UserManagement.tsx` | feature/view | 300 | Medium | Later; user management form behavior. |
| `src/features/create/CreateUnitPage.tsx` | feature/view/form | 423 | Medium | Later; preserve form names/payloads. |
| `src/features/details/UnitDetailsPage.tsx` | feature/view/form | 859 | Medium | Later; owner/privacy/edit behavior. |
| `src/features/shared/constants.ts` | shared constants/types | 32 | Medium | Later; broad import surface. |
| `src/features/shared/formUtils.ts` | shared helper | 115 | Medium | Good candidate for pure helper cleanup. |
| `src/features/shared/labels.ts` | shared labels | 39 | Low | Yes, if text contracts preserved. |
| `src/features/shared/media.ts` | shared media/storage helper | 109 | Medium | Defer; Supabase Storage behavior. |
| `src/features/shared/motion.ts` | shared style helper | 9 | Low | Yes, isolated. |
| `src/features/units/UnitsPage.tsx` | feature/view/list | 560 | Medium | Later; filters/visibility/routes. |
| `src/index.css` | global styles/theme | 7828 | Medium | Defer; broad visual blast radius. |
| `src/lib/adminAuth.ts` | admin auth client helper | 148 | High | Defer; Edge Function/auth contracts. |
| `src/lib/analytics.test.ts` | test | 196 | Low | Yes, test-only. |
| `src/lib/analytics.ts` | analytics domain | 424 | Medium | Later with tests. |
| `src/lib/createUnitErrors.ts` | error mapping | 158 | Medium | Later; user-facing errors. |
| `src/lib/domain.test.ts` | test | 633 | Low | Yes, test-only. |
| `src/lib/domain.ts` | domain rules | 905 | High | Defer initially; business rules. |
| `src/lib/i18n.tsx` | i18n/provider/copy | 1675 | Medium | Defer; all UI copy/locales. |
| `src/lib/messageRendering.ts` | message rendering helper | 56 | Low | Yes, if tests cover strings. |
| `src/lib/notificationDelivery.test.ts` | test | 160 | Low | Yes, test-only. |
| `src/lib/notificationDelivery.ts` | notification domain | 203 | Medium | Later; email/audience behavior. |
| `src/lib/pdf.test.ts` | test | 310 | High | Defer until PDF contract confirmed. |
| `src/lib/pdf.ts` | PDF export | 519 | High | Defer; baseline test mismatch. |
| `src/lib/pdfWorkflow.ts` | PDF workflow helper | 22 | Medium | Extracted from app shell; safe with App tests. |
| `src/lib/repository.test.ts` | test | 1016 | Low | Yes, test-only. |
| `src/lib/repository.ts` | Supabase repository | 440 | High | Defer; persistence/RPC behavior. |
| `src/lib/routes.test.ts` | test | 141 | Low | Yes, test-only. |
| `src/lib/routes.ts` | route parser/builders | 262 | Medium | Later; preserve URL contracts. |
| `src/lib/supabase.ts` | Supabase client config | 21 | High | Defer; production/demo mode behavior. |
| `src/lib/supabaseMapper.test.ts` | test | 337 | Low | Yes, test-only. |
| `src/lib/supabaseMapper.ts` | DB row mapper | 560 | Medium | Later with mapper tests. |
| `src/lib/supabaseState.ts` | Supabase state loader | 394 | High | Defer; remote load/save behavior. |
| `src/lib/systemMessages.ts` | localized system messages | 579 | Medium | Later; notification/audit text. |
| `src/lib/theme.test.ts` | test | 12 | Low | Yes, test-only. |
| `src/lib/theme.tsx` | theme provider/storage | 63 | Medium | Later; localStorage/theme behavior. |
| `src/lib/types.ts` | shared data model | 550 | High | Defer; broad public internal API. |
| `src/lib/workflows.test.ts` | test | 815 | Low | Yes, test-only. |
| `src/lib/workflows.ts` | business workflows | 1451 | High | Defer; mutation/permission logic. |
| `src/main.tsx` | app bootstrap | 24 | High | Defer; root providers. |
| `src/test/setup.ts` | test setup | 31 | Low | Yes, test-only. |
| `supabase/functions/admin-create-user/index.ts` | Edge Function/auth/admin | 182 | Critical | Defer; service-role/public contract. |
| `supabase/functions/admin-deactivate-sales-rep/index.ts` | Edge Function/auth/admin | 167 | Critical | Defer; destructive user/unit reassignment. |
| `supabase/functions/admin-update-user-password/index.ts` | Edge Function/auth/admin | 99 | Critical | Defer; password/admin behavior. |
| `supabase/functions/admin-update-user-profile/index.ts` | Edge Function/auth/admin | 164 | Critical | Defer; privilege metadata. |
| `supabase/functions/audit-sensitive-action/index.ts` | Edge Function/audit | 30 | Critical | Defer; audit/security behavior. |
| `supabase/functions/normalize-owner-phone-check-duplicate/index.ts` | Edge Function/RPC | 34 | Critical | Defer; duplicate owner checks. |
| `supabase/functions/send-notification-email/index.ts` | Edge Function/email | 28 | Critical | Defer; external email delivery. |
| `supabase/migrations/*.sql` | database migrations | 52 files | Critical | Defer all broad cleanup. |
| `tsconfig.app.json` | TypeScript config | 26 | Medium | Defer; compiler behavior. |
| `tsconfig.json` | TypeScript config | 8 | Medium | Defer; project references. |
| `tsconfig.node.json` | TypeScript config | 25 | Medium | Defer; tool config. |
| `vercel.json` | deployment config | 9 | High | Defer; production behavior. |
| `vite.config.ts` | build/test config | 30 | Medium | Defer; build/test behavior. |
