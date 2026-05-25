# Review object — schema and write protocol

The single contract every caller (a human, `code-review-loop`, or a script-driven orchestrator) consumes. Returned in context AND written to `/tmp/code-review-findings-<sanitized-branch>-<run_id>.json`.

## Shape

```json
{
  "run_id": "<this run's id>",
  "branch": "<current branch>",
  "head_sha": "<full HEAD sha>",
  "default_branch": "<branch detected in Step 0>",
  "tier": "lite | full | trivial",
  "trust_boundaries": ["network", "auth"],
  "changed_files": ["src/a.ts", "src/b.ts"],
  "dogfood_required": true,
  "dogfood_surfaces": ["web-ui", "http-api"],
  "agent_roster": [ ... ],
  "findings": [ ... ]
}
```

- `trust_boundaries` is `[]` when none.
- `dogfood_surfaces` is `[]` when `dogfood_required` is false.
- `changed_files` is the unified file-set from Step 0 (committed ∪ unstaged ∪ staged ∪ untracked) — a consumer that needs the changed surfaces (e.g. a dogfood gate) reads it from here rather than re-deriving the union and risking a miss on uncommitted files.

## agent_roster

One entry per agent spawned in Step 1:

```json
{"agent": "correctness", "template": "templates/correctness.md", "model": "sonnet", "result": "findings" | "no-findings" | "error"}
```

- `no-findings` — the agent returned exactly `No findings.`
- `findings` — the agent returned ≥1 finding.
- `error` — the agent failed, timed out, or returned unparseable output.

The roster is load-bearing: it lets a caller's convergence check tell "agent ran, clean" apart from "agent never spawned". Never omit an agent that was spawned.

## findings

Flatten every finding from every agent into one array. Tag each with the emitting `agent`.

- Line-anchored findings keep their full JSON-envelope shape (see `reference/output-format.md`).
- A prose finding becomes `{"agent": "...", "kind": "prose", "tag": "must" | "suggestion", "text": "..."}`.

Do not dedupe, triage, or drop here — assembly is lossless; triage belongs to the consumer.

## Atomic write to /tmp/

Sanitize the branch name (a `/` breaks the path); the `run_id` keeps concurrent runs from colliding. Write to a `.tmp` sibling first, then rename — a reader must never see a half-written file:

```bash
SANITIZED_BRANCH=$(git rev-parse --abbrev-ref HEAD | tr '/' '-')
FINDINGS_FILE="/tmp/code-review-findings-$SANITIZED_BRANCH-$RUN_ID.json"
# Write the review object with the Write tool to "$FINDINGS_FILE.tmp", then:
mv "$FINDINGS_FILE.tmp" "$FINDINGS_FILE"
```

The same `write-to-.tmp-then-rename` pattern is used for the shared diff file in Step 0.2.

**Surface both** the object (an in-context caller reads it directly) and `$FINDINGS_FILE` (a cross-session caller reads the file — and must verify the file's `run_id` field matches the `run_id` it expects before trusting possibly-stale `/tmp/` content).
