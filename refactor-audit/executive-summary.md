# Refactor Audit Executive Summary

Date: 2026-05-22

## Discovery

Leadra is a mobile-first internal real estate resale management web app.

- Project type: frontend SPA with Supabase backend resources and Edge Functions.
- Languages: TypeScript, TSX, CSS, SQL, JavaScript/MJS, HTML, SVG/assets.
- Frameworks/tools: React 19, Vite 8, TypeScript 6, Tailwind CSS v4, Supabase, TanStack Query, React Router, Vitest, Testing Library, Playwright, ESLint.
- Package manager: npm with `package-lock.json`.
- Deployment/config: Vercel config, Vite build, static security headers in `public/_headers`.

## Baseline Validation

| Command | Result | Notes |
|---|---|---|
| `npm run lint` | Pass | Baseline lint is clean. |
| `npm run typecheck` | Pass | Baseline typecheck is clean. |
| `npm test` | Pass | PDF export contract fixed; 150 tests pass. |

Resolved baseline test expectations:

- PDF content now includes displayed paid and remaining values.
- PDF filename now uses `UNITCODE-MonD.pdf`.

## Current Scope

- Files scanned: 155 source/config/doc/static files, excluding dependency/build/cache/report folders.
- Source files classified: 46 `src` TypeScript/TSX/CSS files, 7 Supabase Edge Functions, 52 SQL migrations.
- Files changed so far: audit artifacts, PDF export contract fix, and removal of two unused template assets.
- High-risk areas: app shell, route handling, domain workflows, repository/Supabase state, PDF export, auth/admin Edge Functions, all migrations.
- Deferred areas: database migrations, auth/RLS/service-role behavior, deployment/security headers, public route/API contracts, and large app-shell decomposition.
