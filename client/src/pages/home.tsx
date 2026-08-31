import { Layout } from "@/components/layout";
import { useToast } from "@/hooks/use-toast";
import fallbackProducts from "@/lib/products.json";
import {
  CartItem,
  StoreProduct,
  createOrderId,
  fetchTrackingByOrderId,
  formatPrice,
  parsePrice,
  postToGoogleScript,
  productsFromCsv,
  type TrackingResponse,
} from "@/lib/store";
import pendantNecklace from "@assets/generated_images/small_diamond_emerald_pendant_necklace.png";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ExternalLink,
  ImageUp,
  Mail,
  Minus,
  Plus,
  Search,
  Send,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Truck,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

const UPI_ID = import.meta.env.VITE_UPI_ID || "";
const UPI_NAME = import.meta.env.VITE_UPI_NAME || "Svarnikaa";
const DEFAULT_SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTfSPkVApqhIMHfrGEaCr-Rg7IOSjjrdAbynlIo7FIpLXdlyDIpdQxZlup0Y2tvBw51OyjQBjJP2NAR/pub?gid=0&single=true&output=csv";
const DEFAULT_ORDER_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwrVQRRaGE6gOiGWmv4OVsx4JgvB30El7QKRVZxvMCrCbP0q8qoUMANdncrzJW585WX/exec";
const SHEET_CSV_URL = import.meta.env.VITE_GOOGLE_SHEET_CSV_URL || DEFAULT_SHEET_CSV_URL;
const ORDER_SCRIPT_URL = import.meta.env.VITE_GOOGLE_APPS_SCRIPT_URL || DEFAULT_ORDER_SCRIPT_URL;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const MAX_PAYMENT_PROOF_BYTES = 4 * 1024 * 1024;

function getStockLimit(product: StoreProduct) {
  const match = product.stock?.match(/^(\d+)\s+available/i);
  return match ? Number(match[1]) : null;
}

function isOutOfStock(product: StoreProduct) {
  return /out\s+of\s+stock/i.test(product.stock || "");
}

function withCacheBust(url: string) {
  try {
    const csvUrl = new URL(url);
    csvUrl.searchParams.set("_", String(Date.now()));
    return csvUrl.toString();
  } catch {
    return url;
  }
}

function buildUpiLink(total: number, items: CartItem[], orderId: string) {
  const note = `Svarnikaa ${orderId}: ${items
    .map((item) => `${item.name} x${item.quantity}`)
    .join(", ")}`.slice(0, 80);

  const params = new URLSearchParams({
    pa: UPI_ID,
    pn: UPI_NAME,
    am: String(total),
    cu: "INR",
    tn: note,
  });

  return `upi://pay?${params.toString()}`;
}

function buildQrCodeUrl(value: string) {
  const params = new URLSearchParams({
    size: "260x260",
    margin: "12",
    data: value,
  });

  return `https://api.qrserver.com/v1/create-qr-code/?${params.toString()}`;
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };

    reader.onerror = () => reject(new Error("Payment proof could not be read"));
    reader.readAsDataURL(file);
  });
}

