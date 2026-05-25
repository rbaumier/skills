---
name: code-review-loop
description: Use when the user wants a thorough, autonomous code review of the current branch. Also use when the user asks to stress-test code quality, run a deep review, or review before merge. Spawns specialized review agents in parallel, fixes all findings, and loops until every agent has zero feedback.
---

# Code Review Loop

Run a `code-review` pass, fix every finding, re-run to convergence. The user doesn't intervene between iterations.

**This skill composes `code-review`.** `code-review` is the read-only review pass — it detects which lenses apply, fans specialized agents out in parallel, and returns one structured review object. `code-review-loop` adds the half a single pass can't do: triage, fix, revalidate, commit, loop, and the runtime dogfood gate. The decision of *whether* a diff is worth reviewing lives in `code-review`'s "When not to use" gate — this skill delegates to it (Step 1) and stops early if the gate returns `tier: trivial`.

## Anti-shortcut — stop if any cross mind

`code-review` carries the anti-shortcuts for the fan-out itself. These two are the loop's:

| Temptation | Reality |
|---|---|
| "Drop findings 'mineurs' pour converger plus vite" | Step 4 severity-based convergence already does this. `suggestion` doesn't block; `bug`/`security`/`performance`/`error_handling` do. |
| "L'itération 2 = mêmes choses, autant arrêter à 1" | Convergence is the loop's verdict, not yours. Step 4 decides. |

## Workflow

### Step 1 — Run the review pass

**Emit the data-capture marker FIRST**, on its own line in your assistant text, BEFORE invoking `code-review`:

```
<crl:run_start />
```

The marker must be emitted by *this* skill, in *this* session, before `code-review` spawns any agent. Pairing rules, session-id binding, and why `tier`/`trust_boundaries` ride on `run_end` instead: `reference/data-capture-markers.md`.

**Invoke `code-review`** via the Skill tool. It mints a `run_id` for the pass and returns the **review object**:

`{run_id, branch, head_sha, default_branch, tier, trust_boundaries, changed_files, dogfood_required, dogfood_surfaces, agent_roster, findings}`

and writes the same object to `/tmp/code-review-findings-<sanitized-branch>-<run_id>.json`.

**If `tier` is `trivial`** — `code-review`'s "When not to use" gate judged the diff not worth reviewing. There is nothing to loop on: go straight to Step 5 and report `Tier: trivial`. No fixes, no iterations.

**Otherwise**, the review object's `findings`, `agent_roster`, `tier`, `trust_boundaries`, `dogfood_required`, and `dogfood_surfaces` drive Steps 2–4.5.

**`DEFAULT_BRANCH` does not survive the skill boundary.** Steps 3–4.5 run `git` commands against it. Read `default_branch` from the review object and re-export it, or re-derive it once here with the *same* snippet `code-review` uses:

```bash
if [ -z "$DEFAULT_BRANCH" ]; then
  DEFAULT_BRANCH=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||')
  [ -z "$DEFAULT_BRANCH" ] && DEFAULT_BRANCH=$(glab repo view --output json 2>/dev/null | jq -r '.default_branch // empty')
  [ -z "$DEFAULT_BRANCH" ] && DEFAULT_BRANCH=$(git for-each-ref --format='%(refname:short)' refs/heads/main refs/heads/master refs/heads/develop 2>/dev/null | head -1)
  test -n "$DEFAULT_BRANCH" || { echo "ERREUR : default branch introuvable." >&2; exit 1; }
fi
```

### Step 2 — Process findings, drop bloat, then fix

Read the `findings` from the review object `code-review` returned. Process in funnel order:
1. L1 first. L1 says "delete this module" → discard findings about that module from other agents.
2. L2 next. L2 says "merge these files" → discard file-level findings on the originals.
3. Rest. Contradictions: simpler wins.

