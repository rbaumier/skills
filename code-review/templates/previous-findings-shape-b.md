## Previous findings (iteration N-1)

You emitted these last iteration. Use to avoid re-deriving.

- scope (file / module / claim) — your previous one-line summary — disposition: addressed | rejected-by-orchestrator (reason) | still-stands
  ...

Rules:
- `addressed`: orchestrator accepted, commit reflects it. Re-emit only if commit didn't actually resolve concern (e.g. you said "delete this module" and only export changed).
- `rejected-by-orchestrator`: judged as bloat / out-of-scope / over-reach. Don't re-emit unless cited scope materially changed.
- `still-stands`: accepted but didn't act this iter (often `[suggestion]`). Re-emit verbatim only if scope unchanged. Diff moved on → re-evaluate from scratch.
- Emit genuinely new findings from fix commit with `[must]` / `[suggestion]` tag.
