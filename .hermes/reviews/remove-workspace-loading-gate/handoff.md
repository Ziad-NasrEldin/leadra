# Feature Handoff: Remove workspace loading gate

## Original request

User provided a screenshot of the `New resale` page blocked by a `Loading workspace` panel and asked: "remove this thing entirely, because it takes too much time to load".

## Implementation summary

- Removed the route-level `Loading workspace` / `Workspace could not load` panel entirely from `src/App.tsx`.
- Removed `shouldGateWorkspaceView` so protected app views render immediately while Supabase workspace hydration continues in the background.
- Removed the now-unused `workspaceLoadFailed` UI state and setter calls.
- Updated mobile hydration regression coverage so `/create` renders `New resale` immediately during unresolved workspace hydration, and the removed loading/error messages never appear.

## Changed files

- `src/App.tsx`: deletes the workspace loading/error route gate and renders dashboard, create, units, special, details, notifications, profile, analytics, and admin routes without that gate.
- `src/App.mobileHydration.test.tsx`: changes the old gating assertion into a no-loading-screen regression for `/create`.

## How to test

- Sign in and open `/create` / New resale while account workspace hydration is slow.
- Expected: the form appears immediately; no `Loading workspace`, `Workspace could not load`, or `workspace-loading-state` panel is shown.

## Tests run

- `npm run typecheck`: PASS
- `npx vitest run src/App.mobileHydration.test.tsx`: PASS, 3 tests
- `npm run lint`: PASS
- `npm run build`: PASS
- `npm test -- --run`: PASS, 17 files / 188 tests

## Git info

- Branch: main
- Commit SHA: not committed yet at handoff time
- Diff base: `d4a08f4` current `origin/main` before this fix

## Frontend/backend/database notes

- Frontend: route rendering in `src/App.tsx`; regression in `src/App.mobileHydration.test.tsx`.
- Backend: no backend changes.
- Database: no database changes.

## Reviewer focus areas

- Confirm the exact screenshot panel text has no source matches and cannot render.
- Confirm `/create` is no longer blocked by workspace hydration.
- Confirm removing the UI gate does not reintroduce TypeScript/lint errors.
