import { existsSync, readFileSync } from "node:fs";

const env = {
  ...loadEnvFile(".env"),
  ...process.env,
};

const scriptUrl = env.VITE_GOOGLE_APPS_SCRIPT_URL;
const imageUrl =
  "https://drive.google.com/thumbnail?id=1QkX1G8W11ccnxokUi8AUPXE07PQ4g5pq&sz=w1200";
const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);

if (!scriptUrl) {
  throw new Error("Missing VITE_GOOGLE_APPS_SCRIPT_URL");
}

function loadEnvFile(path) {
  if (!existsSync(path)) return {};

  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .reduce((values, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return values;

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) return values;

      values[trimmed.slice(0, separatorIndex).trim()] = trimmed
        .slice(separatorIndex + 1)
        .trim();
      return values;
    }, {});
}

async function post(payload) {
  const response = await fetch(scriptUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response: ${text.slice(0, 120)}`);
  }
}

const testProducts = [
  "TEST Pearl Vacation Bracelet",
  "TEST Emerald Charm Bracelet",
  "TEST Minimal Gold Bracelet",
  "TEST Diamond Stack Bracelet",
].map((name, index) => ({
  action: "inventory",
  product: {
    id: Number(`${Date.now()}${index}`),
    name,
    category: "Bracelet",
    metal: "Gold Plated & Crystal",
    weight: "8g",
    price: "1400",
    image: imageUrl,
    description: "Smoke test bracelet row. Remove after verification.",
    stock: "10",
  },
}));

const testOrders = Array.from({ length: 5 }, (_, index) => ({
  action: "order",
  orderId: `TEST-SV-${timestamp}-${String(index + 1).padStart(2, "0")}`,
  customerName: `TEST Customer ${index + 1}`,
  customerEmail: "",
  customerPhone: `999990000${index}`,
  customerAddress: "TEST address, smoke flow verification",
  paymentRef: `TEST-UPI-${timestamp}-${String(index + 1).padStart(2, "0")}`,
  upiId: env.VITE_UPI_ID || "your-upi-id@upi",
  total: 1400,
  items: [
    {
      id: index + 1,
      name: testProducts[index % testProducts.length].product.name,
      price: "1400",
      quantity: 1,
    },
  ],
}));

for (const payload of testProducts) {
  const result = await post(payload);
  console.log(`[inventory] ${payload.product.name}: ${JSON.stringify(result)}`);
}

for (const payload of testOrders) {
  const result = await post(payload);
  console.log(`[order] ${payload.orderId}: ${JSON.stringify(result)}`);
}

const health = await post({ action: "ping" });
console.log(`[health] ${JSON.stringify(health)}`);
