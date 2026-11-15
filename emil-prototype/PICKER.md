# The Picker

The picker's appearance is **not a design decision** — it is this spec. Copy the markup, CSS, and wiring below verbatim; the only values that change per run are the variant names and count, and the difference labels. It stays identical across every project so it always reads as harness chrome, never as part of the design being judged. Do not restyle it with the project's tokens, fonts, or colors.

It is a floating dark pill, bottom-center. Dark glass works on top of any page — light or dark — which is why it is not theme-aware.

## Markup

The sliding highlight span first, one button per variant, a hairline divider, then the replay button (only when at least one variant has motion to re-trigger):

```html
<nav class="proto-picker" aria-label="Prototype variants">
  <span class="proto-picker-highlight" aria-hidden="true"></span>
  <button class="proto-picker-item" data-active aria-current="true">Quiet</button>
  <button class="proto-picker-item">Editorial</button>
  <button class="proto-picker-item">Playful</button>
  <span class="proto-picker-divider" aria-hidden="true"></span>
  <button class="proto-picker-item proto-picker-replay" aria-label="Replay animation (R)">↻</button>
</nav>
```

In a framework, keep the class names and structure; only the rendering syntax changes.

## Styles

```css
.proto-picker {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2147483647;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  border-radius: 999px;
  background: rgba(10, 10, 10, 0.82);
  -webkit-backdrop-filter: blur(12px) saturate(1.4);
  backdrop-filter: blur(12px) saturate(1.4);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.08) inset,
    0 8px 24px rgba(0, 0, 0, 0.24),
    0 2px 6px rgba(0, 0, 0, 0.12);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 13px;
  line-height: 1;
  -webkit-font-smoothing: antialiased;
  user-select: none;
  -webkit-user-select: none;
}

.proto-picker-highlight {
  position: absolute;
  top: 4px;
  left: 0;
  height: 28px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  will-change: transform;
}

/* The slide is enabled only after first paint (data-ready), so load doesn't animate. */
.proto-picker[data-ready] .proto-picker-highlight {
  transition:
    transform 250ms cubic-bezier(0.23, 1, 0.32, 1),
    width 250ms cubic-bezier(0.23, 1, 0.32, 1);
}

@media (prefers-reduced-motion: reduce) {
  .proto-picker[data-ready] .proto-picker-highlight { transition: none; }
}

.proto-picker-item {
  position: relative; /* sits above the highlight */
  display: flex;
  align-items: center;
  height: 28px;
  padding: 0 12px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: rgba(255, 255, 255, 0.55);
  font: inherit;
  cursor: pointer;
  transition: color 150ms ease-out;
}

.proto-picker-item:hover {
  color: rgba(255, 255, 255, 0.85);
}

.proto-picker-item:active {
  transform: scale(0.97);
}

.proto-picker-item:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.4);
  outline-offset: 2px;
}

.proto-picker-item[data-active] {
  color: #fff;
}

.proto-picker-divider {
  width: 1px;
  height: 16px;
  margin: 0 4px;
  background: rgba(255, 255, 255, 0.12);
}

.proto-picker-replay {
  padding: 0 10px;
  font-size: 14px;
}

.proto-picker[data-position="top"] {
  bottom: auto;
  top: 24px;
}
```

## Rules

- **Verbatim.** These values are the spec. No project fonts, no brand colors, no theme switching, no extra shadows or borders.
- **The highlight slides; the variant swap stays instant.** The active pill animates between buttons (250ms, strong ease-out) as spatial feedback on the picker itself — but the variant being previewed still switches with no transition. The `width` transition is a deliberate exception to the transform/opacity rule: the element is 28px tall, absolutely positioned, and has no layout dependents, so the paint cost is negligible.
- **One allowed modification:** if a variant occupies the bottom-center of the screen (a toast stack, a bottom sheet, a dock), set `data-position="top"` so the picker never covers the work. Nothing else about it may move or change.
- **Replay is conditional.** Render the replay button and its divider only when at least one variant has an entrance or state animation worth re-triggering; a static comparison gets a shorter pill.

## Difference markers

Each variant outlines in red what carries its axis: the smallest element that differs from at least one other variant, or the whole piece once when everything differs; shared context stays unmarked. Nothing is written on the design: the outline carries a numbered dot, and a legend (chrome, like the picker) lists the visible markers' labels. Add `class="proto-diff" data-diff="<this variant's choice>"` to the element, or wrap it when it is a replaced element (`img`, `input`, `video`) or already styles `::after`. Add `data-diff-inset` when a clipping ancestor or the viewport edge hides the dot; while flipping, check every dot is visible. `D` toggles markers and legend, in the page and its iframes.

```html
<aside class="proto-legend" hidden></aside>
```

