import Cocoa
import SafariServices

private let appGroupID = "group.com.parchi.safari"

@main
class AppDelegate: NSObject, NSApplicationDelegate {
    private var sidebarController: SidebarWindowController?
    private let sharedDefaults = UserDefaults(suiteName: appGroupID) ?? .standard

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Listen for toggle requests from the extension via DistributedNotificationCenter
        DistributedNotificationCenter.default().addObserver(
            self,
            selector: #selector(handleToggleSidebar),
            name: .init("com.parchi.safari.toggleSidebar"),
            object: nil
        )

        // Restore sidebar state if it was open in the previous session
        if sharedDefaults.bool(forKey: "sidebarVisible") {
            showSidebar()
        }
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        toggleSidebar()
        return false
    }

    @objc private func handleToggleSidebar(_ notification: Notification) {
        DispatchQueue.main.async { [weak self] in
            self?.toggleSidebar()
        }
    }

    private func toggleSidebar() {
        if let controller = sidebarController, controller.window?.isVisible == true {
            hideSidebar()
        } else {
            showSidebar()
        }
    }

    private func showSidebar() {
        if sidebarController == nil {
            sidebarController = SidebarWindowController()
        }
        sidebarController?.showPanel()
        sharedDefaults.set(true, forKey: "sidebarVisible")
    }

    private func hideSidebar() {
        sidebarController?.hidePanel()
        sharedDefaults.set(false, forKey: "sidebarVisible")
    }
}
