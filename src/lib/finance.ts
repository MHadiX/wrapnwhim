import { validate as legacyValidate } from "./business";
export type Transaction = {
  id: string;
  date: string;
  kind: "income" | "expense";
  amount: number;
  description: string;
  category: string;
};
export type Workspace = {
  version: 2;
  revision: number;
  name: string;
  transactions: Transaction[];
};
export const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(
    new Date(),
  );
export const money = (amount: number) =>
  new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 2,
  }).format((amount || 0) / 100);
export function empty(): Workspace {
  return { version: 2, revision: 0, name: "Wrap n Whip", transactions: [] };
}
function validDate(date: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(date)) &&
    new Date(date + "T00:00:00Z").toISOString().slice(0, 10) === date &&
    date <= today()
  );
}
export function minor(value: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value))
    throw Error(
      "Enter an amount greater than zero, with up to two decimal places.",
    );
  const [whole, fraction = ""] = value.split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 9e12)
    throw Error("Enter a valid amount greater than zero.");
  return amount;
}
export function validate(value: unknown): Workspace {
  let s = value as Workspace;
  if ((value as { version?: number })?.version === 1) {
    const old = legacyValidate(value);
    s = {
      version: 2,
      revision: old.revision,
      name: old.name,
      transactions: old.entries.flatMap((entry) => {
        const delta = entry.lines
          .filter((line) => line.code.startsWith("cash:"))
          .reduce((sum, line) => sum + line.debit - line.credit, 0);
        if (!delta) return [];
        return [
          {
            id: entry.id,
            date: entry.date,
            kind: delta > 0 ? ("income" as const) : ("expense" as const),
            amount: Math.abs(delta),
            description: entry.description || "Imported transaction",
            category:
              entry.lines
                .find((line) => line.code.startsWith("expense:"))
                ?.code.slice(8) || "Imported",
          },
        ];
      }),
    };
  }
  if (
    !s ||
    s.version !== 2 ||
    !Number.isSafeInteger(s.revision) ||
    s.revision < 0 ||
    typeof s.name !== "string" ||
    !s.name.trim() ||
    s.name.length > 2000 ||
    !Array.isArray(s.transactions) ||
    s.transactions.length > 100000
  )
    throw Error("Invalid finance backup.");
  const ids = new Set<string>();
  let added = 0,
    spent = 0;
  for (const t of s.transactions) {
    if (
      !t ||
      typeof t.id !== "string" ||
      !t.id ||
      t.id.length > 100 ||
      ids.has(t.id) ||
      typeof t.date !== "string" ||
      !validDate(t.date) ||
      !["income", "expense"].includes(t.kind) ||
      !Number.isSafeInteger(t.amount) ||
      t.amount <= 0 ||
      t.amount > 9e12 ||
      typeof t.description !== "string" ||
      !t.description.trim() ||
      t.description.length > 2000 ||
      typeof t.category !== "string" ||
      !t.category.trim() ||
      t.category.length > 2000
    )
      throw Error("Invalid finance transaction.");
    ids.add(t.id);
    if (t.kind === "income") added += t.amount;
    else spent += t.amount;
  }
  if (
    !Number.isSafeInteger(added) ||
    !Number.isSafeInteger(spent) ||
    added > 9e12 ||
    spent > 9e12
  )
    throw Error("The recorded totals exceed the supported limit.");
  return structuredClone(s);
}
export function add(
  state: Workspace,
  data: {
    kind: "income" | "expense";
    amount: string;
    date: string;
    description: string;
    category: string;
  },
): Workspace {
  if (!validDate(data.date))
    throw Error("Choose a valid date no later than today.");
  const description = data.description.trim();
  if (!description) throw Error("Enter what the money was for.");
  const record: Transaction = {
    id: crypto.randomUUID(),
    kind: data.kind,
    amount: minor(data.amount),
    date: data.date,
    description,
    category: data.category.trim() || "General",
  };
  return validate({
    ...state,
    revision: state.revision + 1,
    transactions: [record, ...state.transactions],
  });
}
export function report(state: Workspace, from = "", to = today()) {
  if ((from && !validDate(from)) || !validDate(to) || (from && from > to))
    throw Error(
      "Choose a valid date range, with the start no later than the end.",
    );
  const signed = (t: Transaction) =>
    t.kind === "income" ? t.amount : -t.amount;
  const opening = state.transactions
    .filter((t) => from && t.date < from)
    .reduce((n, t) => n + signed(t), 0);
  const transactions = state.transactions
    .filter((t) => (!from || t.date >= from) && t.date <= to)
    .sort((a, b) => b.date.localeCompare(a.date));
  const added = transactions
    .filter((t) => t.kind === "income")
    .reduce((n, t) => n + t.amount, 0);
  const spent = transactions
    .filter((t) => t.kind === "expense")
    .reduce((n, t) => n + t.amount, 0);
  const categories = new Map<string, number>();
  for (const t of transactions)
    if (t.kind === "expense")
      categories.set(t.category, (categories.get(t.category) || 0) + t.amount);
  return {
    opening,
    added,
    spent,
    closing: opening + added - spent,
    transactions,
    categories: [...categories].sort((a, b) => b[1] - a[1]),
  };
}
export function edit(
  state: Workspace,
  id: string,
  data: Parameters<typeof add>[1],
): Workspace {
  if (!state.transactions.some((t) => t.id === id))
    throw Error("This entry no longer exists. Refresh your tracker.");
  const replacement = add(empty(), data).transactions[0];
  return validate({
    ...state,
    revision: state.revision + 1,
    transactions: state.transactions.map((t) =>
      t.id === id ? { ...replacement, id } : t,
    ),
  });
}
export function remove(state: Workspace, id: string): Workspace {
  if (!state.transactions.some((t) => t.id === id))
    throw Error("This entry no longer exists. Refresh your tracker.");
  return validate({
    ...state,
    revision: state.revision + 1,
    transactions: state.transactions.filter((t) => t.id !== id),
  });
}
