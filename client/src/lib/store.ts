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
  };
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
        image: normalizeImageUrl(entry.image || entry.image_url || entry.photo) || pendantNecklace,
        category: entry.category || "Jewellery",
        stock: entry.stock || entry.available || "In stock",
      };
    })
    .filter((product) => product.name && product.image);
}

function normalizeImageUrl(value: string) {
  const imageUrl = value.trim();
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
  payload: CheckoutPayload | InventoryPayload,
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

export function fetchTrackingByOrderId(scriptUrl: string, orderId: string) {
  const callbackName = `__svarnikaaTracking_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;

  const url = new URL(scriptUrl);
  url.searchParams.set("action", "tracking");
  url.searchParams.set("orderId", orderId);
  url.searchParams.set("callback", callbackName);

  return new Promise<TrackingResponse>((resolve, reject) => {
    const script = document.createElement("script");
    const callbacks = window as typeof window &
      Record<string, (response: TrackingResponse) => void>;

    function cleanup() {
      window.clearTimeout(timeoutId);
      delete callbacks[callbackName];
      script.remove();
    }

    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error("Tracking lookup timed out"));
    }, 10000);

    callbacks[callbackName] = (response: TrackingResponse) => {
      cleanup();
      resolve(response);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Tracking lookup failed"));
    };

    script.src = url.toString();
    document.body.appendChild(script);
  });
}
