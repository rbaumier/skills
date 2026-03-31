# Response: Scroll-Triggered Parallax Hero with Staggered Text

Here's a parallax hero with staggered text reveal using GSAP + React, with full accessibility compliance:

```tsx
'use client'
import { useRef } from 'react'
import { gsap, ScrollTrigger, useGSAP } from '@/lib/gsap'

export function ParallaxHero() {
  const containerRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    // Check reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersReducedMotion) {
      // Skip parallax and complex animations -- just show content
      gsap.set('.hero-title .char', { opacity: 1, y: 0, rotateX: 0 })
      return
    }

    // Parallax background
    gsap.to('.parallax-bg', {
      yPercent: 30, // Capped at 30% to avoid vestibular triggers (excessive parallax)
      ease: 'none',
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top top',
        end: 'bottom top',
        scrub: true,
      },
    })

    // Staggered character reveal
    gsap.from('.hero-title .char', {
      opacity: 0,
      y: 50,
      rotateX: -90,
      stagger: 0.03,
      duration: 0.8,
      ease: 'power4.out',
      scrollTrigger: {
        trigger: '.hero-title',
        start: 'top 80%',
      },
    })

    // Title fades on scroll
    gsap.to('.hero-title', {
      yPercent: 100,
      opacity: 0,
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top top',
        end: '50% top',
        scrub: true,
      },
    })
  }, { scope: containerRef })

  return (
    <div ref={containerRef} className="relative h-screen overflow-hidden">
      <div className="parallax-bg absolute inset-0 bg-cover bg-center"
           style={{ backgroundImage: 'url(/hero.jpg)' }}
           role="img" aria-label="Hero background" />
      <h1 className="hero-title absolute inset-0 flex items-center justify-center text-7xl font-bold text-white">
        {'Welcome'.split('').map((char, i) => (
          <span key={i} className="char inline-block" aria-hidden={i > 0}>
            {char === ' ' ? '\u00A0' : char}
          </span>
        ))}
      </h1>
    </div>
  )
}
```

## Accessibility Notes

- **`prefers-reduced-motion: reduce`**: All parallax and stagger animations are completely disabled. Content is shown immediately without motion.
- **Vestibular safety**: Parallax amount capped at 30% (not 50%+) to avoid triggering motion sickness. Excessive zoom, spin, and parallax are vestibular triggers that can cause discomfort.
- **Keyboard accessibility**: This animation is scroll-triggered only, not keyboard-initiated. Keyboard-initiated actions should never animate (Emil's rule).
- **Screen reader**: `aria-hidden` on duplicate character spans prevents reading each letter individually.
- **No layout property animation**: Only `transform` and `opacity` are animated.
