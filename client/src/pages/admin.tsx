import { Layout } from "@/components/layout";
import { useToast } from "@/hooks/use-toast";
import {
  AdminOrder,
  InventoryPayload,
  StoreProduct,
  fetchAdminOrders,
  formatPrice,
  parsePrice,
  postToGoogleScript,
  productsFromCsv,
} from "@/lib/store";
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  Gem,
  Image as ImageIcon,
  Lock,
  PackageCheck,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Search,
  Send,
  Truck,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN || "";
const SHEET_CSV_URL = import.meta.env.VITE_GOOGLE_SHEET_CSV_URL || "";
const DEFAULT_ORDER_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwrVQRRaGE6gOiGWmv4OVsx4JgvB30El7QKRVZxvMCrCbP0q8qoUMANdncrzJW585WX/exec";
const ORDER_SCRIPT_URL = import.meta.env.VITE_GOOGLE_APPS_SCRIPT_URL || DEFAULT_ORDER_SCRIPT_URL;
const MAX_INVENTORY_IMAGE_BYTES = 4 * 1024 * 1024;

const company = {
  name: "SVARNIKAA JEWELS",
  address: "Tejomegh Bldg, Near Datta Mandir, Ramedi, Vasai-West, Palghar, Maharashtra",
  pincode: "401201",
};

const orderStatuses = [
  "Payment proof received",
  "Payment verified",
  "Packed",
  "Shipped",
  "Delivered",
  "Cancelled",
];

const emptyProduct: InventoryPayload["product"] = {
  id: "",
  name: "",
  category: "",
  metal: "",
  weight: "",
  price: "",
  originalPrice: "",
  offerLabel: "",
  offerText: "",
  image: "",
  description: "",
  stock: "In stock",
};

type AdminTab = "orders" | "inventory" | "invoice";
type InvoiceMode = "single-customer" | "two-per-page";
type OrderDraft = Pick<AdminOrder, "status" | "shipmentId" | "shipmentCompanyLink">;
type InvoiceItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

function cacheBust(url: string) {
  if (!url) return "";
  const nextUrl = new URL(url);
  nextUrl.searchParams.set("_", String(Date.now()));
  return nextUrl.toString();
}

function formatDate(value?: string) {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleDateString("en-GB").replace(/\//g, "-");
  }

  return date.toLocaleDateString("en-GB").replace(/\//g, "-");
}

function invoiceNumber(order: AdminOrder, index = 0) {
  const suffix = String(order.orderId || index + 1)
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(-4)
    .padStart(4, "0");
  return `SVNJ/${new Date().getFullYear().toString().slice(-2)}/${suffix}`;
}

function parseOrderItems(order: AdminOrder): InvoiceItem[] {
  const rawItems = String(order.items || "").trim();
  const fallbackTotal = parsePrice(String(order.total || ""));

  if (!rawItems) {
    return [
      {
        name: "Jewellery order",
        quantity: 1,
        unitPrice: fallbackTotal,
        total: fallbackTotal,
      },
    ];
  }

  return rawItems.split(/\s*,\s*/).map((item) => {
    const match = item.match(/^(.*?)\s+x(\d+)\s+\((.*?)\)$/i);
    const name = match?.[1]?.trim() || item;
    const quantity = Number(match?.[2] || 1);
    const unitPrice = parsePrice(match?.[3] || String(order.total || ""));
    const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;

    return {
      name,
      quantity: safeQuantity,
      unitPrice,
      total: unitPrice * safeQuantity,
    };
  });
}

function escapeHtml(value: string | number) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(new Error("File could not be read"));
    reader.readAsDataURL(file);
  });
}

