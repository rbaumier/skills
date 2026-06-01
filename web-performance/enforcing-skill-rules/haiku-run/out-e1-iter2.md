```tsx
import React from 'react';
import Head from 'next/head';
import { formatDistanceToNow, format } from 'date-fns';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Sidebar from '@/components/Sidebar';
import Card from '@/components/Card';
import Badge from '@/components/Badge';
import Modal from '@/components/Modal';
import Tooltip from '@/components/Tooltip';
import Accordion from '@/components/Accordion';
import Tabs from '@/components/Tabs';
import Breadcrumb from '@/components/Breadcrumb';

// No cache needed — getServerSideProps handles revalidation

async function fetchProducts() {
  const res = await fetch('/api/products', {
    headers: { 'Cache-Control': 'private, max-age=0, must-revalidate' }
  });
  return res.json();
}

export async function getServerSideProps() {
  const products = await fetchProducts();
  return {
    props: { products },
    revalidate: 60 // ISR: revalidate every 60s
  };
}

export default function StorePage({ products }: { products: any[] }) {
  const [cart, setCart] = React.useState([]);
  const [isModalOpen, setModalOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState('all');

  // Load cart from localStorage once on mount
  React.useEffect(() => {
    const saved = localStorage.getItem('cart');
    if (saved) {
      try {
        setCart(JSON.parse(saved));
      } catch {
        // Silently ignore parse errors
      }
    }
  }, []);

  // Replace lodash with native methods
  const categories = Array.from(new Set(products.map((p: any) => p.category)));
  
  const filtered = products.filter((p: any) => {
    const matchesQuery = p.name.toLowerCase().includes(query.toLowerCase());
    const matchesCat = selectedCategory === 'all' || p.category === selectedCategory;
    return matchesQuery && matchesCat;
  });
  
  const sortedProducts = filtered.sort((a: any, b: any) => a.price - b.price);
  const totalValue = sortedProducts.reduce((sum: number, p: any) => sum + p.price, 0);
  const formattedDate = format(new Date(), 'MMMM do yyyy, h:mm:ss a');

  return (
    <>
      <Head>
        <title>Our Store</title>
        <link
          rel="preload"
          as="font"
          type="font/woff2"
          href="/fonts/inter-400.woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          as="font"
          type="font/woff2"
          href="/fonts/inter-700.woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          as="image"
          href="https://cdn.example.com/images/hero-banner.webp"
          fetchPriority="high"
        />
        <script src="https://cdn.analytics.com/tracker.js" async defer></script>
        <script src="https://cdn.chat-widget.com/widget.js" async defer></script>
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
          .product-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; contain: layout; }
          .product-card { border: 1px solid #eee; padding: 16px; border-radius: 8px; }
          .product-card img { width: 100%; height: auto; aspect-ratio: 1; }
          .hero { position: relative; height: 600px; overflow: hidden; }
          .hero img { width: 100%; height: 100%; object-fit: cover; }
          .sidebar { width: 250px; }
          .promo-banner { background: #f00; color: #fff; padding: 10px; text-align: center; }
          .footer-images { contain: layout; }
          .footer-images img { width: 100%; height: auto; aspect-ratio: auto; }
          .brand-partners { display: flex; gap: 20px; flex-wrap: wrap; contain: layout; }
          .brand-partners img { width: 120px; height: 80px; object-fit: contain; }
          @keyframes float { 0% { transform: translateY(0); } 50% { transform: translateY(-10px); } 100% { transform: translateY(0); } }
          @media (prefers-reduced-motion: reduce) {
            .floating { animation: none; }
            html { scroll-behavior: auto; }
          }
          .floating { animation: float 3s ease-in-out infinite; }
        `}</style>
      </Head>

      <Header />
      <Sidebar />

      <div className="promo-banner floating">
        <p>Free shipping on all orders — today only — don't miss out — limited time — order now!</p>
      </div>

      <section className="hero">
        <img
          src="https://cdn.example.com/images/hero-banner.webp"
          alt="Store hero"
          width={1200}
          height={600}
          fetchPriority="high"
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
              <img
                src={`https://cdn.example.com/images/products/${product.slug}.webp`}
                alt={product.name}
                width={300}
                height={300}
                loading="lazy"
              />
              <h3>{product.name}</h3>
              <p>${product.price.toFixed(2)}</p>
              <p>Added: {formatDistanceToNow(new Date(product.createdAt), { addSuffix: true })}</p>
              <button onClick={() => {
                const newCart = [...cart, product];
                setCart(newCart);
                localStorage.setItem('cart', JSON.stringify(newCart));
              }}>
                Add to Cart
              </button>
            </div>
          ))}
        </div>

        <section style={{ marginTop: '40px' }}>
          <h2>Customer Reviews</h2>
          {products.slice(0, 20).map((product: any) => (
            <div key={`review-${product.id}`}>
              <img
                src={`https://cdn.example.com/images/avatars/${product.reviewerAvatar}.webp`}
                alt={`Review by ${product.reviewerName || 'customer'}`}
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
          <div className="brand-partners">
            {Array.from({ length: 12 }).map((_, i) => (
              <img
                key={i}
                src={`https://cdn.example.com/images/brands/brand-${i}.webp`}
                alt={`Brand ${i}`}
                width={120}
                height={80}
                loading="lazy"
              />
            ))}
          </div>
        </section>
      </main>

      {isModalOpen && <Modal onClose={() => setModalOpen(false)} />}
      <Footer />

      <div className="footer-images">
        <img
          src="https://cdn.example.com/images/footer-cta.webp"
          alt="Call to action"
          width={1200}
          height={300}
          loading="lazy"
        />
      </div>
    </>
  );
}
```

## Cache Headers Configuration (next.config.js)

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
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
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      }
    ];
  }
};

module.exports = nextConfig;
```
