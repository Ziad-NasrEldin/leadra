# Feature Handoff: Leadra create-unit media controls clickable

## Original request

"/var/folders/b3/v4_9c_2n163g0q8bz_d235t80000gn/T/TemporaryItems/NSIRD_screencaptureui_MjBRRV/Screenshot\ 2026-05-29\ at\ 5.01.20 PM.png
in the leadra project i am unable to click on hide from pdf or remove image when i am creating a unit as you can see from the screenshot, please fix this issue, its proably a UI blocking bug"

User later approved using a sanitized test image instead of the sensitive screenshot.

## Implementation summary

- Fixed the create-unit upload preview card so the shimmer/image placeholder layer cannot intercept pointer events.
- Raised non-image preview-card children above the image placeholder layer so controls remain physically clickable.
- Added a regression test that uploads an image in the create-unit Review step, toggles Show/Hide from PDF, then removes the uploaded image.

## Changed files

- `src/index.css`: added `pointer-events: none` to the image placeholder pseudo-element and put upload-preview-card non-image children at `z-index: 2`.
- `src/App.test.tsx`: added create-unit uploaded media controls regression test.

## How to test

- Start local Leadra app and navigate to `/create/review`.
- Continue as Admin in demo mode if prompted.
- Upload any non-sensitive image.
- Expected: the PDF visibility checkbox/label is clickable and changes between Show in PDF / Hide from PDF; Remove deletes the image card and re-shows the image-required message.

## Tests run

- `npm test -- src/App.test.tsx -t "allows create-unit uploaded images"`: PASS, 1 focused test passed.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm test -- src/App.test.tsx`: PASS, 56 tests passed.
- `npm run build`: PASS, production build completed.

## Git info

- Branch: `main`
- Commit SHA: `c11d9d5f3fc6e6b123568185cd138add645d6f4f`
- Diff base: previous `main` commit before `c11d9d5`.

## Frontend/backend/database notes

- Frontend route/component: `CreateUnitPage` upload preview in Review step.
- Backend endpoints/services: not applicable.
- Database tables/migrations: not applicable.

## Reviewer focus areas

- Confirm the CSS fix targets the blocking overlay without weakening skeleton/loading visuals elsewhere.
- Confirm the regression test covers both affected controls: PDF visibility toggle and Remove.
- Confirm no sensitive screenshot data is used in tests or committed artifacts.

## Fix cycle notes

Initial review request.
