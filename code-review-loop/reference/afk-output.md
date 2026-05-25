# AFK output — token semantics

When invoked from AFK (the instruction string starts with `AFK invocation`): return **exactly ONE single-line token** as the last assistant text. Nothing else.

- Static converged, MR ready: `READY_FOR_MR iter=<N> findings_fixed=<C>`
- 8-iter cap reached: `READY_FOR_FAIL_LABEL iter=8 dump=<absolute path to findings-dump>`

## Why `READY_FOR_X`, not `CONVERGED` / `DONE` / `CAP_HIT` / `STOP`

Terminal-sounding words trip the layer above into "task complete, stop" even when surrounding instructions say otherwise. `READY_FOR_X` points at the **next action** (open the MR, or apply the fail-label and move to the next issue). **Neither token signals end-of-run.** End-of-run is owned exclusively by AFK Phase 1 returning zero issues.

## Why "emit token, nothing else"

From AFK, this skill runs inside a runner subagent — AFK spawns an L2 Agent to host this skill. "Emit token, nothing else" terminates the subagent's turn cleanly without leaking recency into AFK's orchestration. You don't need to know that; just emit the right token.

## What never goes in the token

Surviving `severity: suggestion` findings are NOT surfaced to AFK — noise for auto-merge. Worth keeping → the orchestrator (or a separate /afk pass) files them as `ready-for-agent` from diff comments later. Don't append them to the token.
