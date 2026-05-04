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

Development and tests can run in local demo mode. Production builds require `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; if either is missing, the app shows a configuration error instead of exposing demo access.

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

For production auth, create users from Supabase Auth or the Admin API and include profile metadata when possible:

```json
{
  "full_name": "Nour El Din",
  "role": "admin",
  "job_title": "Managing Admin",
  "phone_number": "+201001112223",
  "team_id": "22222222-2222-4222-8222-222222222222",
  "branch_id": "11111111-1111-4111-8111-111111111111"
}
```

The `handle_new_auth_user` trigger creates the matching `profiles` row and `notification_preferences` row. Keep public sign-up disabled in the Supabase dashboard for the PRD’s admin-created-account model; the app only exposes sign-in.

## Production Checklist

- Rotate any database password that was shared outside a secret manager.
- Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the hosting provider; do not commit `.env.local`.
- Disable public sign-up in Supabase Auth and create the first admin account manually from the dashboard or Admin API.
- Apply migrations with `supabase db push` and deploy Edge Functions before inviting users.
- Configure email provider secrets for `send-notification-email` before enabling email notifications.
- Serve `public/_headers` if your host supports it; it adds frame blocking, no-sniff, referrer, permissions, and CSP headers.
- Keep `public/robots.txt` in place unless this internal system intentionally becomes indexable.
- Run `npm test`, `npm run lint`, and `npm run build` before release.

## Implemented MVP Surface

- Demo role login for Admin, Sub Admin, Manager, and Sales Representative.
- Role-aware dashboards, project-first unit browsing, filters, create-unit form, details page, notifications, profile, and admin panels.
- Tested PRD business rules for phone normalization, duplicate blocking, team visibility, owner data permissions, media limits, payment math, commission math, unit code generation, archive permissions, and PDF sanitization.
- Permission-safe PDF fallback in the browser and Edge Function entrypoints for production PDF/email/audit workflows.

## Verification

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

## Final Production QA

Run the non-destructive production-preview sweep locally:

```powershell
npm run build
npm run qa:preview
```

Run the full final gate:

```powershell
npm run qa:final
```

Destructive backend QA is staging-only and refuses to run unless `LEADRA_QA_ALLOW_DESTRUCTIVE=true` and all `LEADRA_STAGING_*` plus `LEADRA_QA_*` credentials are configured. Use a separate Supabase staging project cloned from migrations. Do not point staging QA variables at production.

```powershell
$env:LEADRA_QA_ALLOW_DESTRUCTIVE="true"
$env:LEADRA_STAGING_SUPABASE_URL="https://your-staging-project.supabase.co"
$env:LEADRA_STAGING_SUPABASE_ANON_KEY="..."
$env:LEADRA_STAGING_SUPABASE_SERVICE_ROLE_KEY="..."
npm run qa:staging
```

The staging runner creates prefixed `QA_*` users/data, verifies Auth, RLS, owner-field privacy, analytics RPC access, storage privacy, duplicate phone constraints, and then cleans up QA records.
