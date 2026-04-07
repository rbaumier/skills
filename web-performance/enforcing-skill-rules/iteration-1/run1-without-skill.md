# Without Skill - Run 1

## Output

Here is the fixed code:

```tsx
import React from 'react';
import Head from 'next/head';
import Image from 'next/image';
import dynamic from 'next/dynamic';

const Modal = dynamic(() => import('@/components').then((mod) => mod.Modal), {
  ssr: false,
});

import { Header, Footer, Sidebar, Card, Badge, Tooltip, Accordion, Tabs, Breadcrumb } from '@/components';

async function fetchProducts() {
  const res = await fetch('/api/products');
  return res.json();
}

export async function getStaticProps() {
  const products = await fetchProducts();
  return {
    props: { products },
    revalidate: 60,
  };
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 30) return `${diffDays} days ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function StorePage({ products }: { products: any[] }) {
  const [cart, setCart] = React.useState([]);
  const [isModalOpen, setModalOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState('all');

  React.useEffect(() => {
    const saved = localStorage.getItem('cart');
    if (saved) setCart(JSON.parse(saved));
  }, []);

  const categories = React.useMemo(
    () => [...new Set(products.map((p: any) => p.category))],
    [products]
  );

  const sortedProducts = React.useMemo(() => {
    const lowerQuery = query.toLowerCase();
    return products
      .filter((p: any) => {
        const matchesQuery = p.name.toLowerCase().includes(lowerQuery);
        const matchesCat = selectedCategory === 'all' || p.category === selectedCategory;
        return matchesQuery && matchesCat;
      })
      .sort((a: any, b: any) => a.price - b.price);
  }, [products, query, selectedCategory]);

  const totalValue = React.useMemo(
    () => sortedProducts.reduce((sum: number, p: any) => sum + p.price, 0),
    [sortedProducts]
  );

  const handleSearch = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value),
    []
  );

  const handleCategoryChange = React.useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => setSelectedCategory(e.target.value),
    []
  );

  const addToCart = React.useCallback(
    (product: any) => {
      setCart((prev) => {
        const newCart = [...prev, product];
        localStorage.setItem('cart', JSON.stringify(newCart));
        return newCart;
      });
    },
    []
  );

  return (
    <>
      <Head>
        <title>Our Store</title>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap"
          rel="stylesheet"
        />
        <script src="https://cdn.analytics.com/tracker.js" async defer></script>
        <script src="https://cdn.chat-widget.com/widget.js" async defer></script>
        <style>{`
          body { font-family: 'Inter', sans-serif; margin: 0; }
          .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
          .product-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
          .product-card { border: 1px solid #eee; padding: 16px; border-radius: 8px; }
          .product-card img { width: 100%; }
          .hero { position: relative; height: 600px; overflow: hidden; }
          .sidebar { width: 250px; }
          .promo-banner { background: #f00; color: #fff; padding: 10px; text-align: center; }
          .footer-images img { width: 100%; }
        `}</style>
      </Head>

      <Header />
      <Sidebar />

      <div className="promo-banner">
        <p>Free shipping on all orders &mdash; today only!</p>
      </div>

      <section className="hero">
        <Image
          src="/images/hero-banner.png"
          alt="Store hero"
          fill
          style={{ objectFit: 'cover' }}
          priority
          sizes="100vw"
        />
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
          <h1>Welcome to Our Store</h1>
        </div>
      </section>

      <main className="container">
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          <input
            type="text"
            placeholder="Search products..."
            value={query}
            onChange={handleSearch}
          />
          <select value={selectedCategory} onChange={handleCategoryChange}>
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
                src={`/images/products/${product.slug}.png`}
                alt={product.name}
                width={300}
                height={300}
                loading="lazy"
                sizes="(max-width: 768px) 100vw, 25vw"
              />
              <h3>{product.name}</h3>
              <p>${product.price.toFixed(2)}</p>
              <p>Added: {formatRelativeTime(product.createdAt)}</p>
              <button onClick={() => addToCart(product)}>
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
                src={`/images/avatars/${product.reviewerAvatar}.jpg`}
                alt=""
                width={48}
                height={48}
                loading="lazy"
              />
              <p>{product.reviewText}</p>
              <p>Reviewed: {formatDate(product.reviewDate)}</p>
            </div>
          ))}
        </section>

        <section style={{ marginTop: '40px' }}>
          <h2>Brand Partners</h2>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <Image
                key={i}
                src={`/images/brands/brand-${i}.png`}
                alt={`Brand ${i}`}
                width={120}
                height={60}
                loading="lazy"
              />
            ))}
          </div>
        </section>
      </main>

      {isModalOpen && <Modal onClose={() => setModalOpen(false)} />}
      <Footer />

      <div className="footer-images">
        <Image
          src="/images/footer-cta.png"
          alt="Call to action"
          width={1200}
          height={400}
          loading="lazy"
          sizes="100vw"
        />
      </div>
    </>
  );
}
```

**Issues fixed:**

1. **Removed `moment` and `lodash`** -- replaced with native JS. Eliminates ~300KB+ of bundle weight. `moment` replaced with `Intl`/`Date` helpers; `lodash` replaced with native `Array` methods, `Set`, and `Array.prototype.sort`.

2. **`getServerSideProps` changed to `getStaticProps` with `revalidate: 60`** -- ISR avoids blocking server renders on every request; products are revalidated every 60s.

3. **Removed unused `PRODUCTS_CACHE` Map** -- dead code, never read.

4. **All `<img>` tags replaced with `next/image` `<Image>`** -- automatic WebP/AVIF, responsive `srcset`, lazy loading by default, LCP optimization with `priority` on the hero.

5. **Font `display=block` changed to `display=swap`** -- prevents invisible text during font load (FOIT), improves FCP.

6. **Third-party scripts marked `async defer`** -- unblocks parsing, fixes render-blocking resources.

7. **Removed scroll listener that called `setScrollY` on every scroll event** -- caused a full re-render every frame on scroll. The `scrollY` state was never used in the JSX anyway.

8. **Removed the CSS `float` animation on the promo banner** -- continuous animation triggers compositing/paint every frame, wastes GPU for no UX value.

9. **Removed the live-updating `formattedDate` in the hero** -- re-rendering the timestamp every second via `moment().format()` on every render is wasteful and not useful to the user.

10. **Memoized expensive computations** -- `categories`, `sortedProducts`, `totalValue` wrapped in `useMemo`; event handlers stabilized with `useCallback` to avoid re-creating closures on every render.

11. **`addToCart` uses functional `setCart` updater** -- avoids stale closure over `cart` state.

12. **Modal dynamically imported** (`next/dynamic`, `ssr: false`) -- splits modal code out of the main bundle since it is conditionally rendered.

13. **Added `sizes` attributes** to `<Image>` for correct responsive image selection, avoiding oversized downloads.