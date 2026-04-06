---
name: web-performance
description: "Core Web Vitals, bundle/image optimization, caching, profiling. Trigger on 'performance', 'LCP', 'CLS', 'bundle size', 'lighthouse'."
---

## When to use
- Optimizing Core Web Vitals, Lighthouse scores, or TTI
- Reducing JS bundle size or improving load times
- Profiling CPU, memory, I/O, or network bottlenecks
- Designing load tests, capacity plans, scalability strategies
- Setting up APM, RUM, SLI/SLO, observability
- Implementing caching (browser, CDN, app, DB)
- Debugging perf regressions or slow endpoints

## When not to use
- Feature dev with no performance goals
- No access to metrics, tracing, or profiling data
- Small localized fix with no broader perf context

## Rules
- Always measure baseline before optimizing
- Profile first, never guess at bottlenecks
- Fix biggest bottleneck first, not micro-optimizations
- Validate improvement with before/after metrics
- Target LCP < 2.5s, INP < 200ms, CLS < 0.1, TTFB < 600ms, FCP < 1.8s, TBT < 200ms
- JS bundle target < 200KB gzipped total
- Images < 200KB each, use WebP/AVIF formats
- Always set width/height on images to prevent CLS
- Lazy load below-fold images with loading="lazy"
- Eager load hero image with fetchpriority="high"
- Preload critical images via link rel="preload"
- Use responsive images with picture and srcset
- Code split by route, lazy load non-critical components
- Tree shake unused exports, sideEffects: false
- Replace heavy libs (moment->date-fns, lodash->specific imports)
- Defer third-party scripts, use async/defer on all scripts
- Inline critical CSS, defer non-critical, purge unused
- Use CSS containment for layout isolation
- Preconnect to critical origins, prefetch next-page resources
- Enable HTTP/2+, Brotli compression
- Cache immutable static assets 1yr with hashed filenames
- Dynamic HTML: Cache-Control public, max-age=0, must-revalidate
- API responses: Cache-Control private with short TTL
- Layer caching: browser, CDN, Redis/Memcached, DB query cache
- Use ETags and conditional requests for API caching
- Optimize DB queries, add indexes, use connection pooling
- Use read replicas, pagination, bulk ops for DB scaling
- Background heavy work via queues and async jobs
- Use circuit breakers and bulkheads in microservices
- P95 API latency < 1s, DB queries < 100ms P95
- CPU target < 70%, memory < 80% utilization
- Use OpenTelemetry for distributed tracing
- Set up RUM for real-user Core Web Vitals tracking
- Define SLI/SLOs: P50 < 200ms, P95 < 1s, P99 < 2s
- Availability SLO > 99.9%, support 2x peak load
- Performance budgets in CI with automated pass/fail gates
- Load test with realistic scenarios from prod traffic patterns
- Test normal, peak, and stress scenarios
- Never load test production without approval and safeguards
- Roll out perf changes gradually with rollback plans
- Always test on real mobile devices + slow networks
- Use RUM data, not just lab/synthetic data
- Never load everything upfront; lazy load non-critical resources
- Remove unused dependencies regularly
- Deliver images via CDN
- Font optimization: `font-display: swap` on all @font-face, `size-adjust` to match fallback metrics and prevent CLS, preload primary font (`<link rel='preload' as='font' type='font/woff2' crossorigin>`), subset fonts to used characters (pyftsubset/glyphhanger), self-host over Google Fonts to eliminate extra DNS+connection
- Responsive images: use width descriptors (`w`) not pixel descriptors (`x`), `sizes` attribute MUST match CSS layout breakpoints, `<picture>` for art direction, AVIF (70% savings) > WebP (50%) > JPEG with fallbacks, `aspect-ratio` CSS property prevents CLS
- Ban em-dash overuse in UI copy: max 1 per paragraph, replace with commas/parentheses/periods
- PWA offline-first for repeat-visit performance: service worker with cache-first for static assets, network-first for API, stale-while-revalidate for semi-dynamic content. Repeat-visit LCP drops to near-zero for cached resources

## Optimization Workflow

Every performance fix follows this loop. Do not skip steps.

```
MEASURE  --> Establish baseline with real data (RUM + lab)
IDENTIFY --> Find the actual bottleneck (profile, don't guess)
FIX      --> Address the specific bottleneck, one change at a time
VERIFY   --> Measure again, confirm improvement with numbers
GUARD    --> Add CI budget, alert, or test to prevent regression
```

## Where to Start Measuring (Decision Tree)

Use the user-reported symptom to pick the right metric and tool. Do not measure everything at once.

