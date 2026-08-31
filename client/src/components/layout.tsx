import { Link, useLocation } from "wouter";
import { Search, ShoppingBag } from "lucide-react";
import logoImg from "@assets/logo2_1767450148274.png";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const showStorefrontActions = location === "/";

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary selection:text-primary-foreground">
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-[#e4ded2] bg-[#fffdfa]/96 shadow-[0_10px_30px_rgba(22,21,19,0.07)] backdrop-blur-xl">
        <div className="container mx-auto flex h-20 items-center gap-4 px-4 md:px-6">
          <div className="flex min-w-fit items-center">
            <Link href="/">
              <div
                className="group relative flex cursor-pointer items-center gap-3"
                data-testid="link-home"
              >
                <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-[6px] border border-[#d9cda7] bg-white">
                  <img
                    src={logoImg}
                    alt="Svarnikaa Logo"
                    className="h-full w-full scale-110 object-cover [mask-image:radial-gradient(circle,black_72%,transparent_100%)]"
                  />
                </div>
                <div className="block text-left sm:text-center">
                  <p className="font-serif text-[22px] font-semibold leading-none tracking-normal text-[#1f1d1a] sm:text-[28px]">SVARNIKAA</p>
                  <p className="mt-1 hidden text-[10px] font-semibold uppercase text-[#8c6b2f] sm:block">Jewellery Boutique</p>
                </div>
              </div>
            </Link>
          </div>

          {showStorefrontActions ? (
            <a
              href="#product-search"
              className="hidden min-h-11 flex-1 items-center gap-3 rounded-[6px] border border-[#d6cebf] bg-white px-4 text-sm text-[#5d5b55] transition hover:border-[#8c6b2f] md:flex"
            >
              <Search strokeWidth={1.7} size={18} className="text-[#8c6b2f]" />
              <span>Find products</span>
            </a>
          ) : (
            <div className="hidden flex-1 md:block" />
          )}

          <div className="ml-auto flex justify-end gap-2 text-[#241d17]">
            {showStorefrontActions ? (
              <>
                <a
                  href="#product-search"
                  className="flex h-10 w-10 items-center justify-center rounded-[6px] border border-transparent transition hover:border-[#d8c5a6] hover:text-[#8c6b2f] md:hidden"
                  data-testid="icon-search"
                  aria-label="Search"
                >
                  <Search strokeWidth={1.7} size={18} />
                </a>
                <a href="#checkout" className="flex h-10 w-10 items-center justify-center rounded-[6px] border border-transparent transition hover:border-[#d8c5a6] hover:text-[#8c6b2f]" aria-label="Cart">
                  <ShoppingBag strokeWidth={1.7} size={18} />
                </a>
              </>
            ) : null}
          </div>
        </div>
      </header>

      <main className="relative">
        {children}
      </main>

      <footer className="border-t border-[#d7c7aa] bg-[#1f211d] pb-10 pt-16 text-[#f8f2e8]">
        <div className="container mx-auto px-4 md:px-6">
          <div className="mb-12 grid grid-cols-1 gap-10 text-center md:grid-cols-3 md:text-left">
            <div className="space-y-4">
              <h4 className="font-serif text-2xl text-[#e8cb7d]">Order Desk</h4>
              <p className="text-sm leading-relaxed text-[#d9d1c3]">
                Every order is reviewed before confirmation and dispatch.
              </p>
            </div>
            
            <div className="flex flex-col items-center space-y-4">
              <h4 className="font-serif text-2xl text-[#e8cb7d]">Svarnikaa</h4>
              <p className="max-w-xs text-sm leading-6 text-[#d9d1c3]">
                Premium artificial jewellery curated for weddings, gifting, and graceful everyday shine.
              </p>
            </div>

            <div className="space-y-4 md:text-right">
              <h4 className="font-serif text-2xl text-[#e8cb7d]">Checkout Flow</h4>
              <p className="text-sm leading-relaxed text-[#d9d1c3]">
                Customer submits order, owner verifies payment, then shipment details are updated.
              </p>
            </div>
          </div>
          
          <div className="border-t border-white/10 pt-8 text-center">
            <p className="text-xs uppercase text-[#bdb5a6]">
              &copy; {new Date().getFullYear()} Svarnikaa. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
