# Agent Instructions

## Project Overview

Leadra is a mobile-first internal real estate resale management app built with React, Vite, TypeScript, Supabase, TanStack Query, Vitest, Playwright, and Tailwind CSS v4.

## Operating Principles

- Think before coding: state assumptions, tradeoffs, and success criteria for non-trivial work.
- Keep changes surgical and goal-driven. Touch only files required by the task.
- Prefer existing repo patterns over new abstractions.
- Verify changes with the narrowest meaningful command first, then broaden when risk or shared behavior warrants it.
- Do not commit secrets or real production credentials. Local development can run in demo mode.

<!-- lean-ctx -->
## lean-ctx

Prefer lean-ctx MCP tools over native equivalents for token savings.
Full rules: @LEAN-CTX.md
<!-- /lean-ctx -->

## Local Development

- Install dependencies: `npm install`
- Start local dev server: `npm run dev`
- Default local URL: `http://localhost:5173`
- Production builds require `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; missing values should not expose demo access.
- Do not commit `.env`, `.env.local`, Supabase service-role keys, or staging QA credentials.

## Verification Commands

- Typecheck: `npm run typecheck`
- Unit tests: `npm test`
- Lint: `npm run lint`
- Production build: `npm run build`
- Playwright preview QA: `npm run qa:preview`
- Final QA gate: `npm run qa:final`

## Supabase Notes

- Keep public sign-up disabled for the admin-created-account model.
- Use `npm run seed:admin` only with explicit local or staging credentials.
- `npm run qa:staging` is destructive and must only run against a separate staging Supabase project with `LEADRA_QA_ALLOW_DESTRUCTIVE=true`.
