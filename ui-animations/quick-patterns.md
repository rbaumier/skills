# Quick Animation Patterns

Ready-to-use animation components for common UI needs.

## 1. Magnetic Cursor (GSAP)

```tsx
'use client'
import { useRef, useEffect } from 'react'
import { gsap, useGSAP } from '@/lib/gsap'

export function MagneticCursor() {
  const cursorRef = useRef<HTMLDivElement>(null)
  const pos = useRef({ x: 0, y: 0, cx: 0, cy: 0 })
  useEffect(() => {
    const h = (e: MouseEvent) => { pos.current.x = e.clientX; pos.current.y = e.clientY }
    window.addEventListener('mousemove', h)
    return () => window.removeEventListener('mousemove', h)
  }, [])
  useGSAP(() => {
    gsap.ticker.add(() => {
      const p = pos.current
      p.cx += (p.x - p.cx) * 0.15; p.cy += (p.y - p.cy) * 0.15
      gsap.set(cursorRef.current, { x: p.cx, y: p.cy })
    })
  })
  return <div ref={cursorRef} className="fixed w-10 h-10 border border-white rounded-full pointer-events-none mix-blend-difference z-[9999] -translate-x-1/2 -translate-y-1/2" />
}
```

## 2. Magnetic Button (Motion)

```tsx
'use client'
import { useRef, useState } from 'react'
import { motion } from 'motion/react'

export function MagneticButton({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const onMove = (e: React.MouseEvent) => {
    const { left, top, width, height } = ref.current!.getBoundingClientRect()
    setPos({ x: (e.clientX - left - width / 2) * 0.3, y: (e.clientY - top - height / 2) * 0.3 })
  }
  return (
    <motion.button ref={ref} onMouseMove={onMove} onMouseLeave={() => setPos({ x: 0, y: 0 })}
      animate={pos} transition={{ type: 'spring', stiffness: 150, damping: 15 }}
      className="px-8 py-4 bg-white text-black rounded-full">{children}</motion.button>
  )
}
```

## 3. Stagger List (Motion)

```tsx
import { motion } from 'motion/react'

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } }
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }

export function StaggerList({ items }: { items: string[] }) {
  return (
    <motion.ul variants={container} initial="hidden" animate="show">
      {items.map((text, i) => <motion.li key={i} variants={item}>{text}</motion.li>)}
    </motion.ul>
  )
}
```

## 4. Modal / Dialog (Motion)

```tsx
import { motion, AnimatePresence } from 'motion/react'

export function Modal({ isOpen, onClose, children }: { isOpen: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="fixed inset-0 bg-black/50 z-40" />
          <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
```

## 5. Scroll-Triggered Reveal (Motion)

```tsx
import { motion, useScroll, useTransform } from 'motion/react'
import { useRef } from 'react'

export function ScrollReveal({ children }: { children: React.ReactNode }) {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0])
  const y = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [100, 0, 0, -100])
  return <motion.div ref={ref} style={{ opacity, y }}>{children}</motion.div>
}
```

## 6. Parallax Hero (GSAP)

```tsx
'use client'
import { useRef } from 'react'
import { gsap, ScrollTrigger, useGSAP } from '@/lib/gsap'

export function ParallaxHero() {
  const containerRef = useRef<HTMLDivElement>(null)
  useGSAP(() => {
    gsap.to('.parallax-bg', { yPercent: 50, ease: 'none', scrollTrigger: { trigger: containerRef.current, start: 'top top', end: 'bottom top', scrub: true } })
    gsap.to('.hero-title', { yPercent: 100, opacity: 0, scrollTrigger: { trigger: containerRef.current, start: 'top top', end: '50% top', scrub: true } })
  }, { scope: containerRef })
  return (
    <div ref={containerRef} className="relative h-screen overflow-hidden">
      <div className="parallax-bg absolute inset-0 bg-cover bg-center" />
      <h1 className="hero-title absolute inset-0 flex items-center justify-center text-6xl">Hero Title</h1>
    </div>
  )
}
```

## 7. Text Character Reveal (Motion)

```tsx
'use client'
import { motion } from 'motion/react'

const container = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.02 } } }
const child = { hidden: { opacity: 0, y: 50, rotateX: -90 }, visible: { opacity: 1, y: 0, rotateX: 0, transition: { type: 'spring', damping: 12 } } }

export function TextReveal({ text }: { text: string }) {
  return (
    <motion.span variants={container} initial="hidden" whileInView="visible" viewport={{ once: true }} className="inline-block">
      {text.split('').map((char, i) => (
        <motion.span key={i} variants={child} className="inline-block">{char === ' ' ? '\u00A0' : char}</motion.span>
      ))}
    </motion.span>
  )
}
```

## 8. Image Reveal (GSAP)

```tsx
'use client'
import { useRef } from 'react'
import { gsap, useGSAP } from '@/lib/gsap'

export function ImageReveal({ src, alt }: { src: string; alt: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  useGSAP(() => {
    gsap.from(containerRef.current, { clipPath: 'inset(100% 0% 0% 0%)', duration: 1.2, ease: 'power4.inOut', scrollTrigger: { trigger: containerRef.current, start: 'top 80%' } })
    gsap.from('.reveal-img', { scale: 1.3, duration: 1.5, ease: 'power2.out', scrollTrigger: { trigger: containerRef.current, start: 'top 80%' } })
  }, { scope: containerRef })
  return (
    <div ref={containerRef} className="overflow-hidden">
      <img src={src} alt={alt} className="reveal-img w-full h-full object-cover" />
    </div>
  )
}
```

## 9. Page Transition (Motion)

```tsx
'use client'
import { motion } from 'motion/react'
import { usePathname } from 'next/navigation'

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <motion.div key={pathname} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
      {children}
    </motion.div>
  )
}
```

## 10. Loading States (Motion)

```tsx
import { motion } from 'motion/react'

// Spinner
export function Spinner() {
  return <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
    className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
}

// Skeleton
export function Skeleton() {
  return <motion.div animate={{ opacity: [0.5, 1, 0.5] }}
    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
    className="bg-gray-200 rounded h-4 w-full" />
}
```
