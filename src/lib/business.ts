export type Row = Record<string, any>;
export type Line = { code: string; debit: number; credit: number };
export type Entry = {
  id: string;
  date: string;
  kind: string;
  description: string;
  lines: Line[];
};
export type Workspace = {
  version: 1;
  revision: number;
  name: string;
  closedThrough: string;
  accounts: Row[];
  partners: Row[];
  products: Row[];
  customers: Row[];
  suppliers: Row[];
  orders: Row[];
  purchases: Row[];
  entries: Entry[];
  approvals: Row[];
  budgets: Row[];
  activity: Row[];
};
export const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(
    new Date(),
  );
export const id = () => crypto.randomUUID();
export const money = (n: number) =>
  new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 2,
  }).format((n === 0 ? 0 : n) / 100);
export function minor(v: unknown) {
  const x = String(v ?? "");
  if (!/^\d+(\.\d{1,2})?$/.test(x))
    throw Error("Enter a positive amount with up to two decimal places.");
  const [a, b = ""] = x.split(".");
  return amount(Number(a) * 100 + Number(b.padEnd(2, "0")));
}
function amount(n: number, zero = true) {
  if (!Number.isSafeInteger(n) || n < 0 || n > 9e12 || (!zero && n === 0))
    throw Error("Invalid amount.");
  return n;
}
function quantity(n: unknown) {
  const q = Number(n);
  if (!Number.isSafeInteger(q) || q < 1 || q > 1e6)
    throw Error("Quantity must be a positive whole number.");
  return q;
}
const text = (v: unknown) =>
  String(v ?? "")
    .trim()
    .slice(0, 2000);
