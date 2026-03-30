# Shadow / Elevation System — Skill-Informed

## Design Decisions

- **Layered shadows** — each level uses 2-3 shadow layers with increasing blur, decreasing opacity
- **No pure black** — tinted to deep navy `rgba(17, 24, 39, ...)` instead of `rgba(0, 0, 0, ...)`
- **Token scale** — `--shadow-1` through `--shadow-4` mapping to UI elevation
- **Top light source** — shadows cast downward, consistent direction
- **Animate via pseudo-element opacity** — never `transition: box-shadow`
- **Concentric radius** — outer = inner + padding

```css
:root {
  /* ─── Shadow Tokens (layered, tinted to deep navy) ─── */

  /* Level 1: Buttons, inputs — subtle lift */
  --shadow-1:
    0 1px 2px rgba(17, 24, 39, 0.06),
    0 1px 3px rgba(17, 24, 39, 0.04);

  /* Level 2: Cards, dropdowns — moderate elevation */
  --shadow-2:
    0 2px 4px rgba(17, 24, 39, 0.06),
    0 4px 8px rgba(17, 24, 39, 0.04),
    0 8px 16px rgba(17, 24, 39, 0.02);

  /* Level 3: Popovers, floating panels — high elevation */
  --shadow-3:
    0 4px 8px rgba(17, 24, 39, 0.06),
    0 8px 16px rgba(17, 24, 39, 0.05),
    0 16px 32px rgba(17, 24, 39, 0.03);

  /* Level 4: Modals, dialogs — maximum elevation */
  --shadow-4:
    0 8px 16px rgba(17, 24, 39, 0.08),
    0 16px 32px rgba(17, 24, 39, 0.06),
    0 32px 64px rgba(17, 24, 39, 0.04);

  /* ─── Border Radius Tokens ─── */
  --radius-inner: 8px;
  --radius-outer: calc(var(--radius-inner) + var(--spacing-card-padding));
  --spacing-card-padding: 12px;
}
```

## Shadow Animation (Pseudo-Element Technique)

Never animate `box-shadow` directly — it triggers paint on every frame.
Instead, render the hover shadow on a pseudo-element and animate its `opacity`:

```css
.card {
  position: relative;
  box-shadow: var(--shadow-2);
  border-radius: var(--radius-inner);
}

.card::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: var(--shadow-3);
  opacity: 0;
  transition: opacity 0.2s ease-out;
  pointer-events: none;
}

.card:hover::after {
  opacity: 1;
}
```

## Concentric Radius

Nested rounded elements must follow `outer = inner + padding`:

```css
.outer {
  --padding: 12px;
  --inner-radius: 8px;
  border-radius: calc(var(--inner-radius) + var(--padding));
  padding: var(--padding);
}
.inner {
  border-radius: var(--inner-radius);
}
```

## Usage Map

| Element      | Token        | Radius         |
|-------------|-------------|----------------|
| Buttons     | `--shadow-1` | `--radius-inner` |
| Cards       | `--shadow-2` | `--radius-inner` |
| Dropdowns   | `--shadow-2` | `--radius-inner` |
| Popovers    | `--shadow-3` | `--radius-inner` |
| Modals      | `--shadow-4` | `--radius-outer` |
