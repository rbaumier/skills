# Skip gate — *When not to use* in detail

Standard = **shape, not size**. 500-line mechanical rename safer than a 3-line operator flip on permissions.

## Skip when genuinely trivial

- single-word doc typos
- whitespace/comment-only
- lockfile or generated-code regeneration
- mechanical renames with import-path-only effect
- low-risk dep patch bumps
- docs-only
- inert config (linter/formatter rules with no runtime effect)
- user wants quick opinion, not a full review

## Don't skip when small but high blast radius

- any 1-line change to SQL / regex / auth / billing / permission / signature-verification code
- flipping a feature-flag default, retry/timeout, or auth callback URL
- money / tax / currency / fee constants
- HTTP method, redirect URL, status enum
- tightening/loosening a comparison operator (`<` ↔ `<=`, `==` ↔ `!=`)
- renaming a public API surface
- new direct dependency (supply-chain)
- user-facing copy that changes meaning ("approved" → "denied")
- mixed diff with a semantic 1-liner buried in whitespace

## "Config-only" is not a blanket skip

Config flipping a feature-flag default, retry/timeout, auth callback URL, or secrets wiring is **runtime-affecting** — treat it like code.

## Unsure → run

A spurious run costs minutes; a missed billing or auth bug costs much more.

## When the gate decides skip

Do not abandon the contract. Still build the review object with `tier: "trivial"`, empty `agent_roster`, empty `findings` (Step 2 of SKILL.md), so a programmatic caller gets a consistent shape. Then stop.