function invoiceBlock(order: AdminOrder, index: number, compact = false) {
  const items = parseOrderItems(order);
  const itemTotal = items.reduce((total, item) => total + item.total, 0);
  const grandTotal = parsePrice(String(order.total || "")) || itemTotal;
  const rows = items
    .map(
      (item, rowIndex) => `
        <tr>
          <td>${rowIndex + 1}</td>
          <td>${escapeHtml(item.name)}</td>
          <td>${item.quantity}</td>
          <td></td>
          <td>${escapeHtml(formatPrice(item.unitPrice))}</td>
          <td>${escapeHtml(formatPrice(item.total))}</td>
        </tr>
      `,
    )
    .join("");

  if (compact) {
    return `
      <section class="invoice compact">
        <div class="bar"></div>
        <div class="compact-head">
          <div>
            <h1>${company.name}</h1>
            <p>${company.address}</p>
            <p>Pincode: ${company.pincode}</p>
          </div>
          <div class="compact-badges">
            <span>FRAGILE</span>
            <span>GLASS INSIDE</span>
            <span>HANDLE WITH CARE</span>
            <span>PRE-PAID</span>
          </div>
        </div>
        <div class="compact-meta">
          <div class="deliver">
            <h2>Deliver To</h2>
            <p><b>Name:</b> ${escapeHtml(order.customerName || "-")}</p>
            <p><b>Address:</b> ${escapeHtml(order.customerAddress || "-")}</p>
            <p><b>Contact:</b> ${escapeHtml(order.customerPhone || "-")}</p>
          </div>
          <div class="invoice-meta">
            <p><b>Invoice No:</b> ${invoiceNumber(order, index)}</p>
            <p><b>Invoice Date:</b> ${formatDate(order.createdAt)}</p>
            <p><b>Order ID:</b> ${escapeHtml(order.orderId || "-")}</p>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Purchased Items</th>
              <th>Qty</th>
              <th>Disc</th>
              <th>Unit price</th>
              <th>Total price</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
            <tr><td></td><td></td><td></td><td></td><td><b>Total Price:</b></td><td><b>${escapeHtml(formatPrice(grandTotal))}</b></td></tr>
            <tr><td></td><td colspan="4"><b>Total Price :</b></td><td><b>${escapeHtml(formatPrice(grandTotal))}</b></td></tr>
          </tbody>
        </table>
      </section>
    `;
  }

  return `
    <section class="invoice ${compact ? "compact" : ""}">
      <div class="bar"></div>
      <div class="top-grid">
        <div>
          <h1>${company.name}</h1>
          <p>${company.address}</p>
          <p>Pincode: ${company.pincode}</p>
          <div class="deliver">
            <h2>Deliver To</h2>
            <p><b>Name:</b> ${escapeHtml(order.customerName || "-")}</p>
            <p><b>Address:</b> ${escapeHtml(order.customerAddress || "-")}</p>
            <p><b>Contact:</b> ${escapeHtml(order.customerPhone || "-")}</p>
          </div>
        </div>
        <div class="labels">
          <span>FRAGILE</span>
          <span>GLASS INSIDE</span>
          <span>HANDLE WITH CARE</span>
        </div>
      </div>

      <div class="bar middle"></div>
      <div class="invoice-head">
        <div>
          <h1>${company.name}</h1>
          <p>${company.address}</p>
          <p>Pincode: ${company.pincode}</p>
        </div>
        <div>
          <span class="paid">PRE-PAID</span>
          <p><b>Invoice No:</b> ${invoiceNumber(order, index)}</p>
          <p><b>Invoice Date:</b> ${formatDate(order.createdAt)}</p>
          <p><b>Order ID:</b> ${escapeHtml(order.orderId || "-")}</p>
        </div>
      </div>
      <div class="buyer">
        <p><b>Name :</b> ${escapeHtml(order.customerName || "-")}</p>
        <p><b>Address :</b> ${escapeHtml(order.customerAddress || "-")}</p>
        <p><b>Contact:</b> ${escapeHtml(order.customerPhone || "-")}</p>
      </div>

      <table>
        <thead>
          <tr>
            <th></th>
            <th>Purchased Items</th>
            <th>Qty</th>
            <th>Disc</th>
            <th>Unit price</th>
            <th>Total price</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr><td></td><td></td><td></td><td></td><td><b>Total Price:</b></td><td><b>${escapeHtml(formatPrice(grandTotal))}</b></td></tr>
          <tr><td></td><td colspan="4"><b>Total Price :</b></td><td><b>${escapeHtml(formatPrice(grandTotal))}</b></td></tr>
        </tbody>
      </table>
    </section>
  `;
}

