"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  Gift,
  Lock,
  Plus,
  Printer,
  X,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  add,
  edit,
  remove,
  empty,
  money,
  report,
  today,
  type Workspace as Data,
  type Transaction,
} from "@/lib/finance";
import {
  authenticate,
  create,
  csv,
  download,
  read,
  readLegacy,
  seal,
  signOut,
  unlock,
  unlockWithKey,
  write,
  type Envelope,
} from "@/lib/storage";
type Draft = {
  id?: string;
  kind: "income" | "expense";
  amount: string;
  date: string;
  description: string;
  category: string;
};
const fresh = (kind: Draft["kind"]): Draft => ({
  kind,
  amount: "",
  date: today(),
  description: "",
  category: "",
});
export default function Workspace() {
  const [data, setData] = useState<Data | null>(null);
  const [envelope, setEnvelope] = useState<Envelope | null>(null);
  const key = useRef<CryptoKey | null>(null);
  const epoch = useRef(0);
  const activity = useRef(0);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [tab, setTab] = useState("transactions");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState(today().slice(0, 7) + "-01");
  const [to, setTo] = useState(today());
  const [range, setRange] = useState({
    from: today().slice(0, 7) + "-01",
    to: today(),
  });
  const [backup, setBackup] = useState<Envelope | null>(null);
  const [backupPassword, setBackupPassword] = useState("");
  const upload = useRef<HTMLInputElement>(null);
  async function lock() {
    epoch.current++;
    key.current = null;
    setData(null);
    setEnvelope(null);
    setDraft(null);
    setBackup(null);
    setPassword("");
    setBackupPassword("");
    setError("");
    setBusy(true);
    await signOut().catch(() => {});
    setBusy(false);
  }
  useEffect(() => {
    if (!data) return;
    const touch = () => {
      activity.current = Date.now();
    };
    const timer = setInterval(() => {
      if (Date.now() - activity.current > 5 * 60 * 1000) void lock();
    }, 10000);
    window.addEventListener("pointerdown", touch);
    window.addEventListener("keydown", touch);
    return () => {
      clearInterval(timer);
      window.removeEventListener("pointerdown", touch);
      window.removeEventListener("keydown", touch);
    };
  }, [data]);
  useEffect(() => {
    if (!data || draft || backup || busy || !key.current) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const latest = await read();
        if (cancelled) return;
        if (!latest) {
          await lock();
          setError("Please sign in again.");
          return;
        }
        if (latest.revision <= data.revision || !key.current) return;
        const next = await unlockWithKey(key.current, latest);
        if (!cancelled) {
          setData(next);
          setEnvelope(latest);
          setNotice("Updated with the latest shared entries.");
        }
      } catch (e) {
        if (!cancelled) setNotice((e as Error).message);
      }
    };
    const timer = setInterval(() => void refresh(), 10000);
    const focus = () => void refresh();
    window.addEventListener("focus", focus);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [data, draft, backup, busy]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  async function login(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await authenticate(password);
      const saved = await read();
      if (saved) {
        const result = await unlock(password, saved);
        key.current = result.key;
        setEnvelope(saved);
        setData(result.state);
      } else {
        const initial = empty();
        const result = await create(password, initial);
        await write(result.envelope, null);
        key.current = result.key;
        setEnvelope(result.envelope);
        setData(initial);
      }
      setPassword("");
      setTab("transactions");
      activity.current = Date.now();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function persist(next: Data) {
    if (!key.current || !envelope) throw Error("Please sign in again.");
    const generation = epoch.current;
    const nextEnvelope = await seal(next, key.current, envelope.salt);
    await write(nextEnvelope, envelope.revision);
    if (generation === epoch.current) {
      setData(next);
      setEnvelope(nextEnvelope);
      setNotice("Saved. Available on all your devices.");
      return true;
    }
    return false;
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft || !data) return;
    setError("");
    setBusy(true);
    try {
      const next = draft.id ? edit(data, draft.id, draft) : add(data, draft);
      if (await persist(next)) {
        setDraft(null);
        setPage(1);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function deleteEntry(transaction: Transaction) {
    if (
      !data ||
      !window.confirm(
        `Delete “${transaction.description}” from the shared tracker?`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await persist(remove(data, transaction.id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function chooseBackup(file: File) {
    try {
      if (file.size > 4 * 1024 * 1024)
        throw Error("Choose a backup smaller than 4 MB.");
      const value = JSON.parse(await file.text());
      if (value.version !== 1 || typeof value.ciphertext !== "string")
        throw Error("Choose an encrypted backup from this app.");
      setBackup(value);
      setBackupPassword("");
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function restore(event: React.FormEvent) {
    event.preventDefault();
    if (!backup || !data) return;
    setBusy(true);
    setError("");
    try {
      const result = await unlock(backupPassword, backup);
      if (
        !window.confirm(
          "Replace the shared entries for everyone with this backup? Download the current backup first.",
        )
      )
        return;
      if (await persist({ ...result.state, revision: data.revision + 1 })) {
        setBackup(null);
        setBackupPassword("");
        setNotice("Backup restored for all your devices.");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const logo = (
    <div className="brand">
      <span className="brand-icon">
        <Gift size={22} />
      </span>
      <span>
        Wrap n Whip<small>Finance tracker</small>
      </span>
    </div>
  );
  if (!data)
    return (
      <div className="login-layout">
        <section className="login-story">
          {logo}
          <div>
            <span className="eyebrow">KEEP IT SIMPLE</span>
            <h1>
              Your money,
              <br />
              made clear.
            </h1>
            <p>Record what comes in, what goes out, and where you stand.</p>
          </div>
          <small>One account. Every device.</small>
        </section>
        <main className="login-panel">
          <div className="login-box">
            <span className="eyebrow">WELCOME BACK</span>
            <h2>Sign in to your tracker</h2>
            <p className="muted">Use the same password on all your devices.</p>
            <form onSubmit={login}>
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <button className="primary" disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
                <ArrowUpRight size={16} />
              </button>
            </form>
            <details className="legacy">
              <summary>Have records from the previous version?</summary>
              <p className="muted">
                Download them here, then import the backup after signing in.
              </p>
              <button
                onClick={async () => {
                  try {
                    download(
                      "old-finance-backup.json",
                      JSON.stringify(await readLegacy()),
                    );
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Download old browser backup
              </button>
            </details>
          </div>
        </main>
      </div>
    );
  const totals = report(data);
  const selected = report(data, range.from, range.to);
  const filtered = totals.transactions.filter((t) =>
    `${t.description} ${t.category} ${t.kind}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  const currentPage = Math.min(page, pages);
  const rows =
    tab === "report"
      ? selected.transactions
      : filtered.slice((currentPage - 1) * 20, currentPage * 20);
  function exportReport() {
    const entries = selected.transactions.map((t) => ({
      Date: t.date,
      Type: t.kind === "income" ? "Money added" : "Money spent",
      Description: t.description,
      Category: t.category,
      "Amount (PKR)": (t.amount / 100).toFixed(2),
    }));
    const summary = [
      ["Opening balance", selected.opening],
      ["Total added", selected.added],
      ["Total spent", selected.spent],
      ["Closing balance", selected.closing],
    ].map(([label, value]) => ({
      Date: "",
      Type: "Summary",
      Description: String(label),
      Category: "",
      "Amount (PKR)": (Number(value) / 100).toFixed(2),
    }));
    download(
      `finance-report-${range.from}-${range.to}.csv`,
      csv([...summary, ...entries]),
      "text/csv;charset=utf-8",
    );
  }
  return (
    <div className="tracker">
      <header className="topbar">
        {logo}
        <div className="top-actions">
          <span className="sync-label">One shared account</span>
          <button aria-label="Lock" disabled={busy} onClick={() => void lock()}>
            <Lock size={15} />
            <span>Sign out</span>
          </button>
        </div>
      </header>
      <main className="content">
        <div className="title-row no-print">
          <div>
            <span className="eyebrow">YOUR MONEY AT A GLANCE</span>
            <h1>Finance tracker</h1>
            <p className="muted">
              A simple record of money added and money spent.
            </p>
          </div>
          <div className="record-actions">
            <button
              disabled={busy}
              onClick={() => {
                setDraft(fresh("expense"));
                setError("");
              }}
            >
              <ArrowUpRight size={16} />
              Record spending
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={() => {
                setDraft(fresh("income"));
                setError("");
              }}
            >
              <Plus size={17} />
              Add money
            </button>
          </div>
        </div>
        <section className="stat-grid no-print">
          <div className="stat">
            <span>Current balance</span>
            <strong className={totals.closing < 0 ? "negative" : ""}>
              {money(totals.closing)}
            </strong>
            <small>All money added minus money spent</small>
          </div>
          <div className="stat">
            <span>Total added</span>
            <strong className="positive">{money(totals.added)}</strong>
            <small>All time</small>
          </div>
          <div className="stat">
            <span>Total spent</span>
            <strong>{money(totals.spent)}</strong>
            <small>All time</small>
          </div>
        </section>
        <nav className="tabs no-print" aria-label="Tracker sections">
          <button
            className={tab === "transactions" ? "active" : ""}
            onClick={() => {
              setTab("transactions");
              setError("");
            }}
          >
            Transactions
          </button>
          <button
            className={tab === "report" ? "active" : ""}
            onClick={() => {
              setTab("report");
              setError("");
            }}
          >
            Report
          </button>
        </nav>
        {notice && (
          <div className="notice no-print" role="status">
            {notice}
          </div>
        )}
        {error && !draft && !backup && (
          <p className="error no-print" role="alert">
            {error}
          </p>
        )}
        {tab === "report" && (
          <>
            <form
              className="report-controls no-print"
              onSubmit={(e) => {
                e.preventDefault();
                try {
                  report(data, from, to);
                  setRange({ from, to });
                  setError("");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <div>
                <label htmlFor="from">From</label>
                <input
                  id="from"
                  type="date"
                  required
                  max={today()}
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="to">To</label>
                <input
                  id="to"
                  type="date"
                  required
                  max={today()}
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
              <button className="primary">Generate report</button>
            </form>
            <section className="report-summary">
              <div className="report-heading">
                <div>
                  <span className="eyebrow">FINANCE REPORT</span>
                  <h2>
                    {range.from} to {range.to}
                  </h2>
                </div>
                <div className="actions no-print">
                  <button onClick={exportReport}>
                    <Download size={15} />
                    Download CSV
                  </button>
                  <button onClick={() => window.print()}>
                    <Printer size={15} />
                    Print / Save PDF
                  </button>
                </div>
              </div>
              <div className="report-totals">
                {[
                  ["Opening balance", selected.opening],
                  ["Money added", selected.added],
                  ["Money spent", selected.spent],
                  ["Closing balance", selected.closing],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{money(Number(value))}</strong>
                  </div>
                ))}
              </div>
              {selected.categories.length > 0 && (
                <div className="category-report">
                  <h3>Spending by category</h3>
                  {selected.categories.map(([category, amount]) => (
                    <div key={category}>
                      <span>{category}</span>
                      <strong>{money(amount)}</strong>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
        <section className="card transactions">
          <div className="table-heading">
            <h2>
              {tab === "report" ? "Report entries" : "Transactions"}
              <small>
                {tab === "report" ? rows.length : filtered.length}{" "}
                {(tab === "report" ? rows.length : filtered.length) === 1
                  ? "entry"
                  : "entries"}
              </small>
            </h2>
            {tab === "transactions" && (
              <input
                className="search no-print"
                type="search"
                aria-label="Search transactions"
                placeholder="Search transactions…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            )}
          </div>
          {rows.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Category</th>
                    <th>Type</th>
                    <th className="amount">Amount</th>
                    {tab === "transactions" && (
                      <th className="no-print">
                        <span className="sr-only">Actions</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => (
                    <tr key={t.id}>
                      <td className="date">{t.date}</td>
                      <td className="description">{t.description}</td>
                      <td>{t.category}</td>
                      <td>
                        <span className={`badge ${t.kind}`}>
                          {t.kind === "income" ? (
                            <ArrowDownLeft size={12} />
                          ) : (
                            <ArrowUpRight size={12} />
                          )}{" "}
                          {t.kind === "income" ? "Added" : "Spent"}
                        </span>
                      </td>
                      <td
                        className={`amount ${t.kind === "income" ? "positive" : ""}`}
                      >
                        {t.kind === "income" ? "+" : "−"}
                        {money(t.amount)}
                      </td>
                      {tab === "transactions" && (
                        <td className="row-actions no-print">
                          <button
                            aria-label={`Edit ${t.description}`}
                            disabled={busy}
                            onClick={() => {
                              setError("");
                              setDraft({
                                id: t.id,
                                kind: t.kind,
                                amount: (t.amount / 100).toFixed(2),
                                date: t.date,
                                description: t.description,
                                category: t.category,
                              });
                            }}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            aria-label={`Delete ${t.description}`}
                            disabled={busy}
                            onClick={() => void deleteEntry(t)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">
              <span>
                <ArrowDownLeft size={24} />
              </span>
              <h3>
                {search
                  ? "No matching entries"
                  : tab === "report"
                    ? "No entries in this period"
                    : "Start with your first entry"}
              </h3>
              <p>
                {search
                  ? "Try a different search."
                  : "Add money or record spending. Your balance updates automatically."}
              </p>
            </div>
          )}
          {tab === "transactions" && pages > 1 && (
            <div className="pagination no-print">
              <button
                disabled={currentPage === 1}
                onClick={() => setPage(currentPage - 1)}
              >
                Previous
              </button>
              <span>
                Page {currentPage} of {pages}
              </span>
              <button
                disabled={currentPage === pages}
                onClick={() => setPage(currentPage + 1)}
              >
                Next
              </button>
            </div>
          )}
        </section>
        <details className="backup-tools no-print">
          <summary>Backup and restore</summary>
          <p className="muted">
            Download a safe copy of your entries. Restoring replaces the shared
            entries on all devices.
          </p>
          <div className="actions">
            <button
              disabled={busy}
              onClick={() =>
                download(
                  `finance-backup-${today()}.json`,
                  JSON.stringify(envelope),
                )
              }
            >
              <Download size={15} />
              Download backup
            </button>
            <button disabled={busy} onClick={() => upload.current?.click()}>
              Restore backup
            </button>
          </div>
          <input
            ref={upload}
            type="file"
            hidden
            accept=".json,application/json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void chooseBackup(file);
              e.target.value = "";
            }}
          />
        </details>
        <footer className="muted no-print">
          PKR · Same entries on every device · Updates sync automatically
        </footer>
      </main>
      {draft && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="entry-title"
          >
            <div className="modal-header">
              <h2 id="entry-title">
                {draft.id
                  ? "Edit entry"
                  : draft.kind === "income"
                    ? "Add money"
                    : "Record spending"}
              </h2>
              <button
                aria-label="Close entry"
                disabled={busy}
                onClick={() => {
                  setDraft(null);
                  setError("");
                }}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={save}>
              <div className="kind-picker">
                <button
                  type="button"
                  className={draft.kind === "income" ? "active" : ""}
                  onClick={() => setDraft({ ...draft, kind: "income" })}
                >
                  Money added
                </button>
                <button
                  type="button"
                  className={draft.kind === "expense" ? "active" : ""}
                  onClick={() => setDraft({ ...draft, kind: "expense" })}
                >
                  Money spent
                </button>
              </div>
              <label htmlFor="amount">Amount (PKR)</label>
              <input
                id="amount"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                required
                value={draft.amount}
                onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
              />
              <label htmlFor="description">Description</label>
              <input
                id="description"
                required
                maxLength={2000}
                placeholder="What was the money for?"
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
              />
              <div className="two-fields">
                <div>
                  <label htmlFor="date">Date</label>
                  <input
                    id="date"
                    type="date"
                    required
                    max={today()}
                    value={draft.date}
                    onChange={(e) =>
                      setDraft({ ...draft, date: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label htmlFor="category">
                    Category <small>(optional)</small>
                  </label>
                  <input
                    id="category"
                    list="categories"
                    maxLength={60}
                    placeholder="General"
                    value={draft.category}
                    onChange={(e) =>
                      setDraft({ ...draft, category: e.target.value })
                    }
                  />
                  <datalist id="categories">
                    {[
                      "Sales",
                      "Investment",
                      "Supplies",
                      "Rent",
                      "Transport",
                      "Other",
                    ].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </datalist>
                </div>
              </div>
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
              <div className="form-actions">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setDraft(null);
                    setError("");
                  }}
                >
                  Cancel
                </button>
                <button className="primary" disabled={busy}>
                  {busy ? "Saving…" : "Save entry"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {backup && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="restore-title"
          >
            <div className="modal-header">
              <h2 id="restore-title">Restore backup</h2>
              <button
                aria-label="Close restore"
                disabled={busy}
                onClick={() => {
                  setBackup(null);
                  setError("");
                }}
              >
                <X size={18} />
              </button>
            </div>
            <p className="muted">
              Enter this backup’s password. You’ll confirm before replacing the
              shared entries.
            </p>
            <form onSubmit={restore}>
              <label htmlFor="backup-password">Backup password</label>
              <input
                id="backup-password"
                type="password"
                required
                value={backupPassword}
                onChange={(e) => setBackupPassword(e.target.value)}
              />
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <button className="primary" disabled={busy}>
                {busy ? "Restoring…" : "Verify and restore"}
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
