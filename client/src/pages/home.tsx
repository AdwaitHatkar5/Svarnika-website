import { Layout } from "@/components/layout";
import { ProductCard } from "@/components/product-card";
import { assets } from "@/lib/data";
import products from "@/lib/products.json";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Leaf, Crown, X } from "lucide-react";
import { useState } from "react";
import qrPlaceholder from "@assets/stock_images/luxury_gold_qr_code__badcc23b.jpg";
import pendantNecklace from "@assets/generated_images/small_diamond_emerald_pendant_necklace.png";
import logoTitle from "@assets/SVARNIKAA-23-01-2026_1769178809917.png";

export default function Home() {
  const [selectedProduct, setSelectedProduct] = useState<typeof products[0] | null>(null);

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative h-screen w-full overflow-hidden flex items-center justify-center snap-start">
        <div className="absolute inset-0 z-0 flex items-center justify-center overflow-hidden">
          <div className="relative w-full h-full flex items-center justify-center">
            <img
              src={pendantNecklace}
              alt="Luxury Jewelry Background"
              className="w-full h-full object-cover opacity-100 scale-[0.9] blur-[2px]"
            />
            {/* Soft vignette/blur on edges */}
            <div className="absolute inset-0 shadow-[inset_0_0_100px_rgba(26,22,8,1)] pointer-events-none" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background" />
        </div>

        <div className="relative z-10 text-center space-y-6 max-w-3xl px-6 -translate-y-[15px]">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
            className="w-full flex justify-center"
          >
            <img 
              src={logoTitle} 
              alt="SVARNIKAA" 
              className="w-full max-w-[63rem] h-auto drop-shadow-[0_0_30px_rgba(211,175,55,0.3)]"
            />
          </motion.div>
        </div>
      </section>

      {/* Narrative Section */}
      <section className="h-screen flex items-center justify-center px-6 container mx-auto text-center snap-start">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 2 }}
          className="max-w-4xl mx-auto space-y-12"
        >
          <h2 className="font-serif text-4xl md:text-7xl text-heading leading-tight">
            A Journey into <br /> Handcrafted Grace
          </h2>
          <p className="text-xl md:text-2xl text-muted-foreground font-light leading-relaxed max-w-2xl mx-auto">
            <br />
            We curate heritage for those who know <br />
            the elegance of true luxury.
          </p>
        </motion.div>
      </section>

      {/* Product Grid Section */}
      <section className="py-32 px-6 bg-[#403307]">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
            {products.map((product) => (
              <div 
                key={product.id} 
                className="bg-white border border-black/5 rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-500 flex flex-col group"
                data-testid={`card-product-${product.id}`}
              >
                <div className="aspect-square overflow-hidden bg-gray-50">
                  <img 
                    src={product.image} 
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    data-testid={`img-product-${product.id}`}
                  />
                </div>
                <div className="p-8 flex flex-col flex-grow">
                  <h3 
                    className="font-serif text-2xl text-gray-900 mb-6"
                    data-testid={`text-name-${product.id}`}
                  >
                    {product.name}
                  </h3>
                  <div className="mt-auto">
                    <button 
                      onClick={() => setSelectedProduct(product)}
                      className="button-shining-gold w-full py-4 px-6 rounded-xl font-serif uppercase tracking-widest text-sm transition-transform active:scale-95 shadow-lg"
                      data-testid={`button-order-${product.id}`}
                    >
                      Order
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* QR Code Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-6"
          >
            <button 
              onClick={() => setSelectedProduct(null)}
              className="absolute top-10 right-10 text-white hover:rotate-90 transition-transform duration-500"
            >
              <X size={32} strokeWidth={1} />
            </button>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#1a1608] p-12 border border-white/10 rounded-3xl max-w-sm w-full text-center space-y-8 shadow-2xl"
            >
              <div className="space-y-2">
                <h3 className="font-serif text-3xl text-white">Scan to Order</h3>
                <p className="text-gray-400 text-sm font-light">Experience the royale concierge service</p>
              </div>
              <div className="relative aspect-square w-full bg-white p-6 rounded-2xl flex items-center justify-center group overflow-hidden">
                <img 
                  src={qrPlaceholder} 
                  alt="Order QR Code" 
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="pt-4">
                <p className="text-[10px] text-[#d3af37] uppercase tracking-[0.3em] font-bold">Svarnikaa Royale Concierge</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </Layout>
  );
}
