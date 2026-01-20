import { Layout } from "@/components/layout";
import { ProductCard } from "@/components/product-card";
import { assets, products } from "@/lib/data";
import { motion } from "framer-motion";
import { ShieldCheck, Leaf, Crown } from "lucide-react";

import pendantNecklace from "@assets/generated_images/small_diamond_emerald_pendant_necklace.png";

export default function Home() {
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
          >
            <h1 className="title-shine text-5xl md:text-7xl lg:text-8xl leading-none mb-6">
              Svarnikaa
            </h1>
            <p className="font-sans text-[13px] md:text-[15px] tracking-[0.5em] uppercase text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] via-[#F9E498] to-[#D4AF37] font-bold drop-shadow-[0_0_8px_rgba(212,175,55,0.3)]">
              Exclusively Royale.
            </p>
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
            A Journey into <br/> Handcrafted Grace
          </h2>
          <p className="text-xl md:text-2xl text-muted-foreground font-light leading-relaxed max-w-2xl mx-auto">
            We don't sell jewelry. <br/> 
            We curate heritage for those who understand <br/> 
            the silence of true luxury.
          </p>
        </motion.div>
      </section>

      {/* The Curated Series */}
      <div className="snap-y snap-mandatory">
        {products.map((product) => (
          <div key={product.id} className="snap-start">
            <ProductCard product={product} />
          </div>
        ))}
      </div>

      {/* Feature Highlights - Reduced Presence */}
      <section className="py-48 px-6 bg-background snap-start">
        <div className="container mx-auto grid grid-cols-1 md:grid-cols-3 gap-24 text-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
            className="flex flex-col items-center space-y-6"
          >
            <ShieldCheck className="text-primary w-6 h-6" strokeWidth={0.5} />
            <h3 className="font-serif text-xl text-heading tracking-widest uppercase">Purity</h3>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="flex flex-col items-center space-y-6"
          >
            <Leaf className="text-primary w-6 h-6" strokeWidth={0.5} />
            <h3 className="font-serif text-xl text-heading tracking-widest uppercase">Ethics</h3>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.4 }}
            className="flex flex-col items-center space-y-6"
          >
            <Crown className="text-primary w-6 h-6" strokeWidth={0.5} />
            <h3 className="font-serif text-xl text-heading tracking-widest uppercase">Legacy</h3>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
}
