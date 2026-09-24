# Privacy Policy — Parchi

**Last updated:** 2026-02-23

## Summary

Parchi is local-first, but some features use remote services for authentication and billing.

## Data Handling

- **No analytics or telemetry.** Parchi does not include any tracking, analytics, or telemetry code.
- **BYOK mode is direct.** In BYOK mode, your prompts go directly from your browser to your configured provider (OpenAI, Anthropic, OpenRouter, Requesty, and others).
- **Managed billing uses backend services.** Paid credit and key-provisioning flows use Parchi backend endpoints plus Stripe webhooks.
- **Limited billing data.** Parchi stores account email, subscription/credit state, and payment-linked identifiers needed for billing and entitlement checks.
- **OpenRouter provisioning metadata only.** For managed OpenRouter key provisioning, we store key hash + guardrail/model metadata (not the key secret) in billing records.
- **No prompt logging by default.** Parchi does not intentionally store prompt/response content for managed billing workflows.
- **Local settings and keys.** Your extension settings and BYOK provider keys are stored in `chrome.storage.local`.
- **Conversation retention depends on mode.** Local chat history lives in extension storage. Managed backend routing forwards request payloads to upstream providers and does not intentionally persist prompt content.
- **No cookies or fingerprinting.** Parchi does not set cookies, use tracking pixels, or fingerprint your browser.

## Permissions

Parchi requests browser permissions (active tab, scripting, tabs, storage) solely to provide its browser automation features. These permissions are never used to collect or exfiltrate data.

## Third-Party Services

- **Stripe** handles payment processing and billing events.
- **Convex** powers authentication and billing/account APIs.
- **AI providers** receive prompts/content when you send requests.

Please review each provider's privacy policy for their data practices.

## Contact

If you have questions about this policy, open an issue at: https://github.com/AshwinSundar/browser-ai/issues
