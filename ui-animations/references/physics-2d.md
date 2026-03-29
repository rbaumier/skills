# Physics 2D - Matter.js

Motor de física 2D para experiencias interactivas estilo Awwwards.

## Table of Contents
1. [Setup](#setup)
2. [React Integration](#react-integration)
3. [Bodies (Cuerpos)](#bodies-cuerpos)
4. [World & Engine](#world--engine)
5. [Constraints (Restricciones)](#constraints-restricciones)
6. [Mouse Interaction](#mouse-interaction)
7. [Collision Events](#collision-events)
8. [Scroll Physics](#scroll-physics)
9. [Creative Patterns](#creative-patterns)

## Setup

### Instalación

```bash
npm install matter-js
npm install --save-dev @types/matter-js
```

### Importación

```tsx
import Matter from 'matter-js'

// O destructurar
const { Engine, Render, Runner, Bodies, World, Mouse, MouseConstraint } = Matter
```

## React Integration

### Setup Básico con Hooks

```tsx
'use client'

import { useRef, useEffect } from 'react'
import Matter from 'matter-js'

export function PhysicsScene() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const { Engine, Render, Runner, Bodies, World, Composite } = Matter

    // Crear engine
    const engine = Engine.create()
    const world = engine.world

    // Configurar gravedad
    engine.gravity.y = 1
    engine.gravity.x = 0

    // Crear renderer
    const render = Render.create({
      element: containerRef.current!,
      canvas: canvasRef.current!,
      engine: engine,
      options: {
        width: 800,
        height: 600,
        wireframes: false, // Renderizado sólido
        background: '#0a0a0a',
      },
    })

    // Crear suelo y paredes
    const ground = Bodies.rectangle(400, 590, 800, 20, {
      isStatic: true,
      render: { fillStyle: '#333' },
    })

    const leftWall = Bodies.rectangle(10, 300, 20, 600, {
      isStatic: true,
      render: { fillStyle: '#333' },
    })

    const rightWall = Bodies.rectangle(790, 300, 20, 600, {
      isStatic: true,
      render: { fillStyle: '#333' },
    })

    // Crear cuerpos dinámicos
    const boxes = Array.from({ length: 10 }, (_, i) =>
      Bodies.rectangle(100 + i * 60, 100, 50, 50, {
        render: {
          fillStyle: `hsl(${i * 36}, 70%, 60%)`,
        },
      })
    )

    // Agregar al mundo
    Composite.add(world, [ground, leftWall, rightWall, ...boxes])

    // Ejecutar
    const runner = Runner.create()
    Runner.run(runner, engine)
    Render.run(render)

    // Cleanup
    return () => {
      Render.stop(render)
      Runner.stop(runner)
      World.clear(world, false)
      Engine.clear(engine)
      render.canvas.remove()
    }
  }, [])

  return (
    <div ref={containerRef}>
      <canvas ref={canvasRef} />
    </div>
  )
}
```

### Hook Reutilizable: useMatter

```tsx
'use client'

import { useRef, useEffect, useCallback } from 'react'
import Matter from 'matter-js'

interface UseMatterOptions {
  width?: number
  height?: number
  gravity?: { x: number; y: number }
  wireframes?: boolean
  background?: string
}

export function useMatter(options: UseMatterOptions = {}) {
  const {
    width = 800,
    height = 600,
    gravity = { x: 0, y: 1 },
    wireframes = false,
    background = '#0a0a0a',
  } = options

  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<Matter.Engine | null>(null)
  const renderRef = useRef<Matter.Render | null>(null)
  const runnerRef = useRef<Matter.Runner | null>(null)

  useEffect(() => {
    const { Engine, Render, Runner } = Matter

    engineRef.current = Engine.create()
    engineRef.current.gravity.x = gravity.x
    engineRef.current.gravity.y = gravity.y

    renderRef.current = Render.create({
      element: containerRef.current!,
      canvas: canvasRef.current!,
      engine: engineRef.current,
      options: { width, height, wireframes, background },
    })

    runnerRef.current = Runner.create()
    Runner.run(runnerRef.current, engineRef.current)
    Render.run(renderRef.current)

    return () => {
      if (renderRef.current) Render.stop(renderRef.current)
      if (runnerRef.current) Runner.stop(runnerRef.current)
      if (engineRef.current) {
        Matter.World.clear(engineRef.current.world, false)
        Engine.clear(engineRef.current)
      }
    }
  }, [width, height, gravity.x, gravity.y, wireframes, background])

  const addBody = useCallback((body: Matter.Body) => {
    if (engineRef.current) {
      Matter.Composite.add(engineRef.current.world, body)
    }
  }, [])

  const removeBody = useCallback((body: Matter.Body) => {
    if (engineRef.current) {
      Matter.Composite.remove(engineRef.current.world, body)
    }
  }, [])

  const addBodies = useCallback((bodies: Matter.Body[]) => {
    if (engineRef.current) {
      Matter.Composite.add(engineRef.current.world, bodies)
    }
  }, [])

  return {
    containerRef,
    canvasRef,
    engine: engineRef,
    addBody,
    removeBody,
    addBodies,
    Matter,
  }
}
```

## Bodies (Cuerpos)

### Formas Básicas

```tsx
const { Bodies } = Matter

// Rectángulo
const box = Bodies.rectangle(x, y, width, height, {
  render: { fillStyle: '#ff6b6b' },
})

// Círculo
const ball = Bodies.circle(x, y, radius, {
  restitution: 0.8, // Rebote
  friction: 0.1,
  render: { fillStyle: '#4ecdc4' },
})

// Polígono regular
const hexagon = Bodies.polygon(x, y, 6, radius, {
  render: { fillStyle: '#45b7d1' },
})

// Trapecio
const trapezoid = Bodies.trapezoid(x, y, width, height, slope, {
  render: { fillStyle: '#96ceb4' },
})
```

### Cuerpos desde Vértices (Custom Shapes)

```tsx
// Forma L (Tetris)
const lShape = Bodies.fromVertices(400, 300, [
  { x: 0, y: 0 },
  { x: 30, y: 0 },
  { x: 30, y: 60 },
  { x: 60, y: 60 },
  { x: 60, y: 90 },
  { x: 0, y: 90 },
], {
  render: { fillStyle: '#ff6b6b' },
})

// Forma T
const tShape = Bodies.fromVertices(400, 300, [
  { x: 0, y: 0 },
  { x: 90, y: 0 },
  { x: 90, y: 30 },
  { x: 60, y: 30 },
  { x: 60, y: 60 },
  { x: 30, y: 60 },
  { x: 30, y: 30 },
  { x: 0, y: 30 },
], {
  render: { fillStyle: '#4ecdc4' },
})
```

### Propiedades de Bodies

```tsx
const body = Bodies.circle(400, 300, 50, {
  // Física
  mass: 10,                    // Masa
  density: 0.001,              // Densidad
  friction: 0.1,               // Fricción (0-1)
  frictionAir: 0.01,           // Resistencia del aire
  frictionStatic: 0.5,         // Fricción estática
  restitution: 0.8,            // Rebote (0-1)

  // Estado
  isStatic: false,             // Estático (no se mueve)
  isSensor: false,             // Solo detecta colisiones, no físicas

  // Render
  render: {
    visible: true,
    fillStyle: '#ff6b6b',
    strokeStyle: '#fff',
    lineWidth: 2,
    opacity: 1,
  },

  // Identificación
  label: 'ball',

  // Colisiones
  collisionFilter: {
    category: 0x0001,
    mask: 0xFFFFFFFF,
    group: 0,
  },
})
```

### Manipular Bodies

```tsx
const { Body } = Matter

// Aplicar fuerza
Body.applyForce(body, body.position, { x: 0.05, y: -0.1 })

// Establecer velocidad
Body.setVelocity(body, { x: 10, y: -5 })

// Establecer velocidad angular
Body.setAngularVelocity(body, 0.1)

// Mover a posición
Body.setPosition(body, { x: 400, y: 300 })

// Rotar
Body.setAngle(body, Math.PI / 4)
Body.rotate(body, 0.1)

// Escalar
Body.scale(body, 1.5, 1.5)
```

## World & Engine

### Configuración del Engine

```tsx
const engine = Engine.create({
  gravity: {
    x: 0,
    y: 1,
    scale: 0.001,
  },
  timing: {
    timeScale: 1, // Slow motion: < 1, Fast forward: > 1
  },
})

// Cambiar gravedad dinámicamente
engine.gravity.y = 0      // Sin gravedad
engine.gravity.y = -1     // Gravedad invertida
engine.gravity.x = 0.5    // Gravedad lateral
```

### Bounds del World

```tsx
// Crear contenedor con paredes
function createBounds(width: number, height: number, thickness = 50) {
  return [
    // Suelo
    Bodies.rectangle(width / 2, height + thickness / 2, width, thickness, {
      isStatic: true,
      label: 'ground',
    }),
    // Techo
    Bodies.rectangle(width / 2, -thickness / 2, width, thickness, {
      isStatic: true,
      label: 'ceiling',
    }),
    // Pared izquierda
    Bodies.rectangle(-thickness / 2, height / 2, thickness, height, {
      isStatic: true,
      label: 'leftWall',
    }),
    // Pared derecha
    Bodies.rectangle(width + thickness / 2, height / 2, thickness, height, {
      isStatic: true,
      label: 'rightWall',
    }),
  ]
}
```

## Constraints (Restricciones)

### Conectar Bodies

```tsx
const { Constraint } = Matter

// Constraint punto a punto
const rope = Constraint.create({
  bodyA: ball1,
  bodyB: ball2,
  length: 100,
  stiffness: 0.9,
  render: {
    strokeStyle: '#fff',
    lineWidth: 2,
  },
})

// Constraint a punto fijo
const pendulum = Constraint.create({
  pointA: { x: 400, y: 0 },  // Punto fijo en el mundo
  bodyB: ball,
  length: 200,
  stiffness: 1,
})

// Spring (resorte)
const spring = Constraint.create({
  bodyA: ball1,
  bodyB: ball2,
  stiffness: 0.01,  // Más bajo = más elástico
  damping: 0.1,
})

Composite.add(world, [rope, pendulum, spring])
```

### Cadena de Bodies

```tsx
function createChain(x: number, y: number, links: number, linkSize: number) {
  const bodies: Matter.Body[] = []
  const constraints: Matter.Constraint[] = []

  // Punto de anclaje
  const anchor = Bodies.circle(x, y, 5, { isStatic: true })
  bodies.push(anchor)

  let prevBody = anchor
  for (let i = 0; i < links; i++) {
    const link = Bodies.rectangle(
      x,
      y + (i + 1) * linkSize,
      linkSize * 0.8,
      linkSize * 0.3,
      { render: { fillStyle: '#4ecdc4' } }
    )
    bodies.push(link)

    constraints.push(
      Constraint.create({
        bodyA: prevBody,
        bodyB: link,
        length: linkSize * 0.5,
        stiffness: 0.9,
      })
    )

    prevBody = link
  }

  return { bodies, constraints }
}
```

## Mouse Interaction

### Mouse Constraint

```tsx
'use client'

import { useEffect } from 'react'
import Matter from 'matter-js'

export function DraggablePhysics() {
  useEffect(() => {
    const { Engine, Render, Runner, Bodies, Composite, Mouse, MouseConstraint } = Matter

    const engine = Engine.create()
    const render = Render.create({
      element: document.body,
      engine: engine,
      options: { width: 800, height: 600, wireframes: false },
    })

    // Crear bodies arrastrables
    const boxes = Array.from({ length: 5 }, (_, i) =>
      Bodies.rectangle(200 + i * 100, 200, 60, 60, {
        render: { fillStyle: `hsl(${i * 60}, 70%, 60%)` },
      })
    )

    const ground = Bodies.rectangle(400, 580, 800, 40, { isStatic: true })

    // Configurar mouse
    const mouse = Mouse.create(render.canvas)
    const mouseConstraint = MouseConstraint.create(engine, {
      mouse: mouse,
      constraint: {
        stiffness: 0.2,
        render: { visible: false },
      },
    })

    // Sincronizar mouse con scroll
    render.mouse = mouse

    Composite.add(engine.world, [...boxes, ground, mouseConstraint])

    Runner.run(Runner.create(), engine)
    Render.run(render)
  }, [])

  return null
}
```

### Hover Detection

```tsx
import Matter from 'matter-js'

const { Query } = Matter

function getBodyAtPosition(engine: Matter.Engine, x: number, y: number) {
  const bodies = Matter.Composite.allBodies(engine.world)
  const point = { x, y }

  // Encontrar body bajo el punto
  const found = Query.point(bodies, point)
  return found[0] || null
}

// Uso en event listener
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

  const body = getBodyAtPosition(engine, x, y)
  if (body) {
    // Hover sobre body
    body.render.fillStyle = '#ff0000'
  }
})
```

## Collision Events

### Detectar Colisiones

```tsx
import Matter from 'matter-js'

const { Events } = Matter

// Collision start
Events.on(engine, 'collisionStart', (event) => {
  event.pairs.forEach((pair) => {
    const { bodyA, bodyB } = pair

    // Verificar labels
    if (bodyA.label === 'ball' && bodyB.label === 'ground') {
      console.log('Ball hit ground!')
      // Reproducir sonido, cambiar color, etc.
      bodyA.render.fillStyle = '#ff0000'
    }
  })
})

// Collision active (mientras colisionan)
Events.on(engine, 'collisionActive', (event) => {
  // ...
})

// Collision end
Events.on(engine, 'collisionEnd', (event) => {
  event.pairs.forEach((pair) => {
    pair.bodyA.render.fillStyle = '#4ecdc4'
    pair.bodyB.render.fillStyle = '#4ecdc4'
  })
})
```

### Colisiones con Audio

```tsx
'use client'

import { useEffect, useRef } from 'react'
import Matter from 'matter-js'
import * as Tone from 'tone'

export function PhysicsWithSound() {
  const synthRef = useRef<Tone.MembraneSynth | null>(null)

  useEffect(() => {
    synthRef.current = new Tone.MembraneSynth().toDestination()
    synthRef.current.volume.value = -10

    const engine = Matter.Engine.create()
    // ... setup render, bodies

    Matter.Events.on(engine, 'collisionStart', async (event) => {
      await Tone.start()

      event.pairs.forEach((pair) => {
        // Calcular intensidad del impacto
        const velocity = Math.sqrt(
          Math.pow(pair.bodyA.velocity.x - pair.bodyB.velocity.x, 2) +
          Math.pow(pair.bodyA.velocity.y - pair.bodyB.velocity.y, 2)
        )

        if (velocity > 2) {
          // Mapear velocidad a nota
          const note = Math.min(Math.floor(velocity * 10) + 30, 80)
          const freq = Tone.Frequency(note, 'midi').toFrequency()
          synthRef.current?.triggerAttackRelease(freq, '16n')
        }
      })
    })

    return () => synthRef.current?.dispose()
  }, [])

  return null
}
```

## Scroll Physics

### Gravedad Reactiva al Scroll

```tsx
'use client'

import { useEffect, useRef } from 'react'
import Matter from 'matter-js'
import { gsap, ScrollTrigger } from '@/lib/gsap'

export function ScrollGravity() {
  const engineRef = useRef<Matter.Engine | null>(null)

  useEffect(() => {
    engineRef.current = Matter.Engine.create()
    // ... setup

    // Cambiar gravedad con scroll
    ScrollTrigger.create({
      trigger: 'body',
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        if (engineRef.current) {
          // Gravedad basada en dirección del scroll
          const direction = self.direction
          engineRef.current.gravity.y = direction > 0 ? 1 : -1
        }
      },
    })

    // O gravedad basada en posición del scroll
    ScrollTrigger.create({
      trigger: 'body',
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        if (engineRef.current) {
          // Rotar gravedad 360° durante el scroll
          const angle = self.progress * Math.PI * 2
          engineRef.current.gravity.x = Math.sin(angle)
          engineRef.current.gravity.y = Math.cos(angle)
        }
      },
    })
  }, [])

  return null
}
```

### Spawn Bodies on Scroll

```tsx
'use client'

import { useEffect, useRef } from 'react'
import Matter from 'matter-js'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

export function ScrollSpawnBodies() {
  const engineRef = useRef<Matter.Engine | null>(null)
  const lastSpawnRef = useRef(0)

  useEffect(() => {
    // ... setup engine

    ScrollTrigger.create({
      trigger: 'body',
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        // Spawn body cada 5% de scroll
        const spawnPoint = Math.floor(self.progress * 20)

        if (spawnPoint > lastSpawnRef.current) {
          lastSpawnRef.current = spawnPoint

          const body = Matter.Bodies.circle(
            Math.random() * 600 + 100,
            50,
            20 + Math.random() * 30,
            {
              restitution: 0.7,
              render: {
                fillStyle: `hsl(${Math.random() * 360}, 70%, 60%)`,
              },
            }
          )

          Matter.Composite.add(engineRef.current!.world, body)
        }
      },
    })
  }, [])

  return null
}
```

## Creative Patterns

### Particle Explosion on Click

```tsx
'use client'

import { useEffect, useRef } from 'react'
import Matter from 'matter-js'

export function ClickExplosion() {
  const engineRef = useRef<Matter.Engine | null>(null)
  const renderRef = useRef<Matter.Render | null>(null)

  useEffect(() => {
    const engine = Matter.Engine.create()
    engineRef.current = engine

    const render = Matter.Render.create({
      element: document.getElementById('physics-container')!,
      engine: engine,
      options: { width: 800, height: 600, wireframes: false, background: '#0a0a0a' },
    })
    renderRef.current = render

    // Ground
    const ground = Matter.Bodies.rectangle(400, 590, 800, 20, { isStatic: true })
    Matter.Composite.add(engine.world, ground)

    // Click handler
    const handleClick = (e: MouseEvent) => {
      const rect = render.canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      // Crear explosión de partículas
      const particles = Array.from({ length: 20 }, () => {
        const angle = Math.random() * Math.PI * 2
        const speed = 5 + Math.random() * 10

        const particle = Matter.Bodies.circle(x, y, 5 + Math.random() * 10, {
          restitution: 0.6,
          friction: 0.1,
          render: {
            fillStyle: `hsl(${Math.random() * 60 + 10}, 100%, 60%)`,
          },
        })

        Matter.Body.setVelocity(particle, {
          x: Math.cos(angle) * speed,
          y: Math.sin(angle) * speed,
        })

        return particle
      })

      Matter.Composite.add(engine.world, particles)

      // Remover después de 3 segundos
      setTimeout(() => {
        particles.forEach((p) => Matter.Composite.remove(engine.world, p))
      }, 3000)
    }

    render.canvas.addEventListener('click', handleClick)

    Matter.Runner.run(Matter.Runner.create(), engine)
    Matter.Render.run(render)

    return () => {
      render.canvas.removeEventListener('click', handleClick)
    }
  }, [])

  return <div id="physics-container" />
}
```

### Soft Body (Blob)

```tsx
function createSoftBody(x: number, y: number, columns: number, rows: number, spacing: number) {
  const particles: Matter.Body[] = []
  const constraints: Matter.Constraint[] = []

  // Crear partículas en grid
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const particle = Matter.Bodies.circle(
        x + col * spacing,
        y + row * spacing,
        spacing * 0.3,
        {
          render: { fillStyle: '#4ecdc4' },
        }
      )
      particles.push(particle)
    }
  }

  // Conectar partículas adyacentes
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const index = row * columns + col

      // Horizontal
      if (col < columns - 1) {
        constraints.push(
          Matter.Constraint.create({
            bodyA: particles[index],
            bodyB: particles[index + 1],
            stiffness: 0.1,
            render: { visible: false },
          })
        )
      }

      // Vertical
      if (row < rows - 1) {
        constraints.push(
          Matter.Constraint.create({
            bodyA: particles[index],
            bodyB: particles[index + columns],
            stiffness: 0.1,
            render: { visible: false },
          })
        )
      }

      // Diagonal
      if (col < columns - 1 && row < rows - 1) {
        constraints.push(
          Matter.Constraint.create({
            bodyA: particles[index],
            bodyB: particles[index + columns + 1],
            stiffness: 0.05,
            render: { visible: false },
          })
        )
      }
    }
  }

  return { particles, constraints }
}
```

### Newton's Cradle

```tsx
function createNewtonsCradle(x: number, y: number, ballCount: number, ballRadius: number) {
  const balls: Matter.Body[] = []
  const constraints: Matter.Constraint[] = []

  for (let i = 0; i < ballCount; i++) {
    const ball = Matter.Bodies.circle(
      x + i * ballRadius * 2.1,
      y + 200,
      ballRadius,
      {
        restitution: 1,
        friction: 0,
        frictionAir: 0,
        render: { fillStyle: '#c0c0c0' },
      }
    )

    const constraint = Matter.Constraint.create({
      pointA: { x: x + i * ballRadius * 2.1, y },
      bodyB: ball,
      length: 200,
      stiffness: 1,
      render: { strokeStyle: '#666' },
    })

    balls.push(ball)
    constraints.push(constraint)
  }

  // Impulso inicial al primer ball
  Matter.Body.setPosition(balls[0], {
    x: balls[0].position.x - 100,
    y: balls[0].position.y - 50,
  })

  return { balls, constraints }
}
```

## Recursos

- [Matter.js](https://brm.io/matter-js/)
- [Matter.js Docs](https://brm.io/matter-js/docs/)
- [Matter.js GitHub](https://github.com/liabru/matter-js)
- [Matter.js Demos](https://brm.io/matter-js/demo/)
