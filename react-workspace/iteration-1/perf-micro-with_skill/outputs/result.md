# Performance Review: AnalyticsDashboard

## Issues Found

### 1. Mouse tracking causes full re-render on every mousemove (~60fps)
**Rule**: "Use refs for transient high-frequency values"

`mousePos` state triggers a full component re-render on every mouse move. Every render re-computes `topEvents`, `typeBreakdown`, `validEmails`, `uniqueTypes`, and reads `localStorage`. The `Cursor` component is the only consumer -- use a ref and let `Cursor` handle its own updates.

### 2. Expensive computations re-run on every render
**Rule**: "Extract expensive subtrees into memoized components" / useMemo when "computation is genuinely expensive (>1ms)"

`topEvents` filters, maps, re-filters, sorts, and slices the full `events` array every render. `typeBreakdown` iterates `events` 8 times (2 per type). These should be memoized with `useMemo` since they depend only on `events` and `selectedType`.

### 3. Chained filter/map/filter/sort is wasteful
**Rule**: "Combine chained filter/map/reduce into single loop"

`topEvents` chains `.filter().map().filter()` -- three full passes before sort. Combine into a single loop.

### 4. typeBreakdown uses sort to find max
**Rule**: "Use loop for min/max instead of sort()[0]"

Sorting an entire filtered array just to grab `[0]` is O(n log n). A single-pass loop is O(n).

### 5. RegExp created inside render
**Rule**: "Hoist RegExp creation outside loops"

`emailRegex` is re-compiled every render. Hoist to module scope.

### 6. localStorage read on every render
**Rule**: "Cache localStorage/sessionStorage reads, don't read repeatedly"

`localStorage.getItem('darkMode')` is a synchronous IO call on every render. Read once via `useState` initializer or a cached value.

### 7. uniqueTypes uses O(n^2) indexOf dedup
**Rule**: "Use Set/Map for O(1) lookups instead of Array.includes"

`arr.indexOf(t) === i` is O(n^2). Use `new Set()`.

### 8. Array index as key
**Rule**: "Correctness: array index as key"

`topEvents.map((event, i) => <EventCard key={i} ...>)` uses index as key. If events reorder, React will misreconcile. Use a stable identifier.

### 9. StaticHeader re-renders unnecessarily
**Rule**: "Hoist static JSX outside component functions"

`StaticHeader` receives constant props `"Analytics"` and `"Dashboard"`. It re-renders every time the parent does (which is every mousemove). Wrap in `React.memo` or hoist the JSX.

### 10. validEmails and uniqueTypes are computed but never used in JSX
These values are dead code in the current render. They should either be removed (YAGNI) or, if needed elsewhere, memoized. Kept below with memoization assuming they are used downstream.

---

## Refactored Code

```typescript
import { useState, useEffect, useRef, useMemo, memo } from 'react';

// Rule: Hoist RegExp creation outside loops
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Rule: Hoist static JSX outside component functions
const STATIC_HEADER = <header><h1>Analytics</h1><p>Dashboard</p></header>;

// Rule: Cache localStorage reads, don't read repeatedly
// Rule: Pass initializer function to useState for expensive defaults
const readDarkMode = () => localStorage.getItem('darkMode') === 'true';

const StaticHeader = memo(({ title, subtitle }: { title: string; subtitle: string }) => (
  <header><h1>{title}</h1><p>{subtitle}</p></header>
));

// Rule: Use refs for transient high-frequency values
// Cursor manages its own position via a ref-forwarded approach
function TrackedCursor() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current) {
        ref.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      }
    };
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  return <div ref={ref} className="cursor" />;
}

function AnalyticsDashboard({ events }: { events: AnalyticsEvent[] }) {
  const [selectedType, setSelectedType] = useState('all');
  // Rule: Cache localStorage reads + useState initializer
  const [darkMode] = useState(readDarkMode);

  // Rule: Combine chained filter/map/reduce into single loop
  const topEvents = useMemo(() => {
    const scored: Array<AnalyticsEvent & { score: number }> = [];
    for (const e of events) {
      if (selectedType !== 'all' && e.type !== selectedType) continue;
      const score = e.views * 0.3 + e.clicks * 0.7;
      if (score > 10) scored.push({ ...e, score });
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, 20);
  }, [events, selectedType]);

  // Rule: Use loop for min/max instead of sort()[0]
  const typeBreakdown = useMemo(() => {
    return ['click', 'view', 'scroll', 'hover'].map(type => {
      let count = 0;
      let maxEvent: AnalyticsEvent | undefined;
      let maxViews = -1;
      for (const e of events) {
        if (e.type !== type) continue;
        count++;
        if (e.views > maxViews) {
          maxViews = e.views;
          maxEvent = e;
        }
      }
      return { type, count, maxEvent };
    });
  }, [events]);

  // Rule: Use Set for O(1) dedup
  const uniqueTypes = useMemo(() => [...new Set(events.map(e => e.type))], [events]);

  // Rule: Hoist regex outside render (done above) + memoize
  const validEmails = useMemo(
    () => events.map(e => e.userEmail).filter(email => EMAIL_REGEX.test(email)),
    [events],
  );

  return (
    <div className={darkMode ? 'dark' : 'light'}>
      <TrackedCursor />
      {STATIC_HEADER}
      {topEvents.map(event => (
        <EventCard key={event.id} event={event} />
      ))}
      {typeBreakdown.map(tb => (
        <TypeRow key={tb.type} {...tb} />
      ))}
    </div>
  );
}
```

## Summary of Changes

| # | Issue | Fix | Skill Rule |
|---|-------|-----|------------|
| 1 | mousemove state causes 60fps full re-renders | Ref + direct DOM mutation in isolated `TrackedCursor` | Use refs for transient high-frequency values |
| 2 | Expensive computations every render | `useMemo` on `topEvents`, `typeBreakdown` | Extract expensive subtrees; memoize genuinely expensive computation |
| 3 | 3-pass filter/map/filter chain | Single `for` loop | Combine chained filter/map/reduce into single loop |
| 4 | sort() just to find max | Single-pass max tracking | Use loop for min/max instead of sort()[0] |
| 5 | RegExp compiled every render | Module-level `EMAIL_REGEX` | Hoist RegExp creation outside loops |
| 6 | localStorage read every render | `useState(readDarkMode)` initializer | Cache localStorage reads |
| 7 | O(n^2) indexOf dedup | `new Set()` | Use Set for O(1) lookups |
| 8 | Array index as key | `event.id` | Correctness: array index as key |
| 9 | Static header re-renders | Hoisted JSX constant `STATIC_HEADER` | Hoist static JSX outside component functions |