function openInvoicePrint(orders: AdminOrder[], mode: InvoiceMode) {
  const printWindow = window.open("", "svarnikaa-invoice", "width=900,height=1100");
  if (!printWindow) return;

  const body =
    mode === "two-per-page"
      ? orders
          .reduce<string[]>((pages, order, index) => {
            if (index % 2 === 0) pages.push('<main class="page split">');
            pages[pages.length - 1] += invoiceBlock(order, index, true);
            if (index % 2 === 1 || index === orders.length - 1) pages[pages.length - 1] += "</main>";
            return pages;
          }, [])
          .join("")
      : `<main class="page">${invoiceBlock(mergeOrdersForInvoice(orders), 0, false)}</main>`;

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>Svarnikaa invoice</title>
        <style>
          @page { size: A4; margin: 10mm; }
          * { box-sizing: border-box; }
          body { margin: 0; background: #fff; color: #000; font-family: Arial, Helvetica, sans-serif; }
          .page { width: 190mm; min-height: 277mm; margin: 0 auto; page-break-after: always; }
          .page.split { height: 277mm; min-height: 277mm; display: grid; grid-template-rows: 135mm 135mm; gap: 7mm; overflow: hidden; }
          .invoice { padding: 0 7mm 5mm; font-size: 11px; break-inside: avoid; page-break-inside: avoid; }
          .invoice.compact { height: 135mm; padding: 0 5mm 4mm; font-size: 8.5px; overflow: hidden; }
          .bar { height: 6px; background: #806000; margin: 0 -7mm 14px; }
          .compact .bar { height: 4px; margin: 0 -5mm 7px; }
          .middle { margin-top: 18px; }
          h1 { margin: 0 0 6px; color: #c48b00; font-family: Georgia, 'Times New Roman', serif; font-size: 18px; letter-spacing: .2px; }
          .compact h1 { margin-bottom: 3px; font-size: 13px; }
          h2 { margin: 12px 0 8px; font-size: 14px; }
          .compact h2 { margin: 6px 0 4px; font-size: 10px; }
          p { margin: 0 0 4px; line-height: 1.35; }
          .compact p { margin-bottom: 2px; line-height: 1.22; }
          .top-grid, .invoice-head { display: grid; grid-template-columns: 1fr 46mm; gap: 20mm; }
          .labels { display: flex; flex-direction: column; gap: 18mm; padding-top: 12px; }
          .labels span, .paid { display: block; border: 3px solid #000; padding: 4px 10px; text-align: center; font-weight: 800; font-size: 14px; }
          .paid { margin-bottom: 12px; }
          .deliver, .buyer { margin-top: 10px; max-width: 95mm; font-weight: 600; }
          .compact-head, .compact-meta { display: grid; grid-template-columns: 1fr 46mm; gap: 8mm; align-items: start; }
          .compact-badges { display: grid; gap: 3mm; }
          .compact-badges span { display: block; border: 2px solid #000; padding: 2px 6px; text-align: center; font-weight: 800; font-size: 9px; }
          .compact .deliver { margin-top: 6px; max-width: none; }
          .compact .invoice-meta { margin-top: 8px; font-weight: 700; }
          table { width: 100%; margin-top: 14px; border-collapse: collapse; font-size: 10px; }
          .compact table { margin-top: 7px; font-size: 7.5px; }
          th, td { border: 1px solid #000; padding: 4px 6px; vertical-align: top; }
          .compact th, .compact td { padding: 2px 4px; }
          th { color: #a56f00; font-weight: 800; }
          th:first-child, td:first-child { width: 12mm; text-align: center; }
          th:nth-child(3), td:nth-child(3) { width: 14mm; text-align: center; }
          th:nth-child(4), td:nth-child(4), th:nth-child(5), td:nth-child(5), th:nth-child(6), td:nth-child(6) { width: 24mm; text-align: center; }
          @media print {
            .page:last-child { page-break-after: auto; }
          }
        </style>
      </head>
      <body>${body}<script>window.onload = () => setTimeout(() => window.print(), 250);</script></body>
    </html>
  `);
  printWindow.document.close();
}

function mergeOrdersForInvoice(orders: AdminOrder[]): AdminOrder {
  if (orders.length <= 1) return orders[0];
  const first = orders[0];
  const items = orders.map((order) => `${order.orderId}: ${order.items}`).join(", ");
  const total = orders.reduce((sum, order) => sum + parsePrice(String(order.total || "")), 0);

  return {
    ...first,
    orderId: orders.map((order) => order.orderId).join(" / "),
    items,
    total,
  };
}

export default function Admin() {
  const { toast } = useToast();
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(!ADMIN_PIN);
  const [activeTab, setActiveTab] = useState<AdminTab>("orders");
  const [product, setProduct] = useState(emptyProduct);
  const [inventoryImageFile, setInventoryImageFile] = useState<File | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [productQuery, setProductQuery] = useState("");
  const [inventoryStatus, setInventoryStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [saving, setSaving] = useState(false);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [orderDrafts, setOrderDrafts] = useState<Record<string, OrderDraft>>({});
  const [orderStatus, setOrderStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [invoiceMode, setInvoiceMode] = useState<InvoiceMode>("two-per-page");

  const canSave = useMemo(
    () =>
      Boolean(
        product.name.trim() &&
          product.price.trim() &&
          (product.image.trim() || inventoryImageFile) &&
          product.category?.trim(),
      ),
    [inventoryImageFile, product],
  );

  const selectedOrders = useMemo(
    () => orders.filter((order) => selectedOrderIds.includes(order.orderId)),
    [orders, selectedOrderIds],
  );

  const filteredProducts = useMemo(() => {
    const query = productQuery.trim().toLowerCase();
    if (!query) return products;

    return products.filter((item) =>
      `${item.id} ${item.name} ${item.category} ${item.stock} ${item.offerLabel} ${item.offerText}`
        .toLowerCase()
        .includes(query),
    );
  }, [productQuery, products]);

  useEffect(() => {
    if (unlocked) {
      loadInventory();
      loadOrders();
    }
  }, [unlocked]);

  function updateProduct(field: keyof InventoryPayload["product"], value: string) {
    setProduct((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function selectInventoryImage(file: File | null) {
    if (!file) {
      setInventoryImageFile(null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Image needed",
        description: "Upload a product image file.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > MAX_INVENTORY_IMAGE_BYTES) {
      toast({
        title: "Image too large",
        description: "Keep inventory images under 4 MB.",
        variant: "destructive",
      });
      return;
    }

    setInventoryImageFile(file);
  }

  function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!ADMIN_PIN || pin === ADMIN_PIN) {
      setUnlocked(true);
      return;
    }

    toast({
      title: "Wrong PIN",
      description: "Check VITE_ADMIN_PIN in your Netlify environment variables.",
      variant: "destructive",
    });
  }

  async function loadInventory() {
    if (!SHEET_CSV_URL) {
      setInventoryStatus("error");
      return;
    }

    setInventoryStatus("loading");

    try {
      const response = await fetch(cacheBust(SHEET_CSV_URL));
      if (!response.ok) throw new Error("Inventory sheet could not load");
      const csv = await response.text();
      setProducts(productsFromCsv(csv));
      setInventoryStatus("ready");
    } catch {
      setInventoryStatus("error");
      toast({
        title: "Inventory not loaded",
        description: "Check the published CSV link.",
        variant: "destructive",
      });
    }
  }

  async function loadOrders() {
    const adminKey = pin || ADMIN_PIN;

    if (!ORDER_SCRIPT_URL || !adminKey.trim()) {
      toast({
        title: "Order access not ready",
        description: "Set the same admin key in Apps Script once.",
        variant: "destructive",
      });
      return;
    }

    setOrderStatus("loading");

    try {
      const response = await fetchAdminOrders(ORDER_SCRIPT_URL, adminKey.trim(), 50);

      if (!response.ok) {
        throw new Error(response.error || "Orders could not load");
      }

      const nextOrders = response.orders || [];
      setOrders(nextOrders);
      setOrderDrafts(
        nextOrders.reduce<Record<string, OrderDraft>>((drafts, order) => {
          drafts[order.orderId] = {
            status: order.status || "Payment proof received",
            shipmentId: order.shipmentId || "",
            shipmentCompanyLink: order.shipmentCompanyLink || "",
          };
          return drafts;
        }, {}),
      );
      setOrderStatus("ready");
    } catch (error) {
      setOrderStatus("error");
      toast({
        title: "Orders not loaded",
        description: error instanceof Error ? error.message : "Check Apps Script deployment and admin key.",
        variant: "destructive",
      });
    }
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!ORDER_SCRIPT_URL) {
      toast({
        title: "Apps Script URL missing",
        description: "Add VITE_GOOGLE_APPS_SCRIPT_URL before saving inventory.",
        variant: "destructive",
      });
      return;
    }

    if (!canSave) {
      toast({
        title: "Required fields missing",
        description: "Name, category, price, and either image URL or image upload are required.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      const productPayload: InventoryPayload["product"] = {
        ...product,
        id: product.id || Date.now(),
        stock: product.stock || "In stock",
      };

      if (inventoryImageFile) {
        productPayload.imageFile = {
          name: inventoryImageFile.name,
          mimeType: inventoryImageFile.type || "image/jpeg",
          data: await readFileAsBase64(inventoryImageFile),
        };
      }

      await postToGoogleScript(ORDER_SCRIPT_URL, {
        action: "inventory",
        product: productPayload,
      });

      setProduct(emptyProduct);
      setInventoryImageFile(null);
      toast({
        title: "Inventory sent",
        description: inventoryImageFile
          ? "Product image was sent to Drive Inventory folder."
          : "Product is saved by ID. Refresh inventory after the sheet updates.",
      });
    } catch {
      toast({
        title: "Product could not be saved",
        description: "Check the Apps Script deployment URL and try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  function editProduct(item: StoreProduct) {
    setInventoryImageFile(null);
    setProduct({
      id: item.id,
      name: item.name || "",
      category: item.category || "",
      metal: item.metal || "",
      weight: item.weight || "",
      price: item.price || "",
      originalPrice: item.originalPrice || "",
      offerLabel: item.offerLabel || "",
      offerText: item.offerText || "",
      image: item.image || "",
      description: item.description || "",
      stock: item.stock || "In stock",
    });
    setActiveTab("inventory");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateOrderDraft(orderId: string, field: keyof OrderDraft, value: string) {
    setOrderDrafts((current) => ({
      ...current,
      [orderId]: {
        status: current[orderId]?.status || "Payment proof received",
        shipmentId: current[orderId]?.shipmentId || "",
        shipmentCompanyLink: current[orderId]?.shipmentCompanyLink || "",
        [field]: value,
      },
    }));
  }

  async function saveOrderUpdate(order: AdminOrder) {
    const draft = orderDrafts[order.orderId];
    const adminKey = pin || ADMIN_PIN;

    if (!adminKey.trim() || !draft) return;

    await postToGoogleScript(ORDER_SCRIPT_URL, {
      action: "updateOrder",
      token: adminKey.trim(),
      orderId: order.orderId,
      status: draft.status,
      shipmentId: draft.shipmentId,
      shipmentCompanyLink: draft.shipmentCompanyLink,
    });

    toast({
      title: "Order update sent",
      description: "Refresh orders after Apps Script updates the sheet.",
    });
  }

  function toggleOrder(orderId: string) {
    setSelectedOrderIds((current) =>
      current.includes(orderId)
        ? current.filter((id) => id !== orderId)
        : [...current, orderId],
    );
  }

  function printSelectedInvoices() {
    if (!selectedOrders.length) {
      toast({
        title: "Select orders",
        description: "Choose at least one order for invoice generation.",
        variant: "destructive",
      });
      return;
    }

    openInvoicePrint(selectedOrders, invoiceMode);
  }

  return (
    <Layout>
      <section className="min-h-screen bg-[#f8f3ea] px-4 pt-28 pb-12 text-[#30271f] md:px-6">
        <div className="container mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col gap-4 border-b border-[#dfcfb5] pb-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-bold uppercase text-[#9d7a31]">
                <Gem size={16} />
                Operations Desk
              </p>
              <h1 className="mt-2 font-serif text-4xl font-semibold text-[#463621] md:text-5xl">
                Svarnikaa admin
              </h1>
            </div>
            <Link
              href="/"
              className="inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-[6px] border border-[#cdb98f] bg-white px-4 text-xs font-bold uppercase text-[#4a3d30] transition hover:border-[#9d7a31] hover:text-[#9d7a31]"
            >
              <ArrowLeft size={16} />
              Storefront
            </Link>
          </div>

          {!unlocked ? (
            <form
              onSubmit={unlock}
              className="mx-auto max-w-md rounded-[8px] border border-[#dfcfb5] bg-white p-6 shadow-[0_18px_50px_rgba(64,48,29,0.08)]"
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-[6px] border border-[#d8c5a6] text-[#9d7a31]">
                <Lock size={20} />
              </div>
              <label className="block text-xs font-bold uppercase text-[#806b45]">
                Admin PIN
              </label>
              <input
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                type="password"
                className="mt-2 min-h-12 w-full rounded-[6px] border border-[#dfd2b8] bg-[#fffdf8] px-4 text-sm outline-none focus:border-[#9d7a31]"
                autoFocus
              />
              <button className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-[6px] bg-[#3b3025] px-4 text-xs font-black uppercase text-white transition hover:bg-[#9d7a31]">
                <Lock size={16} />
                Unlock
              </button>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  { key: "orders", label: "Orders", Icon: PackageCheck },
                  { key: "inventory", label: "Inventory", Icon: Gem },
                  { key: "invoice", label: "Invoices", Icon: FileText },
                ].map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveTab(key as AdminTab)}
                    className={`flex min-h-14 items-center justify-center gap-2 rounded-[6px] border px-4 text-xs font-black uppercase transition ${
                      activeTab === key
                        ? "border-[#1f211d] bg-[#1f211d] text-white"
                        : "border-[#dfcfb5] bg-white text-[#5b4c3b] hover:border-[#9d7a31]"
                    }`}
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                ))}
              </div>

              {activeTab === "orders" ? (
                <section className="grid gap-6 xl:grid-cols-[340px_1fr]">
                  <aside className="rounded-[8px] border border-[#dfcfb5] bg-white p-5 xl:self-start">
                    <p className="text-xs font-bold uppercase text-[#9d7a31]">Order desk</p>
                    <h2 className="mt-2 font-serif text-3xl font-semibold text-[#30271f]">Dashboard</h2>
                    <p className="mt-3 text-sm leading-6 text-[#6a5d4c]">
                      Orders load automatically after admin unlock.
                    </p>
                    <button
                      type="button"
                      onClick={loadOrders}
                      disabled={orderStatus === "loading"}
                      className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-[6px] bg-[#3b3025] px-4 text-xs font-black uppercase text-white transition hover:bg-[#9d7a31] disabled:cursor-wait disabled:opacity-60"
                    >
                      <RefreshCw size={16} className={orderStatus === "loading" ? "animate-spin" : ""} />
                      {orderStatus === "loading" ? "Syncing orders" : "Refresh orders"}
                    </button>
                    <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-[6px] border border-[#eadcc1] bg-[#fffdf8] p-3">
                        <p className="text-xs font-bold uppercase text-[#9d7a31]">Loaded</p>
                        <p className="mt-1 font-serif text-3xl">{orders.length}</p>
                      </div>
                      <div className="rounded-[6px] border border-[#eadcc1] bg-[#fffdf8] p-3">
                        <p className="text-xs font-bold uppercase text-[#9d7a31]">Selected</p>
                        <p className="mt-1 font-serif text-3xl">{selectedOrders.length}</p>
                      </div>
                    </div>
                  </aside>

                  <div className="space-y-4">
                    {orders.length ? (
                      orders.map((order) => {
                        const draft = orderDrafts[order.orderId] || {
                          status: order.status || "Payment proof received",
                          shipmentId: order.shipmentId || "",
                          shipmentCompanyLink: order.shipmentCompanyLink || "",
                        };

                        return (
                          <article
                            key={order.orderId}
                            className="rounded-[8px] border border-[#dfcfb5] bg-white p-5 shadow-[0_16px_40px_rgba(64,48,29,0.06)]"
                          >
                            <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
                              <div>
                                <div className="flex flex-wrap items-center gap-3">
                                  <label className="flex items-center gap-2 text-xs font-bold uppercase text-[#806b45]">
                                    <input
                                      type="checkbox"
                                      checked={selectedOrderIds.includes(order.orderId)}
                                      onChange={() => toggleOrder(order.orderId)}
                                      className="h-4 w-4 accent-[#806000]"
                                    />
                                    Select
                                  </label>
                                  <p className="rounded-[4px] bg-[#1f211d] px-2 py-1 text-xs font-bold uppercase text-[#e6c878]">
                                    {order.status || "New order"}
                                  </p>
                                </div>
                                <h3 className="mt-3 font-serif text-3xl font-semibold text-[#30271f]">
                                  {order.customerName || "Customer"}
                                </h3>
                                <p className="mt-1 text-sm font-semibold text-[#6a5d4c]">{order.orderId}</p>
                                <div className="mt-4 grid gap-2 text-sm leading-6 text-[#5f5548] md:grid-cols-2">
                                  <p><b>Phone:</b> {order.customerPhone || "-"}</p>
                                  <p><b>Total:</b> {formatPrice(order.total || 0)}</p>
                                  <p className="md:col-span-2"><b>Address:</b> {order.customerAddress || "-"}</p>
                                  <p className="md:col-span-2"><b>Items:</b> {order.items || "-"}</p>
                                  <p><b>UPI ID:</b> {order.paymentRef || "-"}</p>
                                  <p><b>Date:</b> {order.createdAt || "-"}</p>
                                </div>
                                {order.paymentProofUrl ? (
                                  <a
                                    href={order.paymentProofUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#8c6b2f] hover:text-[#1f211d]"
                                  >
                                    <ExternalLink size={15} />
                                    Open payment proof
                                  </a>
                                ) : null}
                              </div>

                              <div className="space-y-3 rounded-[6px] border border-[#eadcc1] bg-[#fffdf8] p-4">
                                <label className="block">
                                  <span className="text-xs font-bold uppercase text-[#806b45]">Status</span>
                                  <select
                                    value={draft.status}
                                    onChange={(event) => updateOrderDraft(order.orderId, "status", event.target.value)}
                                    className="mt-2 min-h-11 w-full rounded-[6px] border border-[#dfd2b8] bg-white px-3 text-sm outline-none focus:border-[#9d7a31]"
                                  >
                                    {orderStatuses.map((status) => (
                                      <option key={status} value={status}>{status}</option>
                                    ))}
                                  </select>
                                </label>
                                <label className="block">
                                  <span className="text-xs font-bold uppercase text-[#806b45]">Shipment ID</span>
                                  <input
                                    value={draft.shipmentId}
                                    onChange={(event) => updateOrderDraft(order.orderId, "shipmentId", event.target.value)}
                                    className="mt-2 min-h-11 w-full rounded-[6px] border border-[#dfd2b8] bg-white px-3 text-sm outline-none focus:border-[#9d7a31]"
                                  />
                                </label>
                                <label className="block">
                                  <span className="text-xs font-bold uppercase text-[#806b45]">Courier link</span>
                                  <input
                                    value={draft.shipmentCompanyLink}
                                    onChange={(event) => updateOrderDraft(order.orderId, "shipmentCompanyLink", event.target.value)}
                                    className="mt-2 min-h-11 w-full rounded-[6px] border border-[#dfd2b8] bg-white px-3 text-sm outline-none focus:border-[#9d7a31]"
                                  />
                                </label>
                                <button
                                  type="button"
                                  onClick={() => saveOrderUpdate(order)}
                                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[6px] bg-[#1f211d] px-4 text-xs font-black uppercase text-white transition hover:bg-[#8c6b2f]"
                                >
                                  <Save size={16} />
                                  Save update
                                </button>
                              </div>
                            </div>
                          </article>
                        );
                      })
                    ) : (
                      <div className="rounded-[8px] border border-dashed border-[#c9bea8] bg-white p-10 text-center">
                        <PackageCheck className="mx-auto mb-4 text-[#9d7a31]" />
                        <h3 className="font-serif text-3xl text-[#30271f]">
                          {orderStatus === "loading" ? "Syncing orders" : "No orders loaded"}
                        </h3>
                        <p className="mt-2 text-sm text-[#6a5d4c]">
                          {orderStatus === "loading"
                            ? "Recent customer orders are being fetched."
                            : "Refresh orders after new customer checkout."}
                        </p>
                      </div>
                    )}
                  </div>
                </section>
              ) : null}

              {activeTab === "inventory" ? (
                <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
                  <form
                    onSubmit={saveProduct}
                    className="rounded-[8px] border border-[#dfcfb5] bg-white p-5 shadow-[0_18px_50px_rgba(64,48,29,0.08)]"
                  >
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase text-[#9d7a31]">Product manager</p>
                        <h2 className="mt-2 font-serif text-3xl font-semibold text-[#30271f]">
                          {product.id ? "Edit product" : "Add product"}
                        </h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setProduct(emptyProduct);
                          setInventoryImageFile(null);
                        }}
                        className="rounded-[6px] border border-[#dfcfb5] px-3 py-2 text-xs font-bold uppercase text-[#5b4c3b]"
                      >
                        Clear
                      </button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {[
                        ["id", "Product ID"],
                        ["name", "Product name"],
                        ["category", "Category"],
                        ["metal", "Metal / material"],
                        ["weight", "Weight"],
                        ["price", "Price"],
                        ["originalPrice", "Original price / MRP"],
                        ["offerLabel", "Offer badge"],
                        ["image", "Image URL"],
                        ["stock", "Stock status"],
                        ["offerText", "Offer line"],
                      ].map(([field, label]) => (
                        <label
                          key={field}
                          className={field === "image" || field === "offerText" ? "md:col-span-2" : ""}
                        >
                          <span className="text-xs font-bold uppercase text-[#806b45]">{label}</span>
                          <input
                            value={String(product[field as keyof InventoryPayload["product"]] || "")}
                            onChange={(event) =>
                              updateProduct(field as keyof InventoryPayload["product"], event.target.value)
                            }
                            className="mt-2 min-h-12 w-full rounded-[6px] border border-[#dfd2b8] bg-[#fffdf8] px-4 text-sm outline-none focus:border-[#9d7a31]"
                          />
                        </label>
                      ))}

                      <label className="md:col-span-2">
                        <span className="text-xs font-bold uppercase text-[#806b45]">
                          Upload inventory image
                        </span>
                        <span className="mt-2 flex min-h-12 cursor-pointer items-center gap-3 rounded-[6px] border border-[#dfd2b8] bg-[#fffdf8] px-4 text-sm text-[#5b4c3b] transition hover:border-[#9d7a31]">
                          <ImageIcon size={16} className="shrink-0 text-[#9d7a31]" />
                          <span className="min-w-0 flex-1 truncate">
                            {inventoryImageFile
                              ? inventoryImageFile.name
                              : "Save uploaded image to Drive / Inventory"}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(event) => selectInventoryImage(event.target.files?.[0] || null)}
                            className="sr-only"
                          />
                        </span>
                      </label>

                      <label className="md:col-span-2">
                        <span className="text-xs font-bold uppercase text-[#806b45]">Description</span>
                        <textarea
                          value={product.description}
                          onChange={(event) => updateProduct("description", event.target.value)}
                          rows={4}
                          className="mt-2 min-h-28 w-full resize-none rounded-[6px] border border-[#dfd2b8] bg-[#fffdf8] px-4 py-3 text-sm outline-none focus:border-[#9d7a31]"
                        />
                      </label>
                    </div>

                    <button
                      disabled={saving}
                      className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-[6px] bg-[#3b3025] px-4 text-xs font-black uppercase text-white transition hover:bg-[#9d7a31] disabled:cursor-wait disabled:opacity-60"
                    >
                      {saving ? <Send size={16} /> : product.id ? <Save size={16} /> : <Plus size={16} />}
                      {saving ? "Saving product" : product.id ? "Save product" : "Add to inventory"}
                    </button>
                  </form>

                  <aside className="rounded-[8px] border border-[#dfcfb5] bg-white p-5 xl:self-start">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase text-[#9d7a31]">Sheet products</p>
                        <h2 className="mt-2 font-serif text-3xl font-semibold text-[#30271f]">{products.length}</h2>
                      </div>
                      <button
                        type="button"
                        onClick={loadInventory}
                        className="flex h-11 w-11 items-center justify-center rounded-[6px] border border-[#dfcfb5] text-[#806b45] hover:border-[#9d7a31]"
                        aria-label="Refresh inventory"
                      >
                        <RefreshCw size={16} className={inventoryStatus === "loading" ? "animate-spin" : ""} />
                      </button>
                    </div>
                    <label className="mt-4 flex min-h-11 items-center gap-2 rounded-[6px] border border-[#dfd2b8] bg-[#fffdf8] px-3">
                      <Search size={16} className="text-[#806b45]" />
                      <input
                        value={productQuery}
                        onChange={(event) => setProductQuery(event.target.value)}
                        placeholder="Search products"
                        className="w-full bg-transparent text-sm outline-none"
                      />
                    </label>
                    <div className="mt-4 max-h-[620px] space-y-3 overflow-y-auto pr-1">
                      {filteredProducts.map((item) => (
                        <div key={item.id} className="grid grid-cols-[64px_1fr] gap-3 rounded-[6px] border border-[#eadcc1] bg-[#fffdf8] p-3">
                          <img src={item.image} alt={item.name} className="h-16 w-16 rounded-[4px] object-cover" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold">{item.name}</p>
                            <p className="mt-1 text-xs text-[#6a5d4c]">{formatPrice(item.price)} · {item.stock}</p>
                            <div className="mt-2 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => editProduct(item)}
                                className="inline-flex items-center gap-1 text-xs font-bold uppercase text-[#8c6b2f]"
                              >
                                <Pencil size={13} />
                                Edit
                              </button>
                              {item.offerLabel ? (
                                <span className="rounded-[4px] bg-[#1f211d] px-2 py-1 text-[10px] font-bold uppercase text-[#e6c878]">
                                  {item.offerLabel}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ))}
                      {!filteredProducts.length ? (
                        <div className="rounded-[6px] border border-dashed border-[#c9bea8] p-5 text-center text-sm text-[#6a5d4c]">
                          No products loaded.
                        </div>
                      ) : null}
                    </div>
                  </aside>
                </section>
              ) : null}

              {activeTab === "invoice" ? (
                <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
                  <aside className="rounded-[8px] border border-[#dfcfb5] bg-white p-5 lg:self-start">
                    <p className="text-xs font-bold uppercase text-[#9d7a31]">Invoice generator</p>
                    <h2 className="mt-2 font-serif text-3xl font-semibold text-[#30271f]">Print setup</h2>
                    <div className="mt-5 space-y-3">
                      <label className="flex cursor-pointer gap-3 rounded-[6px] border border-[#dfd2b8] bg-[#fffdf8] p-3 text-sm">
                        <input
                          type="radio"
                          checked={invoiceMode === "two-per-page"}
                          onChange={() => setInvoiceMode("two-per-page")}
                          className="mt-1 accent-[#806000]"
                        />
                        <span><b>Two orders on one page</b><br />Best for paper saving.</span>
                      </label>
                      <label className="flex cursor-pointer gap-3 rounded-[6px] border border-[#dfd2b8] bg-[#fffdf8] p-3 text-sm">
                        <input
                          type="radio"
                          checked={invoiceMode === "single-customer"}
                          onChange={() => setInvoiceMode("single-customer")}
                          className="mt-1 accent-[#806000]"
                        />
                        <span><b>Single person, multiple orders</b><br />Combines selected orders.</span>
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={printSelectedInvoices}
                      className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-[6px] bg-[#3b3025] px-4 text-xs font-black uppercase text-white transition hover:bg-[#9d7a31]"
                    >
                      <Printer size={16} />
                      Generate PDF
                    </button>
                    <p className="mt-4 text-sm leading-6 text-[#6a5d4c]">
                      Browser print opens automatically. Choose Save as PDF or print directly.
                    </p>
                  </aside>

                  <div className="rounded-[8px] border border-[#dfcfb5] bg-white p-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase text-[#9d7a31]">Selected orders</p>
                        <h2 className="mt-2 font-serif text-3xl font-semibold text-[#30271f]">
                          {selectedOrders.length} ready
                        </h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab("orders")}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[6px] border border-[#dfcfb5] px-4 text-xs font-bold uppercase text-[#5b4c3b]"
                      >
                        <PackageCheck size={16} />
                        Select orders
                      </button>
                    </div>
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      {selectedOrders.map((order) => (
                        <div key={order.orderId} className="rounded-[6px] border border-[#eadcc1] bg-[#fffdf8] p-4">
                          <p className="text-xs font-bold uppercase text-[#9d7a31]">{order.orderId}</p>
                          <h3 className="mt-2 font-serif text-2xl font-semibold">{order.customerName || "Customer"}</h3>
                          <p className="mt-2 text-sm text-[#6a5d4c]">{order.customerAddress || "-"}</p>
                          <p className="mt-2 text-sm font-bold">{formatPrice(order.total || 0)}</p>
                        </div>
                      ))}
                      {!selectedOrders.length ? (
                        <div className="rounded-[6px] border border-dashed border-[#c9bea8] p-8 text-center text-sm text-[#6a5d4c] md:col-span-2">
                          Select orders from the Orders tab first.
                        </div>
                      ) : null}
                    </div>
                  </div>
                </section>
              ) : null}

              <div className="grid gap-4 md:grid-cols-3">
                {[
                  { Icon: ImageIcon, title: "Private proofs", text: "Payment proof links stay inside admin/order email." },
                  { Icon: Truck, title: "Tracking updates", text: "Status and courier details are editable per order." },
                  { Icon: FileText, title: "Invoice format", text: "A4 print layout follows your shared delivery invoice structure." },
                ].map(({ Icon, title, text }) => (
                  <div key={title} className="rounded-[8px] border border-[#dfcfb5] bg-[#fffdf8] p-4">
                    <Icon className="text-[#9d7a31]" size={18} />
                    <p className="mt-3 font-serif text-xl font-semibold">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-[#6a5d4c]">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}
