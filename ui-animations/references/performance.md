# Performance Optimization

Best practices for 60fps animations in React.

## Table of Contents
1. [Core Principles](#core-principles)
2. [GPU Acceleration](#gpu-acceleration)
3. [will-change Explained](#will-change-explained)
4. [Gradient Animation Performance](#gradient-animation-performance)
5. [Animation Performance Budget](#animation-performance-budget)
6. [ScrollTrigger Optimization](#scrolltrigger-optimization)
7. [Memory Management](#memory-management)
8. [Lazy Loading](#lazy-loading)
9. [Monitoring & Debugging](#monitoring--debugging)
10. [Mobile Optimization](#mobile-optimization)

## Core Principles

### The Golden Rules

1. **Only animate `transform` and `opacity`** - These are GPU-accelerated
2. **Avoid animating layout properties** - `width`, `height`, `top`, `left`, `margin`, `padding` trigger reflow
3. **Use `will-change` sparingly** - Apply before animation, remove after
4. **Batch DOM reads/writes** - Avoid forced synchronous layouts
5. **Kill unused animations** - Clean up ScrollTriggers on unmount

### What Triggers What

| Property | Paint | Layout | Composite |
|----------|-------|--------|-----------|
| `transform` | No | No | Yes |
| `opacity` | No | No | Yes |
| `filter` | Yes | No | Yes |
| `width/height` | Yes | Yes | Yes |
| `top/left` | Yes | Yes | Yes |
| `background-color` | Yes | No | Yes |

### Properties to Avoid Animating

These trigger layout recalculation (expensive):
- `width`, `height`
- `top`, `left`, `right`, `bottom`
- `margin`, `padding`
- `font-size`

**Always prefer**:
- `transform: translate()` instead of `top`/`left`
- `transform: scale()` instead of `width`/`height`
- `opacity` for visibility changes

## GPU Acceleration

### Force GPU Layer

```tsx
// Good: Use transform for positioning
gsap.to(element, { x: 100, y: 50 })

// Bad: Avoid top/left
gsap.to(element, { top: 100, left: 50 })
```

### CSS for GPU Promotion

```css
/* Force GPU layer for frequently animated elements */
.gpu-accelerated {
  transform: translateZ(0);
  backface-visibility: hidden;
}

/* Or use will-change strategically */
.about-to-animate {
  will-change: transform, opacity;
}
```

## will-change Explained

A hint to the browser: "I'm about to animate these properties, please prepare."

```css
/* Good - specific properties that will animate */
.animated-button {
  will-change: transform, opacity;
}

/* Bad - too broad, wastes resources */
* { will-change: auto; }
.element { will-change: all; }
```

**Properties that benefit from will-change**:
- transform
- opacity
- filter (blur, brightness)
- clip-path
- mask

**Why it matters**: Without the hint, the browser promotes elements to GPU layers only when animation starts, causing first-frame stutter. With `will-change`, it pre-promotes during idle time.

**When NOT to use**:
- On elements that won't animate
- On too many elements (each GPU layer uses memory)
- As a "fix" for janky animations (find the real cause)

### Programmatic will-change

```tsx
function AnimatedElement() {
  const ref = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    // Set will-change before animation
    gsap.set(ref.current, { willChange: 'transform' })

    gsap.to(ref.current, {
      x: 100,
      duration: 1,
      onComplete: () => {
        // Remove after animation
        gsap.set(ref.current, { willChange: 'auto' })
      }
    })
  })

  return <div ref={ref}>Animated</div>
}
```

## Gradient Animation Performance

**Cheap to animate (GPU-accelerated)**:
- background-position
- background-size
- opacity

**Expensive to animate**:
- Color stops
- Adding/removing gradient layers
- Switching gradient types

**Tip**: Animate a pseudo-element overlay or use CSS variables that transition indirectly.

## Animation Performance Budget

As a rough guide:
- **0-3 elements** with `will-change`: Fine
- **4-10 elements**: Careful, test on low-end devices
- **10+ elements**: Reconsider approach, use virtualization or stagger

## ScrollTrigger Optimization

### Global Configuration

```tsx
// Configure once in your app
ScrollTrigger.config({
  limitCallbacks: true,        // Limit callback frequency
  ignoreMobileResize: true,    // Ignore mobile address bar resize
})

// Normalize scroll behavior
ScrollTrigger.normalizeScroll(true)
```

### Batch Similar Animations

```tsx
// Bad: Individual ScrollTriggers
items.forEach(item => {
  gsap.from(item, {
    opacity: 0,
    scrollTrigger: { trigger: item }
  })
})

// Good: Batch them
ScrollTrigger.batch('.batch-item', {
  onEnter: (elements) => {
    gsap.from(elements, { opacity: 0, stagger: 0.1 })
  }
})
```

### Lazy ScrollTrigger Creation

```tsx
function LazySection({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [isNearViewport, setIsNearViewport] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsNearViewport(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' } // Start 200px before visible
    )

    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  useGSAP(() => {
    if (!isNearViewport) return

    // Create ScrollTrigger only when near viewport
    gsap.from('.lazy-item', {
      opacity: 0,
      y: 50,
      scrollTrigger: {
        trigger: ref.current,
        start: 'top 80%',
      }
    })
  }, { dependencies: [isNearViewport], scope: ref })

  return <div ref={ref}>{children}</div>
}
```

### Reduce Marker Overhead

```tsx
// Always disable markers in production
const isDev = process.env.NODE_ENV === 'development'

gsap.to('.element', {
  scrollTrigger: {
    markers: isDev,  // Only in development
  }
})
```

## Memory Management

### Cleanup ScrollTriggers

```tsx
// useGSAP handles this automatically, but for manual cases:
useEffect(() => {
  const st = ScrollTrigger.create({
    trigger: '.element',
    onEnter: () => console.log('enter')
  })

  return () => st.kill()  // Important!
}, [])
```

### Kill All on Route Change

```tsx
// In your layout or a global component
'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

export function ScrollTriggerCleanup() {
  const pathname = usePathname()

  useEffect(() => {
    return () => {
      // Kill all ScrollTriggers on route change
      ScrollTrigger.getAll().forEach(st => st.kill())
    }
  }, [pathname])

  return null
}
```

### SplitText Cleanup

```tsx
function AnimatedText({ text }: { text: string }) {
  const textRef = useRef<HTMLParagraphElement>(null)
  const splitRef = useRef<SplitText | null>(null)

  useGSAP(() => {
    splitRef.current = new SplitText(textRef.current, { type: 'chars' })

    gsap.from(splitRef.current.chars, { opacity: 0, stagger: 0.02 })

    // Cleanup split on unmount
    return () => splitRef.current?.revert()
  })

  return <p ref={textRef}>{text}</p>
}
```

### Motion Cleanup

```tsx
// Motion handles most cleanup automatically
// But for manual animations:

function MotionComponent() {
  useEffect(() => {
    const controls = animate('.element', { x: 100 })

    return () => controls.stop()
  }, [])
}
```

## Lazy Loading

### Images with Reveal

```tsx
function LazyImage({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    if (!loaded) return

    gsap.from(containerRef.current, {
      clipPath: 'inset(100% 0% 0% 0%)',
      duration: 1.2,
      ease: 'power4.inOut',
    })

    gsap.from(imgRef.current, {
      scale: 1.3,
      duration: 1.5,
      ease: 'power2.out',
    })
  }, { dependencies: [loaded] })

  return (
    <div ref={containerRef} className="overflow-hidden">
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        className={loaded ? 'opacity-100' : 'opacity-0'}
      />
    </div>
  )
}
```

### Code Splitting Animations

```tsx
// Dynamically import heavy animation libraries
const ThreeScene = dynamic(
  () => import('@/components/ThreeScene'),
  {
    loading: () => <div>Loading 3D...</div>,
    ssr: false
  }
)
```

## Monitoring & Debugging

### Chrome DevTools Performance Tab

1. Open DevTools (F12)
2. Go to Performance tab
3. Click record, scroll, stop
4. Look for:
   - Long frames (red bars)
   - Layout thrashing
   - Excessive paint areas

### GSAP DevTools

```tsx
// Install GSAP DevTools (Club GSAP)
import { GSDevTools } from 'gsap/GSDevTools'
gsap.registerPlugin(GSDevTools)

// Add to your dev environment
if (process.env.NODE_ENV === 'development') {
  GSDevTools.create({ animation: masterTimeline })
}
```

### Performance Markers

```tsx
function measureAnimation() {
  performance.mark('animation-start')

  gsap.to('.element', {
    x: 100,
    onComplete: () => {
      performance.mark('animation-end')
      performance.measure('animation', 'animation-start', 'animation-end')
      console.log(performance.getEntriesByName('animation'))
    }
  })
}
```

### FPS Monitor

```tsx
'use client'

import { useEffect, useState } from 'react'

export function FPSMonitor() {
  const [fps, setFps] = useState(0)

  useEffect(() => {
    let frameCount = 0
    let lastTime = performance.now()

    const loop = () => {
      frameCount++
      const now = performance.now()

      if (now - lastTime >= 1000) {
        setFps(frameCount)
        frameCount = 0
        lastTime = now
      }

      requestAnimationFrame(loop)
    }

    const id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div className="fixed top-4 right-4 bg-black text-white p-2 z-50">
      {fps} FPS
    </div>
  )
}
```

## Mobile Optimization

### Detect Low-End Devices

```tsx
function useIsLowEndDevice() {
  const [isLowEnd, setIsLowEnd] = useState(false)

  useEffect(() => {
    // Check for low-end indicators
    const memory = (navigator as any).deviceMemory
    const cores = navigator.hardwareConcurrency

    if (memory && memory < 4) setIsLowEnd(true)
    if (cores && cores < 4) setIsLowEnd(true)

    // Check for battery saver
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        if (battery.charging === false && battery.level < 0.2) {
          setIsLowEnd(true)
        }
      })
    }
  }, [])

  return isLowEnd
}
```

### Reduce Motion for Low-End

```tsx
function OptimizedAnimation() {
  const isLowEnd = useIsLowEndDevice()
  const prefersReducedMotion = useReducedMotion()

  const shouldSimplify = isLowEnd || prefersReducedMotion

  useGSAP(() => {
    if (shouldSimplify) {
      // Simple fade
      gsap.from('.element', { opacity: 0, duration: 0.3 })
    } else {
      // Full animation
      gsap.from('.element', {
        opacity: 0,
        y: 50,
        rotation: 10,
        duration: 0.8,
        ease: 'back.out(1.7)'
      })
    }
  }, [shouldSimplify])
}
```

### Touch-Friendly Timing

```tsx
// Faster animations on mobile (no hover states)
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

const duration = isMobile ? 0.3 : 0.5
const stagger = isMobile ? 0.05 : 0.1
```

### Disable Smooth Scroll on Low-End

```tsx
function SmartSmoothScroll({ children }: { children: React.ReactNode }) {
  const isLowEnd = useIsLowEndDevice()

  if (isLowEnd) {
    // Skip Lenis on low-end devices
    return <>{children}</>
  }

  return (
    <ReactLenis root options={{ lerp: 0.1 }}>
      {children}
    </ReactLenis>
  )
}
```

## Performance Checklist

- [ ] Only animating transform/opacity
- [ ] `will-change` used sparingly and specifically
- [ ] Animations use transform/opacity (not layout properties)
- [ ] ScrollTriggers cleaned up on unmount
- [ ] Batch animations where possible
- [ ] Lazy load heavy components
- [ ] Test on real mobile devices
- [ ] Check for memory leaks
- [ ] Remove markers in production
- [ ] Respect prefers-reduced-motion
- [ ] Test on low-end devices
- [ ] No continuous animations without purpose
- [ ] GPU layer count is reasonable (< 10 animated elements)
