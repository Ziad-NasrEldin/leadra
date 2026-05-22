# Deferred Items

| File/Area | Reason Deferred | Risk | Recommended Next Step |
|---|---|---|---|
| `src/App.tsx` | 3,500+ line app shell mixes routing, session, state, and handlers. Large blast radius. | High | Split by one workflow at a time with route/app tests. |
| `src/lib/workflows.ts` | Core business mutations and permission-sensitive workflows. | High | Refactor only after targeted workflow tests are green. |
| `src/lib/repository.ts` and `src/lib/supabaseState.ts` | Remote persistence, RPC/table names, and error behavior. | High | Make focused changes with repository tests and Supabase validation. |
| `supabase/functions/*` | Auth, admin, audit, email, service-role behavior. | Critical | Require function-specific tests or staging smoke checks. |
| `supabase/migrations/*` | Production schema/RLS/RPC/storage history. | Critical | Do not edit in general refactor; create new migrations only for approved schema changes. |
| `public/_headers`, `vercel.json`, build config | Deployment/security behavior. | High | Change only in focused deployment/security pass. |
