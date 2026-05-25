# Data-capture markers — `<crl:run_start>` / `<crl:run_end>`

`code-review-loop` brackets each run with a pair of markers so `process-run.js` can extract one report per run from session transcripts.

## Pairing rule

One pair per loop run, bound by **session id**. A marker emitted in a different session orphans the report. A marker emitted at the wrong moment leaks data in or out of the run's window.

- `<crl:run_start />` — must be emitted by **this** skill, in **this** session, **before** `code-review` spawns any agent.
- `<crl:run_end ... />` — emitted at Step 5, after the loop is finalized, **before** the AFK token or the conversational summary.

## Why `run_start` is emitted by this skill, not by `code-review`

If `code-review` emitted `run_start`, it would land in a different session on the script-driven path (each Skill call is its own session). The report would have no parent session to attach to. Keep emission here.

## Why `tier` / `trust_boundaries` ride on `run_end`, not `run_start`

At `run_start` time, `code-review` hasn't resolved them yet — the run hasn't even spawned the detection pass. They're known by Step 5, so they go on `run_end`.

## Marker shapes

```
<crl:run_start />
```

```
<crl:run_end outcome="<converged|capped|aborted>" iters="<N>" tier="<lite|full|trivial>" trust_boundaries="<csv|none>" />
```

## process-run.js

Post-process at Step 5, in the **same assistant turn** as `<crl:run_end>`, **before** the AFK token or the conversational summary:

```bash
node "$HOME/.claude/skills/code-review-loop/process-run.js"
```

The script is idempotent — it scans recent transcripts for unprocessed `<crl:run_start>` / `<crl:run_end>` pairs and writes one raw-data report per pair to `~/.claude/data/code-review-loop/runs/`. Already-processed pairs are skipped. Failure is non-fatal: just rerun manually. **Do not pass any args** — the script auto-detects.

## One pair per outer loop, regardless of iterations

When Step 4 re-invokes `code-review` (next iteration), do **not** emit a new `<crl:run_start>`. One marker pair bounds the whole loop — every iteration, every fix, every dogfood persona.
