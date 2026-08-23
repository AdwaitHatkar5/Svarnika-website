import { existsSync, readFileSync } from "node:fs";

const env = {
  ...loadEnvFile(".env"),
  ...process.env,
};

const sheetCsvUrl = env.VITE_GOOGLE_SHEET_CSV_URL || "";
const scriptUrl = env.VITE_GOOGLE_APPS_SCRIPT_URL || "";

function loadEnvFile(path) {
  if (!existsSync(path)) return {};

  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .reduce((values, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return values;

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) return values;

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();
      values[key] = value;
      return values;
    }, {});
}

function countCsvRows(csv) {
  return csv
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter((row) => row.replace(/,/g, "").trim()).length;
}

async function checkCsv() {
  if (!sheetCsvUrl) {
    return {
      ok: false,
      label: "CSV",
      message: "Missing VITE_GOOGLE_SHEET_CSV_URL",
    };
  }

  const response = await fetch(sheetCsvUrl);
  const csv = await response.text();
  const firstLine = csv.split(/\r?\n/)[0] || "";
  const rowCount = countCsvRows(csv);

  return {
    ok: response.ok && rowCount > 0,
    label: "CSV",
    message: `HTTP ${response.status}; ${rowCount} row(s); headers: ${firstLine}`,
  };
}

async function checkScript() {
  if (!scriptUrl) {
    return {
      ok: false,
      label: "Apps Script",
      message: "Missing VITE_GOOGLE_APPS_SCRIPT_URL",
    };
  }

  const response = await fetch(scriptUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "ping" }),
    redirect: "follow",
  });
  const text = await response.text();

  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }

  return {
    ok: response.ok && Boolean(parsed?.ok),
    label: "Apps Script",
    message: parsed
      ? `HTTP ${response.status}; ${JSON.stringify(parsed)}`
      : `HTTP ${response.status}; non-JSON response: ${text.slice(0, 120)}`,
  };
}

async function main() {
  const results = await Promise.all([checkCsv(), checkScript()]);

  for (const result of results) {
    const status = result.ok ? "OK" : "CHECK";
    console.log(`[${status}] ${result.label}: ${result.message}`);
  }

  if (results.some((result) => !result.ok)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[ERROR] ${error.message}`);
  process.exitCode = 1;
});
