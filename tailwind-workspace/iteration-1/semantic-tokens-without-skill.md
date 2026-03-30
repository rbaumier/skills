# Semantic Tokens & Colors - Without Skill

## Prompt
Setting up a theme with CSS variables and raw color classes (bg-white, bg-blue-500).

## Response

### CSS Variable Theming

Your CSS variable approach is a good start. For Tailwind, you can integrate CSS variables with your theme:

```css
:root {
  --primary: #3b82f6;
  --card-bg: #ffffff;
}

.dark {
  --primary: #60a5fa;
  --card-bg: #1f2937;
}
```

Then reference them in your Tailwind config:

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: 'var(--primary)',
        'card-bg': 'var(--card-bg)',
      },
    },
  },
};
```

### Using semantic tokens

Instead of hardcoding `bg-white` and `bg-blue-500`, use your custom tokens:

```tsx
<div className="bg-card-bg text-foreground">
  <button className="bg-primary hover:bg-primary/90">Click</button>
</div>
```

This makes dark mode automatic since the CSS variables change based on the `.dark` class.

### Opacity support

For opacity support with CSS variables, use the RGB format:

```css
:root {
  --primary: 59 130 246; /* RGB values */
}
```

```js
colors: {
  primary: 'rgb(var(--primary) / <alpha-value>)',
}
```
