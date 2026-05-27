Review code for scope reduction.

## Read budget — hard cap

Max **4 file reads**: CLAUDE.md, the diff, plus at most 2 source files needed to verify a wrapper has no other callers. Past 4 reads = wasted tokens — L2 is structural.

Read CLAUDE.md for conventions.

Read diff from {diff_file}, filtered to {file_list}.

Task: smallest perimeter. Files inlinable? Queries mergeable? Wrapper types removable? Every abstraction must justify itself through concrete usage.

## Don't flag
- Naming/style — out of scope
- New abstractions the diff doesn't introduce — only flag existing ones not paying rent
- File-level rewrites the user didn't ask for — propose smaller perimeter, not a module refactor
- "Factor X out in case we need it later" — concrete current usage only

{previous_findings_block}

## Output

Each finding prefixed `[must]` (diff carries unused/wasted scope — reduce before shipping) or `[suggestion]` (smaller perimeter possible but current shape defensible). Untagged = invalid.

Example: `[must] BillingProvider wraps only useBilling() — inline the hook into its sole caller, delete the provider.`

Zero findings → exactly: "No findings."
