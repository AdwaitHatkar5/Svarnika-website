import pendantNecklace from "@assets/generated_images/small_diamond_emerald_pendant_necklace.png";

export type StoreProduct = {
  id: number;
  name: string;
  metal: string;
  weight: string;
  price: string;
  description: string;
  image: string;
  category?: string;
  stock?: string;
  originalPrice?: string;
  offerLabel?: string;
  offerText?: string;
};

export type CartItem = StoreProduct & {
  quantity: number;
};

export type CheckoutPayload = {
  action: "order";
  orderId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  customerAddress: string;
  paymentRef: string;
  paymentProofUrl?: string;
  paymentProofFile: {
    name: string;
    mimeType: string;
    data: string;
  };
  upiId: string;
  total: number;
  items: Array<{
    id: number;
    name: string;
    price: string;
    quantity: number;
  }>;
};

export type InventoryPayload = {
  action: "inventory";
  product: Omit<StoreProduct, "id"> & {
    id?: number | string;
    imageFile?: {
      name: string;
      mimeType: string;
      data: string;
    };
  };
};

export type OrderUpdatePayload = {
  action: "updateOrder";
  token: string;
  orderId: string;
  status?: string;
  shipmentId?: string;
  shipmentCompanyLink?: string;
};

export type TrackingResponse = {
  ok: boolean;
  found?: boolean;
  orderId?: string;
  status?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  error?: string;
};

export type AdminOrder = {
  createdAt: string;
  orderId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  paymentRef: string;
  paymentProofUrl: string;
  paymentProofFileId: string;
  paymentProofFileName: string;
  upiId: string;
  total: string | number;
  items: string;
  status: string;
  shipmentId: string;
  shipmentCompanyLink: string;
};

export type OrdersResponse = {
  ok: boolean;
  error?: string;
  rowCount?: number;
  returned?: number;
  orders?: AdminOrder[];
};

export const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function parsePrice(value: string) {
  const parsed = Number(String(value).replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatPrice(value: string | number) {
  const amount = typeof value === "number" ? value : parsePrice(value);
  return amount > 0 ? currency.format(amount) : "Price on request";
}

export function parseCsv(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

export function productsFromCsv(csv: string): StoreProduct[] {
  const [headers, ...rows] = parseCsv(csv);
  if (!headers?.length) return [];

  const keys = headers.map((header) => header.trim().toLowerCase());

  return rows
    .map((row, index) => {
      const entry = keys.reduce<Record<string, string>>((current, key, keyIndex) => {
        current[key] = row[keyIndex] || "";
        return current;
      }, {});

      return {
        id: Number(entry.id) || index + 1,
        name: entry.name || entry.product || "Untitled piece",
        metal: entry.metal || entry.material || "Gold plated",
        weight: entry.weight || "",
        price: entry.price || entry.amount || "",
        description: entry.description || entry.details || "",
        image: normalizeImageUrl(entry.image || entry.image_url || entry.photo || "") || pendantNecklace,
        category: normalizeCategory(entry.category || "Jewellery"),
        stock: normalizeStock(entry.stock || entry.available || "In stock"),
        originalPrice: entry.originalprice || entry.original_price || entry.mrp || "",
        offerLabel: entry.offerlabel || entry.offer_label || entry.discount || entry.off || "",
        offerText: entry.offertext || entry.offer_text || entry.offer || "",
      };
    })
    .filter((product) => product.name && product.image);
}

function normalizeCategory(value: string) {
  const category = value.trim();
  if (!category) return "Jewellery";

  if (category.toLowerCase() === "braclet") {
    return "Bracelet";
  }

  return category;
}

function normalizeStock(value: string) {
  const stock = value.trim();
  if (!stock) return "In stock";
  const stockCount = Number(stock);

  if (Number.isFinite(stockCount)) {
    return stockCount > 0 ? `${stockCount} available` : "Out of stock";
  }

  if (stock === "1" || stock.toLowerCase() === "yes") {
    return "In stock";
  }

  if (stock === "0" || stock.toLowerCase() === "no") {
    return "Out of stock";
  }

  return stock;
}

function normalizeImageUrl(value = "") {
  const imageUrl = String(value).trim();
  if (!imageUrl) return "";

  const driveFileId =
    imageUrl.match(/drive\.google\.com\/file\/d\/([^/]+)/)?.[1] ||
    imageUrl.match(/[?&]id=([^&]+)/)?.[1];

  if (driveFileId && imageUrl.includes("drive.google.com")) {
    return `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w1200`;
  }

  return imageUrl;
}

export function createOrderId() {
  const date = new Date();
  const stamp = date
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SV-${stamp}-${suffix}`;
}

export function postToGoogleScript(
  scriptUrl: string,
  payload: CheckoutPayload | InventoryPayload | OrderUpdatePayload,
) {
  const body = new URLSearchParams({
    payload: JSON.stringify(payload),
  });

  return fetch(scriptUrl, {
    method: "POST",
    mode: "no-cors",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body,
  });
}

function fetchGoogleScriptJsonp<T>(
  scriptUrl: string,
  params: Record<string, string | number>,
  timeoutMs = 10000,
) {
  const callbackName = `__svarnikaaJsonp_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;

  const url = new URL(scriptUrl);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });
  url.searchParams.set("callback", callbackName);

  return new Promise<T>((resolve, reject) => {
    const script = document.createElement("script");
    const callbacks = window as typeof window &
      Record<string, (response: T) => void>;

    function cleanup() {
      window.clearTimeout(timeoutId);
      delete callbacks[callbackName];
      script.remove();
    }

    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error("Google Script request timed out"));
    }, timeoutMs);

    callbacks[callbackName] = (response: T) => {
      cleanup();
      resolve(response);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Google Script request failed"));
    };

    script.src = url.toString();
    document.body.appendChild(script);
  });
}

export function fetchTrackingByOrderId(scriptUrl: string, orderId: string) {
  return fetchGoogleScriptJsonp<TrackingResponse>(scriptUrl, {
    action: "tracking",
    orderId,
  });
}

export function fetchAdminOrders(scriptUrl: string, token: string, limit = 25) {
  return fetchGoogleScriptJsonp<OrdersResponse>(scriptUrl, {
    action: "orders",
    token,
    limit,
  });
}
