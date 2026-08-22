import { Layout } from "@/components/layout";
import fallbackProducts from "@/lib/products.json";
import { motion } from "framer-motion";
import {
  BadgeIndianRupee,
  Check,
  Copy,
  Minus,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import pendantNecklace from "@assets/generated_images/small_diamond_emerald_pendant_necklace.png";

type SheetProduct = {
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

type CartItem = SheetProduct & {
  quantity: number;
};

const UPI_ID = import.meta.env.VITE_UPI_ID || "your-upi-id@upi";
const UPI_NAME = import.meta.env.VITE_UPI_NAME || "Svarnikaa";
const SHEET_CSV_URL = import.meta.env.VITE_GOOGLE_SHEET_CSV_URL || "";

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function parsePrice(value: string) {
  const parsed = Number(String(value).replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatPrice(value: string | number) {
  const amount = typeof value === "number" ? value : parsePrice(value);
  return amount > 0 ? currency.format(amount) : "Price on request";
}

function parseCsv(csv: string) {
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

function productsFromCsv(csv: string): SheetProduct[] {
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
        image: entry.image || entry.image_url || entry.photo || pendantNecklace,
        category: entry.category || "Jewellery",
        stock: entry.stock || entry.available || "In stock",
      };
    })
    .filter((product) => product.name && product.image);
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
  const [products, setProducts] = useState<SheetProduct[]>(
    fallbackProducts as SheetProduct[],
  );
  const [sheetStatus, setSheetStatus] = useState<"local" | "loading" | "live" | "error">(
    SHEET_CSV_URL ? "loading" : "local",
  );
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!SHEET_CSV_URL) return;

    fetch(SHEET_CSV_URL)
      .then((response) => {
        if (!response.ok) throw new Error("Sheet could not be loaded");
        return response.text();
      })
      .then((csv) => {
        const sheetProducts = productsFromCsv(csv);
        if (!sheetProducts.length) throw new Error("Sheet has no products");
        setProducts(sheetProducts);
        setSheetStatus("live");
      })
      .catch(() => setSheetStatus("error"));
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

  function addToCart(product: SheetProduct) {
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

  return (
    <Layout>
      <section className="relative overflow-hidden bg-[#f8f3ea] pt-24 text-[#30271f]">
        <div className="border-y border-[#dfcfb5] bg-[#342a20] text-[#f7ead0]">
          <div className="container mx-auto flex flex-col gap-2 px-4 py-3 text-sm md:flex-row md:items-center md:justify-between md:px-6">
            <span className="font-medium">
              Premium artificial jewellery for weddings, gifting, and daily elegance.
            </span>
            <span className="text-[#d9bd79]">
              {sheetStatus === "live"
                ? "Live inventory connected"
                : sheetStatus === "loading"
                  ? "Refreshing inventory"
                  : sheetStatus === "error"
                    ? "Showing local collection"
                    : "Curated local collection"}
            </span>
          </div>
        </div>

        <div className="container relative mx-auto grid grid-cols-1 gap-8 px-4 py-8 md:px-6 lg:grid-cols-[minmax(0,1fr)_390px]">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="min-w-0 space-y-8"
          >
            <section className="grid min-h-[520px] overflow-hidden border border-[#dfcfb5] bg-white shadow-[0_24px_70px_rgba(64,48,29,0.10)] lg:grid-cols-[1.05fr_0.95fr]">
              <div className="relative min-h-[360px] overflow-hidden bg-[#2f271f]">
                <img
                  src={pendantNecklace}
                  alt="Svarnikaa jewellery"
                  className="h-full w-full object-cover transition duration-700 hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#241d17]/55 via-transparent to-transparent" />
                <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-4 text-white">
                  <div>
                    <p className="text-xs font-semibold uppercase text-[#ead391]">
                      Signature Edit
                    </p>
                    <p className="mt-2 max-w-xs text-sm leading-6 text-white/75">
                      Handpicked pieces with a warm gold finish and a refined Indian sensibility.
                    </p>
                  </div>
                  <div className="hidden border border-white/25 bg-white/10 px-4 py-3 text-right backdrop-blur sm:block">
                    <p className="text-2xl font-semibold">{products.length}</p>
                    <p className="text-xs text-white/70">pieces</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-between gap-8 p-6 md:p-10">
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-2 border border-[#dcc79d] bg-[#fcf8ef] px-3 py-2 text-xs font-bold uppercase text-[#8d6f2e]">
                    <Sparkles size={14} />
                    Svarnikaa Boutique
                  </div>
                  <div className="space-y-4">
                    <h1 className="max-w-3xl font-serif text-5xl font-semibold leading-none text-[#463621] md:text-7xl">
                      Crafted in gold. Curated with grace.
                    </h1>
                    <p className="max-w-2xl text-base leading-8 text-[#6a5d4c] md:text-lg">
                      Explore jewellery that feels ceremonial, polished, and easy to wear.
                      Add favourites to your cart, review the order, and pay securely through UPI.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <a
                      href="#collection"
                      className="inline-flex min-h-12 items-center justify-center bg-[#3b3025] px-6 text-sm font-bold uppercase text-white transition hover:bg-[#9d7a31]"
                    >
                      View collection
                    </a>
                    <a
                      href="#checkout"
                      className="inline-flex min-h-12 items-center justify-center border border-[#cdb98f] bg-white px-6 text-sm font-bold uppercase text-[#4a3d30] transition hover:border-[#9d7a31] hover:text-[#9d7a31]"
                    >
                      Review cart
                    </a>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="border border-[#eadfca] bg-[#fffdf8] p-4">
                    <ShoppingBag className="mb-3 text-[#9d7a31]" size={22} strokeWidth={1.7} />
                    <p className="text-sm font-bold text-[#342a20]">Simple cart</p>
                    <p className="mt-1 text-xs leading-5 text-[#7b6f60]">
                      Add, update, and remove items quickly.
                    </p>
                  </div>
                  <div className="border border-[#eadfca] bg-[#fffdf8] p-4">
                    <BadgeIndianRupee className="mb-3 text-[#9d7a31]" size={22} strokeWidth={1.7} />
                    <p className="text-sm font-bold text-[#342a20]">UPI checkout</p>
                    <p className="mt-1 text-xs leading-5 text-[#7b6f60]">
                      Direct payment using your configured UPI ID.
                    </p>
                  </div>
                  <div className="border border-[#eadfca] bg-[#fffdf8] p-4">
                    <ShieldCheck className="mb-3 text-[#9d7a31]" size={22} strokeWidth={1.7} />
                    <p className="text-sm font-bold text-[#342a20]">Live-ready stock</p>
                    <p className="mt-1 text-xs leading-5 text-[#7b6f60]">
                      {sheetStatus === "live"
                        ? "Connected to your Google Sheet."
                        : sheetStatus === "loading"
                          ? "Checking the Google Sheet."
                          : "Using local products now."}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section id="collection" className="space-y-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase text-[#9d7a31]">Available Stock</p>
                  <h2 className="mt-2 font-serif text-4xl font-semibold text-[#463621] md:text-5xl">
                    Curated collection
                  </h2>
                </div>
                <p className="max-w-xl text-sm leading-6 text-[#766958]">
                  Browse by collection or search for a piece. The layout stays modular for future JSON or sheet updates.
                </p>
              </div>

              <div className="sticky top-20 z-20 flex flex-col gap-4 border border-[#dfcfb5] bg-[#fffdf8]/95 p-3 shadow-[0_16px_40px_rgba(64,48,29,0.08)] backdrop-blur md:flex-row md:items-center md:justify-between">
                <label className="flex min-h-12 flex-1 items-center gap-3 border border-[#dfd2b8] bg-white px-4">
                  <Search size={18} className="text-[#9d7a31]" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search necklace, bangle, ring..."
                    className="w-full bg-transparent text-sm text-[#30271f] outline-none placeholder:text-[#8f846e]"
                  />
                </label>

                <div className="flex gap-2 overflow-x-auto">
                  {categories.map((category) => (
                    <button
                      key={category}
                      onClick={() => setActiveCategory(category)}
                      className={`min-h-12 whitespace-nowrap border px-4 text-xs font-bold uppercase transition ${
                        activeCategory === category
                          ? "border-[#342a20] bg-[#342a20] text-white"
                          : "border-[#dfd2b8] bg-white text-[#5f5244] hover:border-[#9d7a31] hover:text-[#9d7a31]"
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>

              {visibleProducts.length ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {visibleProducts.map((product) => (
                    <article
                      key={product.id}
                      className="group flex min-h-full flex-col overflow-hidden border border-[#e3d4bb] bg-white shadow-[0_18px_50px_rgba(64,48,29,0.08)] transition duration-300 hover:-translate-y-1 hover:border-[#c7a763] hover:shadow-[0_26px_70px_rgba(64,48,29,0.14)]"
                    >
                      <div className="relative aspect-[4/5] overflow-hidden bg-[#f1eadf]">
                        <img
                          src={product.image}
                          alt={product.name}
                          className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                        />
                        <div className="absolute left-3 top-3 border border-white/70 bg-white/90 px-3 py-1 text-xs font-semibold text-[#6a5838] backdrop-blur">
                          {product.stock || "In stock"}
                        </div>
                      </div>
                      <div className="flex flex-1 flex-col gap-4 p-5">
                        <div>
                          <p className="text-xs font-bold uppercase text-[#9d7a31]">
                            {product.category || product.metal}
                          </p>
                          <h3 className="mt-2 font-serif text-2xl font-semibold leading-tight text-[#3b3025]">
                            {product.name}
                          </h3>
                        </div>
                        <p className="min-h-12 text-sm leading-6 text-[#6b5e4e]">
                          {product.description}
                        </p>
                        <div className="mt-auto border-t border-[#eadfca] pt-4">
                          <div className="mb-4 flex items-end justify-between gap-4">
                            <div>
                              <p className="text-xl font-black text-[#30271f]">
                                {formatPrice(product.price)}
                              </p>
                              <p className="mt-1 text-xs text-[#7d725f]">
                                {[product.metal, product.weight].filter(Boolean).join(" | ")}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => addToCart(product)}
                            className="flex min-h-11 w-full items-center justify-center gap-2 bg-[#3b3025] px-4 text-xs font-black uppercase text-white transition hover:bg-[#9d7a31]"
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
                  <p className="mt-2 text-sm text-[#766958]">
                    Try another search term or switch back to the full collection.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 border-y border-[#dfcfb5] bg-white px-5 py-6 md:grid-cols-3">
                <div className="flex gap-4">
                  <ShieldCheck className="mt-1 shrink-0 text-[#9d7a31]" size={22} strokeWidth={1.7} />
                  <div>
                    <h3 className="font-serif text-2xl text-[#463621]">Quality checked</h3>
                    <p className="mt-1 text-sm leading-6 text-[#766958]">
                      Each listing is prepared for a confident, boutique-style purchase.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <Sparkles className="mt-1 shrink-0 text-[#9d7a31]" size={22} strokeWidth={1.7} />
                  <div>
                    <h3 className="font-serif text-2xl text-[#463621]">Gift-ready finish</h3>
                    <p className="mt-1 text-sm leading-6 text-[#766958]">
                      A polished catalogue experience for customers choosing occasion pieces.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <BadgeIndianRupee className="mt-1 shrink-0 text-[#9d7a31]" size={22} strokeWidth={1.7} />
                  <div>
                    <h3 className="font-serif text-2xl text-[#463621]">Direct payment</h3>
                    <p className="mt-1 text-sm leading-6 text-[#766958]">
                      The existing UPI flow remains visible, simple, and fast.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </motion.div>

          <aside id="checkout" className="lg:sticky lg:top-28 lg:h-[calc(100vh-8rem)]">
            <div className="flex h-full flex-col border border-[#4d4032] bg-[#30271f] text-white shadow-[0_24px_70px_rgba(40,29,19,0.22)]">
              <div className="border-b border-white/10 bg-[#382e24] p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase text-[#e4c982]">
                      Your Cart
                    </p>
                    <h2 className="mt-2 font-serif text-3xl font-semibold text-white">
                      {totalItems} item{totalItems === 1 ? "" : "s"}
                    </h2>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center border border-[#e4c982]/35 bg-[#e4c982]/10 text-[#e4c982]">
                    <ShoppingBag />
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                {cart.length === 0 ? (
                  <div className="flex h-full min-h-60 flex-col items-center justify-center border border-dashed border-white/20 bg-white/[0.03] p-6 text-center">
                    <ShoppingBag className="mb-4 text-[#e4c982]" />
                    <p className="font-serif text-2xl text-white">Cart is ready.</p>
                    <p className="mt-2 text-sm leading-6 text-white/60">
                      Add favourite pieces and the checkout details will stay organised here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cart.map((item) => (
                      <div key={item.id} className="grid grid-cols-[76px_1fr] gap-3 border border-white/10 bg-white/[0.04] p-3">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="h-[76px] w-[76px] bg-white object-cover"
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

              <div className="space-y-4 border-t border-white/10 bg-[#2b231c] p-5">
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
                  <input
                    value={paymentRef}
                    onChange={(event) => setPaymentRef(event.target.value)}
                    placeholder="UPI reference after payment"
                    className="min-h-11 border border-white/15 bg-white/5 px-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#e4c982]"
                  />
                </div>

                <div className="border border-[#e4c982]/35 bg-[#e4c982]/10 p-4">
                  <p className="text-xs font-bold uppercase text-[#e4c982]">
                    Pay only here
                  </p>
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
                      ? "bg-[#e4c982] text-[#30271f] hover:bg-white"
                      : "cursor-not-allowed bg-white/10 text-white/35"
                  }`}
                >
                  <BadgeIndianRupee size={18} />
                  Pay {subtotal > 0 ? formatPrice(subtotal) : "by UPI"}
                </a>

                <p className="text-xs leading-5 text-white/50">
                  After payment, keep the UPI reference here. This front-end prepares the order;
                  final confirmation can be connected to WhatsApp, email, or a backend next.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </Layout>
  );
}
