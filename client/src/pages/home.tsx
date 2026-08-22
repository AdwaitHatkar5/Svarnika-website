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
      <section className="relative overflow-hidden bg-[#f7f2e8] pt-28 text-[#211c12]">
        <div className="absolute inset-x-0 top-0 h-40 bg-[#403307]" />
        <div className="container relative mx-auto grid min-h-[calc(100vh-5rem)] grid-cols-1 gap-8 px-4 pb-10 md:grid-cols-[minmax(0,1fr)_380px] md:px-6">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="flex min-h-[620px] flex-col overflow-hidden bg-white shadow-2xl"
          >
            <div className="grid grid-cols-1 border-b border-[#e7dac0] lg:grid-cols-[0.9fr_1.1fr]">
              <div className="relative min-h-[320px] overflow-hidden bg-[#2d260f]">
                <img
                  src={pendantNecklace}
                  alt="Svarnikaa jewellery"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#ffdf0b]">
                    Svarnikaa Marketplace
                  </p>
                  <h1 className="mt-3 font-serif text-5xl leading-none text-white md:text-6xl">
                    Wear the glow, skip the gold guilt.
                  </h1>
                </div>
              </div>

              <div className="flex flex-col justify-between gap-8 p-6 md:p-8">
                <div className="space-y-5">
                  <div className="inline-flex items-center gap-2 border border-[#dbc895] px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#745d13]">
                    <Sparkles size={14} />
                    Marketplace ready
                  </div>
                  <p className="max-w-2xl text-lg leading-8 text-[#56492e]">
                    Modiji-style reminder: gold buying pe one year ka pause? No stress.
                    Svarnikaa has the best royal-looking option for weddings,
                    gifting, and everyday shine without melting your budget.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="border border-[#eadfca] p-4">
                    <ShoppingBag className="mb-3 text-[#8a6d13]" size={22} />
                    <p className="text-sm font-bold">Cart checkout</p>
                    <p className="mt-1 text-xs text-[#76694d]">Add, review, pay by UPI.</p>
                  </div>
                  <div className="border border-[#eadfca] p-4">
                    <BadgeIndianRupee className="mb-3 text-[#8a6d13]" size={22} />
                    <p className="text-sm font-bold">Direct UPI</p>
                    <p className="mt-1 text-xs text-[#76694d]">Money goes only to your UPI ID.</p>
                  </div>
                  <div className="border border-[#eadfca] p-4">
                    <ShieldCheck className="mb-3 text-[#8a6d13]" size={22} />
                    <p className="text-sm font-bold">Sheet powered</p>
                    <p className="mt-1 text-xs text-[#76694d]">
                      {sheetStatus === "live"
                        ? "Live Google Sheet connected."
                        : sheetStatus === "loading"
                          ? "Loading your Google Sheet."
                          : "Using local products now."}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="sticky top-20 z-20 flex flex-col gap-4 border-b border-[#eadfca] bg-white/95 p-4 backdrop-blur md:flex-row md:items-center md:justify-between">
              <label className="flex min-h-12 flex-1 items-center gap-3 border border-[#dfd2b8] bg-[#fbf8f1] px-4">
                <Search size={18} className="text-[#7b6417]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search necklace, bangle, ring..."
                  className="w-full bg-transparent text-sm text-[#211c12] outline-none placeholder:text-[#8f846e]"
                />
              </label>

              <div className="flex gap-2 overflow-x-auto">
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => setActiveCategory(category)}
                    className={`min-h-12 whitespace-nowrap border px-4 text-xs font-bold uppercase tracking-[0.16em] transition ${
                      activeCategory === category
                        ? "border-[#211c12] bg-[#211c12] text-white"
                        : "border-[#dfd2b8] text-[#56492e] hover:border-[#8a6d13]"
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-px bg-[#eadfca] sm:grid-cols-2 xl:grid-cols-3">
              {visibleProducts.map((product) => (
                <article key={product.id} className="group bg-white">
                  <div className="aspect-square overflow-hidden bg-[#f4ecdd] p-5">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="space-y-4 p-5">
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8a6d13]">
                          {product.category || product.metal}
                        </p>
                        <p className="text-xs text-[#7d725f]">{product.stock || "In stock"}</p>
                      </div>
                      <h2 className="mt-2 font-serif text-2xl leading-tight text-[#211c12]">
                        {product.name}
                      </h2>
                    </div>
                    <p className="min-h-12 text-sm leading-6 text-[#62563e]">
                      {product.description}
                    </p>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-lg font-black text-[#211c12]">
                          {formatPrice(product.price)}
                        </p>
                        <p className="text-xs text-[#7d725f]">
                          {[product.metal, product.weight].filter(Boolean).join(" | ")}
                        </p>
                      </div>
                      <button
                        onClick={() => addToCart(product)}
                        className="min-h-11 bg-[#ffdf0b] px-4 text-xs font-black uppercase tracking-[0.16em] text-[#211c12] shadow-[0_8px_20px_rgba(120,92,7,0.18)] transition hover:bg-[#211c12] hover:text-white"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </motion.div>

          <aside className="md:sticky md:top-28 md:h-[calc(100vh-7rem)]">
            <div className="flex h-full flex-col bg-[#211c12] text-white shadow-2xl">
              <div className="border-b border-white/10 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#ffdf0b]">
                      Your Cart
                    </p>
                    <h2 className="mt-2 font-serif text-3xl text-white">
                      {totalItems} item{totalItems === 1 ? "" : "s"}
                    </h2>
                  </div>
                  <ShoppingBag className="text-[#ffdf0b]" />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                {cart.length === 0 ? (
                  <div className="flex h-full min-h-60 flex-col items-center justify-center border border-dashed border-white/20 p-6 text-center">
                    <ShoppingBag className="mb-4 text-white/45" />
                    <p className="font-serif text-2xl text-white">Cart is waiting.</p>
                    <p className="mt-2 text-sm leading-6 text-white/60">
                      Add your favourite pieces and the UPI payment section will be ready here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cart.map((item) => (
                      <div key={item.id} className="grid grid-cols-[72px_1fr] gap-3 border border-white/10 p-3">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="h-[72px] w-[72px] bg-white object-cover"
                        />
                        <div className="min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="line-clamp-2 text-sm font-bold">{item.name}</p>
                              <p className="mt-1 text-xs text-white/55">{formatPrice(item.price)}</p>
                            </div>
                            <button
                              onClick={() => removeItem(item.id)}
                              className="text-white/50 transition hover:text-[#ffdf0b]"
                              aria-label={`Remove ${item.name}`}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            <button
                              onClick={() => updateQuantity(item.id, -1)}
                              className="flex h-8 w-8 items-center justify-center border border-white/15"
                              aria-label={`Decrease ${item.name}`}
                            >
                              <Minus size={14} />
                            </button>
                            <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, 1)}
                              className="flex h-8 w-8 items-center justify-center border border-white/15"
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

              <div className="space-y-4 border-t border-white/10 p-5">
                <div className="flex items-center justify-between text-sm text-white/65">
                  <span>Subtotal</span>
                  <span className="font-bold text-white">{formatPrice(subtotal)}</span>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <input
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    placeholder="Your name"
                    className="min-h-11 border border-white/15 bg-white/5 px-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#ffdf0b]"
                  />
                  <input
                    value={customerPhone}
                    onChange={(event) => setCustomerPhone(event.target.value)}
                    placeholder="Phone / WhatsApp"
                    className="min-h-11 border border-white/15 bg-white/5 px-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#ffdf0b]"
                  />
                  <input
                    value={paymentRef}
                    onChange={(event) => setPaymentRef(event.target.value)}
                    placeholder="UPI reference after payment"
                    className="min-h-11 border border-white/15 bg-white/5 px-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#ffdf0b]"
                  />
                </div>

                <div className="border border-[#ffdf0b]/30 bg-[#ffdf0b]/10 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ffdf0b]">
                    Pay only here
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="break-all text-sm font-bold">{UPI_ID}</p>
                    <button
                      onClick={copyUpiId}
                      className="flex h-10 w-10 shrink-0 items-center justify-center border border-white/20"
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
                  className={`flex min-h-12 items-center justify-center gap-2 text-center text-sm font-black uppercase tracking-[0.18em] transition ${
                    cart.length && subtotal > 0
                      ? "bg-[#ffdf0b] text-[#211c12] hover:bg-white"
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
