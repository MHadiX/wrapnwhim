# Wrap n Whip

A simple, password-protected business website for a giftware business. No Supabase, external account or environment variables are required. It runs as a static Next.js site on Vercel or GitHub Pages.

## How it works

Open the website and choose your workspace password on the first visit. Add your real partners, accounts, products, customers and suppliers. Everything starts at zero.

**Records are encrypted in this browser, not saved to GitHub.** GitHub stores website code; the host serves the site. A different device has a separate workspace. Use encrypted backup/restore to transfer your records. Shared editing needs a server with authorized access to private storage; a public website cannot securely write private GitHub records without that authorization.

The password protects the records with AES-GCM, a fresh random IV per save, and PBKDF2-SHA256 with 250,000 iterations. It is never stored or sent to a server. The workspace locks after five minutes of inactivity and after another tab changes the saved version. Save an encrypted backup regularly. Losing the password or clearing browser storage without a backup loses access to records. There is no email password reset.

A private-looking website link is not a security boundary. Anyone can open the public site and create their own empty browser workspace; they cannot see another device’s encrypted records just by opening its URL.

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

Partner approvals record actual decisions for bookkeeping. A single browser password does not independently authenticate three different partners. This simplified version does not implement multi-user roles, cloud synchronization, live bank/courier integrations, automatic tax calculation, document attachments or scheduled offsite backups.

Inventory uses whole units and chronological stock events. Bundle components are separate order line items. Recognize revenue and cost on delivery; deposits and COD receivables are not available cash. Inventory receipts are assets, not operating expenses. Returns precede refunds; shipping charges are not automatically refunded. Financial postings are preserved, rather than edited or deleted. Opening balances represent opening equity. Profit distributions are limited by profit and cash after liabilities.

## Run locally

Node.js 22/24 and Python 3 are available in the cloud environment.

```sh
npm ci
npm run dev
```

Production static build:

```sh
npm run build
npm run start
```

`out/` is the deployable website. `npm run start` uses a local Python static server for validation, not a production dependency. Hosting only needs the generated files. Existing checkouts are isolated; no Git worktree is needed.

## Hosting

`vercel.json` configures the static output and security headers. Its `framework: null` disables Vercel's Next.js server adapter: `npm run build` exports the site and Vercel serves `out/` as static files. The Next.js adapter would incorrectly look for `out/routes-manifest.json`. If Vercel is already connected to this GitHub repository, a push to `main` triggers its normal automatic deployment. No Supabase variables are used. Old Supabase variables may be removed from a previously configured deployment.

A GitHub Pages workflow is also supplied. It builds with `/wrapnwhim` as the project base path and attempts to enable/deploy Pages. Repository administrators or organization policies can restrict Pages enablement; workflow success must be checked before claiming a live site. GitHub access does not automatically provide permission to create or connect a Vercel account.

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

Cloud browser checks use `PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium`. CI installs official Playwright Chromium. See [verification status](docs/TESTING.md). Tests cover meaningful accounting, crypto integrity, purchasing/order fulfillment, encrypted browser persistence, CSV export, backup restoration, mobile layout and password denial.

The previous server-backed implementation is preserved outside the checkout in `/workspace/wrapnwhim-server-archive.tar.gz`. Its local test credentials are retained in a private directory outside this repository. No passwords or financial records belong in Git commits.
