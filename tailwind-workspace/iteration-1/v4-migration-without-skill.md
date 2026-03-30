# Tailwind v4 Migration - Without Skill

## Prompt
Migrating from v3 to v4: config with content paths (including node_modules), theme extension, tailwindcss-animate plugin, @tailwind directives, bg-opacity-50.

## Response

### 1. Replace @tailwind directives

In v4, the `@tailwind` directives are replaced:

```css
/* Old v3 */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* New v4 */
@import "tailwindcss";
```

### 2. Move theme to CSS

The JavaScript config is replaced by CSS-first configuration:

```css
@import "tailwindcss";

@theme {
  --color-brand: #ff6600;
}
```

### 3. Content detection

v4 has automatic content detection so you typically don't need the content array. However, if you have files outside the standard paths, you may still need to configure it.

### 4. Opacity syntax

The `bg-opacity-50` utility is deprecated. Use the modifier syntax:

```diff
- <div className="bg-brand bg-opacity-50">
+ <div className="bg-brand/50">
```

### 5. Plugins

Most plugins still work in v4, but some may need updates. Check for v4-compatible versions of your plugins.

### 6. Build setup

Make sure you're using the v4 PostCSS plugin or the Vite plugin for proper compilation.