**Dedupe by signature before triaging.** Each line-anchored finding has `signature: <file>:<line>:<failure-mode-slug>`. Same defect flagged by N agents (Correctness + subsystem + language all spotting the same `unwrap()` on user input) → equivalent signatures. Tolerant matcher (per the JSON envelope spec in `code-review`): same file, line within ±3, same slug OR title-token Jaccard ≥ 0.6. Group:

- Keep the emission with the highest `confidence`. Tiebreak: most specific `fix_prompt` (concrete line + concrete replacement).
- Annotate the kept finding with `reported_by: [agent_name, ...]` (orchestrator-added). 3 independent agents converging = a strong triage signal.
- Discard duplicates entirely. Their fix_prompts are redundant; double-apply is a risk.

Dedup before the bloat filter. Else the fix fan-out gets N copies of the same `fix_prompt` and rewrites the same line N times (sometimes inconsistently).

**Filter bloat-shaped findings first.** Review agents bias toward additions. Bar = **sound + correct + elegant** — 2/3 is a signal to look harder, not to mechanically apply.

Two-step triage per finding:

1. **Failure mode real?** Read the cited code. Imagined scenario (e.g. null guard on a type-guaranteed value) → drop. `confidence: low` → re-derive the analysis_chain before accepting.
2. **Remedy bloated?** Real defect + bloated remedy → keep the finding, rewrite `fix_prompt` for the smallest fix. Real race + "mutex everywhere" = still a real race — find the narrow lock. Never drop a real defect over an ugly proposal.

Bloat shapes: defensive checks for impossible cases, abstractions used once, comments restating obvious code, tautological tests, "just-in-case" guards with no identified failure mode. The smallest diff fixing the real defect wins.

Survivors: fix every one regardless of vote count. A single-agent finding is as valid as one from seven; overlap is a confidence signal, not a priority.

**The findings carry `code-review`'s JSON envelope.** Line-anchored findings have `{file, line, severity, title, analysis_chain, fix_prompt, ...}`. `analysis_chain` is the auditable artifact: a chain that doesn't survive a re-read of the cited code → hallucination → drop without re-deriving.

**`fix_prompt` is the orchestrator's draft, not the reviewer's final word.** The bloat filter applies to fix prompts too: a real finding + a bloated remedy (mutex everywhere, defensive guard for an impossible case, one-shot abstraction) → rewrite it before forwarding. The verbatim contract is between **you and the fix agent**, not the reviewer and the fix agent. Once forwarded, fix agents apply without re-interpretation.

**Parallelize fixes.** Group findings by file. Spawn one fix agent (`sonnet`) per file group, in parallel. Each receives the list of post-triage `fix_prompt` strings for its file, in order. Fix agents don't load skills, don't re-derive from the original code, don't use `isolation: "worktree"` — they work directly on the current tree.

**Bugs get TDD.** A non-regression test that fails first, then fix until the test passes.

**Re-read your own fixes.** After fix agents return, re-read each changed file. A fix that now reads as bloat in context (guard for an impossible case, one-use abstraction, tautological test) → revert. Cheaper than catching it next review.

### Step 3 — Revalidate, verify, and commit

1. **Revalidate fixed findings before tests.** Scope: only `severity: bug | security | performance | error_handling` that entered the fix queue. Suggestions never fixed in the loop → never revalidated. Spawn ONE `general-purpose` subagent (`haiku`) using `templates/revalidation.md` — pass `signature`, `file`, `line`, `analysis_chain`, and the fix diff per finding by substituting `{findings_with_diffs}`. One agent handles all — a single Haiku call is cheaper than N parallel for a checklist.

2. **`open`/`uncertain` re-enter the fix queue.** Build new fix prompts from the original `fix_prompt` + a one-line note (`previous attempt failed revalidation: <why>`), spawn per-file fix agents, revalidate. Bound: max 3 attempts within a single Step 3 call (1 initial + 2 re-fixes). Track `attempts: N` per signature **across outer iterations** — write this cumulative counter into the previous-findings handoff file (Step 4) so it survives a re-invocation of `code-review`. Total ≥ 5 → stop fix-looping that finding, surface it in Step 5's open-suggestions with the failure trail. This is the only safeguard against the outer loop spinning on a stubborn finding.
3. Run the test suite.
4. Run the linter.
5. Fix failures.
6. Commit, describing what + why.

