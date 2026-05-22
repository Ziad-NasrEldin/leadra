# Validation Results

| Command/Test | Result | Notes |
|---|---|---|
| `npm run lint` | Pass | Baseline before implementation. |
| `npm run typecheck` | Pass | Baseline before implementation. |
| `npm test` | Fail | Baseline failure: 2 assertions in `src/lib/pdf.test.ts`. |
| `npm run lint` | Pass | Final after audit artifacts and dead asset deletion. |
| `npm run typecheck` | Pass | Final after audit artifacts and dead asset deletion. |
| `npm run build` | Pass | Final production build succeeded. |
| `npm test` | Fail | Final failure matches baseline: same 2 assertions in `src/lib/pdf.test.ts`. |
| `npm test -- src/lib/pdf.test.ts --run` | Pass | PDF-focused validation after export contract fix; 13 tests passed. |
| `npm run lint` | Pass | After PDF export contract fix. |
| `npm run typecheck` | Pass | After PDF export contract fix. |
| `npm test` | Pass | Full suite after PDF export contract fix; 11 files and 150 tests passed. |
| `npm run build` | Pass | Production build after PDF export contract fix. |
| `npm test -- src/lib/domain.test.ts --run` | Pass | Form helper refactor targeted validation; 23 tests passed. |
| `npm run lint` | Pass | After form helper refactor. |
| `npm run typecheck` | Pass | After form helper refactor. |
| `npm test` | Pass | Full suite after form helper refactor; 11 files and 150 tests passed. |
| `npm run build` | Pass | Production build after form helper refactor. |
| `npm test -- src/App.test.tsx --run` | Pass | App PDF workflow extraction validation; 49 tests passed. |
| `npm run lint` | Pass | After App PDF workflow extraction. |
| `npm run typecheck` | Pass | After App PDF workflow extraction. |
| `npm test` | Pass | Full suite after App PDF workflow extraction; 11 files and 150 tests passed. |
| `npm run build` | Pass | Production build after App PDF workflow extraction. |
| `npm test -- src/App.test.tsx --run` | Pass | App PDF action record extraction validation; 49 tests passed. |
| `npm run lint` | Pass | After PDF action record extraction. |
| `npm run typecheck` | Pass | After PDF action record extraction. |
| `npm test` | Pass | Full suite after PDF action record extraction; 11 files and 150 tests passed. |
| `npm run build` | Pass | Production build after PDF action record extraction. |
| `npm run lint` | Pass | Baseline re-check before second modernization pass. |
| `npm run typecheck` | Pass | Baseline re-check before second modernization pass. |
| `npm run typecheck` | Pass | After i18n catalog, legacy route/auth, form reader, dashboard, repository, workflow, and domain unit-type extractions. |
| `npm test -- src/lib/routes.test.ts src/lib/domain.test.ts src/lib/workflows.test.ts src/lib/repository.test.ts src/lib/functionErrors.test.ts --run` | Pass | 5 focused lib suites passed; 75 tests. |
| `npm run lint` | Pass | After helper extractions and form reader migrations. |
| `npm test -- src/App.test.tsx --run` | Pass | App/admin/create/edit/dashboard parity after App/form extraction; 49 tests. |
| `npx tsc --noEmit --noUnusedLocals --noUnusedParameters --pretty false` | Pass | Dead-code/unused-symbol check after final pass. |
| `npm test` | Pass | Full suite after final pass; 12 files and 153 tests passed. |
| `npm run build` | Pass | Production build after final pass. |

## Baseline Unit Test Failure Summary

- `src/lib/pdf.test.ts > exports the PRD unit facts and omits payment-method wording`: expected paid amount and remaining value text not present in current PDF text.
- `src/lib/pdf.test.ts > names generated pdf files with the unit code and export month day`: expected `NC3BR-May15.pdf`, received timestamped `leadra-NC3BR-20260515-093001.pdf`.

## Final Status

The pre-existing PDF export contract mismatch is fixed. Current validation is green for lint, typecheck, strict unused-symbol check, full unit tests, and production build.
