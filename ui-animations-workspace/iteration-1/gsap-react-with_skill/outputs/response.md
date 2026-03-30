# Response: GSAP + ScrollTrigger in Next.js App Router

## Step 1: Install

```bash
npm install gsap @gsap/react
```

## Step 2: App-Wide GSAP Config

Create a centralized GSAP setup file:

```tsx
// lib/gsap.ts
'use client'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger, useGSAP)
export { gsap, ScrollTrigger, useGSAP }
```

## Step 3: Scroll-Triggered Animation Component

```tsx
'use client'
import { useRef } from 'react'
import { gsap, ScrollTrigger, useGSAP } from '@/lib/gsap'

export function ScrollRevealBox({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    gsap.from('.reveal-box', {
      opacity: 0,
      y: 80,
      duration: 0.8,
      ease: 'power4.out',
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top 80%',
      },
    })
  }, { scope: containerRef }) // scope limits GSAP selectors to this container

  return (
    <div ref={containerRef}>
      <div className="reveal-box">{children}</div>
    </div>
  )
}
```

## Step 4: Event Handlers with contextSafe

If you need click-triggered GSAP animations alongside scroll animations, use `contextSafe()`:

```tsx
'use client'
import { useRef } from 'react'
import { gsap, useGSAP } from '@/lib/gsap'

export function ClickToAnimate() {
  const containerRef = useRef<HTMLDivElement>(null)

  const { contextSafe } = useGSAP(() => {
    // Initial animation on mount
    gsap.from('.box', { opacity: 0, y: 20, duration: 0.5 })
  }, { scope: containerRef })

  // contextSafe ensures proper cleanup and scope
  const handleClick = contextSafe(() => {
    gsap.to('.box', { rotation: '+=360', duration: 0.6, ease: 'power2.inOut' })
  })

  return (
    <div ref={containerRef}>
      <div className="box cursor-pointer" onClick={handleClick}>
        Click me to spin
      </div>
    </div>
  )
}
```

## Common Pitfalls

1. **Missing `'use client'`** -- GSAP uses browser APIs. Every component using GSAP in App Router needs this directive.
2. **Using `useEffect` instead of `useGSAP`** -- `useGSAP` handles cleanup automatically, prevents React 18 Strict Mode double-execution issues, and scopes selectors.
3. **Missing `scope`** -- Without `scope`, GSAP selectors like `'.box'` match globally, causing bugs in multi-instance components.
4. **Missing `contextSafe()`** -- Event handlers that trigger GSAP animations outside the initial `useGSAP` callback need `contextSafe()` to ensure proper scoping and cleanup.
5. **Forgetting `gsap.registerPlugin(ScrollTrigger)`** -- ScrollTrigger won't work without registration, and tree-shaking may remove it.
6. **Not calling `ScrollTrigger.refresh()`** after dynamic content loads.
