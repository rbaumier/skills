# Tailwind v4 Migration - With Skill

## Prompt
Migrating from v3 to v4: config with content paths (including node_modules), theme extension, tailwindcss-animate plugin, @tailwind directives, bg-opacity-50.

## Response

Multiple changes needed. Let me walk through each:

### 1. Replace @tailwind directives with @import

```diff
- @tailwind base;
- @tailwind components;
- @tailwind utilities;
+ @import "tailwindcss";
```

`@import "tailwindcss"` replaces all three `@tailwind` directives in v4.

### 2. Move theme config to @theme {} in CSS

`tailwind.config.ts` is replaced by `@theme {}` blocks in CSS:

```css
@import "tailwindcss";

@theme {
  --color-brand: #ff6600;
}
```

Delete your `tailwind.config.ts` or migrate it incrementally.

### 3. Content detection is automatic - remove content array

v4 has automatic content detection. **No `content` array needed.** Remove it entirely.

**Also: your v3 config includes `node_modules` in content paths** (`'./node_modules/@acme/ui/**/*.js'`). This is problematic - **never include `node_modules` or overly broad globs in content paths.** It massively slows down builds and can produce unexpected classes. If `@acme/ui` ships pre-built, its classes are already in its CSS. If it needs scanning, configure it with a source plugin or move it out of node_modules.

### 4. Use opacity modifier syntax, not bg-opacity-50

```diff
- <div className="bg-brand bg-opacity-50">Content</div>
+ <div className="bg-brand/50">Content</div>
```

`bg-opacity-50` is removed in v4. Use the `/` opacity modifier syntax instead.

### 5. Replace tailwindcss-animate with native CSS animations

The `tailwindcss-animate` plugin is unnecessary in v4. **Replace it with native CSS animations** using `@theme` and `@keyframes`:

```css
@theme {
  --animate-accordion-down: accordion-down 0.2s ease-out;
  --animate-accordion-up: accordion-up 0.2s ease-out;
  --animate-fade-in: fade-in 0.15s ease-out;

  @keyframes accordion-down {
    from { height: 0; }
    to { height: var(--radix-accordion-content-height); }
  }

  @keyframes accordion-up {
    from { height: var(--radix-accordion-content-height); }
    to { height: 0; }
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
}
```

Remove the plugin from your config/dependencies.

### 6. Use @utility for custom utilities

If you had custom plugins adding utilities, replace them with the `@utility` directive:

```css
@utility content-auto {
  content-visibility: auto;
}
```

`@utility` provides variant support automatically (hover, dark, responsive, etc.).

### 7. Use @custom-variant for custom conditional styles

Replace v3 plugin-based `addVariant` with `@custom-variant`:

```css
@custom-variant dark (&:where(.dark, .dark *));
@custom-variant sidebar-open (&:where([data-sidebar-open], [data-sidebar-open] *));
```

### 8. Use @tailwindcss/postcss or @tailwindcss/vite for build integration

Update your build tooling:

```bash
# For PostCSS
bun add -D @tailwindcss/postcss

# For Vite
bun add -D @tailwindcss/vite
```

```ts
// vite.config.ts
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
});
```

Or for PostCSS:

```js
// postcss.config.js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

### Final migrated CSS

```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --color-brand: #ff6600;
}
```

No config file needed. Clean and minimal.