Dedicated revalidation exists because tests catch regressions but not pass-by-coincidence fixes (comment next to the bug, guard before the wrong line, rename suppressing a linter warning without fixing the logic). A fresh model asks "is the failure mode gone?" against the original `analysis_chain` — cheaper than slipping to the next iteration.

### Step 4 — Loop or stop

**Convergence is measured on Step-2-triage survivors, not raw agent output.** An agent that returned only imagined-failure-mode findings (all dropped at triage step 1) counts as converged — otherwise the same imagined findings resurface every iteration and the loop never terminates.

**Walk the review object's `agent_roster`.** It lists every agent `code-review` spawned with its result — so "agent ran and was clean" is distinguishable from "agent never spawned". Convergence requires every roster agent to meet one of:
- (a) `result: no-findings`, OR
- (b) all its findings were dropped at Step 2 triage step 1, OR
- (c) all its surviving findings are `severity: suggestion` (line-anchored) **or** carry the `[suggestion]` tag (prose: Funnel L1/L2, Materiality).

An agent with `result: error` is not converged — re-spawn it.

Suggestions are **not auto-fixed in the loop** — they are collected for Step 5, where the user decides. Auto-fixing every suggestion is the noisy-churn reputation of review tools. Bias toward stopping. `bug`/`security`/`performance`/`error_handling` still block convergence.

**Prose agents tag findings.** Funnel L1/L2 and Materiality emit text, not JSON → the convergence check can't read `severity:`. Their templates require each finding prefixed with `[must]` (blocks convergence) or `[suggestion]` (qualifies under (c)). Read the tag, not your own interpretation.

Converged → Step 4.5 (if `dogfood_required`) or Step 5.

**Hard cap: 8 outer iterations.** If iteration 8 finishes still not converged, stop — finalize the run as `capped` and let Step 5 emit `READY_FOR_FAIL_LABEL iter=8`. Convergence is the normal exit; this cap is the guaranteed one.

**Else re-run the review pass.** Re-invoke `code-review` with:

- `only_agents` — the agents whose non-suggestion findings survived triage, plus any agent whose scoped files a fix touched. Re-running the whole panel wastes wall time on agents already converged.
- `previous_findings_file` — the previous-findings handoff file (below).

`code-review` mints a fresh `run_id` for each invocation — don't pass one. Emit no new `<crl:run_start>` either; one marker pair bounds the whole loop.

**Write the previous-findings handoff file.** Before re-invoking, write `/tmp/code-review-prev-$SANITIZED_BRANCH-<run-id>.json` — `<run-id>` is the `run_id` from the review object you just processed, and sanitize the branch name first (`SANITIZED_BRANCH=$(git rev-parse --abbrev-ref HEAD | tr '/' '-')`), a `/` in it breaks the path. A JSON array, one entry per finding emitted last iteration. Each entry is the **full finding object** (every envelope field — not just `signature`), plus:
- `disposition` — `fixed` (a commit touched the cited line), `dropped-by-triage` (with the reason: imagined / bloat), or `unfixed` (still present).
- `attempts` — the **cumulative** fix-and-revalidate count for this signature, carried across every iteration. Step 3's `attempts ≥ 5` escalation reads this; if the counter resets each pass, a stubborn finding loops forever.

`code-review` reads this file and injects each agent's own prior findings as `{previous_findings_block}` so agents skip already-dropped findings, verify `fixed` ones actually resolved (catch superficial fixes), and emit genuinely new findings introduced by the fix commit.

Continue fixing, committing, and re-launching until convergence.

### Step 4.5 — Runtime dogfood gate (only if `dogfood_required` in the review object)

