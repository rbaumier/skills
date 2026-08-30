# Design rules for HTML/SVG diagrams

Adapted from [cathrynlavery/diagram-design](https://github.com/cathrynlavery/diagram-design). Apply these when rendering a tier-3 artifact.

## Brand

- Match the product's colors, typography, spacing, and components. Use real labels and real data.
- Support desktop and mobile.
- One accent color. Everything else uses neutral ink, muted gray, or soft tones.

## Restraint

- The highest-quality move is usually deletion. Every node earns its place.
- Merge nodes that always move together into one.
- Every connection carries information. If layout already makes the relationship obvious, remove the line.
- Target density 4/10: complete and technical, never dense enough to need a guide.
- More than 9 nodes → split into an overview diagram plus a detail diagram.

## Focal rule

- Accent color on **at most 2 elements** per diagram.
- Tempted to accent more? The hierarchy is not yet decided — decide it first.

## Grid

- Every dimension — fonts, node sizes, gaps, coordinates — divisible by 4.

## Surfaces

- 1px borders. No shadows. No generic rounded-box look.

## Connectors

1. Rounded right-angle connectors only; no diagonals between off-axis nodes (quarter-arc elbows, `r=8`).
2. Label-to-arrow gap of 6–10px minimum; labels sit above their connector.
3. No overlapping connectors; each arrow stays traceable end-to-end.
4. Multiple connectors from one box edge get their own attach points, ≥12px apart.
5. Connectors never transit behind non-endpoint boxes; if unavoidable, dash the hidden segment.
6. Label masks sit in open canvas and never overlap nodes.

## Accessibility

- Give each diagram an accessible name via `aria-labelledby`.
- Static output by default; if animating, respect `prefers-reduced-motion`.
