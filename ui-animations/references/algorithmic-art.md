# Algorithmic & Generative Art

React patterns for mathematical art, fractals, flow fields, and generative visuals using Canvas 2D and p5.js.

## Table of Contents

- [Fractal Trees](#fractal-trees)
- [L-Systems](#l-systems)
- [Mathematical Curves](#mathematical-curves)
- [Flow Fields](#flow-fields)
- [Strange Attractors](#strange-attractors)
- [Reaction-Diffusion](#reaction-diffusion)
- [Cellular Automata](#cellular-automata)
- [Noise Patterns](#noise-patterns)
- [Sacred Geometry](#sacred-geometry)

---

## Fractal Trees

Recursive branching with animated growth.

```tsx
'use client'
import { useRef, useEffect, useCallback } from 'react'

interface BranchParams {
  x: number; y: number; length: number; angle: number; depth: number
  maxDepth: number; progress: number
}

export function FractalTree({ maxDepth = 10, branchAngle = 25 }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const progressRef = useRef(0)

  const drawBranch = useCallback((ctx: CanvasRenderingContext2D, params: BranchParams) => {
    const { x, y, length, angle, depth, maxDepth, progress } = params
    if (depth > maxDepth || length < 2) return

    const depthProgress = Math.max(0, Math.min(1, progress * maxDepth - depth))
    if (depthProgress <= 0) return

    const endX = x + Math.cos((angle * Math.PI) / 180) * length * depthProgress
    const endY = y - Math.sin((angle * Math.PI) / 180) * length * depthProgress

    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(endX, endY)
    ctx.strokeStyle = `hsl(${120 + depth * 15}, 60%, ${30 + depth * 5}%)`
    ctx.lineWidth = Math.max(1, (maxDepth - depth) * 1.5)
    ctx.stroke()

    const newLength = length * 0.72
    const spread = branchAngle + Math.sin(depth * 0.5) * 5
    drawBranch(ctx, { x: endX, y: endY, length: newLength, angle: angle + spread, depth: depth + 1, maxDepth, progress })
    drawBranch(ctx, { x: endX, y: endY, length: newLength, angle: angle - spread, depth: depth + 1, maxDepth, progress })
  }, [branchAngle])

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    canvas.width = canvas.offsetWidth * 2
    canvas.height = canvas.offsetHeight * 2
    ctx.scale(2, 2)

    const animate = () => {
      progressRef.current = Math.min(1, progressRef.current + 0.008)
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight)
      drawBranch(ctx, {
        x: canvas.offsetWidth / 2, y: canvas.offsetHeight,
        length: canvas.offsetHeight * 0.28, angle: 90,
        depth: 0, maxDepth, progress: progressRef.current,
      })
      if (progressRef.current < 1) animRef.current = requestAnimationFrame(animate)
    }
    animate()
    return () => cancelAnimationFrame(animRef.current)
  }, [maxDepth, drawBranch])

  return <canvas ref={canvasRef} className="w-full h-full" />
}
```

## L-Systems

Lindenmayer systems with turtle graphics.

```tsx
'use client'
import { useRef, useEffect } from 'react'

interface LSystemRule { [key: string]: string }

function generateLSystem(axiom: string, rules: LSystemRule, iterations: number): string {
  let current = axiom
  for (let i = 0; i < iterations; i++) {
    current = current.split('').map(c => rules[c] || c).join('')
  }
  return current
}

interface TurtleState { x: number; y: number; angle: number }

function drawLSystem(
  ctx: CanvasRenderingContext2D,
  instructions: string,
  startX: number, startY: number,
  stepLength: number, turnAngle: number
) {
  const stack: TurtleState[] = []
  let state: TurtleState = { x: startX, y: startY, angle: -90 }

  ctx.beginPath()
  ctx.moveTo(state.x, state.y)

  for (const char of instructions) {
    switch (char) {
      case 'F': case 'G':
        state.x += Math.cos((state.angle * Math.PI) / 180) * stepLength
        state.y += Math.sin((state.angle * Math.PI) / 180) * stepLength
        ctx.lineTo(state.x, state.y)
        break
      case '+': state.angle += turnAngle; break
      case '-': state.angle -= turnAngle; break
      case '[': stack.push({ ...state }); break
      case ']':
        state = stack.pop()!
        ctx.moveTo(state.x, state.y)
        break
    }
  }
  ctx.stroke()
}

// Presets
const L_SYSTEM_PRESETS = {
  kochSnowflake: { axiom: 'F--F--F', rules: { F: 'F+F--F+F' }, angle: 60, iterations: 4 },
  sierpinski: { axiom: 'F-G-G', rules: { F: 'F-G+F+G-F', G: 'GG' }, angle: 120, iterations: 6 },
  dragonCurve: { axiom: 'FX', rules: { X: 'X+YF+', Y: '-FX-Y' }, angle: 90, iterations: 12 },
  plant: { axiom: 'X', rules: { X: 'F+[[X]-X]-F[-FX]+X', F: 'FF' }, angle: 25, iterations: 6 },
  hilbert: { axiom: 'A', rules: { A: '-BF+AFA+FB-', B: '+AF-BFB-FA+' }, angle: 90, iterations: 5 },
} as const

export function LSystemCanvas({ preset = 'plant' }: { preset?: keyof typeof L_SYSTEM_PRESETS }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    canvas.width = canvas.offsetWidth * 2
    canvas.height = canvas.offsetHeight * 2
    ctx.scale(2, 2)

    const { axiom, rules, angle, iterations } = L_SYSTEM_PRESETS[preset]
    const instructions = generateLSystem(axiom, rules, iterations)

    ctx.strokeStyle = '#4ade80'
    ctx.lineWidth = 0.5
    const step = preset === 'plant' ? 4 : preset === 'hilbert' ? canvas.offsetWidth / Math.pow(2, iterations) : 3
    const startX = preset === 'plant' ? canvas.offsetWidth / 2 : 20
    const startY = preset === 'plant' ? canvas.offsetHeight : canvas.offsetHeight - 20

    drawLSystem(ctx, instructions, startX, startY, step, angle)
  }, [preset])

  return <canvas ref={canvasRef} className="w-full h-full bg-gray-950" />
}
```

## Mathematical Curves

Parametric curves: Lissajous, polar roses, spirals, superformula.

```tsx
'use client'
import { useRef, useEffect } from 'react'

type CurveType = 'lissajous' | 'rose' | 'spiral' | 'superformula'

interface CurveParams {
  type: CurveType
  a?: number; b?: number   // Lissajous frequencies / rose petals
  m?: number; n1?: number; n2?: number; n3?: number  // Superformula
}

function getCurvePoint(t: number, params: CurveParams, scale: number): [number, number] {
  const { type, a = 3, b = 4, m = 6, n1 = 1, n2 = 1, n3 = 1 } = params

  switch (type) {
    case 'lissajous':
      return [Math.sin(a * t) * scale, Math.sin(b * t + Math.PI / 4) * scale]
    case 'rose': {
      const r = Math.cos(a * t) * scale
      return [r * Math.cos(t), r * Math.sin(t)]
    }
    case 'spiral': {
      const r = t * scale * 0.02
      return [r * Math.cos(t), r * Math.sin(t)]
    }
    case 'superformula': {
      const phi = t
      const r1 = Math.pow(Math.abs(Math.cos(m * phi / 4) / 1), n2)
      const r2 = Math.pow(Math.abs(Math.sin(m * phi / 4) / 1), n3)
      const r = Math.pow(r1 + r2, -1 / n1) * scale
      return [r * Math.cos(phi), r * Math.sin(phi)]
    }
  }
}

export function MathCurve({ type = 'lissajous', ...params }: CurveParams) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const tRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    canvas.width = canvas.offsetWidth * 2
    canvas.height = canvas.offsetHeight * 2
    ctx.scale(2, 2)
    const cx = canvas.offsetWidth / 2
    const cy = canvas.offsetHeight / 2
    const scale = Math.min(cx, cy) * 0.7

    const animate = () => {
      tRef.current += 0.03
      const maxT = tRef.current

      ctx.fillStyle = 'rgba(0, 0, 0, 0.03)'
      ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight)

      ctx.beginPath()
      for (let t = 0; t < Math.min(maxT, Math.PI * 20); t += 0.01) {
        const [x, y] = getCurvePoint(t, { type, ...params }, scale)
        if (t === 0) ctx.moveTo(cx + x, cy + y)
        else ctx.lineTo(cx + x, cy + y)
      }
      ctx.strokeStyle = `hsl(${(tRef.current * 20) % 360}, 70%, 60%)`
      ctx.lineWidth = 1.5
      ctx.stroke()

      animRef.current = requestAnimationFrame(animate)
    }
    animate()
    return () => cancelAnimationFrame(animRef.current)
  }, [type, params])

  return <canvas ref={canvasRef} className="w-full h-full bg-black" />
}
```

## Flow Fields

Perlin noise–driven particle system.

```tsx
'use client'
import { useRef, useEffect } from 'react'

// Simplified Perlin-like noise (use `simplex-noise` package for production)
function noise2D(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
  return (n - Math.floor(n)) * 2 - 1
}

function smoothNoise(x: number, y: number, scale: number): number {
  const sx = x / scale
  const sy = y / scale
  const ix = Math.floor(sx)
  const iy = Math.floor(sy)
  const fx = sx - ix
  const fy = sy - iy
  const a = noise2D(ix, iy)
  const b = noise2D(ix + 1, iy)
  const c = noise2D(ix, iy + 1)
  const d = noise2D(ix + 1, iy + 1)
  const ux = fx * fx * (3 - 2 * fx)
  const uy = fy * fy * (3 - 2 * fy)
  return a + ux * (b - a) + uy * (c - a) + ux * uy * (a - b - c + d)
}

interface Particle { x: number; y: number; vx: number; vy: number; life: number }

export function FlowField({ particleCount = 2000, noiseScale = 120 }) {
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
    const particles: Particle[] = Array.from({ length: particleCount }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: 0, vy: 0, life: Math.random() * 100,
    }))

    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, w, h)

    const animate = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.01)'
      ctx.fillRect(0, 0, w, h)
      time += 0.002

      particles.forEach(p => {
        const angle = smoothNoise(p.x + time * 50, p.y, noiseScale) * Math.PI * 4
        p.vx = Math.cos(angle) * 1.5
        p.vy = Math.sin(angle) * 1.5
        p.x += p.vx
        p.y += p.vy
        p.life--

        if (p.x < 0 || p.x > w || p.y < 0 || p.y > h || p.life <= 0) {
          p.x = Math.random() * w
          p.y = Math.random() * h
          p.life = 50 + Math.random() * 100
        }

        const hue = (smoothNoise(p.x, p.y, noiseScale * 2) + 1) * 180
        ctx.fillStyle = `hsla(${hue}, 70%, 60%, 0.6)`
        ctx.fillRect(p.x, p.y, 1.5, 1.5)
      })

      animRef.current = requestAnimationFrame(animate)
    }
    animate()
    return () => cancelAnimationFrame(animRef.current)
  }, [particleCount, noiseScale])

  return <canvas ref={canvasRef} className="w-full h-full" />
}
```

## Strange Attractors

Lorenz and Rössler systems rendered in Canvas.

```tsx
'use client'
import { useRef, useEffect } from 'react'

type AttractorType = 'lorenz' | 'rossler'

function step(type: AttractorType, x: number, y: number, z: number, dt: number): [number, number, number] {
  if (type === 'lorenz') {
    const sigma = 10, rho = 28, beta = 8 / 3
    return [
      x + (sigma * (y - x)) * dt,
      y + (x * (rho - z) - y) * dt,
      z + (x * y - beta * z) * dt,
    ]
  }
  // Rössler
  const a = 0.2, b = 0.2, c = 5.7
  return [
    x + (-y - z) * dt,
    y + (x + a * y) * dt,
    z + (b + z * (x - c)) * dt,
  ]
}

export function StrangeAttractor({ type = 'lorenz' }: { type?: AttractorType }) {
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

    let x = 0.1, y = 0, z = 0
    const dt = 0.005
    const points: [number, number, number][] = []
    const maxPoints = 8000
    let frame = 0

    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, w, h)

    const animate = () => {
      for (let i = 0; i < 20; i++) {
        ;[x, y, z] = step(type, x, y, z, dt)
        points.push([x, y, z])
        if (points.length > maxPoints) points.shift()
      }

      ctx.fillStyle = 'rgba(0, 0, 0, 0.02)'
      ctx.fillRect(0, 0, w, h)

      const rot = frame * 0.003
      const scale = type === 'lorenz' ? 6 : 15
      const cx = w / 2
      const cy = h / 2

      ctx.beginPath()
      points.forEach(([px, py, pz], i) => {
        const rx = px * Math.cos(rot) - pz * Math.sin(rot)
        const ry = py
        const sx = cx + rx * scale
        const sy = cy + ry * scale * (type === 'lorenz' ? -1 : 1)

        if (i === 0) ctx.moveTo(sx, sy)
        else ctx.lineTo(sx, sy)
      })
      ctx.strokeStyle = `hsla(${frame % 360}, 80%, 60%, 0.3)`
      ctx.lineWidth = 0.5
      ctx.stroke()

      frame++
      animRef.current = requestAnimationFrame(animate)
    }
    animate()
    return () => cancelAnimationFrame(animRef.current)
  }, [type])

  return <canvas ref={canvasRef} className="w-full h-full" />
}
```

## Reaction-Diffusion

Gray-Scott model for organic patterns.

```tsx
'use client'
import { useRef, useEffect } from 'react'

export function ReactionDiffusion({ width = 200, height = 200, feed = 0.055, kill = 0.062 }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    canvas.width = width
    canvas.height = height

    // Two chemical concentrations
    const gridA = new Float32Array(width * height).fill(1)
    const gridB = new Float32Array(width * height).fill(0)
    const nextA = new Float32Array(width * height)
    const nextB = new Float32Array(width * height)

    // Seed center with chemical B
    for (let y = height / 2 - 10; y < height / 2 + 10; y++) {
      for (let x = width / 2 - 10; x < width / 2 + 10; x++) {
        gridB[y * width + x] = 1
      }
    }

    const dA = 1.0, dB = 0.5
    const imageData = ctx.createImageData(width, height)

    function laplacian(grid: Float32Array, x: number, y: number): number {
      const i = y * width + x
      let sum = -grid[i]
      sum += grid[((y - 1 + height) % height) * width + x] * 0.2
      sum += grid[((y + 1) % height) * width + x] * 0.2
      sum += grid[y * width + (x - 1 + width) % width] * 0.2
      sum += grid[y * width + (x + 1) % width] * 0.2
      sum += grid[((y - 1 + height) % height) * width + (x - 1 + width) % width] * 0.05
      sum += grid[((y - 1 + height) % height) * width + (x + 1) % width] * 0.05
      sum += grid[((y + 1) % height) * width + (x - 1 + width) % width] * 0.05
      sum += grid[((y + 1) % height) * width + (x + 1) % width] * 0.05
      return sum
    }

    const animate = () => {
      for (let step = 0; step < 5; step++) {
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const i = y * width + x
            const a = gridA[i], b = gridB[i]
            const abb = a * b * b
            nextA[i] = a + (dA * laplacian(gridA, x, y) - abb + feed * (1 - a))
            nextB[i] = b + (dB * laplacian(gridB, x, y) + abb - (kill + feed) * b)
            nextA[i] = Math.max(0, Math.min(1, nextA[i]))
            nextB[i] = Math.max(0, Math.min(1, nextB[i]))
          }
        }
        gridA.set(nextA)
        gridB.set(nextB)
      }

      for (let i = 0; i < width * height; i++) {
        const val = Math.floor((1 - gridB[i]) * 255)
        const idx = i * 4
        imageData.data[idx] = val * 0.2
        imageData.data[idx + 1] = val * 0.5
        imageData.data[idx + 2] = val
        imageData.data[idx + 3] = 255
      }
      ctx.putImageData(imageData, 0, 0)
      animRef.current = requestAnimationFrame(animate)
    }
    animate()
    return () => cancelAnimationFrame(animRef.current)
  }, [width, height, feed, kill])

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ imageRendering: 'pixelated' }}
    />
  )
}
```

## Cellular Automata

Game of Life and elementary automata as visual patterns.

```tsx
'use client'
import { useRef, useEffect, useCallback } from 'react'

type AutomatonType = 'gameOfLife' | 'elementary'

export function CellularAutomaton({ type = 'gameOfLife', rule = 110, cellSize = 4 }: {
  type?: AutomatonType; rule?: number; cellSize?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  const stepGameOfLife = useCallback((grid: Uint8Array, cols: number, rows: number) => {
    const next = new Uint8Array(grid.length)
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        let neighbors = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue
            const nx = (x + dx + cols) % cols
            const ny = (y + dy + rows) % rows
            neighbors += grid[ny * cols + nx]
          }
        }
        const alive = grid[y * cols + x]
        next[y * cols + x] = alive
          ? (neighbors === 2 || neighbors === 3 ? 1 : 0)
          : (neighbors === 3 ? 1 : 0)
      }
    }
    return next
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const w = canvas.offsetWidth
    const h = canvas.offsetHeight
    canvas.width = w * 2
    canvas.height = h * 2
    ctx.scale(2, 2)

    const cols = Math.floor(w / cellSize)
    const rows = Math.floor(h / cellSize)

    if (type === 'gameOfLife') {
      let grid = new Uint8Array(cols * rows)
      // Random init
      for (let i = 0; i < grid.length; i++) grid[i] = Math.random() > 0.7 ? 1 : 0

      const animate = () => {
        ctx.fillStyle = '#000'
        ctx.fillRect(0, 0, w, h)

        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            if (grid[y * cols + x]) {
              ctx.fillStyle = `hsl(${(x + y) * 3}, 70%, 60%)`
              ctx.fillRect(x * cellSize, y * cellSize, cellSize - 1, cellSize - 1)
            }
          }
        }
        grid = stepGameOfLife(grid, cols, rows)
        animRef.current = requestAnimationFrame(animate)
      }
      animate()
    } else {
      // Elementary automaton (1D evolving downward)
      let row = new Uint8Array(cols)
      row[Math.floor(cols / 2)] = 1
      let currentRow = 0

      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, w, h)

      const animate = () => {
        if (currentRow >= rows) {
          ctx.drawImage(canvas, 0, cellSize * 2, w * 2, h * 2, 0, 0, w, h)
          currentRow = rows - 1
        }

        for (let x = 0; x < cols; x++) {
          if (row[x]) {
            ctx.fillStyle = `hsl(${currentRow * 2}, 70%, 60%)`
            ctx.fillRect(x * cellSize, currentRow * cellSize, cellSize - 1, cellSize - 1)
          }
        }

        const newRow = new Uint8Array(cols)
        for (let x = 0; x < cols; x++) {
          const left = row[(x - 1 + cols) % cols]
          const center = row[x]
          const right = row[(x + 1) % cols]
          const pattern = (left << 2) | (center << 1) | right
          newRow[x] = (rule >> pattern) & 1
        }
        row = newRow
        currentRow++
        animRef.current = requestAnimationFrame(animate)
      }
      animate()
    }

    return () => cancelAnimationFrame(animRef.current)
  }, [type, rule, cellSize, stepGameOfLife])

  return <canvas ref={canvasRef} className="w-full h-full" />
}
```

## Noise Patterns

Perlin/Simplex noise for generative textures. For production use the `simplex-noise` package.

```tsx
'use client'
import { useRef, useEffect } from 'react'

// Install: npm install simplex-noise
import { createNoise3D } from 'simplex-noise'

export function NoiseTexture({ scale = 100, speed = 0.5, colorMode = 'gradient' }: {
  scale?: number; speed?: number; colorMode?: 'gradient' | 'contour' | 'domain-warp'
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const w = 300, h = 300
    canvas.width = w
    canvas.height = h

    const noise3D = createNoise3D()
    const imageData = ctx.createImageData(w, h)
    let t = 0

    const animate = () => {
      t += speed * 0.01

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let val: number

          if (colorMode === 'domain-warp') {
            const warpX = noise3D(x / scale, y / scale, t) * 50
            const warpY = noise3D(x / scale + 100, y / scale + 100, t) * 50
            val = (noise3D((x + warpX) / scale, (y + warpY) / scale, t) + 1) / 2
          } else {
            val = (noise3D(x / scale, y / scale, t) + 1) / 2
          }

          const idx = (y * w + x) * 4
          if (colorMode === 'contour') {
            const line = Math.abs(Math.sin(val * Math.PI * 8)) > 0.95 ? 255 : 0
            imageData.data[idx] = line
            imageData.data[idx + 1] = line
            imageData.data[idx + 2] = line
          } else {
            const hue = val * 360
            // HSL to RGB approximate
            const c = 0.6, m = 0.2
            imageData.data[idx] = (val * 0.3 + 0.1) * 255
            imageData.data[idx + 1] = val * 200
            imageData.data[idx + 2] = (1 - val * 0.5) * 255
          }
          imageData.data[idx + 3] = 255
        }
      }
      ctx.putImageData(imageData, 0, 0)
      animRef.current = requestAnimationFrame(animate)
    }
    animate()
    return () => cancelAnimationFrame(animRef.current)
  }, [scale, speed, colorMode])

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ imageRendering: 'pixelated' }}
    />
  )
}
```

## Sacred Geometry

Golden spiral, Flower of Life, and Metatron's Cube.

```tsx
'use client'
import { useRef, useEffect } from 'react'

type SacredType = 'golden-spiral' | 'flower-of-life' | 'metatron'

export function SacredGeometry({ type = 'flower-of-life' }: { type?: SacredType }) {
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
    const cx = w / 2, cy = h / 2

    let progress = 0

    const drawFlowerOfLife = (p: number) => {
      ctx.clearRect(0, 0, w, h)
      ctx.strokeStyle = '#c084fc'
      ctx.lineWidth = 1

      const r = Math.min(w, h) * 0.12
      const rings = [
        [[0, 0]],
        Array.from({ length: 6 }, (_, i) => {
          const a = (i * 60 * Math.PI) / 180
          return [Math.cos(a) * r, Math.sin(a) * r]
        }),
        Array.from({ length: 6 }, (_, i) => {
          const a = ((i * 60 + 30) * Math.PI) / 180
          return [Math.cos(a) * r * Math.sqrt(3), Math.sin(a) * r * Math.sqrt(3)]
        }),
      ]

      const allCenters = rings.flat()
      const visibleCount = Math.floor(p * allCenters.length)

      allCenters.slice(0, visibleCount).forEach(([ox, oy], i) => {
        ctx.globalAlpha = Math.min(1, (p * allCenters.length - i) * 0.5)
        ctx.beginPath()
        ctx.arc(cx + ox, cy + oy, r, 0, Math.PI * 2)
        ctx.stroke()
      })
      ctx.globalAlpha = 1
    }

    const drawGoldenSpiral = (p: number) => {
      ctx.clearRect(0, 0, w, h)
      const phi = (1 + Math.sqrt(5)) / 2
      const maxAngle = p * Math.PI * 10

      ctx.beginPath()
      ctx.strokeStyle = '#fbbf24'
      ctx.lineWidth = 2

      for (let a = 0; a < maxAngle; a += 0.02) {
        const r = Math.pow(phi, (a * 2) / Math.PI) * 2
        const x = cx + r * Math.cos(a)
        const y = cy + r * Math.sin(a)
        if (a === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
        if (r > Math.max(w, h)) break
      }
      ctx.stroke()

      // Draw golden rectangles
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.3)'
      let size = 2
      let rx = cx, ry = cy
      for (let i = 0; i < Math.floor(p * 12); i++) {
        ctx.strokeRect(rx - size / 2, ry - size / 2, size, size)
        size *= phi
      }
    }

    const drawMetatron = (p: number) => {
      ctx.clearRect(0, 0, w, h)
      const r = Math.min(w, h) * 0.3

      // 13 circles of Metatron's Cube
      const centers: [number, number][] = [[0, 0]]
      for (let ring = 1; ring <= 2; ring++) {
        const count = 6
        const dist = r * ring * 0.5
        for (let i = 0; i < count; i++) {
          const a = ((i * 60 + (ring === 2 ? 30 : 0)) * Math.PI) / 180
          centers.push([Math.cos(a) * dist, Math.sin(a) * dist])
        }
      }

      const circleCount = Math.floor(p * centers.length)

      // Draw connecting lines
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.3)'
      ctx.lineWidth = 0.5
      const lineProgress = Math.max(0, (p - 0.3) / 0.7)
      for (let i = 0; i < centers.length; i++) {
        for (let j = i + 1; j < centers.length; j++) {
          if (Math.random() < lineProgress) {
            ctx.beginPath()
            ctx.moveTo(cx + centers[i][0], cy + centers[i][1])
            ctx.lineTo(cx + centers[j][0], cy + centers[j][1])
            ctx.stroke()
          }
        }
      }

      // Draw circles
      ctx.strokeStyle = '#60a5fa'
      ctx.lineWidth = 1.5
      centers.slice(0, circleCount).forEach(([ox, oy]) => {
        ctx.beginPath()
        ctx.arc(cx + ox, cy + oy, r * 0.25, 0, Math.PI * 2)
        ctx.stroke()
      })
    }

    const animate = () => {
      progress = Math.min(1, progress + 0.005)

      switch (type) {
        case 'flower-of-life': drawFlowerOfLife(progress); break
        case 'golden-spiral': drawGoldenSpiral(progress); break
        case 'metatron': drawMetatron(progress); break
      }

      if (progress < 1) animRef.current = requestAnimationFrame(animate)
    }
    animate()
    return () => cancelAnimationFrame(animRef.current)
  }, [type])

  return <canvas ref={canvasRef} className="w-full h-full bg-gray-950" />
}
```

## Performance Tips

- **Canvas resolution**: Use `devicePixelRatio` for retina, but cap at 2x for performance
- **Particle count**: Keep under 5000 for 60fps, use web workers for heavy computation
- **RequestAnimationFrame**: Always clean up with `cancelAnimationFrame` on unmount
- **OffscreenCanvas**: Use for heavy rendering in web workers
- **Float32Array**: Use typed arrays for grid-based simulations (reaction-diffusion, automata)
- **Batch draw calls**: Minimize `beginPath/stroke` calls per frame
