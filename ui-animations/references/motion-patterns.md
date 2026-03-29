# Motion (Framer Motion) Patterns

React animation patterns using Motion library (formerly Framer Motion).

## Table of Contents
1. [Setup](#setup)
2. [Basic Animations](#basic-animations)
3. [Scroll Animations](#scroll-animations)
4. [Page Transitions](#page-transitions)
5. [Text Animations](#text-animations)
6. [Gestures](#gestures)
7. [Layout Animations](#layout-animations)
8. [Exit Animations](#exit-animations)

## Setup

```bash
npm install motion
```

```jsx
import { motion, useScroll, useTransform, AnimatePresence } from 'motion/react'
```

## Basic Animations

### Simple Animation

```jsx
<motion.div
  initial={{ opacity: 0, y: 50 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
>
  Content
</motion.div>
```

### Variants Pattern

```jsx
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' }
  }
}

function List({ items }) {
  return (
    <motion.ul
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {items.map(item => (
        <motion.li key={item.id} variants={itemVariants}>
          {item.name}
        </motion.li>
      ))}
    </motion.ul>
  )
}
```

### While In View

```jsx
<motion.div
  initial={{ opacity: 0, y: 50 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, margin: '-100px' }}
  transition={{ duration: 0.6 }}
>
  Animates when scrolled into view
</motion.div>
```

## Scroll Animations

### Scroll Progress

```jsx
import { motion, useScroll, useTransform } from 'motion/react'

function ScrollProgress() {
  const { scrollYProgress } = useScroll()

  return (
    <motion.div
      className="progress-bar"
      style={{ scaleX: scrollYProgress }}
    />
  )
}
```

### Parallax Effect

```jsx
function ParallaxHero() {
  const { scrollY } = useScroll()
  const y = useTransform(scrollY, [0, 500], [0, 150])
  const opacity = useTransform(scrollY, [0, 300], [1, 0])

  return (
    <div className="hero">
      <motion.div className="hero-bg" style={{ y }} />
      <motion.h1 style={{ opacity }}>Hero Title</motion.h1>
    </div>
  )
}
```

### Element-Based Scroll

```jsx
function ScrollSection() {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start']
  })

  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.8, 1, 0.8])
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0])

  return (
    <motion.section ref={ref} style={{ scale, opacity }}>
      Content
    </motion.section>
  )
}
```

### Scroll Velocity

```jsx
import { useScroll, useVelocity, useTransform, motion } from 'motion/react'

function VelocityText() {
  const { scrollY } = useScroll()
  const scrollVelocity = useVelocity(scrollY)
  const skewY = useTransform(scrollVelocity, [-1000, 0, 1000], [-3, 0, 3])

  return (
    <motion.h1 style={{ skewY }}>
      Velocity Skew
    </motion.h1>
  )
}
```

## Page Transitions

### Basic Page Transition

```jsx
// layout.jsx
import { AnimatePresence } from 'motion/react'

function Layout({ children }) {
  return (
    <AnimatePresence mode="wait">
      {children}
    </AnimatePresence>
  )
}

// page.jsx
const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
}

function Page() {
  return (
    <motion.main
      key={pathname}
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.4 }}
    >
      Content
    </motion.main>
  )
}
```

### Overlay Transition

```jsx
const overlayVariants = {
  initial: { scaleY: 0 },
  animate: {
    scaleY: 1,
    transition: { duration: 0.5, ease: [0.76, 0, 0.24, 1] }
  },
  exit: {
    scaleY: 0,
    transition: { duration: 0.5, ease: [0.76, 0, 0.24, 1], delay: 0.2 }
  }
}

function PageTransition({ children }) {
  return (
    <>
      <motion.div
        className="transition-overlay"
        variants={overlayVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        style={{ transformOrigin: 'bottom' }}
      />
      {children}
    </>
  )
}
```

### Shared Layout Animation

```jsx
function CardGrid({ items, selectedId, setSelectedId }) {
  return (
    <>
      <div className="grid">
        {items.map(item => (
          <motion.div
            key={item.id}
            layoutId={item.id}
            onClick={() => setSelectedId(item.id)}
          >
            <motion.h2 layoutId={`title-${item.id}`}>{item.title}</motion.h2>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {selectedId && (
          <motion.div
            layoutId={selectedId}
            className="modal"
            onClick={() => setSelectedId(null)}
          >
            <motion.h2 layoutId={`title-${selectedId}`}>
              {items.find(i => i.id === selectedId).title}
            </motion.h2>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
```

## Text Animations

### Character-by-Character Reveal

```jsx
function AnimatedText({ text }) {
  const chars = text.split('')

  const container = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.02 }
    }
  }

  const child = {
    hidden: { opacity: 0, y: 50, rotateX: -90 },
    visible: {
      opacity: 1,
      y: 0,
      rotateX: 0,
      transition: { type: 'spring', damping: 12 }
    }
  }

  return (
    <motion.span
      variants={container}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      style={{ display: 'inline-block' }}
    >
      {chars.map((char, i) => (
        <motion.span
          key={i}
          variants={child}
          style={{ display: 'inline-block' }}
        >
          {char === ' ' ? '\u00A0' : char}
        </motion.span>
      ))}
    </motion.span>
  )
}
```

### Word-by-Word Animation

```jsx
function AnimatedWords({ text }) {
  const words = text.split(' ')

  return (
    <motion.p
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      variants={{
        visible: { transition: { staggerChildren: 0.05 } }
      }}
    >
      {words.map((word, i) => (
        <motion.span
          key={i}
          className="word"
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: { opacity: 1, y: 0 }
          }}
        >
          {word}{' '}
        </motion.span>
      ))}
    </motion.p>
  )
}
```

### Line Mask Reveal

```jsx
function MaskReveal({ children }) {
  return (
    <div style={{ overflow: 'hidden' }}>
      <motion.div
        initial={{ y: '100%' }}
        whileInView={{ y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
      >
        {children}
      </motion.div>
    </div>
  )
}
```

## Gestures

### Magnetic Button

```jsx
function MagneticButton({ children }) {
  const ref = useRef(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })

  const handleMouse = (e) => {
    const { clientX, clientY } = e
    const { left, top, width, height } = ref.current.getBoundingClientRect()
    const x = (clientX - left - width / 2) * 0.3
    const y = (clientY - top - height / 2) * 0.3
    setPosition({ x, y })
  }

  const reset = () => setPosition({ x: 0, y: 0 })

  return (
    <motion.button
      ref={ref}
      onMouseMove={handleMouse}
      onMouseLeave={reset}
      animate={position}
      transition={{ type: 'spring', stiffness: 150, damping: 15 }}
    >
      {children}
    </motion.button>
  )
}
```

### Hover Effects

```jsx
function HoverCard() {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
    >
      <motion.img
        whileHover={{ scale: 1.1 }}
        transition={{ duration: 0.4 }}
      />
    </motion.div>
  )
}
```

### Drag

```jsx
function DraggableCard() {
  return (
    <motion.div
      drag
      dragConstraints={{ left: -100, right: 100, top: -100, bottom: 100 }}
      dragElastic={0.1}
      whileDrag={{ scale: 1.1, cursor: 'grabbing' }}
    >
      Drag me
    </motion.div>
  )
}
```

## Layout Animations

### Reorder List

```jsx
import { Reorder } from 'motion/react'

function ReorderList() {
  const [items, setItems] = useState([1, 2, 3, 4])

  return (
    <Reorder.Group values={items} onReorder={setItems}>
      {items.map(item => (
        <Reorder.Item key={item} value={item}>
          {item}
        </Reorder.Item>
      ))}
    </Reorder.Group>
  )
}
```

### Accordion

```jsx
function Accordion({ title, children }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div>
      <motion.button onClick={() => setIsOpen(!isOpen)}>
        {title}
        <motion.span animate={{ rotate: isOpen ? 180 : 0 }}>▼</motion.span>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
```

## Exit Animations

### Exit with AnimatePresence

```jsx
function Modal({ isOpen, onClose, children }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="modal"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 20 }}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
```

## Easing Reference

```jsx
// Custom cubic bezier (recommended)
transition: { ease: [0.76, 0, 0.24, 1] }  // ease-in-out
transition: { ease: [0.16, 1, 0.3, 1] }   // ease-out (smooth)
transition: { ease: [0.87, 0, 0.13, 1] }  // dramatic

// Spring (for bouncy feel)
transition: { type: 'spring', stiffness: 300, damping: 20 }

// Tween (for precise control)
transition: { type: 'tween', duration: 0.5, ease: 'easeOut' }
```

## Performance Tips

1. Use `layout` prop sparingly - it can be expensive
2. Avoid animating `width`/`height` - use `scale` instead
3. Use `will-change: transform` via CSS for heavy animations
4. Use `layoutId` only when necessary
5. Memoize variants objects
6. Use `useReducedMotion` hook for accessibility

```jsx
import { useReducedMotion } from 'motion/react'

function Component() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.div
      animate={{ x: shouldReduceMotion ? 0 : 100 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.5 }}
    />
  )
}
```
