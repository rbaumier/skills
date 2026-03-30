# Responsive & Mobile-First - With Skill

## Prompt
Building a card grid: 1 column on desktop and 3 columns on mobile. Also have a fixed text-6xl heading.

## Response

Two issues here:

### 1. Mobile-first grid approach

Your prompt says "1 column on desktop, 3 on mobile" which is unusual (typically the reverse). Assuming you want 1 column on mobile, 3 on desktop, here's the fix.

**Always design mobile-first**: base styles = mobile, then add `sm:`/`md:`/`lg:` for larger screens. `mobile:` is not a Tailwind breakpoint.

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  <Card /><Card /><Card />
</div>
```

Base `grid-cols-1` applies on mobile. `md:grid-cols-2` kicks in at medium, `lg:grid-cols-3` at large.

### 2. Responsive text - never use fixed large sizes

`text-6xl` on all screens is too large on mobile. **Use responsive text scaling**:

```tsx
<h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold">Welcome</h1>
```

Start with a reasonable mobile size and scale up at breakpoints.

### 3. Consider container queries for component-level responsiveness

If these cards are embedded in varying layout contexts (sidebar vs main content), consider container queries instead of viewport breakpoints:

```tsx
<div className="@container">
  <div className="grid grid-cols-1 @md:grid-cols-2 @lg:grid-cols-3 gap-6">
    <Card /><Card /><Card />
  </div>
</div>
```

Container queries respond to the parent container's width, not the viewport, making components truly reusable across layouts.
