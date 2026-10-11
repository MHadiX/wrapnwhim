# Shared workspace verification

This report concerns the server-backed, encrypted GitHub storage version. Earlier static-site and Supabase results do not validate this architecture.

Passed in this environment: type checking, linting, 20 unit tests, production Next.js build, 8 desktop/mobile browser tests, and the production dependency audit (zero vulnerabilities). The build produces `.next/routes-manifest.json` and both dynamic server API routes.

The 20 unit tests cover the business ledger, inventory, orders, payments, returns, approvals and closed periods; encryption/tampering/CSV escaping; server authentication, secure session cookies, cross-origin rejection, reverse-proxy hosts, missing-configuration denial, ciphertext-only storage, save validation and GitHub SHA concurrency protection.

Browser checks use the actual production Next.js server and a disposable local GitHub API fixture with dummy credentials. They exercise purchasing/order fulfillment, reporting, server persistence, password rejection, encrypted backup restoration, CSV exports, mobile navigation/dark mode, three isolated browser sessions, synchronization and stale-save rejection. The fixture resets between serial tests and never accesses real GitHub records.

Live GitHub token permissions, repository policies, Vercel environment settings, live deployment and account access remain unverified. Shared storage requires GITHUB_STORAGE_TOKEN and WORKSPACE_PASSWORD in the Vercel server environment. There is one shared login with equal access, no separately verified partner identities, Supabase, SMTP, MFA or scheduled offsite backups.
