# Design Philosophy

Guidelines for brutalist, minimalist, and abstract design styles — and how to mix them.

## Table of Contents

- [Digital Brutalism](#digital-brutalism)
- [Minimalism](#minimalism)
- [Abstract / Generative](#abstract--generative)
- [Mixing Styles](#mixing-styles)
- [Color Palettes](#color-palettes)

---

## Digital Brutalism

**Principles**: Raw, honest, no polish. Exposed structure. Function as aesthetic. Intentional discomfort.

### Motion Patterns

- **Hard cuts**: No easing, `ease: 'none'` or `duration: 0`. Instant state changes.
- **Jarring transitions**: `steps()` easing, abrupt position jumps, deliberate jank.
- **No smooth scroll**: Native scroll only. Disable Lenis for brutalist sections.
- **Aggressive stagger**: Large stagger delays (0.3-0.5s), non-uniform timing.
- **Oversized motion**: Elements moving 200-400% of viewport. No subtlety.

### Typography

- Monospace only: `font-family: monospace` or specific like `'JetBrains Mono'`, `'Space Mono'`
- Giant sizes: 15-30vw for hero text
- Leading crushed: `line-height: 0.8` to `0.9`
- Overlap: Negative margins, elements bleeding into each other
- Mixed scales: 12px next to 200px in the same view
- ALL CAPS or extreme case mixing

### Layout

- Broken grids: Asymmetric, overlapping, bleeding off-screen
- Visible borders: `border: 2px solid` everywhere
- Raw backgrounds: Solid black, white, or single accent
- No border-radius: Sharp corners only

### Animation Code Pattern

```tsx
// Brutalist: instant, hard, no easing
gsap.to(el, { x: 500, duration: 0, ease: 'none' })  // teleport
gsap.to(el, { rotation: 90, duration: 0.1, ease: 'steps(3)' })  // stepped
gsap.to(el, { scale: 3, duration: 0.05 })  // jarring snap
```

---

## Minimalism

**Principles**: Less is more. Every element serves a purpose. Motion communicates, never decorates.

### Motion Patterns

- **Ease-out smooth**: `power2.out` or `[0.16, 1, 0.3, 1]`. Never linear, never bouncy.
- **Subtle scale**: Max 1.02-1.05 scale changes. Barely perceptible.
- **Opacity only**: Many transitions need nothing more than `opacity: 0 → 1`.
- **Long durations**: 800ms-1500ms for primary, 300-500ms for secondary.
- **Single property**: Animate one property at a time. Never x + y + scale + opacity simultaneously.

### Typography

- Sans-serif: Clean, geometric. `'Inter'`, `'Helvetica Neue'`, `'Neue Haas Grotesk'`
- Light weights: 200-400 for body, 500-600 for emphasis (never 900)
- Generous tracking: `letter-spacing: 0.1-0.3em` for headings
- Generous leading: `line-height: 1.6-1.8`
- Restrained sizes: Max 3-4 sizes in the entire page

### Layout

- Abundant whitespace: 40-60% of viewport should be empty
- Strict grid: 12-column or 8-column, always aligned
- No decorative elements: If it doesn't inform, remove it
- Monochromatic or 2-color max

### Animation Code Pattern

```tsx
// Minimal: smooth, purposeful, restrained
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
/>

// Subtle hover
<motion.a whileHover={{ opacity: 0.6 }} transition={{ duration: 0.3 }} />
```

---

## Abstract / Generative

**Principles**: Non-representational beauty. Mathematics as aesthetics. Organic through algorithmic means.

### Motion Patterns

- **Noise-driven**: Perlin/Simplex noise for position, scale, rotation. Never predictable.
- **Parametric motion**: Sine/cosine combinations for organic loops.
- **Infinite loops**: `repeat: -1`. Art that never settles.
- **Emergent behavior**: Simple rules → complex visuals (flocking, cellular automata).
- **Slow evolution**: Changes happen over 10-60 seconds. Patience rewarded.

### Visual Language

- Shapes: Circles, flowing curves, particle systems. Avoid rectangles.
- Color: Gradients, hue rotation, noise-mapped palettes.
- Texture: Grain, noise overlays, displacement maps.
- Scale: Micro patterns that reveal macro structures.

### Animation Code Pattern

```tsx
// Abstract: noise-driven, parametric, continuous
const animate = () => {
  time += 0.005
  elements.forEach((el, i) => {
    const nx = noise3D(i * 0.1, 0, time) * amplitude
    const ny = noise3D(0, i * 0.1, time) * amplitude
    gsap.set(el, { x: nx, y: ny, rotation: nx * 0.5 })
  })
  requestAnimationFrame(animate)
}
```

---

## Mixing Styles

### Neo-Brutalism (Brutalist + Minimal)

The currently trending style. Takes brutalist rawness and pairs with minimal restraint.

- **What to keep from Brutalism**: Bold typography, visible borders, monospace, high contrast
- **What to keep from Minimal**: Purposeful whitespace, smooth-ish easing (`power1.out`), restraint in motion
- **How it looks**: Large mono headings, clean grid with thick borders, black + white + one bright accent, subtle animations on bold elements
- **Motion recipe**: Short durations (200-400ms), `power1.out` easing, opacity transitions, no bounce

```tsx
// Neo-brutalist card
<motion.div
  className="border-2 border-black bg-[#BAFF39] p-6 font-mono"
  whileHover={{ y: -4 }}
  transition={{ duration: 0.2, ease: 'easeOut' }}
>
  <h3 className="text-2xl font-black uppercase">Title</h3>
</motion.div>
```

### Generative Minimal (Abstract + Minimal)

Subtle algorithmic beauty with minimalist discipline.

- **What to keep from Abstract**: Noise-driven motion, particle systems, parametric shapes
- **What to keep from Minimal**: Restraint, monochrome, negative space, slow transitions
- **How it looks**: Single-color generative backgrounds, subtle noise displacement, barely-there particles
- **Motion recipe**: Very slow (15-60s cycles), low amplitude, opacity < 0.3

### Controlled Chaos (Brutalist + Abstract)

Algorithmic art with raw presentation.

- **What to keep from Brutalism**: Hard edges, high contrast, aggressive scale, monospace labels
- **What to keep from Abstract**: Generative geometry, noise, mathematical patterns
- **How it looks**: Full-screen fractal with mono text overlaid, glitch effects on generative backgrounds, data visualization with brutalist typography
- **Motion recipe**: Mix of instant and slow — background evolves slowly, UI snaps

---

## Color Palettes

### Brutalist

| Name | Hex | Use |
|------|-----|-----|
| Pure Black | `#000000` | Background, text |
| Pure White | `#FFFFFF` | Background, text |
| Acid Green | `#BAFF39` | Accent |
| Electric Blue | `#0000FF` | Accent alternative |
| Warning Red | `#FF0000` | Accent alternative |

### Minimalist

| Name | Hex | Use |
|------|-----|-----|
| Off White | `#FAFAF9` | Background |
| Warm Gray | `#A8A29E` | Secondary text |
| Charcoal | `#1C1917` | Primary text |
| Stone | `#E7E5E4` | Borders, dividers |
| Subtle Accent | `#D4D4D8` | Hover states |

### Abstract / Generative

| Name | Hex | Use |
|------|-----|-----|
| Deep Space | `#0A0A0F` | Background |
| Nebula Purple | `#7C3AED` | Primary |
| Plasma Cyan | `#06B6D4` | Secondary |
| Solar Gold | `#F59E0B` | Accent |
| Void Gray | `#1E1E2E` | Surfaces |

### Neo-Brutalist

| Name | Hex | Use |
|------|-----|-----|
| Black | `#000000` | Borders, text |
| Cream | `#FEF3C7` | Background |
| Lime | `#BAFF39` | Primary accent |
| Peach | `#FECACA` | Secondary accent |
| Lavender | `#DDD6FE` | Tertiary accent |

### Retro Fantastical (Wonka / Oz / PS2 / MTV)

Saturated, whimsical, nostalgic. Inspired by 1971 Willy Wonka's candy psychedelia, Wizard of Oz technicolor, PS2-era warm gradients, and MTV Y2K maximalism.

| Name | Hex | Use |
|------|-----|-----|
| Wonka Purple | `#7B2D8E` | Primary, headers, hero backgrounds |
| Chocolate | `#5C3317` | Rich warm backgrounds, borders |
| Emerald City | `#2D8E57` | Accents, CTAs, success states |
| Ruby Slipper | `#C62828` | Highlights, hover states |
| Yellow Brick | `#E8A317` | Gold accents, badges, links |
| Candy Pink | `#E84393` | Secondary accent, MTV energy |
| MTV Lime | `#A3E635` | Neon pop, interactive elements |
| PS2 Sky | `#5B9BD5` | Soft backgrounds, cards |
| Sepia Warm | `#D4A574` | Nostalgic overlays, text secondary |
| Technicolor Cyan | `#00BCD4` | Splash color, borders |
| Chrome Silver | `#C0C0C0` | Y2K metallic, disabled states |
| Deep Velvet | `#1A0A2E` | Dark mode background |

**Usage tips**:
- Pair Deep Velvet + Wonka Purple + Yellow Brick for Wonka vibes
- Emerald City + Ruby Slipper + Yellow Brick for Oz palette
- PS2 Sky + Sepia Warm + Chocolate for nostalgic warmth
- Candy Pink + MTV Lime + Chrome Silver for Y2K energy
- Mix all freely for maximalist retro-fantastical compositions
