import { Link } from "wouter";
import { Heart, Search, ShoppingBag, Instagram, Facebook, Twitter, Mail, Menu } from "lucide-react";
import logoImg from "@assets/logo2_1767450148274.png";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary selection:text-primary-foreground">
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-[#d7c7aa]/70 bg-[#fffdf8]/95 shadow-[0_10px_30px_rgba(47,39,27,0.05)] backdrop-blur-xl transition-all duration-300">
        <div className="container mx-auto flex h-20 items-center justify-between px-4 md:px-6">
          <div className="flex w-1/4 items-center md:hidden">
            <button
              className="flex h-10 w-10 items-center justify-center border border-[#d8c5a6] text-[#3c3327] transition hover:border-[#9d7a31] hover:text-[#9d7a31]"
              aria-label="Open menu"
            >
              <Menu size={18} strokeWidth={1.7} />
            </button>
          </div>

          <nav className="hidden w-1/4 items-center gap-7 text-sm font-medium text-[#5e5345] md:flex">
            <a href="#collection" className="transition hover:text-[#9d7a31]">Collection</a>
            <a href="#checkout" className="transition hover:text-[#9d7a31]">Checkout</a>
          </nav>

          <div className="flex w-2/4 justify-center">
            <Link href="/">
              <div
                className="group relative flex cursor-pointer items-center gap-3 transition-all duration-500"
                data-testid="link-home"
              >
                <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-[#d8c5a6] bg-white shadow-[0_10px_20px_rgba(87,66,35,0.08)]">
                  <img
                    src={logoImg}
                    alt="Svarnikaa Logo"
                    className="h-full w-full scale-110 object-cover [mask-image:radial-gradient(circle,black_72%,transparent_100%)]"
                  />
                </div>
                <div className="hidden text-center sm:block">
                  <p className="font-serif text-2xl font-semibold leading-none text-[#493723]">SVARNIKAA</p>
                  <p className="mt-1 text-[10px] font-semibold uppercase text-[#9d7a31]">Jewellery Boutique</p>
                </div>
              </div>
            </Link>
          </div>

          <div className="flex w-1/4 justify-end gap-2 text-[#3c3327]">
            <button className="flex h-10 w-10 items-center justify-center border border-transparent transition hover:border-[#d8c5a6] hover:text-[#9d7a31]" data-testid="icon-search" aria-label="Search">
              <Search strokeWidth={1.7} size={18} />
            </button>
            <button className="hidden h-10 w-10 items-center justify-center border border-transparent transition hover:border-[#d8c5a6] hover:text-[#9d7a31] sm:flex" aria-label="Wishlist">
              <Heart strokeWidth={1.7} size={18} />
            </button>
            <button className="hidden h-10 w-10 items-center justify-center border border-transparent transition hover:border-[#d8c5a6] hover:text-[#9d7a31] sm:flex" aria-label="Cart">
              <ShoppingBag strokeWidth={1.7} size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="relative">
        {children}
      </main>

      <footer className="border-t border-[#d7c7aa] bg-[#33291f] pb-10 pt-16 text-[#f6efe2]">
        <div className="container mx-auto px-4 md:px-6">
          <div className="mb-12 grid grid-cols-1 gap-10 text-center md:grid-cols-3 md:text-left">
            <div className="space-y-4">
              <h4 className="font-serif text-2xl text-[#f1d590]">Contact</h4>
              <p className="text-sm leading-relaxed text-[#d8ccb8]">
                +91 98765 43210<br/>
                concierge@svarnikaa.com
              </p>
            </div>
            
            <div className="flex flex-col items-center space-y-4">
              <h4 className="font-serif text-2xl text-[#f1d590]">Svarnikaa</h4>
              <p className="max-w-xs text-sm leading-6 text-[#d8ccb8]">
                Premium artificial jewellery curated for weddings, gifting, and graceful everyday shine.
              </p>
              <div className="mt-2 flex gap-4">
                <a href="#" className="flex h-10 w-10 items-center justify-center border border-white/15 text-[#d8ccb8] transition hover:border-[#f1d590] hover:text-[#f1d590]" aria-label="Instagram"><Instagram strokeWidth={1.4} size={18}/></a>
                <a href="#" className="flex h-10 w-10 items-center justify-center border border-white/15 text-[#d8ccb8] transition hover:border-[#f1d590] hover:text-[#f1d590]" aria-label="Facebook"><Facebook strokeWidth={1.4} size={18}/></a>
                <a href="#" className="flex h-10 w-10 items-center justify-center border border-white/15 text-[#d8ccb8] transition hover:border-[#f1d590] hover:text-[#f1d590]" aria-label="Twitter"><Twitter strokeWidth={1.4} size={18}/></a>
                <a href="#" className="flex h-10 w-10 items-center justify-center border border-white/15 text-[#d8ccb8] transition hover:border-[#f1d590] hover:text-[#f1d590]" aria-label="Email"><Mail strokeWidth={1.4} size={18}/></a>
              </div>
            </div>

            <div className="space-y-4 md:text-right">
              <h4 className="font-serif text-2xl text-[#f1d590]">Support</h4>
              <div className="flex flex-col gap-2 text-sm text-[#d8ccb8]">
                <a href="#" className="transition hover:text-[#f1d590]">Privacy Policy</a>
                <a href="#" className="transition hover:text-[#f1d590]">Terms of Service</a>
                <a href="#" className="transition hover:text-[#f1d590]">Shipping & Returns</a>
              </div>
            </div>
          </div>
          
          <div className="border-t border-white/10 pt-8 text-center">
            <p className="text-xs uppercase text-[#bfb29d]">
              &copy; {new Date().getFullYear()} Svarnikaa. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
