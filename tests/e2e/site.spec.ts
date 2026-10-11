import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
const password = "test-only-password-2026";
test.beforeEach(async () => {
  await fetch("http://127.0.0.1:3001/reset", { method: "POST" });
});
async function login(page: Page) {
  await page.goto("http://127.0.0.1:3000/");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Finance tracker", exact: true }),
  ).toBeVisible();
}
async function record(
  page: Page,
  kind: "income" | "expense",
  amount: string,
  description: string,
  date = "2025-01-01",
  category = "General",
) {
  await page
    .getByRole("button", {
      name: kind === "income" ? "Add money" : "Record spending",
      exact: true,
    })
    .click();
  const form = page.getByRole("dialog");
  await form.getByLabel("Amount (PKR)").fill(amount);
  await form.getByLabel("Description", { exact: true }).fill(description);
  await form.getByLabel("Date", { exact: true }).fill(date);
  await form.getByLabel("Category", { exact: false }).fill(category);
  await form.getByRole("button", { name: "Save entry", exact: true }).click();
  await expect(form).toBeHidden();
}
test("records money, corrects mistakes, generates a date report and exports it", async ({
  page,
}) => {
  await login(page);
  await record(
    page,
    "income",
    "1000.50",
    "Money added",
    "2025-01-01",
    "Investment",
  );
  await record(page, "expense", "200.25", "Office rent", "2025-01-02", "Rent");
  await expect(page.locator(".stat").first()).toContainText("800.25");
  await page
    .getByRole("button", { name: "Edit Office rent", exact: true })
    .click();
  const edit = page.getByRole("dialog");
  await edit.getByLabel("Amount (PKR)").fill("150.25");
  await edit.getByRole("button", { name: "Save entry" }).click();
  await expect(edit).toBeHidden();
  await expect(page.locator(".stat").first()).toContainText("850.25");
  await page.getByRole("button", { name: "Report", exact: true }).click();
  await page.getByLabel("From", { exact: true }).fill("2025-01-02");
  await page.getByLabel("To", { exact: true }).fill("2025-01-02");
  await page.getByRole("button", { name: "Generate report" }).click();
  const report = page.locator(".report-summary");
  await expect(report).toContainText("1,000.50");
  await expect(report).toContainText("850.25");
  await expect(page.getByRole("table")).toContainText("Office rent");
  await expect(page.getByRole("table")).not.toContainText("Money added");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download CSV" }).click();
  const file = await download;
  const text = await readFile((await file.path())!, "utf8");
  expect(text).toContain("Opening balance");
  expect(text).toContain("850.25");
  expect(text).toContain("Office rent");
  let printed = false;
  await page.exposeFunction("testPrint", () => {
    printed = true;
  });
  await page.evaluate(() => {
    window.print = () => {
      void (
        window as unknown as { testPrint: () => Promise<void> }
      ).testPrint();
    };
  });
  await page.getByRole("button", { name: "Print / Save PDF" }).click();
  await expect.poll(() => printed).toBe(true);
  await page.getByRole("button", { name: "Transactions", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Delete Office rent", exact: true })
    .click();
  await expect(page.getByRole("table")).not.toContainText("Office rent");
  await expect(page.locator(".stat").first()).toContainText("1,000.50");
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/finance-${test.info().project.name}.png`,
    fullPage: true,
  });
});
test("one login shares entries between devices and prevents overwriting a partner's save", async ({
  page,
  browser,
}) => {
  test.setTimeout(90000);
  await login(page);
  const secondContext = await browser.newContext();
  const thirdContext = await browser.newContext();
  try {
    const second = await secondContext.newPage();
    const third = await thirdContext.newPage();
    await login(second);
    await login(third);
    await third.getByRole("button", { name: "Add money", exact: true }).click();
    const draft = third.getByRole("dialog");
    await draft.getByLabel("Amount (PKR)").fill("25");
    await draft.getByLabel("Description").fill("Third device money");
    await record(page, "income", "100", "Shared money");
    await expect(second.getByRole("table")).toContainText("Shared money", {
      timeout: 20000,
    });
    await draft.getByRole("button", { name: "Save entry" }).click();
    await expect(draft.getByRole("alert")).toContainText(
      "Someone else saved changes first",
    );
    await draft.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(third.getByRole("table")).toContainText("Shared money", {
      timeout: 20000,
    });
    await record(third, "expense", "20", "Shared spending");
    await expect(page.getByRole("table")).toContainText("Shared spending", {
      timeout: 20000,
    });
    await expect(second.getByRole("table")).toContainText("Shared spending", {
      timeout: 20000,
    });
    await expect(page.locator(".stat").first()).toContainText("80.00");
  } finally {
    await secondContext.close();
    await thirdContext.close();
  }
});
test("protects records with one password, preserves server data and restores encrypted backups", async ({
  page,
}) => {
  await login(page);
  await record(page, "income", "500", "Private money");
  const stored = await (await fetch("http://127.0.0.1:3001/inspect")).json();
  expect(Buffer.from(stored.content, "base64").toString()).not.toContain(
    "Private money",
  );
  await page.getByText("Backup and restore", { exact: true }).click();
  const event = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download backup", exact: true })
    .click();
  const backup = await event;
  const path = (await backup.path())!;
  expect(await readFile(path, "utf8")).not.toContain("Private money");
  await page.getByRole("button", { name: "Lock", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeEnabled();
  expect((await page.request.get("/api/workspace")).status()).toBe(401);
  await page.getByLabel("Password", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".login-box [role=alert]")).toContainText(
    "Incorrect password",
  );
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("table")).toContainText("Private money");
  await record(page, "expense", "50", "Temporary expense");
  await page.getByText("Backup and restore", { exact: true }).click();
  await page
    .getByRole("button", { name: "Restore backup", exact: true })
    .click();
  await page.locator("input[type=file]").setInputFiles(path);
  const modal = page.getByRole("dialog");
  await modal.getByLabel("Backup password").fill("wrong");
  await modal.getByRole("button", { name: "Verify and restore" }).click();
  await expect(modal.getByRole("alert")).toContainText("Incorrect password");
  await modal.getByLabel("Backup password").fill(password);
  page.once("dialog", (dialog) => dialog.accept());
  await modal.getByRole("button", { name: "Verify and restore" }).click();
  await expect(modal).toBeHidden();
  await expect(page.getByRole("table")).not.toContainText("Temporary expense");
  await expect(page.locator(".stat").first()).toContainText("500.00");
  await page.reload();
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("table")).toContainText("Private money");
});