export default function Home() {
  const { toast } = useToast();
  const [products, setProducts] = useState<StoreProduct[]>(
    SHEET_CSV_URL ? [] : (fallbackProducts as StoreProduct[]),
  );
  const [sheetStatus, setSheetStatus] = useState<"local" | "loading" | "live" | "error">(
    SHEET_CSV_URL ? "loading" : "local",
  );
  const [inventoryError, setInventoryError] = useState("");
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [draftOrderId, setDraftOrderId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const [proofInputKey, setProofInputKey] = useState(0);
  const [qrFailed, setQrFailed] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "submitting" | "sent">("idle");
  const [placedOrderId, setPlacedOrderId] = useState("");
  const [trackingOrderId, setTrackingOrderId] = useState("");
  const [trackingStatus, setTrackingStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [trackingResult, setTrackingResult] = useState<TrackingResponse | null>(null);
  const [trackingError, setTrackingError] = useState("");

  useEffect(() => {
    if (!SHEET_CSV_URL) return;

    fetch(withCacheBust(SHEET_CSV_URL))
      .then((response) => {
        if (!response.ok) throw new Error("Sheet could not be loaded");
        return response.text();
      })
      .then((csv) => {
        const sheetProducts = productsFromCsv(csv);
        if (!sheetProducts.length) throw new Error("Sheet has no products");
        setProducts(sheetProducts);
        setSheetStatus("live");
        setInventoryError("");
      })
      .catch((error) => {
        setProducts(fallbackProducts as StoreProduct[]);
        setSheetStatus("error");
        setInventoryError(error instanceof Error ? error.message : "Inventory could not be loaded");
      });
  }, []);

  useEffect(() => {
    if (cart.length && !draftOrderId) {
      setDraftOrderId(createOrderId());
    }

    if (!cart.length && draftOrderId) {
      setDraftOrderId("");
    }
  }, [cart.length, draftOrderId]);

  const categories = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(products.map((product) => product.category || product.metal)),
      ).filter((category): category is string => Boolean(category)),
    ],
    [products],
  );

  const categoryCards = useMemo(
    () =>
      categories.slice(1).map((category) => {
        const categoryProducts = products.filter(
          (product) => product.category === category || product.metal === category,
        );

        return {
          name: category,
          count: categoryProducts.length,
          image: categoryProducts[0]?.image || pendantNecklace,
        };
      }),
    [categories, products],
  );

  const visibleProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return products.filter((product) => {
      const matchesCategory =
        activeCategory === "All" ||
        product.category === activeCategory ||
        product.metal === activeCategory;
      const haystack = `${product.name} ${product.metal} ${product.description}`.toLowerCase();
      return matchesCategory && (!normalizedQuery || haystack.includes(normalizedQuery));
    });
  }, [activeCategory, products, query]);

  const subtotal = useMemo(
    () =>
      cart.reduce(
        (total, item) => total + parsePrice(item.price) * item.quantity,
        0,
      ),
    [cart],
  );

  const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
  const upiLink = UPI_ID && draftOrderId ? buildUpiLink(subtotal, cart, draftOrderId) : "";
  const qrCodeUrl = upiLink ? buildQrCodeUrl(upiLink) : "";
  const isInventoryLoading = sheetStatus === "loading";
  const canPay = cart.length > 0 && subtotal > 0 && Boolean(UPI_ID) && Boolean(draftOrderId);

  useEffect(() => {
    setQrFailed(false);
  }, [qrCodeUrl]);

  function focusCategory(category: string) {
    setActiveCategory(category);
    document.getElementById("collection")?.scrollIntoView({ behavior: "smooth" });
  }

  function addToCart(product: StoreProduct) {
    if (isOutOfStock(product)) {
      toast({
        title: "Sold out",
        description: "This piece is not available right now.",
        variant: "destructive",
      });
      return;
    }

    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);
      const stockLimit = getStockLimit(product);

      if (stockLimit !== null && (existing?.quantity || 0) >= stockLimit) {
        toast({
          title: "Stock limit reached",
          description: `${product.name} has only ${stockLimit} available.`,
          variant: "destructive",
        });
        return current;
      }

      if (existing) {
        return current.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }

      return [...current, { ...product, quantity: 1 }];
    });
  }

  function updateQuantity(productId: number, direction: 1 | -1) {
    setCart((current) =>
      current
        .map((item) => {
          if (item.id !== productId) return item;
          const stockLimit = getStockLimit(item);
          const nextQuantity = Math.max(0, item.quantity + direction);

          return {
            ...item,
            quantity: stockLimit === null ? nextQuantity : Math.min(nextQuantity, stockLimit),
          };
        })
        .filter((item) => item.quantity > 0),
    );
  }

  function removeItem(productId: number) {
    setCart((current) => current.filter((item) => item.id !== productId));
  }

  function canIncreaseCartItem(item: CartItem) {
    const stockLimit = getStockLimit(item);
    return stockLimit === null || item.quantity < stockLimit;
  }

  function selectPaymentProof(file: File | null) {
    if (!file) {
      setPaymentProofFile(null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Image needed",
        description: "Upload a payment screenshot image.",
        variant: "destructive",
      });
      setProofInputKey((current) => current + 1);
      return;
    }

    if (file.size > MAX_PAYMENT_PROOF_BYTES) {
      toast({
        title: "Image too large",
        description: "Upload a screenshot under 4 MB.",
        variant: "destructive",
      });
      setProofInputKey((current) => current + 1);
      return;
    }

    setPaymentProofFile(file);
  }

  async function submitOrder() {
    if (!cart.length) {
      toast({
        title: "Add products first",
        description: "Select at least one jewellery piece before placing an order.",
        variant: "destructive",
      });
      return;
    }

    if (!UPI_ID || !ORDER_SCRIPT_URL) {
      toast({
        title: "Checkout setup pending",
        description: "Payment and order links must be configured before accepting orders.",
        variant: "destructive",
      });
      return;
    }

    if (!customerName.trim() || !customerPhone.trim() || !customerAddress.trim()) {
      toast({
        title: "Customer details needed",
        description: "Please add name, phone, and delivery address.",
        variant: "destructive",
      });
      return;
    }

    const email = customerEmail.trim();
    if (email && (!EMAIL_PATTERN.test(email) || email.length > 254)) {
      toast({
        title: "Check email address",
        description: "Use a valid email address under 254 characters, or leave it blank.",
        variant: "destructive",
      });
      return;
    }

    if (!paymentRef.trim()) {
      toast({
        title: "UPI reference needed",
        description: "Paste the UPI transaction ID after payment.",
        variant: "destructive",
      });
      return;
    }

    if (!paymentProofFile) {
      toast({
        title: "Payment proof needed",
        description: "Upload the payment screenshot before submitting.",
        variant: "destructive",
      });
      return;
    }

    const orderId = draftOrderId || createOrderId();
    setSubmitStatus("submitting");

    try {
      const proofData = await readFileAsBase64(paymentProofFile);

      await postToGoogleScript(ORDER_SCRIPT_URL, {
        action: "order",
        orderId,
        customerName: customerName.trim(),
        customerEmail: email ? email.toLowerCase() : "",
        customerPhone: customerPhone.trim(),
        customerAddress: customerAddress.trim(),
        paymentRef: paymentRef.trim(),
        paymentProofFile: {
          name: paymentProofFile.name,
          mimeType: paymentProofFile.type || "image/jpeg",
          data: proofData,
        },
        upiId: UPI_ID,
        total: subtotal,
        items: cart.map((item) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
      });

      setPlacedOrderId(orderId);
      setTrackingOrderId(orderId);
      setSubmitStatus("sent");
      setCart([]);
      setCustomerName("");
      setCustomerEmail("");
      setCustomerPhone("");
      setCustomerAddress("");
      setPaymentRef("");
      setPaymentProofFile(null);
      setProofInputKey((current) => current + 1);
      setDraftOrderId("");
      toast({
        title: "Order submitted",
        description: `Order ${orderId} was sent for confirmation.`,
      });
    } catch {
      setSubmitStatus("idle");
      toast({
        title: "Order could not be submitted",
        description: "Please check the Apps Script URL and internet connection.",
        variant: "destructive",
      });
    }
  }

  async function checkTracking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const orderId = trackingOrderId.trim();
    if (!orderId) {
      toast({
        title: "Order ID needed",
        description: "Enter the order ID you received after checkout.",
        variant: "destructive",
      });
      return;
    }

    setTrackingStatus("loading");
    setTrackingResult(null);
    setTrackingError("");

    try {
      const response = await fetchTrackingByOrderId(ORDER_SCRIPT_URL, orderId);

      if (!response.ok) throw new Error(response.error || "Tracking lookup failed");

      if (!response.found) {
        setTrackingStatus("error");
        setTrackingError("No order found for this ID. Check the order ID and try again.");
        return;
      }

      setTrackingResult(response);
      setTrackingStatus("ready");
    } catch {
      setTrackingStatus("error");
      setTrackingError("Tracking could not be loaded. Please try again in a moment.");
    }
  }

  return (
    <Layout>
      <section className="overflow-x-hidden bg-[#fbfaf6] pt-20 text-[#1f1d1a]">
        <div className="border-b border-[#e3dccf] bg-[#1f211d] text-[#f8f2e8]">
          <div className="container mx-auto flex flex-col gap-1 px-4 py-3 text-[11px] font-semibold uppercase leading-5 md:flex-row md:items-center md:justify-between md:px-6 md:text-xs">
            <span className="max-w-[calc(100vw-2rem)] break-words">Premium jewellery | UPI checkout | India delivery</span>
            <span className="text-[#e6c878]">
              {sheetStatus === "live"
                ? "Live inventory"
                : sheetStatus === "loading"
                  ? "Refreshing stock"
                  : sheetStatus === "error"
                    ? "Local collection"
                    : "Curated collection"}
            </span>
          </div>
        </div>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65 }}
          className="relative min-h-[520px] overflow-hidden bg-[#1f1d1a] md:min-h-[640px]"
        >
          <img
            src={pendantNecklace}
            alt="Svarnikaa jewellery"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#11100e]/86 via-[#1f211d]/42 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#fbfaf6] to-transparent" />
          <div className="container relative mx-auto flex min-h-[500px] items-end px-4 pb-10 pt-12 md:min-h-[620px] md:px-6 md:pb-14">
            <div className="max-w-2xl text-white">
              <p className="text-xs font-bold uppercase text-[#e6c878]">Svarnikaa Boutique</p>
              <h1 className="mt-4 max-w-[11ch] font-serif text-[42px] font-semibold leading-[1.02] text-white sm:max-w-xl sm:text-5xl md:text-7xl">
                Jewellery with a signature finish.
              </h1>
              <p className="mt-5 max-w-[21rem] text-base leading-8 text-white/76 sm:max-w-xl md:text-lg">
                Polished bracelets, rings, chains and earrings selected for festive dressing, gifting, and daily elegance.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#categories"
                  className="inline-flex min-h-12 items-center justify-center rounded-[6px] bg-white px-6 text-sm font-bold uppercase text-[#1f1d1a] transition hover:bg-[#e6c878]"
                >
                  Shop categories
                </a>
                <a
                  href="#checkout"
                  className="inline-flex min-h-12 items-center justify-center rounded-[6px] border border-white/45 px-6 text-sm font-bold uppercase text-white transition hover:border-[#e6c878] hover:text-[#e6c878]"
                >
                  Checkout
                </a>
              </div>
            </div>
          </div>
        </motion.section>

        <section id="categories" className="container mx-auto px-4 py-12 md:px-6">
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase text-[#8c6b2f]">Shop by category</p>
              <h2 className="mt-2 font-serif text-4xl font-semibold text-[#20201d] md:text-5xl">
                Find your perfect piece
              </h2>
            </div>
            <p className="text-sm leading-6 text-[#626057]">
              {isInventoryLoading ? "Loading live stock from Google Sheet." : `${products.length} pieces available now.`}
            </p>
          </div>

          {categoryCards.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {categoryCards.slice(0, 4).map((category) => (
              <button
                key={category.name}
                onClick={() => focusCategory(category.name)}
                className="group relative aspect-[16/10] overflow-hidden rounded-[8px] bg-[#e8e2d7] text-left shadow-[0_18px_38px_rgba(31,29,26,0.08)]"
              >
                <img
                  src={category.image}
                  alt={category.name}
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = pendantNecklace;
                  }}
                  className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <h3 className="font-serif text-3xl font-semibold text-white">{category.name}</h3>
                  <p className="mt-1 text-xs font-bold uppercase text-white/80">
                    {category.count} piece{category.count === 1 ? "" : "s"}
                  </p>
                </div>
              </button>
              ))}
            </div>
          ) : (
            <div className="rounded-[8px] border border-dashed border-[#c9bea8] bg-white p-8 text-sm text-[#626057]">
              Live categories will appear as soon as inventory finishes loading.
            </div>
          )}
        </section>

        <div className="border-y border-[#2f332d] bg-[#1f211d] text-white">
          <div className="container mx-auto grid grid-cols-1 divide-y divide-white/10 px-4 md:grid-cols-3 md:divide-x md:divide-y-0 md:px-6">
            {[
              ["Payment proof", "Transaction ID and screenshot link are captured before review."],
              ["Owner approval", "Orders move forward only after stock and payment are checked."],
              ["Dispatch tracking", "Shipment ID and courier link can be updated after dispatch."],
            ].map(([title, text], index) => (
              <div key={title} className="flex gap-4 py-7 md:px-8">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[6px] border border-[#e6c878]/35 bg-[#e6c878]/10">
                  <ShieldCheck className="text-[#e6c878]" size={18} strokeWidth={1.7} />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase leading-none text-[#e6c878]">
                    Step {index + 1}
                  </p>
                  <h3 className="mt-2 font-serif text-2xl leading-tight text-white">{title}</h3>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-white/68">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="container mx-auto grid grid-cols-1 gap-8 px-4 py-12 md:px-6 lg:grid-cols-[minmax(0,1fr)_390px] xl:grid-cols-[minmax(0,1fr)_420px]">
          <section id="collection" className="min-w-0 space-y-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-bold uppercase text-[#8c6b2f]">Available stock</p>
                <h2 className="mt-2 font-serif text-4xl font-semibold text-[#20201d] md:text-5xl">
                  Collection
                </h2>
              </div>
              <label
                id="product-search"
                className="flex min-h-12 w-full scroll-mt-28 items-center gap-3 rounded-[6px] border border-[#d6cebf] bg-white px-4 shadow-[0_12px_28px_rgba(31,29,26,0.05)] md:max-w-sm"
              >
                <Search size={18} className="text-[#8c6b2f]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search bracelets, rings, chains"
                  className="w-full bg-transparent text-sm text-[#1f1d1a] outline-none placeholder:text-[#77736a]"
                />
              </label>
            </div>

            <div className="flex gap-2 overflow-x-auto border-y border-[#e3dccf] py-3">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`min-h-11 whitespace-nowrap rounded-[6px] px-4 text-xs font-bold uppercase transition ${
                    activeCategory === category
                      ? "bg-[#1f211d] text-white"
                      : "border border-[#ddd6ca] bg-white text-[#5d5b55] hover:border-[#8c6b2f] hover:text-[#8c6b2f]"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            {sheetStatus === "error" && inventoryError ? (
              <div className="rounded-[6px] border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                Live inventory is refreshing. Showing curated collection for now.
              </div>
            ) : null}

            {isInventoryLoading ? (
              <div className="rounded-[8px] border border-dashed border-[#c9bea8] bg-white p-10 text-center">
                <Search className="mx-auto mb-4 text-[#8c6b2f]" />
                <h3 className="font-serif text-3xl text-[#20201d]">Refreshing collection</h3>
                <p className="mt-2 text-sm text-[#626057]">Loading live inventory from Google Sheet.</p>
              </div>
            ) : visibleProducts.length ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {visibleProducts.map((product) => {
                  const productUnavailable = isOutOfStock(product);

                  return (
                  <article
                    key={product.id}
                    className="group flex min-h-full flex-col overflow-hidden rounded-[8px] border border-[#e2ddd3] bg-white shadow-[0_16px_34px_rgba(31,29,26,0.06)] transition duration-300 hover:-translate-y-1 hover:border-[#c7ad67]"
                  >
                    <div className="relative aspect-[4/5] overflow-hidden bg-[#ece8df]">
                      <img
                        src={product.image}
                        alt={product.name}
                        onError={(event) => {
                          event.currentTarget.onerror = null;
                          event.currentTarget.src = pendantNecklace;
                        }}
                        className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                      />
                      <div className={`absolute left-3 top-3 rounded-[4px] px-3 py-1 text-xs font-semibold backdrop-blur ${
                        productUnavailable ? "bg-[#8b2f2f] text-white" : "bg-white/92 text-[#5c4a27]"
                      }`}>
                        {product.stock || "In stock"}
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col gap-4 p-5">
                      <div>
                        <p className="text-xs font-bold uppercase text-[#8c6b2f]">
                          {product.category || product.metal}
                        </p>
                        <h3 className="mt-2 font-serif text-[26px] font-semibold leading-tight text-[#20201d]">
                          {product.name}
                        </h3>
                      </div>
                      <p className="line-clamp-3 text-sm leading-6 text-[#626057]">{product.description}</p>
                      <div className="mt-auto border-t border-[#eee7db] pt-4">
                        <p className="text-xl font-black text-[#1f1d1a]">{formatPrice(product.price)}</p>
                        <p className="mt-1 text-xs text-[#77736a]">
                          {[product.metal, product.weight].filter(Boolean).join(" | ")}
                        </p>
                        <button
                          onClick={() => addToCart(product)}
                          disabled={productUnavailable}
                          className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-[6px] bg-[#1f211d] px-4 text-xs font-black uppercase text-white transition hover:bg-[#8c6b2f] disabled:cursor-not-allowed disabled:bg-[#d7d1c6] disabled:text-[#80786b]"
                        >
                          <ShoppingBag size={16} />
                          {productUnavailable ? "Sold out" : "Add to cart"}
                        </button>
                      </div>
                    </div>
                  </article>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-[8px] border border-dashed border-[#c9bea8] bg-white p-10 text-center">
                <Search className="mx-auto mb-4 text-[#8c6b2f]" />
                <h3 className="font-serif text-3xl text-[#20201d]">No pieces found</h3>
                <p className="mt-2 text-sm text-[#626057]">Try another search term or view all categories.</p>
              </div>
            )}
          </section>

          <aside id="checkout" className="space-y-4 lg:sticky lg:top-36 lg:self-start">
            <div className="overflow-hidden rounded-[8px] bg-[#1f211d] text-white shadow-[0_24px_70px_rgba(31,29,26,0.18)]">
              <div className="border-b border-white/10 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase text-[#e6c878]">Your cart</p>
                    <h2 className="mt-2 font-serif text-3xl font-semibold text-white">
                      {totalItems} item{totalItems === 1 ? "" : "s"}
                    </h2>
                  </div>
                  <ShoppingBag className="text-[#e6c878]" />
                </div>
              </div>

              <div className="max-h-[320px] overflow-y-auto p-5">
                {cart.length === 0 ? (
                  <div className="flex min-h-44 flex-col items-center justify-center rounded-[6px] border border-dashed border-white/20 bg-white/[0.03] p-6 text-center">
                    <ShoppingBag className="mb-4 text-[#e6c878]" />
                    <p className="font-serif text-2xl text-white">Cart is ready.</p>
                    <p className="mt-2 text-sm leading-6 text-white/60">Add pieces to begin checkout.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cart.map((item) => (
                      <div key={item.id} className="grid grid-cols-[64px_1fr] gap-3 rounded-[6px] border border-white/10 bg-white/[0.04] p-3">
                        <img
                          src={item.image}
                          alt={item.name}
                          onError={(event) => {
                            event.currentTarget.onerror = null;
                            event.currentTarget.src = pendantNecklace;
                          }}
                          className="h-16 w-16 bg-white object-cover"
                        />
                        <div className="min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="line-clamp-2 text-sm font-bold">{item.name}</p>
                              <p className="mt-1 text-xs text-white/60">{formatPrice(item.price)}</p>
                            </div>
                            <button
                              onClick={() => removeItem(item.id)}
                              className="text-white/50 transition hover:text-[#e6c878]"
                              aria-label={`Remove ${item.name}`}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            <button
                              onClick={() => updateQuantity(item.id, -1)}
                              className="flex h-8 w-8 items-center justify-center rounded-[4px] border border-white/15 transition hover:border-[#e6c878] hover:text-[#e6c878]"
                              aria-label={`Decrease ${item.name}`}
                            >
                              <Minus size={14} />
                            </button>
                            <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, 1)}
                              disabled={!canIncreaseCartItem(item)}
                              className="flex h-8 w-8 items-center justify-center rounded-[4px] border border-white/15 transition hover:border-[#e6c878] hover:text-[#e6c878] disabled:cursor-not-allowed disabled:opacity-35"
                              aria-label={`Increase ${item.name}`}
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4 border-t border-white/10 bg-[#191a17] p-5">
                <div className="flex items-center justify-between text-sm text-white/65">
                  <span>Subtotal</span>
                  <span className="font-bold text-[#e6c878]">
                    {subtotal > 0 ? formatPrice(subtotal) : "Rs. 0"}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <input
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    placeholder="Your name"
                    className="min-h-11 rounded-[6px] border border-white/15 bg-white/5 px-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#e6c878]"
                  />
                  <input
                    value={customerPhone}
                    onChange={(event) => setCustomerPhone(event.target.value)}
                    placeholder="Phone / WhatsApp"
                    className="min-h-11 rounded-[6px] border border-white/15 bg-white/5 px-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#e6c878]"
                  />
                  <label className="flex min-h-11 items-center gap-3 rounded-[6px] border border-white/15 bg-white/5 px-3 focus-within:border-[#e6c878]">
                    <Mail size={16} className="shrink-0 text-white/45" />
                    <input
                      value={customerEmail}
                      onChange={(event) => setCustomerEmail(event.target.value)}
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      maxLength={254}
                      placeholder="Email for updates (optional)"
                      className="min-h-10 w-full bg-transparent text-sm text-white outline-none placeholder:text-white/40"
                    />
                  </label>
                  <textarea
                    value={customerAddress}
                    onChange={(event) => setCustomerAddress(event.target.value)}
                    placeholder="Delivery address"
                    rows={3}
                    className="min-h-24 resize-none rounded-[6px] border border-white/15 bg-white/5 px-3 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#e6c878]"
                  />
                  <input
                    value={paymentRef}
                    onChange={(event) => setPaymentRef(event.target.value)}
                    placeholder="UPI transaction ID"
                    className="min-h-11 rounded-[6px] border border-white/15 bg-white/5 px-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#e6c878]"
                  />
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[6px] border border-white/15 bg-white/5 px-3 text-sm text-white transition hover:border-[#e6c878]">
                    <ImageUp size={16} className="shrink-0 text-white/45" />
                    <span className="min-w-0 flex-1 truncate text-white/70">
                      {paymentProofFile ? paymentProofFile.name : "Upload payment screenshot"}
                    </span>
                    <input
                      key={proofInputKey}
                      type="file"
                      accept="image/*"
                      onChange={(event) => selectPaymentProof(event.target.files?.[0] || null)}
                      className="sr-only"
                    />
                  </label>
                </div>
                {canPay ? (
                  <div className="rounded-[6px] border border-white/15 bg-white p-4 text-center text-[#1f1d1a]">
                    {!qrFailed ? (
                      <img
                        src={qrCodeUrl}
                        alt={`UPI QR for ${formatPrice(subtotal)}`}
                        onError={() => setQrFailed(true)}
                        className="mx-auto aspect-square w-full max-w-[220px] object-contain"
                      />
                    ) : (
                      <div className="mx-auto flex aspect-square w-full max-w-[220px] items-center justify-center rounded-[6px] border border-dashed border-[#c9bea8] bg-[#fbfaf6] p-5 text-sm leading-6 text-[#626057]">
                        QR could not load. Use Pay button below.
                      </div>
                    )}
                    <p className="mt-3 text-xs font-bold uppercase text-[#8c6b2f]">
                      Scan with any UPI app
                    </p>
                    <p className="mt-1 text-xs text-[#626057]">
                      Amount and payment note are pre-filled.
                    </p>
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={submitOrder}
                  disabled={submitStatus === "submitting"}
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[6px] border border-[#e6c878]/45 bg-white/5 text-center text-sm font-black uppercase text-white transition hover:border-[#e6c878] hover:text-[#e6c878] disabled:cursor-wait disabled:opacity-60"
                >
                  {submitStatus === "submitting" ? (
                    <>
                      <AlertCircle size={18} />
                      Sending order
                    </>
                  ) : (
                    <>
                      <Send size={18} />
                      Submit order
                    </>
                  )}
                </button>

                {placedOrderId ? (
                  <div className="rounded-[6px] border border-emerald-300/35 bg-emerald-300/10 p-3 text-xs leading-5 text-emerald-50">
                    Last order ID: <strong>{placedOrderId}</strong>
                  </div>
                ) : null}
              </div>
            </div>

            <form onSubmit={checkTracking} className="rounded-[8px] border border-[#ded8cc] bg-white p-5 text-[#1f1d1a] shadow-[0_18px_50px_rgba(31,29,26,0.08)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase text-[#8c6b2f]">Shipment tracking</p>
                  <h2 className="mt-2 font-serif text-3xl font-semibold text-[#20201d]">Find order</h2>
                </div>
                <Truck className="text-[#6f7b65]" size={22} />
              </div>

              <div className="mt-4 flex flex-col gap-3">
                <input
                  value={trackingOrderId}
                  onChange={(event) => setTrackingOrderId(event.target.value)}
                  placeholder="Enter order ID"
                  className="min-h-11 rounded-[6px] border border-[#d6cebf] bg-[#fffdf8] px-3 text-sm outline-none placeholder:text-[#77736a] focus:border-[#8c6b2f]"
                />
                <button
                  disabled={trackingStatus === "loading"}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-[6px] bg-[#1f211d] px-4 text-xs font-black uppercase text-white transition hover:bg-[#8c6b2f] disabled:cursor-wait disabled:opacity-60"
                >
                  <Search size={16} />
                  {trackingStatus === "loading" ? "Checking" : "Check shipment"}
                </button>
              </div>

              {trackingStatus === "ready" && trackingResult ? (
                <div className="mt-4 rounded-[6px] border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-emerald-900">
                  <p>
                    Status: <strong>{trackingResult.status || "Order received"}</strong>
                  </p>
                  {trackingResult.trackingNumber ? (
                    <>
                      <p className="mt-2">
                        Shipment ID: <strong>{trackingResult.trackingNumber}</strong>
                      </p>
                      {trackingResult.trackingUrl ? (
                        <a
                          href={trackingResult.trackingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex min-h-10 w-fit items-center justify-center gap-2 rounded-[6px] border border-emerald-700 px-3 text-xs font-bold uppercase text-emerald-900 transition hover:bg-emerald-100"
                        >
                          <ExternalLink size={14} />
                          Open company link
                        </a>
                      ) : null}
                    </>
                  ) : null}
                </div>
              ) : null}

              {trackingStatus === "error" && trackingError ? (
                <div className="mt-4 rounded-[6px] border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-800">
                  {trackingError}
                </div>
              ) : null}
            </form>
          </aside>
        </div>
      </section>
    </Layout>
  );
}
