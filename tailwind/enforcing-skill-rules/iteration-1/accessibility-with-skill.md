# Accessibility - With Skill

## Prompt
Icon button with p-1, link, and spinning animation - accessibility concerns?

## Response

Multiple accessibility issues to fix:

### 1. Focus styles required on ALL interactive elements

Every interactive element needs visible focus indicators:

```tsx
<button
  className="bg-blue-500 text-white rounded p-1 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
  onClick={toggle}
  aria-label="Search"
>
  <SearchIcon />
</button>

<a
  href="/settings"
  className="text-blue-500 underline focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
>
  Settings
</a>
```

Use `focus:ring-2 focus:ring-offset-2` consistently on all interactive elements.

### 2. Touch target too small - minimum 44x44px

The button has only `p-1` (4px padding). With a small icon, this fails the **minimum 44x44px touch target** requirement (WCAG 2.5.8). Fix:

```tsx
<button
  className="inline-flex items-center justify-center size-11 bg-blue-500 text-white rounded-md focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
  onClick={toggle}
  aria-label="Search"
>
  <SearchIcon className="size-5" />
</button>
```

`size-11` = 44px, meeting the minimum touch target.

### 3. Icon buttons need aria-label + sr-only

Icon-only buttons must have accessible text. Use `aria-label` on the button, or add `sr-only` text:

```tsx
<button className="..." onClick={toggle}>
  <SearchIcon aria-hidden="true" />
  <span className="sr-only">Search</span>
</button>
```

`sr-only` makes the text invisible but available to screen readers.

### 4. Respect motion-reduce for animations

Users with vestibular disorders need reduced motion. Add `motion-reduce:` variant:

```tsx
<div className="animate-spin motion-reduce:transition-none motion-reduce:animate-none">
  <Spinner />
</div>
```

Always pair animations with `motion-reduce:transition-none` or `motion-reduce:animate-none`.

### 5. Support high-contrast mode with contrast-more:

For users who need higher contrast, use the `contrast-more:` variant:

```tsx
<button
  className="bg-blue-500 text-white contrast-more:bg-blue-700 contrast-more:border-2 contrast-more:border-black focus:ring-2 focus:ring-offset-2"
  onClick={toggle}
  aria-label="Search"
>
  <SearchIcon aria-hidden="true" />
  <span className="sr-only">Search</span>
</button>

<a
  href="/settings"
  className="text-blue-500 underline contrast-more:text-blue-800 contrast-more:font-bold focus:ring-2 focus:ring-offset-2"
>
  Settings
</a>
```

The `contrast-more:` variant activates when the user has requested increased contrast in their OS settings.
