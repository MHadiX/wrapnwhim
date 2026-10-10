"use client";
import { useEffect, useRef, useState } from "react";
import {
  Gift,
  LayoutDashboard,
  ShoppingBag,
  Package,
  Users,
  Truck,
  Wallet,
  ArrowLeftRight,
  HandCoins,
  CheckCircle2,
  PieChart,
  Settings,
  History,
  Menu,
  X,
  LogOut,
  Plus,
  Download,
  Upload,
  Sun,
  Moon,
  ShieldCheck,
  Search,
  ArrowUpRight,
  TrendingUp,
  Lock,
  Printer,
  Trash2,
  FileText,
  Target,
  ChevronRight,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  empty,
  operate,
  metrics,
  balance,
  totalCodes,
  reserved,
  money,
  today,
  type Workspace as State,
  type Row,
} from "@/lib/business";
import {
  create,
  unlock,
  seal,
  read,
  write,
  download,
  csv,
  type Envelope,
} from "@/lib/storage";
type Field = {
  key: string;
  label: string;
  type?: string;
  options?: string[];
  required?: boolean;
};
const F = (
  key: string,
  label: string,
  type = "text",
  required = true,
): Field => ({ key, label, type, required });
const account = F("account", "Payment account", "accounts"),
  amount = F("amount", "Amount (PKR)", "money"),
  date = F("date", "Date", "date"),
  description = F("description", "Description", "textarea", false),
  partner = F("partner", "Partner", "partners");
