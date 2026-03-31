# Response: Reviewing Animation Quality of SaaS Tool

Here's how I'd approach reviewing your React app's animation quality:

## 1. Inventory Existing Animations

First, I'd search the codebase for animation-related code:

```bash
grep -r "transition" --include="*.tsx" --include="*.css" .
grep -r "animation" --include="*.tsx" --include="*.css" .
grep -r "motion" --include="*.tsx" .
```

## 2. Check Common Issues

- **Performance**: Are animations running at 60fps? Check with Chrome DevTools Performance panel.
- **Consistency**: Are timing values consistent across the app?
- **Accessibility**: Does the app respect `prefers-reduced-motion`?
- **Mobile**: Do animations work well on touch devices?

## 3. Review Patterns

For a productivity tool like Linear, animations should be:
- Fast and snappy (200-300ms)
- Non-distracting
- Purposeful (guide the user, provide feedback)

## 4. Recommendations

I'd look for:
- Overuse of animations that slow down the workflow
- Missing transitions where content appears/disappears abruptly
- Inconsistent easing curves
- Layout property animations (should use transform instead)

## 5. Output

I'd provide a prioritized list of improvements:
- Critical: Performance issues, accessibility gaps
- Important: Consistency issues, missing transitions
- Nice to have: Polish and refinement opportunities
