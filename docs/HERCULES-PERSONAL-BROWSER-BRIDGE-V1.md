# Hercules Personal Browser Bridge v1

Date: 2026-09-27

## Purpose

Hercules Personal Browser Bridge is the first-party owner-session path for websites that require the owner's existing logged-in browser session. It complements the owned Hercules Browser; it does not replace it. In production, the bridge API is hosted inside the existing `hercules-integrations` Edge Function so it consumes no additional Supabase function slot.

## Security model

- The owner explicitly grants one HTTPS site at a time.
- Pairing tokens expire after 15 minutes.
- Connected browser sessions expire after 30 minutes.
- Pairing and session tokens are stored server-side only as SHA-256 hashes.
- Hercules never reads or exports browser cookies, password-manager contents, passwords, OTP/MFA values, recovery codes, provider session tokens, API secrets, or private keys.
- Page observations omit form values and redact sensitive-content regions.
- CAPTCHA, Cloudflare, MFA, identity verification, and other human/security challenges stop automation.
- Commands are restricted to: observe, click, type, navigate, close.
- Navigation is restricted to the explicitly approved origin.
- Command submission is service-role only.

## Production endpoint

`https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-integrations`

GET renders the authenticated Hercules Integrations UI. POST/OPTIONS carry the bounded Personal Browser Bridge API.

## Pairing flow

1. Sign in to the authenticated Hercules Integrations page.
2. In **Personal Browser Bridge**, choose **Create pairing token**.
3. In the owner's browser, load the owner-code extension from `hercules-runtime/personal-browser-bridge`.
4. Open the target logged-in HTTPS site.
5. Open the extension, paste the one-time pairing token, and choose **Share current tab**.
6. The browser requests permission only for that site's origin.
7. After the owner accepts that browser permission, Hercules may operate that tab within the approved origin.
8. Disconnect closes the bridge session; expiry also ends it automatically.

## Extension installation boundary

Installing or enabling a browser extension is a browser/OS permission action and remains owner-controlled. Hercules does not bypass extension-install prompts or browser security settings.

For Chromium-compatible Opera:

1. Open the extensions manager.
2. Enable developer mode if required.
3. Load unpacked.
4. Select `hercules-runtime/personal-browser-bridge`.

No third-party extension package is required; the extension source in the canonical Hercules repository is owner code.

## Operator behavior

The owned Hercules Browser remains the default path. Use the Personal Browser Bridge only when the target requires the owner's existing authenticated session or a provider-controlled human-verification step.

When a human-verification boundary appears, the bridge returns `human_verification_required` and stops. Resume only after the owner completes the provider-approved step in the shared tab.
