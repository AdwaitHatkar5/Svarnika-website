import { test, expect, Page } from "@playwright/test";
import { createAppsScript, productFixture, orderFixture } from "../script/test-support/apps-script.mjs";

async function setup(page: Page, options: { rejectWrite?: boolean; oldDeployment?: boolean } = {}) {
  const app = createAppsScript();
  app.seed("Inventory", productFixture);
  app.seed("Orders", orderFixture);
  let writes = 0;
  await page.route("https://script.google.com/**", async (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      writes += 1;
      const payload = JSON.parse(new URLSearchParams(request.postData() || "").get("payload") || "{}");
      if (options.rejectWrite) {
        app.receipts.set(`admin-result:${payload.requestId}`, JSON.stringify({ ok: false, error: "Write rejected by server" }));
      } else {
        app.post(payload);
      }
      await route.fulfill({ status: 200, body: "", contentType: "text/plain" });
      return;
    }
    const params = Object.fromEntries(new URL(request.url()).searchParams);
    const body = options.oldDeployment && params.action === "inventoryList"
      ? `${params.callback}(${JSON.stringify({ ok: true, adminVersion: 1, products: [] })});`
      : app.get(params);
    await route.fulfill({ status: 200, contentType: "application/javascript", body });
  });
  await page.goto("/admin");
  await page.getByLabel("Admin PIN", { exact: true }).fill("test-admin-key");
  await page.getByRole("button", { name: "Unlock", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Test Customer", exact: true })).toBeVisible();
  if (!options.oldDeployment) await expect(page.getByRole("button", { name: "Save update", exact: true })).toBeEnabled();
  return { app, writes: () => writes };
}

test("inventory edits persist; delete can be cancelled and confirmed", async ({ page }) => {
  const { app, writes } = await setup(page);
  await page.getByRole("button", { name: "Inventory", exact: true }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByLabel("Product ID", { exact: true })).toHaveValue("BR-001");
  await expect(page.getByLabel("Product ID", { exact: true })).toHaveAttribute("readonly", "");
  await page.getByLabel("Price", { exact: true }).fill("599");
  await page.getByLabel("Stock status").fill("0");
  await page.getByRole("button", { name: "Save product", exact: true }).click();
  await expect(page.getByText("Product saved", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Refresh inventory", exact: true }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByLabel("Price", { exact: true })).toHaveValue("599");
  await expect(page.getByLabel("Stock status")).toHaveValue("0");
  expect(app.sheets.get("Inventory").getLastRow()).toBe(2);
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Delete product Test bracelet", exact: true }).click();
  expect(writes()).toBe(1);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete product Test bracelet", exact: true }).click();
  await expect(page.getByText("Product deleted", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete product Test bracelet" })).toHaveCount(0);
  await expect(page.getByLabel("Product name")).toHaveValue("");
  expect(app.sheets.get("Inventory").getLastRow()).toBe(1);
});

test("order edit persists and deleting clears invoice selection", async ({ page }) => {
  const { app, writes } = await setup(page);
  await page.getByLabel("Customer name", { exact: true }).fill("Updated Customer");
  await page.getByLabel("Delivery address", { exact: true }).fill("Updated delivery address");
  await page.getByRole("combobox", { name: "Status", exact: true }).selectOption("Shipped");
  await page.getByRole("button", { name: "Save update", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Updated Customer", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Refresh orders", exact: true }).click();
  await expect(page.getByLabel("Delivery address", { exact: true })).toHaveValue("Updated delivery address");
  await expect(page.getByRole("combobox", { name: "Status", exact: true })).toHaveValue("Shipped");
  await page.getByRole("checkbox", { name: "Select", exact: true }).check();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Delete order", exact: true }).click();
  expect(writes()).toBe(1);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete order", exact: true }).click();
  await expect(page.getByText("Order deleted", { exact: true })).toBeVisible();
  expect(app.sheets.get("Orders").getLastRow()).toBe(1);
  await page.getByRole("button", { name: "Invoices", exact: true }).click();
  await expect(page.getByRole("heading", { name: "0 ready" })).toBeVisible();
});

test("server errors keep form values and records; no false success", async ({ page }) => {
  const { app } = await setup(page, { rejectWrite: true });
  await page.getByLabel("Customer name", { exact: true }).fill("Unsaved change");
  await page.getByRole("button", { name: "Save update", exact: true }).click();
  await expect(page.getByText("Write rejected by server", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Test Customer", exact: true })).toBeVisible();
  await expect(page.getByLabel("Customer name", { exact: true })).toHaveValue("Unsaved change");
  await expect(page.getByText("Order saved", { exact: true })).toHaveCount(0);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete order", exact: true }).click();
  await expect(page.getByText("Delete could not be confirmed", { exact: true })).toBeVisible();
  expect(app.sheets.get("Orders").getLastRow()).toBe(2);
  await page.getByRole("button", { name: "Inventory", exact: true }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Price", { exact: true }).fill("999");
  await page.getByRole("button", { name: "Save product", exact: true }).click();
  await expect(page.getByText("Product could not be saved", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Price", { exact: true })).toHaveValue("999");
  await expect(page.getByText("Product saved", { exact: true })).toHaveCount(0);
});

test("outdated deployment disables writes with visible setup status", async ({ page }) => {
  const { writes } = await setup(page, { oldDeployment: true });
  await expect(page.getByRole("button", { name: "Save update", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Delete order", exact: true })).toBeDisabled();
  await expect(page.getByRole("alert").first()).toContainText("Update the Apps Script deployment");
  expect(writes()).toBe(0);
});

test("success waits for the server receipt, not just the POST", async ({ page }) => {
  const { writes } = await setup(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let requested!: () => void;
  const receiptRequested = new Promise<void>((resolve) => { requested = resolve; });
  await page.route("https://script.google.com/**", async (route) => {
    if (new URL(route.request().url()).searchParams.get("action") === "adminResult") {
      requested();
      await gate;
    }
    await route.fallback();
  });
  await page.getByRole("button", { name: "Save update", exact: true }).click();
  await receiptRequested;
  expect(writes()).toBe(1);
  await expect(page.getByRole("button", { name: "Saving change", exact: true })).toBeDisabled();
  await expect(page.getByText("Order saved", { exact: true })).toHaveCount(0);
  release();
  await expect(page.getByText("Order saved", { exact: true })).toBeVisible();
});

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`admin layout at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await setup(page);
    await expect(page.getByRole("button", { name: "Save update", exact: true })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("orders.png"), fullPage: true });
    await page.getByRole("button", { name: "Inventory", exact: true }).click();
    await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("inventory.png"), fullPage: true });
  });
}