Static converged. The dogfood gate is the final validation — 3 personas (Happy-path/sonnet, Adversarial/opus, Regression/sonnet) spawned in parallel against the surfaces listed in `dogfood_surfaces`. Full protocol (persona spawn, in-scope vs out-of-scope triage, fix → loop-back into Step 2–4, convergence, non-convergence bail signals): `reference/dogfood-gate.md`.

Key cross-step rules to know without reading the reference:
- The 8-iter static cap applies to dogfood-triggered re-review — don't reset it.
- Re-running the dogfood gate after fixes uses no previous findings (each persona run is empirical, fresh).
- In-scope is fixed, out-of-scope is filed as a new issue; `failed-by-agent` from this phase only comes from non-convergence or static-cap propagation.

### Step 5 — Final output

**Fire the end marker + post-process FIRST**, in the SAME assistant turn, before any token or summary:

```
<crl:run_end outcome="<converged|capped|aborted>" iters="<N>" tier="<lite|full|trivial>" trust_boundaries="<csv|none>" />
```

```bash
node "$HOME/.claude/skills/code-review-loop/process-run.js"
```

`tier` and `trust_boundaries` come from the review object. Why they ride on `run_end` (not `run_start`) and the full marker contract: `reference/data-capture-markers.md`.

**If invoked from AFK** (instruction string starts with `AFK invocation`): emit exactly ONE single-line token as the last assistant text, nothing else.

- Static converged: `READY_FOR_MR iter=<N> findings_fixed=<C>`
- 8-iter cap: `READY_FOR_FAIL_LABEL iter=8 dump=<absolute path to findings-dump>`

Naming rationale (`READY_FOR_X` rather than `CONVERGED` / `DONE`), why the runner subagent expects "token, nothing else", and what never goes in the token: `reference/afk-output.md`.

**Otherwise** (direct user invocation): a short summary in the conversation. No file artifact.

Format:
- Tier: trivial / lite / full
- Iterations: N (converged on K)
- Agents per iteration: N₁ → N₂ → … (e.g. 12 → 4 → 0)
- Findings fixed: total count, grouped by agent
- Non-regression tests added: one bullet per bug (description → test name)
- **Open suggestions (not auto-fixed):** one bullet per surviving `severity: suggestion`, `file:line` + a one-line rationale. Empty section if none.

≤15 lines + the suggestions list. The diff is the source of truth; the summary just locates it.

---

## Agent Prompt Templates

The review-pass templates (Correctness, Tests, Subsystem, Skill, Funnel, Occam Razor, …) live in `code-review`. This skill owns only the templates for its own steps:

| Agent | Template | Model | Output |
|---|---|---|---|
| Revalidation (Step 3) | `templates/revalidation.md` | haiku | JSON |
| Dogfood — Happy-path | `templates/dogfood-agent.md` + Happy-path persona | sonnet | first-line convergence signal |
| Dogfood — Adversarial | `templates/dogfood-agent.md` + Adversarial persona | opus | first-line convergence signal |
| Dogfood — Regression | `templates/dogfood-agent.md` + Regression persona | sonnet | first-line convergence signal |
| Fix agents (Step 2) | (composed on the fly from each finding's `fix_prompt`) | sonnet | code changes |

**Revalidation.** Step 3 substitutes `{findings_with_diffs}` into `templates/revalidation.md`. One haiku agent handles every finding.

**Dogfood Agent.** 3 personas in parallel, same scaffolding (`templates/dogfood-agent.md`), differing only in `{persona_focus}` from `templates/dogfood-personas.md`. Before spawning, substitute `{persona}`, `{persona_focus}`, `{file_list}` (the review object's `changed_files`), and `{port}` (each persona's dedicated dev-server port). Dogfood receives no previous-findings — its output is empirical, fresh each run.

**Fix agents.** Not a file template — composed on the fly from post-triage `fix_prompt` strings, grouped by file (Step 2).
