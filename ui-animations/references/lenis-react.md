# Lenis React Integration

Complete Lenis smooth scroll integration for React/Next.js with GSAP ScrollTrigger.

## Table of Contents
1. [Installation](#installation)
2. [Basic Setup](#basic-setup)
3. [GSAP Integration](#gsap-integration)
4. [useLenis Hook](#uselenis-hook)
5. [Configuration Options](#configuration-options)
6. [Common Patterns](#common-patterns)
7. [Troubleshooting](#troubleshooting)

## Installation

```bash
npm install lenis
# Package includes React components at lenis/react
```

## Basic Setup

### Provider Component

```tsx
// components/SmoothScroll.tsx
'use client'

import { ReactLenis } from 'lenis/react'

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  return (
    <ReactLenis root options={{ lerp: 0.1, duration: 1.2 }}>
      {children}
    </ReactLenis>
  )
}
```

### Layout Integration

```tsx
// app/layout.tsx
import { SmoothScroll } from '@/components/SmoothScroll'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  )
}
```

### Required CSS

```css
/* globals.css */
html.lenis, html.lenis body {
  height: auto;
}

.lenis.lenis-smooth {
  scroll-behavior: auto !important;
}

.lenis.lenis-smooth [data-lenis-prevent] {
  overscroll-behavior: contain;
}

.lenis.lenis-stopped {
  overflow: hidden;
}

.lenis.lenis-scrolling iframe {
  pointer-events: none;
}
```

## GSAP Integration

### Full Integration (Recommended)

```tsx
// components/SmoothScroll.tsx
'use client'

import { ReactLenis, useLenis } from 'lenis/react'
import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

function LenisGSAPConnector() {
  const lenis = useLenis()

  useEffect(() => {
    if (!lenis) return

    // Connect Lenis scroll to ScrollTrigger
    lenis.on('scroll', ScrollTrigger.update)

    // Use GSAP ticker for RAF
    const update = (time: number) => {
      lenis.raf(time * 1000)
    }

    gsap.ticker.add(update)
    gsap.ticker.lagSmoothing(0)

    return () => {
      gsap.ticker.remove(update)
      lenis.off('scroll', ScrollTrigger.update)
    }
  }, [lenis])

  return null
}

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  return (
    <ReactLenis
      root
      options={{
        lerp: 0.1,
        duration: 1.2,
        smoothWheel: true,
        wheelMultiplier: 1,
        touchMultiplier: 2,
        syncTouch: false,
      }}
    >
      <LenisGSAPConnector />
      {children}
    </ReactLenis>
  )
}
```

### Alternative: Ref-based Integration

```tsx
'use client'

import { ReactLenis, type LenisRef } from 'lenis/react'
import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<LenisRef>(null)

  useEffect(() => {
    const lenis = lenisRef.current?.lenis
    if (!lenis) return

    lenis.on('scroll', ScrollTrigger.update)

    const update = (time: number) => {
      lenis.raf(time * 1000)
    }

    gsap.ticker.add(update)
    gsap.ticker.lagSmoothing(0)

    return () => {
      gsap.ticker.remove(update)
    }
  }, [])

  return (
    <ReactLenis ref={lenisRef} root options={{ lerp: 0.1 }}>
      {children}
    </ReactLenis>
  )
}
```

## useLenis Hook

### Basic Usage

```tsx
'use client'

import { useLenis } from 'lenis/react'

function ScrollProgress() {
  const [progress, setProgress] = useState(0)

  useLenis(({ scroll, limit, velocity, direction }) => {
    setProgress(scroll / limit)
    console.log({ scroll, limit, velocity, direction })
  })

  return (
    <div
      className="fixed top-0 left-0 h-1 bg-blue-500 z-50"
      style={{ width: `${progress * 100}%` }}
    />
  )
}
```

### Scroll to Element

```tsx
'use client'

import { useLenis } from 'lenis/react'

function ScrollToSection() {
  const lenis = useLenis()

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element && lenis) {
      lenis.scrollTo(element, {
        offset: -100,        // Offset from top
        duration: 1.5,       // Animation duration
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      })
    }
  }

  return (
    <nav>
      <button onClick={() => scrollToSection('about')}>About</button>
      <button onClick={() => scrollToSection('work')}>Work</button>
      <button onClick={() => scrollToSection('contact')}>Contact</button>
    </nav>
  )
}
```

### Stop/Start Scroll

```tsx
'use client'

import { useLenis } from 'lenis/react'

function Modal({ isOpen, onClose, children }) {
  const lenis = useLenis()

  useEffect(() => {
    if (isOpen) {
      lenis?.stop()
    } else {
      lenis?.start()
    }
  }, [isOpen, lenis])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50">
      {children}
    </div>
  )
}
```

### Velocity-Based Effects

```tsx
'use client'

import { useLenis } from 'lenis/react'
import { useRef } from 'react'
import gsap from 'gsap'

function VelocitySkew() {
  const textRef = useRef<HTMLHeadingElement>(null)

  useLenis(({ velocity }) => {
    gsap.to(textRef.current, {
      skewY: velocity * 0.05,
      duration: 0.3,
      ease: 'power2.out',
    })
  })

  return <h1 ref={textRef}>Velocity Skew Text</h1>
}
```

## Configuration Options

### Full Options Reference

```tsx
<ReactLenis
  root
  options={{
    // Smoothing
    lerp: 0.1,              // Linear interpolation (0-1), lower = smoother
    duration: 1.2,          // Animation duration in seconds

    // Wheel
    smoothWheel: true,      // Smooth wheel scrolling
    wheelMultiplier: 1,     // Wheel sensitivity

    // Touch
    touchMultiplier: 2,     // Touch sensitivity
    syncTouch: false,       // Sync touch with lerp (experimental)
    syncTouchLerp: 0.075,   // Lerp for sync touch

    // Direction
    orientation: 'vertical', // 'vertical' | 'horizontal'
    gestureOrientation: 'vertical',

    // Behavior
    infinite: false,        // Infinite scroll
    autoRaf: false,         // Use built-in RAF (false when using GSAP ticker)

    // Content
    wrapper: window,        // Scroll wrapper element
    content: document.documentElement,

    // Events
    eventsTarget: window,   // Event listener target

    // Misc
    prevent: undefined,     // Function to prevent scroll on certain elements
    virtualScroll: undefined, // Custom virtual scroll handler
  }}
>
  {children}
</ReactLenis>
```

### Common Presets

```tsx
// Premium feel (Studio Freight style)
const premiumOptions = {
  lerp: 0.075,
  duration: 1.5,
  smoothWheel: true,
  wheelMultiplier: 0.8,
}

// Snappy feel
const snappyOptions = {
  lerp: 0.15,
  duration: 0.8,
  smoothWheel: true,
  wheelMultiplier: 1.2,
}

// Mobile-friendly
const mobileOptions = {
  lerp: 0.1,
  duration: 1.2,
  touchMultiplier: 1.5,
  syncTouch: true,
  syncTouchLerp: 0.075,
}
```

## Common Patterns

### Prevent Scroll on Specific Elements

```tsx
// Add data-lenis-prevent to prevent smooth scroll
<div data-lenis-prevent>
  <textarea>Scrollable text area</textarea>
</div>

// Or data-lenis-prevent-wheel for wheel only
<div data-lenis-prevent-wheel>
  <div className="horizontal-scroll">...</div>
</div>
```

### Anchor Links

```tsx
'use client'

import { useLenis } from 'lenis/react'
import { useEffect } from 'react'

function AnchorHandler() {
  const lenis = useLenis()

  useEffect(() => {
    // Handle anchor links
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLAnchorElement
      if (target.hash) {
        e.preventDefault()
        const element = document.querySelector(target.hash)
        if (element) {
          lenis?.scrollTo(element as HTMLElement, { offset: -100 })
        }
      }
    }

    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [lenis])

  return null
}
```

### Scroll Direction Detection

```tsx
'use client'

import { useLenis } from 'lenis/react'
import { useState } from 'react'

function DirectionAwareHeader() {
  const [isVisible, setIsVisible] = useState(true)

  useLenis(({ direction }) => {
    setIsVisible(direction <= 0) // Show on scroll up
  })

  return (
    <header
      className={`fixed top-0 transition-transform duration-300 ${
        isVisible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      Header
    </header>
  )
}
```

### Horizontal Scroll Section with Lenis

```tsx
'use client'

import { useLenis } from 'lenis/react'
import { useRef, useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger)

function HorizontalSection() {
  const containerRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    const sections = gsap.utils.toArray<HTMLElement>('.h-section')

    gsap.to(sections, {
      xPercent: -100 * (sections.length - 1),
      ease: 'none',
      scrollTrigger: {
        trigger: wrapperRef.current,
        pin: true,
        scrub: 1,
        snap: 1 / (sections.length - 1),
        end: () => '+=' + wrapperRef.current!.scrollWidth,
      }
    })
  }, { scope: containerRef })

  return (
    <div ref={containerRef}>
      <div ref={wrapperRef} className="flex" data-lenis-prevent-wheel>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-section w-screen h-screen flex-shrink-0">
            Section {i}
          </div>
        ))}
      </div>
    </div>
  )
}
```

## Troubleshooting

### ScrollTrigger Not Working

```tsx
// Always refresh after Lenis initializes
useEffect(() => {
  if (lenis) {
    ScrollTrigger.refresh()
  }
}, [lenis])
```

### Jerky Scroll on Mobile

```tsx
// Enable syncTouch for better mobile performance
<ReactLenis
  root
  options={{
    syncTouch: true,
    syncTouchLerp: 0.075,
    touchMultiplier: 1.5,
  }}
>
```

### Scroll Not Working in Modals

```tsx
// Stop Lenis when modal opens
useEffect(() => {
  if (isModalOpen) {
    lenis?.stop()
  } else {
    lenis?.start()
  }
}, [isModalOpen, lenis])
```

### Performance Issues

1. **Disable on low-power mode**: Check `navigator.getBattery()` for charging state
2. **Reduce lerp value**: Higher lerp = less calculations
3. **Use `autoRaf: true`** if not using GSAP ticker

### Next.js App Router Specifics

1. Always use `'use client'` directive
2. Wrap in layout.tsx for global smooth scroll
3. Use `usePathname()` to reset scroll on navigation:

```tsx
'use client'

import { useLenis } from 'lenis/react'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

function ScrollReset() {
  const lenis = useLenis()
  const pathname = usePathname()

  useEffect(() => {
    lenis?.scrollTo(0, { immediate: true })
  }, [pathname, lenis])

  return null
}
```
