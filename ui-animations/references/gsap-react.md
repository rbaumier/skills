# GSAP + React Patterns

Complete GSAP patterns for React with useGSAP hook. Based on official GSAP documentation.

## Table of Contents
1. [useGSAP Fundamentals](#usegsap-fundamentals)
2. [ScrollTrigger in React](#scrolltrigger-in-react)
3. [Context Safe Functions](#context-safe-functions)
4. [Timeline Orchestration](#timeline-orchestration)
5. [Text Animations](#text-animations)
6. [Pin Sections](#pin-sections)
7. [Batch Animations](#batch-animations)
8. [SVG Animations](#svg-animations)

## useGSAP Fundamentals

### Basic Setup

```tsx
'use client'
import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

// Register once (usually in a shared lib file)
gsap.registerPlugin(ScrollTrigger, useGSAP)
```

### Basic Animation

```tsx
function AnimatedBox() {
  const containerRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    gsap.to('.box', { x: 360, rotation: 360, duration: 1 })
  }, { scope: containerRef }) // scope limits selectors to container

  return (
    <div ref={containerRef}>
      <div className="box">Animated</div>
    </div>
  )
}
```

### With Dependencies

```tsx
function AnimatedCounter({ count }: { count: number }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    gsap.from('.counter', {
      textContent: 0,
      duration: 1,
      snap: { textContent: 1 }
    })
  }, {
    scope: containerRef,
    dependencies: [count],     // Re-run when count changes
    revertOnUpdate: true       // Cleanup before re-running
  })

  return (
    <div ref={containerRef}>
      <span className="counter">{count}</span>
    </div>
  )
}
```

### Cleanup Function

```tsx
useGSAP(() => {
  const animation = gsap.to('.box', { x: 100 })

  return () => {
    // Custom cleanup (useGSAP auto-reverts GSAP objects)
    console.log('Component unmounting')
  }
}, { scope: containerRef })
```

## ScrollTrigger in React

### Basic ScrollTrigger

```tsx
function ScrollSection() {
  const containerRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    gsap.from('.content', {
      opacity: 0,
      y: 50,
      duration: 1,
      scrollTrigger: {
        trigger: '.content',
        start: 'top 80%',
        end: 'top 30%',
        toggleActions: 'play none none reverse',
        // markers: true, // Debug only
      }
    })
  }, { scope: containerRef })

  return (
    <div ref={containerRef}>
      <div className="content">Scroll to reveal</div>
    </div>
  )
}
```

### Scrub Animation

```tsx
function ScrubSection() {
  const containerRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    gsap.to('.progress', {
      scaleX: 1,
      ease: 'none',
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.3, // Smooth catch-up (seconds)
      }
    })
  }, { scope: containerRef })

  return (
    <div ref={containerRef} className="h-[300vh]">
      <div className="progress fixed top-0 left-0 h-1 w-full bg-blue-500 origin-left scale-x-0" />
    </div>
  )
}
```

### Pin Section

```tsx
function PinnedSection() {
  const containerRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    gsap.to('.pinned-content', {
      y: 200,
      opacity: 0.5,
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top top',
        end: '+=1000', // Pin for 1000px of scroll
        pin: true,
        scrub: true,
        anticipatePin: 1, // Prevents jump
      }
    })
  }, { scope: containerRef })

  return (
    <div ref={containerRef} className="h-screen">
      <div className="pinned-content">Pinned content</div>
    </div>
  )
}
```

### Multiple ScrollTriggers

```tsx
function MultipleAnimations() {
  const containerRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    const sections = gsap.utils.toArray<HTMLElement>('.section')

    sections.forEach((section, i) => {
      gsap.from(section, {
        opacity: 0,
        y: 50,
        duration: 0.8,
        scrollTrigger: {
          trigger: section,
          start: 'top 80%',
          toggleActions: 'play none none reverse',
        }
      })
    })
  }, { scope: containerRef })

  return (
    <div ref={containerRef}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="section h-screen">Section {i}</div>
      ))}
    </div>
  )
}
```

## Context Safe Functions

Use `contextSafe` for animations triggered by events (click, hover, etc.).

### Click Handler

```tsx
function ClickAnimation() {
  const containerRef = useRef<HTMLDivElement>(null)

  const { contextSafe } = useGSAP({ scope: containerRef })

  const handleClick = contextSafe(() => {
    gsap.to('.box', {
      rotation: '+=360',
      duration: 0.5,
      ease: 'power2.out'
    })
  })

  return (
    <div ref={containerRef}>
      <button onClick={handleClick}>Rotate</button>
      <div className="box">Click to spin</div>
    </div>
  )
}
```

### Hover Animation

```tsx
function HoverCard() {
  const containerRef = useRef<HTMLDivElement>(null)

  const { contextSafe } = useGSAP({ scope: containerRef })

  const handleMouseEnter = contextSafe(() => {
    gsap.to('.card-content', { y: -10, duration: 0.3 })
  })

  const handleMouseLeave = contextSafe(() => {
    gsap.to('.card-content', { y: 0, duration: 0.3 })
  })

  return (
    <div
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="card-content">Hover me</div>
    </div>
  )
}
```

## Timeline Orchestration

### Basic Timeline

```tsx
function TimelineAnimation() {
  const containerRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top center',
      }
    })

    tl.from('.title', { opacity: 0, y: 50, duration: 0.6 })
      .from('.subtitle', { opacity: 0, y: 30, duration: 0.5 }, '-=0.3')
      .from('.cta', { opacity: 0, scale: 0.9, duration: 0.4 }, '-=0.2')
      .from('.decoration', { opacity: 0, x: -20, stagger: 0.1 }, '-=0.3')

  }, { scope: containerRef })

  return (
    <div ref={containerRef}>
      <h1 className="title">Title</h1>
      <p className="subtitle">Subtitle</p>
      <button className="cta">CTA</button>
      <div className="decoration" />
      <div className="decoration" />
    </div>
  )
}
```

### Timeline with Controls

```tsx
function ControlledTimeline() {
  const containerRef = useRef<HTMLDivElement>(null)
  const tl = useRef<gsap.core.Timeline>(null)

  useGSAP(() => {
    tl.current = gsap.timeline({ paused: true })
      .to('.box', { x: 200, duration: 0.5 })
      .to('.box', { y: 100, duration: 0.5 })
      .to('.box', { rotation: 360, duration: 0.5 })
  }, { scope: containerRef })

  const play = () => tl.current?.play()
  const reverse = () => tl.current?.reverse()
  const restart = () => tl.current?.restart()

  return (
    <div ref={containerRef}>
      <div className="box" />
      <button onClick={play}>Play</button>
      <button onClick={reverse}>Reverse</button>
      <button onClick={restart}>Restart</button>
    </div>
  )
}
```

## Text Animations

### SplitText (Club GSAP)

```tsx
import { SplitText } from 'gsap/SplitText'
gsap.registerPlugin(SplitText)

function TextReveal() {
  const textRef = useRef<HTMLHeadingElement>(null)
  const splitRef = useRef<SplitText | null>(null)

  useGSAP(() => {
    splitRef.current = new SplitText(textRef.current, {
      type: 'chars, words, lines',
      linesClass: 'overflow-hidden'
    })

    gsap.from(splitRef.current.chars, {
      opacity: 0,
      y: 100,
      rotateX: -90,
      stagger: 0.02,
      duration: 0.8,
      ease: 'back.out(1.7)',
      scrollTrigger: {
        trigger: textRef.current,
        start: 'top 80%',
      }
    })

    return () => splitRef.current?.revert()
  })

  return <h1 ref={textRef}>Animated Headline</h1>
}
```

### Text Scramble

```tsx
import { TextPlugin } from 'gsap/TextPlugin'
gsap.registerPlugin(TextPlugin)

function ScrambleText() {
  const textRef = useRef<HTMLSpanElement>(null)

  useGSAP(() => {
    gsap.to(textRef.current, {
      duration: 2,
      text: {
        value: 'Final Text',
        delimiter: '',
      },
      ease: 'none',
      scrollTrigger: {
        trigger: textRef.current,
        start: 'top 80%',
      }
    })
  })

  return <span ref={textRef}>Initial Text</span>
}
```

### Line-by-Line Mask Reveal

```tsx
function LineMaskReveal({ text }: { text: string }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    gsap.from('.line-inner', {
      yPercent: 100,
      duration: 0.8,
      ease: 'power4.out',
      stagger: 0.1,
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top 80%',
      }
    })
  }, { scope: containerRef })

  return (
    <div ref={containerRef}>
      {text.split('\n').map((line, i) => (
        <div key={i} className="overflow-hidden">
          <div className="line-inner">{line}</div>
        </div>
      ))}
    </div>
  )
}
```

## Pin Sections

### Horizontal Scroll

```tsx
function HorizontalScroll() {
  const containerRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    const sections = gsap.utils.toArray<HTMLElement>('.panel')

    gsap.to(sections, {
      xPercent: -100 * (sections.length - 1),
      ease: 'none',
      scrollTrigger: {
        trigger: wrapperRef.current,
        pin: true,
        scrub: 1,
        snap: 1 / (sections.length - 1),
        end: () => '+=' + wrapperRef.current!.offsetWidth,
      }
    })
  }, { scope: containerRef })

  return (
    <div ref={containerRef}>
      <div ref={wrapperRef} className="flex w-[400vw]">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="panel w-screen h-screen flex-shrink-0">
            Panel {i}
          </div>
        ))}
      </div>
    </div>
  )
}
```

### Stacked Pin Sections

```tsx
function StackedSections() {
  const containerRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    const sections = gsap.utils.toArray<HTMLElement>('.stack-section')

    sections.forEach((section, i) => {
      ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        pin: true,
        pinSpacing: false,
        snap: 1,
      })
    })
  }, { scope: containerRef })

  return (
    <div ref={containerRef}>
      {[1, 2, 3].map(i => (
        <div key={i} className="stack-section h-screen" style={{ zIndex: i }}>
          Section {i}
        </div>
      ))}
    </div>
  )
}
```

## Batch Animations

### Efficient Grid Animation

```tsx
function BatchGrid() {
  const containerRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    ScrollTrigger.batch('.grid-item', {
      onEnter: (elements) => {
        gsap.from(elements, {
          opacity: 0,
          y: 60,
          stagger: 0.1,
          duration: 0.6,
          ease: 'power3.out',
        })
      },
      start: 'top 85%',
    })
  }, { scope: containerRef })

  return (
    <div ref={containerRef} className="grid grid-cols-4 gap-4">
      {Array.from({ length: 16 }).map((_, i) => (
        <div key={i} className="grid-item aspect-square bg-gray-800" />
      ))}
    </div>
  )
}
```

## SVG Animations

### DrawSVG

```tsx
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'
gsap.registerPlugin(DrawSVGPlugin)

function DrawSVG() {
  const svgRef = useRef<SVGSVGElement>(null)

  useGSAP(() => {
    gsap.from('.draw-path', {
      drawSVG: '0%',
      duration: 2,
      ease: 'power2.inOut',
      stagger: 0.2,
      scrollTrigger: {
        trigger: svgRef.current,
        start: 'top 70%',
      }
    })
  })

  return (
    <svg ref={svgRef} viewBox="0 0 100 100">
      <path className="draw-path" d="M10,50 Q50,10 90,50" fill="none" stroke="white" />
    </svg>
  )
}
```

### MorphSVG

```tsx
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin'
gsap.registerPlugin(MorphSVGPlugin)

function MorphShape() {
  const shapeRef = useRef<SVGPathElement>(null)

  const { contextSafe } = useGSAP()

  const morph = contextSafe(() => {
    gsap.to(shapeRef.current, {
      morphSVG: '#target-shape',
      duration: 1,
      ease: 'power2.inOut',
    })
  })

  return (
    <svg viewBox="0 0 100 100">
      <path ref={shapeRef} id="start-shape" d="M50,10 L90,90 L10,90 Z" />
      <path id="target-shape" d="M50,10 A40,40 0 1,1 50,90 A40,40 0 1,1 50,10" style={{ visibility: 'hidden' }} />
      <button onClick={morph}>Morph</button>
    </svg>
  )
}
```

## Important Notes

### React 18 Strict Mode

Strict Mode calls effects twice in development. `useGSAP` handles this automatically with proper cleanup.

### SSR / Next.js

Add `'use client'` to components using GSAP. The hook is SSR-safe.

### Refresh After Dynamic Content

```tsx
useEffect(() => {
  ScrollTrigger.refresh()
}, [items]) // After items change
```

### Kill on Route Change

```tsx
// In a layout or route component
useEffect(() => {
  return () => {
    ScrollTrigger.getAll().forEach(t => t.kill())
  }
}, [])
```
