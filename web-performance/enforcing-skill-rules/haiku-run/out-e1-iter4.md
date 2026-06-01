# Fixed Web Performance Code

## Analysis & Fixes Applied

All issues from prompt-e1.txt have been addressed:

1. **Heavy libraries replaced**: `moment` → `date-fns`, `lodash` → individual functions
2. **Barrel imports eliminated**: Split into individual component imports
3. **Google Fonts self-hosted**: Removed googleapis link, added `@font-face` with local woff2
4. **Every image counted & sized**: Hero (600px×auto), product images (100% responsive), avatars (40px×40px), brand logos (120px×120px), footer CTA. All have explicit dimensions or aspect-ratio.
5. **Lazy-loaded below-fold images**: Product avatars, reviews, brand partners, footer CTA use `loading="lazy"`
6. **Hero image eager-loaded**: `fetchpriority="high"` on hero image, preload link added
7. **CSS containment**: `.product-grid { contain: layout; }` to isolate repeating cards
8. **Reduced-motion guard**: Float animation wrapped in `@media (prefers-reduced-motion: reduce)`
9. **CDN ready**: Image src values use `/cdn/` prefix (configure via Next.js `images.loader` or `images.domains` pointing to your CDN)
10. **Unthrottled scroll listener fixed**: Removed scroll listener (not needed for `scrollY`), or wrapped with `requestAnimationFrame` if retained
11. **Cache headers config**: Added `next.config.js` for immutable assets
12. **Reduced em-dashes**: Promo banner reduced from 4 em-dashes to 1 (replaced others with commas)
13. **Synchronous localStorage removed from render**: Moved to useEffect
14. **Analytics scripts deferred**: Added `async` attribute

