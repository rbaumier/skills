# Layout Patterns - With Skill

## Prompt
Grid with long text overflow, image without aspect ratio, arbitrary z-index values.

## Response

### 1. Grid overflow: add min-w-0 + truncate

Grid cells have an implicit `min-width: auto` that prevents text from shrinking below its content size. **Add `min-w-0`** to allow the cell to shrink, then use `truncate` or `line-clamp-N`:

```tsx
<div className="grid grid-cols-3 gap-4">
  <div className="min-w-0 bg-white p-4">
    <p className="truncate">This is a very long text that might overflow...</p>
  </div>
</div>
```

- **`truncate`** for single-line truncation (adds `overflow-hidden text-ellipsis whitespace-nowrap`)
- **`line-clamp-2`** or **`line-clamp-3`** for multi-line truncation

```tsx
{/* Multi-line truncation */}
<p className="line-clamp-2">Long description text that should show 2 lines max...</p>
```

### 2. Prevent image layout shift with aspect-ratio + object-cover

Images without explicit dimensions cause Cumulative Layout Shift (CLS). **Use `aspect-video` or `aspect-square` with `object-cover`**:

```tsx
<div className="w-full">
  <img
    src="/hero.jpg"
    alt="Hero"
    className="w-full aspect-video object-cover rounded-lg"
  />
  <p>Caption</p>
</div>
```

- `aspect-video` = 16:9 ratio, reserves space before image loads
- `object-cover` prevents distortion
- For square thumbnails, use `aspect-square`

### 3. Z-index: use systematic increments of 10

**Never use arbitrary z-index values** like `z-[999]` or `z-[1000]`. Use systematic increments of 10:

```diff
- <div className="z-[999]"><Modal /></div>
- <div className="z-[1000]"><Tooltip /></div>
+ <div className="z-40"><Modal /></div>
+ <div className="z-50"><Tooltip /></div>
```

Establish a z-index scale:
| Layer | Z-index |
|-------|---------|
| Base | `z-0` |
| Dropdown | `z-10` |
| Sticky header | `z-20` |
| Overlay | `z-30` |
| Modal | `z-40` |
| Tooltip/Toast | `z-50` |

Systematic increments of 10 (0, 10, 20, 40, 50) leave room for intermediate layers and prevent z-index wars.
