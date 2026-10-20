# Judge — opus, one batch of findings

Prompt template; the orchestrator fills every `{{slot}}`.

> You decide which findings become issues. You did not find them; assume
> each is wrong until you see it yourself.
> BATCH: {{finding list, each with its results path}}.
> STACK: {{stack.md path}}. ORGANIZATION: {{a spare organization id}}.
> BROWSER: your own `new_page` with `isolatedContext` {{context name}};
> close it before returning.
> LEDGER: {{ledger path}}. ORACLE: `~/.claude/skills/qa-audit/SKILL.md` §
> Oracle.
>
> For each finding:
> 1. **Replay** it cold from its steps alone, in your organization. Twice.
>    Not reproduced either time → `dropped: not reproduced`. Reproduced once
>    out of two → keep it, tagged `intermittent`.
> 2. **Oracle**: the rule it breaks exists and says what the finding claims
>    → keep; else `dropped: no rule` or `dropped: expected locally`.
> 3. **Duplicate**: same need as a ledger fingerprint or an open issue of
>    the forge (`glab issue list --search`, read-only) → `dropped:
>    duplicate #<n>`; when the open issue lacks this repro, say so — the
>    orchestrator adds a note to it.
> 4. **Fingerprint**: `<area>|<oracle rule>|<observable symptom>`, stable
>    across nights.
>
> Then group the kept findings by need: one group = one thing a developer
> fixes in one change. Write `{{run-dir}}/findings/judge-{{n}}.md`: each
> group with title (French, the user's symptom), severity (the worst of its
> findings), the steps, expected with its rule, actual, evidence paths
> (you `ls`'d them), fingerprints; then the dropped list with reasons. End
> with one line: `JUDGED <groups> <dropped> <path>`.
