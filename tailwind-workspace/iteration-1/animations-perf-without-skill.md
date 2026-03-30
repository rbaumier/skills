# Animations & Performance - Without Skill

## Prompt
Animating width/height with transition-all, skeleton loading, and popover entrance animation.

## Response

### 1. Width/Height animation

Animating `width` and `height` directly can cause layout reflow. Consider using `transform: scale()` instead, or if you need the actual dimensions to change, `transition-all` will work but may not be the smoothest:

```tsx
<div className="transition-all duration-300 overflow-hidden" style={{ maxHeight: isOpen ? '500px' : '0' }}>
  <Content />
</div>
```

Using `max-height` with `overflow-hidden` is a common pattern for expand/collapse.

### 2. Skeleton loading

For the skeleton, add an animation:

```tsx
<div className="w-full h-24 bg-gray-200 rounded animate-pulse"></div>
```

`animate-pulse` gives a nice loading effect.

### 3. Popover animation

For popover entrance animations, you can use CSS transitions or a library like Framer Motion:

```tsx
<div className={`transform transition-all duration-200 ${isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
  <PopoverContent />
</div>
```

Or with Framer Motion for more control:

```tsx
<motion.div
  initial={{ opacity: 0, y: -10 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -10 }}
>
  <PopoverContent />
</motion.div>
```
