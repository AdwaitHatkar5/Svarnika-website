import { Link } from "wouter";
import { Heart, Search, ShoppingBag, Instagram, Facebook, Twitter, Mail, Menu, MapPin, User } from "lucide-react";
import logoImg from "@assets/logo2_1767450148274.png";

export function Layout({ children }: { children: React.ReactNode }) {
  const navItems = ["Rings", "Earrings", "Bracelets", "Necklaces", "Pendants"];

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary selection:text-primary-foreground">
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-[#e7dccb] bg-white/95 shadow-[0_10px_28px_rgba(48,39,31,0.06)] backdrop-blur-xl">
        <div className="container mx-auto flex h-20 items-center gap-4 px-4 md:px-6">
          <div className="flex items-center md:hidden">
            <button
              className="flex h-10 w-10 items-center justify-center border border-[#d8c5a6] text-[#3c3327] transition hover:border-[#9d7a31] hover:text-[#9d7a31]"
              aria-label="Open menu"
            >
              <Menu size={18} strokeWidth={1.7} />
            </button>
          </div>

          <div className="flex min-w-fit items-center">
            <Link href="/">
              <div
                className="group relative flex cursor-pointer items-center gap-3"
                data-testid="link-home"
              >
                <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-[#d8c5a6] bg-white">
                  <img
                    src={logoImg}
                    alt="Svarnikaa Logo"
                    className="h-full w-full scale-110 object-cover [mask-image:radial-gradient(circle,black_72%,transparent_100%)]"
                  />
                </div>
                <div className="hidden text-center sm:block">
                  <p className="font-serif text-[28px] font-semibold leading-none tracking-normal text-[#241d17]">SVARNIKAA</p>
                  <p className="mt-1 text-[10px] font-semibold uppercase text-[#9d7a31]">Jewellery Boutique</p>
                </div>
              </div>
            </Link>
          </div>

          <a
            href="#collection"
            className="hidden min-h-11 flex-1 items-center gap-3 border border-[#cfc1ad] px-4 text-sm text-[#6b6257] transition hover:border-[#9d7a31] md:flex"
          >
            <Search strokeWidth={1.7} size={18} className="text-[#9d7a31]" />
            <span>Search jewellery</span>
          </a>

          <div className="ml-auto flex justify-end gap-2 text-[#241d17]">
            <a
              href="#collection"
              className="flex h-10 w-10 items-center justify-center border border-transparent transition hover:border-[#d8c5a6] hover:text-[#9d7a31] md:hidden"
              data-testid="icon-search"
              aria-label="Search"
            >
              <Search strokeWidth={1.7} size={18} />
            </a>
            <a href="#collection" className="hidden h-10 items-center gap-2 border border-transparent px-3 text-xs font-semibold uppercase transition hover:border-[#d8c5a6] hover:text-[#9d7a31] lg:flex">
              <MapPin strokeWidth={1.7} size={17} />
              Stores
            </a>
            <button className="hidden h-10 w-10 items-center justify-center border border-transparent transition hover:border-[#d8c5a6] hover:text-[#9d7a31] sm:flex" aria-label="Account">
              <User strokeWidth={1.7} size={18} />
            </button>
            <button className="hidden h-10 w-10 items-center justify-center border border-transparent transition hover:border-[#d8c5a6] hover:text-[#9d7a31] sm:flex" aria-label="Wishlist">
              <Heart strokeWidth={1.7} size={18} />
            </button>
            <a href="#checkout" className="hidden h-10 w-10 items-center justify-center border border-transparent transition hover:border-[#d8c5a6] hover:text-[#9d7a31] sm:flex" aria-label="Cart">
              <ShoppingBag strokeWidth={1.7} size={18} />
            </a>
          </div>
        </div>
        <nav className="hidden border-t border-[#efe5d7] bg-[#f2e6d6] md:block">
          <div className="container mx-auto flex h-11 items-center justify-center gap-8 px-6 text-xs font-bold uppercase text-[#241d17]">
            {navItems.map((item) => (
              <a key={item} href="#collection" className="transition hover:text-[#9d7a31]">
                {item}
              </a>
            ))}
          </div>
        </nav>
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
