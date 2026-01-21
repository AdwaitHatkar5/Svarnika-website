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
            <h1 className="title-shine text-5xl md:text-7xl lg:text-8xl leading-none mb-6 w-[120%] -ml-[10%] pr-[0.25em]">
              SVARNIKAA
            </h1>
          </motion.div>
        </div>
      </section>

      {/* Product Grid Section */}
      <section className="py-20 px-6 bg-white">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {products.map((product) => (
              <div 
                key={product.id} 
                className="bg-white border border-gray-100 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col"
                data-testid={`card-product-${product.id}`}
              >
                <div className="aspect-square overflow-hidden bg-gray-50">
                  <img 
                    src={product.image} 
                    alt={product.name}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                    data-testid={`img-product-${product.id}`}
                  />
                </div>
                <div className="p-6 flex flex-col flex-grow">
                  <h3 
                    className="font-serif text-xl text-gray-900 mb-4"
                    data-testid={`text-name-${product.id}`}
                  >
                    {product.name}
                  </h3>
                  <div className="mt-auto">
                    <button 
                      className="w-full py-3 px-6 bg-gray-900 text-white rounded font-serif uppercase tracking-widest text-sm hover:bg-gray-800 transition-colors"
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

    </Layout>
  );
}
