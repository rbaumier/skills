# SaaS Analytics Color System

## Color Palette

```css
:root {
  /* Primary - Blue */
  --primary-50: #eff6ff;
  --primary-100: #dbeafe;
  --primary-200: #bfdbfe;
  --primary-300: #93c5fd;
  --primary-400: #60a5fa;
  --primary-500: #3b82f6;
  --primary-600: #2563eb;
  --primary-700: #1d4ed8;
  --primary-800: #1e40af;
  --primary-900: #1e3a8a;

  /* Grey Scale */
  --grey-50: #f9fafb;
  --grey-100: #f3f4f6;
  --grey-200: #e5e7eb;
  --grey-300: #d1d5db;
  --grey-400: #9ca3af;
  --grey-500: #6b7280;
  --grey-600: #4b5563;
  --grey-700: #374151;
  --grey-800: #1f2937;
  --grey-900: #111827;
  --grey-950: #030712;

  /* Accent - Green */
  --accent-success: #22c55e;
  --accent-error: #ef4444;
  --accent-warning: #f59e0b;
  --accent-info: #3b82f6;

  /* Backgrounds */
  --bg-primary: #ffffff;
  --bg-secondary: #f9fafb;
  --bg-dark: #000000;

  /* Text */
  --text-primary: #000000;
  --text-secondary: #6b7280;
  --text-muted: #9ca3af;
}
```

## Dark Mode

```css
[data-theme="dark"] {
  --bg-primary: #000000;
  --bg-secondary: #111827;
  --text-primary: #ffffff;
  --text-secondary: #9ca3af;
  --text-muted: #6b7280;
}
```

## Usage Guidelines

- Use the primary blue for CTAs and key interactive elements
- Grey scale for text hierarchy and backgrounds
- Accent colors for status indicators
- Keep a 60/30/10 ratio of usage across the interface
