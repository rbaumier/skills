# Anime.js 4.0 React Patterns

Complete Anime.js 4.0 patterns for React. Lightweight alternative for simple animations.

## Table of Contents
1. [Installation & Setup](#installation--setup)
2. [React Integration](#react-integration)
3. [Basic Animations](#basic-animations)
4. [Timeline](#timeline)
5. [Stagger](#stagger)
6. [Scroll Animations](#scroll-animations)
7. [Text Animations](#text-animations)
8. [SVG Animations](#svg-animations)
9. [Draggable](#draggable)
10. [v3 to v4 Migration](#v3-to-v4-migration)

## Installation & Setup

```bash
npm install animejs
```

### Imports (v4 Syntax)

```tsx
// Named imports (v4)
import {
  animate,
  createTimeline,
  createScope,
  createSpring,
  createDraggable,
  stagger,
  svg,
  utils,
  engine
} from 'animejs'
```

## React Integration

### Basic Pattern with createScope

```tsx
'use client'

import { useEffect, useRef } from 'react'
import { animate, createScope } from 'animejs'

export function AnimatedBox() {
  const rootRef = useRef<HTMLDivElement>(null)
  const scopeRef = useRef<ReturnType<typeof createScope> | null>(null)

  useEffect(() => {
    // Create scope bound to container
    scopeRef.current = createScope({ root: rootRef.current }).add(() => {
      // All animations here are scoped to rootRef
      animate('.box', {
        translateX: 250,
        rotate: '1turn',
        duration: 800,
        ease: 'out(3)',
      })
    })

    // Cleanup on unmount
    return () => scopeRef.current?.revert()
  }, [])

  return (
    <div ref={rootRef}>
      <div className="box">Animated</div>
    </div>
  )
}
```

### Registering Methods for External Control

```tsx
'use client'

import { useEffect, useRef } from 'react'
import { animate, createScope } from 'animejs'

export function ControlledAnimation() {
  const rootRef = useRef<HTMLDivElement>(null)
  const scopeRef = useRef<ReturnType<typeof createScope> | null>(null)

  useEffect(() => {
    scopeRef.current = createScope({ root: rootRef.current }).add((self) => {
      // Register method accessible outside useEffect
      self.add('animateBox', () => {
        animate('.box', {
          scale: [1, 1.2, 1],
          duration: 400,
          ease: 'out(2)',
        })
      })
    })

    return () => scopeRef.current?.revert()
  }, [])

  const handleClick = () => {
    // Call registered method
    scopeRef.current?.methods.animateBox()
  }

  return (
    <div ref={rootRef}>
      <button onClick={handleClick}>Animate</button>
      <div className="box">Click to animate</div>
    </div>
  )
}
```

## Basic Animations

### Simple Animation

```tsx
// v4 syntax: animate(targets, { properties })
animate('.element', {
  translateX: 250,
  translateY: 100,
  rotate: '1turn',
  scale: 1.5,
  opacity: 0.5,
  duration: 1000,
  ease: 'out(3)',
})
```

### From/To Values

```tsx
animate('.element', {
  translateX: [0, 250],     // from 0 to 250
  opacity: [0, 1],          // from 0 to 1
  scale: [0.5, 1],          // from 0.5 to 1
  duration: 800,
})
```

### Keyframes

```tsx
animate('.element', {
  keyframes: [
    { translateX: 0, scale: 1 },
    { translateX: 100, scale: 1.2 },
    { translateX: 200, scale: 1 },
    { translateX: 250, scale: 0.8 },
  ],
  duration: 2000,
  ease: 'inOut(2)',
})
```

### Property-Specific Parameters

```tsx
animate('.element', {
  translateX: {
    to: 250,
    duration: 1000,
    ease: 'out(4)',
  },
  rotate: {
    to: '1turn',
    duration: 1500,
    ease: 'inOut(2)',
  },
  scale: {
    to: 1.5,
    duration: 800,
    delay: 200,
  },
})
```

### Callbacks

```tsx
animate('.element', {
  translateX: 250,
  duration: 1000,
  onBegin: () => console.log('Started'),
  onUpdate: (anim) => console.log(anim.progress),
  onComplete: () => console.log('Done'),
  onLoop: () => console.log('Loop'),
}).then(() => {
  console.log('Promise resolved')
})
```

### Playback Controls

```tsx
const animation = animate('.element', {
  translateX: 250,
  autoplay: false,
})

animation.play()      // Play forward
animation.pause()     // Pause
animation.resume()    // Resume in current direction
animation.reverse()   // Play backward
animation.restart()   // Restart from beginning
animation.seek(500)   // Seek to 500ms
animation.reset()     // Reset to initial state
```

## Timeline

### Basic Timeline

```tsx
import { createTimeline } from 'animejs'

const tl = createTimeline({
  defaults: {
    duration: 500,
    ease: 'out(3)',
  }
})

tl.add('.box-1', { translateX: 250 })
  .add('.box-2', { translateX: 250 }, '-=200')  // 200ms before previous ends
  .add('.box-3', { translateX: 250 }, '+=100')  // 100ms after previous ends
```

### Timeline in React

```tsx
'use client'

import { useEffect, useRef } from 'react'
import { createTimeline, createScope } from 'animejs'

export function TimelineAnimation() {
  const rootRef = useRef<HTMLDivElement>(null)
  const scopeRef = useRef<ReturnType<typeof createScope> | null>(null)

  useEffect(() => {
    scopeRef.current = createScope({ root: rootRef.current }).add(() => {
      const tl = createTimeline({
        defaults: { duration: 600, ease: 'out(3)' }
      })

      tl.add('.title', { opacity: [0, 1], translateY: [30, 0] })
        .add('.subtitle', { opacity: [0, 1], translateY: [20, 0] }, '-=400')
        .add('.cta', { opacity: [0, 1], scale: [0.9, 1] }, '-=300')
    })

    return () => scopeRef.current?.revert()
  }, [])

  return (
    <div ref={rootRef}>
      <h1 className="title">Title</h1>
      <p className="subtitle">Subtitle</p>
      <button className="cta">CTA</button>
    </div>
  )
}
```

## Stagger

### Basic Stagger

```tsx
import { stagger } from 'animejs'

animate('.grid-item', {
  opacity: [0, 1],
  translateY: [50, 0],
  delay: stagger(100),  // 100ms between each
  duration: 600,
})
```

### Stagger with Start Value

```tsx
animate('.item', {
  translateX: 250,
  delay: stagger(100, { start: 500 }),  // Start at 500ms, then +100ms each
})
```

### Grid Stagger

```tsx
animate('.grid-item', {
  scale: [0, 1],
  delay: stagger(50, {
    grid: [4, 4],           // 4x4 grid
    from: 'center',         // Animate from center outward
  }),
})
```

### Stagger from Index

```tsx
animate('.item', {
  opacity: [0, 1],
  delay: stagger(100, {
    from: 'first',   // 'first', 'last', 'center', or index number
  }),
})
```

### Value Stagger

```tsx
animate('.bar', {
  scaleY: stagger([0.5, 1]),  // Scale from 0.5 to 1 distributed
  duration: 800,
})
```

## Scroll Animations

### ScrollObserver

```tsx
'use client'

import { useEffect, useRef } from 'react'
import { animate, createScope } from 'animejs'

export function ScrollReveal() {
  const rootRef = useRef<HTMLDivElement>(null)
  const scopeRef = useRef<ReturnType<typeof createScope> | null>(null)

  useEffect(() => {
    scopeRef.current = createScope({ root: rootRef.current }).add(() => {
      // Using Intersection Observer pattern
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              animate(entry.target, {
                opacity: [0, 1],
                translateY: [50, 0],
                duration: 800,
                ease: 'out(3)',
              })
              observer.unobserve(entry.target)
            }
          })
        },
        { threshold: 0.2 }
      )

      document.querySelectorAll('.reveal-item').forEach((el) => {
        observer.observe(el)
      })
    })

    return () => scopeRef.current?.revert()
  }, [])

  return (
    <div ref={rootRef}>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="reveal-item opacity-0">
          Item {i}
        </div>
      ))}
    </div>
  )
}
```

## Text Animations

### Character Split Animation

```tsx
'use client'

import { useEffect, useRef } from 'react'
import { animate, createScope, stagger } from 'animejs'

export function TextReveal({ text }: { text: string }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const scopeRef = useRef<ReturnType<typeof createScope> | null>(null)

  useEffect(() => {
    scopeRef.current = createScope({ root: rootRef.current }).add(() => {
      animate('.char', {
        opacity: [0, 1],
        translateY: [50, 0],
        rotateX: [-90, 0],
        delay: stagger(30),
        duration: 600,
        ease: 'out(3)',
      })
    })

    return () => scopeRef.current?.revert()
  }, [])

  return (
    <div ref={rootRef} className="overflow-hidden">
      {text.split('').map((char, i) => (
        <span key={i} className="char inline-block opacity-0">
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </div>
  )
}
```

### Word Animation

```tsx
export function WordReveal({ text }: { text: string }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const scopeRef = useRef<ReturnType<typeof createScope> | null>(null)

  useEffect(() => {
    scopeRef.current = createScope({ root: rootRef.current }).add(() => {
      animate('.word', {
        opacity: [0, 1],
        translateY: ['100%', '0%'],
        delay: stagger(80),
        duration: 800,
        ease: 'out(4)',
      })
    })

    return () => scopeRef.current?.revert()
  }, [])

  return (
    <div ref={rootRef}>
      {text.split(' ').map((word, i) => (
        <span key={i} className="inline-block overflow-hidden mr-2">
          <span className="word inline-block opacity-0">{word}</span>
        </span>
      ))}
    </div>
  )
}
```

## SVG Animations

### Path Drawing

```tsx
import { svg } from 'animejs'

export function DrawSVG() {
  const svgRef = useRef<SVGSVGElement>(null)
  const scopeRef = useRef<ReturnType<typeof createScope> | null>(null)

  useEffect(() => {
    scopeRef.current = createScope({ root: svgRef.current }).add(() => {
      const drawable = svg.createDrawable('.draw-path')

      animate(drawable, {
        draw: ['0 0', '0 1'],  // From 0% to 100%
        duration: 2000,
        ease: 'inOut(2)',
      })
    })

    return () => scopeRef.current?.revert()
  }, [])

  return (
    <svg ref={svgRef} viewBox="0 0 100 100">
      <path
        className="draw-path"
        d="M10,50 Q50,10 90,50 T90,90"
        fill="none"
        stroke="white"
        strokeWidth="2"
      />
    </svg>
  )
}
```

### SVG Morphing

```tsx
import { svg } from 'animejs'

export function MorphSVG() {
  const pathRef = useRef<SVGPathElement>(null)

  useEffect(() => {
    const morph = svg.createMorph(pathRef.current)

    animate(morph, {
      to: 'M50,10 A40,40 0 1,1 50,90 A40,40 0 1,1 50,10', // Circle
      duration: 1000,
      ease: 'inOut(2)',
    })
  }, [])

  return (
    <svg viewBox="0 0 100 100">
      <path ref={pathRef} d="M50,10 L90,90 L10,90 Z" fill="white" />
    </svg>
  )
}
```

### Motion Path

```tsx
import { svg } from 'animejs'

export function MotionPath() {
  const elementRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const motionPath = svg.createMotionPath('#motion-path')

    animate(elementRef.current, {
      translateX: motionPath.x,
      translateY: motionPath.y,
      rotate: motionPath.angle,
      duration: 3000,
      ease: 'linear',
      loop: true,
    })
  }, [])

  return (
    <>
      <svg className="absolute">
        <path id="motion-path" d="M0,100 Q250,0 500,100" fill="none" />
      </svg>
      <div ref={elementRef} className="w-4 h-4 bg-white rounded-full" />
    </>
  )
}
```

## Draggable

### Basic Draggable

```tsx
import { createDraggable } from 'animejs'

export function DraggableBox() {
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const draggable = createDraggable(boxRef.current, {
      trigger: boxRef.current,
      releaseEase: 'out(3)',
      releaseStiffness: 50,
    })

    return () => draggable.revert()
  }, [])

  return (
    <div ref={boxRef} className="w-20 h-20 bg-white cursor-grab">
      Drag me
    </div>
  )
}
```

### Draggable with Constraints

```tsx
createDraggable(element, {
  container: containerRef.current,  // Constrain to container
  x: { min: 0, max: 500 },          // X bounds
  y: { min: 0, max: 300 },          // Y bounds
  snap: { x: 50, y: 50 },           // Snap to grid
})
```

## Easing Reference (v4)

### Built-in Easings

```tsx
// v4 easing syntax (no 'ease' prefix)
ease: 'linear'
ease: 'in(2)'       // Power in
ease: 'out(2)'      // Power out (default)
ease: 'inOut(2)'    // Power in-out
ease: 'out(4)'      // Stronger ease out
```

### Spring Easing

```tsx
import { createSpring } from 'animejs'

const spring = createSpring({
  mass: 1,
  stiffness: 100,
  damping: 10,
  velocity: 0,
})

animate('.element', {
  translateX: 250,
  ease: spring,
})
```

### Custom Easing

```tsx
// Cubic bezier
ease: 'cubicBezier(0.76, 0, 0.24, 1)'

// Custom function
ease: (t) => t * t  // Quadratic
```

## v3 to v4 Migration

| v3 | v4 |
|----|----|
| `anime({ targets, ...props })` | `animate(targets, { ...props })` |
| `easing: 'easeOutQuad'` | `ease: 'out(2)'` |
| `easing: 'easeInOutCubic'` | `ease: 'inOut(3)'` |
| `endDelay` | `loopDelay` |
| `direction: 'reverse'` | `reversed: true` |
| `direction: 'alternate'` | `alternate: true` |
| `update` callback | `onUpdate` callback |
| `begin` callback | `onBegin` callback |
| `complete` callback | `onComplete` callback |
| `.finished.then()` | `.then()` |
| `anime.timeline()` | `createTimeline()` |
| `anime.stagger()` | `stagger()` |

## When to Use Anime.js vs GSAP

| Use Anime.js | Use GSAP |
|--------------|----------|
| Simple animations | Complex scroll-driven |
| Lightweight needs (~17kb) | ScrollTrigger required |
| Quick prototypes | Production timelines |
| SVG morphing | SplitText, MorphSVG |
| Draggable elements | Pin sections |

## Sources

- [Anime.js Documentation](https://animejs.com/documentation/)
- [Using with React](https://animejs.com/documentation/getting-started/using-with-react/)
- [v3 to v4 Migration Guide](https://github.com/juliangarnier/anime/wiki/Migrating-from-v3-to-v4)
