# Performance Review: EventLog Component

## Issues Found

### 1. Missing `content-visibility: auto` on list items (High Impact)

With 200-500 items in a scrollable container, most items are off-screen at any given time. The browser still lays out and paints all of them. Add `content-visibility: auto` with `contain-intrinsic-size` to each item so the browser skips rendering for off-screen items -- this is free browser-level virtualization with zero library overhead.

```tsx
<div
  key={event.id}
  className="event-item"
  style={{
    padding: '12px',
    borderBottom: '1px solid #eee',
    contentVisibility: 'auto',
    containIntrinsicSize: 'auto 60px',
  }}
>
```

### 2. Inline style objects recreated every render (Medium Impact)

Both the container and item `style` objects are created as new references on every render. With 200-500 items, this produces hundreds of throwaway objects per render cycle. Hoist them to module-level constants.

```tsx
const containerStyle = { maxHeight: '600px', overflowY: 'auto' } as const;
const itemStyle = {
  padding: '12px',
  borderBottom: '1px solid #eee',
  contentVisibility: 'auto',
  containIntrinsicSize: 'auto 60px',
} as const;
```

### 3. `UserAvatar` rendered for every item without memoization (Medium Impact)

`UserAvatar` likely triggers its own data fetch or render subtree per item. If it is not already wrapped in `React.memo`, every parent re-render re-renders all 200-500 avatars. Ensure `UserAvatar` is memoized since it receives a primitive prop (`userId`), making memo comparison cheap.

### 4. No memoization of the list itself (Low-Medium Impact)

If the parent re-renders for reasons unrelated to `events`, all 200-500 items re-render. Wrapping `EventLog` in `React.memo` prevents this since the only prop is the `events` array reference.

```tsx
const EventLog = React.memo(function EventLog({ events }: { events: Event[] }) {
  // ...
});
```

## Recommended Fix

```tsx
const containerStyle = { maxHeight: '600px', overflowY: 'auto' } as const;
const itemStyle = {
  padding: '12px',
  borderBottom: '1px solid #eee',
  contentVisibility: 'auto',
  containIntrinsicSize: 'auto 60px',
} as const;

const EventLog = React.memo(function EventLog({ events }: { events: Event[] }) {
  return (
    <div className="event-list" style={containerStyle}>
      {events.map(event => (
        <div key={event.id} className="event-item" style={itemStyle}>
          <span>{event.timestamp}</span>
          <p>{event.description}</p>
          <UserAvatar userId={event.userId} />
        </div>
      ))}
    </div>
  );
});
```

## Summary

| Issue | Impact | Effort |
|---|---|---|
| Add `content-visibility: auto` to items | High -- skips layout/paint for ~80% of items | CSS-only, trivial |
| Hoist inline styles to module scope | Medium -- eliminates 200-500 object allocations/render | Trivial |
| Memo-wrap `UserAvatar` | Medium -- prevents unnecessary subtree re-renders | Trivial |
| Memo-wrap `EventLog` | Low-Medium -- guards against unrelated parent re-renders | Trivial |

The highest-value change is `content-visibility: auto`. It requires no JavaScript changes, no virtualization library, and gives the browser permission to skip rendering for off-screen items entirely.
