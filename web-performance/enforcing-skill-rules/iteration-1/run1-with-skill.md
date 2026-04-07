# With Skill - Run 1

## Output

Now I have the skill rules internalized and the prompt. Let me produce the fixed code.

```tsx
import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import { formatDistanceToNow, format } from 'date-fns';
import { Header, Footer, Sidebar } from '@/components';

const Modal = lazy(() => import('@/components/Modal'));

async function fetchProducts() {
  const res = await fetch('/api/products', {
    next: { revalidate: 60 },
  });
  return res.json();
}

export async function getStaticProps() {
  const products = await fetchProducts();
  return {
    props: { products },
    revalidate: 60,
  };
}

export default function StorePage({ products }: { products: any[] }) {
  const [cart, setCart] = useState<any[]>([]);
  const [isModalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('cart');
      if (saved) setCart(JSON.parse(saved));
    } catch {
      // Corrupted storage, ignore
    }
  }, []);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          ticking = false;
        });
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const categories = useMemo(
    () => [...new Set(products.map((p: any) => p.category))],
    [products]
  );

  const sortedProducts = useMemo(() => {
    const lowerQuery = query.toLowerCase();
    return products
      .filter((p: any) => {
        const matchesQuery = p.name.toLowerCase().includes(lowerQuery);
        const matchesCat = selectedCategory === 'all' || p.category === selectedCategory;
        return matchesQuery && matchesCat;
      })
      .sort((a: any, b: any) => a.price - b.price);
  }, [products, query, selectedCategory]);

  const totalValue = useMemo(
    () => sortedProducts.reduce((sum: number, p: any) => sum + p.price, 0),
    [sortedProducts]
  );

  const handleAddToCart = useCallback((product: any) => {
    setCart((prev) => {
      const newCart = [...prev, product];
      localStorage.setItem('cart', JSON.stringify(newCart));
      return newCart;
    });
  }, []);

  const formattedDate = format(new Date(), 'MMMM do yyyy, h:mm:ss a');

  return (
    <>
      <Head>
        <title>Our Store</title>
        <link
          rel="preload"
          as="image"
          href="/images/hero-banner.webp"
          fetchPriority="high"
        />
        <link
          rel="preload"
          as="font"
          type="font/woff2"
          href="/fonts/Inter-Regular.woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          as="font"
          type="font/woff2"
          href="/fonts/Inter-Bold.woff2"
          crossOrigin="anonymous"
        />
        <link rel="preconnect" href="https://cdn.analytics.com" />
        <link rel="preconnect" href="https://cdn.chat-widget.com" />
        <script src="https://cdn.analytics.com/tracker.js" defer />
        <script src="https://cdn.chat-widget.com/widget.js" defer />
        <style>{`
          @font-face {
            font-family: 'Inter';
            src: url('/fonts/Inter-Regular.woff2') format('woff2');
            font-weight: 400;
            font-display: swap;
            size-adjust: 100%;
          }
          @font-face {
            font-family: 'Inter';
            src: url('/fonts/Inter-Bold.woff2') format('woff2');
            font-weight: 700;
            font-display: swap;
            size-adjust: 100%;
          }
          body { font-family: 'Inter', sans-serif; margin: 0; }
          .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
          .product-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
          .product-card { border: 1px solid #eee; padding: 16px; border-radius: 8px; contain: layout style paint; }
          .product-card img { width: 100%; height: auto; }
          .hero { position: relative; height: 600px; overflow: hidden; }
          .hero img { width: 100%; height: 100%; object-fit: cover; }
          .sidebar { width: 250px; }
          .promo-banner { background: #f00; color: #fff; padding: 10px; text-align: center; }
          .footer-images img { width: 100%; height: auto; }
          @media (prefers-reduced-motion: reduce) {
            .floating { animation: none; }
          }
          @keyframes float { 0% { transform: translateY(0); } 50% { transform: translateY(-10px); } 100% { transform: translateY(0); } }
          .floating { animation: float 3s ease-in-out infinite; }
        `}</style>
      </Head>

      <Header />
      <Sidebar />

      <div className="promo-banner floating">
        <p>Free shipping on all orders, today only. Don't miss out (limited time). Order now!</p>
      </div>

      <section className="hero">
        <Image
          src="/images/hero-banner.webp"
          alt="Store hero"
          width={1200}
          height={600}
          priority
          fetchPriority="high"
          sizes="100vw"
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

        <div className="product-grid">
          {sortedProducts.map((product: any) => (
            <div key={product.id} className="product-card">
              <Image
                src={`/images/products/${product.slug}.webp`}
                alt={product.name}
                width={280}
                height={280}
                loading="lazy"
                sizes="(max-width: 768px) 100vw, 25vw"
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
            <div key={`review-${product.id}`}>
              <Image
                src={`/images/avatars/${product.reviewerAvatar}.webp`}
                alt=""
                width={48}
                height={48}
                loading="lazy"
              />
              <p>{product.reviewText}</p>
              <p>Reviewed: {format(new Date(product.reviewDate), 'PPP')}</p>
            </div>
          ))}
        </section>

        <section style={{ marginTop: '40px' }}>
          <h2>Brand Partners</h2>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <Image
                key={i}
                src={`/images/brands/brand-${i}.webp`}
                alt={`Brand ${i}`}
                width={120}
                height={60}
                loading="lazy"
              />
            ))}
          </div>
        </section>
      </main>

      {isModalOpen && (
        <Suspense fallback={null}>
          <Modal onClose={() => setModalOpen(false)} />
        </Suspense>
      )}
      <Footer />

      <div className="footer-images">
        <Image
          src="/images/footer-cta.webp"
          alt="Call to action"
          width={1200}
          height={300}
          loading="lazy"
          sizes="100vw"
        />
      </div>
    </>
  );
}
```

---

**Summary of all fixes applied, mapped to skill rules:**

1. **Replaced `moment` with `date-fns`** (tree-shake heavy libs: `moment` -> `date-fns`). `format` and `formatDistanceToNow` are direct imports, fully tree-shakeable.

2. **Replaced `lodash` full import with native JS** (`lodash` -> specific operations). `_.uniq` -> `[...new Set()]`, `_.filter`/`_.includes` -> `.filter`/`.includes`, `_.sortBy` -> `.sort`, `_.sumBy` -> `.reduce`. Zero dependency.

3. **Removed barrel file import for `Modal`**, lazy-loaded it with `React.lazy` + `Suspense` (code split non-critical components).

4. **Replaced all `<img>` with Next.js `<Image>`** with explicit `width`/`height` to prevent CLS. Used `webp` format (images < 200KB, use WebP/AVIF).

5. **Hero image**: `priority` + `fetchPriority="high"` + `<link rel="preload">` (eager load hero image with fetchpriority="high", preload critical images).

6. **All below-fold images**: `loading="lazy"` (lazy load below-fold images).

7. **Responsive `sizes` attribute** on images matching layout breakpoints (`100vw`, `25vw` for 4-col grid).

8. **Font optimization**: Removed Google Fonts external stylesheet. Self-hosted with `@font-face`, `font-display: swap`, `size-adjust`, and `<link rel="preload" as="font">` (eliminates extra DNS + connection, prevents CLS from font swap).

9. **Third-party scripts**: Changed from synchronous to `defer` (defer third-party scripts). Added `<link rel="preconnect">` for their origins.

10. **Scroll listener**: Added `passive: true`, throttled with `requestAnimationFrame`, added cleanup return (unthrottled scroll listeners without passive:true = INP killer). Removed `scrollY` state that caused re-renders on every scroll.

11. **`prefers-reduced-motion: reduce`**: Disables `.floating` animation entirely (respect prefers-reduced-motion: reduce, disable animations, not just slow them).

12. **Em-dash overuse**: Replaced 4 em-dashes in promo banner with commas/parentheses/periods (ban em-dash overuse: max 1 per paragraph).

13. **CSS containment**: Added `contain: layout style paint` on product cards (use CSS containment for layout isolation).

14. **`getServerSideProps` -> `getStaticProps` with `revalidate: 60`**: ISR for better TTFB since product data is not user-specific.

15. **`useMemo`/`useCallback`**: Memoized categories, filtered/sorted products, totalValue, and addToCart handler to prevent unnecessary re-computation on every render.

16. **Synchronous `localStorage` read**: Wrapped in try/catch and kept in `useEffect` (not render path) to avoid blocking main thread.

17. **Inlined critical CSS** stays (correct), non-critical styles should be deferred in production but the inline block here is small enough to be critical.