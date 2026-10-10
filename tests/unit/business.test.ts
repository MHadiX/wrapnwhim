import { describe, it, expect } from "vitest";
import {
  empty,
  operate,
  metrics,
  balance,
  reserved,
  allocate,
  minor,
  validate,
} from "../../src/lib/business";
function fixture() {
  let s = empty();
  const run = (k: string, d: Record<string, unknown>) => {
    s = operate(s, k, d);
    return s;
  };
  for (const name of ["Ayesha", "Hadi", "Zain"])
    run("partner", { name, ratio: 1 });
  run("investment", {
    partner: s.partners[0].id,
    account: "cash",
    amount: "10000",
  });
  run("product", {
    name: "Gift box",
    sku: "BOX",
    category: "Boxes",
    price: "200",
    reorder: 2,
  });
  run("customer", { name: "Ali" });
  run("supplier", { name: "Packaging Co" });
  run("purchase", {
    party: s.suppliers[0].id,
    items: [{ product: s.products[0].id, quantity: 10, price: "100" }],
  });
  run("purchase_receive", { purchase: s.purchases[0].id });
  return {
    get state() {
      return s;
    },
    run,
  };
}
function delivered(f: ReturnType<typeof fixture>, discount = "0") {
  const s = f.state;
  f.run("order", {
    party: s.customers[0].id,
    items: [{ product: s.products[0].id, quantity: 3, price: "200" }],
    discount,
  });
  const order = f.state.orders[0].id;
  for (const status of [
    "confirmed",
    "preparing",
    "packed",
    "shipped",
    "delivered",
  ])
    f.run("order_status", { order, status, tracking: "TRACK-001" });
  return order;
}
describe("business accounting", () => {
  it("starts at zero and capital is not income", () => {
    const f = fixture();
    expect(metrics(empty()).cash).toBe(0);
    expect(metrics(f.state).revenue).toBe(0);
    expect(metrics(f.state).cash).toBe(1000000);
    expect(metrics(f.state).inventory).toBe(100000);
    expect(metrics(f.state).liabilities).toBe(100000);
  });
  it("supplier payment clears debt without treating inventory as expense", () => {
    const f = fixture();
    f.run("purchase_payment", {
      purchase: f.state.purchases[0].id,
      account: "cash",
      amount: "1000",
    });
    expect(metrics(f.state).expenses).toBe(0);
    expect(metrics(f.state).liabilities).toBe(0);
    expect(metrics(f.state).cash).toBe(900000);
    expect(() =>
      f.run("purchase_receive", { purchase: f.state.purchases[0].id }),
    ).toThrow(/already/);
  });
  it("reserves stock and rejects overselling atomically", () => {
    const f = fixture();
    const d = {
      party: f.state.customers[0].id,
      items: [{ product: f.state.products[0].id, quantity: 8, price: "200" }],
    };
    f.run("order", d);
    f.run("order_status", { order: f.state.orders[0].id, status: "confirmed" });
    expect(reserved(f.state, f.state.products[0].id)).toBe(8);
    f.run("order", d);
    const before = structuredClone(f.state);
    expect(() =>
      f.run("order_status", {
        order: f.state.orders[0].id,
        status: "confirmed",
      }),
    ).toThrow(/stock/);
    expect(f.state).toEqual(before);
  });
  it("deposits become income only on delivery and recognize historical cost", () => {
    const f = fixture();
    f.run("order", {
      party: f.state.customers[0].id,
      items: [{ product: f.state.products[0].id, quantity: 2, price: "200" }],
    });
    const order = f.state.orders[0].id;
    f.run("order_payment", { order, account: "cash", amount: "100" });
    expect(metrics(f.state).revenue).toBe(0);
    for (const status of [
      "confirmed",
      "preparing",
      "packed",
      "shipped",
      "delivered",
    ])
      f.run("order_status", { order, status, tracking: "T" });
    expect(metrics(f.state).revenue).toBe(40000);
    expect(metrics(f.state).cogs).toBe(20000);
    expect(metrics(f.state).receivables).toBe(30000);
    expect(f.state.products[0].quantity).toBe(8);
  });
  it("partial discounted returns and refunds preserve exact pennies and stock", () => {
    const f = fixture();
    const order = delivered(f, "0.01");
    f.run("order_payment", { order, account: "cash", amount: "599.99" });
    f.run("return", { order, product: f.state.products[0].id, quantity: 1 });
    f.run("return", { order, product: f.state.products[0].id, quantity: 2 });
    expect(f.state.orders[0].credits).toBe(59999);
    expect(metrics(f.state).revenue).toBe(0);
    expect(metrics(f.state).cogs).toBe(0);
    expect(f.state.products[0].quantity).toBe(10);
    f.run("refund", { order, account: "cash", amount: "599.99" });
    expect(balance(f.state, "refund:" + order)).toBe(0);
    expect(() =>
      f.run("refund", { order, account: "cash", amount: "1" }),
    ).toThrow(/returned/);
  });
  it("COD is a receivable until remitted and real fees affect profit", () => {
    const f = fixture();
    f.run("order", {
      party: f.state.customers[0].id,
      cod: true,
      items: [{ product: f.state.products[0].id, quantity: 1, price: "200" }],
    });
    const order = f.state.orders[0].id;
    for (const status of [
      "confirmed",
      "preparing",
      "packed",
      "shipped",
      "delivered",
    ])
      f.run("order_status", { order, status, tracking: "COD" });
    expect(metrics(f.state).cash).toBe(1000000);
    f.run("cod_settlement", {
      order,
      account: "cash",
      amount: "200",
      fee: "20",
    });
    expect(metrics(f.state).cash).toBe(1018000);
    expect(metrics(f.state).expenses).toBe(2000);
    expect(metrics(f.state).receivables).toBe(0);
  });
  it("transfers do not create income and insufficient cash rolls back", () => {
    const f = fixture();
    f.run("transfer", {
      account: "cash",
      destination: "bank",
      amount: "100",
      fee: "2",
    });
    expect(metrics(f.state).revenue).toBe(0);
    expect(metrics(f.state).expenses).toBe(200);
    const before = f.state;
    expect(() =>
      f.run("expense", {
        account: "bank",
        amount: "1000",
        category: "General",
      }),
    ).toThrow(/enough/);
    expect(f.state).toEqual(before);
  });
  it("withdrawals need two other partner decisions and post once", () => {
    const f = fixture();
    const s = f.state;
    f.run("request_withdrawal", {
      partner: s.partners[0].id,
      account: "cash",
      amount: "100",
    });
    const approval = f.state.approvals[0].id;
    expect(() =>
      f.run("approve", { approval, partner: s.partners[0].id }),
    ).toThrow(/different/);
    f.run("approve", { approval, partner: s.partners[1].id });
    expect(metrics(f.state).cash).toBe(1000000);
    f.run("approve", { approval, partner: s.partners[2].id });
    expect(metrics(f.state).cash).toBe(990000);
    expect(() =>
      f.run("approve", { approval, partner: s.partners[1].id }),
    ).toThrow(/complete/);
  });
  it("closed periods reject financial and zero-cost stock operations", () => {
    const f = fixture();
    f.run("close_period", {
      through: new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Karachi",
      }).format(new Date()),
    });
    expect(() => f.run("income", { account: "cash", amount: "1" })).toThrow(
      /open date/,
    );
    expect(() =>
      f.run("loss", { product: f.state.products[0].id, quantity: 1 }),
    ).toThrow(/closed/);
  });
  it("checks backup journals and exact currency input", () => {
    expect(minor("12.01")).toBe(1201);
    expect(() => minor("12.001")).toThrow();
    expect(allocate(101, [1, 1, 1])).toEqual([34, 34, 33]);
    const f = fixture();
    expect(validate(f.state)).toEqual(f.state);
    const broken = structuredClone(f.state);
    broken.entries[0].lines[0].debit++;
    expect(() => validate(broken)).toThrow(/balance/);
  });
  it("paid supplier returns create a receivable until real refund receipt", () => {
    const f = fixture();
    const purchase = f.state.purchases[0].id;
    f.run("purchase_payment", { purchase, account: "cash", amount: "1000" });
    f.run("supplier_return", {
      purchase,
      product: f.state.products[0].id,
      quantity: 2,
    });
    expect(metrics(f.state).inventory).toBe(80000);
    expect(metrics(f.state).receivables).toBe(20000);
    expect(metrics(f.state).profit).toBe(0);
    f.run("supplier_refund", { purchase, account: "cash", amount: "200" });
    expect(metrics(f.state).cash).toBe(920000);
    expect(metrics(f.state).receivables).toBe(0);
    expect(() =>
      f.run("supplier_refund", { purchase, account: "cash", amount: "1" }),
    ).toThrow(/receivable/);
  });
  it("personally funded purchases create partner debt without fake business spending", () => {
    const f = fixture();
    f.run("partner_purchase_payment", {
      purchase: f.state.purchases[0].id,
      partner: f.state.partners[0].id,
      amount: "1000",
    });
    expect(metrics(f.state).cash).toBe(1000000);
    expect(-balance(f.state, "payable:" + f.state.partners[0].id)).toBe(100000);
    expect(metrics(f.state).expenses).toBe(0);
    f.run("reimbursement", {
      partner: f.state.partners[0].id,
      account: "cash",
      amount: "1000",
    });
    expect(metrics(f.state).cash).toBe(900000);
    expect(balance(f.state, "payable:" + f.state.partners[0].id)).toBe(0);
  });
});
