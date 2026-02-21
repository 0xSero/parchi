import SafariServices
import os.log

private let appGroupID = "group.com.parchi.safari"
let logger = Logger(subsystem: "com.parchi.safari.extension", category: "handler")

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    func beginRequest(with context: NSExtensionContext) {
        let item = context.inputItems.first as? NSExtensionItem
        let message = item?.userInfo?[SFExtensionMessageKey] as? [String: Any] ?? [:]

        logger.info("Received native message: \(String(describing: message), privacy: .public)")

        guard let action = message["action"] as? String else {
            respond(with: ["error": "Missing action"], context: context)
            return
        }

        switch action {
        case "toggleSidebar":
            // Notify the containing app to toggle the sidebar panel
            DistributedNotificationCenter.default().postNotificationName(
                .init("com.parchi.safari.toggleSidebar"),
                object: nil,
                userInfo: nil,
                deliverImmediately: true
            )
            respond(with: ["success": true], context: context)

        case "getSidebarState":
            let defaults = UserDefaults(suiteName: appGroupID) ?? .standard
            let isVisible = defaults.bool(forKey: "sidebarVisible")
            respond(with: ["visible": isVisible], context: context)

        case "forwardToPanel":
            // Forward a message from the extension background to the panel via the containing app.
            // JSON-serialize the payload into a single string since DistributedNotificationCenter
            // requires property-list-compatible types in sandboxed apps.
            if let payload = message["payload"] as? [String: Any],
               let jsonData = try? JSONSerialization.data(withJSONObject: payload),
               let jsonString = String(data: jsonData, encoding: .utf8) {
                DistributedNotificationCenter.default().postNotificationName(
                    .init("com.parchi.safari.forwardToPanel"),
                    object: nil,
                    userInfo: ["json": jsonString],
                    deliverImmediately: true
                )
            }
            respond(with: ["success": true], context: context)

        default:
            respond(with: ["error": "Unknown action: \(action)"], context: context)
        }
    }

    private func respond(with message: [String: Any], context: NSExtensionContext) {
        let response = NSExtensionItem()
        response.userInfo = [SFExtensionMessageKey: message]
        context.completeRequest(returningItems: [response], completionHandler: nil)
    }
}
