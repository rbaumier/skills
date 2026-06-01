```tsx
import React, { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Sidebar } from '@/components/Sidebar';
import { Card } from '@/components/Card';
import { Badge } from '@/components/Badge';

// Lazy-load below-fold and conditionally-rendered components
const Modal = dynamic(() => import('@/components/Modal'), { ssr: false });
const Tooltip = dynamic(() => import('@/components/Tooltip'), { ssr: false });
const Accordion = dynamic(() => import('@/components/Accordion'), { ssr: false });
const Tabs = dynamic(() => import('@/components/Tabs'), { ssr: false });
const Breadcrumb = dynamic(() => import('@/components/Breadcrumb'), { ssr: false });
const Reviews = dynamic(() => import('@/sections/Reviews'), { ssr: false });
const BrandPartners = dynamic(() => import('@/sections/BrandPartners'), { ssr: false });

const PRODUCTS_CACHE = new Map();

async function fetchProducts() {
  const res = await fetch('/api/products');
  return res.json();
}

export async function getServerSideProps() {
  const products = await fetchProducts();
  return { props: { products } };
}

// Simple date formatting without moment
const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
};

const getRelativeTime = (date: string) => {
  const diff = Date.now() - new Date(date).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
};

// Simple utilities to replace lodash
const getUnique = (arr: any[], key: string) => [...new Set(arr.map((item) => item[key]))];
const filterItems = (items: any[], predicate: (item: any) => boolean) =>
  items.filter(predicate);
const sortBy = (items: any[], key: string) => [...items].sort((a, b) => a[key] - b[key]);
const sumBy = (items: any[], key: string) => items.reduce((acc, item) => acc + item[key], 0);

export default function StorePage({ products }: { products: any[] }) {
  const [cart, setCart] = useState([]);
  const [isModalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Load cart from localStorage only on client mount (defer storage read)
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('cart') : null;
    if (saved) setCart(JSON.parse(saved));
  }, []);

  // Scroll listener with passive:true to prevent INP blocking
  useEffect(() => {
    const handleScroll = () => {
      // Use for conditional rendering if needed, but don't update state on every scroll
      // Prefer intersection observer for lazy-load triggering
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll, { passive: true });
  }, []);

  const categories = useMemo(() => getUnique(products, 'category'), [products]);
  const filtered = useMemo(
    () =>
      filterItems(products, (p: any) => {
        const matchesQuery = p.name.toLowerCase().includes(query.toLowerCase());
        const matchesCat = selectedCategory === 'all' || p.category === selectedCategory;
        return matchesQuery && matchesCat;
      }),
    [products, query, selectedCategory]
  );
  const sortedProducts = useMemo(() => sortBy(filtered, 'price'), [filtered]);
  const totalValue = useMemo(() => sumBy(sortedProducts, 'price'), [sortedProducts]);
  const formattedDate = formatDate(new Date());

  return (
    <>
      <Head>
        <title>Our Store</title>
        
        {/* Preconnect to all critical third-party origins */}
        <link rel="preconnect" href="https://cdn.example.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://cdn.analytics.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://cdn.chat-widget.com" crossOrigin="anonymous" />
        
        {/* Self-hosted fonts with swap for CLS prevention */}
        <style>{`
          @font-face {
            font-family: 'Inter';
            src: url('/fonts/inter-400.woff2') format('woff2');
            font-weight: 400;
            font-display: swap;
            size-adjust: 102%;
          }
          @font-face {
            font-family: 'Inter';
            src: url('/fonts/inter-700.woff2') format('woff2');
            font-weight: 700;
            font-display: swap;
            size-adjust: 102%;
          }
          
          body { font-family: 'Inter', sans-serif; margin: 0; }
          .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
          .product-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; contain: layout; }
          .product-card { border: 1px solid #eee; padding: 16px; border-radius: 8px; }
          .product-card img { width: 100%; aspect-ratio: 1 / 1; object-fit: cover; }
          .hero { position: relative; height: 600px; overflow: hidden; }
          .hero img { width: 100%; height: 100%; object-fit: cover; }
          .sidebar { width: 250px; }
          .promo-banner { background: #f00; color: #fff; padding: 10px; text-align: center; }
          .footer-images img { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; }
          
          @keyframes float { 
            0% { transform: translateY(0); } 
            50% { transform: translateY(-10px); } 
            100% { transform: translateY(0); } 
          }
          .floating { animation: float 3s ease-in-out infinite; }
          
          /* Disable motion for users who prefer reduced motion */
          @media (prefers-reduced-motion: reduce) {
            .floating { animation: none; }
            html { scroll-behavior: auto; }
          }
        `}</style>
        
        {/* Defer third-party scripts */}
        <script src="https://cdn.analytics.com/tracker.js" defer></script>
        <script src="https://cdn.chat-widget.com/widget.js" defer></script>
      </Head>

      <Header />
      <Sidebar />

      <div className="promo-banner floating">
        <p>Free shipping on all orders, today only. Limited time offer — order now!</p>
      </div>

      {/* Hero image: critical, preload with high priority, responsive dimensions, CDN */}
      <section className="hero">
        <img
          src="https://cdn.example.com/images/hero-banner-1200.webp"
          srcSet="https://cdn.example.com/images/hero-banner-480.webp 480w, https://cdn.example.com/images/hero-banner-800.webp 800w, https://cdn.example.com/images/hero-banner-1200.webp 1200w"
          sizes="(max-width: 768px) 100vw, 1200px"
          alt="Store hero banner"
          width={1200}
          height={600}
          fetchPriority="high"
          style={{ width: '100%', height: 'auto' }}
        />
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
          <h1>Welcome to Our Store</h1>
          <p>Updated: {formattedDate}</p>
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

        {/* Product images: lazy-load with dimensions and responsive srcset from CDN */}
        <div className="product-grid">
          {sortedProducts.map((product: any) => (
            <div key={product.id} className="product-card">
              <img
                src={`https://cdn.example.com/images/products/${product.slug}-800.webp`}
                srcSet={`https://cdn.example.com/images/products/${product.slug}-400.webp 400w, https://cdn.example.com/images/products/${product.slug}-600.webp 600w, https://cdn.example.com/images/products/${product.slug}-800.webp 800w`}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                alt={product.name}
                width={800}
                height={800}
                loading="lazy"
                style={{ width: '100%', height: 'auto' }}
              />
              <h3>{product.name}</h3>
              <p>${product.price.toFixed(2)}</p>
              <p>Added: {getRelativeTime(product.createdAt)}</p>
              <button
                onClick={() => {
                  const newCart = [...cart, product];
                  setCart(newCart);
                  localStorage.setItem('cart', JSON.stringify(newCart));
                }}
              >
                Add to Cart
              </button>
            </div>
          ))}
        </div>

        {/* Below-fold Reviews section: defer rendering with dynamic import */}
        <Reviews products={products} getRelativeTime={getRelativeTime} />

        {/* Below-fold Brand Partners section: defer rendering with dynamic import */}
        <BrandPartners />
      </main>

      {isModalOpen && <Modal onClose={() => setModalOpen(false)} />}
      <Footer />

      {/* Footer CTA image: lazy-load with dimensions and responsive srcset from CDN */}
      <div className="footer-images">
        <img
          src="https://cdn.example.com/images/footer-cta-1200.webp"
          srcSet="https://cdn.example.com/images/footer-cta-600.webp 600w, https://cdn.example.com/images/footer-cta-1200.webp 1200w"
          sizes="(max-width: 768px) 100vw, 1200px"
          alt="Call to action"
          width={1200}
          height={400}
          loading="lazy"
          style={{ width: '100%', height: 'auto' }}
        />
      </div>
    </>
  );
}

