# Response: Animation Libraries for Smooth Scroll + Scroll Animations

## Decision

| Need | Library | Why |
|------|---------|-----|
| Smooth scroll | **Lenis + ReactLenis** | Best performance, silky smooth, works with ScrollTrigger |
| Scroll-driven animations | **GSAP + ScrollTrigger + useGSAP** | Industry standard, best control for scrub/pin/parallax |
| Simple hover effects | CSS transitions or **Motion** (Framer Motion) | Lightweight for simple interactions |

## Installation

```bash
npm install gsap @gsap/react lenis
```

## Critical: Lenis + GSAP ScrollTrigger Integration

These libraries **must** be integrated or they'll conflict. Lenis takes over scroll, so ScrollTrigger needs to read Lenis's scroll position:

```tsx
// components/SmoothScroll.tsx
'use client'
import { ReactLenis, useLenis } from 'lenis/react'
import { useEffect } from 'react'
import { gsap, ScrollTrigger } from '@/lib/gsap'

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const lenis = useLenis()

  useEffect(() => {
    if (!lenis) return
    lenis.on('scroll', ScrollTrigger.update)
    gsap.ticker.add((time) => lenis.raf(time * 1000))
    gsap.ticker.lagSmoothing(0)
    return () => { gsap.ticker.remove(lenis?.raf) }
  }, [lenis])

  return (
    <ReactLenis root options={{ lerp: 0.1, duration: 1.2, smoothWheel: true }}>
      {children}
    </ReactLenis>
  )
}
```

Without this integration, ScrollTrigger won't fire correctly because it's reading native scroll position while Lenis is controlling scroll via transforms.

## GSAP Setup

```tsx
// lib/gsap.ts
'use client'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
gsap.registerPlugin(ScrollTrigger, useGSAP)
export { gsap, ScrollTrigger, useGSAP }
```

## Hover Effects

For simple hover effects, plain CSS transitions are fine:

```css
.card {
  transition: transform 150ms cubic-bezier(0.87, 0, 0.13, 1);
}
.card:hover {
  transform: translateY(-2px);
}
```
