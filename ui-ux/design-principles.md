# Design Principles

## Process: Design Before Code
- Build a real feature first (search form), never the shell (navbar, sidebar, footer)
- Design in grayscale first -- force hierarchy through spacing, contrast, size. Add color last
- Alternate design/code in tight loops: design -> build -> iterate -> next feature
- Ship the simplest version that delivers value; defer nice-to-haves

## Constrain Choices
- Define restricted values **before** designing: font sizes, colors, spacing, shadows, border-radius
- Token hierarchy: Tokens -> Primitives -> Components -> Patterns -> Pages
- Token naming: `{category}-{property}-{variant}-{state}`. Semantic tokens only
- Test all themes at every breakpoint

## Visual Hierarchy

> Deep reference: [references/spatial-design.md](references/spatial-design.md)

- Combine `font-size`, `font-weight`, and `color` for hierarchy -- size alone makes primary too large
- 2-3 text colors: dark (primary), grey (secondary), light grey (tertiary)
- 2 font weights for UI: normal (400/500) and bold (600/700)
- Emphasize by **de-emphasizing** surroundings, not inflating the target
- Labels are a last resort: drop if format is self-explanatory (`janedoe@example.com`, `$19.99`)
- Semantic hierarchy != visual hierarchy: style for eyes, choose HTML tags for semantics

**Action Hierarchy**:
```
Primary   -> Solid background, high contrast (1 per page)
Secondary -> Outline or muted background (few)
Tertiary  -> Styled as plain links (several)
```
Destructive actions are NOT automatically primary. Use secondary + confirmation or undo.

## Laws of UX

Named, research-backed principles. Apply as design heuristics and code review checks.

**Motor & Input**:
- **Fitts's Law** (1954) -- Targets >= 32px; expand small hit areas with pseudo-elements
- **Hick's Law** (1952) -- Minimize visible options; progressive disclosure

**Memory & Cognition**:
- **Miller's Law** (1956) -- Chunk data into groups of 5-9
- **Cognitive Load** -- Remove anything that doesn't help the user complete their task
- **Tesler's Law** (~1984) -- Absorb complexity in the system, not the user

**Perception & Gestalt**:
- **Proximity** -- More space between groups than within
- **Similarity** -- Same function = same appearance
- **Common Region** -- Shared boundary = perceived group
- **Uniform Connectedness** -- Visual connectors reinforce relationships
- **Pragnanz** -- People interpret complex visuals as simplest form
- **Von Restorff** (1933) -- Distinct element is most memorable

**Behavioral**:
- **Jakob's Law** -- Users expect your site to work like others they use
- **Aesthetic-Usability** -- Polished design is perceived as more usable
- **Doherty Threshold** (1979) -- Respond within 400ms; above: skeletons/optimistic UI
- **Peak-End Rule** -- Invest in success/completion states
- **Goal-Gradient** -- Show progress (step indicators, progress bars)
- **Zeigarnik Effect** -- Show completion percentage to drive engagement
- **Serial Position** -- Place key actions at edges of nav/toolbars

**System Design**:
- **Postel's Law** (1980) -- Accept messy input, output clean data
- **Pareto Principle** -- 80% of users use 20% of features
- **Progressive Disclosure** -- Show what matters now, reveal complexity later

## Spacing & Layout

> Deep reference: [references/spatial-design.md](references/spatial-design.md)

- Start with too much white space, then remove. Density is deliberate, never default
- Non-linear spacing scale: `4, 8, 12, 16, 24, 32, 48, 64, 96, 128px`
- Don't fill the whole screen -- use `max-width` for components with known optimal size
- Grids are overrated -- sidebars: fixed width, main: flex to fill
- More space **between** groups than **within** (Gestalt proximity)
- `gap` > margins for sibling spacing (eliminates margin collapse)
- Flexbox for 1D, Grid for 2D -- don't default to Grid when Flex suffices
- `repeat(auto-fit, minmax(280px, 1fr))` for responsive grids without breakpoints
- Semantic z-index scale: dropdown(100), sticky(200), modal-backdrop(300), modal(400), toast(500), tooltip(600)
- Concentric border radius: `outer = inner + padding`

```css
.outer {
  --padding: 8px;
  --inner-radius: 8px;
  border-radius: calc(var(--inner-radius) + var(--padding));
  padding: var(--padding);
}
.inner { border-radius: var(--inner-radius); }
```

## Typography Quick Rules

> Deep reference: [references/typography.md](references/typography.md)

- Hand-crafted scale: `12, 14, 16, 18, 20, 24, 30, 36, 48, 60, 72px`
- Small text -> tall line-height (1.5-2). Large headings -> tight (1-1.25)
- 45-75 chars per line (`max-width: 20-35em`)
- `text-wrap: balance` on headings, `text-wrap: pretty` on body
- `font-variant-numeric: tabular-nums` for number columns
- `font-display: swap`, `font-synthesis: none`, `font-optical-sizing: auto`
- `-webkit-font-smoothing: antialiased` on `<body>`
- Min 16px body on mobile. `px` or `rem` only, never `em` for type scale

## Color & Theme

> Deep reference: [references/color-and-contrast.md](references/color-and-contrast.md)

- Use OKLCH for perceptually uniform palettes
- 3 categories: Greys (8-10 shades), Primary (5-10 shades), Accents (as needed)
- 60/30/10 rule: neutrals / secondary / accent (visual weight, not pixel count)
- Tint neutrals toward brand hue (even 0.01 chroma creates cohesion)
- Never grey text on colored backgrounds -- use same-hue shade
- Never pure black (#000) or pure white (#fff) -- always tint
- Dark mode: lighter surfaces for depth (not shadows), desaturate accents, reduce font weight

## Depth & Shadows

> Deep reference: [references/shadows.md](references/shadows.md)

- Top light source: lighter top edges, darker bottom, shadows cast downward
- Layer multiple shadows with increasing blur and decreasing opacity
- Shadow scale as tokens: `--shadow-1` (buttons), `--shadow-2` (dropdowns), `--shadow-3` (modals)
- Never pure black shadows -- use `rgba(17, 24, 39, 0.08)`
- Animate shadows via pseudo-element opacity, never `transition: box-shadow`
- Prefer `box-shadow` over `border` for card edges (adapts via transparency)
