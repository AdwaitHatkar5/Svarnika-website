const INVENTORY_SHEET_NAME = "Inventory";
const ORDERS_SHEET_NAME = "Orders";
const OWNER_EMAIL_PROPERTY = "OWNER_EMAIL";
const ORDER_READ_TOKEN_PROPERTY = "ORDER_READ_TOKEN";

function doGet(e) {
  if (e && e.parameter && e.parameter.action === "tracking") {
    return lookupTracking_(e.parameter.orderId || "", e.parameter.callback || "");
  }

  return healthCheck_();
}

function doPost(e) {
  const parsed = parsePayload_(e);

  if (parsed.error) {
    return json_({ ok: false, error: parsed.error });
  }

  const payload = parsed.payload;

  if (!payload || !payload.action) {
    return json_({ ok: false, error: "Missing action" });
  }

  if (payload.action === "ping") {
    return healthCheck_();
  }

  if (payload.action === "orders") {
    return listOrders_(payload.token || "", payload.limit || 10);
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
  let rawPayload = "";

  if (e && e.postData && e.postData.contents) {
    rawPayload = e.postData.contents;
  }

  if (e && e.parameter && e.parameter.payload) {
    rawPayload = e.parameter.payload;
  }

  if (!rawPayload) {
    return { payload: null };
  }

  try {
    return { payload: JSON.parse(rawPayload) };
  } catch (error) {
    return { payload: null, error: "Invalid JSON payload" };
  }
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

  appendObjectRow_(sheet, {
    id: product.id || new Date().getTime(),
    name: product.name || "",
    category: product.category || "",
    metal: product.metal || "",
    weight: product.weight || "",
    price: product.price || "",
    image: product.image || "",
    description: product.description || "",
    stock: product.stock || "In stock",
  });

  return json_({ ok: true });
}

function saveOrder_(order) {
  const sheet = getSheet_(ORDERS_SHEET_NAME, [
    "createdAt",
    "orderId",
    "customerName",
    "customerEmail",
    "customerPhone",
    "customerAddress",
    "paymentRef",
    "paymentProofUrl",
    "upiId",
    "total",
    "items",
    "status",
    "shipmentId",
    "shipmentCompanyLink",
  ]);

  const itemsText = (order.items || [])
    .map(function (item) {
      return item.name + " x" + item.quantity + " (" + item.price + ")";
    })
    .join(", ");

  appendObjectRow_(sheet, {
    createdAt: new Date(),
    orderId: order.orderId || "",
    customerName: order.customerName || "",
    customerEmail: order.customerEmail || "",
    customerPhone: order.customerPhone || "",
    customerAddress: order.customerAddress || "",
    paymentRef: order.paymentRef || "",
    paymentProofUrl: order.paymentProofUrl || "",
    upiId: order.upiId || "",
    total: order.total || "",
    items: itemsText,
    status: "Payment proof received",
    shipmentId: "",
    shipmentCompanyLink: "",
  });

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
        "<p><b>Email:</b> " +
        escapeHtml_(order.customerEmail || "") +
        "</p>" +
        "<p><b>Address:</b> " +
        escapeHtml_(order.customerAddress || "") +
        "</p>" +
        "<p><b>UPI Reference:</b> " +
        escapeHtml_(order.paymentRef || "") +
        "</p>" +
        "<p><b>Payment Proof:</b> " +
        proofLinkHtml_(order.paymentProofUrl || "") +
        "</p>" +
        "<p><b>Total:</b> INR " +
        escapeHtml_(String(order.total || "")) +
        "</p>" +
        "<p><b>Items:</b> " +
        escapeHtml_(itemsText) +
        "</p>",
    });
  }

  if (order.customerEmail && isValidEmail_(order.customerEmail)) {
    MailApp.sendEmail({
      to: order.customerEmail,
      subject: "Svarnikaa order received " + (order.orderId || ""),
      htmlBody:
        "<h2>Thank you for your Svarnikaa order</h2>" +
        "<p>We have received your order, UPI reference, and payment proof.</p>" +
        "<p><b>Order ID:</b> " +
        escapeHtml_(order.orderId || "") +
        "</p>" +
        "<p><b>Status:</b> Payment proof received</p>" +
        "<p>Keep this order ID to check shipment tracking after dispatch.</p>",
    });
  }

  return json_({ ok: true });
}

function lookupTracking_(orderId, callback) {
  if (!orderId) {
    return jsonOrJsonp_({ ok: false, error: "Missing orderId" }, callback);
  }

  const sheet = getSheet_(ORDERS_SHEET_NAME, [
    "createdAt",
    "orderId",
    "customerName",
    "customerEmail",
    "customerPhone",
    "customerAddress",
    "paymentRef",
    "paymentProofUrl",
    "upiId",
    "total",
    "items",
    "status",
    "shipmentId",
    "shipmentCompanyLink",
  ]);
  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return jsonOrJsonp_({ ok: true, found: false }, callback);
  }

  const headers = values[0].map(function (header) {
    return String(header).trim();
  });
  const normalizedOrderId = String(orderId).trim().toLowerCase();

  for (let rowIndex = values.length - 1; rowIndex >= 1; rowIndex -= 1) {
    const row = rowToObject_(headers, values[rowIndex]);
    const rowOrderId = String(row.orderId || "").trim().toLowerCase();

    if (rowOrderId === normalizedOrderId) {
      const trackingNumber =
        row.shipmentId || row.shipmentTrackNo || row.trackingNumber || row.trackingNo || "";
      const trackingUrl =
        row.shipmentCompanyLink ||
        row.shipmentUrl ||
        row.trackingUrl ||
        row.trackingLink ||
        "";

      return jsonOrJsonp_(
        {
          ok: true,
          found: true,
          orderId: row.orderId || orderId,
          status: row.status || "Order received",
          trackingNumber: trackingNumber,
          trackingUrl: trackingUrl,
        },
        callback,
      );
    }
  }

  return jsonOrJsonp_({ ok: true, found: false }, callback);
}

