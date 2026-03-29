# Design Philosophy & Anti-AI-Slop

## The AI Slop Test

**Critical quality check**: If you showed this interface to someone and said "AI made this," would they believe you immediately? If yes, that's the problem. A distinctive interface should make someone ask "how was this made?" not "which AI made this?"

## The 3-Dial System

> Full dial definitions and all 100 AI Tells in [references/anti-ai-slop.md](references/anti-ai-slop.md)

Control output across three axes. Default baseline: **DESIGN_VARIANCE=8, MOTION_INTENSITY=6, VISUAL_DENSITY=4**. Adapt dynamically based on user requests.

| Dial | Low (1-3) | Mid (4-7) | High (8-10) |
|------|-----------|-----------|-------------|
| **DESIGN_VARIANCE** | Symmetric grids, centered | Offset, overlapping, varied ratios | Masonry, fractional grid, massive whitespace |
| **MOTION_INTENSITY** | Hover/active only | CSS transitions, stagger delays | Scroll-triggered, parallax, choreographed |
| **VISUAL_DENSITY** | Art gallery, airy | Standard web app | Cockpit, packed data, monospace numbers |

## Design Direction

Commit to a BOLD aesthetic direction:
- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Pick an extreme -- brutally minimal, maximalist, retro-futuristic, organic, luxury, playful, editorial, brutalist, art deco, soft/pastel, industrial
- **Differentiation**: What makes this UNFORGETTABLE?
- **Constraints**: Framework, performance, accessibility requirements

## Core Anti-Patterns (Top 20)

1. **AI Color Palette**: Cyan-on-dark, purple-to-blue gradients, neon accents on dark -- BANNED
2. **Inter/Roboto/Arial**: Use `Geist`, `Outfit`, `Cabinet Grotesk`, `Satoshi` instead
3. **Glassmorphism Everywhere**: Blur effects used decoratively, not purposefully
4. **Gradient Text**: Especially on metrics or headings -- decorative, not meaningful
5. **Dark Mode + Glowing Accents**: Looks "cool" without design decisions
6. **3-Column Equal Cards**: Use asymmetric grid, zig-zag, or horizontal scroll
7. **Hero Metric Layout**: Big number + small label + gradient accent = template
8. **Bounce/Elastic Easing**: Dated, tacky -- use ease-out-quart/quint/expo
9. **Pure Black (#000)**: Use off-black, zinc-950, charcoal
10. **Nesting Cards Inside Cards**: Flatten hierarchy, use spacing
11. **Center Everything**: Left-aligned + asymmetric feels more designed
12. **Same Spacing Everywhere**: Without rhythm, layouts feel monotonous
13. **Generic Avatars/Names**: "John Doe", SVG egg icons -- use creative placeholders
14. **Filler Copy**: "Elevate", "Seamless", "Unleash", "Next-Gen" -- use concrete verbs
15. **Oversized H1s**: Control hierarchy with weight and color, not just massive scale
16. **Pure Black Shadows**: Tint to background hue, never `rgba(0,0,0,...)`
17. **Direct box-shadow Animation**: Use pseudo-element opacity instead
18. **`h-screen`**: Use `min-h-[100dvh]` to prevent mobile layout jumping
19. **Modals for Everything**: Modals are lazy -- use inline, sheets, or drawers
20. **Wrapping Everything in Cards**: Not everything needs a container

## Design Personality

4 levers -- stay consistent:

| Lever | Formal | Neutral | Playful |
|-------|--------|---------|---------|
| Typography | Serif | Neutral sans-serif | Rounded sans-serif |
| Color | Blue, dark tones | Neutral palette | Pink, bright tones |
| Border-radius | None (square) | Small | Large |
| Language | "Please provide..." | Standard | "Sweet, thanks!" |

Pick one border-radius style and use it everywhere.
