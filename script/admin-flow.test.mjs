import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { build } from "esbuild";
import { createAppsScript, productFixture, orderFixture } from "./test-support/apps-script.mjs";

const mutation = (action, fields = {}) => ({ action, token: "test-admin-key", requestId: randomUUID(), ...fields });

test("storefront preserves text and leading-zero IDs when another product is deleted", async () => {
  const bundled = await build({
    entryPoints: ["client/src/lib/store.ts"], bundle: true, write: false, format: "esm",
    plugins: [{ name: "test-assets", setup(builder) {
      builder.onResolve({ filter: /^@assets\// }, () => ({ path: "image", namespace: "fixture" }));
      builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: 'export default "/fixture.png";' }));
    } }],
  });
  const { productsFromCsv } = await import("data:text/javascript;base64," + Buffer.from(bundled.outputFiles[0].text).toString("base64"));
  const headers = "id,name,price,image\n";
  const remaining = "BR-002,Bracelet,499,/image.png\n00123,Ring,399,/ring.png";
  const before = productsFromCsv(headers + "BR-001,Necklace,599,/necklace.png\n" + remaining);
  const after = productsFromCsv(headers + remaining);
  assert.equal(before[1].id, after[0].id);
  assert.equal(after[0].id, "BR-002");
  assert.equal(after[1].id, "00123");
});

test("inventory edit preserves exact IDs, zero stock, custom columns and row count", () => {
  const app = createAppsScript();
  app.seed("Inventory", productFixture);
  const sheet = app.sheets.get("Inventory");
  sheet.rows[0].push("internalNote"); sheet.rows[1].push("Keep this");
  const result = app.post(mutation("updateInventory", { product: { ...productFixture, price: "599", stock: 0 } }));
  assert.equal(result.ok, true);
  assert.equal(sheet.getLastRow(), 2);
  assert.equal(sheet.rows[1].at(-1), "Keep this");
  const listed = JSON.parse(app.get({ action: "inventoryList", token: "test-admin-key" }));
  assert.equal(listed.products[0].id, "BR-001");
  assert.equal(listed.products[0].price, "599");
  assert.equal(listed.products[0].stock, "0");
  app.seed("Inventory", { ...productFixture, id: 0 });
  assert.equal(app.post(mutation("updateInventory", { product: { ...productFixture, id: 0, price: "699" } })).ok, true);
  assert.equal(sheet.getLastRow(), 3);
  assert.equal(sheet.rows[2][5], "699");
});

test("create, edit and delete inventory; repeated request does not recreate or delete another row", () => {
  const app = createAppsScript();
  const create = mutation("inventory", { product: productFixture });
  assert.equal(app.post(create).ok, true);
  assert.equal(app.post(create).ok, true);
  assert.equal(app.sheets.get("Inventory").getLastRow(), 2);
  app.seed("Inventory", { ...productFixture, id: "BR-002" });
  const remove = mutation("deleteInventory", { productId: "BR-001" });
  assert.equal(app.post(remove).ok, true);
  assert.equal(app.post(remove).ok, true);
  assert.equal(app.sheets.get("Inventory").rows[1][0], "BR-002");
  assert.equal(app.post(mutation("updateInventory", { product: productFixture })).ok, false);
});

test("unauthorized mutations and receipt reads are rejected", () => {
  const app = createAppsScript();
  app.seed("Inventory", productFixture); app.seed("Orders", orderFixture);
  for (const action of ["inventory", "updateInventory", "deleteInventory", "updateOrder", "deleteOrder"]) {
    assert.equal(app.post(mutation(action, { token: "wrong", product: productFixture, productId: "BR-001", orderId: "ORDER-001" })).ok, false);
  }
  assert.equal(app.sheets.get("Inventory").getLastRow(), 2);
  assert.equal(app.sheets.get("Orders").getLastRow(), 2);
  assert.equal(JSON.parse(app.get({ action: "adminResult", token: "wrong", requestId: randomUUID() })).ok, false);
});

test("order edit preserves omitted shipment fields and allows clearing a courier link", () => {
  const app = createAppsScript(); app.seed("Orders", orderFixture);
  const update = mutation("updateOrder", { orderId: "ORDER-001", customerAddress: "New address", shipmentCompanyLink: "" });
  const result = app.post(update);
  assert.equal(result.ok, true);
  assert.equal(result.order.customerAddress, "New address");
  assert.equal(result.order.shipmentId, "TRACK-1");
  assert.equal(result.order.shipmentCompanyLink, "");
  assert.equal(result.order.status, "Packed");
  assert.deepEqual(JSON.parse(app.get({ action: "adminResult", token: update.token, requestId: update.requestId })), result);
});

test("order delete removes only the chosen record and tracking no longer finds it", () => {
  const app = createAppsScript(); app.seed("Orders", orderFixture);
  app.seed("Orders", { ...orderFixture, orderId: "ORDER-002" });
  assert.equal(app.post(mutation("deleteOrder", { orderId: "ORDER-001" })).ok, true);
  const listed = JSON.parse(app.get({ action: "orders", token: "test-admin-key" }));
  assert.equal(listed.orders.length, 1); assert.equal(listed.orders[0].orderId, "ORDER-002");
  assert.equal(JSON.parse(app.get({ action: "tracking", orderId: "ORDER-001" })).found, false);
});

test("failed image upload returns a failed receipt without changing inventory", () => {
  const app = createAppsScript(); app.seed("Inventory", productFixture);
  const request = mutation("updateInventory", { product: { ...productFixture, price: "999", imageFile: { data: "AAAA", name: "image.png" } } });
  const result = app.post(request);
  assert.equal(result.ok, false); assert.match(result.error, /Image upload failed/);
  assert.equal(app.sheets.get("Inventory").rows[1][5], "499");
  assert.equal(JSON.parse(app.get({ action: "adminResult", token: request.token, requestId: request.requestId })).ok, false);
});

test("missing IDs, duplicate IDs and invalid courier links fail without changing records", () => {
  const app = createAppsScript(); app.seed("Inventory", productFixture); app.seed("Orders", orderFixture);
  assert.equal(app.post(mutation("deleteInventory", { productId: "" })).ok, false);
  assert.equal(app.post(mutation("inventory", { product: productFixture })).ok, false);
  assert.equal(app.post(mutation("updateOrder", { orderId: "ORDER-001", shipmentCompanyLink: "javascript:alert(1)" })).ok, false);
  app.seed("Inventory", productFixture);
  assert.equal(app.post(mutation("deleteInventory", { productId: "BR-001" })).ok, false);
  assert.equal(app.sheets.get("Inventory").getLastRow(), 3);
});
