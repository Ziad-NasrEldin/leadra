# Leadra

Mobile-first internal real estate resale management system for Leadra.

## Stack

- React + Vite + TypeScript
- Supabase Auth, Postgres, Storage, RLS, and Edge Functions
- TanStack Query, React Router-ready SPA structure, React Hook Form/Zod-ready dependencies
- Vitest and Testing Library
- Tailwind CSS v4 with a custom mobile-first interface

## Local Development

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

The app starts in local demo mode unless `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set.

## Supabase Setup

```powershell
supabase link --project-ref your-project-ref
supabase db push
supabase functions deploy generate-unit-pdf
supabase functions deploy send-notification-email
supabase functions deploy audit-sensitive-action
supabase functions deploy normalize-owner-phone-check-duplicate
supabase secrets set RESEND_API_KEY=your-key LEADRA_FROM_EMAIL="Leadra <notifications@your-domain.com>"
```

The migration creates the role enums, core tables, owner-phone normalization, same-project duplicate protection, RLS policies, and private storage buckets.

## Implemented MVP Surface

- Demo role login for Admin, Sub Admin, Manager, and Sales Representative.
- Role-aware dashboards, project-first unit browsing, filters, create-unit form, details page, notifications, profile, and admin panels.
- Tested PRD business rules for phone normalization, duplicate blocking, team visibility, owner data permissions, media limits, payment math, commission math, unit code generation, archive permissions, and PDF sanitization.
- Permission-safe PDF fallback in the browser and Edge Function entrypoints for production PDF/email/audit workflows.

## Verification

```powershell
npm test
npm run build
```
