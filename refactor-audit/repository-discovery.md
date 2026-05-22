# Repository Discovery

## Project Type

Leadra is a React/Vite TypeScript web application backed by Supabase. The app is an internal real estate resale management system with role-aware dashboards, unit browsing, unit creation/editing, PDF export, admin management, analytics, and notification workflows.

## Languages

- TypeScript/TSX: app, domain logic, repository, tests, Supabase Edge Functions.
- CSS: global Tailwind v4 and custom application styles.
- SQL: Supabase migrations.
- JavaScript/MJS: local scripts and QA tooling.
- HTML/SVG/assets: Vite shell and public/static assets.

## Frameworks And Platforms

- React 19 and React DOM.
- Vite 8 with `@vitejs/plugin-react`.
- Tailwind CSS v4 via `@tailwindcss/vite`.
- Supabase JS, Auth, Postgres, Storage, RLS, Edge Functions.
- TanStack Query.
- React Router.
- Vitest, Testing Library, jsdom.
- Playwright for preview/e2e QA.
- Vercel deployment config.

## Architecture

- `src/main.tsx`: React root, providers, query client, Agentation in dev.
- `src/App.tsx`: main shell, route orchestration, state wiring, user/session flow, cross-feature handlers.
- `src/features/*`: feature views for admin, create unit, details, units list, and shared form/media/label helpers.
- `src/components/LeadraUi.tsx`: shared UI primitives.
- `src/lib/*`: domain rules, workflows, repository/Supabase mapping, i18n, routing, PDF, notifications, theme.
- `src/data/*`: demo/performance seed data.
- `supabase/functions/*`: Deno Edge Functions for admin/account/audit/email/phone workflows.
- `supabase/migrations/*`: schema, policies, RPCs, storage, and PRD-driven changes.

## Tooling

- Lint: `npm run lint`.
- Typecheck: `npm run typecheck`.
- Unit tests: `npm test`.
- Build: `npm run build`.
- Preview QA: `npm run qa:preview`.
- Final QA: `npm run qa:final`.
- Staging QA: `npm run qa:staging`, destructive and guarded by staging env vars.

## Critical Behavior

- Auth/session and role assignment.
- Admin-created account model.
- Owner phone normalization and visibility rules.
- Unit create/edit/archive/status/payment/media workflows.
- Supabase RLS and permission-safe RPC reads.
- PDF export privacy/sanitization.
- Storage privacy for unit media and company assets.
- Analytics access and targets.
- Notification email delivery.

