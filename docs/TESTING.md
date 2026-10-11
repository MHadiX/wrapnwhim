# Finance tracker verification

This report concerns the simplified shared finance tracker, not the earlier business-management interface.

Verified here: clean dependency installation, type checking, lint, 24 unit tests, production build, 6 desktop/mobile browser tests and production dependency audit (zero vulnerabilities). Live shared storage remains pending the Vercel server settings.

Unit coverage includes exact money arithmetic; negative balances; invalid amounts/dates; date-range opening/closing balances; spending categories; corrections/deletion; backup validation; conversion of old cash movements; encryption; CSV formula escaping; server authentication; secure cookies; same-origin and reverse-proxy checks; missing-configuration denial; ciphertext-only storage; and GitHub SHA conflict rejection. Legacy engine tests remain for older backup compatibility.

Browser tests use the actual production Next.js server and a disposable local GitHub API fixture with dummy credentials. They exercise recording additions/spending, corrections/deletion, date reports, CSV downloads, print actions, mobile layout, three isolated browser sessions, shared updates, stale-save rejection, password denial, encrypted backup restore and persistence after reload. The fixture resets between serial tests and never uses real GitHub records.

Live Vercel settings, GitHub token permissions and repository policies remain unverified. Activation requires GITHUB_STORAGE_TOKEN and WORKSPACE_PASSWORD in Vercel. One shared login gives everyone the same access.
