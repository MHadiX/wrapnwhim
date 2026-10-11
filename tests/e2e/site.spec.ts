import { test, expect, type Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { create, unlock } from "../../src/lib/storage";
const password = "test-only-password-2026";
test.beforeEach(async () => {
  await fetch("http://127.0.0.1:3001/reset", { method: "POST" });
});
async function start(page: Page) {
  await page.goto("/");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Unlock workspace", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
}
async function nav(page: Page, name: string) {
  await page.getByRole("banner").waitFor({ state: "visible" });
  const toggle = page.getByRole("button", { name: "Toggle navigation" });
  if (await toggle.isVisible()) await toggle.click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name, exact: true })
    .click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
}
async function form(page: Page, name: string) {
  await page.getByRole("button", { name, exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}
async function save(page: Page) {
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Save record", exact: true })
    .click();
  await expect(dialog).toBeHidden();
}
test("real purchasing, investment, delivery and financial reporting", async ({
  page,
}) => {
  test.setTimeout(180000);
  await start(page);
  await nav(page, "Partners");
  let d = await form(page, "Add partner");
  await d.getByLabel("Partner name").fill("Ayesha");
  await save(page);
  d = await form(page, "Record investment");
  await d.getByLabel("Partner", { exact: true }).selectOption({ index: 1 });
  await d.getByLabel("Payment account").selectOption("cash");
  await d.getByLabel("Amount (PKR)", { exact: true }).fill("10000");
  await save(page);
  await nav(page, "Products & inventory");
  d = await form(page, "Add product");
  await d.getByLabel("Product name").fill("Gift box");
  await d.getByLabel("SKU", { exact: true }).fill("BOX");
  await d.getByLabel("Category", { exact: true }).fill("Giftware");
  await d.getByLabel("Selling price (PKR)").fill("200");
  await save(page);
  await nav(page, "Suppliers");
  d = await form(page, "Add supplier");
  await d.getByLabel("Supplier name").fill("Packaging Co");
  await save(page);
  await nav(page, "Customers");
  d = await form(page, "Add customer");
  await d.getByLabel("Full name").fill("Ali");
  await save(page);
  await nav(page, "Purchases & bills");
  d = await form(page, "Create purchase");
  await d.getByLabel("Supplier", { exact: true }).selectOption({ index: 1 });
  await d.getByLabel("Product", { exact: true }).selectOption({ index: 1 });
  await d.getByLabel("Qty", { exact: true }).fill("10");
  await d.getByLabel("Unit cost (PKR)").fill("100");
  await save(page);
  d = await form(page, "Receive purchase");
  await d.getByLabel("Purchase", { exact: true }).selectOption({ index: 1 });
  await save(page);
  await expect(
    page.getByRole("cell", { name: "received", exact: true }),
  ).toBeVisible();
  d = await form(page, "Pay supplier bill");
  await d.getByLabel("Purchase", { exact: true }).selectOption({ index: 1 });
  await d.getByLabel("Payment account").selectOption("cash");
  await d.getByLabel("Amount (PKR)", { exact: true }).fill("1000");
  await save(page);
  await nav(page, "Sales & orders");
  d = await form(page, "Create order");
  await d.getByLabel("Customer", { exact: true }).selectOption({ index: 1 });
  await d.getByLabel("Product", { exact: true }).selectOption({ index: 1 });
  await d.getByLabel("Qty", { exact: true }).fill("2");
  await save(page);
  for (const status of [
    "confirmed",
    "preparing",
    "packed",
    "shipped",
    "delivered",
  ]) {
    await page
      .getByRole("button", { name: "View WNW-0001", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Update status", exact: true })
      .click();
    d = page.getByRole("dialog");
    await d.getByLabel("Next status").selectOption(status);
    if (status === "shipped")
      await d
        .getByLabel("Tracking or collection reference", { exact: false })
        .fill("TRACK-001");
    await save(page);
  }
  await expect(
    page.getByRole("cell", { name: "delivered", exact: true }),
  ).toBeVisible();
  d = await form(page, "Record customer payment");
  await d.getByLabel("Order", { exact: true }).selectOption({ index: 1 });
  await d.getByLabel("Payment account").selectOption("cash");
  await d.getByLabel("Amount (PKR)", { exact: true }).fill("400");
  await save(page);
  await nav(page, "Reports");
  const net = page.locator(".row").filter({ hasText: "Net profit" });
  await expect(net).toContainText("200.00");
  await nav(page, "Products & inventory");
  await expect(
    page.locator("tbody tr").first().getByRole("cell").nth(3),
  ).toHaveText("8");
  await page.screenshot({
    path: `test-results/workspace-${test.info().project.name}.png`,
    fullPage: true,
  });
});
test("encrypted persistence, password denial, backup restore and CSV export", async ({
  page,
  browser,
}) => {
  test.setTimeout(120000);
  await start(page);
  await nav(page, "Customers");
  let d = await form(page, "Add customer");
  await d.getByLabel("Full name").fill("Private Buyer");
  await save(page);
  const stored = await (await fetch("http://127.0.0.1:3001/inspect")).json();
  const encrypted = Buffer.from(stored.content, "base64").toString("utf8");
  expect(encrypted).not.toContain("Private Buyer");
  expect(encrypted).not.toContain(password);
  const csvEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV", exact: true }).click();
  const csvDownload = await csvEvent;
  expect(await readFile((await csvDownload.path())!, "utf8")).toContain(
    "Private Buyer",
  );
  const backupEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Backup", exact: true }).click();
  const backup = await backupEvent;
  const downloaded = (await backup.path())!;
  expect(await readFile(downloaded, "utf8")).not.toContain("Private Buyer");
  const legacyPassword = "old-browser-password-2026";
  const decoded = await unlock(password, JSON.parse(encrypted));
  const legacy = await create(legacyPassword, decoded.state);
  const path = test.info().outputPath("old-browser-backup.json");
  await writeFile(path, JSON.stringify(legacy.envelope));
  await page.evaluate(async (envelope) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("wrapnwhip-private", 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("workspace");
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("workspace", "readwrite");
        tx.objectStore("workspace").put(envelope, "main");
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(Error("fixture storage failed"));
      };
    });
  }, legacy.envelope);
  await page.getByRole("button", { name: "Lock", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  const oldDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download old browser backup" })
    .click();
  const oldFile = await oldDownload;
  expect(JSON.parse(await readFile((await oldFile.path())!, "utf8"))).toEqual(
    legacy.envelope,
  );
  await page.getByLabel("Password", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Unlock workspace" }).click();
  await expect(page.locator(".login-box [role=alert]")).toContainText(
    "Incorrect password",
  );
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Unlock workspace" }).click();
  await expect(page.getByText("Private Buyer", { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  const context = await browser.newContext();
  try {
    const other = await context.newPage();
    await other.goto("http://127.0.0.1:3000");
    await other.getByLabel("Password", { exact: true }).fill(password);
    await other.getByRole("button", { name: "Unlock workspace" }).click();
    await nav(other, "Customers");
    await expect(
      other.getByText("Private Buyer", { exact: true }),
    ).toBeVisible();
    await nav(other, "Settings & backups");
    await other
      .getByRole("button", { name: "Restore backup", exact: true })
      .click();
    await other.locator("input[type=file]").setInputFiles(path);
    d = other.getByRole("dialog");
    await d.getByLabel("Backup password").fill("wrong");
    await d.getByRole("button", { name: "Verify and restore" }).click();
    await expect(d.getByRole("alert")).toContainText("Incorrect password");
    await d.getByLabel("Backup password").fill(legacyPassword);
    other.once("dialog", (dialog) => dialog.accept());
    await d.getByRole("button", { name: "Verify and restore" }).click();
    await expect(d).toBeHidden();
    await other.getByLabel("Password", { exact: true }).fill(password);
    await other.getByRole("button", { name: "Unlock workspace" }).click();
    await nav(other, "Customers");
    await expect(
      other.getByText("Private Buyer", { exact: true }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});
test("responsive navigation, zero balances and dark mode", async ({ page }) => {
  await start(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Toggle dark mode" }).click();
  await expect(page.locator("body")).toHaveClass("dark");
  for (const name of [
    "Financial accounts",
    "Transactions",
    "Approvals",
    "Budgets",
    "Activity",
    "Settings & backups",
  ])
    await nav(page, name);
  await expect(
    page.getByText("All three partners share these encrypted records.", {
      exact: true,
    }),
  ).toBeVisible();
});

test("three separate browsers share records and reject a stale save", async ({
  page,
  browser,
}) => {
  test.setTimeout(120000);
  await start(page);
  await nav(page, "Customers");
  const secondContext = await browser.newContext();
  const thirdContext = await browser.newContext();
  try {
    const second = await secondContext.newPage();
    const third = await thirdContext.newPage();
    await start(second);
    await start(third);
    await nav(second, "Customers");
    await nav(third, "Customers");
    const staleForm = await form(third, "Add customer");
    await staleForm.getByLabel("Full name").fill("Third partner buyer");
    const d = await form(page, "Add customer");
    await d.getByLabel("Full name").fill("First partner buyer");
    await save(page);
    await expect(
      second.getByText("First partner buyer", { exact: true }),
    ).toBeVisible({ timeout: 20000 });
    await staleForm
      .getByRole("button", { name: "Save record", exact: true })
      .click();
    await expect(staleForm.getByRole("alert")).toContainText(
      "Someone else saved changes first",
    );
    await staleForm
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    await expect(
      third.getByText("First partner buyer", { exact: true }),
    ).toBeVisible({ timeout: 20000 });
    const freshForm = await form(third, "Add customer");
    await freshForm.getByLabel("Full name").fill("Third partner buyer");
    await save(third);
    await expect(
      page.getByText("Third partner buyer", { exact: true }),
    ).toBeVisible({ timeout: 20000 });
    await expect(
      second.getByText("Third partner buyer", { exact: true }),
    ).toBeVisible({ timeout: 20000 });
    await page.getByRole("button", { name: "Lock", exact: true }).click();
    const denied = await page.request.get("/api/workspace");
    expect(denied.status()).toBe(401);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Unlock workspace" }).click();
    await nav(page, "Customers");
    await expect(
      page.getByText("First partner buyer", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Third partner buyer", { exact: true }),
    ).toBeVisible();
  } finally {
    await secondContext.close();
    await thirdContext.close();
  }
});
