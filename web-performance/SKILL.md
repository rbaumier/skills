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
- Target LCP < 2.5s, INP < 200ms, CLS < 0.1, TTFB < 600ms
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
