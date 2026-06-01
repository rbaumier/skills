# Grade — web-performance eval 1, iter 1

Code: `out-e1-iter1.md` (Next.js StorePage). Graded strictly vs `assertions-e1.json`. PASS only if the violation is clearly corrected in the actual code (cited). FAIL on absence/doubt.

| # | id | verdict | evidence / reason |
|---|-----|---------|-------------------|
| 1 | replace-moment | PASS | `import { formatDistanceToNow } from 'date-fns'` (L6); no `moment`. |
| 2 | replace-lodash | PASS | No lodash import; native `filter/sort/reduce/Array.from` (L22-34, 76). |
| 3 | barrel-import | FAIL | Still barrel: `import { Header, Footer, Card } from '@/components'` (L7) and `import('@/components')` (L10,14). Not split into individual imports. |
| 4 | hero-image-format | PASS | `src="/images/hero-banner.webp"` (L135). |
| 5 | hero-image-dimensions | PASS | `<Image fill>` inside `.hero { height:600px }` (L116,137); space reserved. |
| 6 | hero-image-fetchpriority | PASS | `priority` (L138) + `fetchPriority="high"` on preload (L95). |
| 7 | hero-image-preload | PASS | `<link rel="preload" as="image" href="/images/hero-banner.webp">` (L95). |
| 8 | product-image-dimensions | PASS | `<Image width={300} height={225}>` (L175-176). |
| 9 | product-image-lazy | PASS | `loading={... > 8 ? 'lazy' : 'eager'}` (L178). |
| 10 | product-image-format | PASS | `src={`/images/products/${product.slug}.webp`}` (L173). |
| 11 | responsive-images | PASS | Hero `<Image sizes="(max-width:768px) 100vw, ... 1200px">` (L139); Next `<Image>` auto-emits srcset. |
| 12 | avatar-image-dimensions | FAIL | Avatars live in `<Reviews>` (L189), a `dynamic()` import; markup not in this file, dimensions unverifiable. |
| 13 | avatar-image-lazy | PASS | `Reviews` is `dynamic(() => import('@/sections/Reviews'), { ssr: false })` (L17); section deferred. |
| 14 | brand-image-dimensions | FAIL | `<BrandPartners>` markup not in file (L18,190); dimensions unverifiable. |
| 15 | brand-image-lazy | PASS | `BrandPartners` is `dynamic(... { ssr: false })` (L18); section deferred. |
| 16 | footer-image-dimensions | FAIL | `<FooterCTA>` markup not in file (L19,197); dimensions unverifiable. |
| 17 | footer-image-lazy | PASS | `FooterCTA` is `dynamic(... { ssr: false })` (L19); section deferred. |
| 18 | script-defer | PASS | `<script defer src=".../tracker.js">` and `.../widget.js` (L106-107). |
| 19 | font-display-swap | PASS | Google Fonts URL `&display=swap` (L104). |
| 20 | font-self-host | FAIL | Font still from `https://fonts.googleapis.com/css2...` (L104); not self-hosted. |
| 21 | font-preload | PASS | `<link rel="preload" as="font" href="/fonts/inter-400.woff2" type="font/woff2" crossOrigin>` (L97). |
| 22 | preconnect | PASS | `<link rel="preconnect" href="https://fonts.googleapis.com">` (L101). |
| 23 | scroll-listener-passive | PASS | Scroll listener removed entirely; no `addEventListener('scroll')` anywhere. |
| 24 | scroll-listener-throttle | PASS | Scroll listener removed; no unthrottled handler present. |
| 25 | scroll-listener-cleanup | PASS | Scroll listener removed; no leaking listener remains. |
| 26 | localstorage-render | PASS | `localStorage.getItem('cart')` moved into `useEffect(... , [])` (L58-67), off the render path. |
| 27 | code-split-components | PASS | `Sidebar`, `Modal` via `dynamic()` (L10,14). |
| 28 | inline-critical-css | PASS | Inline `<style>` trimmed to critical layout only; animations and footer styles removed (L108-121). |
| 29 | css-containment | FAIL | No `contain:` declaration on grid/sections anywhere in the CSS (L108-121). |
| 30 | reduced-motion | FAIL | No `@media (prefers-reduced-motion: reduce)` block; `scroll-behavior: smooth` (L109) is unguarded motion. Rule not satisfied. |
| 31 | emdash-overuse | PASS | Banner reworded with periods, zero em-dashes (L129). |
| 32 | image-cdn | FAIL | Images still served from local `/images/...` paths (L135,173); no CDN origin. |
| 33 | cache-headers-static | FAIL | No Cache-Control for static image/font assets; `revalidate:60` is ISR/HTML only (L47). |
| 34 | lazy-load-everything-upfront | PASS | Reviews, BrandPartners, FooterCTA all `dynamic(... ssr:false)` (L17-19). |

**Passed: 25 / 34. Failed: 9.**
