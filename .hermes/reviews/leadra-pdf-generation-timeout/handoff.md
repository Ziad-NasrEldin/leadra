# Feature Handoff: Leadra production deploy + PDF/payment/theme verification

## Original request

User asked to go to the Leadra project, deploy changes to Vercel, and production-E2E test the core flows:

- Create team member
- Archive unit
- Edit unit
- Mark unit special
- Generate PDF
  - Share PDF
- Mark unit hold/sold
- Create unit
  - Upload image
- Previous tests on sales/sub-admin/manager accounts as well

User also reported:

- Editing unit installment type does not regenerate the installment amount
- Unit payment type cannot be changed from installments to cash
- Light/dark theme toggle needs performance and UI improvements
- Whole-screen flickering occurs when switching dark/light mode and also randomly across the app

## Implementation summary

- Deployed the existing PDF image pipeline fix: uploaded unit images are rasterized through browser canvas into JPEG before `pdf-lib` embedding, with bounded embed timeout/fallback so PDF generation cannot hang indefinitely on problematic uploaded PNG bytes.
- Deployed payment edit fixes from previous work: installment type recalculates displayed amount; installments-to-cash edit clears installment-only fields and persists `payment_method = cash` without trying to mutate `remaining_payment` directly.
- Deployed theme flicker fixes from previous work: normal theme toggles do not use native View Transitions and theme-transition state is cleaned up.
- Found a production-only persistence blocker after deployment: direct `units.update(...).select(...)` failed with `permission denied for table units` because the production DB intentionally grants `authenticated` UPDATE/INSERT but not SELECT on `public.units`; reads go through `list_units_safe` RPC.
- Fixed that root cause in `src/lib/repository.ts`: unit detail updates and archive actions no longer request a direct `select()` from `units`; update details reload through the safe listing RPC after the write, and archive performs a write-only update.
- Added/updated repository tests proving the update payload is write-only and reloads through `list_units_safe`.

## Changed files

- `src/lib/pdf.ts`: PDF media decode/rasterize/timeout behavior from previous fix.
- `src/lib/pdf.test.ts`: PDF timeout/rasterize regression coverage from previous fix.
- `src/lib/repository.ts`: remove direct `units.update(...).select(...)` from unit edit/archive paths; reload unit details via safe RPC after update.
- `src/lib/repository.test.ts`: update repository tests to assert write-only unit updates and safe-RPC reload.
- Prior payment/theme/Supabase migration files remain part of the deployed release history and were already critique-approved in `.hermes/reviews/leadra-payment-theme-fixes/critique-report.md`.

## How to test

Local:

- `npm run typecheck`
- `npm run test -- src/lib/supabaseMapper.test.ts src/lib/workflows.test.ts src/App.test.tsx src/lib/repository.test.ts`
- `npm run lint`
- `npm run build`

Production:

- Vercel canonical URL: `https://www.leadra.app`
- Login as admin test account.
- Run production role matrix through `node scripts/leadra-prod-e2e.mjs`.
- Run targeted PDF/payment/theme/archive script through `node scripts/tmp-targeted-prod-e2e2.mjs`.
- Verify DB persistence for the archive/payment edit using Supabase linked DB read.
- Run extra theme probe across `/dashboard`, `/units`, `/special`, and `/admin/users` to confirm no UA `-ua-view-transition-*` animations and no blank body after toggles.

## Tests run

Local verification after the final repository fix:

- `npm run typecheck`: PASS
- `npm run test -- src/lib/repository.test.ts`: PASS, 21 tests
- `npm run test -- src/lib/supabaseMapper.test.ts src/lib/workflows.test.ts src/App.test.tsx src/lib/repository.test.ts`: PASS, 4 files / 110 tests
- `npm run lint`: PASS
- `npm run build`: PASS

Production deployment verification:

- `vercel deploy --prod --yes`: PASS / READY
- `vercel inspect https://www.leadra.app`: READY
  - Deployment ID: `dpl_9cFknVgnu4CD1AHVDfqGPZWkHVV2`
  - Production URL: `https://leadra-m3v4ncsb8-ziadahmed252525-gmailcoms-projects.vercel.app`
  - Aliased canonical URL: `https://www.leadra.app`
- Canonical asset check: `https://www.leadra.app` served `assets/index-BWiCNFOf.js`

Production E2E evidence:

- `node scripts/leadra-prod-e2e.mjs`: PASS for role matrix and team/unit/status/special flows.
  - Report dir: `/Users/ziadnasreldin/Documents/GitHub/leadra/reports/prod-e2e-20260529144220`
  - Admin created sub-admin: `hermes-e2e-subadmin-20260529144220@leadra.test`
  - Admin created manager: `hermes-e2e-manager-20260529144220@leadra.test`
  - Admin edited manager password.
  - Sub-admin created sales user: `hermes-e2e-sales-20260529144220@leadra.test`
  - Admin created unit with image: `NC3BR-74`; marked special; marked hold; marked sold.
  - Sub-admin created unit with image: `NC3BR-75`; marked special; marked hold; marked sold.
  - Manager created unit with image: `NC3BR-76`; Mark Special unavailable as expected; marked hold; marked sold.
  - Sales created unit with image: `NC3BR-77`; Mark Special unavailable as expected; marked hold; marked sold.
  - Note: this matrix script intentionally skips PDF rows, so PDF/share were verified separately below.