```
What is slow?
│
├── First page load
│   ├── White screen for seconds?
│   │   └── Check LCP + FCP. Likely: render-blocking CSS/JS, slow TTFB, missing preload
│   ├── Content appears then shifts around?
│   │   └── Check CLS. Likely: images without dimensions, late-injected content, font swap
│   ├── Page loads but takes forever?
│   │   └── Check bundle size + network waterfall. Likely: no code splitting, too many requests
│   └── Server responds slowly?
│       └── Check TTFB. Likely: slow DB queries, missing server cache, cold start
│
├── Interaction feels sluggish
│   ├── Click/tap and nothing happens?
│   │   └── Check INP + TBT. Profile main thread for long tasks (>50ms)
│   ├── Typing in form feels laggy?
│   │   └── Check re-renders (React Profiler), controlled component overhead
│   ├── Scroll jank or animation stutter?
│   │   └── Check for layout thrashing, forced reflows, missing passive:true on listeners
│   └── UI freezes periodically?
│       └── Check for GC pauses, large DOM updates, synchronous storage reads
│
├── Navigation between pages
│   ├── Blank screen between routes?
│   │   └── Check code splitting + prefetch. Likely: no route-level lazy loading
│   ├── Data takes too long after navigation?
│   │   └── Measure API response times. Check for request waterfalls (sequential fetches)
│   └── Page renders then re-renders with data?
│       └── Check hydration time (SSR) or client fetch strategy. Consider prefetching
│
└── Backend / API
    ├── Single endpoint slow?
    │   └── Profile DB queries + check indexes. Look for N+1 patterns
    ├── All endpoints slow?
    │   └── Check connection pool exhaustion, memory/CPU pressure, event loop blocking
    └── Intermittent slowness?
        └── Check lock contention, GC pauses, external dependency timeouts, cold starts
```

**How to use this tree**: Start at the symptom. Follow one branch. Measure only the suggested metric. Fix the bottleneck. Return to the tree only if another symptom remains after fixing.

## 5-Phase Audit Workflow

### Phase 1: Performance Trace
- Capture baseline with Chrome DevTools Performance tab or Lighthouse CLI
- `npx lighthouse URL --only-categories=performance --output=json --output-path=./report.json`
- `npx lighthouse URL --preset=perf --throttling-method=simulate --output=html` for mobile simulation
- Key trace thresholds: main thread busy < 4s total, largest task < 250ms, script eval < 2s, layout/style recalc < 500ms. If any exceed these, that's your bottleneck

### Phase 2: Core Web Vitals Analysis
- Identify the LCP element (usually hero image or h1 text block). Preload it: `<link rel="preload" as="image" href="/hero.webp" fetchpriority="high">`
- CLS: every image/video MUST have explicit width/height or aspect-ratio. Reserve space for ads/embeds with min-height. Use font-display:swap with size-adjust to prevent FOUT shifts
- INP: break long tasks with `scheduler.yield()` or `requestIdleCallback`. Throttle scroll/resize handlers with `requestAnimationFrame` + passive:true

### Phase 3: Network Analysis
- Target < 100 requests, < 2MB total compressed
- All text resources MUST use Brotli (br) or gzip (check Content-Encoding header)
- Immutable assets (hashed filenames): `Cache-Control: public, max-age=31536000, immutable`
- HTML: `Cache-Control: no-cache`. API: `Cache-Control: private, max-age=0, must-revalidate`
- Verify HTTP/2+ in DevTools Network tab (Protocol column)
- Read the network waterfall: green bar = waiting (TTFB), blue bar = downloading. Look for sequential chains (resource B waits for A = critical path), idle gaps (nothing loading = missed preload), third-party scripts blocking first-party (defer them)

### Phase 4: Accessibility Performance
- Lazy-loaded images MUST keep alt attributes
- Skeleton loaders need `aria-busy="true"` and `aria-label`
- Respect `prefers-reduced-motion: reduce` — disable animations, not just slow them

### Phase 5: Codebase Analysis
- Check for barrel file imports (bloats bundles because tree-shaking can't eliminate re-exports with side effects)
- Verify code splitting by route. Non-critical components lazy loaded
- No synchronous localStorage/sessionStorage reads in render path (blocks main thread)
- Unthrottled scroll listeners without passive:true = INP killer
- Hydration performance (SSR/SSG): measure hydration time in DevTools (look for 'Hydrate' in flame chart). Use selective/partial hydration (React Server Components, Astro islands, Qwik resumability). Defer hydration of below-fold interactive components. Never hydrate static content. Target: hydration < 500ms on mobile
- Bundle analysis: run `npx webpack-bundle-analyzer stats.json` (webpack) or `npx vite-bundle-visualizer` (Vite). Look for duplicate dependencies, oversized chunks (>100KB), unnecessary polyfills, unused locale data. Set CI budget: fail build if any chunk exceeds threshold

## Audit Report Template

```markdown
# Performance Audit Report
**URL:** [target]  **Date:** [date]  **Tool:** Lighthouse vX / Chrome DevTools

## Core Web Vitals
| Metric | Score | Rating | Target |
|--------|-------|--------|--------|
| LCP | X.Xs | GOOD/NEEDS IMPROVEMENT/POOR | <= 2.5s |
| CLS | X.XX | ... | <= 0.1 |
| INP | Xms | ... | <= 200ms |
| FCP | X.Xs | ... | <= 1.8s |
| TTFB | Xms | ... | <= 800ms |
| TBT | Xms | ... | <= 200ms |

## P0 - Immediate (blocks user experience)
1. [Finding] - [Impact] - [Fix]

## P1 - This Sprint (measurable improvement)
1. [Finding] - [Impact] - [Fix]

## P2 - This Quarter (incremental gains)
1. [Finding] - [Impact] - [Fix]
```
