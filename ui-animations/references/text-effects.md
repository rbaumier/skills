# Advanced Text Effects

Premium text animations beyond basic reveals: glitch, kinetic typography, morphing, distortion, and more.

## Table of Contents

- [Glitch Text](#glitch-text)
- [Kinetic Typography](#kinetic-typography)
- [Morphing Text](#morphing-text)
- [Typewriter with Distortion](#typewriter-with-distortion)
- [Text Explosion](#text-explosion)
- [Circular & Spiral Text](#circular--spiral-text)
- [Brutalist Text](#brutalist-text)
- [Minimal Text](#minimal-text)
- [Advanced Scramble](#advanced-scramble)
- [Stroke Text Drawing](#stroke-text-drawing)

---

## Glitch Text

RGB split, scan lines, and random character swapping.

```tsx
'use client'
import { useRef, useEffect, useState } from 'react'
import { gsap } from '@/lib/gsap'

export function GlitchText({ text, intensity = 'medium' }: {
  text: string; intensity?: 'low' | 'medium' | 'high'
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current!
    const layers = el.querySelectorAll('.glitch-layer')
    const offsets = { low: 2, medium: 5, high: 12 }
    const offset = offsets[intensity]

    const tl = gsap.timeline({ repeat: -1, repeatDelay: 2 })

    // Glitch burst
    tl.to(layers[0], { x: -offset, duration: 0.05, ease: 'none' }, 0)
      .to(layers[0], { x: offset, duration: 0.05, ease: 'none' }, 0.05)
      .to(layers[0], { x: 0, duration: 0.05, ease: 'none' }, 0.1)
      .to(layers[1], { x: offset, duration: 0.05, ease: 'none' }, 0.02)
      .to(layers[1], { x: -offset, duration: 0.05, ease: 'none' }, 0.07)
      .to(layers[1], { x: 0, duration: 0.05, ease: 'none' }, 0.12)
      // Clip-path glitch
      .to(el, {
        clipPath: `inset(${Math.random() * 40}% 0 ${Math.random() * 40}% 0)`,
        duration: 0.05,
      }, 0.15)
      .to(el, { clipPath: 'inset(0 0 0 0)', duration: 0.05 }, 0.2)

    return () => { tl.kill() }
  }, [intensity])

  return (
    <div ref={containerRef} className="relative font-mono text-5xl font-black">
      <span className="relative z-10">{text}</span>
      <span
        className="glitch-layer absolute inset-0 text-cyan-400 mix-blend-multiply"
        style={{ clipPath: 'inset(0 0 0 0)' }}
        aria-hidden
      >
        {text}
      </span>
      <span
        className="glitch-layer absolute inset-0 text-red-400 mix-blend-multiply"
        style={{ clipPath: 'inset(0 0 0 0)' }}
        aria-hidden
      >
        {text}
      </span>
      {/* Scan lines overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-20"
        style={{
          background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.1) 0px, rgba(0,0,0,0.1) 1px, transparent 1px, transparent 3px)',
        }}
        aria-hidden
      />
    </div>
  )
}
```

### CSS-Only Glitch (Lightweight Alternative)

```css
.glitch {
  position: relative;
  font-family: monospace;
  font-weight: 900;
}

.glitch::before,
.glitch::after {
  content: attr(data-text);
  position: absolute;
  inset: 0;
}

.glitch::before {
  color: cyan;
  animation: glitch-shift 3s infinite;
  clip-path: inset(20% 0 30% 0);
  mix-blend-mode: multiply;
}

.glitch::after {
  color: red;
  animation: glitch-shift 3s infinite reverse;
  clip-path: inset(50% 0 10% 0);
  mix-blend-mode: multiply;
}

@keyframes glitch-shift {
  0%, 90%, 100% { transform: translateX(0); }
  92% { transform: translateX(-5px); }
  94% { transform: translateX(5px); }
  96% { transform: translateX(-3px); }
  98% { transform: translateX(3px); }
}
```

## Kinetic Typography

Letters that orbit, wave, and bounce independently.

```tsx
'use client'
import { useRef } from 'react'
import { gsap, useGSAP } from '@/lib/gsap'

export function WaveText({ text, amplitude = 20, frequency = 0.15, speed = 2 }: {
  text: string; amplitude?: number; frequency?: number; speed?: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    const chars = containerRef.current!.querySelectorAll('.wave-char')
    chars.forEach((char, i) => {
      gsap.to(char, {
        y: `+=${amplitude}`,
        duration: speed,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        delay: i * frequency,
      })
    })
  }, { scope: containerRef })

  return (
    <div ref={containerRef} className="text-6xl font-bold flex">
      {text.split('').map((char, i) => (
        <span key={i} className="wave-char inline-block">
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </div>
  )
}
```

### Orbiting Letters

```tsx
'use client'
import { useRef, useEffect } from 'react'

export function OrbitText({ text, radius = 120, speed = 0.01 }: {
  text: string; radius?: number; speed?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const w = canvas.offsetWidth
    const h = canvas.offsetHeight
    canvas.width = w * 2
    canvas.height = h * 2
    ctx.scale(2, 2)

    let time = 0
    const chars = text.split('')

    const animate = () => {
      ctx.clearRect(0, 0, w, h)
      ctx.font = 'bold 24px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      chars.forEach((char, i) => {
        const angle = (i / chars.length) * Math.PI * 2 + time
        const x = w / 2 + Math.cos(angle) * radius
        const y = h / 2 + Math.sin(angle) * radius * 0.4 // Elliptical
        const scale = 0.6 + (Math.sin(angle) + 1) * 0.2 // Depth

        ctx.save()
        ctx.globalAlpha = 0.4 + (Math.sin(angle) + 1) * 0.3
        ctx.font = `bold ${24 * scale}px monospace`
        ctx.fillStyle = `hsl(${(i / chars.length) * 360}, 70%, 65%)`
        ctx.fillText(char, x, y)
        ctx.restore()
      })

      time += speed
      animRef.current = requestAnimationFrame(animate)
    }
    animate()
    return () => cancelAnimationFrame(animRef.current)
  }, [text, radius, speed])

  return <canvas ref={canvasRef} className="w-full h-full" />
}
```

## Morphing Text

Smooth transition between words.

```tsx
'use client'
import { useRef, useEffect, useState } from 'react'
import { gsap } from '@/lib/gsap'

export function MorphText({ words, interval = 3000 }: { words: string[]; interval?: number }) {
  const text1Ref = useRef<HTMLSpanElement>(null)
  const text2Ref = useRef<HTMLSpanElement>(null)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const el1 = text1Ref.current!
    const el2 = text2Ref.current!

    el1.textContent = words[index]
    el2.textContent = words[(index + 1) % words.length]

    const tl = gsap.timeline({
      onComplete: () => setIndex((index + 1) % words.length),
      delay: interval / 1000,
    })

    tl.to(el1, {
      opacity: 0,
      filter: 'blur(8px)',
      duration: 0.8,
      ease: 'power2.in',
    })
    .fromTo(el2, {
      opacity: 0,
      filter: 'blur(8px)',
    }, {
      opacity: 1,
      filter: 'blur(0px)',
      duration: 0.8,
      ease: 'power2.out',
    }, '-=0.4')

    return () => { tl.kill() }
  }, [index, words, interval])

  return (
    <div className="relative text-6xl font-bold">
      <span ref={text1Ref} className="absolute inset-0" />
      <span ref={text2Ref} className="absolute inset-0 opacity-0" />
      {/* Invisible spacer */}
      <span className="invisible">{words.reduce((a, b) => a.length > b.length ? a : b)}</span>
    </div>
  )
}
```

## Typewriter with Distortion

Classic typewriter with noise displacement.

```tsx
'use client'
import { useState, useEffect, useRef } from 'react'
import { gsap } from '@/lib/gsap'

export function TypewriterDistortion({ text, speed = 50 }: { text: string; speed?: number }) {
  const [displayed, setDisplayed] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const charIndex = useRef(0)

  useEffect(() => {
    const timer = setInterval(() => {
      if (charIndex.current < text.length) {
        setDisplayed(text.slice(0, charIndex.current + 1))
        charIndex.current++

        // Distortion shake on each character
        if (containerRef.current) {
          gsap.fromTo(containerRef.current, {
            x: (Math.random() - 0.5) * 4,
            y: (Math.random() - 0.5) * 2,
            skewX: (Math.random() - 0.5) * 2,
          }, {
            x: 0, y: 0, skewX: 0,
            duration: 0.15,
            ease: 'power2.out',
          })
        }
      } else {
        clearInterval(timer)
      }
    }, speed)

    return () => clearInterval(timer)
  }, [text, speed])

  return (
    <div ref={containerRef} className="font-mono text-3xl">
      {displayed}
      <span className="animate-pulse">|</span>
    </div>
  )
}
```

## Text Explosion

Characters scatter with physics-like motion.

```tsx
'use client'
import { useRef } from 'react'
import { motion } from 'motion/react'

export function TextExplosion({ text, trigger = false }: { text: string; trigger?: boolean }) {
  const chars = text.split('')

  return (
    <div className="relative text-5xl font-bold flex justify-center">
      {chars.map((char, i) => {
        const angle = ((i / chars.length) * 360 + Math.random() * 60) * (Math.PI / 180)
        const distance = 200 + Math.random() * 300
        const targetX = Math.cos(angle) * distance
        const targetY = Math.sin(angle) * distance

        return (
          <motion.span
            key={i}
            className="inline-block"
            animate={trigger ? {
              x: targetX,
              y: targetY,
              rotate: Math.random() * 720 - 360,
              opacity: 0,
              scale: 0,
            } : {
              x: 0, y: 0, rotate: 0, opacity: 1, scale: 1,
            }}
            transition={{
              duration: 0.8 + Math.random() * 0.4,
              ease: [0.16, 1, 0.3, 1],
              delay: i * 0.02,
            }}
          >
            {char === ' ' ? '\u00A0' : char}
          </motion.span>
        )
      })}
    </div>
  )
}
```

## Circular & Spiral Text

SVG textPath for text on a circular path.

```tsx
'use client'
import { motion } from 'motion/react'

export function CircularText({ text, radius = 100, speed = 20 }: {
  text: string; radius?: number; speed?: number
}) {
  const id = `circle-path-${Math.random().toString(36).slice(2)}`

  return (
    <motion.svg
      width={radius * 2 + 40}
      height={radius * 2 + 40}
      viewBox={`0 0 ${radius * 2 + 40} ${radius * 2 + 40}`}
      animate={{ rotate: 360 }}
      transition={{ duration: speed, repeat: Infinity, ease: 'linear' }}
    >
      <defs>
        <path
          id={id}
          d={`M ${radius + 20}, ${radius + 20} m -${radius}, 0 a ${radius},${radius} 0 1,1 ${radius * 2},0 a ${radius},${radius} 0 1,1 -${radius * 2},0`}
          fill="none"
        />
      </defs>
      <text className="fill-current text-sm font-mono tracking-[0.3em] uppercase">
        <textPath href={`#${id}`}>{text}</textPath>
      </text>
    </motion.svg>
  )
}
```

### Spiral Text (Canvas)

```tsx
'use client'
import { useRef, useEffect } from 'react'

export function SpiralText({ text, turns = 3 }: { text: string; turns?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const w = canvas.offsetWidth
    const h = canvas.offsetHeight
    canvas.width = w * 2
    canvas.height = h * 2
    ctx.scale(2, 2)

    const cx = w / 2, cy = h / 2
    const chars = text.split('')
    const maxRadius = Math.min(w, h) * 0.4

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    chars.forEach((char, i) => {
      const t = i / chars.length
      const angle = t * Math.PI * 2 * turns
      const radius = 20 + t * (maxRadius - 20)
      const x = cx + Math.cos(angle) * radius
      const y = cy + Math.sin(angle) * radius

      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(angle + Math.PI / 2)
      ctx.font = `${14 + t * 12}px monospace`
      ctx.fillStyle = `hsl(${t * 360}, 70%, 60%)`
      ctx.fillText(char, 0, 0)
      ctx.restore()
    })
  }, [text, turns])

  return <canvas ref={canvasRef} className="w-full h-full" />
}
```

## Brutalist Text

Oversized mono, extreme overlap, aggressive rotation, mixed scales.

```tsx
'use client'
import { motion } from 'motion/react'

export function BrutalistHeading({ text }: { text: string }) {
  const words = text.split(' ')

  return (
    <div className="relative overflow-hidden p-4">
      {words.map((word, i) => (
        <motion.div
          key={i}
          className="font-mono font-black uppercase leading-[0.85]"
          style={{
            fontSize: `${8 + Math.random() * 10}vw`,
            marginLeft: `${(Math.random() - 0.5) * 10}vw`,
            marginTop: i > 0 ? '-2vw' : '0',
            mixBlendMode: i % 2 === 0 ? 'normal' : 'difference',
          }}
          initial={{ x: i % 2 === 0 ? -200 : 200, rotate: (Math.random() - 0.5) * 15 }}
          whileInView={{ x: 0, rotate: (Math.random() - 0.5) * 3 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3, ease: 'linear' }}
        >
          {word}
        </motion.div>
      ))}
    </div>
  )
}
```

## Minimal Text

Ultra-subtle fades, weight transitions, tracking animations.

```tsx
'use client'
import { motion } from 'motion/react'

export function MinimalText({ text }: { text: string }) {
  return (
    <motion.h1
      className="text-4xl font-extralight tracking-[0.3em] uppercase"
      initial={{ opacity: 0, letterSpacing: '0.5em' }}
      whileInView={{ opacity: 1, letterSpacing: '0.3em' }}
      viewport={{ once: true }}
      transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
    >
      {text}
    </motion.h1>
  )
}
```

### Weight Transition Text

```tsx
'use client'
import { useRef } from 'react'
import { gsap, useGSAP } from '@/lib/gsap'

export function WeightReveal({ text }: { text: string }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    const chars = containerRef.current!.querySelectorAll('span')
    gsap.fromTo(chars, {
      fontWeight: 100,
      opacity: 0.3,
    }, {
      fontWeight: 700,
      opacity: 1,
      duration: 1,
      stagger: 0.05,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top 80%',
      },
    })
  }, { scope: containerRef })

  return (
    <div ref={containerRef} className="text-5xl tracking-wide">
      {text.split('').map((char, i) => (
        <span key={i} className="inline-block" style={{ fontVariationSettings: '"wght" 100' }}>
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </div>
  )
}
```

## Advanced Scramble

Matrix-style decode and glyph cycling.

```tsx
'use client'
import { useState, useEffect, useRef, useCallback } from 'react'

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
const BINARY = '01'

export function MatrixDecode({ text, mode = 'matrix', revealSpeed = 30 }: {
  text: string; mode?: 'matrix' | 'binary' | 'glyphs'; revealSpeed?: number
}) {
  const [display, setDisplay] = useState('')
  const revealed = useRef(0)
  const chars = mode === 'binary' ? BINARY : GLYPHS

  const scramble = useCallback(() => {
    let result = ''
    for (let i = 0; i < text.length; i++) {
      if (i < revealed.current) {
        result += text[i]
      } else if (text[i] === ' ') {
        result += ' '
      } else {
        result += chars[Math.floor(Math.random() * chars.length)]
      }
    }
    return result
  }, [text, chars])

  useEffect(() => {
    revealed.current = 0
    const scrambleInterval = setInterval(() => setDisplay(scramble()), 50)

    const revealInterval = setInterval(() => {
      revealed.current++
      if (revealed.current > text.length) {
        clearInterval(revealInterval)
        clearInterval(scrambleInterval)
        setDisplay(text)
      }
    }, revealSpeed)

    return () => {
      clearInterval(scrambleInterval)
      clearInterval(revealInterval)
    }
  }, [text, revealSpeed, scramble])

  return (
    <span className="font-mono text-green-400 whitespace-pre">{display}</span>
  )
}
```

## Stroke Text Drawing

SVG text with animated stroke.

```tsx
'use client'
import { motion } from 'motion/react'

export function StrokeText({ text, fontSize = 80, duration = 2 }: {
  text: string; fontSize?: number; duration?: number
}) {
  return (
    <svg width="100%" height={fontSize * 1.5} className="overflow-visible">
      <motion.text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        className="font-bold"
        style={{
          fontSize,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
        }}
        initial={{ strokeDasharray: 1000, strokeDashoffset: 1000 }}
        whileInView={{ strokeDashoffset: 0 }}
        viewport={{ once: true }}
        transition={{ duration, ease: 'linear' }}
      >
        {text}
      </motion.text>
      {/* Fill reveal after stroke */}
      <motion.text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        className="font-bold fill-current"
        style={{ fontSize }}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: duration }}
      >
        {text}
      </motion.text>
    </svg>
  )
}
```

## Choosing the Right Effect

| Context | Effect | Why |
|---------|--------|-----|
| Hero heading | Stroke Drawing or Morph | Dramatic first impression |
| Error/404 page | Glitch | Fits the broken theme |
| Loading/processing | Scramble/Decode | Communicates computation |
| Creative portfolio | Kinetic/Orbit | Shows motion design skill |
| Brand statement | Brutalist or Minimal | Strong identity signal |
| Interactive element | Explosion | Satisfying user feedback |
| Narrative section | Typewriter | Builds anticipation |
| Navigation | Circular | Unique, memorable |
