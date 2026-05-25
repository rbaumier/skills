# Agent table — templates, models, output shape, previous-findings shape

Each template lives in its own file under `templates/`. Read only the templates for the agents Step 0 detected — parallel reads, ~zero wall-time cost. Substitute placeholders before passing the text as the Agent's `prompt`.

**Line-anchored templates** (Skill, Tests, Subsystem, Correctness, CLAUDE.md Compliance, Occam Razor) require the Context verification + Output format blocks appended verbatim before spawning. **Funnel L1/L2, Materiality, Matt Review** are self-contained — don't append.

**Model assignment.** Heavy reasoning → `sonnet`, structural/textual lifts → `haiku`. The orchestrator (you) stays on the session model.

| Agent | Template | Model | Output | Trust boundaries | Prev-findings shape |
|---|---|---|---|---|---|
| Pre-triage (Step 0.5) | `templates/pre-triage.md` | haiku | JSON | — | — |
| Funnel L1 | `templates/funnel-l1.md` | haiku | prose tagged | — | B |
| Funnel L2 | `templates/funnel-l2.md` | haiku | prose tagged | — | B |
| Occam Razor | `templates/occam-razor.md` | sonnet | JSON line-anchored | `{trust_boundaries}` | A |
| Correctness | `templates/correctness.md` | sonnet | JSON line-anchored | `{trust_boundaries}` | A |
| matt-review | `templates/matt-review.md` | sonnet | prose Standards/Spec | — | B |
| thermo-nuclear-code-quality-review | `templates/thermo-nuclear-review.md` | sonnet | prose tagged | — | B |
| Subsystem (billing/auth/schema-migration/webhook/RBAC/multi-tenant/cron) | `templates/subsystem-agent.md` + `{subsystem_name}` + `{failure_modes}` | sonnet | JSON line-anchored | `{trust_boundaries}` | A |
| Tests | `templates/tests-agent.md` | sonnet | JSON line-anchored | `{trust_boundaries}` | A |
| Skill — heavy | `templates/skill-agent.md` + `{skill_name}` | sonnet | JSON line-anchored | `{trust_boundaries}` | A |
| Skill — light | `templates/skill-agent.md` + `{skill_name}` | haiku | JSON line-anchored | `{trust_boundaries}` | A |
| coding-standards (umbrella + 4 sub-skills) | `templates/skill-agent.md` + `{skill_name}` | sonnet | JSON line-anchored | `{trust_boundaries}` | A |
| claude-md-materiality | `templates/materiality.md` | haiku | prose tagged | — | B |
| claude-md-compliance | `templates/claude-md-compliance.md` | sonnet | JSON line-anchored | `{trust_boundaries}` | A |
| General Opus 4.7 | (no template, generalist prompt) | opus | line-anchored or prose | — | — |

## Heavy vs light Skill agents

- **Heavy:** `security-defensive`, `language-rust`, `language-typescript`, `language-swift`, `react`, `database`, `drizzle-orm`, `frontend`, `web-performance`, `api-design`, `simplify`, `matt-improve-codebase-architecture`
- **Light:** `i18n`, `tailwind`, `ui-animations`, `ui-ux`, `make-interfaces-feel-better`, `shadcn`, `vue`, `tanstack-query`, `tanstack-start-best-practices`, `better-result-adopt`, `docker`, `kubernetes`, `zod`

## Substitution notes

- **Subsystem Agent.** Substitute `{subsystem_name}` from the Step 0 subsystem-trigger row (e.g. `billing-subsystem`) and `{failure_modes}` from that row's "Failure modes" column. It doesn't load a skill — it's a framing label only.
- **Shared diff file.** Step 0.2 wrote the full diff to `/tmp/review-diff-<sanitized-branch>-<run_id>.patch`. Templates use `{diff_file}` — substitute the resolved path. Agents grep/filter the patch rather than re-running `git diff`. File-set with uncommitted files → agent reads those directly per Step 0.
- **Trust-boundaries placeholder.** Line-anchored templates use `{trust_boundaries}` for the comma-separated list from Step 0 (e.g. `secrets, network, auth`) or literal `none`. Substitute before spawning; never leave the placeholder literal.

## Previous findings injection (re-review only)

When invoked with `previous_findings_file`, read it — a JSON array of the prior pass's findings, each a **full finding object** annotated with `disposition` (`fixed` | `dropped-by-triage` | `unfixed`) and a cumulative `attempts` counter. For each agent you re-spawn, build `{previous_findings_block}` from *that agent's own* prior findings, using its shape from the table's last column:

- **Shape A** (line-anchored agents): `templates/previous-findings-shape-a.md`
- **Shape B** (prose agents): `templates/previous-findings-shape-b.md`

No `previous_findings_file` (first pass) → `{previous_findings_block}` is the empty string, no header. The cumulative `attempts` counter must survive every hop — it is what lets a consumer escalate a finding that has failed too many fix attempts. The consumer (e.g. `code-review-loop`) produces `previous_findings_file`; `code-review` only reads and injects it.