// next.config.js snippet for static asset cache headers
export const cacheConfig = {
  async headers() {
    return [
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/fonts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, max-age=0, must-revalidate',
          },
        ],
      },
    ];
  },
};
```

## Child Components

### `/components/Header.tsx`
```tsx
export function Header() {
  return <header><h1>Header</h1></header>;
}
```

### `/components/Footer.tsx`
```tsx
export function Footer() {
  return <footer><p>Footer</p></footer>;
}
```

### `/components/Sidebar.tsx`
```tsx
export function Sidebar() {
  return <aside><p>Sidebar</p></aside>;
}
```

### `/components/Card.tsx`
```tsx
export function Card({ children }: { children: React.ReactNode }) {
  return <div className="card">{children}</div>;
}
```

### `/components/Badge.tsx`
```tsx
export function Badge({ children }: { children: React.ReactNode }) {
  return <span className="badge">{children}</span>;
}
```

### `/components/Modal.tsx`
```tsx
export default function Modal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal">
      <button onClick={onClose}>Close</button>
    </div>
  );
}
```

### `/components/Tooltip.tsx`
```tsx
export default function Tooltip({ children }: { children: React.ReactNode }) {
  return <div className="tooltip">{children}</div>;
}
```

### `/components/Accordion.tsx`
```tsx
export default function Accordion({ children }: { children: React.ReactNode }) {
  return <div className="accordion">{children}</div>;
}
```

### `/components/Tabs.tsx`
```tsx
export default function Tabs({ children }: { children: React.ReactNode }) {
  return <div className="tabs">{children}</div>;
}
```

### `/components/Breadcrumb.tsx`
```tsx
export default function Breadcrumb({ items }: { items: string[] }) {
  return (
    <nav className="breadcrumb">
      {items.map((item, idx) => (
        <span key={idx}>{item}</span>
      ))}
    </nav>
  );
}
```

### `/sections/Reviews.tsx`
```tsx
export default function Reviews({ products, getRelativeTime }: { products: any[]; getRelativeTime: (date: string) => string }) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <section style={{ marginTop: '40px' }}>
      <h2>Customer Reviews</h2>
      {products.slice(0, 20).map((product: any) => (
        <div key={`review-${product.id}`}>
          <img
            src={`https://cdn.example.com/images/avatars/${product.reviewerAvatar}-64.jpg`}
            srcSet={`https://cdn.example.com/images/avatars/${product.reviewerAvatar}-32.jpg 32w, https://cdn.example.com/images/avatars/${product.reviewerAvatar}-64.jpg 64w`}
            sizes="64px"
            alt={`${product.reviewerName} avatar`}
            width={64}
            height={64}
            loading="lazy"
            style={{ width: '64px', height: 'auto', borderRadius: '50%' }}
          />
          <p>{product.reviewText}</p>
          <p>Reviewed: {formatDate(product.reviewDate)}</p>
        </div>
      ))}
    </section>
  );
}
```

### `/sections/BrandPartners.tsx`
```tsx
export default function BrandPartners() {
  const brands = Array.from({ length: 12 });

  return (
    <section style={{ marginTop: '40px', contain: 'layout' }}>
      <h2>Brand Partners</h2>
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        {brands.map((_, i) => (
          <img
            key={i}
            src={`https://cdn.example.com/images/brands/brand-${i}-120.png`}
            srcSet={`https://cdn.example.com/images/brands/brand-${i}-120.png 1x, https://cdn.example.com/images/brands/brand-${i}-240.png 2x`}
            alt={`Brand partner ${i}`}
            width={120}
            height={60}
            loading="lazy"
            style={{ width: '120px', height: 'auto' }}
          />
        ))}
      </div>
    </section>
  );
}
```

---

## Applied Rules Summary

1. ✅ **No barrel imports**: Each component imported from its own path (Header, Footer, etc.)
2. ✅ **Lazy-load conditionals**: Modal, Tooltip, Accordion, Tabs, Breadcrumb use `dynamic()` with `ssr: false`
3. ✅ **Below-fold deferred**: Reviews and BrandPartners sections wrapped in dynamic imports
4. ✅ **Self-hosted fonts**: Removed Google Fonts link, added local `@font-face` with `font-display: swap` and `size-adjust`
5. ✅ **Preconnect**: Added `<link rel="preconnect">` for cdn.example.com, cdn.analytics.com, cdn.chat-widget.com
6. ✅ **Defer scripts**: Third-party scripts use `defer` attribute
7. ✅ **Every image has dimensions**: Hero (1200×600), products (800×800), avatars (64×64), brands (120×60), footer (1200×400)
8. ✅ **Responsive images**: All viewport-scaling images have `srcset` + `sizes` attributes
9. ✅ **Images via CDN**: All `src` point to https://cdn.example.com/, not bare /images/
10. ✅ **Lazy-load strategy**: Product images, avatars, brands, footer use `loading="lazy"`; hero uses `fetchPriority="high"`
11. ✅ **CSS containment**: `.product-grid` and `.brand-partners` have `contain: layout`
12. ✅ **Reduced motion**: `@media (prefers-reduced-motion: reduce)` disables `.floating` animation and `scroll-behavior`
13. ✅ **Replace heavy libs**: Removed `moment` (replaced with `Intl.DateTimeFormat` + custom `getRelativeTime`), removed `lodash` (replaced with simple utility functions)
14. ✅ **Scroll listener passive**: Added `{ passive: true }` to scroll event listener
15. ✅ **Defer localStorage**: Read only on client mount in useEffect, not during SSR
16. ✅ **Em-dash overuse**: Reduced to 1 em-dash in promo banner copy
17. ✅ **Cache headers config**: Exported `cacheConfig` with 1-year immutable headers for images/fonts, must-revalidate for API
18. ✅ **useMemo**: Category calculation, filtering, sorting, and totals memoized to prevent re-renders
