# Anti-AI-Slop Reference

## The 3-Dial System

Control design output across three independent axes. Default baseline: DESIGN_VARIANCE=8, MOTION_INTENSITY=6, VISUAL_DENSITY=4. Adapt dynamically based on user requests.

### DESIGN_VARIANCE (1-10)

| Level | Behavior |
|-------|----------|
| 1-3 (Predictable) | Flexbox `justify-center`, strict 12-column symmetrical grids, equal paddings |
| 4-7 (Offset) | `margin-top: -2rem` overlapping, varied image aspect ratios (4:3 next to 16:9), left-aligned headers over center-aligned data |
| 8-10 (Asymmetric) | Masonry layouts, CSS Grid with fractional units (`grid-template-columns: 2fr 1fr 1fr`), massive empty zones (`padding-left: 20vw`) |

**MOBILE OVERRIDE**: For levels 4-10, asymmetric layouts above `md:` MUST fall back to strict single-column layout (`w-full`, `px-4`, `py-8`) on viewports < 768px.

### MOTION_INTENSITY (1-10)

| Level | Behavior |
|-------|----------|
| 1-3 (Static) | No automatic animations. CSS `:hover` and `:active` states only |
| 4-7 (Fluid CSS) | `transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1)`. `animation-delay` cascades for load-ins. Focus on `transform` and `opacity` |
| 8-10 (Advanced) | Complex scroll-triggered reveals or parallax. Never use `window.addEventListener('scroll')` |

### VISUAL_DENSITY (1-10)

| Level | Behavior |
|-------|----------|
| 1-3 (Art Gallery) | Lots of white space. Huge section gaps. Feels expensive and clean |
| 4-7 (Daily App) | Normal spacing for standard web apps |
| 8-10 (Cockpit) | Tiny paddings. No card boxes; just 1px lines. Everything packed. Monospace (`font-mono`) for all numbers |

---

## The 100 AI Tells (Forbidden Patterns)

### Visual & CSS
1. **NO Neon/Outer Glows**: No default `box-shadow` glows or auto-glows. Use inner borders or subtle tinted shadows
2. **NO Pure Black**: Never use `#000000`. Use Off-Black, Zinc-950, or Charcoal
3. **NO Oversaturated Accents**: Desaturate accents to blend elegantly with neutrals
4. **NO Pure Black Shadows**: Tint shadows to the background hue -- never use `rgba(0,0,0,...)` on colored surfaces
5. **NO Inconsistent Shadow Directions**: All shadows share a single, consistent light source direction
6. **NO Missing font-display**: Always set `font-display: swap` on custom fonts
7. **NO Direct box-shadow Animation**: Never `transition: box-shadow`. Animate shadow via pseudo-element `opacity`
8. **NO Excessive Gradient Text**: Do not use text-fill gradients for large headers
9. **NO Custom Mouse Cursors**: Outdated and ruin performance/accessibility
10. **NO AI Color Palette**: Cyan-on-dark, purple-to-blue gradients, neon accents on dark backgrounds are BANNED
11. **NO Glassmorphism Everywhere**: Blur effects, glass cards, glow borders used decoratively rather than purposefully
12. **NO Rounded Elements with Thick Colored Border on One Side**: Lazy accent that never looks intentional
13. **NO Sparklines as Decoration**: Tiny charts that look sophisticated but convey nothing
14. **NO Rounded Rectangles with Generic Drop Shadows**: Safe, forgettable, could be any AI output
15. **NO Gradient Text for "Impact"**: Especially on metrics or headings; decorative rather than meaningful
16. **NO Default Dark Mode with Glowing Accents**: Looks "cool" without requiring actual design decisions
17. **NO Hero Metric Layout Template**: Big number, small label, supporting stats, gradient accent
18. **NO Bounce or Elastic Easing**: Dated, tacky; real objects decelerate smoothly

### Typography
19. **NO Inter Font**: Banned for premium/creative work. Use `Geist`, `Outfit`, `Cabinet Grotesk`, or `Satoshi`
20. **NO Oversized H1s**: Control hierarchy with weight and color, not just massive scale
21. **Serif Constraints**: Use Serif fonts ONLY for creative/editorial designs. NEVER on Dashboards
22. **NO Overused Fonts**: Inter, Roboto, Arial, Open Sans, system defaults
23. **NO Monospace as Lazy "Technical" Shorthand**: Don't use monospace typography just for "developer" vibes

### Layout & Spacing
24. **Align & Space Perfectly**: No floating elements with awkward gaps
25. **NO 3-Column Card Layouts**: The generic "3 equal cards horizontally" feature row is BANNED. Use 2-column Zig-Zag, asymmetric grid, or horizontal scrolling
26. **NO Identical Card Grids**: Same-sized cards with icon + heading + text, repeated endlessly
27. **NO Center Everything**: Left-aligned text with asymmetric layouts feels more designed
28. **NO Same Spacing Everywhere**: Without rhythm, layouts feel monotonous
29. **NO Wrapping Everything in Cards**: Not everything needs a container
30. **NO Nesting Cards Inside Cards**: Visual noise, flatten the hierarchy

