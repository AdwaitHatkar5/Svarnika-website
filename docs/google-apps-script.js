const INVENTORY_SHEET_NAME = "Inventory";
const ORDERS_SHEET_NAME = "Orders";
const OWNER_EMAIL_PROPERTY = "OWNER_EMAIL";

function doPost(e) {
  const payload = parsePayload_(e);

  if (!payload || !payload.action) {
    return json_({ ok: false, error: "Missing action" });
  }

  if (payload.action === "inventory") {
    return saveInventory_(payload.product);
  }

  if (payload.action === "order") {
    return saveOrder_(payload);
  }

  return json_({ ok: false, error: "Unknown action" });
}

function parsePayload_(e) {
  if (e && e.parameter && e.parameter.payload) {
    return JSON.parse(e.parameter.payload);
  }

  if (e && e.postData && e.postData.contents) {
    return JSON.parse(e.postData.contents);
  }

  return null;
}

function saveInventory_(product) {
  const sheet = getSheet_(INVENTORY_SHEET_NAME, [
    "id",
    "name",
    "category",
    "metal",
    "weight",
    "price",
    "image",
    "description",
    "stock",
  ]);

  sheet.appendRow([
    product.id || new Date().getTime(),
    product.name || "",
    product.category || "",
    product.metal || "",
    product.weight || "",
    product.price || "",
    product.image || "",
    product.description || "",
    product.stock || "In stock",
  ]);

  return json_({ ok: true });
}

function saveOrder_(order) {
  const sheet = getSheet_(ORDERS_SHEET_NAME, [
    "createdAt",
    "orderId",
    "customerName",
    "customerPhone",
    "customerAddress",
    "paymentRef",
    "upiId",
    "total",
    "items",
    "status",
  ]);

  const itemsText = (order.items || [])
    .map(function (item) {
      return item.name + " x" + item.quantity + " (" + item.price + ")";
    })
    .join(", ");

  sheet.appendRow([
    new Date(),
    order.orderId || "",
    order.customerName || "",
    order.customerPhone || "",
    order.customerAddress || "",
    order.paymentRef || "",
    order.upiId || "",
    order.total || "",
    itemsText,
    "Payment reference received",
  ]);

  const ownerEmail = PropertiesService.getScriptProperties().getProperty(
    OWNER_EMAIL_PROPERTY,
  );

  if (ownerEmail) {
    MailApp.sendEmail({
      to: ownerEmail,
      subject: "New Svarnikaa order " + (order.orderId || ""),
      htmlBody:
        "<h2>New Svarnikaa order</h2>" +
        "<p><b>Order ID:</b> " +
        escapeHtml_(order.orderId || "") +
        "</p>" +
        "<p><b>Name:</b> " +
        escapeHtml_(order.customerName || "") +
        "</p>" +
        "<p><b>Phone:</b> " +
        escapeHtml_(order.customerPhone || "") +
        "</p>" +
        "<p><b>Address:</b> " +
        escapeHtml_(order.customerAddress || "") +
        "</p>" +
        "<p><b>UPI Reference:</b> " +
        escapeHtml_(order.paymentRef || "") +
        "</p>" +
        "<p><b>Total:</b> INR " +
        escapeHtml_(String(order.total || "")) +
        "</p>" +
        "<p><b>Items:</b> " +
        escapeHtml_(itemsText) +
        "</p>",
    });
  }

  return json_({ ok: true });
}

function getSheet_(name, headers) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(name);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }

  return sheet;
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function escapeHtml_(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
