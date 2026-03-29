# Review & Audit Workflow

## Phase 1: Anti-Patterns Verdict (Do This First)

Review against ALL anti-patterns. Check for: AI color palette, gradient text, glassmorphism, hero metric layouts, identical card grids, generic fonts, nested cards, bounce easing, redundant copy.

**Verdict**: Pass/fail with specific tells listed. Be brutally honest.

## Phase 2: Technical Audit

Document issues by severity (Critical/High/Medium/Low). Don't fix in this phase.

**Accessibility**: Contrast < 4.5:1, missing ARIA, keyboard navigation, semantic HTML, alt text, form labels
**Performance**: Layout thrashing, expensive animations, missing lazy loading, bundle size, CLS
**Theming**: Hard-coded colors, broken dark mode, inconsistent tokens
**Responsive**: Fixed widths, touch targets < 44px, horizontal scroll, text scaling
**Typography**: Missing `tabular-nums`, `text-wrap`, `font-display`, `font-synthesis`
**Shadows**: Single flat shadows, inconsistent direction, pure black, missing elevation scale
**CSS**: Missing pseudo-element `content`, hit targets via wrappers instead of pseudo-elements

## Phase 3: Design Critique

Think like a design director:

1. **Visual Hierarchy**: Does the eye flow correctly? Clear primary action in 2 seconds?
2. **Information Architecture**: Intuitive structure? Too many choices?
3. **Emotional Resonance**: Right emotion for brand? Target user feels "this is for me"?
4. **Discoverability**: Interactive elements obviously interactive? Useful hover/focus states?
5. **Composition**: Balanced? Intentional whitespace? Visual rhythm?
6. **Typography**: Clear read order? Comfortable body text? Fonts reinforce brand?
7. **Color**: Communicating, not just decorating? Cohesive palette? Works for colorblind?
8. **States**: Empty, loading, error, success -- all designed, not just happy path?
9. **UX Laws**: Fitts's, Hick's, Doherty, Miller's, Jakob's, Von Restorff, Peak-End?

## Phase 4: Final Polish Checklist

- [ ] Visual alignment perfect at all breakpoints
- [ ] Spacing uses design tokens consistently
- [ ] Typography hierarchy consistent
- [ ] All interactive states implemented (default, hover, focus, active, disabled, loading, error, success)
- [ ] All transitions smooth (60fps), consistent easing (ease-out-quart/quint/expo)
- [ ] Copy consistent and polished
- [ ] Touch targets 44px minimum
- [ ] Contrast ratios meet WCAG AA (4.5:1 text, 3:1 UI)
- [ ] Keyboard navigation works, focus indicators visible
- [ ] No layout shift on load
- [ ] Respects `prefers-reduced-motion`
- [ ] Concentric border radius on nested rounded elements
- [ ] Semi-transparent borders for background adaptability
- [ ] `font-variant-numeric: tabular-nums` on data displays
- [ ] `text-wrap: balance` on headings, `pretty` on body
- [ ] Hit targets expanded via pseudo-element technique
- [ ] Button shadow anatomy complete (layered, no pure black)
- [ ] Consistent shadow direction (single light source)
- [ ] No console errors, no dead code, no TODOs
