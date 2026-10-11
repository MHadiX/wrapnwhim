# Wrap n Whip — Finance tracker

A simple finance tracker with **one shared login on all devices**.

- Record money added and money spent, with a date, description and optional category.
- See current balance, total added and total spent. A negative balance is allowed.
- Correct or delete an entry.
- Generate a report for a date range, including opening balance, additions, spending, closing balance and spending by category.
- Download the report as CSV or print/save it as PDF.

All devices use the same shared records. Changes refresh within about ten seconds when no form is open. Conflicting saves are rejected: cancel the form, wait for the latest entries, then try again. There are no inventory, orders, purchases or partner management screens.

## One-time hosting connection

Host on Vercel. The application uses server routes and the default `.next` output, configured in `vercel.json`. No Supabase is used.

Set these **server-only** environment variables in Vercel → Project Settings → Environment Variables → Production, then redeploy:

| Name                   | Value                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------- |
| `GITHUB_STORAGE_TOKEN` | A fine-grained GitHub token for `MHadiX/wrapnwhim`, with **Contents: Read and write**. |
| `WORKSPACE_PASSWORD`   | One shared password, at least 12 characters, used on every device.                     |

Create the token in [GitHub settings](https://github.com/settings/personal-access-tokens/new). Never paste secrets in chat or commit them. Optional `GITHUB_STORAGE_REPOSITORY` selects a separate private repository with at least one commit; the default is `MHadiX/wrapnwhim`. Production and Preview deployments use the same storage repository if given the same settings, so configure Preview only when intended.

The server creates a `workspace-data` branch on first login and saves only encrypted records there. The Vercel ignore command skips deploying that data branch. The token stays on the server. A long unique password matters because public repositories expose encrypted history to offline password guessing. Missing credentials block access rather than creating separate browser workspaces.

The shared version is prepared on `feature/shared-workspace`; activation on `main` is pending those Vercel settings. Live Vercel/GitHub storage has not been verified from this environment. GitHub Pages cannot host the server-backed version.

## Backups and earlier records

“Backup and restore” downloads an encrypted copy. Restoring a backup replaces shared entries for everyone after confirmation. On the same browser and URL as the earlier browser-only version, “Download old browser backup” exports the old encrypted records without deleting them. Sign in and restore that file using its old password. Earlier business records are converted into money-in/money-out entries from their cash movements; non-cash accounting entries are excluded. Separate old workspaces are not automatically merged.

There is one common login and equal access, no independently authenticated user identities. The password encrypts records with AES-GCM/PBKDF2; server sessions use signed HttpOnly cookies. The tracker signs out after five minutes without activity. There is no email password reset. Changing the server password alone does not re-encrypt saved data: keep verified backups and the original password. Login throttling is instance-local, rather than a distributed rate limiter.

## Development

Node.js 22/24. No Docker or Supabase services.

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

Provide server settings securely in ignored `.env.local` for real storage, then run `npm run dev` or `npm run start` after building. Existing checkouts are isolated; no Git worktree is needed.

Browser tests use the actual production Next.js server and a disposable GitHub API fixture with dummy credentials, on ports 3000/3001. They never modify real business records:

```sh
PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
```

CI installs official Playwright Chromium. See [verification status](docs/TESTING.md). The legacy business engine remains only for backup compatibility; it has no management screens in this app.
