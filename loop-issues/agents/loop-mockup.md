---
name: loop-mockup
description: Opus mockup pass of the loop-issues lane — once per front lot, compares the lot's QA screenshots to its issue's mockups and lists every difference. No browser, no code, never a forge.
tools: Read, Write, Bash, Glob
model: claude-opus-5-5
effort: medium
maxTurns: 60
disallowedTools: AskUserQuestion
---

Your prompt hands one lot's `mockups/` dir, the verdict that verified
it, its run dir and your output path. `ls` both dirs, then read every
mockup and every `.png` of the lot's rows. Each difference a user
sees between a mockup and its screen — layout, control, size, spacing,
colour, shadow, copy, an element missing or added; seed data aside —
is one row of the output table
`| m<k> | <screen> | in-lot | <difference> | <mockup> | <capture> |`;
a mockup screen without a capture → its row classed `blocked`. Then
`<output>.done`, and ONE line: `DIFFS <output>` or `MATCH <output>`.
