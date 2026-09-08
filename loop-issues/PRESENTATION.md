# MR description — the gabarit

Two zones: human prose above the fold; the agent record below it,
in ONE collapsed `<details>` block. The step-4 gate rejects any
description that strays from this file. Load nothing else: the
voice rules are below.

## Above the fold — the prose

No heading: the prose itself opens the description. Funnel-shaped,
repo language, ONE SHORT sentence (~15 words) per line, a BLANK
line between sentences. 7 prose lines MAX before `à valider :`.
Four stages:

1. the problem, no jargon — readable without opening the issue;
2. what the MR changes, one sentence;
3. how + the key numbers;
4. `à valider :` — 2–3 bullets, one contestable decision each, ≤2
   sentences per bullet. An écart au plan needing arbitration IS
   such a bullet, and appears nowhere else.

Voice: every sentence has a conjugated verb; no em dash, no middle
dot, no colon-led fragment (« Résultat : »); bold at most one
load-bearing word per stage, never a whole sentence; no rule of
three, no « not X but Y » parallelism, no AI vocabulary (robust,
seamless, leverage, streamline, delve); French with every accent.

## Visual

- Changed flow, state, data model or chronology → ONE mermaid block
  of the touched sub-flow only, in a type GitLab renders natively:
  decision branches → `flowchart`; messages between actors →
  `sequenceDiagram`; states and guards → `stateDiagram-v2`;
  entities and fields → `erDiagram`; events in time → `timeline`.
  Never flowchart by reflex; never a type outside these five (it
  renders as raw code). Diff palette, both themes:
  `classDef added fill:#dcfce7,stroke:#16a34a,color:#14532a`;
  `classDef removed fill:#fee2e2,stroke:#dc2626,color:#7f1d1d,stroke-dasharray: 5 5`
  + dotted `-.->` links; context unstyled; one legend sentence under
  the block. sequenceDiagram: wrap new messages in
  `rect rgb(220,252,231)`; erDiagram: legend only.
- Shape-only change → ` ```diff ` block(s): ONE shape per block
  (call tree OR file tree OR pseudocode), end-of-line notes ≤5
  words; every mark maps to a hunk and covers a WHOLE line.
- A list, a single step or a simple before/after → no visual.
- A fact appears once: not in two blocks, not above and below the
  fold.

## Captures — UI touched

Any hunk a user sees (page, component, style, copy) → captures
MANDATORY. A capture shows the DELIVERED state. Never video, never
an HTML artifact.

- One capture per changed screen or state. Modified screen →
  `avant | après` pair, avant served by the `<main-repo>` checkout
  on the launch pack's second port; new screen → après only. Second
  port impossible, or the MR migrates the schema → après only + one
  prose line naming what moved. ≤4 images; more screens → the ones
  the reviewer opens first, the rest named in the prose.
- Timing: on the QA stack, after the verdict, before killing it.
  One Chrome: never while QA drives it.
- Mechanics: chrome-devtools `resize_page` 1280 wide →
  `navigate_page`, logged in as the role that sees the screen, QA
  data → `take_screenshot` (full page when the change sits below
  the fold) → `<report-dir>/capture-<screen>-<avant|après>.png`.
  Upload each with `glab api --method POST projects/:id/uploads -F
  file=@<png>` and embed the returned `markdown`. GitHub: paths in the report, no embed.
- Placement: right under the "what the MR changes" sentence. Pair =
  one two-column `| avant | après |` table; single = the image alone.
  ONE caption line under each (≤8 words), not counted as prose.
- A QA-forced fix re-captures every screen it touched.
- Done when every changed screen has its image or its one-line
  reason, and the MR preview renders each one.

## Below the fold

`Closes #<n>` on its own line ABOVE
`<details><summary>Trace agent</summary>`, blank lines around the
inner markdown. Contents CAPPED — full reports live in the
scratchpad:

- écarts not promoted to `à valider :` — one line each;
- review: `Nécessaire` size, unpaid shapes, verdict, findings fixed / → issue /
  dropped — two lines;
- QA ONE line: verdict + blocking reservations, or
  `QA: not run — <reason>`;
- gates one line each; comply zero on branch files, FPs listed.

No `## Plan` — the contract is never restated.

## Self-check — before the MR opens

`Closes #n` (or `Refs #n`) on its own line · no `## Plan` ·
`à valider :` present · ≤7 prose lines above it, one sentence per
line · voice rules hold · the required visual · a capture per touched
screen · ONE `<details>` block below the fold · funnel order · no
fact twice. One violation = rewrite before the MR opens.
