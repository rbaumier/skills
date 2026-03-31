# Layout Patterns - Without Skill

## Prompt
Grid with long text overflow, image without aspect ratio, arbitrary z-index values.

## Response

### 1. Grid text overflow

Long text in grid cells can overflow. Add `overflow-hidden` and truncation:

```tsx
<div className="grid grid-cols-3 gap-4">
  <div className="bg-white p-4 overflow-hidden">
    <p className="truncate">This is a very long text...</p>
  </div>
</div>
```

### 2. Image layout shift

The image without a fixed aspect ratio can cause layout shift as it loads. Set dimensions:

```tsx
<div className="w-full">
  <img src="/hero.jpg" className="w-full h-auto" alt="Hero" />
  <p>Caption</p>
</div>
```

Or use the `aspect-ratio` CSS property:

```tsx
<img src="/hero.jpg" className="w-full aspect-video object-cover" alt="Hero" />
```

### 3. Z-index values

Using arbitrary values like `z-[999]` and `z-[1000]` works but isn't maintainable. Consider using Tailwind's built-in z-index scale (`z-10`, `z-20`, `z-30`, `z-40`, `z-50`) or define custom values in your config:

```tsx
<div className="z-40"><Modal /></div>
<div className="z-50"><Tooltip /></div>
```