### Content & Data (The "Jane Doe" Effect)
31. **NO Generic Names**: "John Doe", "Sarah Chan", or "Jack Su" are banned. Use creative, realistic names
32. **NO Generic Avatars**: No standard SVG "egg" or Lucide user icons. Use creative photo placeholders
33. **NO Fake Numbers**: Avoid `99.99%`, `50%`, or `1234567`. Use organic data (`47.2%`, `+1 (312) 847-1928`)
34. **NO Startup Slop Names**: "Acme", "Nexus", "SmartFlow". Invent premium, contextual brand names
35. **NO Filler Words**: Avoid "Elevate", "Seamless", "Unleash", "Next-Gen". Use concrete verbs
36. **NO Redundant Copy**: Headers that restate the heading, intros that add nothing

### External Resources & Components
37. **NO Broken Unsplash Links**: Use `https://picsum.photos/seed/{random_string}/800/600` or SVG UI Avatars
38. **shadcn/ui Customization**: NEVER use in generic default state. MUST customize radii, colors, shadows
39. **NO Modals Unless Truly No Better Alternative**: Modals are lazy

### Motion & Interaction
40. **NO Emojis in Code/Markup**: Replace with high-quality icons (Radix, Phosphor) or clean SVG primitives
41. **Tactile Feedback**: On `:active`, use `-translate-y-[1px]` or `scale-[0.98]` to simulate physical push
42. **NO `h-screen` for Full-Height Sections**: ALWAYS use `min-h-[100dvh]` to prevent layout jumping on mobile
43. **NO Complex Flexbox Percentage Math**: ALWAYS use CSS Grid for reliable structures

### Architecture
44. **DEPENDENCY VERIFICATION**: Before importing ANY 3rd party library, check `package.json` first
45. **RSC SAFETY**: Global state works ONLY in Client Components. Wrap providers in `"use client"`
46. **TAILWIND VERSION LOCK**: Check `package.json`. Do not use v4 syntax in v3 projects

### Design Direction
47. **NO AI Purple/Blue Aesthetic (The Lila Ban)**: No purple button glows, no neon gradients
48. **Max 1 Accent Color**: Saturation < 80%
49. **COLOR CONSISTENCY**: Stick to one palette. Do not fluctuate between warm and cool grays
50. **ANTI-CENTER BIAS**: Centered Hero/H1 sections banned when LAYOUT_VARIANCE > 4

### States & Resilience
51. **Skeletal Loaders**: Match layout sizes -- no generic circular spinners
52. **Beautiful Empty States**: Indicate how to populate data
53. **Inline Error Reporting**: Clear, contextual error states
54. **Form Labels Above Input**: Helper text optional, error text below
55. **Cards Only When Elevation Communicates Hierarchy**: Otherwise use spacing

---

## Design Engineering Directives (Bias Correction)

### Rule 1: Deterministic Typography
- **Display/Headlines**: Default to `text-4xl md:text-6xl tracking-tighter leading-none`
- **ANTI-SLOP**: Discourage `Inter` for premium/creative. Force unique character with `Geist`, `Outfit`, `Cabinet Grotesk`, or `Satoshi`
- **TECHNICAL UI RULE**: Serif fonts BANNED for Dashboard/Software UIs. Use exclusively high-end Sans-Serif pairings (`Geist` + `Geist Mono` or `Satoshi` + `JetBrains Mono`)
- **Body/Paragraphs**: Default to `text-base text-gray-600 leading-relaxed max-w-[65ch]`

### Rule 2: Color Calibration
- Max 1 Accent Color. Saturation < 80%
- The AI Purple/Blue aesthetic is BANNED
- Use absolute neutral bases (Zinc/Slate) with high-contrast, singular accents
- Stick to one palette for the entire output

### Rule 3: Layout Diversification
- Centered Hero/H1 sections BANNED when DESIGN_VARIANCE > 4
- Force "Split Screen" (50/50), "Left Aligned content/Right Aligned asset", or "Asymmetric White-space"

### Rule 4: Materiality & Anti-Card Overuse
- For VISUAL_DENSITY > 7, generic card containers BANNED
- Use `border-t`, `divide-y`, or negative space
- Use cards ONLY when elevation communicates hierarchy
- Tint shadows to the background hue

### Rule 5: Interactive UI States
- Implement full interaction cycles: Loading, Empty, Error states
- Tactile Feedback: On `:active`, use `-translate-y-[1px]` or `scale-[0.98]`

### Rule 6: Data & Form Patterns
- Label MUST sit above input
- Helper text optional, error text below input
- Standard `gap-2` for input blocks

---

## Pre-Flight Check

Before shipping, verify:
- [ ] Is mobile layout collapse (`w-full`, `px-4`, `max-w-7xl mx-auto`) guaranteed for high-variance designs?
- [ ] Do full-height sections use `min-h-[100dvh]` instead of `h-screen`?
- [ ] Do `useEffect` animations contain strict cleanup functions?
- [ ] Are empty, loading, and error states provided?
- [ ] Are cards omitted in favor of spacing where possible?
- [ ] Did you strictly isolate CPU-heavy perpetual animations in their own Client Components?
- [ ] Does this look like it could be any other AI output? If yes, redesign.
