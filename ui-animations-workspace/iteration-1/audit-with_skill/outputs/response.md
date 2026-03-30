# Response: Reviewing Animation Quality of SaaS Productivity Tool

I follow the **3-Designer Framework** for motion design audits. Here's my approach:

## STEP 1: Context Reconnaissance (Before Touching Any Code)

Before auditing, I need to understand your project:

1. **Read CLAUDE.md** -- Project purpose, design intent
2. **Check package.json** -- Confirm app type (SaaS productivity)
3. **Grep existing animations** -- `motion`, `animate`, `transition`, `@keyframes`
4. **Identify component structure** -- SaaS dashboard patterns

### Motion Gap Analysis (CRITICAL)

Search for conditional renders without AnimatePresence:

```bash
grep -n "&&\s*(" --include="*.tsx" --include="*.jsx" -r .
grep -n "?\s*<" --include="*.tsx" --include="*.jsx" -r .
```

Every `{isOpen && <Modal />}`, `{isLoading ? <Spinner /> : <Content />}` is a potential gap.

### Reconnaissance Output

```
## Reconnaissance Complete
**Project type**: SaaS Productivity Tool (Linear-like)
**Existing animation style**: [to be observed]
**Motion gaps found**: [count] conditional renders without AnimatePresence
**Proposed perspective weighting**:
- **Primary**: Emil Kowalski -- Restraint, speed, purposeful motion. Best match for productivity tools.
- **Secondary**: Jakub Krehel -- Subtle production polish for shipped quality.
- **Selective**: Jhey Tompkins -- Only for onboarding flows or empty states where delight helps.
```

**I would STOP here and wait for your confirmation before proceeding.**

## STEP 2: Full Audit (After Confirmation)

With **Emil Kowalski as primary lens** for a SaaS tool, I'd apply these priorities:

### Emil's Rules (Primary -- Productivity)
- Hover/press < 180ms, user-initiated transitions < 300ms
- Keyboard shortcuts must NOT animate
- High-frequency actions (100s/day) have minimal or no animation
- Animations must be interruptible
- Custom Bezier curves, no default `ease`
- CSS transitions (not keyframes) for interruptible animations

### Jakub's Rules (Secondary -- Polish)
- Enter animations: opacity + translateY + blur
- Exit subtler than enter
- Spring with bounce: 0 for professional feel

### Jhey's Rules (Selective -- Onboarding Only)
- Playful effects only in onboarding, empty states
- Not in core workflow

## STEP 3: Output Format

I'd deliver:
1. Summary box with overall score
2. Per-designer section (Emil: Restraint & Speed, Jakub: Production Polish, Jhey: Experimentation & Delight)
3. Combined recommendations table with severity: Critical / Important / Opportunities
4. Designer reference summary
