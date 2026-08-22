import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpRight, X } from "lucide-react";
import { useState } from "react";
import qrPlaceholder from "@assets/stock_images/luxury_gold_qr_code__badcc23b.jpg";

interface ProductCardProps {
  product: {
    id: number;
    name: string;
    metal: string;
    weight: string;
    price: string;
    description: string;
    image: string;
  };
}

export function ProductCard({ product }: ProductCardProps) {
  const [showQR, setShowQR] = useState(false);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative w-full h-screen flex flex-col items-center justify-center text-center px-6"
    >
      <div className="absolute inset-0 z-0 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background z-10" />
        <img 
          src={product.image} 
          alt={product.name}
          className="w-[90%] h-[90%] object-cover opacity-40 scale-105 blur-[2px]"
        />
      </div>

      <div className="relative z-20 max-w-4xl space-y-8">
        <motion.span 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="text-[10px] text-primary uppercase tracking-[0.5em] font-light block"
        >
          {[product.metal, product.weight].filter(Boolean).join(" | ")}
        </motion.span>
        
        <motion.h2 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.5, delay: 0.2 }}
          className="font-serif text-5xl md:text-8xl text-heading tracking-tight leading-none"
        >
          {product.name}
        </motion.h2>

        <motion.p 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.8 }}
          className="text-lg md:text-2xl text-muted-foreground font-light italic max-w-2xl mx-auto"
        >
          {product.description}
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1 }}
          className="flex flex-col items-center gap-6 mt-12"
        >
          <button 
            onClick={() => setShowQR(true)}
            className="group flex items-center gap-4 text-heading hover:text-primary transition-colors duration-300"
          >
            <span className="font-serif tracking-[0.3em] uppercase text-sm">Order</span>
            <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center bg-[#1a1608] group-hover:bg-primary group-hover:text-black transition-all duration-500">
              <ArrowUpRight size={20} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
          </button>
        </motion.div>
      </div>

      <AnimatePresence>
        {showQR && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-xl p-6"
          >
            <button 
              onClick={() => setShowQR(false)}
              className="absolute top-10 right-10 text-heading hover:rotate-90 transition-transform duration-500"
            >
              <X size={32} strokeWidth={1} />
            </button>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card p-12 border border-white/10 rounded-3xl max-w-sm w-full text-center space-y-8 shadow-2xl"
            >
              <div className="space-y-2">
                <h3 className="font-serif text-3xl text-heading">Scan to Order</h3>
                <p className="text-muted-foreground text-sm font-light">Experience the royale concierge service</p>
              </div>
              <div className="relative aspect-square w-full bg-white p-6 rounded-2xl flex items-center justify-center group overflow-hidden">
                <img 
                  src={qrPlaceholder} 
                  alt="Order QR Code" 
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="pt-4">
                <p className="text-[10px] text-primary uppercase tracking-[0.3em] font-bold">Svarnikaa Royale Concierge</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
