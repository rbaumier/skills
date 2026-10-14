---
name: mockups
description: Propose before/after mockup variants of a UI change in one HTML doc — a faithful "before" captured from the real app, the whole page around it, almost no text. Use when the user asks for mockups, maquettes, variantes, "tu peux faire des propositions de variantes de maquettes dans un doc html ?", or invokes /mockups.
---

Romain decides by looking, not reading. The doc is pictures of the real screen, side by side.

## Rules

0. **Options critiqued before drawing.** Before any capture, write the sections and their variants as text (letter, title, one line of what changes). Spawn a fresh agent with the request, that list and the design doc paths (rule 6). It critiques each variant (redundant with another, off the question, off-system, weaker than an obvious alternative) and proposes the variants it judges missing. Then you pick the final 2 to 3 per section; the critic advises, you decide. Draw nothing before this step.
1. **Before is faithful.** Capture it from the running app, never redraw it from memory or from the code:
   - drive the app with chrome-devtools to the exact state (same data, open panel, open select);
   - grab the rendered DOM (`document.documentElement.outerHTML`) and the compiled CSS (every `document.styleSheets` rule, inlined), and strip scripts;
   - if capture fails, embed a screenshot as the before. Never a hand-made "before".
2. **After is the before, edited.** Copy the captured HTML and change only what the variant changes. Same data, same viewport, same surroundings, so the eye sees only the difference.
3. **Whole page.** Show the full screen (sidebar, header, the page behind a panel or a dialog), at desktop width scaled down to fit. A cropped component alone is not a mockup.
4. **Almost no text.** Per variant: a letter and a title of 6 words max. One optional line under it if the picture can't say it. No pros/cons, no intro paragraph, no quote of the request. The recommendation is a badge on one variant, plus one short line of why.
5. **Layout.** One section per question. Each section: "Avant" first, then the variants "A", "B", "C" next to it (2 to 3 variants, never more). A variant with several states (empty, filled, error) shows them as small frames under it. Once Romain has picked a variant, later rounds show only the retained variants: no « Avant », no rejected ones (the « Avant » capture still serves as the base to edit).
6. **Project rules.** Read the repo's design doc first (in natalia: `apps/webapp/DESIGN.md`, `/fluid-functionalism`). Variants only use existing tokens and components.
7. **File.** One self-contained HTML in the repo's design folder (natalia: `docs/design/<sujet>-variantes.html`), French copy, not committed. Images go next to it in `docs/design/captures/<sujet>/`.
8. **Visual review before handing over.** Open the file in the browser and screenshot each section. Spawn a fresh agent with only those screenshots and the variant list (title + what changes). It checks fidelity, never taste: a variant changes only what it claims and the « Avant » matches the app; nothing is cropped, overflowing or broken; no two variants look alike once drawn. Fix what it finds, re-screenshot. Then give the absolute `file://` link and one line per section: the recommended variant.
