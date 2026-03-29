# Shadows & Depth

## Layered Shadows

A single box-shadow looks flat. Layer multiple shadows with increasing blur and decreasing opacity to mimic real light:

```css
/* Incorrect --- single flat shadow */
.card {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

/* Correct --- layered shadows for realistic depth */
.card {
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.06),
    0 4px 8px rgba(0, 0, 0, 0.04),
    0 12px 24px rgba(0, 0, 0, 0.03);
}
```

## Shadow Direction

All shadows must share the same offset direction to imply a single light source. Mixed directions feel broken:

```css
/* Incorrect --- conflicting light sources */
.card    { box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); }
.modal   { box-shadow: 4px 0 8px rgba(0, 0, 0, 0.1); }
.tooltip { box-shadow: 0 -4px 8px rgba(0, 0, 0, 0.1); }

/* Correct --- consistent top-down light */
.card    { box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08); }
.modal   { box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12); }
.tooltip { box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); }
```

## No Pure Black Shadows

Pure black shadows look harsh and artificial. Use deep neutrals or semi-transparent dark colors:

```css
/* Incorrect --- pure black */
.card { box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25); }

/* Correct --- tinted neutral */
.card { box-shadow: 0 4px 12px rgba(17, 24, 39, 0.08); }
```

## Elevation Scale

Larger blur and offset means higher elevation. Define a consistent shadow scale as tokens:

```css
:root {
  --shadow-1: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-2: 0 2px 8px rgba(0, 0, 0, 0.08);
  --shadow-3: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.card     { box-shadow: var(--shadow-1); }
.dropdown { box-shadow: var(--shadow-2); }
.modal    { box-shadow: var(--shadow-3); }
```

## Animating Shadows

Transitioning `box-shadow` directly forces expensive repaints. Put the target shadow on a pseudo-element and animate its opacity instead:

```css
.card {
  position: relative;
  box-shadow: var(--shadow-1);
}

.card::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: var(--shadow-3);
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
  z-index: -1;
}

.card:hover::after {
  opacity: 1;
}
```

## Button Shadow Anatomy

A polished button uses six layered techniques, not just a single box-shadow:

1. **Outer cut shadow** --- 0.5px dark box-shadow to "cut" the button into the surface
2. **Inner ambient highlight** --- 1px inset box-shadow on all sides for environmental light
3. **Inner top highlight** --- 1px inset top highlight for the primary light source
4. **Layered depth shadows** --- At least 3 external shadows for natural lighting
5. **Text drop-shadow** --- Drop-shadow on text/icons for contrast against button background
6. **Subtle gradient background** --- If you can tell there's a gradient, it's too much

```css
.button {
  background: linear-gradient(
    to bottom,
    color-mix(in srgb, var(--gray-12) 100%, white 4%),
    var(--gray-12)
  );
  color: var(--gray-1);
  box-shadow:
    0 0 0 0.5px rgba(0, 0, 0, 0.3),          /* 1. outer cut */
    inset 0 0 0 1px rgba(255, 255, 255, 0.04), /* 2. ambient highlight */
    inset 0 1px 0 rgba(255, 255, 255, 0.07),   /* 3. top highlight */
    0 1px 2px rgba(0, 0, 0, 0.1),              /* 4a. depth shadow */
    0 2px 4px rgba(0, 0, 0, 0.06),             /* 4b. depth shadow */
    0 4px 8px rgba(0, 0, 0, 0.03);             /* 4c. depth shadow */
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.15); /* 5. text shadow */
}
```

---

**Avoid**: Single flat shadows. Pure black shadow colors. Inconsistent shadow directions across components. Animating `box-shadow` directly---use pseudo-element opacity.