```css
:where(html:not([data-proto-diff-off]) .proto-diff) { position: relative; }
html:not([data-proto-diff-off]) .proto-diff { outline: 2px solid rgba(229, 72, 77, 0.5); outline-offset: 8px; }
html:not([data-proto-diff-off]) .proto-diff[data-diff-n]::after,
.proto-legend b {
  display: grid; place-items: center;
  width: 18px; height: 18px; border-radius: 50%; background: #e5484d; color: #fff;
  font: 600 11px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
html:not([data-proto-diff-off]) .proto-diff[data-diff-n]::after {
  content: attr(data-diff-n);
  position: absolute; left: -18px; top: -18px; z-index: 2147483646; pointer-events: none;
}
html:not([data-proto-diff-off]) .proto-diff[data-diff-inset] { outline-offset: -2px; }
html:not([data-proto-diff-off]) .proto-diff[data-diff-inset]::after { left: 2px; top: 2px; }
.proto-legend {
  position: fixed; right: 16px; bottom: 24px; z-index: 2147483647; max-width: 300px;
  padding: 10px 12px; border-radius: 12px; background: rgba(10, 10, 10, 0.82);
  -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px); color: #fff;
  font: 12px/1.35 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.proto-legend p { display: flex; gap: 8px; align-items: center; margin: 0; }
.proto-legend p + p { margin-top: 6px; }
.proto-legend b { flex: none; }
html[data-proto-diff-off] .proto-legend { display: none; }
@media (max-width: 1040px) { .proto-legend { bottom: 72px; } }
```

```js
// Numbers the visible markers (page, then same-origin iframes), mirrors them in the legend and `D` in the iframes.
const legend = document.querySelector('.proto-legend');
setInterval(() => {
  const off = document.documentElement.hasAttribute('data-proto-diff-off');
  const docs = [document, ...[...document.querySelectorAll('iframe')].map((f) => f.contentDocument).filter((d) => d?.documentElement)];
  const labels = [];
  for (const d of docs) {
    d.documentElement.toggleAttribute('data-proto-diff-off', off);
    for (const el of d.querySelectorAll('.proto-diff')) {
      if (!el.getClientRects().length) continue;
      labels.push(el.dataset.diff);
      el.dataset.diffN = labels.length;
    }
  }
  const key = labels.join('\n');
  if (legend.dataset.key === key) return;
  legend.dataset.key = key;
  legend.hidden = !labels.length;
  legend.replaceChildren(...labels.map((label, i) => {
    const p = document.createElement('p');
    p.append(Object.assign(document.createElement('b'), { textContent: i + 1 }), label);
    return p;
  }));
}, 300);
```

## Behavior contract

The contract is fixed regardless of how the harness renders:

- Number keys `1–N` and `←`/`→` switch variants; `R` replays; `D` toggles the difference markers. Ignore key events when focus is in an input, textarea, select, or contenteditable, or when a modifier is held.
- Clicking an item switches to it; exactly one item carries `data-active` and `aria-current="true"` at all times, and the highlight slides to it.
- Selection persists across reload via a URL param (`?v=2`), falling back to variant 1. The highlight takes its initial position without animating (`data-ready` is added after first paint).
- Switching re-mounts the variant (so entrance animations re-run); the replay key re-mounts without switching.

## Reference wiring

Verbatim for the standalone-HTML branch; in a framework, keep the same behavior but express it idiomatically (state instead of `innerHTML`, a keyed re-mount instead of `requestAnimationFrame`, refs + a layout effect for the highlight measurement).

```js
// `variants` is an array of render functions, one per variant, in picker order.
const stage = document.getElementById('stage');
const picker = document.querySelector('.proto-picker');
const highlight = picker.querySelector('.proto-picker-highlight');
const items = [...picker.querySelectorAll('.proto-picker-item:not(.proto-picker-replay)')];
const replay = picker.querySelector('.proto-picker-replay');
let current = 0;

function moveHighlight() {
  const el = items[current];
  highlight.style.width = el.offsetWidth + 'px';
  highlight.style.transform = `translateX(${el.offsetLeft}px)`;
}

function mount(i) {
  stage.innerHTML = '';
  // Clear first, render next frame, so entrance animations re-run.
  requestAnimationFrame(() => { stage.innerHTML = variants[i](); });
}

function setActive(i) {
  if (i < 0 || i >= variants.length) return;
  current = i;
  items.forEach((el, j) => {
    el.toggleAttribute('data-active', j === i);
    if (j === i) el.setAttribute('aria-current', 'true');
    else el.removeAttribute('aria-current');
  });
  moveHighlight();
  const url = new URL(location);
  url.searchParams.set('v', i + 1);
  history.replaceState(null, '', url);
  mount(i);
}

items.forEach((el, i) => el.addEventListener('click', () => setActive(i)));
replay?.addEventListener('click', () => mount(current));
window.addEventListener('resize', moveHighlight);

document.addEventListener('keydown', (e) => {
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const num = parseInt(e.key, 10);
  if (num >= 1 && num <= variants.length) setActive(num - 1);
  else if (e.key === 'ArrowRight') setActive((current + 1) % variants.length);
  else if (e.key === 'ArrowLeft') setActive((current - 1 + variants.length) % variants.length);
  else if (e.key === 'r' || e.key === 'R') mount(current);
  else if (e.key === 'd' || e.key === 'D') {
    const off = document.documentElement.toggleAttribute('data-proto-diff-off');
    document.querySelectorAll('iframe').forEach((f) => f.contentDocument?.documentElement.toggleAttribute('data-proto-diff-off', off));
  }
});

setActive((parseInt(new URLSearchParams(location.search).get('v'), 10) || 1) - 1);
// Enable the slide only after first paint, so load doesn't animate.
requestAnimationFrame(() => requestAnimationFrame(() => picker.setAttribute('data-ready', '')));
```