const definitions: Record<string, { title: string; fields: Field[] }> = {
  customer: {
    title: "Add customer",
    fields: [
      F("name", "Full name"),
      F("phone", "Phone", "tel", false),
      F("email", "Email", "email", false),
      F("address", "Address", "textarea", false),
      F("notes", "Notes", "textarea", false),
    ],
  },
  supplier: {
    title: "Add supplier",
    fields: [
      F("name", "Supplier name"),
      F("phone", "Phone", "tel", false),
      F("email", "Email", "email", false),
      F("address", "Address", "textarea", false),
      F("notes", "Notes", "textarea", false),
    ],
  },
  partner: {
    title: "Add partner",
    fields: [
      F("name", "Partner name"),
      F("email", "Email", "email", false),
      F("ratio", "Profit share units", "number"),
      F("notes", "Notes", "textarea", false),
    ],
  },
  product: {
    title: "Add product",
    fields: [
      F("name", "Product name"),
      F("sku", "SKU"),
      F("category", "Category"),
      F("price", "Selling price (PKR)", "money"),
      F("reorder", "Low stock threshold", "number"),
    ],
  },
  product_edit: {
    title: "Edit product",
    fields: [
      F("product", "Product", "products"),
      F("name", "Product name"),
      F("category", "Category"),
      F("price", "Selling price (PKR)", "money"),
      F("reorder", "Low stock threshold", "number"),
      F("active", "Available for new orders", "checkbox", false),
    ],
  },
  account: {
    title: "Add account",
    fields: [
      F("name", "Account name"),
      {
        key: "type",
        label: "Account type",
        type: "select",
        options: ["bank", "cash", "wallet"],
      },
    ],
  },
  income: {
    title: "Record other income",
    fields: [account, amount, date, description],
  },
  expense: {
    title: "Record expense",
    fields: [account, amount, F("category", "Category"), date, description],
  },
  investment: {
    title: "Record investment",
    fields: [partner, account, amount, date, description],
  },
  opening: {
    title: "Record opening balance",
    fields: [account, amount, date, description],
  },
  loan: { title: "Receive loan", fields: [account, amount, date, description] },
  loan_pay: {
    title: "Repay loan",
    fields: [account, amount, date, description],
  },
  partner_expense: {
    title: "Partner-paid expense",
    fields: [partner, amount, F("category", "Category"), date, description],
  },
  reimbursement: {
    title: "Reimburse partner",
    fields: [partner, account, amount, date, description],
  },
  transfer: {
    title: "Transfer money",
    fields: [
      account,
      F("destination", "Destination account", "accounts"),
      amount,
      F("fee", "Transfer fee (PKR)", "money"),
      date,
      description,
    ],
  },
  order: {
    title: "Create order",
    fields: [
      F("party", "Customer", "customers"),
      F("items", "Order items", "items"),
      F("discount", "Discount (PKR)", "money"),
      F("shipping", "Shipping charged (PKR)", "money"),
      F("cod", "Cash on delivery", "checkbox", false),
      date,
      F("notes", "Notes", "textarea", false),
    ],
  },
  purchase: {
    title: "Create purchase",
    fields: [
      F("party", "Supplier", "suppliers"),
      F("items", "Purchase items", "items"),
      date,
      F("notes", "Notes", "textarea", false),
    ],
  },
  order_status: {
    title: "Update order",
    fields: [
      F("order", "Order", "orders"),
      {
        key: "status",
        label: "Next status",
        type: "select",
        options: [
          "confirmed",
          "preparing",
          "packed",
          "shipped",
          "delivered",
          "cancelled",
        ],
      },
      F("tracking", "Tracking or collection reference", "text", false),
      date,
    ],
  },
  order_payment: {
    title: "Record customer payment",
    fields: [F("order", "Order", "orders"), account, amount, date],
  },
  cod_settlement: {
    title: "Record COD settlement",
    fields: [
      F("order", "Order", "orders"),
      account,
      amount,
      F("fee", "Courier deduction (PKR)", "money"),
      date,
    ],
  },
  purchase_receive: {
    title: "Receive purchase",
    fields: [F("purchase", "Purchase", "purchases"), date],
  },
  purchase_payment: {
    title: "Pay supplier bill",
    fields: [F("purchase", "Purchase", "purchases"), account, amount, date],
  },
  loss: {
    title: "Record stock loss",
    fields: [
      F("product", "Product", "products"),
      F("quantity", "Quantity", "number"),
      date,
      description,
    ],
  },
  return: {
    title: "Record returned item",
    fields: [
      F("order", "Order", "orders"),
      F("product", "Returned product", "products"),
      F("quantity", "Quantity", "number"),
      date,
    ],
  },
  refund: {
    title: "Refund customer",
    fields: [F("order", "Order", "orders"), account, amount, date],
  },
  request_withdrawal: {
    title: "Request capital withdrawal",
    fields: [partner, account, amount, date, description],
  },
  request_distribution: {
    title: "Request profit distribution",
    fields: [account, amount, date, description],
  },
  approve: {
    title: "Record partner approval",
    fields: [F("approval", "Request", "approvals"), partner, date],
  },
  reject: {
    title: "Record partner rejection",
    fields: [F("approval", "Request", "approvals"), partner, date],
  },
  budget: {
    title: "Set monthly budget",
    fields: [F("month", "Month", "month"), F("category", "Category"), amount],
  },
  settings: {
    title: "Business settings",
    fields: [F("name", "Business name")],
  },
  close_period: {
    title: "Close financial period",
    fields: [F("through", "Close through date", "date")],
  },
};
definitions.stock_opening = {
  title: "Record opening stock",
  fields: [
    F("product", "Product", "products"),
    F("quantity", "Quantity", "number"),
    F("cost", "Unit cost (PKR)", "money"),
    date,
    description,
  ],
};
definitions.partner_purchase_payment = {
  title: "Partner-paid supplier bill",
  fields: [F("purchase", "Purchase", "purchases"), partner, amount, date],
};
definitions.supplier_return = {
  title: "Return stock to supplier",
  fields: [
    F("purchase", "Purchase", "purchases"),
    F("product", "Product", "products"),
    F("quantity", "Quantity", "number"),
    date,
  ],
};
definitions.supplier_refund = {
  title: "Receive supplier refund",
  fields: [F("purchase", "Purchase", "purchases"), account, amount, date],
};
definitions.customer_edit = {
  title: "Edit customer",
  fields: [
    F("record", "Customer", "customers"),
    ...definitions.customer.fields,
  ],
};
definitions.supplier_edit = {
  title: "Edit supplier",
  fields: [
    F("record", "Supplier", "suppliers"),
    ...definitions.supplier.fields,
  ],
};
definitions.partner_edit = {
  title: "Edit partner profile",
  fields: [
    F("record", "Partner", "partners"),
    ...definitions.partner.fields.filter((f) => f.key !== "ratio"),
  ],
};
definitions.account_edit = {
  title: "Rename account",
  fields: [F("record", "Account", "accounts"), F("name", "Account name")],
};
const sections = [
  {
    id: "dashboard",
    label: "Overview",
    icon: LayoutDashboard,
    group: "WORKSPACE",
  },
  { id: "orders", label: "Sales & orders", icon: ShoppingBag },
  { id: "products", label: "Products & inventory", icon: Package },
  { id: "customers", label: "Customers", icon: Users },
  { id: "suppliers", label: "Suppliers", icon: Truck },
  { id: "purchases", label: "Purchases & bills", icon: FileText },
  {
    id: "accounts",
    label: "Financial accounts",
    icon: Wallet,
    group: "FINANCE",
  },
  { id: "transactions", label: "Transactions", icon: ArrowLeftRight },
  { id: "partners", label: "Partners", icon: HandCoins },
  { id: "approvals", label: "Approvals", icon: CheckCircle2 },
  { id: "budgets", label: "Budgets", icon: Target },
  { id: "reports", label: "Reports", icon: PieChart },
  { id: "activity", label: "Activity", icon: History, group: "MANAGE" },
  { id: "settings", label: "Settings & backups", icon: Settings },
];
const sectionActions: Record<string, string[]> = {
  dashboard: ["order", "expense"],
  orders: ["order", "order_payment", "cod_settlement"],
  products: ["product", "stock_opening", "loss"],
  customers: ["customer"],
  suppliers: ["supplier"],
  purchases: [
    "purchase",
    "purchase_receive",
    "purchase_payment",
    "partner_purchase_payment",
    "supplier_return",
    "supplier_refund",
  ],
  accounts: ["account", "transfer", "opening", "loan", "loan_pay"],
  transactions: ["income", "expense", "transfer"],
  partners: [
    "partner",
    "investment",
    "partner_expense",
    "reimbursement",
    "request_withdrawal",
    "request_distribution",
  ],
  approvals: [],
  budgets: ["budget"],
  reports: [],
  activity: [],
  settings: ["settings", "close_period"],
};
function Logo() {
  return (
    <div className="logo">
      <Gift size={23} />
      <div>
        Wrap n Whip<small>Business workspace</small>
      </div>
    </div>
  );
}
function Badge({ value }: { value: string }) {
  return (
    <span
      className={
        "badge " +
        (["delivered", "approved", "received", "paid"].includes(value)
          ? "good"
          : ["cancelled", "rejected"].includes(value)
            ? "bad"
            : ["pending", "draft"].includes(value)
              ? "warn"
              : "")
      }
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}
function Action({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <button
      className={
        [
          "order",
          "product",
          "customer",
          "supplier",
          "purchase",
          "expense",
          "partner",
          "budget",
        ].includes(name)
          ? "primary"
          : ""
      }
      onClick={onClick}
    >
      <Plus size={14} />
      {definitions[name].title}
    </button>
  );
}
function Table({
  columns,
  rows,
  emptyText = "No records yet",
  onRow,
}: {
  columns: {
    key: string;
    label: string;
    render?: (r: Row) => React.ReactNode;
  }[];
  rows: Row[];
  emptyText?: string;
  onRow?: (r: Row) => void;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
            {onRow && <th>Details</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id ?? i}>
              {columns.map((c) => (
                <td key={c.key}>
                  {c.render ? c.render(r) : String(r[c.key] ?? "—")}
                </td>
              ))}
              {onRow && (
                <td>
                  <button
                    aria-label={`View ${r.number || r.name || r.kind}`}
                    onClick={() => onRow(r)}
                  >
                    <ChevronRight size={14} />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <div className="empty">
          <Package size={27} />
          <h3>{emptyText}</h3>
          <p>
            Your workspace starts empty. Add your actual business records using
            the buttons above.
          </p>
        </div>
      )}
    </div>
  );
}
function Form({
  operation,
  state,
  initial,
  onClose,
  onSave,
  busy,
}: {
  operation: string;
  state: State;
  initial: Row;
  onClose: () => void;
  onSave: (d: Row) => Promise<void>;
  busy: boolean;
}) {
  const def = definitions[operation];
  const defaults = Object.fromEntries(
    def.fields.map((f) => [
      f.key,
      f.type === "date"
        ? today()
        : f.type === "month"
          ? today().slice(0, 7)
          : f.type === "money"
            ? "0"
            : f.type === "number"
              ? ["ratio", "quantity"].includes(f.key)
                ? "1"
                : "3"
              : f.type === "checkbox"
                ? f.key === "active"
                : f.type === "select"
                  ? f.options?.[0]
                  : f.type === "items"
                    ? [{ product: "", quantity: 1, price: "0" }]
                    : "",
    ]),
  );
  const [data, setData] = useState<Row>({ ...defaults, ...initial });
  const [error, setError] = useState("");
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => {
    first.current?.focus();
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [busy, onClose]);
  const set = (key: string, value: unknown) =>
    setData((d) => ({ ...d, [key]: value }));
  const render = (f: Field) => {
    if (f.type === "items")
      return (
        <div className="field full" key={f.key}>
          <label>{f.label}</label>
          {data.items.map((item: Row, index: number) => (
            <div className="item-row" key={index}>
              <div className="field">
                <label htmlFor={`product-${index}`}>Product</label>
                <select
                  id={`product-${index}`}
                  required
                  value={item.product}
                  onChange={(e) => {
                    const p = state.products.find(
                      (p) => p.id === e.target.value,
                    );
                    const items = [...data.items];
                    items[index] = {
                      ...item,
                      product: e.target.value,
                      price:
                        ((operation === "order" ? p?.price : 0) || 0) / 100,
                    };
                    set("items", items);
                  }}
                >
                  <option value="">Choose product</option>
                  {state.products
                    .filter((p) => p.active)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {p.sku}
                      </option>
                    ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor={`quantity-${index}`}>Qty</label>
                <input
                  id={`quantity-${index}`}
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={item.quantity}
                  onChange={(e) => {
                    const items = [...data.items];
                    items[index] = { ...item, quantity: e.target.value };
                    set("items", items);
                  }}
                />
              </div>
              <div className="field">
                <label htmlFor={`price-${index}`}>
                  {operation === "purchase" ? "Unit cost" : "Price"} (PKR)
                </label>
                <input
                  id={`price-${index}`}
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={item.price}
                  onChange={(e) => {
                    const items = [...data.items];
                    items[index] = { ...item, price: e.target.value };
                    set("items", items);
                  }}
                />
              </div>
              <button
                type="button"
                aria-label={`Remove item ${index + 1}`}
                disabled={data.items.length === 1}
                onClick={() =>
                  set(
                    "items",
                    data.items.filter((_: Row, i: number) => i !== index),
                  )
                }
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              set("items", [
                ...data.items,
                { product: "", quantity: 1, price: "0" },
              ])
            }
          >
            <Plus size={13} />
            Add item
          </button>
          <small className="subtle">
            Products are separate stock items. Enter all components as line
            items for a gift bundle.
          </small>
        </div>
      );
    let choices: Row[] = [];
    if (
      [
        "accounts",
        "partners",
        "products",
        "customers",
        "suppliers",
        "orders",
        "purchases",
        "approvals",
      ].includes(f.type || "")
    )
      choices = state[f.type as keyof State] as Row[];
    if (f.key === "product" && operation === "return" && data.order) {
      const o = state.orders.find((o) => o.id === data.order);
      choices = choices.filter((p) =>
        o?.items.some(
          (i: Row) => i.product === p.id && i.returned < i.quantity,
        ),
      );
    }
    if (operation === "purchase_receive" && f.key === "purchase")
      choices = choices.filter((p) => p.status === "draft");
    if (operation === "approve" || operation === "reject") {
      if (f.key === "approval")
        choices = choices.filter((a) => a.status === "pending");
      if (f.key === "partner") {
        const a = state.approvals.find((a) => a.id === data.approval);
        choices = choices.filter(
          (p) => p.id !== a?.partner && !a?.votes.includes(p.id),
        );
      }
    }
    if (f.type === "checkbox")
      return (
        <div className="field check" key={f.key}>
          <input
            id={f.key}
            type="checkbox"
            checked={!!data[f.key]}
            onChange={(e) => set(f.key, e.target.checked)}
          />
          <label htmlFor={f.key}>{f.label}</label>
        </div>
      );
    return (
      <div
        className={"field " + (f.type === "textarea" ? "full" : "")}
        key={f.key}
      >
        <label htmlFor={f.key}>
          {f.label}
          {!f.required && <span className="subtle"> · optional</span>}
        </label>
        {choices.length ||
        [
          "accounts",
          "partners",
          "products",
          "customers",
          "suppliers",
          "orders",
          "purchases",
          "approvals",
          "select",
        ].includes(f.type || "") ? (
          <select
            id={f.key}
            required={f.required}
            value={data[f.key] ?? ""}
            onChange={(e) => set(f.key, e.target.value)}
          >
            {f.type === "select" ? (
              f.options?.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))
            ) : (
              <>
                <option value="">Choose {f.label.toLowerCase()}</option>
                {choices.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.number
                      ? `${p.number} · ${p.partyName}`
                      : p.name ||
                        `${p.kind.replaceAll("_", " ")} · ${money(p.amount)}`}
                  </option>
                ))}
              </>
            )}
          </select>
        ) : f.type === "textarea" ? (
          <textarea
            id={f.key}
            maxLength={2000}
            value={data[f.key] ?? ""}
            onChange={(e) => set(f.key, e.target.value)}
          />
        ) : (
          <input
            ref={f === def.fields[0] ? first : undefined}
            id={f.key}
            type={f.type === "money" ? "number" : f.type}
            min={["number", "money"].includes(f.type || "") ? "0" : undefined}
            max={f.type === "date" ? today() : undefined}
            step={
              f.type === "money"
                ? "0.01"
                : f.type === "number"
                  ? "1"
                  : undefined
            }
            maxLength={200}
            required={f.required}
            value={data[f.key] ?? ""}
            onChange={(e) => set(f.key, e.target.value)}
          />
        )}
      </div>
    );
  };
  return (
    <div className="modal-backdrop">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-title"
      >
        <div className="modal-title">
          <h2 id="form-title">{def.title}</h2>
          <button
            aria-label="Close form"
            className="ghost"
            disabled={busy}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        {["approve", "reject"].includes(operation) && (
          <div className="note">
            Record a partner’s real decision. This single-device workspace does
            not independently verify the approver’s identity.
          </div>
        )}
        {operation === "close_period" && (
          <div className="note">
            Entries on or before this date will be locked. Closing a period
            cannot be undone through the normal forms.
          </div>
        )}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            try {
              await onSave(data);
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        >
          <div className="form-grid">{def.fields.map(render)}</div>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <div className="form-footer">
            <button type="button" disabled={busy} onClick={onClose}>
              Cancel
            </button>
            <button className="primary" type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save record"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
export default function Workspace() {
  const [saved, setSaved] = useState<Envelope | null | undefined>(undefined);
  const [state, setState] = useState<State | null>(null);
  const key = useRef<CryptoKey | null>(null);
  const generation = useRef(0);
  const tabIdentity = useRef("");
  const lastActivity = useRef(0);
  const [restoreEnvelope, setRestoreEnvelope] = useState<Envelope | null>(null);
  const [restorePassword, setRestorePassword] = useState("");
  const [restoreError, setRestoreError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [mobile, setMobile] = useState(false);
  const [dark, setDark] = useState(false);
  const [toast, setToast] = useState("");
  const [form, setForm] = useState<{ operation: string; initial: Row } | null>(
    null,
  );
  const [detail, setDetail] = useState<{ type: string; row: Row } | null>(null);
  const [report, setReport] = useState("profit");
  const [from, setFrom] = useState(today().slice(0, 7) + "-01");
  const [to, setTo] = useState(today());
  const backupInput = useRef<HTMLInputElement>(null);
  const lock = () => {
    generation.current++;
    key.current = null;
    setState(null);
    setPassword("");
    setConfirmPassword("");
    setForm(null);
    setDetail(null);
    read()
      .then(setSaved)
      .catch((e) => setError(e.message));
  };
  useEffect(() => {
    tabIdentity.current = crypto.randomUUID();
    read()
      .then(setSaved)
      .catch((e) => {
        setSaved(null);
        setError(e.message);
      });
    const theme = localStorage.getItem("wrapnwhip-theme") === "dark";
    setDark(theme);
    document.body.classList.toggle("dark", theme);
    const route = () => {
      const t = location.hash.slice(1);
      if (sections.some((s) => s.id === t)) setTab(t);
    };
    route();
    window.addEventListener("hashchange", route);
    return () => window.removeEventListener("hashchange", route);
  }, []);
  useEffect(() => {
    if (!state) return;
    const touch = () => {
      lastActivity.current = Date.now();
    };
    window.addEventListener("pointerdown", touch);
    window.addEventListener("keydown", touch);
    const timer = setInterval(() => {
      if (Date.now() - lastActivity.current > 5 * 60 * 1000) lock();
    }, 10000);
    const channel = new BroadcastChannel("wrapnwhip-workspace");
    channel.onmessage = (event) => {
      if (event.data?.sender === tabIdentity.current) return;
      lock();
      setToast("Updated in another tab. Unlock to load your latest records.");
    };
    return () => {
      clearInterval(timer);
      channel.close();
      window.removeEventListener("pointerdown", touch);
      window.removeEventListener("keydown", touch);
    };
  }, [state]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const navigate = (name: string) => {
    setTab(name);
    setSearch("");
    setStatus("");
    setPage(1);
    setMobile(false);
    window.history.pushState(null, "", "#" + name);
  };
  const open = (operation: string, initial: Row = {}) => {
    setDetail(null);
    if (operation === "order_status" && initial.order) {
      const o = state?.orders.find((o) => o.id === initial.order);
      const steps: Record<string, string> = {
        draft: "confirmed",
        confirmed: "preparing",
        preparing: "packed",
        packed: "shipped",
        shipped: "delivered",
      };
      initial = {
        ...initial,
        status: steps[o?.status] || "cancelled",
        tracking: o?.tracking || "",
      };
    }
    setForm({ operation, initial });
  };
  const save = async (kind: string, data: Row) => {
    if (!state || !key.current || !saved)
      throw Error("Unlock this workspace first.");
    setBusy(true);
    const g = generation.current;
    try {
      const next = operate(state, kind, data);
      const envelope = await seal(next, key.current, saved.salt);
      await write(envelope, saved.revision);
      if (g === generation.current) {
        setState(next);
        setSaved(envelope);
        setForm(null);
        setToast("Record saved privately on this device.");
        const channel = new BroadcastChannel("wrapnwhip-workspace");
        channel.postMessage({
          revision: next.revision,
          sender: tabIdentity.current,
        });
        channel.close();
      }
    } finally {
      setBusy(false);
    }
  };
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (!crypto.subtle)
        throw Error("Open this site using HTTPS in a current browser.");
      if (saved) {
        const result = await unlock(password, saved);
        key.current = result.key;
        setState(result.state);
      } else {
        if (password !== confirmPassword)
          throw Error("Passwords do not match.");
        const result = await create(password, empty());
        await write(result.envelope, null);
        key.current = result.key;
        setSaved(result.envelope);
        setState(empty());
      }
      setPassword("");
      setConfirmPassword("");
      lastActivity.current = Date.now();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function restore(file: File) {
    if (file.size > 50 * 1024 * 1024) {
      setError("Backup must be smaller than 50 MB.");
      return;
    }
    try {
      const envelope = JSON.parse(await file.text());
      if (
        envelope.version !== 1 ||
        typeof envelope.ciphertext !== "string" ||
        typeof envelope.salt !== "string" ||
        typeof envelope.iv !== "string"
      )
        throw Error("Choose an encrypted Wrap n Whip backup.");
      setRestoreEnvelope(envelope);
      setRestorePassword("");
      setRestoreError("");
    } catch (e) {
      setError((e as Error).message);
      setToast((e as Error).message);
    }
  }
  async function confirmRestore(e: React.FormEvent) {
    e.preventDefault();
    if (!restoreEnvelope) return;
    setBusy(true);
    setRestoreError("");
    try {
      const result = await unlock(restorePassword, restoreEnvelope);
      if (
        saved &&
        !window.confirm(
          "Replace the records on this device with this verified backup? Download your current backup first.",
        )
      )
        return;
      const restored = {
        ...result.state,
        revision: (saved?.revision ?? 0) + 1,
      };
      const envelope = await seal(restored, result.key, restoreEnvelope.salt);
      await write(envelope, saved?.revision ?? null);
      const channel = new BroadcastChannel("wrapnwhip-workspace");
      channel.postMessage({
        revision: envelope.revision,
        sender: tabIdentity.current,
      });
      channel.close();
      lock();
      setSaved(envelope);
      setRestoreEnvelope(null);
      setRestorePassword("");
      setToast("Verified backup restored. Unlock with its password.");
    } catch (e) {
      setRestoreError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const restoreDialog = restoreEnvelope && (
    <div className="modal-backdrop">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Restore encrypted backup"
      >
        <div className="modal-title">
          <h2>Restore encrypted backup</h2>
          <button
            aria-label="Cancel restore"
            disabled={busy}
            onClick={() => setRestoreEnvelope(null)}
          >
            <X size={17} />
          </button>
        </div>
        <p className="subtle">
          Enter the password used for this backup. The backup is verified before
          any records are replaced.
        </p>
        <form onSubmit={confirmRestore}>
          <div className="field">
            <label htmlFor="backup-password">Backup password</label>
            <input
              id="backup-password"
              type="password"
              value={restorePassword}
              required
              onChange={(e) => setRestorePassword(e.target.value)}
            />
          </div>
          {restoreError && (
            <div role="alert" className="error">
              {restoreError}
            </div>
          )}
          <div className="form-footer">
            <button className="primary" disabled={busy}>
              {busy ? "Verifying…" : "Verify and restore"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );

  function exportRows(rows: Row[], name: string) {
    download(
      `wrapnwhip-${name}-${today()}.csv`,
      csv(rows),
      "text/csv;charset=utf-8",
    );
  }
  const fileInput = (
    <input
      ref={backupInput}
      type="file"
      accept=".json,application/json"
      hidden
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) void restore(f);
        e.target.value = "";
      }}
    />
  );
  if (!state)
    return (
      <>
        <div className="login">
          <section className="login-story">
            <Logo />
            <div>
              <div
                className="eyebrow"
                style={{ color: "#edc8d6", marginBottom: 22 }}
              >
                THOUGHTFUL GIFTS. THOUGHTFUL BUSINESS.
              </div>
              <h1>
                A little more clarity.
                <br />A lot more possibility.
              </h1>
              <p>
                Your money, orders and inventory. One calm space to keep your
                business moving.
              </p>
            </div>
            <small>Made for Wrap n Whip · PKR · Asia/Karachi</small>
          </section>
          <main className="login-form">
            <div className="login-box">
              <span className="eyebrow">YOUR PRIVATE WORKSPACE</span>
              <h1>
                {saved === undefined
                  ? "Loading your workspace…"
                  : saved
                    ? "Welcome back"
                    : "Make it yours"}
              </h1>
              <p className="subtle" style={{ lineHeight: 1.8 }}>
                {saved
                  ? "Enter your password to unlock the records saved on this device."
                  : "Create a password to protect your business records. No account, email verification or service setup needed."}
              </p>
              {saved !== undefined && (
                <form onSubmit={login}>
                  <div className="field">
                    <label htmlFor="password">
                      {saved ? "Password" : "Create password"}
                    </label>
                    <input
                      id="password"
                      autoComplete={saved ? "current-password" : "new-password"}
                      type="password"
                      required
                      minLength={saved ? 1 : 8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  {!saved && (
                    <div className="field">
                      <label htmlFor="confirmPassword">Confirm password</label>
                      <input
                        id="confirmPassword"
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={8}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </div>
                  )}
                  {error && (
                    <div role="alert" className="error">
                      {error}
                    </div>
                  )}
                  <button className="primary" disabled={busy}>
                    {busy
                      ? "Unlocking…"
                      : saved
                        ? "Unlock workspace"
                        : "Create workspace"}
                    <ArrowUpRight size={16} />
                  </button>
                </form>
              )}
              <div className="note">
                <ShieldCheck size={16} />
                <br />
                Records are encrypted and saved in this browser. Keep your
                password and backups safe; there is no email password reset.
              </div>
              <button
                className="ghost"
                onClick={() => backupInput.current?.click()}
              >
                <Upload size={14} />
                Restore encrypted backup
              </button>
              {saved && (
                <button
                  className="ghost"
                  onClick={() =>
                    download(
                      `wrapnwhip-backup-${today()}.json`,
                      JSON.stringify(saved),
                    )
                  }
                >
                  <Download size={14} />
                  Download locked backup
                </button>
              )}
            </div>
          </main>
        </div>
        {fileInput}
        {restoreDialog}
        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}
      </>
    );
  const m = metrics(state);
  const selected = sections.find((s) => s.id === tab)!;
  const scoped = {
    ...state,
    entries: state.entries.filter((e) => e.date >= from && e.date <= to),
  };
  const pm = metrics(scoped);
  const lows = state.products.filter(
    (p) => p.active && p.quantity - reserved(state, p.id) <= p.reorder,
  );
  let rows: Row[] =
    tab === "transactions"
      ? state.entries
      : tab === "activity"
        ? state.activity
        : tab === "reports"
          ? report === "journal"
            ? scoped.entries
            : report === "inventory"
              ? state.products.map((p) => ({
                  ...p,
                  available: p.quantity - reserved(state, p.id),
                  unitCost: p.quantity ? Math.floor(p.value / p.quantity) : 0,
                }))
              : report === "sales"
                ? state.orders.filter((o) => o.date >= from && o.date <= to)
                : report === "expenses"
                  ? scoped.entries.filter((e) =>
                      e.lines.some((l) => l.code.startsWith("expense:")),
                    )
                  : []
          : (state[tab as keyof State] as Row[]) || [];
  if (!Array.isArray(rows)) rows = [];
  const filtered = rows.filter(
    (r) =>
      (!search ||
        JSON.stringify(r).toLowerCase().includes(search.toLowerCase())) &&
      (!status || r.status === status),
  );
  const pageRows = filtered.slice((page - 1) * 20, page * 20);
  const columns: Record<
    string,
    { key: string; label: string; render?: (r: Row) => React.ReactNode }[]
  > = {
    orders: [
      { key: "number", label: "Order" },
      { key: "partyName", label: "Customer" },
      { key: "date", label: "Date" },
      {
        key: "status",
        label: "Status",
        render: (r) => <Badge value={r.status} />,
      },
      {
        key: "total",
        label: "Total",
        render: (r) => money(r.total - r.credits),
      },
      {
        key: "paid",
        label: "Received",
        render: (r) => money(r.paid - r.refunds),
      },
      {
        key: "due",
        label: "Due",
        render: (r) => money(Math.max(0, r.total - r.credits - r.paid)),
      },
    ],
    products: [
      {
        key: "name",
        label: "Product",
        render: (r) => (
          <>
            <strong>{r.name}</strong>
            <small
              className="subtle"
              style={{ display: "block", marginTop: 5 }}
            >
              {r.sku}
            </small>
          </>
        ),
      },
      { key: "category", label: "Category" },
      { key: "price", label: "Price", render: (r) => money(r.price) },
      { key: "quantity", label: "In stock" },
      {
        key: "reserved",
        label: "Reserved",
        render: (r) => reserved(state, r.id),
      },
      {
        key: "available",
        label: "Available",
        render: (r) => (
          <span
            className={
              r.quantity - reserved(state, r.id) <= r.reorder ? "negative" : ""
            }
          >
            {r.quantity - reserved(state, r.id)}
          </span>
        ),
      },
      { key: "value", label: "Stock value", render: (r) => money(r.value) },
    ],
    customers: [
      { key: "name", label: "Customer" },
      { key: "phone", label: "Phone" },
      { key: "email", label: "Email" },
      {
        key: "orders",
        label: "Orders",
        render: (r) => state.orders.filter((o) => o.party === r.id).length,
      },
    ],
    suppliers: [
      { key: "name", label: "Supplier" },
      { key: "phone", label: "Phone" },
      { key: "email", label: "Email" },
      {
        key: "owed",
        label: "Outstanding",
        render: (r) => money(-balance(state, "ap:" + r.id)),
      },
    ],
    purchases: [
      { key: "number", label: "Purchase" },
      { key: "partyName", label: "Supplier" },
      { key: "date", label: "Date" },
      {
        key: "status",
        label: "Status",
        render: (r) => <Badge value={r.status} />,
      },
      { key: "total", label: "Total", render: (r) => money(r.total) },
      { key: "paid", label: "Paid", render: (r) => money(r.paid) },
      {
        key: "owed",
        label: "Outstanding",
        render: (r) =>
          money(
            r.status === "received"
              ? Math.max(0, r.total - r.credits - r.paid)
              : 0,
          ),
      },
    ],
    accounts: [
      { key: "name", label: "Account" },
      { key: "type", label: "Type" },
      {
        key: "balance",
        label: "Balance",
        render: (r) => <strong>{money(balance(state, "cash:" + r.id))}</strong>,
      },
    ],
    transactions: [
      { key: "date", label: "Date" },
      { key: "kind", label: "Type", render: (r) => <Badge value={r.kind} /> },
      { key: "description", label: "Description" },
      {
        key: "amount",
        label: "Journal amount",
        render: (r) =>
          money(r.lines.reduce((n: number, l: Row) => n + l.debit, 0)),
      },
    ],
    partners: [
      { key: "name", label: "Partner" },
      {
        key: "share",
        label: "Profit share",
        render: (r) =>
          (
            (r.ratio / state.partners.reduce((n, p) => n + p.ratio, 0)) *
            100
          ).toFixed(2) + "%",
      },
      {
        key: "capital",
        label: "Capital",
        render: (r) => money(-balance(state, "capital:" + r.id)),
      },
      {
        key: "payable",
        label: "Business owes",
        render: (r) => money(-balance(state, "payable:" + r.id)),
      },
    ],
    approvals: [
      {
        key: "kind",
        label: "Request",
        render: (r) => r.kind.replace("request_", "").replaceAll("_", " "),
      },
      { key: "description", label: "Description" },
      { key: "amount", label: "Amount", render: (r) => money(r.amount) },
      {
        key: "votes",
        label: "Decisions",
        render: (r) => `${r.votes.length} / 2`,
      },
      {
        key: "status",
        label: "Status",
        render: (r) => <Badge value={r.status} />,
      },
    ],
    budgets: [
      { key: "month", label: "Month" },
      { key: "category", label: "Category" },
      { key: "amount", label: "Budget", render: (r) => money(r.amount) },
      {
        key: "actual",
        label: "Actual",
        render: (r) =>
          money(
            state.entries
              .filter((e) => e.date.startsWith(r.month))
              .flatMap((e) => e.lines)
              .filter((l) => l.code === "expense:" + r.category)
              .reduce((n, l) => n + l.debit - l.credit, 0),
          ),
      },
    ],
    activity: [
      {
        key: "time",
        label: "When",
        render: (r) =>
          new Date(r.time).toLocaleString("en-PK", {
            timeZone: "Asia/Karachi",
          }),
      },
      {
        key: "kind",
        label: "Action",
        render: (r) => r.kind.replaceAll("_", " "),
      },
      { key: "description", label: "Description" },
    ],
  };
  const monthly = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(today() + "T00:00:00Z");
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - 5 + i);
    const month = d.toISOString().slice(0, 7);
    const ms = metrics({
      ...state,
      entries: state.entries.filter((e) => e.date.startsWith(month)),
    });
    return {
      month: d.toLocaleDateString("en", { month: "short", timeZone: "UTC" }),
      revenue: ms.revenue / 100,
      profit: ms.profit / 100,
    };
  });
  const backup = () =>
    download(`wrapnwhip-backup-${today()}.json`, JSON.stringify(saved));
  const exportCurrent = () =>
    exportRows(
      rows.map((r) => {
        const x = { ...r };
        for (const k of [
          "price",
          "total",
          "paid",
          "value",
          "amount",
          "credits",
          "refunds",
        ])
          if (typeof x[k] === "number") x[k] = (x[k] / 100).toFixed(2);
        return x;
      }),
      tab,
    );
  function invoice(o: Row) {
    const c = state!.customers.find((c) => c.id === o.party);
    return (
      <div className="invoice">
        <Logo />
        <div className="row">
          <div>
            <h1>Invoice</h1>
            <strong>{o.number}</strong>
          </div>
          <div>
            {o.date}
            <small>{state!.name}</small>
          </div>
        </div>
        <div className="row">
          <div>
            Bill to
            <strong style={{ display: "block", marginTop: 10 }}>
              {o.partyName}
            </strong>
            <small>{c?.address}</small>
            <small>{c?.phone}</small>
          </div>
          <div>
            <Badge value={o.status} />
            <small>{o.tracking}</small>
          </div>
        </div>
        <Table
          columns={[
            { key: "name", label: "Item" },
            { key: "quantity", label: "Qty" },
            {
              key: "price",
              label: "Unit price",
              render: (i) => money(i.price),
            },
            {
              key: "line",
              label: "Total",
              render: (i) => money(i.quantity * i.price),
            },
          ]}
          rows={o.items}
        />
        <div className="row">
          <span>Subtotal</span>
          <strong>{money(o.subtotal)}</strong>
        </div>
        <div className="row">
          <span>Discount</span>
          <span>{money(o.discount)}</span>
        </div>
        <div className="row">
          <span>Shipping</span>
          <span>{money(o.shipping)}</span>
        </div>
        <div className="row">
          <span>Return credits</span>
          <span>{money(o.credits)}</span>
        </div>
        <div className="invoice-total">Total {money(o.total - o.credits)}</div>
        <div className="row">
          <span>Paid, net of refunds</span>
          <span>{money(o.paid - o.refunds)}</span>
        </div>
        <p className="subtle" style={{ marginTop: 25 }}>
          Thank you for choosing {state!.name}.
        </p>
        <div className="actions no-print">
          <button onClick={() => window.print()}>
            <Printer size={15} />
            Print / save PDF
          </button>
        </div>
      </div>
    );
  }
  return (
    <>
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <Logo />
        <nav className="nav" aria-label="Main navigation">
          {sections.map((s) => (
            <div key={s.id}>
              {s.group && <div className="nav-title">{s.group}</div>}
              <button
                className={tab === s.id ? "active" : ""}
                onClick={() => navigate(s.id)}
              >
                <s.icon size={17} />
                {s.label}
                {s.id === "approvals" &&
                  state.approvals.some((a) => a.status === "pending") && (
                    <span className="badge">
                      {
                        state.approvals.filter((a) => a.status === "pending")
                          .length
                      }
                    </span>
                  )}
              </button>
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <ShieldCheck size={13} /> Encrypted on this device
          <br />
          PKR · Asia/Karachi
          <br />
          <button
            className="ghost"
            style={{ fontSize: 11, padding: "6px 0" }}
            onClick={() => navigate("settings")}
          >
            Backups & workspace details
            <ArrowUpRight size={12} />
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="header">
          <button
            className="mobile-menu ghost"
            aria-label="Toggle navigation"
            onClick={() => setMobile(!mobile)}
          >
            <Menu size={19} />
          </button>
          <span className="business">{state.name}</span>
          <span className="save-state">
            <CheckCircle2 size={12} />
            {busy ? "Saving…" : "Saved on this device"}
          </span>
          <button
            className="ghost"
            aria-label="Toggle dark mode"
            onClick={() => {
              setDark(!dark);
              document.body.classList.toggle("dark", !dark);
              localStorage.setItem("wrapnwhip-theme", !dark ? "dark" : "light");
            }}
          >
            {dark ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button onClick={backup} aria-label="Backup">
            <Download size={14} />
            <span className="button-label">Backup</span>
          </button>
          <button
            className="ghost"
            disabled={busy}
            onClick={lock}
            aria-label="Lock"
          >
            <Lock size={15} />
            <span className="button-label">Lock</span>
          </button>
        </header>
        <main className="content">
          <div className="heading">
            <div>
              <span className="eyebrow">YOUR BUSINESS, CLEARLY</span>
              <h1 style={{ marginTop: 9 }}>{selected.label}</h1>
              <p>
                {tab === "dashboard"
                  ? "A thoughtful overview of where your business stands."
                  : tab === "settings"
                    ? "Keep your workspace protected and your records backed up."
                    : "Your real business records. Always in Pakistani rupees."}
              </p>
            </div>
            <div className="actions">
              {(sectionActions[tab] || []).map((name) => (
                <Action
                  key={name}
                  name={name}
                  onClick={() =>
                    open(name, name === "settings" ? { name: state.name } : {})
                  }
                />
              ))}
            </div>
          </div>
          {tab === "dashboard" ? (
            <>
              <div className="welcome">
                <div>
                  <div className="eyebrow" style={{ marginBottom: 10 }}>
                    GROW SOMETHING WONDERFUL
                  </div>
                  <h1>
                    {state.entries.length
                      ? "Welcome back to your business."
                      : "A fresh start for your business."}
                  </h1>
                  <p>
                    {state.entries.length
                      ? "Every thoughtful detail, all in one place."
                      : "Start by adding your partners, products and customers. Your balances begin at zero."}
                  </p>
                </div>
                <Gift size={55} />
              </div>
              <div className="stats">
                {[
                  {
                    label: "Available cash",
                    value: m.cash,
                    icon: Wallet,
                    caption: "Across all financial accounts",
                  },
                  {
                    label: "Sales & income",
                    value: m.revenue,
                    icon: TrendingUp,
                    caption: "Recognized income, not deposits",
                  },
                  {
                    label: "Net business profit",
                    value: m.profit,
                    icon: PieChart,
                    caption: "After costs and expenses",
                  },
                  {
                    label: "Inventory value",
                    value: m.inventory,
                    icon: Package,
                    caption: "Weighted purchase cost",
                  },
                ].map((s) => (
                  <div className="card stat" key={s.label}>
                    <div className="stat-head">
                      {s.label}
                      <s.icon size={17} />
                    </div>
                    <div className="stat-value">{money(s.value)}</div>
                    <small>{s.caption}</small>
                  </div>
                ))}
              </div>
              <div className="grid">
                <section className="card">
                  <div className="card-top">
                    <h2>Your business, month by month</h2>
                    <span className="badge">Last 6 months</span>
                  </div>
                  <div style={{ height: 240, minWidth: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={monthly}>
                        <defs>
                          <linearGradient id="rose" x1="0" y1="0" x2="0" y2="1">
                            <stop
                              offset="0%"
                              stopColor="#873e56"
                              stopOpacity={0.18}
                            />
                            <stop
                              offset="100%"
                              stopColor="#873e56"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="4 4"
                          vertical={false}
                          stroke={dark ? "#36343d" : "#ece8e5"}
                        />
                        <XAxis
                          dataKey="month"
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis axisLine={false} tickLine={false} width={45} />
                        <Tooltip formatter={(v) => money(Number(v) * 100)} />
                        <Area
                          name="Revenue"
                          type="monotone"
                          dataKey="revenue"
                          stroke="#873e56"
                          fill="url(#rose)"
                          strokeWidth={2}
                        />
                        <Area
                          name="Profit"
                          type="monotone"
                          dataKey="profit"
                          stroke="#3e8a71"
                          fill="transparent"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <small className="subtle">Revenue and profit · PKR</small>
                </section>
                <section className="card">
                  <div className="card-top">
                    <h2>Money at a glance</h2>
                    <Wallet size={17} className="subtle" />
                  </div>
                  {state.accounts.map((a) => (
                    <div className="row" key={a.id}>
                      <span>
                        {a.name}
                        <small>{a.type}</small>
                      </span>
                      <strong>{money(balance(state, "cash:" + a.id))}</strong>
                    </div>
                  ))}
                  <div className="row">
                    <span>Customer, COD & supplier receivables</span>
                    <strong>{money(m.receivables)}</strong>
                  </div>
                  <div className="row">
                    <span>Business liabilities</span>
                    <strong>{money(m.liabilities)}</strong>
                  </div>
                </section>
              </div>
              <div className="grid equal">
                <section className="card">
                  <div className="card-top">
                    <h2>Latest orders</h2>
                    <button
                      className="ghost"
                      onClick={() => navigate("orders")}
                    >
                      View all
                      <ArrowUpRight size={13} />
                    </button>
                  </div>
                  {state.orders.slice(0, 4).map((o) => (
                    <div className="row" key={o.id}>
                      <span>
                        {o.number}
                        <small>{o.partyName}</small>
                      </span>
                      <span>
                        {money(o.total)}
                        <small>
                          <Badge value={o.status} />
                        </small>
                      </span>
                    </div>
                  ))}
                  {!state.orders.length && (
                    <div className="empty">
                      <ShoppingBag size={23} />
                      <p>
                        No orders yet. Your next thoughtful gift starts here.
                      </p>
                      <button onClick={() => open("order")}>
                        Create your first order
                      </button>
                    </div>
                  )}
                </section>
                <section className="card">
                  <div className="card-top">
                    <h2>Needs a little attention</h2>
                    <span className="badge">{lows.length}</span>
                  </div>
                  {lows.slice(0, 5).map((p) => (
                    <div className="row" key={p.id}>
                      <span>
                        {p.name}
                        <small>{p.sku}</small>
                      </span>
                      <span className="negative">
                        {p.quantity - reserved(state, p.id)} available
                      </span>
                    </div>
                  ))}
                  {!lows.length && (
                    <div className="empty">
                      <CheckCircle2 size={24} />
                      <p>
                        {state.products.length
                          ? "Your stock levels look healthy."
                          : "Add products to track inventory and low stock."}
                      </p>
                    </div>
                  )}
                </section>
              </div>
            </>
          ) : tab === "settings" ? (
            <>
              <div className="settings-grid">
                <section className="card">
                  <h2>Your workspace</h2>
                  <div className="row">
                    <span>Business</span>
                    <strong>{state.name}</strong>
                  </div>
                  <div className="row">
                    <span>Currency</span>
                    <span>Pakistani rupee · PKR</span>
                  </div>
                  <div className="row">
                    <span>Time zone</span>
                    <span>Asia/Karachi</span>
                  </div>
                  <div className="row">
                    <span>Last closed period</span>
                    <span>{state.closedThrough || "No closed periods"}</span>
                  </div>
                  <div className="row">
                    <span>Saved changes</span>
                    <span>{state.revision}</span>
                  </div>
                </section>
                <section className="card">
                  <h2>Keep a safe copy</h2>
                  <p>
                    Download an encrypted backup regularly. Restore it on
                    another device using the same password. Clearing this
                    browser’s storage or losing your password can make records
                    unrecoverable.
                  </p>
                  <div className="actions">
                    <button className="primary" onClick={backup}>
                      <Download size={15} />
                      Download encrypted backup
                    </button>
                    <button onClick={() => backupInput.current?.click()}>
                      <Upload size={15} />
                      Restore backup
                    </button>
                  </div>
                  {error && <div className="error">{error}</div>}
                </section>
                <section className="card">
                  <h2>A simple, protected site</h2>
                  <p>
                    Your password encrypts records using AES-GCM. It stays on
                    this device and is never sent to GitHub or Vercel. The
                    workspace locks after five minutes without activity.
                  </p>
                  <p>
                    There is no email recovery. Store your password somewhere
                    safe. A public website link can be discovered; it is not a
                    secret.
                  </p>
                  <button onClick={lock}>
                    <LogOut size={15} />
                    Lock workspace
                  </button>
                </section>
                <section className="card">
                  <h2>Where your records live</h2>
                  <p>
                    <strong>This browser stores your encrypted records.</strong>{" "}
                    GitHub stores the website’s code, and Vercel or GitHub Pages
                    hosts the site. Business records are not uploaded to a
                    public repository.
                  </p>
                  <p>
                    Different browsers and devices have separate workspaces.
                    Share an encrypted backup when you need to move records.
                    Simultaneous shared editing requires a private backend and
                    is not enabled here.
                  </p>
                </section>
              </div>
            </>
          ) : tab === "reports" ? (
            <>
              <div className="filters">
                <label htmlFor="from">From</label>
                <input
                  id="from"
                  type="date"
                  value={from}
                  max={to}
                  onChange={(e) => setFrom(e.target.value)}
                  style={{ flex: "initial", width: 160 }}
                />
                <label htmlFor="to">To</label>
                <input
                  id="to"
                  type="date"
                  value={to}
                  min={from}
                  max={today()}
                  onChange={(e) => setTo(e.target.value)}
                  style={{ flex: "initial", width: 160 }}
                />
                <button onClick={() => window.print()}>
                  <Printer size={14} />
                  Print / PDF
                </button>
              </div>
              <div className="report-tabs">
                {[
                  ["profit", "Profit & loss"],
                  ["balance", "Balance sheet"],
                  ["cash", "Cash & accounts"],
                  ["inventory", "Inventory"],
                  ["sales", "Sales"],
                  ["expenses", "Expenses"],
                  ["journal", "Journal"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    className={report === key ? "primary" : ""}
                    onClick={() => {
                      setReport(key);
                      setPage(1);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {["profit", "balance", "cash"].includes(report) ? (
                <div className="card">
                  <h2>
                    {report === "profit"
                      ? "Profit & loss"
                      : report === "balance"
                        ? "Balance sheet · current balances"
                        : "Cash & accounts · current balances"}
                  </h2>
                  {(report === "profit"
                    ? [
                        ["Sales & other income", pm.revenue],
                        ["Cost of goods sold", pm.cogs],
                        ["Operating expenses", pm.expenses],
                        ["Net profit", pm.profit],
                      ]
                    : report === "cash"
                      ? state.accounts.map((a) => [
                          a.name,
                          balance(state, "cash:" + a.id),
                        ])
                      : [
                          ["Cash & bank", m.cash],
                          [
                            "Customer, COD & supplier receivables",
                            m.receivables,
                          ],
                          ["Inventory", m.inventory],
                          ["Business liabilities", m.liabilities],
                          ["Partner capital", -totalCodes(state, "capital:")],
                          ["Opening equity", -balance(state, "opening")],
                          [
                            "Retained profit after distributions",
                            m.profit - balance(state, "distribution"),
                          ],
                        ]
                  ).map(([name, value]) => (
                    <div className="row" key={String(name)}>
                      <span>{String(name)}</span>
                      <strong>{money(Number(value))}</strong>
                    </div>
                  ))}
                  <div className="actions no-print" style={{ marginTop: 20 }}>
                    <button
                      onClick={() =>
                        exportRows(
                          (report === "profit"
                            ? [
                                ["Revenue", pm.revenue],
                                ["COGS", pm.cogs],
                                ["Expenses", pm.expenses],
                                ["Net profit", pm.profit],
                              ]
                            : report === "cash"
                              ? state.accounts.map((a) => [
                                  a.name,
                                  balance(state, "cash:" + a.id),
                                ])
                              : [
                                  [
                                    "Assets",
                                    m.cash + m.inventory + m.receivables,
                                  ],
                                  ["Liabilities", m.liabilities],
                                  [
                                    "Equity",
                                    -totalCodes(state, "capital:") -
                                      balance(state, "opening") +
                                      m.profit -
                                      balance(state, "distribution"),
                                  ],
                                ]
                          ).map(([name, n]) => ({
                            name,
                            PKR: Number(n) / 100,
                          })),
                          report,
                        )
                      }
                    >
                      <Download size={14} />
                      Export CSV
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="actions" style={{ marginBottom: 15 }}>
                    <button onClick={exportCurrent}>
                      <Download size={14} />
                      Export CSV
                    </button>
                  </div>
                  <Table
                    columns={
                      report === "inventory"
                        ? columns.products
                        : report === "sales"
                          ? columns.orders
                          : columns.transactions
                    }
                    rows={pageRows}
                    onRow={(r) =>
                      setDetail({
                        type:
                          report === "sales"
                            ? "orders"
                            : report === "inventory"
                              ? "products"
                              : "transactions",
                        row: r,
                      })
                    }
                  />
                </>
              )}
            </>
          ) : (
            <>
              {tab === "partners" && (
                <div className="note">
                  <strong>
                    Available for distribution: {money(m.available)}.
                  </strong>{" "}
                  Capital, reimbursement and profit are tracked separately. Add
                  three partners before recording their approval decisions.
                </div>
              )}
              {tab === "approvals" && (
                <div className="note">
                  Approval records are a bookkeeping record of decisions made by
                  your partners. This password-protected, single-device site
                  does not verify separate partner identities.
                </div>
              )}
              <div className="filters">
                <Search size={17} className="subtle" />
                <input
                  aria-label="Search records"
                  placeholder={`Search ${selected.label.toLowerCase()}…`}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
                {["orders", "purchases", "approvals"].includes(tab) && (
                  <select
                    aria-label="Filter status"
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">All statuses</option>
                    {Array.from(new Set(rows.map((r) => r.status))).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                )}
                <button onClick={exportCurrent}>
                  <Download size={14} />
                  CSV
                </button>
                <button onClick={() => window.print()}>
                  <Printer size={14} />
                  Print
                </button>
              </div>
              <Table
                columns={columns[tab] || []}
                rows={pageRows}
                onRow={(r) => setDetail({ type: tab, row: r })}
              />
              <div className="pagination">
                <span>
                  {filtered.length} records · Page {page} of{" "}
                  {Math.max(1, Math.ceil(filtered.length / 20))}
                </span>
                <button disabled={page === 1} onClick={() => setPage(page - 1)}>
                  Previous
                </button>
                <button
                  disabled={page * 20 >= filtered.length}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </button>
              </div>
            </>
          )}
        </main>
      </div>
      {form && (
        <Form
          operation={form.operation}
          state={state}
          initial={form.initial}
          busy={busy}
          onClose={() => setForm(null)}
          onSave={(d) => save(form.operation, d)}
        />
      )}
      {detail && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Record details"
          >
            <div className="modal-title">
              <h2>
                {detail.row.number ||
                  detail.row.name ||
                  detail.row.description ||
                  "Record details"}
              </h2>
              <button
                aria-label="Close details"
                onClick={() => setDetail(null)}
              >
                <X size={17} />
              </button>
            </div>
            {detail.type === "orders" ? (
              <>
                {invoice(detail.row)}
                <div className="actions no-print" style={{ marginTop: 20 }}>
                  {detail.row.status !== "cancelled" && (
                    <>
                      <button
                        onClick={() =>
                          open("order_status", { order: detail.row.id })
                        }
                      >
                        Update status
                      </button>
                      <button
                        onClick={() =>
                          open("order_payment", { order: detail.row.id })
                        }
                      >
                        Record payment
                      </button>
                      {detail.row.cod && (
                        <button
                          onClick={() =>
                            open("cod_settlement", { order: detail.row.id })
                          }
                        >
                          COD settlement
                        </button>
                      )}
                      <button
                        onClick={() => open("return", { order: detail.row.id })}
                      >
                        Return items
                      </button>
                      <button
                        onClick={() => open("refund", { order: detail.row.id })}
                      >
                        Refund
                      </button>
                    </>
                  )}
                </div>
              </>
            ) : detail.type === "purchases" ? (
              <>
                <div className="note">
                  Supplier: {detail.row.partyName} ·{" "}
                  <Badge value={detail.row.status} />
                </div>
                <Table
                  columns={[
                    { key: "name", label: "Item" },
                    { key: "quantity", label: "Quantity" },
                    {
                      key: "price",
                      label: "Unit cost",
                      render: (r) => money(r.price),
                    },
                  ]}
                  rows={detail.row.items}
                />
                <div className="row">
                  <span>Total</span>
                  <strong>{money(detail.row.total)}</strong>
                </div>
                <div className="row">
                  <span>Paid</span>
                  <strong>{money(detail.row.paid)}</strong>
                </div>
                <div className="row">
                  <span>Return credits</span>
                  <strong>{money(detail.row.credits)}</strong>
                </div>
                <div className="row">
                  <span>Supplier refund receivable</span>
                  <strong>
                    {money(balance(state, "vendor_ar:" + detail.row.id))}
                  </strong>
                </div>
                <div className="actions" style={{ marginTop: 20 }}>
                  <button
                    onClick={() =>
                      open("purchase_receive", { purchase: detail.row.id })
                    }
                    disabled={detail.row.status !== "draft"}
                  >
                    Receive purchase
                  </button>
                  <button
                    onClick={() =>
                      open("purchase_payment", { purchase: detail.row.id })
                    }
                  >
                    Pay bill
                  </button>
                </div>
              </>
            ) : detail.type === "transactions" ? (
              <>
                <div className="note">
                  {detail.row.date} · {detail.row.kind.replaceAll("_", " ")}
                </div>
                <Table
                  columns={[
                    { key: "code", label: "Ledger account" },
                    {
                      key: "debit",
                      label: "Debit",
                      render: (r) => money(r.debit),
                    },
                    {
                      key: "credit",
                      label: "Credit",
                      render: (r) => money(r.credit),
                    },
                  ]}
                  rows={detail.row.lines}
                />
              </>
            ) : (
              <>
                {Object.entries(detail.row)
                  .filter(
                    ([k]) => !["id", "votes", "items", "lines"].includes(k),
                  )
                  .map(([k, v]) => (
                    <div className="row" key={k}>
                      <span className="subtle">{k.replaceAll("_", " ")}</span>
                      <span>
                        {["amount", "price", "value"].includes(k)
                          ? money(Number(v))
                          : String(v ?? "—")}
                      </span>
                    </div>
                  ))}
                {["customers", "suppliers", "partners", "accounts"].includes(
                  detail.type,
                ) && (
                  <div className="actions" style={{ marginTop: 20 }}>
                    <button
                      onClick={() =>
                        open(
                          detail.type === "customers"
                            ? "customer_edit"
                            : detail.type === "suppliers"
                              ? "supplier_edit"
                              : detail.type === "partners"
                                ? "partner_edit"
                                : "account_edit",
                          { ...detail.row, record: detail.row.id },
                        )
                      }
                    >
                      Edit record
                    </button>
                  </div>
                )}
                {detail.type === "products" && (
                  <div className="actions" style={{ marginTop: 20 }}>
                    <button
                      onClick={() =>
                        open("product_edit", {
                          product: detail.row.id,
                          name: detail.row.name,
                          category: detail.row.category,
                          price: detail.row.price / 100,
                          reorder: detail.row.reorder,
                          active: detail.row.active,
                        })
                      }
                    >
                      Edit product
                    </button>
                    <button
                      onClick={() => open("loss", { product: detail.row.id })}
                    >
                      Record loss
                    </button>
                  </div>
                )}
                {detail.type === "approvals" &&
                  detail.row.status === "pending" && (
                    <div className="actions" style={{ marginTop: 20 }}>
                      <button
                        onClick={() =>
                          open("approve", { approval: detail.row.id })
                        }
                      >
                        Record approval
                      </button>
                      <button
                        className="danger"
                        onClick={() =>
                          open("reject", { approval: detail.row.id })
                        }
                      >
                        Record rejection
                      </button>
                    </div>
                  )}
              </>
            )}
          </section>
        </div>
      )}
      {fileInput}
      {restoreDialog}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}
