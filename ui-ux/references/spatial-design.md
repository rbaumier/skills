# Spatial Design

## Spacing Systems

### Use 4pt Base, Not 8pt

8pt systems are too coarse---you'll frequently need 12px (between 8 and 16). Use 4pt for granularity: 4, 8, 12, 16, 24, 32, 48, 64, 96px.

### Consistent Spacing Scale

Don't use arbitrary pixel values. Define a scale as custom properties and stick to it throughout the UI:

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;
}

.header  { padding: var(--space-4); }
.card    { margin-bottom: var(--space-3); }
.section { gap: var(--space-5); }
```

### Name Tokens Semantically

Name by relationship (`--space-sm`, `--space-lg`), not value (`--spacing-8`). Use `gap` instead of margins for sibling spacing---it eliminates margin collapse and cleanup hacks.

## Grid Systems

### The Self-Adjusting Grid

Use `repeat(auto-fit, minmax(280px, 1fr))` for responsive grids without breakpoints. Columns are at least 280px, as many as fit per row, leftovers stretch. For complex layouts, use named grid areas (`grid-template-areas`) and redefine them at breakpoints.

## Visual Hierarchy

### The Squint Test

Blur your eyes (or screenshot and blur). Can you still identify:
- The most important element?
- The second most important?
- Clear groupings?

If everything looks the same weight blurred, you have a hierarchy problem.

### Hierarchy Through Multiple Dimensions

Don't rely on size alone. Combine:

| Tool | Strong Hierarchy | Weak Hierarchy |
|------|------------------|----------------|
| **Size** | 3:1 ratio or more | <2:1 ratio |
| **Weight** | Bold vs Regular | Medium vs Regular |
| **Color** | High contrast | Similar tones |
| **Position** | Top/left (primary) | Bottom/right |
| **Space** | Surrounded by white space | Crowded |

**The best hierarchy uses 2-3 dimensions at once**: A heading that's larger, bolder, AND has more space above it.

### Cards Are Not Required

Cards are overused. Spacing and alignment create visual grouping naturally. Use cards only when content is truly distinct and actionable, items need visual comparison in a grid, or content needs clear interaction boundaries. **Never nest cards inside cards**---use spacing, typography, and subtle dividers for hierarchy within a card.

## Container Queries

Viewport queries are for page layouts. **Container queries are for components**:

```css
.card-container {
  container-type: inline-size;
}

.card {
  display: grid;
  gap: var(--space-md);
}

/* Card layout changes based on its container, not viewport */
@container (min-width: 400px) {
  .card {
    grid-template-columns: 120px 1fr;
  }
}
```

**Why this matters**: A card in a narrow sidebar stays compact, while the same card in a main content area expands---automatically, without viewport hacks.

## Optical Adjustments

Text at `margin-left: 0` looks indented due to letterform whitespace---use negative margin (`-0.05em`) to optically align. Geometrically centered icons often look off-center; play icons need to shift right, arrows shift toward their direction.

### Concentric Border Radius

When nesting rounded elements, inner radius must equal outer radius minus the gap. Same radius on both creates uneven curves:

```css
.outer {
  --padding: 8px;
  --inner-radius: 8px;

  border-radius: calc(var(--inner-radius) + var(--padding));
  padding: var(--padding);
}

.inner {
  border-radius: var(--inner-radius);
}
```

### Touch Targets vs Visual Size

Buttons can look small but need large touch targets (44px minimum). Use padding or pseudo-elements:

```css
.icon-button {
  width: 24px;  /* Visual size */
  height: 24px;
  position: relative;
}

.icon-button::before {
  content: '';
  position: absolute;
  inset: -10px;  /* Expand tap target to 44px */
}
```

## Borders & Separation

### Semi-Transparent Borders

Semi-transparent borders adapt to any background color and create subtle, non-jarring separation. Hardcoded border colors break across themes:

```css
/* Incorrect --- hardcoded, breaks in dark mode */
.card { border: 1px solid #e5e5e5; }

/* Correct --- alpha border adapts to any background */
.card { border: 1px solid var(--gray-a4); }
```

## Depth & Elevation

Create semantic z-index scales (dropdown -> sticky -> modal-backdrop -> modal -> toast -> tooltip) instead of arbitrary numbers. For shadows, create a consistent elevation scale (sm -> md -> lg -> xl). **Key insight**: Shadows should be subtle---if you can clearly see it, it's probably too strong.

> For detailed shadow rules (layering, direction, animation, button anatomy), see [shadows reference](shadows.md).

---

**Avoid**: Arbitrary spacing values outside your scale. Making all spacing equal (variety creates hierarchy). Creating hierarchy through size alone---combine size, weight, color, and space. Using the same border-radius on nested elements.
