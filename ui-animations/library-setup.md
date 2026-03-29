# Animation Library Setup & Decision Matrix

## Decision Matrix

| Task | Library | Why |
|------|---------|-----|
| Scroll-driven animations | GSAP + ScrollTrigger + useGSAP | Industry standard, best control |
| Smooth scroll | Lenis + ReactLenis | Best performance, works with ScrollTrigger |
| React-native animations | Motion (Framer Motion) | Native React, useScroll/useTransform |
| Simple/lightweight effects | Anime.js 4.0 | Small footprint, clean API |
| Complex timelines | GSAP | Unmatched timeline control |
| SVG morphing | GSAP MorphSVG or Anime.js | Both excellent |
| 3D + animation | Three.js + GSAP | GSAP controls Three.js objects |
| Page transitions | AnimatePresence or GSAP | Motion for React, GSAP for complex |
| Geometric shapes (vector) | SVG + GSAP/Motion | Native, animable |
| Geometric shapes (canvas) | Canvas 2D API | Programmatic, performant |
| Pseudo-3D shapes | Zdog | Flat design 3D, ~2kb |
| Creative coding/generative | p5.js | Rich ecosystem |
| Audio reactive | Tone.js | Web Audio, synths, effects |
| Physics 2D | Matter.js | Gravity, collisions, constraints |
| Algorithmic/generative art | Canvas 2D + p5.js | Math-driven visuals |
| Fractals/L-systems | Canvas 2D recursive | Recursive rendering |
| Tessellations/geometric puzzles | SVG + GSAP | Precise animated transforms |
| Kinetic typography advanced | GSAP SplitText + Canvas | Per-char control |
| Glitch effects | CSS + GSAP | Layered RGB split, clip-path |
| Brutalist animation | CSS raw + Motion | Hard cuts, no easing |
| Minimalist animation | Motion springs | Subtle, purposeful motion |

## Installation (Latest Stable - 2025)

```bash
# GSAP + React hook (v3.14.1)
npm install gsap @gsap/react

# Lenis (v1.3.17) - includes React components
npm install lenis

# Motion (Framer Motion)
npm install motion

# Anime.js (v4.0.0)
npm install animejs
```

## React Setup

### GSAP Configuration (app-wide)

```tsx
// lib/gsap.ts
'use client'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
gsap.registerPlugin(ScrollTrigger, useGSAP)
export { gsap, ScrollTrigger, useGSAP }
```

### Lenis + GSAP ScrollTrigger Integration

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

## Common Pitfalls

1. Not integrating Lenis with ScrollTrigger
2. Missing `scope` in useGSAP
3. Not using `contextSafe()` for click handlers
4. React 18 Strict Mode calling effects twice
5. Forgetting `'use client'` in Next.js App Router
6. Not calling `ScrollTrigger.refresh()` after dynamic content
