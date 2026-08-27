import { Layout } from "@/components/layout";
import { useToast } from "@/hooks/use-toast";
import { InventoryPayload, postToGoogleScript } from "@/lib/store";
import { ArrowLeft, Gem, Lock, Plus, Send } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { Link } from "wouter";

const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN || "";
const DEFAULT_ORDER_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwrVQRRaGE6gOiGWmv4OVsx4JgvB30El7QKRVZxvMCrCbP0q8qoUMANdncrzJW585WX/exec";
const ORDER_SCRIPT_URL = import.meta.env.VITE_GOOGLE_APPS_SCRIPT_URL || DEFAULT_ORDER_SCRIPT_URL;

const emptyProduct: InventoryPayload["product"] = {
  id: "",
  name: "",
  category: "",
  metal: "",
  weight: "",
  price: "",
  image: "",
  description: "",
  stock: "In stock",
};

export default function Admin() {
  const { toast } = useToast();
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(!ADMIN_PIN);
  const [product, setProduct] = useState(emptyProduct);
  const [saving, setSaving] = useState(false);

  const canSave = useMemo(
    () =>
      Boolean(
        product.name.trim() &&
          product.price.trim() &&
          product.image.trim() &&
          product.category?.trim(),
      ),
    [product],
  );

  function updateProduct(field: keyof InventoryPayload["product"], value: string) {
    setProduct((current) => ({
      ...current,
      [field]: value,
    }));
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
        description: "Name, category, price, and image URL are required.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      await postToGoogleScript(ORDER_SCRIPT_URL, {
        action: "inventory",
        product: {
          ...product,
          id: product.id || Date.now(),
          stock: product.stock || "In stock",
        },
      });

      setProduct(emptyProduct);
      toast({
        title: "Product sent",
        description: "Check the Inventory sheet. The storefront will update from the published sheet.",
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

  return (
    <Layout>
      <section className="min-h-screen bg-[#f8f3ea] px-4 pt-28 pb-12 text-[#30271f] md:px-6">
        <div className="container mx-auto max-w-5xl">
          <div className="mb-8 flex flex-col gap-4 border-b border-[#dfcfb5] pb-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-bold uppercase text-[#9d7a31]">
                <Gem size={16} />
                Inventory Desk
              </p>
              <h1 className="mt-2 font-serif text-4xl font-semibold text-[#463621] md:text-5xl">
                Add jewellery stock
              </h1>
            </div>
            <Link
              href="/"
              className="inline-flex min-h-11 w-fit items-center justify-center gap-2 border border-[#cdb98f] bg-white px-4 text-xs font-bold uppercase text-[#4a3d30] transition hover:border-[#9d7a31] hover:text-[#9d7a31]"
            >
              <ArrowLeft size={16} />
              Storefront
            </Link>
          </div>

          {!unlocked ? (
            <form
              onSubmit={unlock}
              className="mx-auto max-w-md border border-[#dfcfb5] bg-white p-6 shadow-[0_18px_50px_rgba(64,48,29,0.08)]"
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center border border-[#d8c5a6] text-[#9d7a31]">
                <Lock size={20} />
              </div>
              <label className="block text-xs font-bold uppercase text-[#806b45]">
                Admin PIN
              </label>
              <input
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                type="password"
                className="mt-2 min-h-12 w-full border border-[#dfd2b8] bg-[#fffdf8] px-4 text-sm outline-none focus:border-[#9d7a31]"
                autoFocus
              />
              <button className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 bg-[#3b3025] px-4 text-xs font-black uppercase text-white transition hover:bg-[#9d7a31]">
                <Lock size={16} />
                Unlock
              </button>
            </form>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <form
                onSubmit={saveProduct}
                className="border border-[#dfcfb5] bg-white p-5 shadow-[0_18px_50px_rgba(64,48,29,0.08)]"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    ["id", "Product ID"],
                    ["name", "Product name"],
                    ["category", "Category"],
                    ["metal", "Metal / material"],
                    ["weight", "Weight"],
                    ["price", "Price"],
                    ["image", "Image URL"],
                    ["stock", "Stock status"],
                  ].map(([field, label]) => (
                    <label key={field} className={field === "image" ? "md:col-span-2" : ""}>
                      <span className="text-xs font-bold uppercase text-[#806b45]">{label}</span>
                      <input
                        value={String(product[field as keyof InventoryPayload["product"]] || "")}
                        onChange={(event) =>
                          updateProduct(field as keyof InventoryPayload["product"], event.target.value)
                        }
                        className="mt-2 min-h-12 w-full border border-[#dfd2b8] bg-[#fffdf8] px-4 text-sm outline-none focus:border-[#9d7a31]"
                      />
                    </label>
                  ))}

                  <label className="md:col-span-2">
                    <span className="text-xs font-bold uppercase text-[#806b45]">Description</span>
                    <textarea
                      value={product.description}
                      onChange={(event) => updateProduct("description", event.target.value)}
                      rows={5}
                      className="mt-2 min-h-32 w-full resize-none border border-[#dfd2b8] bg-[#fffdf8] px-4 py-3 text-sm outline-none focus:border-[#9d7a31]"
                    />
                  </label>
                </div>

                <button
                  disabled={saving}
                  className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 bg-[#3b3025] px-4 text-xs font-black uppercase text-white transition hover:bg-[#9d7a31] disabled:cursor-wait disabled:opacity-60"
                >
                  {saving ? <Send size={16} /> : <Plus size={16} />}
                  {saving ? "Saving product" : "Add to inventory"}
                </button>
              </form>

              <aside className="border border-[#dfcfb5] bg-[#fffdf8] p-5 lg:self-start">
                <p className="text-xs font-bold uppercase text-[#9d7a31]">Required setup</p>
                <div className="mt-4 space-y-4 text-sm leading-6 text-[#6a5d4c]">
                  <p>Products are saved to the Google Sheet through Apps Script.</p>
                  <p>Use hosted image URLs from Netlify assets, Google Drive direct image links, Cloudinary, or any public CDN.</p>
                  <p>After saving, refresh the storefront once the published sheet updates.</p>
                </div>
              </aside>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}
