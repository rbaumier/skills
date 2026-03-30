# Dark Mode - With Skill

## Prompt
Migrating dark mode from Tailwind v3 (darkMode: 'class') to v4.

## Response

### 1. v4 dark mode is built-in - use @custom-variant

In Tailwind v4, dark mode is built-in. Remove the `darkMode: 'class'` config entirely. For class-based toggling (matching your v3 setup), use `@custom-variant`:

```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));
```

This replaces the v3 `darkMode: 'class'` config. The `:where(.dark, .dark *)` selector matches both the `.dark` element and all its descendants.

### 2. Override dark colors via .dark {} with CSS variables

Instead of sprinkling `dark:` variants across every component, define semantic color tokens and override them in `.dark`:

```css
@theme {
  --color-background: oklch(1 0 0);
  --color-foreground: oklch(0.145 0 0);
  --color-card: oklch(1 0 0);
  --color-border: oklch(0.85 0 0);
}

.dark {
  --color-background: oklch(0.145 0 0);
  --color-foreground: oklch(0.95 0 0);
  --color-card: oklch(0.18 0 0);
  --color-border: oklch(0.3 0 0);
}
```

### 3. Set semantic base styles on body and *

```css
* {
  @apply border-border;
}

body {
  @apply bg-background text-foreground;
}
```

This ensures consistent border colors and base background/text across the entire app.

### 4. Migrate your component

```diff
- <html className="dark">
-   <body className="bg-white text-black dark:bg-gray-900 dark:text-white">
-     <div className="border border-gray-200 dark:border-gray-700">
+ <html className="dark">
+   <body className="bg-background text-foreground">
+     <div className="border border-border">
```

With semantic tokens + `.dark` overrides, you no longer need `dark:` variants for colors that are part of your theme. The CSS variables automatically switch. Reserve `dark:` for truly different visual treatments (not just color swaps).

### 5. Remove the JS config

Delete or migrate `tailwind.config.js` - v4 uses CSS-first configuration via `@theme` blocks.