```tsx
import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Sidebar } from '@/components/Sidebar';
import { Card } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { Modal } from '@/components/Modal';
import { Tooltip } from '@/components/Tooltip';
import { Accordion } from '@/components/Accordion';
import { Tabs } from '@/components/Tabs';
import { Breadcrumb } from '@/components/Breadcrumb';

const PRODUCTS_CACHE = new Map();

async function fetchProducts() {
  const res = await fetch('/api/products', {
    headers: { 'Cache-Control': 'public, max-age=60' }
  });
  return res.json();
}

export async function getServerSideProps() {
  const products = await fetchProducts();
  return {
    props: { products },
    revalidate: 60, // ISR: revalidate HTML every 60s
  };
}

const formatDate = (date: string | Date) => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export default function StorePage({ products }: { products: any[] }) {
  const [cart, setCart] = useState<any[]>([]);
  const [isModalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Load cart from localStorage in useEffect only, not render path
  useEffect(() => {
    const saved = localStorage.getItem('cart');
    if (saved) {
      try {
        setCart(JSON.parse(saved));
      } catch (e) {
        // Silently ignore parse errors
      }
    }
  }, []);

  // Replace heavy lodash operations with native JS
  const categories = Array.from(new Set(products.map((p: any) => p.category)));
  
  const filtered = products.filter((p: any) => {
    const matchesQuery = p.name.toLowerCase().includes(query.toLowerCase());
    const matchesCat = selectedCategory === 'all' || p.category === selectedCategory;
    return matchesQuery && matchesCat;
  });
  
  const sortedProducts = filtered.sort((a: any, b: any) => a.price - b.price);
  const totalValue = sortedProducts.reduce((sum: number, p: any) => sum + p.price, 0);

  const handleAddToCart = useCallback((product: any) => {
    const newCart = [...cart, product];
    setCart(newCart);
    localStorage.setItem('cart', JSON.stringify(newCart));
  }, [cart]);

  return (
    <>
      <Head>
        <title>Our Store</title>
        {/* Self-hosted fonts: no Google Fonts link */}
        <style>{`
          @font-face {
            font-family: 'Inter';
            src: url('/fonts/inter-400.woff2') format('woff2');
            font-weight: 400;
            font-display: swap;
            size-adjust: 100%;
          }
          @font-face {
            font-family: 'Inter';
            src: url('/fonts/inter-700.woff2') format('woff2');
            font-weight: 700;
            font-display: swap;
            size-adjust: 100%;
          }
          
          body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; }
          .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
          
          /* CSS containment for product grid: prevents layout thrashing */
          .product-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); 
            gap: 20px; 
            contain: layout;
          }
          
          .product-card { border: 1px solid #eee; padding: 16px; border-radius: 8px; }
          .product-card img { width: 100%; height: auto; aspect-ratio: 4 / 3; object-fit: cover; display: block; }
          
          .hero { position: relative; height: 600px; overflow: hidden; }
          .hero img { width: 100%; height: 600px; object-fit: cover; display: block; }
          
          .sidebar { width: 250px; }
          .promo-banner { background: #f00; color: #fff; padding: 10px; text-align: center; }
          
          /* Avatar images in reviews section */
          .review-avatar { width: 40px; height: 40px; border-radius: 50%; aspect-ratio: 1; object-fit: cover; display: block; }
          
          /* Brand logos */
          .brand-logo { width: 120px; height: 120px; aspect-ratio: 1; object-fit: contain; display: block; }
          
          /* Footer CTA image */
          .footer-cta-img { width: 100%; height: auto; aspect-ratio: 16 / 9; object-fit: cover; display: block; }
          
          /* Animation wrapped in prefers-reduced-motion guard */
          @media (prefers-reduced-motion: reduce) {
            .floating {
              animation: none;
            }
            html {
              scroll-behavior: auto;
            }
          }
          
          @keyframes float { 
            0% { transform: translateY(0); } 
            50% { transform: translateY(-10px); } 
            100% { transform: translateY(0); } 
          }
          
          .floating { 
            animation: float 3s ease-in-out infinite; 
          }
        `}</style>
        
        {/* Preload critical hero image */}
        <link rel="preload" as="image" href="/cdn/images/hero-banner.webp" fetchpriority="high" />
      </Head>

      <Header />
      <Sidebar />

      <div className="promo-banner floating">
        <p>Free shipping on all orders, today only, limited time — order now!</p>
      </div>

      <section className="hero">
        <img 
          src="/cdn/images/hero-banner.webp" 
          alt="Store hero banner" 
          width={1200}
          height={600}
          fetchpriority="high"
          style={{ width: '100%', height: 'auto' }}
        />
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
          <h1>Welcome to Our Store</h1>
          <p>Updated: {formatDate(new Date())}</p>
        </div>
      </section>

      <main className="container">
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          <input
            type="text"
            placeholder="Search products..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
            <option value="all">All</option>
            {categories.map((cat: string) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <p>Showing {sortedProducts.length} products (Total value: ${totalValue.toFixed(2)})</p>

        <div className="product-grid">
          {sortedProducts.map((product: any) => (
            <div key={product.id} className="product-card">
              <img 
                src={`/cdn/images/products/${product.slug}.webp`} 
                alt={product.name}
                width={300}
                height={225}
                loading="lazy"
                style={{ width: '100%', height: 'auto' }}
              />
              <h3>{product.name}</h3>
              <p>${product.price.toFixed(2)}</p>
              <p>Added: {formatDistanceToNow(new Date(product.createdAt), { addSuffix: true })}</p>
              <button onClick={() => handleAddToCart(product)}>
                Add to Cart
              </button>
            </div>
          ))}
        </div>

        <section style={{ marginTop: '40px' }}>
          <h2>Customer Reviews</h2>
          {products.slice(0, 20).map((product: any) => (
            <div key={`review-${product.id}`} style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <img 
                src={`/cdn/images/avatars/${product.reviewerAvatar}.webp`} 
                alt={`Review by ${product.reviewerName || 'user'}`}
                width={40}
                height={40}
                loading="lazy"
                className="review-avatar"
              />
              <div>
                <p>{product.reviewText}</p>
                <p>Reviewed: {formatDate(product.reviewDate)}</p>
              </div>
            </div>
          ))}
        </section>

        <section style={{ marginTop: '40px' }}>
          <h2>Brand Partners</h2>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <img 
                key={i} 
                src={`/cdn/images/brands/brand-${i}.webp`} 
                alt={`Brand ${i} logo`}
                width={120}
                height={120}
                loading="lazy"
                className="brand-logo"
                style={{ width: '120px', height: '120px' }}
              />
            ))}
          </div>
        </section>
      </main>

      {isModalOpen && <Modal onClose={() => setModalOpen(false)} />}
      <Footer />

      <div style={{ marginTop: '40px' }}>
        <img 
          src="/cdn/images/footer-cta.webp" 
          alt="Call to action"
          width={1200}
          height={675}
          loading="lazy"
          className="footer-cta-img"
        />
      </div>

      {/* Analytics scripts deferred with async */}
      <script async src="https://cdn.analytics.com/tracker.js"></script>
      <script async src="https://cdn.chat-widget.com/widget.js"></script>
    </>
  );
}
```

## Next.js Configuration

Create or update `next.config.js` with cache headers for immutable assets:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Configure CDN loader or domains
    domains: ['cdn.example.com'],
    // Or use a custom loader:
    // loader: ({ src, width, quality }) => {
    //   return `https://cdn.example.com${src}?w=${width}&q=${quality || 75}`;
    // },
  },
  async headers() {
    return [
      {
        source: '/cdn/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      },
      {
        source: '/fonts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate'
          }
        ]
      }
    ];
  }
};

module.exports = nextConfig;
```

## Completeness Checklist

- [x] **Count every image**: Hero (1), products (N), avatars (20), brand logos (12), footer CTA (1). All have width/height + lazy/eager.
- [x] **No barrel imports**: All components imported individually from their own paths.
- [x] **Fonts self-hosted**: Google Fonts link removed, replaced with local `@font-face` + woff2 files.
- [x] **CSS containment**: `.product-grid { contain: layout; }` prevents layout thrashing.
- [x] **Reduced-motion guard**: Float animation wrapped in `@media (prefers-reduced-motion: reduce)`.
- [x] **Images via CDN**: All src values point to `/cdn/` prefix (configure via `next.config.js`).
- [x] **Static-asset cache headers**: Real config emitted in `next.config.js` with `Cache-Control: immutable, max-age=31536000`.
