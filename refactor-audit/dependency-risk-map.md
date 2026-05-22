# Dependency And Risk Map

## Entrypoints

| Area | Imports | Imported By | Risk | Notes |
|---|---|---|---|---|
| `src/main.tsx` | React, React DOM, QueryClient, app providers, `App` | Vite HTML entry | High | App bootstrap/provider order affects all behavior. |
| `src/App.tsx` | Most feature, lib, state, domain, Supabase modules | Tests and runtime root | High | Largest orchestration file; route/session/state/user workflows. |
| `supabase/functions/*/index.ts` | Deno std, Supabase JS, external APIs | Supabase runtime | Critical | Auth/service-role and public function contracts. |
| `supabase/migrations/*.sql` | Postgres/Supabase runtime | Database migration history | Critical | Schema/RLS/RPC/storage changes are production-sensitive. |

## Shared Modules

| Area | Imports | Imported By | Risk | Safe Action |
|---|---|---|---|---|
| `src/lib/domain.ts` | i18n/types | app, features, tests, mappers, PDF, analytics | High | Only small pure-function cleanups with targeted tests. |
| `src/lib/workflows.ts` | domain/messages/types | app/tests | High | Preserve business results and data mutations. |
| `src/lib/repository.ts` | Supabase mapper/domain/types | app/tests/state | High | Preserve RPC/table names, response shapes, and errors. |
| `src/lib/supabaseState.ts` | Supabase client/repository/i18n | app | High | Preserve remote load/save behavior. |
| `src/lib/types.ts` | none | broad app | High | Public internal data model; avoid renames without full update. |
| `src/lib/routes.ts` | none | app/tests/UI links | Medium | Preserve URL contracts. |
| `src/lib/i18n.tsx` | React/types | broad UI | Medium | Copy/key changes can affect UI tests and locale behavior. |
| `src/components/LeadraUi.tsx` | React, portal, router, lucide, i18n | feature views/app/tests | Medium | Preserve accessibility and keyboard behavior. |

## Feature Modules

| Area | Imports | Imported By | Risk | Safe Action |
|---|---|---|---|---|
| `src/features/admin/*` | UI, i18n, shared constants/media | `App.tsx` | Medium | Local component cleanup after smoke/unit coverage. |
| `src/features/create/CreateUnitPage.tsx` | domain/form/media/UI | `App.tsx`, tests | Medium | Preserve form names and submit payloads. |
| `src/features/details/UnitDetailsPage.tsx` | domain/form/UI | `App.tsx` | Medium | Preserve owner-data permissions and edit payloads. |
| `src/features/units/UnitsPage.tsx` | domain/form/media/UI | `App.tsx` | Medium | Preserve filters, pagination, route links, owner visibility. |
| `src/features/shared/*` | domain/i18n/types/Supabase | feature views/app | Medium | Good first source cleanup area, but existing tests must cover logic. |

## Deferred High-Risk Dependencies

- Supabase migrations and RLS policies.
- Edge Function auth/service-role paths.
- PDF export behavior mismatch with existing tests.
- App shell state/routing/session orchestration.
- Vercel/security headers and production config.

