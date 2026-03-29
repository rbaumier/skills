# Motion Design Audit Workflow (3-Designer Framework)

**This is the core audit system.** When asked to review/audit motion design, follow this workflow exactly.

## The Three Designers

- **Emil Kowalski** (Linear, ex-Vercel) -- Restraint, speed, purposeful motion. Best for productivity tools.
- **Jakub Krehel** (jakub.kr) -- Subtle production polish, professional refinement. Best for shipped consumer apps.
- **Jhey Tompkins** (@jh3yy) -- Playful experimentation, CSS innovation. Best for creative sites, kids apps, portfolios.

**Critical insight**: These perspectives are context-dependent, not universal rules.

## STEP 1: Context Reconnaissance (DO THIS FIRST)

Before auditing any code, understand the project context. Never apply rules blindly.

**Gather Context:**
1. **CLAUDE.md** -- Project purpose or design intent
2. **package.json** -- App type (Next.js marketing vs Electron productivity vs mobile PWA)
3. **Existing animations** -- Grep for `motion`, `animate`, `transition`, `@keyframes`
4. **Component structure** -- Creative portfolio, SaaS dashboard, marketing site, kids app?

**Motion Gap Analysis (CRITICAL):**

Search for conditional renders without AnimatePresence:
```bash
grep -n "&&\s*(" --include="*.tsx" --include="*.jsx" -r .
grep -n "?\s*<" --include="*.tsx" --include="*.jsx" -r .
```

Common gaps: `{isOpen && <Modal />}`, `{isLoading ? <Spinner /> : <Content />}`, inline styles with dynamic values but no `transition` property.

**State Your Inference, then STOP and wait for user confirmation:**
```
## Reconnaissance Complete
**Project type**: [inferred]
**Existing animation style**: [observed]
**Motion gaps found**: [count] conditional renders without AnimatePresence
**Proposed perspective weighting**:
- **Primary**: [Designer] -- [Why]
- **Secondary**: [Designer] -- [Why]
- **Selective**: [Designer] -- [When applicable]
```

## Context-to-Perspective Mapping

| Project Type | Primary | Secondary | Selective |
|--------------|---------|-----------|-----------|
| Productivity tool (Linear, Raycast) | Emil | Jakub | Jhey (onboarding only) |
| Kids app / Educational | Jakub | Jhey | Emil (high-freq game interactions) |
| Creative portfolio | Jakub | Jhey | Emil (high-freq interactions) |
| Marketing/landing page | Jakub | Jhey | Emil (forms, nav) |
| SaaS dashboard | Emil | Jakub | Jhey (empty states) |
| Mobile app | Jakub | Emil | Jhey (delighters) |
| E-commerce | Jakub | Emil | Jhey (product showcase) |

## STEP 2: Full Audit (After User Confirms)

Read reference files in this order:
1. **audit-checklist.md** -- Systematic guide
2. **Designer files** based on weighting (emil-kowalski.md, jakub-krehel.md, jhey-tompkins.md)
3. **references/accessibility.md** -- MANDATORY. No exceptions.
4. **references/common-mistakes.md** -- Anti-patterns check
5. **references/performance.md** -- If complex animations
6. **references/technical-principles.md** -- Implementation recommendations

## STEP 3: Output Format

Start with summary box, then per-designer sections (Emil: Restraint & Speed, Jakub: Production Polish, Jhey: Experimentation & Delight), then combined recommendations table with severity (Critical/Important/Opportunities). End with designer reference summary.

Full output format details are in **audit-checklist.md**.
