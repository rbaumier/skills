# MR description — the gabarit

Two zones: human prose above the fold; the agent record below it,
in ONE collapsed `<details>` block. The step-5 gate rejects any
description that strays from this file.

## Above the fold — the prose

No heading: the prose itself opens the description. Funnel-shaped,
repo language, ONE SHORT sentence (~15 words) per line, a BLANK
line between sentences — GitLab merges adjacent lines into one
paragraph block. 7 prose lines MAX before `à valider :`. Four
stages:

1. the problem, no jargon — readable without opening the issue;
2. what the MR changes, one sentence;
3. how + the key numbers;
4. `à valider :` — 2–3 bullets, one contestable decision each, ≤2
   sentences per bullet, each as short as a prose line. An écart au
   plan needing arbitration IS such a bullet, and appears nowhere
   else.

Bold a few load-bearing words per stage — the decision, the mode,
the guarantee — never a whole sentence. No "where to start reading"
line. Write in `humanizer` voice, then one `write-romain-chat` pass
(Mode A, softened): it owns the tone, shortens by cutting words,
never merges lines back into a paragraph.

## Visual — load `show-me`

- Changed flow/state/data-model/chronology → diagram MANDATORY, of
  the touched sub-flow only. Type from the show-me catalog (never
  flowchart by reflex), rendered as a GitLab-native mermaid type —
  flowchart, sequence, state, er, gantt, timeline;
  architecture/swimlane → flowchart with subgraphs; anything else
  renders as raw code (rare escape: show-me's HTML→PNG upload).
  Diff palette, hard-coded for both themes: added
  `classDef added fill:#dcfce7,stroke:#16a34a,color:#14532a`;
  removed `classDef removed
  fill:#fee2e2,stroke:#dc2626,color:#7f1d1d,stroke-dasharray: 5 5`
  + dotted `-.->` links; context unstyled; one legend sentence under
  the block. sequenceDiagram: wrap new messages in
  `rect rgb(220,252,231)`; erDiagram: legend only.
- Shape-only change → ` ```diff ` block(s): ONE shape per block
  (call tree OR file tree OR pseudocode), end-of-line notes ≤5
  words — longer goes in the prose; two short blocks beat one
  annotated; every mark maps to a hunk and covers a WHOLE line.
- Both → both blocks; no structural change → skip, no placeholder.
  The same fact never appears twice — not across blocks, not across
  the fold.

## Captures — UI touched

Any hunk a user sees (page, component, style, copy) → **captures**
MANDATORY, same rank as the diagram: no capture = visual missing.
A capture shows the DELIVERED state; QA evidence shows hostile rows
and is reused only when a row's artifact IS that state. Never video,
never an HTML artifact.

- One capture per changed screen or state. Modified screen →
  `avant | après` pair — avant served by the `<main-repo>` checkout
  (already on `<default>`) on a second port from the launch pack;
  new screen → après only. Second port impossible, or the MR
  migrates the schema → après only + one prose line naming what
  moved. ≤4 images; more screens → the ones the reviewer opens
  first, the rest named in the prose.
- Timing: the QA stack is still up when the verdict lands — capture
  THEN, before killing it. One Chrome: never while QA drives it.
- Mechanics: chrome-devtools `resize_page` 1280 wide →
  `navigate_page`, logged in as the role that sees the screen, QA
  data → `take_screenshot` (full page when the change sits below
  the fold) → `<report-dir>/capture-<screen>-<avant|après>.png`.
  Upload each with `mcp__gitlab__upload_markdown`
  (`project_id`, `file_path`) and embed the returned
  `![…](/uploads/…)`. GitHub: no upload path → paths in the report,
  no embed.
- Placement: right under the "what the MR changes" sentence. Pair =
  one two-column `| avant | après |` table; single = the image alone.
  ONE caption line under each (≤8 words); captions don't count
  toward the 7 prose lines.
- A QA-forced fix re-captures every screen it touched.
- Done when every changed screen has its image or its one-line
  reason, and the MR preview renders each one.

## Below the fold

`Closes #<n>` on its own line ABOVE
`<details><summary>Trace agent</summary>` — auto-close never
depends on HTML parsing. Blank lines around the inner markdown, or
GitLab renders it raw. Contents CAPPED — full reports live in the
scratchpad, never re-narrated:

- écarts not promoted to `à valider :` — one line each, decisions
  only;
- review ≤2 lines: rounds, converged?, majors fixed;
- QA ONE line: verdict + blocking reservations, or
  `QA: not run — <reason>` (the justification lives in the report);
- gates one line each; comply false positives listed for triage.

No `## Plan` — the contract is never restated.

## Express lane

Same zones; prose = 3–5 sentences + the `à valider :` bullets;
humanizer voice, no write-romain-chat pass.

## Self-check

Re-read the description BEFORE opening the MR, against this list:
`Closes #n` (or `Refs #n`) on its own line; no `## Plan`; `à valider :`
present, at most 7 prose lines above it, one short sentence per line;
the required visual, and a capture per touched screen when any
changed file is user-visible; the agent record in ONE `<details>`
block below the fold. Then the rules no list holds: funnel order,
tone, no duplicated fact. One violation = rewrite before the MR
opens.
