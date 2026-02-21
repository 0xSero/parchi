# Parchi Safari Extension — Xcode Project

## Setup

### 1. Generate the Xcode project from the web extension build

```bash
npm run build:safari
xcrun safari-web-extension-converter dist-safari/ \
  --project-location safari-xcode/ \
  --app-name "Parchi" \
  --bundle-identifier com.parchi.safari \
  --swift \
  --macos-only \
  --no-open
```

### 2. Replace generated Swift files

The converter generates boilerplate Swift files. Replace them with the custom implementations in this directory:

- `Parchi/AppDelegate.swift` — Containing app with floating sidebar panel management
- `Parchi/SidebarWindowController.swift` — NSPanel + WKWebView companion window
- `Parchi/Parchi.entitlements` — Sandbox + Safari Apple Events entitlement
- `Parchi Extension/SafariWebExtensionHandler.swift` — Native messaging bridge

### 3. Configure Xcode project

- Set deployment target to macOS 13.0+
- Configure code signing with your development team
- Add Accessibility usage description (for reading Safari's window position):
  In the app's Info.plist, add `NSAccessibilityUsageDescription`
- Set `LSUIElement` to `YES` in the containing app's Info.plist (agent app, no dock icon)

### 4. Add `nativeMessaging` permission

Ensure `manifest.safari.json` includes `"nativeMessaging"` in the permissions array.

### 5. Build and run

- Open the Xcode project
- Select the "Parchi" scheme
- Build (Cmd+B)
- Run (Cmd+R) — this installs the extension
- Enable in Safari > Settings > Extensions > Parchi

## Architecture

```
Safari                          macOS
┌─────────────────┐            ┌──────────────────────┐
│ Web Extension    │            │ Containing App       │
│                  │            │                      │
│ background.js    │──native──▶│ SafariWebExtension   │
│                  │  message   │ Handler              │
│                  │            │   │                  │
│                  │            │   │ DistributedNotif │
│                  │            │   ▼                  │
│                  │            │ AppDelegate          │
│                  │            │   │                  │
│                  │            │   ▼                  │
│                  │            │ SidebarWindow        │
│                  │            │ Controller           │
│                  │            │   │                  │
│                  │            │   ▼                  │
│                  │            │ NSPanel + WKWebView  │
│                  │            │ (loads panel.html)   │
└─────────────────┘            └──────────────────────┘
```

The panel is a floating NSPanel (`.nonactivatingPanel`) that positions itself alongside Safari's window using the Accessibility API to read Safari's window frame.

## Limitations

- The sidebar is a companion window, not docked inside Safari (Safari doesn't expose its window hierarchy to extensions)
- Accessibility permission must be granted in System Settings > Privacy & Security > Accessibility
- The panel repositioning tracks Safari's active window, but doesn't follow window moves in real-time (repositions on app activation)
