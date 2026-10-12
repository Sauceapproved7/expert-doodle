# Smallz existing-account password access

Smallz /app supports signing in with an existing Hercules email/password directly through the existing Supabase Auth client. Password-enabled accounts do not depend on email-link redirects. The email-link option remains available and sets shouldCreateUser=false.

The password field clears after success, provider rejection, or a network failure. Raw provider errors are not rendered. Duplicate password submissions are disabled while a request is pending. No password is sent to Smallz operator APIs, logged, or saved by this change. Existing session handling is retained.

Authentication does not grant owner authority. Operator actions still require server-side owner and external-stop checks. No DNS credential, registrar permission, payment approval, policy acceptance, or release authorization is created.

Differentiators: access through existing credentials without redirect dependence, and credential cleanup with independent server owner verification. No competitor-exclusivity claim is made.

Validation executes the actual inline console script with a mocked client: password success, non-owner rejection, provider exception, password clearing, and missing input. Server tests verify public configuration contains only publishable settings and anonymous requests cannot invoke protected routes. A real owner login remains unverified.

October 12 readback: registrar authorized=false, OAuth pending_authorization, legacy API disabled, domain autopilot waiting_authorization. The live Domain Guard returned a resolver error for sauceapproved.com. Render reports its separate deployment live at c70f393d26ca555dd899427f45f5e596e01eee28. These observations do not establish completed cutover.

Origin: original project code created with AI assistance. Existing Supabase Auth SDK and hosting remain external services; no new runtime dependency is packaged.
