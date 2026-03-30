# Animations & Performance - With Skill

## Prompt
Animating width/height with transition-all, skeleton loading, and popover entrance animation.

## Response

### 1. Never animate width/height - use GPU-accelerated properties only

**Only animate GPU-accelerated properties: `transform` and `opacity`.** Avoid `transition-all` with width/height - it triggers expensive layout recalculations on every frame.

```diff
- <div className="transition-all duration-300" style={{ width: isOpen ? '300px' : '0px', height: isOpen ? '500px' : '0px' }}>
+ <div className={cn(
+   "transition-transform duration-300 origin-top overflow-hidden",
+   isOpen ? "scale-y-100 opacity-100" : "scale-y-0 opacity-0"
+ )}>
```

If you need actual dimension changes, use `grid-rows` trick:

```tsx
<div className="grid transition-[grid-template-rows] duration-300"
     style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}>
  <div className="overflow-hidden">
    <Content />
  </div>
</div>
```

### 2. Skeleton loading pattern

Use the standard skeleton pattern: `animate-pulse` + `rounded-md` + proper dark mode colors:

```tsx
<div className="w-full h-24 animate-pulse rounded-md bg-gray-200 dark:bg-gray-800" />
```

Key elements:
- `animate-pulse` for the pulsing effect
- `rounded-md` for consistent border radius
- `bg-gray-200 dark:bg-gray-800` for light/dark mode support

### 3. Use @starting-style for native popover/entry animations

For popover entrance animations, use the native CSS `@starting-style` rule instead of JS libraries:

```css
[popover] {
  opacity: 1;
  transform: scale(1);
  transition: opacity 0.2s, transform 0.2s, display 0.2s allow-discrete;

  @starting-style {
    opacity: 0;
    transform: scale(0.95);
  }
}

[popover]:not(:popover-open) {
  opacity: 0;
  transform: scale(0.95);
}
```

`@starting-style` defines the entry state for elements transitioning from `display: none`, enabling pure CSS entry animations without JavaScript.

### 4. Define animation tokens in @theme

Custom animations should be defined as tokens inside `@theme` blocks:

```css
@theme {
  --animate-slide-in: slide-in 0.2s ease-out;
  --animate-fade-in: fade-in 0.15s ease-out;
  --animate-scale-in: scale-in 0.2s ease-out;

  @keyframes slide-in {
    from { transform: translateY(-10px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes scale-in {
    from { transform: scale(0.95); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
}
```

Then use them as utility classes: `animate-slide-in`, `animate-fade-in`, etc.
