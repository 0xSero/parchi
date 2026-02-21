import Cocoa
import WebKit

/// A floating companion panel that positions itself alongside Safari's frontmost window.
/// Uses NSPanel with .nonactivatingPanel so Safari retains focus while the sidebar is visible.
class SidebarWindowController: NSWindowController {
    static let defaultWidth: CGFloat = 400
    private var webView: WKWebView!
    private var safariObserver: Any?
    private var forwardToPanelObserver: Any?

    convenience init() {
        let panel = NSPanel(
            contentRect: .zero,
            styleMask: [.titled, .closable, .resizable, .nonactivatingPanel, .utilityWindow],
            backing: .buffered,
            defer: true
        )
        panel.isFloatingPanel = true
        panel.level = .floating
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        panel.titlebarAppearsTransparent = true
        panel.titleVisibility = .hidden
        panel.isMovableByWindowBackground = true
        panel.animationBehavior = .utilityWindow
        panel.minSize = NSSize(width: 320, height: 400)

        self.init(window: panel)
        setupWebView()
        startObservingForwardToPanel()
    }

    deinit {
        stopObservingSafariWindow()
        if let observer = forwardToPanelObserver {
            DistributedNotificationCenter.default().removeObserver(observer)
        }
    }

    private func setupWebView() {
        let config = WKWebViewConfiguration()
        let userContentController = WKUserContentController()
        userContentController.add(self, name: "parchiNative")
        config.userContentController = userContentController

        webView = WKWebView(frame: .zero, configuration: config)
        webView.autoresizingMask = [.width, .height]

        window?.contentView = webView
        loadPanel()
    }

    private func loadPanel() {
        // Load panel.html from the extension bundle's resources
        // The extension resources are copied into the app bundle by the build process
        guard let resourceURL = Bundle.main.url(
            forResource: "panel",
            withExtension: "html",
            subdirectory: "Resources/sidepanel"
        ) else {
            NSLog("[Parchi] Could not find panel.html in bundle")
            return
        }
        webView.loadFileURL(resourceURL, allowingReadAccessTo: resourceURL.deletingLastPathComponent().deletingLastPathComponent())
    }

    func showPanel() {
        positionAlongsideSafari()
        window?.orderFront(nil)
        startObservingSafariWindow()
    }

    func hidePanel() {
        window?.orderOut(nil)
        stopObservingSafariWindow()
    }

    /// Positions the panel to the right of Safari's frontmost window.
    private func positionAlongsideSafari() {
        guard let screen = NSScreen.main else { return }

        let safariFrame = safariWindowFrame() ?? screen.visibleFrame
        let panelWidth = Self.defaultWidth
        let panelHeight = safariFrame.height

        // Place the panel to the right of Safari's window
        var panelX = safariFrame.maxX
        // If it would go off-screen, place it to the left instead
        if panelX + panelWidth > screen.visibleFrame.maxX {
            panelX = safariFrame.minX - panelWidth
        }
        // If still off-screen, just snap to the right edge
        if panelX < screen.visibleFrame.minX {
            panelX = screen.visibleFrame.maxX - panelWidth
        }

        let frame = NSRect(
            x: panelX,
            y: safariFrame.minY,
            width: panelWidth,
            height: panelHeight
        )
        window?.setFrame(frame, display: true, animate: true)
    }

    private func safariWindowFrame() -> NSRect? {
        let safariApps = NSRunningApplication.runningApplications(withBundleIdentifier: "com.apple.Safari")
        guard let safari = safariApps.first else { return nil }

        // Use Accessibility API to get Safari's frontmost window frame
        let appRef = AXUIElementCreateApplication(safari.processIdentifier)
        var windowRef: AnyObject?
        guard AXUIElementCopyAttributeValue(appRef, kAXFocusedWindowAttribute as CFString, &windowRef) == .success else {
            return nil
        }

        var position: AnyObject?
        var size: AnyObject?
        guard AXUIElementCopyAttributeValue(windowRef as! AXUIElement, kAXPositionAttribute as CFString, &position) == .success,
              AXUIElementCopyAttributeValue(windowRef as! AXUIElement, kAXSizeAttribute as CFString, &size) == .success else {
            return nil
        }

        var point = CGPoint.zero
        var cgSize = CGSize.zero
        AXValueGetValue(position as! AXValue, .cgPoint, &point)
        AXValueGetValue(size as! AXValue, .cgSize, &cgSize)

        // Convert from top-left origin (Accessibility) to bottom-left origin (AppKit)
        guard let screenHeight = NSScreen.main?.frame.height else { return nil }
        let y = screenHeight - point.y - cgSize.height

        return NSRect(x: point.x, y: y, width: cgSize.width, height: cgSize.height)
    }

    // MARK: - Safari window tracking

    private func startObservingSafariWindow() {
        // Re-position when Safari's window moves or resizes
        safariObserver = NSWorkspace.shared.notificationCenter.addObserver(
            forName: NSWorkspace.didActivateApplicationNotification,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            guard let app = notification.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication,
                  app.bundleIdentifier == "com.apple.Safari" else { return }
            self?.positionAlongsideSafari()
        }
    }

    private func stopObservingSafariWindow() {
        if let observer = safariObserver {
            NSWorkspace.shared.notificationCenter.removeObserver(observer)
            safariObserver = nil
        }
    }

    // MARK: - Extension → Panel message bridge

    private func startObservingForwardToPanel() {
        forwardToPanelObserver = DistributedNotificationCenter.default().addObserver(
            forName: .init("com.parchi.safari.forwardToPanel"),
            object: nil,
            queue: .main
        ) { [weak self] notification in
            guard let jsonString = notification.userInfo?["json"] as? String,
                  let jsonData = jsonString.data(using: .utf8),
                  let message = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any] else { return }
            self?.sendToPanel(message)
        }
    }
}

// MARK: - WKScriptMessageHandler

extension SidebarWindowController: WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "parchiNative",
              let body = message.body as? [String: Any] else { return }

        // Forward messages from the panel JS to the extension's background script.
        // Note: The reverse channel (panel → extension background) cannot go through
        // SafariWebExtensionHandler since it is stateless and cannot observe notifications.
        // Instead, the panel JS should use chrome.runtime.sendMessage directly when loaded
        // inside the extension context, or this bridge for the WKWebView context.
        if let type = body["type"] as? String,
           let jsonData = try? JSONSerialization.data(withJSONObject: body),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            DistributedNotificationCenter.default().postNotificationName(
                .init("com.parchi.safari.panelMessage"),
                object: nil,
                userInfo: ["json": jsonString],
                deliverImmediately: true
            )
            NSLog("[Parchi] Panel message forwarded: \(type)")
        }
    }

    /// Send a message from native code into the panel's JavaScript context.
    func sendToPanel(_ message: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: message),
              let json = String(data: data, encoding: .utf8) else { return }
        let script = "window.postMessage(\(json), '*');"
        webView.evaluateJavaScript(script) { _, error in
            if let error = error {
                NSLog("[Parchi] sendToPanel error: \(error)")
            }
        }
    }
}
