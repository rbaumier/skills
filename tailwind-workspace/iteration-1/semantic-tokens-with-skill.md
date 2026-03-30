# Semantic Tokens & Colors - With Skill

## Prompt
Setting up a theme with CSS variables and raw color classes (bg-white, bg-blue-500).

## Response

Your current approach has several issues: raw hex colors, no semantic naming, and raw Tailwind colors instead of design tokens. Here's the proper setup:

### 1. Prefer semantic tokens over raw colors

**Never use raw colors** like `bg-white`, `bg-blue-500`, `text-black`. Use semantic tokens instead:

```diff
- <div className="bg-white text-black dark:bg-gray-900 dark:text-white">
-   <button className="bg-blue-500 hover:bg-blue-600">Click</button>
+ <div className="bg-background text-foreground">
+   <button className="bg-primary text-primary-foreground hover:bg-primary/90">Click</button>
```

Semantic tokens decouple color intent from actual values, making themes swappable.

### 2. Define colors in @theme with OKLCH format

Use the `@theme` block (Tailwind v4) with OKLCH color format for perceptually uniform color manipulation:

```css
@import "tailwindcss";

@theme {
  --color-*: initial; /* Clear all default colors */

  --color-background: oklch(1 0 0);
  --color-foreground: oklch(0.145 0 0);
  --color-primary: oklch(0.6 0.2 260);
  --color-primary-foreground: oklch(1 0 0);
  --color-card: oklch(1 0 0);
  --color-card-foreground: oklch(0.145 0 0);
  --color-border: oklch(0.85 0 0);
  --color-muted: oklch(0.95 0 0);
  --color-muted-foreground: oklch(0.5 0 0);
  --color-destructive: oklch(0.55 0.2 25);

  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --radius-xl: 0.75rem;
}
```

Key points:
- **`--color-*: initial`** clears all default Tailwind colors before defining your custom palette
- OKLCH provides perceptually uniform lightness, making color scales more consistent
- Use `--color-*` naming convention so Tailwind auto-generates the utility classes

### 3. Override dark colors via .dark {} in CSS

```css
.dark {
  --color-background: oklch(0.145 0 0);
  --color-foreground: oklch(0.95 0 0);
  --color-primary: oklch(0.7 0.2 260);
  --color-card: oklch(0.18 0 0);
  --color-card-foreground: oklch(0.95 0 0);
  --color-border: oklch(0.3 0 0);
  --color-muted: oklch(0.2 0 0);
  --color-muted-foreground: oklch(0.6 0 0);
}
```

### 4. Use color-mix() for semi-transparent variants

Instead of creating separate tokens for every opacity level, use `color-mix()` in oklab:

```css
@theme {
  --color-primary-translucent: color-mix(in oklab, var(--color-primary) 50%, transparent);
}
```

This creates a semi-transparent variant while maintaining perceptual accuracy.

### 5. CSS variable-based theming with opacity support

The `@theme` approach with OKLCH supports Tailwind's opacity modifier syntax natively:

```tsx
<button className="bg-primary/90 text-primary-foreground">Click</button>
```

No need for the old RGB decomposition trick. OKLCH works directly with Tailwind's `/` opacity syntax.

### 6. Set base styles on body and *

```css
* {
  @apply border-border;
}

body {
  @apply bg-background text-foreground;
}
```
