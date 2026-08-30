---
name: show-me
description: Show the current topic visually — pick the right diagram from the 27-type catalog (architecture, sequence, flowchart, quadrant, timeline…) and render it; fall back to code-shape sketches only when a diagram adds nothing.
---

Help the user understand the current topic of conversation visually. Skip the preamble and keep prose brief. **Default to a diagram**: pick a type from the catalog, then render it at the smallest tier that makes the key point clear.

## Don't draw when

A diagram must teach more than prose. Write a sentence, bullets, or a table instead when the topic is:

- a list of things,
- a single shape or one generic step,
- a simple before/after (use a table or a `diff`).

## Pick the diagram type

| To show | Draw |
|---|---|
| Components and connections in a system | Architecture |
| Legacy IT landscape by phase or department | IT current-state |
| Decision branches | Flowchart |
| Time-ordered messages between actors | Sequence |
| States and transitions with guards | State machine |
| Entities, fields, relationships | ER / data model |
| Events positioned in time | Timeline |
| Cross-functional process with handoffs | Swimlane |
| Two-axis positioning or prioritization | Quadrant |
| Entities scored across 3–5 criteria | Radar / Spider |
| Reinforcing cycle feeding back into itself | Loop / Flywheel |
| Hierarchy through containment | Nested |
| Parent → children relationships | Tree |
| Ownership, reporting, escalation | Org chart |
| Stacked abstraction levels | Layer stack |
| Overlap between sets | Venn |
| Ranked hierarchy or conversion drop-off | Pyramid / Funnel |
| Quantitative comparison across categories | Bar chart |
| Continuous trends over time | Line chart |
| Tasks and phases on a schedule | Gantt |
| Distribution and correlation | Scatter plot |
| End-to-end stack on a deployment or cluster | High-level |
| Multi-actor sequential process with data | Process |
| Multi-tier data storage (raw → curated → refined) | Medallion |
| Role-scoped data flow at each pipeline step | Data flow |
| Data platform integration topology | DP integration |
| Per-role or per-component access permissions | DP security matrix |

## Render it

Two tiers. Pick the smallest that makes the point clear.

### 1. Code-shape sketch (inline text)

Only when the shape **is** the point and a drawn diagram adds nothing: pseudocode for logic, call tree for runtime flow, component tree for UI structure, shallow file tree for responsibilities. Use `diff` on any of these when the point is what changes; match the diff shape to the topic. Show a whole code block when the user needs a copyable target shape.

```text
submitForm
  createSession
    persistPrompt
    launchAgent
  navigateToSession
```

```diff
 on(save)
-  write content
+  if content is unchanged
+    return cached result
+  write new content
```

### 2. Diagram

The medium depends on the destination.

**Local conversation** — HTML/SVG, for every catalog type. Read [references/design-rules.md](references/design-rules.md) first, write one focused, self-contained HTML file (inline SVG, no external assets), then open it:

```
Bash(open path/to/show-me-{description}.html)
```

**GitLab issue or MR** — GitLab strips raw HTML and inline SVG from markdown, but renders ` ```mermaid ` blocks natively:

- The type maps natively to Mermaid — Flowchart, Sequence, State machine, ER, Gantt, Timeline → write a ` ```mermaid ` block directly in the ticket body. Stick to these six types; newer Mermaid types (quadrantChart, xychart, sankey) may not render on the instance and would show as raw code.
- Any other type → render the HTML/SVG diagram, then embed it as an image:
  1. Screenshot the HTML to PNG (chrome-devtools MCP: `navigate_page` → `take_screenshot`).
  2. Upload the PNG with the GitLab MCP `upload_markdown` (or `glab api projects/:id/uploads`).
  3. Insert the returned `![diagram](/uploads/…)` next to the text it supports.

  PNG always renders inline. An uploaded `.svg` may display as a link only — prefer PNG.

## Guidance

Place each visual next to the short text it supports. Keep only the nodes, calls, files, and states needed to answer the user's current question. Several diagrams per answer is fine; don't overwhelm the user.
