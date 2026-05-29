# Critique Report: Leadra PDF generation timeout / production verification

## Verdict

REQUEST_CHANGES

## Summary

The PDF timeout/rasterization changes, repository permission-safe update reload, and payment/theme fixes are generally well targeted. Local typecheck, focused tests, lint, and production build all pass in this review. The production evidence also confirms PDF download/share artifacts exist and are valid PDFs.

However, the original checklist included archiving a unit, and the submitted targeted production E2E report records the archive UI check as failed. The handoff says database readback confirmed persistence, but the report artifact still contains a failing relevant production test and no passing replacement UI evidence. Under the review gate, this cannot be approved until archive behavior is re-verified end-to-end or the failure is fixed and re-run.

## What was changed

- `src/lib/pdf.ts`: Added bounded remote image fetch, browser rasterization to JPEG before pdf-lib embedding for most unit images, and timeout/fallback behavior around image embedding.
- `src/lib/pdf.test.ts`: Added/updated regression coverage for hanging remote logo fetch and browser-decoded fallback image embedding.
- `src/lib/repository.ts`: Removed direct `units.update(...).select(...)` from unit detail updates and archive actions; update details now reload through `list_units_safe`.
- `src/lib/repository.test.ts`: Updated unit update tests to expect write-only update payloads plus safe-RPC reloads.
- Prior release commits also touched payment recalculation, payment method edits, theme transition behavior, permissions, and Supabase migration grants per handoff.

## Required fixes

| ID | Severity | Area | Issue | Evidence | Required fix |
|----|----------|------|-------|----------|--------------|
| R1 | High | UX/Test/Deployment | Archive unit production verification is still failing in the submitted evidence, even though archive was part of the original production E2E checklist. DB persistence readback is useful, but it does not prove the user-facing archive flow completed correctly after the click. | `reports/prod-e2e-targeted2-20260529144049/report.json` lines 47-51: `ok: false`, `name: "archive unit"`, `Error: archived label not found`. Handoff lines 92-100 acknowledge the targeted script failed the archive UI assertion. | Fix the archive UI flow if it is actually wrong, or fix the E2E assertion if it is too strict, then rerun production archive verification and update the handoff with a passing artifact. The evidence should prove the archive action is visible to the user as expected and persisted in DB. |
| R2 | Medium | Test | The updated `archiveUnit` unit test no longer verifies what its name claims. The mock still exposes `.select().single()`, but `archiveUnit` no longer calls it; the test passes even if no row visibility/affected-row verification occurs. This weakens coverage around the exact production permission fix. | `src/lib/repository.test.ts:774-807` test name says `persists unit archive and verifies the updated row is visible`; current `src/lib/repository.ts:166-169` performs only write-only `.update({ archived: true }).eq('id', unitId)`. | Rename/adjust the test to assert the intended write-only archive behavior, and add separate production/E2E coverage for visible archive result instead of implying repository-level row visibility is verified. |

## Improvements

| ID | Priority | Area | Suggestion | Why it matters |
|----|----------|------|------------|----------------|
| I1 | Medium | Backend/DB | Audit remaining direct `from('units').select(...)` paths under the production no-SELECT grant model, especially `updatePaymentSchedule()` and the non-RPC create fallback. | The final fix correctly avoids direct SELECT for unit edits/archive, but the same production permission model can still break other write-then-reload flows if users exercise them. |
| I2 | Low | Test | Strengthen PDF image tests to assert that an included valid PNG actually renders as an embedded image, not just that a PDF with an image page is generated. | The current regression tests mostly prove no hang and valid PDF output; they could miss image-drop regressions where the PDF falls back to “Image unavailable.” |
| I3 | Low | Deployment | Ensure critique reviewers can verify Vercel status without depending on local developer auth, or include a saved deployment inspect artifact in the handoff. | My `vercel inspect https://www.leadra.app` attempt was blocked by missing Vercel credentials, so I could only verify the canonical site served HTTP 200 and the expected asset via curl. |

## Tests performed

- Read handoff: `/Users/ziadnasreldin/Documents/GitHub/leadra/.hermes/reviews/leadra-pdf-generation-timeout/handoff.md`.
- Inspected git state and recent commits:
  - `git status --short --branch`
  - `git log --oneline -8`
  - `git show 1f2bab1 -- src/lib/repository.ts src/lib/repository.test.ts`
  - `git diff 3eaf4bd^..b8e4b24 -- src/lib/pdf.ts src/lib/pdf.test.ts`
- Static diff secret/danger scan over recent non-`.hermes` changes: no matches.
- Local verification command:
  - `npm run typecheck && npm run test -- src/lib/pdf.test.ts src/lib/repository.test.ts && npm run lint && npm run build`
  - Result: PASS. Focused Vitest files passed: 2 files / 36 tests. Lint passed. Build passed and produced `dist/` assets.
- Production evidence inspected:
  - `reports/prod-e2e-targeted2-20260529144049/report.json`: PDF generate/share/payment/theme passed, archive failed.
  - `reports/prod-e2e-20260529144220/report.json`: role matrix/team/unit/status/special flows passed; PDF rows are explicitly skipped.
  - `reports/prod-e2e-targeted2-20260529144049/NC3BR-58-May29.pdf` and `share-NC3BR-58-May29.pdf`: both are 91,393 bytes, start with `%PDF-`, and end with `%%EOF`.
- Deployment checks attempted:
  - `vercel inspect https://www.leadra.app`: BLOCKED by missing Vercel credentials in this critique environment.
  - HTTP check of `https://www.leadra.app`: PASS, status 200, served `assets/index-BWiCNFOf.js`.

## Tests still needed

- Passing production E2E for archive unit UX after the repository permission fix.
- If the archive script was too strict, a corrected script run with report artifact showing both user-visible archive outcome and DB persistence.
- Optional but recommended: targeted production check for remaining unit write/reload paths that may still rely on direct `units` SELECT, especially payment schedule updates.

## Dev-agent instructions

1. Address R1: fix the archive UI behavior or the archive E2E assertion, then rerun targeted production archive verification.
2. Address R2: update the misleading `archiveUnit` unit test so it asserts write-only behavior accurately, and keep UI/archive visibility verification in E2E coverage.
3. Re-run at minimum: `npm run typecheck`, focused repository tests, `npm run lint`, `npm run build`, and the targeted production archive E2E.
4. Update `handoff.md` with the new passing archive evidence, including report path and DB persistence evidence.
5. Request re-review after the handoff is updated.