export function empty(): Workspace {
  return {
    version: 1,
    revision: 0,
    name: "Wrap n Whip",
    closedThrough: "",
    accounts: [
      { id: "cash", name: "Cash", type: "cash" },
      { id: "bank", name: "Bank", type: "bank" },
      { id: "jazzcash", name: "JazzCash", type: "wallet" },
      { id: "easypaisa", name: "Easypaisa", type: "wallet" },
    ],
    partners: [],
    products: [],
    customers: [],
    suppliers: [],
    orders: [],
    purchases: [],
    entries: [],
    approvals: [],
    budgets: [],
    activity: [],
  };
}
export function balance(s: Workspace, code: string) {
  return s.entries
    .flatMap((e) => e.lines)
    .filter((l) => l.code === code)
    .reduce((n, l) => n + l.debit - l.credit, 0);
}
export function totalCodes(s: Workspace, prefix: string) {
  return s.entries
    .flatMap((e) => e.lines)
    .filter((l) => l.code.startsWith(prefix))
    .reduce((n, l) => n + l.debit - l.credit, 0);
}
export function reserved(s: Workspace, pid: string) {
  return s.orders
    .filter((o) =>
      ["confirmed", "preparing", "packed", "shipped"].includes(o.status),
    )
    .flatMap((o) => o.items)
    .filter((i) => i.product === pid)
    .reduce((n, i) => n + i.quantity, 0);
}
export function metrics(s: Workspace) {
  const revenue = -totalCodes(s, "sales") - totalCodes(s, "income") || 0;
  const expenses = totalCodes(s, "expense");
  const cogs = totalCodes(s, "cogs");
  const cash = totalCodes(s, "cash:");
  const liabilities =
    -totalCodes(s, "ap:") -
      totalCodes(s, "deposit:") -
      totalCodes(s, "payable:") -
      totalCodes(s, "refund:") -
      totalCodes(s, "loan") || 0;
  const profit = revenue - expenses - cogs;
  return {
    revenue,
    expenses,
    cogs,
    profit,
    cash,
    inventory: balance(s, "inventory"),
    receivables:
      totalCodes(s, "ar:") +
      totalCodes(s, "cod:") +
      totalCodes(s, "vendor_ar:"),
    liabilities,
    available: Math.max(
      0,
      Math.min(profit - balance(s, "distribution"), cash - liabilities),
    ),
  };
}
function find(rows: Row[], key: unknown) {
  const x = rows.find((r) => r.id === key);
  if (!x) throw Error("Select an existing record.");
  return x;
}
function post(
  s: Workspace,
  kind: string,
  description: string,
  lines: Line[],
  date = today(),
) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date)) ||
    date > today() ||
    date <= s.closedThrough
  )
    throw Error("Choose an open date no later than today.");
  if (
    lines.some(
      (l) =>
        !Number.isSafeInteger(l.debit) ||
        !Number.isSafeInteger(l.credit) ||
        l.debit < 0 ||
        l.credit < 0 ||
        l.debit > 9e12 ||
        l.credit > 9e12,
    )
  )
    throw Error("Invalid journal amount.");
  if (lines.reduce((n, l) => n + l.debit - l.credit, 0) !== 0)
    throw Error("Journal must balance.");
  if (!lines.some((l) => l.debit || l.credit))
    throw Error("Amount must be greater than zero.");
  for (const code of new Set(lines.map((l) => l.code))) {
    const n =
      balance(s, code) +
      lines
        .filter((l) => l.code === code)
        .reduce((n, l) => n + l.debit - l.credit, 0);
    if (!Number.isSafeInteger(n) || Math.abs(n) > 9e12)
      throw Error("Ledger balance exceeds the supported limit.");
  }
  s.entries.unshift({
    id: id(),
    date,
    kind,
    description,
    lines: lines.filter((l) => l.debit || l.credit),
  });
}
const dr = (code: string, n: number): Line => ({ code, debit: n, credit: 0 });
const cr = (code: string, n: number): Line => ({ code, debit: 0, credit: n });
function cashCode(s: Workspace, key: unknown, n = 0) {
  const account = find(s.accounts, key);
  const code = "cash:" + account.id;
  if (balance(s, code) < n)
    throw Error("This account does not have enough money.");
  return code;
}
function stockDate(s: Workspace, date: string) {
  if (date <= s.closedThrough)
    throw Error("This stock date is in a closed period.");
  if (
    s.activity.some(
      (e) =>
        [
          "delivery",
          "purchase_receive",
          "return",
          "loss",
          "supplier_return",
          "stock_opening",
        ].includes(e.kind) && e.date > date,
    )
  )
    throw Error("Record stock movements in chronological order.");
}
function consume(p: Row, q: number) {
  if (q > p.quantity) throw Error("Not enough inventory.");
  const value =
    q === p.quantity ? p.value : Math.floor((p.value * q) / p.quantity);
  p.quantity -= q;
  p.value -= value;
  return value;
}
export function allocate(total: number, weights: number[]) {
  const sum = weights.reduce((n, w) => n + BigInt(w), 0n);
  if (!sum) return weights.map(() => 0);
  const rows = weights.map((w, i) => ({
    i,
    value: Number((BigInt(total) * BigInt(w)) / sum),
    remainder: (BigInt(total) * BigInt(w)) % sum,
  }));
  let left = total - rows.reduce((n, r) => n + r.value, 0);
  const sorted = [...rows].sort((a, b) =>
    a.remainder === b.remainder
      ? a.i - b.i
      : a.remainder > b.remainder
        ? -1
        : 1,
  );
  for (let i = 0; left > 0; i++, left--) sorted[i].value++;
  return rows.map((r) => r.value);
}
export function operate(
  original: Workspace,
  kind: string,
  data: Row,
): Workspace {
  const s = structuredClone(original);
  const date = text(data.date) || today();
  const note = text(data.description) || kind.replaceAll("_", " ");
  let result = "";
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date)) ||
    date > today()
  )
    throw Error("Choose a valid date no later than today.");
  if (
    ["customer", "supplier", "partner", "product", "account"].includes(kind)
  ) {
    const table =
      kind === "customer"
        ? s.customers
        : kind === "supplier"
          ? s.suppliers
          : kind === "partner"
            ? s.partners
            : kind === "product"
              ? s.products
              : s.accounts;
    if (!text(data.name)) throw Error("Name is required.");
    if (kind === "partner" && table.length >= 3)
      throw Error("This workspace supports three partners.");
    if (kind === "product" && s.products.some((p) => p.sku === text(data.sku)))
      throw Error("SKU must be unique.");
    const record = {
      id: id(),
      name: text(data.name),
      phone: text(data.phone),
      email: text(data.email),
      notes: text(data.notes),
      address: text(data.address),
    };
    if (kind === "product")
      Object.assign(record, {
        sku: text(data.sku) || id().slice(0, 8),
        category: text(data.category) || "Giftware",
        price: minor(data.price),
        quantity: 0,
        value: 0,
        reorder: Number(data.reorder) || 3,
        active: true,
      });
    if (kind === "partner")
      Object.assign(record, { ratio: quantity(data.ratio || 1) });
    if (kind === "account")
      Object.assign(record, { type: text(data.type) || "bank" });
    table.push(record);
    result = record.id;
  } else if (
    ["customer_edit", "supplier_edit", "partner_edit", "account_edit"].includes(
      kind,
    )
  ) {
    const table =
      kind === "customer_edit"
        ? s.customers
        : kind === "supplier_edit"
          ? s.suppliers
          : kind === "partner_edit"
            ? s.partners
            : s.accounts;
    const record = find(table, data.record);
    if (!text(data.name)) throw Error("Name is required.");
    record.name = text(data.name);
    if (kind !== "account_edit")
      Object.assign(record, {
        email: text(data.email),
        phone: text(data.phone),
        address: text(data.address),
        notes: text(data.notes),
      });
  } else if (kind === "product_edit") {
    const p = find(s.products, data.product);
    if (!text(data.name)) throw Error("Name is required.");
    Object.assign(p, {
      name: text(data.name),
      price: minor(data.price),
      category: text(data.category) || p.category,
      reorder: Number(data.reorder) || 0,
      active: data.active !== false,
    });
  } else if (
    [
      "income",
      "expense",
      "investment",
      "opening",
      "loan",
      "loan_pay",
      "partner_expense",
      "reimbursement",
      "transfer",
    ].includes(kind)
  ) {
    const n = amount(minor(data.amount), false);
    let lines: Line[] = [];
    if (kind === "transfer") {
      if (data.account === data.destination)
        throw Error("Choose two different accounts.");
      const fee = minor(data.fee || 0);
      lines = [
        dr(cashCode(s, data.destination), n),
        dr("expense:Bank fees", fee),
        cr(cashCode(s, data.account, n + fee), n + fee),
      ];
    }
    if (kind === "income" || kind === "loan" || kind === "opening") {
      if (
        kind === "opening" &&
        s.entries.some(
          (e) =>
            e.kind === "opening" &&
            e.lines.some((l) => l.code === "cash:" + data.account),
        )
      )
        throw Error("Opening balance already recorded for this account.");
      lines = [
        dr(cashCode(s, data.account), n),
        cr(
          kind === "income" ? "income" : kind === "loan" ? "loan" : "opening",
          n,
        ),
      ];
    }
    if (kind === "expense")
      lines = [
        dr("expense:" + text(data.category || "General"), n),
        cr(cashCode(s, data.account, n), n),
      ];
    if (kind === "loan_pay") {
      if (-balance(s, "loan") < n)
        throw Error("Repayment exceeds the outstanding loan.");
      lines = [dr("loan", n), cr(cashCode(s, data.account, n), n)];
    }
    if (kind === "investment") {
      const p = find(s.partners, data.partner);
      lines = [dr(cashCode(s, data.account), n), cr("capital:" + p.id, n)];
    }
    if (kind === "partner_expense") {
      const p = find(s.partners, data.partner);
      lines = [
        dr("expense:" + text(data.category || "General"), n),
        cr("payable:" + p.id, n),
      ];
    }
    if (kind === "reimbursement") {
      const p = find(s.partners, data.partner);
      if (-balance(s, "payable:" + p.id) < n)
        throw Error("Reimbursement exceeds the amount owed.");
      lines = [dr("payable:" + p.id, n), cr(cashCode(s, data.account, n), n)];
    }
    post(s, kind, note, lines, date);
  } else if (kind === "order" || kind === "purchase") {
    const party = find(
      kind === "order" ? s.customers : s.suppliers,
      data.party,
    );
    if (!Array.isArray(data.items) || !data.items.length)
      throw Error("Add at least one item.");
    const ids = new Set();
    const items = data.items.map((i: Row) => {
      const p = find(s.products, i.product);
      if (!p.active) throw Error("This product is inactive.");
      if (ids.has(p.id)) throw Error("Combine duplicate products in one item.");
      ids.add(p.id);
      return {
        product: p.id,
        name: p.name,
        sku: p.sku,
        quantity: quantity(i.quantity),
        price: minor(i.price),
        returned: 0,
        returnedCost: 0,
        cost: 0,
      };
    });
    const subtotal = items.reduce(
      (n: number, i: Row) => n + i.quantity * i.price,
      0,
    );
    const discount = kind === "order" ? minor(data.discount || 0) : 0;
    const shipping = kind === "order" ? minor(data.shipping || 0) : 0;
    if (discount > subtotal) throw Error("Discount exceeds the item subtotal.");
    const shares = allocate(
      subtotal - discount,
      items.map((i: Row) => i.price * i.quantity),
    );
    items.forEach((i: Row, index: number) => {
      i.net = shares[index];
      i.returnedCredit = 0;
    });
    const n = amount(subtotal - discount + shipping, false);
    const record = {
      id: id(),
      number:
        (kind === "order" ? "WNW-" : "PO-") +
        String((kind === "order" ? s.orders : s.purchases).length + 1).padStart(
          4,
          "0",
        ),
      party: party.id,
      partyName: party.name,
      date,
      items,
      subtotal,
      discount,
      shipping,
      total: n,
      paid: 0,
      refunds: 0,
      credits: 0,
      status: "draft",
      cod: !!data.cod,
      tracking: "",
      notes: text(data.notes),
    };
    (kind === "order" ? s.orders : s.purchases).unshift(record);
    result = record.id;
  } else if (kind === "order_status") {
    const o = find(s.orders, data.order);
    const next = text(data.status);
    const transitions: Record<string, string[]> = {
      draft: ["confirmed", "cancelled"],
      confirmed: ["preparing", "cancelled"],
      preparing: ["packed", "cancelled"],
      packed: ["shipped", "cancelled"],
      shipped: ["delivered"],
      delivered: [],
      cancelled: [],
    };
    if (!transitions[o.status]?.includes(next))
      throw Error("Invalid order status change.");
    if (next === "cancelled" && o.paid > 0)
      throw Error("Refund the deposit before cancelling.");
    if (next === "confirmed")
      for (const item of o.items) {
        const p = find(s.products, item.product);
        if (item.quantity > p.quantity - reserved(s, p.id))
          throw Error(`${p.name}: not enough available stock.`);
      }
    if (next === "shipped") {
      if (!text(data.tracking))
        throw Error("Tracking or collection reference is required.");
      o.tracking = text(data.tracking);
    }
    if (next === "delivered") {
      stockDate(s, date);
      let cost = 0;
      for (const item of o.items) {
        const p = find(s.products, item.product);
        item.cost = consume(p, item.quantity);
        cost += item.cost;
      }
      post(
        s,
        "delivery",
        o.number,
        [
          dr("deposit:" + o.id, o.paid),
          dr((o.cod ? "cod:" : "ar:") + o.id, o.total - o.paid),
          cr("sales", o.total),
          dr("cogs", cost),
          cr("inventory", cost),
        ],
        date,
      );
    }
    o.status = next;
  } else if (kind === "order_payment" || kind === "cod_settlement") {
    const o = find(s.orders, data.order);
    if (o.status === "cancelled") throw Error("This order was cancelled.");
    const n = amount(minor(data.amount), false);
    if (n > o.total - o.credits - o.paid)
      throw Error("Payment exceeds the remaining balance.");
    const fee = kind === "cod_settlement" ? minor(data.fee || 0) : 0;
    if (fee > n) throw Error("Fee exceeds the settlement.");
    if (kind === "cod_settlement" && (!o.cod || o.status !== "delivered"))
      throw Error("Select a delivered COD order.");
    if (kind === "order_payment" && o.cod && o.status === "delivered")
      throw Error("Use COD settlement for this order.");
    post(
      s,
      kind,
      o.number,
      [
        dr(cashCode(s, data.account), n - fee),
        dr("expense:Courier fees", fee),
        cr(
          (o.status === "delivered" ? (o.cod ? "cod:" : "ar:") : "deposit:") +
            o.id,
          n,
        ),
      ],
      date,
    );
    o.paid += n;
  } else if (kind === "purchase_receive") {
    const p = find(s.purchases, data.purchase);
    if (p.status !== "draft")
      throw Error("This purchase has already been received.");
    stockDate(s, date);
    for (const i of p.items) {
      const item = find(s.products, i.product);
      item.quantity += i.quantity;
      item.value += i.price * i.quantity;
      item.hasStockHistory = true;
    }
    post(
      s,
      kind,
      p.number,
      [dr("inventory", p.total), cr("ap:" + p.party, p.total)],
      date,
    );
    p.status = "received";
  } else if (kind === "stock_opening") {
    const p = find(s.products, data.product);
    if (p.hasStockHistory)
      throw Error("Opening stock is allowed only before any stock movements.");
    stockDate(s, date);
    const q = quantity(data.quantity);
    const value = amount(q * minor(data.cost));
    p.quantity = q;
    p.value = value;
    p.hasStockHistory = true;
    if (value)
      post(s, kind, note, [dr("inventory", value), cr("opening", value)], date);
  } else if (kind === "partner_purchase_payment") {
    const p = find(s.purchases, data.purchase);
    const partner = find(s.partners, data.partner);
    const n = amount(minor(data.amount), false);
    if (p.status !== "received" || n > p.total - p.credits - p.paid)
      throw Error("Amount exceeds this received bill.");
    post(
      s,
      kind,
      p.number,
      [dr("ap:" + p.party, n), cr("payable:" + partner.id, n)],
      date,
    );
    p.paid += n;
  } else if (kind === "supplier_return") {
    const p = find(s.purchases, data.purchase);
    if (p.status !== "received") throw Error("Receive the purchase first.");
    const item = p.items.find((i: Row) => i.product === data.product);
    if (!item) throw Error("Select a product from this purchase.");
    const q = quantity(data.quantity);
    if (q > item.quantity - item.returned)
      throw Error("Return exceeds received quantity.");
    const product = find(s.products, item.product);
    if (q > product.quantity - reserved(s, product.id))
      throw Error("Not enough unreserved stock.");
    stockDate(s, date);
    const credit = item.price * q;
    const cost = consume(product, q);
    const payable = Math.min(credit, Math.max(0, p.total - p.credits - p.paid));
    const lines = [
      dr("ap:" + p.party, payable),
      dr("vendor_ar:" + p.id, credit - payable),
      cr("inventory", cost),
    ];
    if (cost > credit)
      lines.push(dr("expense:Supplier return variance", cost - credit));
    else if (credit > cost) lines.push(cr("income", credit - cost));
    if (cost || credit) post(s, kind, p.number, lines, date);
    item.returned += q;
    p.credits += credit;
  } else if (kind === "supplier_refund") {
    const p = find(s.purchases, data.purchase);
    const n = amount(minor(data.amount), false);
    if (n > balance(s, "vendor_ar:" + p.id))
      throw Error("Refund exceeds the supplier receivable.");
    post(
      s,
      kind,
      p.number,
      [dr(cashCode(s, data.account), n), cr("vendor_ar:" + p.id, n)],
      date,
    );
    p.refunds += n;
  } else if (kind === "purchase_payment") {
    const p = find(s.purchases, data.purchase);
    if (p.status !== "received") throw Error("Receive the purchase first.");
    const n = amount(minor(data.amount), false);
    if (n > p.total - p.credits - p.paid)
      throw Error("Payment exceeds this bill.");
    post(
      s,
      kind,
      p.number,
      [dr("ap:" + p.party, n), cr(cashCode(s, data.account, n), n)],
      date,
    );
    p.paid += n;
  } else if (kind === "loss") {
    const p = find(s.products, data.product);
    const q = quantity(data.quantity);
    if (q > p.quantity - reserved(s, p.id))
      throw Error("Not enough unreserved stock.");
    stockDate(s, date);
    const value = consume(p, q);
    if (value)
      post(
        s,
        kind,
        note,
        [dr("expense:Stock loss", value), cr("inventory", value)],
        date,
      );
  } else if (kind === "return") {
    const o = find(s.orders, data.order);
    if (o.status !== "delivered")
      throw Error("Only delivered items can be returned.");
    if (o.cod && o.paid < o.total)
      throw Error("Settle COD before recording a return.");
    const i = find(
      o.items.map((x: Row) => ({ ...x, id: x.product })),
      data.product,
    );
    const item = o.items.find((x: Row) => x.product === i.product);
    const q = quantity(data.quantity);
    if (q > item.quantity - item.returned)
      throw Error("Return exceeds delivered units.");
    stockDate(s, date);
    const p = find(s.products, item.product);
    const cost =
      q === item.quantity - item.returned
        ? item.cost - item.returnedCost
        : Math.floor((item.cost * q) / item.quantity);
    const credit =
      q === item.quantity - item.returned
        ? item.net - item.returnedCredit
        : Math.floor((item.net * q) / item.quantity);
    const due = Math.max(0, o.total - o.credits - o.paid);
    const ar = Math.min(due, credit);
    const refund = credit - ar;
    if (cost || credit)
      post(
        s,
        kind,
        o.number,
        [
          dr("sales", credit),
          cr("ar:" + o.id, ar),
          cr("refund:" + o.id, refund),
          dr("inventory", cost),
          cr("cogs", cost),
        ],
        date,
      );
    p.quantity += q;
    p.value += cost;
    item.returned += q;
    item.returnedCost += cost;
    item.returnedCredit += credit;
    o.credits += credit;
  } else if (kind === "refund") {
    const o = find(s.orders, data.order);
    const n = amount(minor(data.amount), false);
    if (o.status === "delivered") {
      if (n > -balance(s, "refund:" + o.id))
        throw Error("Record the returned items before refunding.");
      post(
        s,
        kind,
        o.number,
        [dr("refund:" + o.id, n), cr(cashCode(s, data.account, n), n)],
        date,
      );
      o.refunds += n;
    } else {
      if (n > o.paid) throw Error("Refund exceeds the deposit.");
      post(
        s,
        kind,
        o.number,
        [dr("deposit:" + o.id, n), cr(cashCode(s, data.account, n), n)],
        date,
      );
      o.paid -= n;
    }
  } else if (kind === "request_withdrawal" || kind === "request_distribution") {
    const n = amount(minor(data.amount), false);
    if (s.partners.length !== 3)
      throw Error("Add all three partners before requesting payouts.");
    cashCode(s, data.account, n);
    if (kind === "request_withdrawal") {
      const p = find(s.partners, data.partner);
      if (n > -balance(s, "capital:" + p.id))
        throw Error("Withdrawal exceeds partner capital.");
    } else if (s.partners.length !== 3 || n > metrics(s).available)
      throw Error(
        "Distribution exceeds available profit or three partners are not set up.",
      );
    s.approvals.unshift({
      id: id(),
      kind,
      partner: data.partner || "",
      account: data.account,
      amount: n,
      description: note,
      date,
      status: "pending",
      votes: [],
      allocations:
        kind === "request_distribution"
          ? allocate(
              n,
              s.partners.map((p) => p.ratio),
            ).map((value, index) => ({
              partner: s.partners[index].id,
              amount: value,
            }))
          : [],
    });
  } else if (kind === "approve" || kind === "reject") {
    const a = find(s.approvals, data.approval);
    if (a.status !== "pending")
      throw Error("This decision is already complete.");
    const p = find(s.partners, data.partner);
    if (a.votes.includes(p.id))
      throw Error("This partner decision is already recorded.");
    if (a.partner === p.id)
      throw Error("Record a decision from a different partner.");
    if (kind === "reject") {
      a.status = "rejected";
      a.rejectedBy = p.id;
    } else {
      a.votes.push(p.id);
      if (
        a.votes.length >= Math.min(2, s.partners.length - (a.partner ? 1 : 0))
      ) {
        const code = cashCode(s, a.account, a.amount);
        let lines: Line[] = [];
        if (a.kind === "request_withdrawal") {
          if (-balance(s, "capital:" + a.partner) < a.amount)
            throw Error("Partner capital is no longer sufficient.");
          lines = [dr("capital:" + a.partner, a.amount), cr(code, a.amount)];
        } else {
          if (a.amount > metrics(s).available)
            throw Error("Available profit changed.");
          lines = [dr("distribution", a.amount), cr(code, a.amount)];
        }
        post(s, a.kind, a.description, lines, date);
        a.status = "approved";
      }
    }
  } else if (kind === "budget") {
    const month = text(data.month);
    if (!/^\d{4}-\d{2}$/.test(month)) throw Error("Choose a valid month.");
    const category = text(data.category) || "General";
    const existing = s.budgets.find(
      (b) => b.month === month && b.category === category,
    );
    if (existing) existing.amount = minor(data.amount);
    else
      s.budgets.push({ id: id(), month, category, amount: minor(data.amount) });
  } else if (kind === "settings") {
    if (!text(data.name)) throw Error("Business name is required.");
    s.name = text(data.name);
  } else if (kind === "close_period") {
    const through = text(data.through);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(through) ||
      through > today() ||
      through < s.closedThrough
    )
      throw Error(
        "Choose a date after the last closed period and no later than today.",
      );
    s.closedThrough = through;
  } else throw Error("Unknown operation.");
  s.revision++;
  s.activity.unshift({
    id: id(),
    time: new Date().toISOString(),
    date,
    kind,
    description: note,
    record: result,
  });
  return s;
}
export function validate(input: unknown): Workspace {
  if (!input || typeof input !== "object") throw Error("Invalid backup.");
  const s = input as Workspace;
  if (
    s.version !== 1 ||
    typeof s.name !== "string" ||
    !Number.isSafeInteger(s.revision) ||
    s.revision < 0 ||
    typeof s.closedThrough !== "string"
  )
    throw Error("Unsupported backup format.");
  for (const key of [
    "accounts",
    "partners",
    "products",
    "customers",
    "suppliers",
    "orders",
    "purchases",
    "entries",
    "approvals",
    "budgets",
    "activity",
  ] as const) {
    if (!Array.isArray(s[key]) || s[key].length > 100000)
      throw Error("Invalid backup records.");
  }
  if (s.partners.length > 3) throw Error("Invalid partner count.");
  for (const key of [
    "accounts",
    "partners",
    "products",
    "customers",
    "suppliers",
    "orders",
    "purchases",
    "approvals",
    "budgets",
  ] as const) {
    const seen = new Set();
    for (const row of s[key]) {
      if (
        !row ||
        typeof row !== "object" ||
        typeof row.id !== "string" ||
        seen.has(row.id)
      )
        throw Error("Invalid or duplicated record.");
      seen.add(row.id);
    }
  }
  for (const p of [
    ...s.accounts,
    ...s.partners,
    ...s.products,
    ...s.customers,
    ...s.suppliers,
  ]) {
    if (typeof p.name !== "string" || !p.name.trim() || p.name.length > 2000)
      throw Error("Invalid record name.");
  }
  for (const p of s.partners) quantity(p.ratio);
  for (const row of [...s.orders, ...s.purchases]) {
    if (
      !Array.isArray(row.items) ||
      !row.items.length ||
      typeof row.partyName !== "string" ||
      ![
        "draft",
        "confirmed",
        "preparing",
        "packed",
        "shipped",
        "delivered",
        "cancelled",
        "received",
      ].includes(row.status)
    )
      throw Error("Invalid order or purchase.");
    amount(row.total);
    amount(row.paid);
    amount(row.credits);
    amount(row.refunds);
    for (const item of row.items) {
      quantity(item.quantity);
      amount(item.price);
      if (
        !s.products.some((p) => p.id === item.product) ||
        !Number.isSafeInteger(item.returned) ||
        item.returned < 0 ||
        item.returned > item.quantity
      )
        throw Error("Invalid order item.");
    }
  }

  for (const p of s.products) {
    if (
      !Number.isSafeInteger(p.quantity) ||
      p.quantity < 0 ||
      !Number.isSafeInteger(p.value) ||
      p.value < 0 ||
      reserved(s, p.id) > p.quantity
    )
      throw Error("Invalid inventory.");
  }
  for (const e of s.entries) {
    if (
      !Array.isArray(e.lines) ||
      !e.lines.length ||
      e.lines.some(
        (l) =>
          !Number.isSafeInteger(l.debit) ||
          !Number.isSafeInteger(l.credit) ||
          l.debit < 0 ||
          l.credit < 0 ||
          typeof l.code !== "string" ||
          (l.debit > 0 && l.credit > 0),
      ) ||
      e.lines.reduce((n, l) => n + l.debit - l.credit, 0) !== 0
    )
      throw Error("Backup journals do not balance.");
  }
  if (s.products.reduce((n, p) => n + p.value, 0) !== balance(s, "inventory"))
    throw Error("Inventory value does not match the ledger.");
  for (const a of s.accounts)
    if (balance(s, "cash:" + a.id) < 0)
      throw Error("Invalid negative account balance.");
  return structuredClone(s);
}
