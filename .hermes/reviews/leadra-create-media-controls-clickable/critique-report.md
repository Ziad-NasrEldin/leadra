# Critique Report: Leadra create-unit media controls clickable

Verdict: APPROVED

## Summary

The current source satisfies the requested fix. The upload preview placeholder/shimmer pseudo-element is now non-interactive, and non-image children in the upload preview card are raised above it so the PDF visibility control and Remove button are not blocked by the overlay. A focused regression test covers uploading an image, toggling PDF inclusion from Show in PDF to Hide from PDF, and removing the image.

## Evidence Reviewed

- `src/index.css`
  - `.upload-preview-card:has(img)::before` has `pointer-events: none` at line 8031, preventing the generated overlay layer from intercepting clicks.
  - `.upload-preview-card > :not(img)` has `position: relative; z-index: 2` at line 8034, keeping filename text, PDF toggle, and Remove control above the image/placeholder stack.
  - Existing image stacking remains explicit at line 8033 (`.upload-preview-card img { position: relative; z-index: 1; }`).
- `src/features/create/CreateUnitPage.tsx`
  - The create-unit Review preview renders the image, then the PDF visibility label/checkbox, then the Remove button inside `.upload-preview-card` (lines 403-447), so the CSS selector applies directly to the affected controls.
- `src/App.test.tsx`
  - The test `allows create-unit uploaded images to be hidden from PDF and removed` uploads a sanitized in-memory 1x1 PNG, verifies the uploaded file appears, toggles the PDF checkbox from checked to unchecked, verifies the accessible label changes to Hide from PDF, removes the image, and verifies the image-required message returns (lines 880-913).

## Verification Run

Command run:

`npm test -- src/App.test.tsx -t "allows create-unit uploaded images"`

Result:

- PASS: 1 focused test passed, 55 skipped, 1 test file passed.

## Sensitive Data Review

No sensitive screenshot data was used in the reviewed implementation or tests. I searched for the original temporary screenshot/path markers (`NSIRD`, `Screenshot 2026`, `screencaptureui`, `TemporaryItems`, `var/folders`) and found no matches. The regression test uses a tiny sanitized base64 PNG named `living-room.png`, not the user-provided screenshot.

## Findings

No blocking findings.

Non-blocking note: the Vitest/JSDOM regression test validates the controls' behavior but does not perform browser hit-testing against the CSS overlay. The CSS source itself directly addresses the pointer-event and stacking issue, so this is acceptable for this fix, but an end-to-end browser test would provide stronger future protection against layout-only regressions.
