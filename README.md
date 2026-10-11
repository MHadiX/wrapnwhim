# Wrap n Whip

One shared business workspace for three partners, hosted on Vercel with encrypted GitHub storage. No Supabase account is used.

## How it works

All three partners open the same Vercel URL and use the same workspace password. They see the same orders, inventory, customers, purchases and financial records. Changes refresh on other devices within about ten seconds when no form is open. A form keeps its entered values while editing. If another partner saves first, a stale save is rejected: cancel the form, wait for the shared records to refresh, review them and enter the change again.

Business records are encrypted with AES-GCM and PBKDF2-SHA256 (250,000 iterations). The Vercel server authenticates the shared password over HTTPS using a signed, HttpOnly, SameSite cookie. The GitHub token stays on the server. The encrypted file is stored at `.wrapnwhip/workspace.json` on the separate `workspace-data` branch. Data saves do not change the website branch; the Vercel ignore command skips deployment of the data branch.

There is one common login and equal access for everyone, rather than three separately authenticated accounts. The workspace locks locally after five minutes without activity; locking also clears that browser's server session. GitHub SHA checks and workspace revisions prevent concurrent overwrites. GitHub is suitable for a small, low-volume team; it is not a high-throughput database. A public repository exposes encrypted file history to offline password guessing, so use a long, unique password; a dedicated private repository can be selected with `GITHUB_STORAGE_REPOSITORY`.

## Connect shared storage

This version requires **two server-only Vercel environment settings**:

| Name                   | Value                                                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| `GITHUB_STORAGE_TOKEN` | A fine-grained GitHub token with access only to the storage repository and **Contents: Read and write**. |
| `WORKSPACE_PASSWORD`   | Your shared password, at least 12 characters. All three partners use it.                                 |

Create a token in [GitHub token settings](https://github.com/settings/personal-access-tokens/new), restrict it to `MHadiX/wrapnwhim`, and grant Contents read/write. Add it and the password in your Vercel project's Settings → Environment Variables for Production. Add them to Preview only if you want previews to access the same live data. Never paste secrets in chat or commit them. Redeploy after changing settings. The default repository is `MHadiX/wrapnwhim`; optionally set `GITHUB_STORAGE_REPOSITORY` to a separate private repository containing at least one commit.

The server creates the data branch and initial empty workspace on the first successful login. There is no public sign-up or first-visitor password claim. Missing configuration blocks access and saving; the site never silently falls back to a separate browser workspace. GitHub token expiry/revocation or repository policies can block access. Server errors preserve the stored records. Authentication includes an instance-local failed-login throttle, not a distributed rate limiter or MFA.

`vercel.json` now uses the Next.js adapter and default `.next` build output because shared storage requires server API routes. Do not override Output Directory to `out` in the Vercel dashboard. GitHub Pages cannot host this server-backed version; its old publishing workflow has been removed.

## Existing records and backups

Old browser records are not automatically uploaded, deleted or merged. On the same device and website URL as the old version, use **Download old browser backup** on the login page. Log into the shared workspace, open Settings & backups, choose Restore backup, and enter the old backup password. Confirming restores that backup for everyone, encrypted with the current shared password. Download the current shared backup first. Choose the correct initial backup; separate old workspaces are not automatically merged.

Encrypted backups remain downloadable. Keep them and the password safe. Changing `WORKSPACE_PASSWORD` alone does not re-encrypt old records: it invalidates access until records are migrated with a verified backup. There is no automatic password recovery or scheduled offsite backup.

## Included

- Products, stock reservations, weighted-average costing, opening inventory, stock losses and product editing.
- Customers and suppliers with contact details and editing.
- Multi-item sales orders, discount allocation, fulfillment stages, deposits, customer payments, COD settlements and actual fees.
- Partial returns and refunds, with historical stock costs and exact discount pennies.
- Purchase receipt, supplier bills and partial payments; supplier returns/refund receivables; partner-paid supplier bills.
- Cash, bank and wallet accounts; investments, operating expenses, other income, loans/repayments, transfers and fees.
- Three partner capital/payable balances; reimbursements; withdrawal and profit-distribution decision records.
- Double-entry journals, closed periods, monthly budgets, seven reports, dashboard charts, activity history and low-stock indicators.
- CSV exports, printable invoices/reports, encrypted backups/restoration, search, pagination, mobile navigation and dark mode.

Partner approvals record actual decisions for bookkeeping. One shared password does not independently authenticate three different partners. This simplified version does not implement multi-user roles, cloud synchronization, live bank/courier integrations, automatic tax calculation, document attachments or scheduled offsite backups.

Inventory uses whole units and chronological stock events. Bundle components are separate order line items. Recognize revenue and cost on delivery; deposits and COD receivables are not available cash. Inventory receipts are assets, not operating expenses. Returns precede refunds; shipping charges are not automatically refunded. Financial postings are preserved, rather than edited or deleted. Opening balances represent opening equity. Profit distributions are limited by profit and cash after liabilities.

## Development and verification

Node.js 22/24 is required. No Docker or Supabase services are needed.

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

For development, securely provide the server settings through an ignored `.env.local` and run `npm run dev`. Production startup is `npm run start`, using the Next.js server on port 3000.

Browser verification uses the actual production Next.js server and a disposable, local GitHub API fixture with dummy credentials. It does not use or modify real GitHub business records:

```sh
PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
```

The fixture uses ports 3000/3001 and resets data between serial tests. CI installs official Playwright Chromium. See [verification status](docs/TESTING.md). Tests include purchases, orders, accounting, password rejection, encrypted backups, three isolated browser sessions, synchronization and concurrent-save rejection. Live GitHub storage/Vercel deployment requires the server settings and remains separate from fixture verification.

The earlier Supabase implementation is preserved outside the checkout at `/workspace/wrapnwhim-server-archive.tar.gz`. No passwords, tokens or financial records belong in website commits.
