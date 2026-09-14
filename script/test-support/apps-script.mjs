import { readFileSync } from "node:fs";
import vm from "node:vm";

class Sheet {
  rows = [];
  getLastRow() { return this.rows.length; }
  getLastColumn() { return Math.max(0, ...this.rows.map((row) => row.length)); }
  appendRow(row) { this.rows.push([...row]); }
  deleteRow(row) { this.rows.splice(row - 1, 1); }
  getDataRange() { return this.getRange(1, 1, this.getLastRow(), this.getLastColumn()); }
  getRange(row, column, height = 1, width = 1) {
    return {
      getValues: () => Array.from({ length: height }, (_, y) =>
        Array.from({ length: width }, (_, x) => this.rows[row - 1 + y]?.[column - 1 + x] ?? "")),
      setValues: (values) => values.forEach((cells, y) => cells.forEach((value, x) => {
        this.rows[row - 1 + y] ||= [];
        this.rows[row - 1 + y][column - 1 + x] = value;
      })),
      setValue: (value) => { this.rows[row - 1][column - 1] = value; },
    };
  }
}

export function createAppsScript() {
  const sheets = new Map();
  const receipts = new Map();
  const properties = new Map([["ORDER_READ_TOKEN", "test-admin-key"]]);
  const spreadsheet = {
    getSheetByName: (name) => sheets.get(name),
    insertSheet: (name) => { const sheet = new Sheet(); sheets.set(name, sheet); return sheet; },
  };
  const context = vm.createContext({
    SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet, flush() {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (key) => properties.get(key) }) },
    CacheService: { getScriptCache: () => ({ get: (key) => receipts.get(key), put: (key, value) => receipts.set(key, value) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: {
      MimeType: { JSON: "application/json", JAVASCRIPT: "application/javascript" },
      createTextOutput: (content) => ({ getContent: () => content, setMimeType() { return this; } }),
    },
    Utilities: { base64Decode: () => { throw new Error("Drive permission denied"); } },
  });
  vm.runInContext(readFileSync(new URL("../../docs/google-apps-script.js", import.meta.url), "utf8"), context);
  context.ensureRequiredSheets_();
  return {
    context, sheets, properties, receipts,
    post: (payload) => JSON.parse(context.doPost({ postData: { contents: JSON.stringify(payload) } }).getContent()),
    get: (params) => context.doGet({ parameter: params }).getContent(),
    seed: (name, record) => context.appendObjectRow_(sheets.get(name), record),
  };
}

export const productFixture = {
  id: "BR-001", name: "Test bracelet", category: "Bracelet", price: "499",
  image: "/svarnikaa-logo.png", stock: "4", description: "Test fixture", metal: "Gold plated",
};

export const orderFixture = {
  orderId: "ORDER-001", customerName: "Test Customer", customerPhone: "9999999999",
  customerEmail: "test@example.com", customerAddress: "Test address", total: 499,
  items: "Test bracelet x1 (499)", status: "Packed", shipmentId: "TRACK-1",
  shipmentCompanyLink: "https://example.com/track", createdAt: "2026-09-13T10:00:00.000Z",
};
