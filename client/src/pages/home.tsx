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
  BadgeIndianRupee,
  Check,
  Copy,
  ExternalLink,
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

const UPI_ID = import.meta.env.VITE_UPI_ID || "your-upi-id@upi";
const UPI_NAME = import.meta.env.VITE_UPI_NAME || "Svarnikaa";
const DEFAULT_SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTfSPkVApqhIMHfrGEaCr-Rg7IOSjjrdAbynlIo7FIpLXdlyDIpdQxZlup0Y2tvBw51OyjQBjJP2NAR/pub?gid=0&single=true&output=csv";
const DEFAULT_ORDER_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwrVQRRaGE6gOiGWmv4OVsx4JgvB30El7QKRVZxvMCrCbP0q8qoUMANdncrzJW585WX/exec";
const SHEET_CSV_URL = import.meta.env.VITE_GOOGLE_SHEET_CSV_URL || DEFAULT_SHEET_CSV_URL;
const ORDER_SCRIPT_URL = import.meta.env.VITE_GOOGLE_APPS_SCRIPT_URL || DEFAULT_ORDER_SCRIPT_URL;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

function withCacheBust(url: string) {
  const csvUrl = new URL(url);
  csvUrl.searchParams.set("_", String(Date.now()));
  return csvUrl.toString();
}

