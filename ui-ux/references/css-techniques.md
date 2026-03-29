# CSS Techniques

## Pseudo-Elements

### Fundamentals

`::before` and `::after` require the `content` property to render---even if empty. Prefer pseudo-elements over DOM nodes for decorative content:

```css
/* content is mandatory --- without it, the pseudo-element won't render */
.button::before {
  content: "";
  position: absolute;
  background: var(--gray-3);
}
```

### Positioning Pattern

Parent must have `position: relative` for absolute pseudo-elements. Use z-index to layer behind content:

```css
.button {
  position: relative;
  z-index: 1;
}

.button::before {
  content: "";
  position: absolute;
  inset: 0;
  background: var(--gray-3);
  z-index: -1; /* Behind text content */
}
```

### Hit Target Expansion

Use negative inset values on pseudo-elements to expand clickable area without extra markup:

```css
.link {
  position: relative;
}

.link::before {
  content: "";
  position: absolute;
  inset: -8px -12px; /* Expands hit target beyond visual bounds */
}
```

### Typographic Pseudo-Elements

Use `::marker` and `::first-line` instead of extra DOM nodes or hacks:

```css
/* Custom list bullets without background-image hacks */
li::marker {
  color: var(--gray-8);
  font-size: 0.8em;
}

/* First-line treatment without hardcoded spans */
.article p:first-of-type::first-line {
  font-variant-caps: small-caps;
  font-weight: var(--font-weight-medium);
}
```

## Native Pseudo-Elements

### Dialog Backdrop

Use `::backdrop` for dialog/popover backgrounds instead of extra overlay DOM nodes:

```css
dialog::backdrop {
  background: var(--black-a6);
  backdrop-filter: blur(4px);
}
```

### Input Placeholder

Use `::placeholder` instead of conditional render nodes:

```css
input::placeholder {
  color: var(--gray-9);
  opacity: 1; /* Override browser defaults */
}
```

### Text Selection

Brand the selection highlight:

```css
::selection {
  background: var(--blue-a5);
  color: var(--gray-12);
}
```

## View Transitions API

Prefer View Transitions API over JavaScript animation libraries for page and element transitions. It's native, performant, and composable.

### Transition Name Required

Elements participating in view transitions need `view-transition-name`. Each name must be **unique** on the page during the transition:

```ts
// Assign name, start transition, clean up source
sourceImg.style.viewTransitionName = "card";
document.startViewTransition(() => {
  sourceImg.style.viewTransitionName = ""; // cleanup
  targetImg.style.viewTransitionName = "card";
});
```

For lists, use dynamic names:

```ts
element.style.viewTransitionName = `card-${id}`;
```

### Cleanup After Transition

Remove `view-transition-name` after the transition completes to avoid stale names causing conflicts in subsequent transitions.

### Custom Transition Styling

Style view transition pseudo-elements for custom animations beyond the default crossfade:

```css
::view-transition-group(card) {
  animation-duration: 300ms;
  animation-timing-function: cubic-bezier(0.215, 0.61, 0.355, 1);
}
```

---

**Avoid**: Forgetting `content: ""` on pseudo-elements. Using extra DOM nodes for decorative elements. Omitting `position: relative` on pseudo-element parents. Using JS animation libraries for page transitions when View Transitions API works. Leaving stale `view-transition-name` values.
