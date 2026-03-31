# AnalyticsDashboard Performance Review

## Issues Found

### Critical

1. **Mouse-tracking causes full re-render on every pixel move** -- `mousemove` fires dozens of times per second, each updating `mousePos` state, which re-renders the entire component. Every render re-runs all the expensive computations below.

2. **O(n log n) sorts and O(n^2) filter on every render** -- `topEvents`, `typeBreakdown`, `validEmails`, and `uniqueTypes` are all recomputed on every render with no memoization. `typeBreakdown` iterates `events` 8 times (filter + sort per type). `uniqueTypes` uses `.indexOf()` inside `.filter()` making it O(n^2).

3. **`localStorage.getItem` called synchronously on every render** -- This is a blocking synchronous I/O call that runs on every single render. Should be read once and cached.

### High

4. **`StaticHeader` re-renders on every mouse move** -- It receives constant props (`"Analytics"`, `"Dashboard"`) but is not memoized, so it re-renders needlessly on every parent render.

5. **`EventCard` list uses array index as key** -- `key={i}` prevents React from efficiently reconciling the list when items change. Should use a stable identifier from the event data.

6. **`validEmails` and `uniqueTypes` are computed but never used** -- Dead computation. Wasted CPU cycles every render.

7. **Regex created on every render** -- `emailRegex` is a constant but gets re-instantiated each render.

### Medium

8. **`typeBreakdown` hardcodes event types** -- Brittle. If event types change, this silently breaks. Also sorts the entire filtered array just to get index 0 -- should use a single-pass `reduce` to find the max.

---

## Refactored Code

```typescript
import { useState, useEffect, useMemo, memo, useCallback, useRef } from 'react';

// Cursor isolated in its own component with its own state.
// Mouse tracking never causes AnalyticsDashboard to re-render.
function TrackedCursor() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handler = (e: MouseEvent) =>
      setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  return <Cursor x={mousePos.x} y={mousePos.y} />;
}

const StaticHeader = memo(
  ({ title, subtitle }: { title: string; subtitle: string }) => (
    <header>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </header>
  ),
);

function AnalyticsDashboard({ events }: { events: AnalyticsEvent[] }) {
  const [selectedType, setSelectedType] = useState('all');

  // Read once on mount. If dark mode can change at runtime,
  // use useSyncExternalStore instead.
  const darkMode = useRef(localStorage.getItem('darkMode') === 'true').current;

  const topEvents = useMemo(() => {
    const filtered =
      selectedType === 'all'
        ? events
        : events.filter((e) => e.type === selectedType);

    const scored: Array<AnalyticsEvent & { score: number }> = [];
    for (const e of filtered) {
      const score = e.views * 0.3 + e.clicks * 0.7;
      if (score > 10) scored.push({ ...e, score });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 20);
  }, [events, selectedType]);

  const typeBreakdown = useMemo(() => {
    // Single pass: accumulate count and max-views event per type.
    const map = new Map<
      string,
      { count: number; maxEvent: AnalyticsEvent | undefined }
    >();

    for (const e of events) {
      const entry = map.get(e.type);
      if (!entry) {
        map.set(e.type, { count: 1, maxEvent: e });
      } else {
        entry.count++;
        if (!entry.maxEvent || e.views > entry.maxEvent.views) {
          entry.maxEvent = e;
        }
      }
    }

    return Array.from(map, ([type, { count, maxEvent }]) => ({
      type,
      count,
      maxEvent,
    }));
  }, [events]);

  return (
    <div className={darkMode ? 'dark' : 'light'}>
      <TrackedCursor />
      <StaticHeader title="Analytics" subtitle="Dashboard" />
      {topEvents.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
      {typeBreakdown.map((tb) => (
        <TypeRow key={tb.type} {...tb} />
      ))}
    </div>
  );
}
```

## Summary of Changes

| # | What | Why |
|---|------|-----|
| 1 | Extracted `TrackedCursor` with its own state | Mouse movement no longer re-renders `AnalyticsDashboard` at all |
| 2 | `useMemo` on `topEvents` | Only recomputes when `events` or `selectedType` change |
| 3 | `useMemo` on `typeBreakdown` with single-pass O(n) | Replaced 8x iteration + sorts with one loop via `Map` |
| 4 | `memo` on `StaticHeader` | Constant props -- never needs to re-render |
| 5 | `event.id` as key | Stable identity for list reconciliation |
| 6 | Removed `validEmails`, `uniqueTypes` | Dead code -- computed but never rendered |
| 7 | `useRef` for `localStorage` read | Read once on mount instead of every render |
| 8 | Removed hardcoded type list | `typeBreakdown` now derives types from actual data |
