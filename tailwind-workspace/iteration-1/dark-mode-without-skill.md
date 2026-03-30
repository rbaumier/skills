# Dark Mode - Without Skill

## Prompt
Migrating dark mode from Tailwind v3 (darkMode: 'class') to v4.

## Response

### v4 Dark Mode Changes

In Tailwind v4, the configuration has moved from JavaScript to CSS. Dark mode no longer needs a `darkMode` config option.

The `dark:` variant works out of the box in v4. By default it uses the `prefers-color-scheme: dark` media query. If you want class-based toggling (which you had in v3), you need to configure it.

### Migration steps

1. Remove the `darkMode: 'class'` from your tailwind.config.js
2. The `dark:` variant utilities in your HTML remain the same

```tsx
<body className="bg-white text-black dark:bg-gray-900 dark:text-white">
  <div className="border border-gray-200 dark:border-gray-700">
```

3. For class-based dark mode in v4, you can use a CSS-based configuration approach instead of the JS config.

### Consider CSS variable-based theming

Instead of using `dark:` variants everywhere, consider CSS variables:

```css
:root {
  --bg: #ffffff;
  --text: #000000;
}

.dark {
  --bg: #111827;
  --text: #ffffff;
}
```

This reduces the number of dark: classes needed throughout your codebase.
