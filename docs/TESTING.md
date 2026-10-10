# Simplified website verification

This report concerns the new static, encrypted, single-device website. The earlier Supabase test results do not apply to this architecture.

Validation passed: 14 unit tests and 8 browser tests across desktop and mobile. Type checking, linting and the production static build passed.

Automated coverage includes double-entry accounting; capital versus income; supplier liabilities; inventory costing/reservations; oversell rollback; deposits/delivery recognition; partial discounted returns/refunds; COD settlement fees; transfers; partner payout decisions; closed periods; paid supplier returns; partner-funded purchases; backup journal validation; encryption; wrong-password denial; ciphertext tampering; and spreadsheet formula escaping.

Browser tests use the actual exported site and real encrypted IndexedDB. They exercise purchases, supplier payment, investment, order fulfillment, customer payment, reporting, encrypted persistence, locking, incorrect passwords, backup verification/restoration on a fresh browser, CSV export, mobile navigation and dark mode.

Live Vercel deployment is not verified until its integration builds and a functional request succeeds. GitHub Pages likewise depends on repository publishing permissions. No remote database, shared editing, multi-user authentication, SMTP, Supabase or scheduled cloud backup is configured. Each browser/device has separate encrypted records.
