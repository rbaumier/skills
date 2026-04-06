---
name: ui-ux
description: >
  Comprehensive UI/UX mega-skill: design systems, visual hierarchy, spacing, color, typography,
  depth, shadows, layout, accessibility WCAG, mobile design, responsive, dark mode theming,
  anti-AI-slop design philosophy (3-dial system, 100 AI tells), interface review & audit
  (technical + design critique + polish), refinement toolkit (simplify, tone down, clarify,
  align, harden, adapt, optimize), enhancement dimensions (visual impact, color strategy,
  delight, onboarding), creative arsenal (hero paradigms, navigation, layouts, cards, bento),
  design thinking, UX writing, interaction design, Laws of UX, release readiness.
---

# UI/UX

Design, review, refine, and enhance user interfaces.

Match your need below, then read the linked file.

| Need | Read |
|------|------|
| Anti-AI-slop checks, 3-dial system, top 20 anti-patterns, design personality | [design-philosophy.md](design-philosophy.md) |
| Visual hierarchy, Laws of UX, spacing, typography, color, shadows, tokens | [design-principles.md](design-principles.md) |
| Visual impact, color strategy, delight, onboarding, simplify, tone down, harden, responsive | [enhancement-and-refinement.md](enhancement-and-refinement.md) |
| 4-phase audit workflow: anti-patterns, technical, design critique, polish checklist | [review-audit.md](review-audit.md) |
| Accessibility, forms, touch, code/design smells, performance guardrails, mobile, i18n | [accessibility-and-interaction.md](accessibility-and-interaction.md) |
| Hero paradigms, navigation, layouts, cards, bento, micro-interactions, project setup | [creative-arsenal.md](creative-arsenal.md) |

## View State Completeness

Every view that fetches data must design for three states beyond the happy path. These are not edge cases -- they are the first states users see. Design them before the populated state. In reviews: if a component only handles the "data loaded" state, flag the missing states.

**Loading**: skeleton screens over spinners. Skeletons mirror the layout of the content being loaded, reducing perceived load time by ~30%. Use CSS `background: linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite;`. In reviews: if a loading state shows a centered spinner instead of a skeleton matching the expected content layout, flag it.

**Empty**: guide users to action. Never show a blank page or "No data found". Empty states need: (1) an illustration or icon explaining the state, (2) a clear message explaining WHY it's empty, (3) a primary CTA button for the next logical action (e.g., "Create your first project"). Design empty states as onboarding opportunities.

**Error**: recovery paths, not just messages. Every error state must include: (1) what went wrong (plain language, not error codes), (2) why it happened (if known), (3) how to fix it (specific action), (4) a retry button if the error might be transient. Never show raw error messages or stack traces.

## Accessibility Essentials

**Touch targets**: minimum 44x44px (WCAG) / 48x48dp (Material). Add padding/margin if the visual element is smaller. Space interactive elements at least 8px apart. In reviews: if a clickable icon or link is visually smaller than 44px without adequate padding, flag it.

**Focus management for modals**: (1) trap focus inside (Tab cycles within modal only), (2) move focus to the first interactive element or close button, (3) on close: return focus to the triggering element. Use `aria-modal="true"` and `role="dialog"`. Prevent background scroll with `overflow: hidden` on body.

**Form validation UX**: show errors inline next to the field, not in a toast or summary. Validate on blur (when user leaves field), not on every keystroke or only on submit. Use `aria-describedby` to connect error messages to inputs. Preserve user input on error -- never clear the form.

## Reference Files

| File | Scope |
|------|-------|
| [references/typography.md](references/typography.md) | Type scales, pairing, loading, OpenType, variable fonts, fluid type |
| [references/color-and-contrast.md](references/color-and-contrast.md) | OKLCH, palettes, 60-30-10, dark mode, contrast, tinted neutrals |
| [references/spatial-design.md](references/spatial-design.md) | Spacing systems, grids, container queries, concentric radius |
| [references/shadows.md](references/shadows.md) | Layered shadows, elevation scale, animation technique |
| [references/css-techniques.md](references/css-techniques.md) | Pseudo-elements, View Transitions API |
| [references/motion-design.md](references/motion-design.md) | Duration/easing rules, reduced motion, perceived performance |
| [references/interaction-design.md](references/interaction-design.md) | 8 interactive states, focus rings, forms, modals, keyboard nav |
| [references/responsive-design.md](references/responsive-design.md) | Mobile-first, fluid design, container queries, safe areas |
| [references/ux-writing.md](references/ux-writing.md) | Button labels, error messages, empty states, voice/tone |
| [references/anti-ai-slop.md](references/anti-ai-slop.md) | 3-dial definitions, 100 AI Tells, design engineering directives |
| [references/advanced-browser-apis.md](references/advanced-browser-apis.md) | View Transitions morphing, `@starting-style`, scroll-driven animations, `@property`, spring physics, virtual scrolling |
| [references/creative-arsenal.md](references/creative-arsenal.md) | Hero paradigms, navigation, layouts, cards, bento, micro-interactions |


**Design for all three view states -- loading, empty, error**: Every view that fetches data must design for three states beyond the happy path: loading (skeleton), empty (guide to action), error (recovery path). These are not edge cases -- they are the first states users see. Design them before the populated state. In reviews: if a component only handles the 'data loaded' state, flag the missing loading/empty/error states.

**Touch targets minimum 44x44px (WCAG) / 48x48dp (Material)**: All interactive elements must meet minimum touch target size. Add padding/margin if the visual element is smaller than the touch target. Space interactive elements at least 8px apart to prevent misclicks. In reviews: if a clickable icon or link is visually smaller than 44px without adequate padding, flag it as a touch target violation.

**Focus management for modals and dialogs**: When opening a modal: 1) Trap focus inside (Tab cycles within modal only), 2) Move focus to the first interactive element or the close button, 3) On close: return focus to the element that triggered the modal. Use `aria-modal="true"` and `role="dialog"`. Prevent background scroll with `overflow: hidden` on body. In reviews: if a modal or dialog doesn't trap focus or restore focus on close, flag it as a keyboard accessibility violation.

**Form validation UX -- inline, on blur, not on submit**: Show validation errors inline next to the field, not in a toast or summary at the top. Validate on blur (when user leaves the field), not on every keystroke (annoying) or only on submit (too late). Use `aria-describedby` to connect error messages to inputs for screen readers. Preserve user input on error -- never clear the form. In reviews: if form validation only shows errors after submit, or shows a toast instead of inline errors, flag it.

**Empty states must guide users to action**: Never show a blank page or 'No data found'. Empty states need: 1) An illustration or icon explaining the state, 2) A clear message explaining WHY it's empty, 3) A primary CTA button to take the next logical action (e.g., 'Create your first project'). Design empty states as onboarding opportunities. In reviews: if a list/table component has no empty state treatment, flag it.

**Error states need recovery paths, not just messages**: Every error state must include: 1) What went wrong (plain language, not error codes), 2) Why it happened (if known), 3) How to fix it (specific action the user can take), 4) A retry button if the error might be transient. Never show raw error messages or stack traces. In reviews: if an error state only shows 'Something went wrong' with no recovery action, flag it as unhelpful.

**Loading states are UI -- skeleton screens over spinners**: Replace spinners with skeleton screens that mirror the layout of the content being loaded. Use CSS `background: linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite;`. Skeletons reduce perceived load time by ~30% because users see structure, not emptiness. In reviews: if a loading state shows a centered spinner instead of a skeleton matching the expected content layout, flag it.