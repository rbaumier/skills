Review code for necessity and completeness.

## Read budget — hard cap

Max **3 file reads**: CLAUDE.md, CONTEXT.md (if it exists), the diff. Don't open source files. Grep only when a finding's claim *requires* verifying a referenced symbol exists. Past 3 reads = wasted tokens — L1 is structural, not line-anchored.

Read CLAUDE.md for conventions. Read CONTEXT.md for domain terms, roles, invariants.

Read the diff from {diff_file}, filtered to {file_list}. Per role/type/constant referenced in the diff, grep codebase to verify existence (cheap, no Read).

Task: does each piece need to exist? Framework or dep already solves this? Simpler approach? What's missing?

## Don't flag
- Style/naming/formatting — other agents
- Specific bug claims with line numbers — Correctness
- Test coverage gaps — Tests
- "Extract X for reusability" without a concrete second caller in the diff

{previous_findings_block}

## Output

Each finding prefixed `[must]` (shouldn't ship — concrete necessity/completeness gap) or `[suggestion]` (worth considering, can ship without). Untagged = invalid.

Example: `[must] New helpers in src/utils/fmt.ts duplicate formatting passes already in src/io/render.ts — consolidate into existing module.`

Zero findings → exactly: "No findings."