- `node scripts/tmp-targeted-prod-e2e2.mjs`: PASS for PDF/download/share, edit payment fields, and theme probe; the original archive visible-label assertion was too strict because successful archive redirects back to `/units` instead of showing an `Archived` label on the details page.
  - Report dir: `/Users/ziadnasreldin/Documents/GitHub/leadra/reports/prod-e2e-targeted2-20260529144049`
  - Unit used: `NC3BR-58`
  - Generate PDF: PASS, downloaded `NC3BR-58-May29.pdf`
  - Share PDF: PASS via headless fallback download
  - Edit installment type regenerates amount: PASS
  - Payment type installments to cash: PASS
  - Theme toggle no UA flicker on details page: PASS; no `-ua-view-transition-*` animations
- Corrected production archive verification after critique R1:
  - One-off Playwright archive verification report dir: `/Users/ziadnasreldin/Documents/GitHub/leadra/reports/prod-archive-verify-20260529145035`
  - Unit used: `NC3BR-74`
  - User-visible result: PASS; after clicking Archive and confirming, production redirected to `https://www.leadra.app/units` and the details-page Archive button was no longer visible.
  - Screenshot/body artifact: `after-archive.png` and `after-archive-body.txt` in the report dir.
- Supabase linked DB verification after targeted archive/payment checks:
  - `NC3BR-58`: `archived = true`, `payment_method = cash`, `installment_type = NULL`, `installment_amount = NULL`
  - `NC3BR-74`: `archived = true`, `status = sold_by_others`
  - `NC3BR-73`: still unarchived reference unit, `payment_method = installment`, `installment_type = quarterly`, `installment_amount = 225000.00`
- Extra production theme probe across representative pages:
  - Routes: `/dashboard`, `/units`, `/special`, `/admin/users`
  - Result: PASS; each route had non-blank body text after toggle, `data-theme-transition = null`, and no UA `-ua-view-transition-*` animations.

## Git info

- Branch: `main`
- Final repo/review commit after critique R2: `c12fd1b test: clarify write-only archive persistence`
- Commit deployed for final repository permission fix: `1f2bab1 fix: reload units after permission-safe updates`
- Earlier deployed commits in this release included:
  - `545f735 fix: update unit payment edit recalculations`
  - `b8e4b24 fix: prevent pdf image embedding hangs`
  - `3eaf4bd fix: prevent pdf generation from hanging`
  - `bcd44dd fix: align unit uploader permissions`
  - `647fbf6 fix: stabilize unit payments and theme switching`

## Frontend/backend/database notes

- Frontend: `src/lib/pdf.ts`, `src/lib/repository.ts`, payment edit UI, theme toggle behavior.
- Backend/database: Supabase production migration list includes latest local/remote `20260529152000`.
- Remote DB grant evidence: `authenticated` has UPDATE/INSERT on `public.units` but intentionally no SELECT; direct reads are through safe RPCs. The final repository fix respects this by not using direct `update().select()` on `units`.
- No new Supabase migration was needed for the final repository fix.
- Known migration drift from prior handoff still exists for historical local-only/duplicate versions; the intended latest production migration is applied.

## Reviewer focus areas

- Confirm the final repository fix correctly avoids direct SELECT on `public.units` while preserving update/archive behavior.
- Confirm production E2E evidence satisfies the original checklist and does not count skipped PDF rows from the matrix script as PDF verification.
- Confirm corrected archive verification resolves critique R1: production redirects back to `/units`, removes the details Archive button from view, and DB readback shows `archived = true` for `NC3BR-74`.
- Confirm the archive unit test rename/mock simplification resolves critique R2 by accurately asserting write-only behavior under the safe units permission model.
- Confirm theme verification is adequate for no native view-transition full-screen flicker across representative app pages.

## Fix cycle notes

- Previous critique R1 requested deployed commit/status and production PDF Generate/Download/Share evidence. This handoff now includes deployed commit `1f2bab1`, READY Vercel deployment `dpl_9cFknVgnu4CD1AHVDfqGPZWkHVV2`, canonical URL evidence, and production PDF/download/share evidence.
- Additional production blocker found during final verification (`permission denied for table units`) was root-caused to direct `update().select()` against a table without SELECT grant, fixed, tested locally, committed, pushed, and deployed.
- Critique R1 from the production-verification re-review was addressed with a corrected production archive verification artifact: `/Users/ziadnasreldin/Documents/GitHub/leadra/reports/prod-archive-verify-20260529145035/report.json` plus DB readback for `NC3BR-74`.
- Critique R2 was addressed by renaming/simplifying the archive repository unit test so it accurately asserts write-only archive persistence rather than claiming direct row visibility verification.