function listOrders_(token, limit) {
  const expectedToken = PropertiesService.getScriptProperties().getProperty(
    ORDER_READ_TOKEN_PROPERTY,
  );

  if (!expectedToken) {
    return json_({
      ok: false,
      error: "ORDER_READ_TOKEN script property is not set",
    });
  }

  if (!token || token !== expectedToken) {
    return json_({ ok: false, error: "Unauthorized" });
  }

  const sheet = getSheet_(ORDERS_SHEET_NAME, [
    "createdAt",
    "orderId",
    "customerName",
    "customerEmail",
    "customerPhone",
    "customerAddress",
    "paymentRef",
    "paymentProofUrl",
    "upiId",
    "total",
    "items",
    "status",
    "shipmentId",
    "shipmentCompanyLink",
  ]);
  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return json_({ ok: true, rowCount: 0, orders: [] });
  }

  const headers = values[0].map(function (header) {
    return String(header).trim();
  });
  const safeLimit = Math.max(1, Math.min(Number(limit) || 10, 50));
  const orders = values
    .slice(1)
    .slice(-safeLimit)
    .reverse()
    .map(function (row) {
      const order = rowToObject_(headers, row);
      return {
        createdAt: formatCell_(order.createdAt),
        orderId: order.orderId || "",
        customerName: order.customerName || "",
        customerEmail: order.customerEmail || "",
        customerPhone: order.customerPhone || "",
        customerAddress: order.customerAddress || "",
        paymentRef: order.paymentRef || "",
        paymentProofUrl: order.paymentProofUrl || "",
        upiId: order.upiId || "",
        total: order.total || "",
        items: order.items || "",
        status: order.status || "",
        shipmentId: order.shipmentId || order.shipmentTrackNo || "",
        shipmentCompanyLink:
          order.shipmentCompanyLink || order.shipmentUrl || order.trackingUrl || "",
      };
    });

  return json_({
    ok: true,
    rowCount: values.length - 1,
    returned: orders.length,
    orders: orders,
  });
}

function getSheet_(name, headers) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(name);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  } else {
    const existingHeaders = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getValues()[0]
      .map(function (header) {
        return String(header).trim();
      });
    const missingHeaders = headers.filter(function (header) {
      return existingHeaders.indexOf(header) === -1;
    });

    if (missingHeaders.length) {
      sheet
        .getRange(1, existingHeaders.length + 1, 1, missingHeaders.length)
        .setValues([missingHeaders]);
    }
  }

  return sheet;
}

function appendObjectRow_(sheet, rowData) {
  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .map(function (header) {
      return String(header).trim();
    });
  const row = headers.map(function (header) {
    return rowData[header] === undefined ? "" : rowData[header];
  });

  sheet.appendRow(row);
}

function rowToObject_(headers, row) {
  return headers.reduce(function (current, header, index) {
    current[header] = row[index] || "";
    return current;
  }, {});
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function jsonOrJsonp_(data, callback) {
  if (callback && isSafeCallback_(callback)) {
    return ContentService.createTextOutput(
      callback + "(" + JSON.stringify(data) + ");",
    ).setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return json_(data);
}

function isSafeCallback_(callback) {
  return /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback);
}

function healthCheck_() {
  ensureRequiredSheets_();

  const inventoryStats = getSheetStats_(INVENTORY_SHEET_NAME);
  const orderStats = getSheetStats_(ORDERS_SHEET_NAME);

  return json_({
    ok: true,
    service: "Svarnikaa Google Apps Script",
    actions: ["ping", "inventory", "order", "tracking", "orders"],
    inventorySheet: INVENTORY_SHEET_NAME,
    ordersSheet: ORDERS_SHEET_NAME,
    inventoryRows: inventoryStats.dataRows,
    orderRows: orderStats.dataRows,
    inventoryHeaders: inventoryStats.headers,
    orderHeaders: orderStats.headers,
    timestamp: new Date().toISOString(),
  });
}

function ensureRequiredSheets_() {
  getSheet_(INVENTORY_SHEET_NAME, [
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

  getSheet_(ORDERS_SHEET_NAME, [
    "createdAt",
    "orderId",
    "customerName",
    "customerEmail",
    "customerPhone",
    "customerAddress",
    "paymentRef",
    "paymentProofUrl",
    "upiId",
    "total",
    "items",
    "status",
    "shipmentId",
    "shipmentCompanyLink",
  ]);
}

function getSheetStats_(name) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(name);

  if (!sheet) {
    return {
      exists: false,
      dataRows: 0,
      headers: [],
    };
  }

  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  const headers =
    lastRow && lastColumn
      ? sheet
          .getRange(1, 1, 1, lastColumn)
          .getValues()[0]
          .map(function (header) {
            return String(header).trim();
          })
      : [];

  return {
    exists: true,
    dataRows: Math.max(0, lastRow - 1),
    headers: headers,
  };
}

function escapeHtml_(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function proofLinkHtml_(value) {
  const url = String(value || "").trim();
  if (!url) return "";

  return (
    '<a href="' +
    escapeHtml_(url) +
    '" target="_blank" rel="noopener noreferrer">Open payment proof</a>'
  );
}

function isValidEmail_(value) {
  const email = String(value || "").trim();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function formatCell_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return value.toISOString();
  }

  return value || "";
}
