import { it, expect } from "vitest";
import {
  add,
  edit,
  empty,
  money,
  remove,
  report,
  validate,
} from "../../src/lib/finance";
import { empty as oldEmpty, operate } from "../../src/lib/business";
const entry = (
  kind: "income" | "expense",
  amount: string,
  date = "2025-01-01",
) => ({ kind, amount, date, description: "Test entry", category: "General" });
it("tracks added and spent money exactly, including spending before a deposit", () => {
  const spent = add(empty(), entry("expense", "10.01"));
  const state = add(spent, entry("income", "20.02"));
  expect(report(spent).closing).toBe(-1001);
  expect(report(state)).toMatchObject({
    added: 2002,
    spent: 1001,
    closing: 1001,
  });
  expect(empty().transactions).toHaveLength(0);
  expect(() => add(state, entry("income", "0.001"))).toThrow();
  expect(() => add(state, entry("expense", "0"))).toThrow();
  expect(() => add(state, entry("expense", "1", "2025-02-30"))).toThrow();
});
it("reports correct opening and closing balances with inclusive dates and category spending", () => {
  let state = add(empty(), entry("income", "1000"));
  state = add(state, {
    ...entry("expense", "200", "2025-01-02"),
    category: "Rent",
  });
  state = add(state, entry("income", "50", "2025-01-03"));
  const result = report(state, "2025-01-02", "2025-01-03");
  expect(result).toMatchObject({
    opening: 100000,
    added: 5000,
    spent: 20000,
    closing: 85000,
    categories: [["Rent", 20000]],
  });
  expect(result.transactions).toHaveLength(2);
  expect(() => report(state, "2025-01-03", "2025-01-02")).toThrow();
  expect(money(result.closing)).toContain("850.00");
});
it("corrects and deletes entries without changing the original snapshot and rejects duplicated backup IDs", () => {
  const initial = add(empty(), entry("income", "100"));
  const corrected = edit(
    initial,
    initial.transactions[0].id,
    entry("income", "200"),
  );
  expect(report(initial).closing).toBe(10000);
  expect(report(corrected).closing).toBe(20000);
  expect(corrected.revision).toBe(2);
  expect(report(remove(corrected, corrected.transactions[0].id)).closing).toBe(
    0,
  );
  expect(() =>
    validate({
      ...initial,
      transactions: [...initial.transactions, ...initial.transactions],
    }),
  ).toThrow();
  expect(() => remove(initial, "missing")).toThrow();
});
it("imports earlier encrypted-workspace contents as money movements while keeping the revision", () => {
  let old = operate(oldEmpty(), "income", {
    amount: "1000",
    account: "cash",
    date: "2025-01-01",
    note: "Opening deposit",
  });
  old = operate(old, "expense", {
    amount: "200",
    account: "cash",
    date: "2025-01-02",
    category: "Supplies",
    note: "Purchase",
  });
  const migrated = validate(old);
  expect(migrated.version).toBe(2);
  expect(migrated.revision).toBe(old.revision);
  expect(migrated.transactions).toHaveLength(2);
  expect(report(migrated)).toMatchObject({
    added: 100000,
    spent: 20000,
    closing: 80000,
  });
});
