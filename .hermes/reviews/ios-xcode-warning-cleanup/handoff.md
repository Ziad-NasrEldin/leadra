# Feature Handoff: iOS Xcode warning cleanup

## Original request

User reported Xcode Cloud showing 33 warnings and asked: "please fix all warnings, because right now apple xcode cloud shows me 33 warning exist". User then pasted the warning list covering GoNativeCore quoted framework includes, deprecated WKProcessPool/processPool, deprecated UIApplication.windows, deprecated CoreLocation authorization APIs, deprecated MobileCoreServices UTType APIs, and an uninitialized `isLogout` variable.

## Implementation summary

- Removed app-owned deprecated `WKProcessPool` usage. The app deployment target is iOS 15.5 and Xcode warns that custom process pools no longer have effect from iOS 15.0.
- Replaced deprecated `UIApplication.shared.windows` access with scene-based key-window lookup.
- Replaced deprecated CoreLocation class authorization/status delegate API with instance authorization status and `locationManagerDidChangeAuthorization:`.
- Replaced MobileCoreServices MIME-to-UTI lookup with UniformTypeIdentifiers `UTType` API.
- Initialized `isLogout` to avoid conditional-uninitialized warning.
- Suppressed third-party GoNativeCore framework-header quote-include warnings at the Xcode build setting level because those warnings come from packaged dependency headers under DerivedData, not editable app source.
- Weak-linked AppIntents to prevent Xcode's AppIntents metadata processor from emitting the no-framework-dependency warning while preserving iOS 15.5 compatibility.

## Changed files

- `ios/LeanIOS/UIApplication+Extensions.swift`: scene-based key window lookup.
- `ios/LeanIOS/WindowsController.swift`: use `UIApplication.shared.currentKeyWindow`.
- `ios/LeanIOS/LEANUtilities.h`: remove deprecated `wkProcessPool` declaration.
- `ios/LeanIOS/LEANUtilities.m`: replace MobileCoreServices with UniformTypeIdentifiers and remove deprecated `wkProcessPool` implementation.
- `ios/LeanIOS/LEANWebViewController.m`: remove `processPool`, update CoreLocation authorization methods.
- `ios/LeanIOS/LEANLoginManager.m`: remove `processPool` assignment.
- `ios/LeanIOS/GNRegistrationManager.m`: remove `processPool` assignment.
- `ios/LeanIOS/LEANWebViewPool.m`: remove `processPool` assignment.
- `ios/LeanIOS/LEANMenuViewController.m`: initialize `isLogout` to `NO`.
- `ios/Project.swift`: preserve warning/linker settings for future Tuist regeneration.
- `ios/Leadra.xcodeproj/project.pbxproj`: apply warning/linker settings to checked-in project used by Xcode Cloud.

## How to test

Run from repo root:

```sh
xcodebuild -workspace ios/Leadra.xcworkspace -scheme Leadra -configuration Release -destination 'generic/platform=iOS' clean build CODE_SIGNING_ALLOWED=NO
```

Expected: build succeeds and warning count is zero.

## Tests run

- `xcodebuild -workspace ios/Leadra.xcworkspace -scheme Leadra -configuration Release -destination 'generic/platform=iOS' clean build CODE_SIGNING_ALLOWED=NO`: PASS, `warnings=0`, `errors=0`, `build_succeeded=True`.

## Git info

- Branch: main
- Commit SHA, if committed: not committed yet
- Diff base: current `main` HEAD `25e440c`

## Frontend/backend/database notes

- Frontend routes/components: not applicable.
- Backend endpoints/services: not applicable.
- Database tables/migrations: not applicable.
- iOS build target: Leadra scheme in `ios/Leadra.xcworkspace`.

## Reviewer focus areas

- Confirm removing custom `WKProcessPool` is safe given iOS deployment target 15.5.
- Confirm weak-linking AppIntents is safer than strongly linking and does not require runtime code changes.
- Confirm third-party quoted include warnings are handled by build setting, not by editing dependency artifacts.
- Confirm checked-in `Project.swift` and `Leadra.xcodeproj` remain consistent enough for Xcode Cloud and future Tuist regeneration.

## Fix cycle notes

Initial handoff.