function buildUpiLink(total: number, items: CartItem[]) {
  const note = `Svarnikaa order: ${items
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
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  const [copied, setCopied] = useState(false);
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
  const upiLink = buildUpiLink(subtotal, cart);
  const isInventoryLoading = sheetStatus === "loading";

  function focusCategory(category: string) {
    setActiveCategory(category);
    document.getElementById("collection")?.scrollIntoView({ behavior: "smooth" });
  }

  function addToCart(product: StoreProduct) {
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);
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
        .map((item) =>
          item.id === productId
            ? { ...item, quantity: Math.max(0, item.quantity + direction) }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  function removeItem(productId: number) {
    setCart((current) => current.filter((item) => item.id !== productId));
  }

  function copyUpiId() {
    navigator.clipboard?.writeText(UPI_ID);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
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
        description: "Paste the UPI transaction/reference ID after payment.",
        variant: "destructive",
      });
      return;
    }

    const orderId = createOrderId();
    setSubmitStatus("submitting");

    try {
      await postToGoogleScript(ORDER_SCRIPT_URL, {
        action: "order",
        orderId,
        customerName: customerName.trim(),
        customerEmail: email ? email.toLowerCase() : "",
        customerPhone: customerPhone.trim(),
        customerAddress: customerAddress.trim(),
        paymentRef: paymentRef.trim(),
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
      <section className="bg-[#fbf8f2] pt-28 text-[#241d17] md:pt-32">
        <div className="border-b border-[#eadfce] bg-[#2d251e] text-[#f8ecd8]">
          <div className="container mx-auto flex flex-col gap-2 px-4 py-3 text-xs font-semibold uppercase md:flex-row md:items-center md:justify-between md:px-6">
            <span>Premium artificial jewellery | UPI checkout | India delivery</span>
            <span className="text-[#e0c178]">
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
          className="relative min-h-[500px] overflow-hidden bg-[#241d17] md:min-h-[620px]"
        >
          <img
            src={pendantNecklace}
            alt="Svarnikaa jewellery"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#17110d]/85 via-[#17110d]/35 to-transparent" />
          <div className="container relative mx-auto flex min-h-[500px] items-end px-4 pb-10 pt-12 md:min-h-[620px] md:px-6 md:pb-14">
            <div className="max-w-2xl text-white">
              <p className="text-xs font-bold uppercase text-[#e6c36f]">Svarnikaa Boutique</p>
              <h1 className="mt-4 font-serif text-5xl font-semibold leading-[0.96] text-white md:text-7xl">
                Occasion jewellery with a signature finish.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-8 text-white/78 md:text-lg">
                Polished bracelets, rings, chains and earrings selected for festive dressing, gifting and daily elegance.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#categories"
                  className="inline-flex min-h-12 items-center justify-center bg-white px-6 text-sm font-bold uppercase text-[#241d17] transition hover:bg-[#e6c36f]"
                >
                  Shop categories
                </a>
                <a
                  href="#checkout"
                  className="inline-flex min-h-12 items-center justify-center border border-white/45 px-6 text-sm font-bold uppercase text-white transition hover:border-[#e6c36f] hover:text-[#e6c36f]"
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
              <p className="text-xs font-bold uppercase text-[#9d7a31]">Shop by category</p>
              <h2 className="mt-2 font-serif text-4xl font-semibold text-[#2b2119] md:text-5xl">
                Find your perfect piece
              </h2>
            </div>
            <p className="text-sm leading-6 text-[#6f6254]">
              {isInventoryLoading ? "Loading live stock from Google Sheet." : `${products.length} pieces available now.`}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {categoryCards.slice(0, 4).map((category) => (
              <button
                key={category.name}
                onClick={() => focusCategory(category.name)}
                className="group relative aspect-[16/10] overflow-hidden bg-[#e7dccb] text-left"
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
        </section>

        <div className="border-y border-[#eadfce] bg-white">
          <div className="container mx-auto grid grid-cols-1 gap-4 px-4 py-5 md:grid-cols-3 md:px-6">
            {[
              ["Verified UPI flow", "Payment reference is captured with every order."],
              ["Owner reviewed", "Orders stay controlled before shipping."],
              ["Tracking ready", "Shipment ID can be added after dispatch."],
            ].map(([title, text]) => (
              <div key={title} className="flex gap-3">
                <ShieldCheck className="mt-1 shrink-0 text-[#9d7a31]" size={20} strokeWidth={1.7} />
                <div>
                  <h3 className="font-serif text-2xl text-[#2b2119]">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-[#6f6254]">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="container mx-auto grid grid-cols-1 gap-8 px-4 py-12 md:px-6 lg:grid-cols-[minmax(0,1fr)_390px] xl:grid-cols-[minmax(0,1fr)_420px]">
          <section id="collection" className="min-w-0 space-y-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-bold uppercase text-[#9d7a31]">Available stock</p>
                <h2 className="mt-2 font-serif text-4xl font-semibold text-[#2b2119] md:text-5xl">
                  Collection
                </h2>
              </div>
              <label className="flex min-h-12 w-full items-center gap-3 border border-[#d8c8b3] bg-white px-4 md:max-w-sm">
                <Search size={18} className="text-[#9d7a31]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search bracelets, rings, chains"
                  className="w-full bg-transparent text-sm text-[#241d17] outline-none placeholder:text-[#8f846e]"
                />
              </label>
            </div>

            <div className="flex gap-2 overflow-x-auto border-y border-[#e8ddca] py-3">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`min-h-11 whitespace-nowrap px-4 text-xs font-bold uppercase transition ${
                    activeCategory === category
                      ? "bg-[#2d251e] text-white"
                      : "border border-[#ded1be] bg-white text-[#5f5244] hover:border-[#9d7a31] hover:text-[#9d7a31]"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            {sheetStatus === "error" && inventoryError ? (
              <div className="border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                Live inventory could not be loaded: {inventoryError}. Showing local fallback collection.
              </div>
            ) : null}

            {isInventoryLoading ? (
              <div className="border border-dashed border-[#cdb98f] bg-white p-10 text-center">
                <Search className="mx-auto mb-4 text-[#9d7a31]" />
                <h3 className="font-serif text-3xl text-[#463621]">Refreshing collection</h3>
                <p className="mt-2 text-sm text-[#766958]">Loading live inventory from Google Sheet.</p>
              </div>
            ) : visibleProducts.length ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {visibleProducts.map((product) => (
                  <article
                    key={product.id}
                    className="group flex min-h-full flex-col overflow-hidden border border-[#e3d7c4] bg-white shadow-[0_16px_34px_rgba(47,39,31,0.06)] transition duration-300 hover:-translate-y-1 hover:border-[#c5a55c]"
                  >
                    <div className="relative aspect-[4/5] overflow-hidden bg-[#eee5d8]">
                      <img
                        src={product.image}
                        alt={product.name}
                        onError={(event) => {
                          event.currentTarget.onerror = null;
                          event.currentTarget.src = pendantNecklace;
                        }}
                        className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                      />
                      <div className="absolute left-3 top-3 bg-white/92 px-3 py-1 text-xs font-semibold text-[#5f4b2a] backdrop-blur">
                        {product.stock || "In stock"}
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col gap-4 p-5">
                      <div>
                        <p className="text-xs font-bold uppercase text-[#9d7a31]">
                          {product.category || product.metal}
                        </p>
                        <h3 className="mt-2 font-serif text-[28px] font-semibold leading-tight text-[#2b2119]">
                          {product.name}
                        </h3>
                      </div>
                      <p className="line-clamp-3 text-sm leading-6 text-[#6b5e4e]">{product.description}</p>
                      <div className="mt-auto border-t border-[#eadfca] pt-4">
                        <p className="text-xl font-black text-[#241d17]">{formatPrice(product.price)}</p>
                        <p className="mt-1 text-xs text-[#7d725f]">
                          {[product.metal, product.weight].filter(Boolean).join(" | ")}
                        </p>
                        <button
                          onClick={() => addToCart(product)}
                          className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 bg-[#2d251e] px-4 text-xs font-black uppercase text-white transition hover:bg-[#9d7a31]"
                        >
                          <ShoppingBag size={16} />
                          Add to cart
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="border border-dashed border-[#cdb98f] bg-white p-10 text-center">
                <Search className="mx-auto mb-4 text-[#9d7a31]" />
                <h3 className="font-serif text-3xl text-[#463621]">No pieces found</h3>
                <p className="mt-2 text-sm text-[#766958]">Try another search term or view all categories.</p>
              </div>
            )}
          </section>

          <aside id="checkout" className="space-y-4 lg:sticky lg:top-36 lg:self-start">
            <div className="overflow-hidden bg-[#2d251e] text-white shadow-[0_24px_70px_rgba(40,29,19,0.18)]">
              <div className="border-b border-white/10 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase text-[#e4c982]">Your cart</p>
                    <h2 className="mt-2 font-serif text-3xl font-semibold text-white">
                      {totalItems} item{totalItems === 1 ? "" : "s"}
                    </h2>
                  </div>
                  <ShoppingBag className="text-[#e4c982]" />
                </div>
              </div>

              <div className="max-h-[320px] overflow-y-auto p-5">
                {cart.length === 0 ? (
                  <div className="flex min-h-44 flex-col items-center justify-center border border-dashed border-white/20 bg-white/[0.03] p-6 text-center">
                    <ShoppingBag className="mb-4 text-[#e4c982]" />
                    <p className="font-serif text-2xl text-white">Cart is ready.</p>
                    <p className="mt-2 text-sm leading-6 text-white/60">Add pieces to begin checkout.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cart.map((item) => (
                      <div key={item.id} className="grid grid-cols-[64px_1fr] gap-3 border border-white/10 bg-white/[0.04] p-3">
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
                              className="text-white/50 transition hover:text-[#e4c982]"
                              aria-label={`Remove ${item.name}`}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            <button
                              onClick={() => updateQuantity(item.id, -1)}
                              className="flex h-8 w-8 items-center justify-center border border-white/15 transition hover:border-[#e4c982] hover:text-[#e4c982]"
                              aria-label={`Decrease ${item.name}`}
                            >
                              <Minus size={14} />
                            </button>
                            <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, 1)}
                              className="flex h-8 w-8 items-center justify-center border border-white/15 transition hover:border-[#e4c982] hover:text-[#e4c982]"
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

              <div className="space-y-4 border-t border-white/10 bg-[#261f19] p-5">
                <div className="flex items-center justify-between text-sm text-white/65">
                  <span>Subtotal</span>
                  <span className="font-bold text-[#f0d894]">{formatPrice(subtotal)}</span>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <input
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    placeholder="Your name"
                    className="min-h-11 border border-white/15 bg-white/5 px-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#e4c982]"
                  />
                  <input
                    value={customerPhone}
                    onChange={(event) => setCustomerPhone(event.target.value)}
                    placeholder="Phone / WhatsApp"
                    className="min-h-11 border border-white/15 bg-white/5 px-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#e4c982]"
                  />
                  <label className="flex min-h-11 items-center gap-3 border border-white/15 bg-white/5 px-3 focus-within:border-[#e4c982]">
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
                    className="min-h-24 resize-none border border-white/15 bg-white/5 px-3 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#e4c982]"
                  />
                  <input
                    value={paymentRef}
                    onChange={(event) => setPaymentRef(event.target.value)}
                    placeholder="UPI reference after payment"
                    className="min-h-11 border border-white/15 bg-white/5 px-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#e4c982]"
                  />
                </div>

                <div className="border border-[#e4c982]/35 bg-[#e4c982]/10 p-4">
                  <p className="text-xs font-bold uppercase text-[#e4c982]">Pay only here</p>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="break-all text-sm font-bold">{UPI_ID}</p>
                    <button
                      onClick={copyUpiId}
                      className="flex h-10 w-10 shrink-0 items-center justify-center border border-white/20 transition hover:border-[#e4c982] hover:text-[#e4c982]"
                      aria-label="Copy UPI ID"
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>

                <a
                  href={cart.length ? upiLink : undefined}
                  onClick={(event) => {
                    if (!cart.length || subtotal <= 0) event.preventDefault();
                  }}
                  className={`flex min-h-12 items-center justify-center gap-2 text-center text-sm font-black uppercase transition ${
                    cart.length && subtotal > 0
                      ? "bg-[#e4c982] text-[#241d17] hover:bg-white"
                      : "cursor-not-allowed bg-white/10 text-white/35"
                  }`}
                >
                  <BadgeIndianRupee size={18} />
                  Pay {subtotal > 0 ? formatPrice(subtotal) : "by UPI"}
                </a>

                <button
                  type="button"
                  onClick={submitOrder}
                  disabled={submitStatus === "submitting"}
                  className="flex min-h-12 w-full items-center justify-center gap-2 border border-[#e4c982]/45 bg-white/5 text-center text-sm font-black uppercase text-white transition hover:border-[#e4c982] hover:text-[#e4c982] disabled:cursor-wait disabled:opacity-60"
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
                  <div className="border border-emerald-300/35 bg-emerald-300/10 p-3 text-xs leading-5 text-emerald-50">
                    Last order ID: <strong>{placedOrderId}</strong>
                  </div>
                ) : null}
              </div>
            </div>

            <form onSubmit={checkTracking} className="border border-[#dfcfb5] bg-white p-5 text-[#241d17] shadow-[0_18px_50px_rgba(64,48,29,0.08)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase text-[#9d7a31]">Shipment tracking</p>
                  <h2 className="mt-2 font-serif text-3xl font-semibold text-[#2b2119]">Find order</h2>
                </div>
                <Truck className="text-[#9d7a31]" size={22} />
              </div>

              <div className="mt-4 flex flex-col gap-3">
                <input
                  value={trackingOrderId}
                  onChange={(event) => setTrackingOrderId(event.target.value)}
                  placeholder="Enter order ID"
                  className="min-h-11 border border-[#dfd2b8] bg-[#fffdf8] px-3 text-sm outline-none placeholder:text-[#8f846e] focus:border-[#9d7a31]"
                />
                <button
                  disabled={trackingStatus === "loading"}
                  className="flex min-h-11 items-center justify-center gap-2 bg-[#2d251e] px-4 text-xs font-black uppercase text-white transition hover:bg-[#9d7a31] disabled:cursor-wait disabled:opacity-60"
                >
                  <Search size={16} />
                  {trackingStatus === "loading" ? "Checking" : "Check shipment"}
                </button>
              </div>

              {trackingStatus === "ready" && trackingResult ? (
                <div className="mt-4 border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-emerald-900">
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
                          className="mt-3 inline-flex min-h-10 w-fit items-center justify-center gap-2 border border-emerald-700 px-3 text-xs font-bold uppercase text-emerald-900 transition hover:bg-emerald-100"
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
                <div className="mt-4 border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-800">
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
