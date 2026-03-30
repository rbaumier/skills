# Responsive & Mobile-First - Without Skill

## Prompt
Building a card grid: 1 column on desktop and 3 columns on mobile. Also have a fixed text-6xl heading.

## Response

### Grid fix

Your grid logic is inverted and `mobile:` isn't a valid Tailwind breakpoint. Tailwind is mobile-first, so the base styles apply to mobile and you use breakpoints like `md:` for larger screens:

```tsx
<div className="grid grid-cols-1 md:grid-cols-3">
  <Card /><Card /><Card />
</div>
```

Wait, you said 1 column on desktop and 3 on mobile? That's unusual. If you really want that, you'd do:

```tsx
<div className="grid grid-cols-3 md:grid-cols-1">
```

But typically it's the reverse - 1 column on mobile, 3 on desktop.

### Heading

For the heading, `text-6xl` on all screen sizes may be too large on mobile. Consider making it responsive:

```tsx
<h1 className="text-3xl md:text-5xl lg:text-6xl">Welcome</h1>
```

This gives a smaller size on mobile and scales up on larger screens.
