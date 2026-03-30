# Accessibility - Without Skill

## Prompt
Icon button with p-1, link, and spinning animation - accessibility concerns?

## Response

### 1. Icon button needs accessible text

The `SearchIcon` button has no visible text. Screen readers won't know what it does. Add an `aria-label`:

```tsx
<button className="bg-blue-500 text-white rounded p-1" onClick={toggle} aria-label="Search">
  <SearchIcon />
</button>
```

### 2. Focus styles

Interactive elements should have visible focus indicators for keyboard navigation. Add focus styles:

```tsx
<button className="bg-blue-500 text-white rounded p-1 focus:outline-none focus:ring-2 focus:ring-blue-500" onClick={toggle} aria-label="Search">
  <SearchIcon />
</button>

<a href="/settings" className="text-blue-500 underline focus:outline-none focus:ring-2 focus:ring-blue-500">Settings</a>
```

### 3. Animation accessibility

Users with vestibular disorders may be affected by animations. Consider adding a reduced motion preference:

```tsx
<div className="animate-spin motion-reduce:animate-none">
  <Spinner />
</div>
```

### 4. Link styling

The link looks fine. Blue with underline is a standard convention. Make sure there's sufficient color contrast against the background.
