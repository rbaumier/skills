---
name: veille-agentic
description: Veille on how practitioners code with AI agents (last 6 months), compared against the current repo's agentic setup, with a ledger so a rerun only brings what is new. Works on any repo.
disable-model-invocation: true
---

You are the coordinator. You judge and dispatch; scripts and headless sessions read the web, one agent reads the repo. The deliverable is a French markdown report of **every** relevant recommendation — no top-N cut — each one weighed against what the repo already does.

## State

Everything persists under `~/.claude/veille-agentic/`:

- `sources.jsonl` — every source ever read, kept or dropped (schema in `RESEARCH.md`). Shared across repos: a source read once is never re-read.
- `feeds.tsv` — the people, company, digest, video and changelog feeds polled each run (`url`, `all|kw` filter, newest item at last probe). `channels.tsv` — HN, Reddit, Lobsters, GitHub and arXiv queries. A source found twice by WebSearch earns a row here instead.
- `knowledge.md` — what past runs settled (claims confirmed, contradicted, dead ends), so sessions do not rediscover it. `log.md` — one block per run: date, repo, per-axis status (`effect|no_new|failed`), cost, what to change next time.
- `bin/` — `harvest.py`, `launch.py`, `verify.py`, `probe_feeds.py`.
- `repos/<slug>/recos.jsonl` — `{"id","title","keywords":[…],"sources":[urls],"first_proposed","last_seen","status","reason"}`, `status` ∈ `proposed | accepted | adopted | rejected | already-present` (`accepted` : l'utilisateur a dit oui, pas encore en place).
- `repos/<slug>/<YYYY-MM-DD>.md` — one report per run.
- `runs/<YYYY-MM-DD>-<slug>/` — `window.txt`, `inventory.md`, `harvest.jsonl`, `seen.txt`, `skip.txt`, `raw/`, `logs/`, `verify.jsonl`.

`<slug>` is the `origin` remote's path with `/` → `--`, or the toplevel's basename when there is no remote.

## Budget

Research sessions run on **sonnet**, 8 in parallel at most; the synthesis on **opus**. Each session caps itself (60 WebSearch, 120 reads, `RESEARCH.md`). Tell the user the number of running sessions at every change (`logs/_launch-<jobs file>.txt`); if they report quota pressure, stop launching and kill nothing that is half-written without asking.

## Steps

1. **Window.** Floor = today − 6 months. Write `"<floor> → <today>"` to `window.txt`. Read `log.md` and the last report of `repos/<slug>/`, if any. Done when `inventory.md` opens with the floor, the previous run date (or none), and the count of known URLs.

2. **Inventory** — one `general-purpose` agent, in parallel with step 3. Brief: list the repo's agentic setup as it exists *today*, citing paths: `CLAUDE.md`/`AGENTS.md` and what they import (line counts, approximate tokens loaded at startup), `.claude/` (settings, hooks, agents, skills, commands), `~/.claude/` (global CLAUDE.md, skills, agents, hooks, plugins and the mods they carry, MCP servers), architecture guards and lints, pre-commit hooks, local gates/CI, test layers, docs aimed at agents, memory files, and drift between what docs say and what exists. Name the **stack** (languages, frameworks, database, forge, frontends). For each `proposed` reco of `recos.jsonl`, say whether it is now in place (→ `adopted`) with evidence. Read-only. Done when every category is named (empty → "none") and every `proposed` reco has a verdict.

3. **Harvest.** `python3 ~/.claude/veille-agentic/bin/harvest.py <floor> <run dir>` — no WebSearch, ~2 min. Report its `failed` list. Split `harvest.jsonl` into chunks of ~250 lines (`split -l 250 -d harvest.jsonl harvest-`). Done when the chunk files exist.

4. **Research.** Write `jobs.tsv` (`name<TAB>axis<TAB>focus`):
   - one row per harvest chunk: `harvest-NN<TAB>auto<TAB>harvest chunk <run dir>/harvest-NN — triage per RESEARCH.md § Harvest triage`;
   - one row per topic axis of `RESEARCH.md`, except an axis whose status was `no_new` in the last two runs of `log.md` (it runs every third run only);
   - one `stack-<name>` row per stack component from the inventory (focus: practices for agents on that stack — lints, idioms, its community's AI policy, its tool vendors' blogs).
   
   Then `python3 ~/.claude/veille-agentic/bin/launch.py <run dir> jobs.tsv 8 sonnet` in the background, and watch it with Monitor on `logs/_launch-<jobs file>.txt`, reporting the running count to the user. The `x` axis runs meanwhile as the one in-process `general-purpose` agent driving Chrome (read-only), seeded with: @bcherny @trq212 @_catwu @lydiahallie @ClaudeDevs @thsottiaux @embirico @steipete @badlogicgames @mitsuhiko @GeoffreyHuntley @mattpocockuk @dexhorthy @doodlestein @thdxr @leerob @ericzakariasson @kieranklaassen @danshipper @Steve_Yegge @GergelyOrosz @swyx @simonw @hamelhusain @addyosmani. Done when every job printed a status (`launch.py` retries a missing one once).

4a. **Skill comparison.** Run `python3 ~/.claude/veille-agentic/bin/skill_usage.py ~/.claude/veille-agentic/skill-usage.tsv` (last use of every skill, from the transcripts). For each skill used in the last 60 days, one `skill-compare` job (5 skills per job) finds its 5 to 6 best external equivalents, in two waves of 3 so the second excludes what the first read (skills.sh, anthropics/skills, the official marketplace, top publishers, awesome lists), reads both `SKILL.md`, and records `improvements` per RESEARCH.md. The report gets a « Améliorer mes skills » section, one entry per skill, and the hand-over lists the skills unused for 60 days as sorting candidates.

4a''. Skill suggestions: skill suggestions are never applied as found: an opus pass writes each as the shortest exact edit (`synth/edits/BRIEF.md`), then `bin/edits_wave.py <run> <tag>` has opus write then judge each one, refusing by default (`synth/edits/JUDGE.md`: a concrete failure avoided, not already covered, true to the skill's intent, worth its words); refused ones are listed apart with the reason. Copy both briefs from the last run. Before rendering, `bin/translate_fr.py <run>` translates into French every displayed string that is not skill content (cached in `synth/fr.json`).


4a'. **Upstream of downloaded skills.** Skills come in by gitpick, which records no provenance. `python3 ~/.claude/veille-agentic/bin/upstream_find.py` searches GitHub code for distinctive lines of every skill not yet in `upstreams.tsv` (≈ 7 s per query, so run it in the background) and appends `skill, repo, dir, base, found_by`; a `-` repo means none found, a line the user corrects is kept. Then `upstream_scan.py <run dir>` clones each upstream, takes as base the upstream commit closest to the local `SKILL.md`, and writes `upstream/<skill>/upstream.diff` (what upstream changed since) and `local.diff` (what the user changed). `bin/upstream_wave.py <run>` runs one opus job per 6 skills with `upstream-ahead`, `both-changed` or `differs-no-base` (brief `synth/UPSTREAM.md`), writing `synth/skill-upstream-*.json` in the skill-compare format (`verdict: "upstream"`): each upstream change worth porting, never one that undoes a deliberate local change, a checkable one as a comply rule. The HTML shows them under « Améliorer mes skills », and the hand-over names the matches to confirm (`found_by` gh code search).

4b. **Gap wave.** Collect `angles_not_covered` and `channels_failed` from the status lines. One more job per angle, same launcher, output `raw/<axis>--<angle-slug>.jsonl`. Done when every listed angle has its file or a reason in `inventory.md`.

4c. **Verify.** `python3 ~/.claude/veille-agentic/bin/verify.py <run dir>`. Done when `verify.jsonl` exists; report its summary line.

5. **Synthesis** — a run keeps ~2 000 A/B sources, more than one context holds, so it goes in two passes:
   - `python3 ~/.claude/veille-agentic/bin/synth_prep.py <run dir>` gives every source its opaque id (`synth/sources.tsv`) and writes one compact digest per theme (`synth/digest-<theme>.md`, verify marks included);
   - `python3 ~/.claude/veille-agentic/bin/synth_launch.py <run dir> <repo> 5` runs one opus session per theme on `SYNTHESIS.md` (5 in parallel), each writing `synth/section-<theme>.md` and `synth/recos-<theme>.jsonl`;
   - one opus `general-purpose` agent then merges the sections into the report: dedupes recos across themes, writes « En deux minutes », « Depuis le dernier passage », « Ce qui a changé dans le processus de veille » (from the run's `process-changes.md`, if any) and the annex from `sources.tsv`.
   Across the two passes the synthesis:
   - merges duplicates across axes (same idea, several sources → one reco citing all) and gives each source an opaque id `[S001]`;
   - cites as fact only claims whose excerpt `verify.jsonl` found, or says "non vérifié";
   - weighs independence: three posts repeating one vendor post are one source; `vendor-self`, `affiliate`, `llm-shaped` flags lower weight;
   - drops tier C from the body (annex and ledger keep them);
   - for every idea: what the repo already does (path), the gap, the expected gain, effort, context/token cost, risk;
   - classifies each reco **nouvelle**, **renforcée** (already proposed, new evidence), **déjà en place** (cite where; short), **contredite** (cite both sides, `stance: against` sources included);
   - matches every candidate against `rejected` recos by `keywords` as well as title, and re-lists one only when a new tier A source changes the case, saying so;
   - checks risky claims (undocumented env vars, removed tools, hidden commands) against the official docs before recommending, and labels what it could not confirm;
   - writes the report per the template below.
   Done when every kept source is cited by a reco or set aside with a reason.

6. **Ledger.** Append every record of `raw/*.jsonl` to `sources.jsonl` (dedupe on normalized URL, keep the first). Upsert `recos.jsonl` (new → `proposed` with `keywords`, `last_seen` = today on cited ones, statuses from step 2). Add to `feeds.tsv` the `feeds_proposed` that `probe_feeds.py` confirms. Append the settled facts to `knowledge.md` and this run's block to `log.md`. Done when `jq -s 'group_by(.url)|map(select(length>1))|length' sources.jsonl` prints `0`.

7. **Hand over.** The markdown report is the archive; the user reads the concise page. One opus agent condenses every reco of the report into `synth/recos-concise.json` (title ≤ 10 words, action ≤ 30, gain with its best number ≤ 25, effort, gain, risk, `unconfirmed`, `top`, ≤ 3 source ids, plus `already_present` and the most decision-relevant `disagreements`; it checks the count equals the report's `####` blocks), then `python3 ~/.claude/veille-agentic/bin/render_html.py <run dir> repos/<slug>/<date>.html <repo> <date>` and `open` it. Give the HTML path first, then:
   - five lines: sources read / kept / already known, recos new / reinforced / adopted since last run;
   - **the 2-minute block**: the three to five recos with the best gain/effort, one line each;
   - the skill suggestions carry Accepter / Refuser buttons; the user exports `skill-decisions.json` and `python3 ~/.claude/veille-agentic/bin/skill_decisions.py <file> repos/<slug>` merges it into `repos/<slug>/skill-decisions.jsonl`, which the next render shows and the next run never re-proposes as new;
   - ask which recos to mark `rejected` (record the answer with its reason), and offer to file the chosen ones as issues through `/issue`.

## Report template

```markdown
# Veille agentique — <repo> — <date>
Fenêtre : <floor> → <today> · passage précédent : <date|aucun> · sources lues <n>, gardées <n>, déjà connues <n>

## En deux minutes
<3 à 5 recos, une ligne chacune : quoi, gain, effort>

## Depuis le dernier passage
<recos adoptées depuis, recos renforcées, nouveautés majeures — absent au premier passage>

## Recommandations
### <thème>
#### <titre de la reco> — [nouvelle|renforcée|contredite]
- **Idée** : …
- **Sources** : [S012] A, auteur, date — ce qu'elle mesure ou montre ; [S040] B …
- **Chez nous** : ce qui existe déjà (chemin) ou « rien »
- **Écart et gain attendu** : …
- **Effort** : S/M/L · **Coût contexte** : … · **Risque** : …

## Déjà en place, confirmé par les sources
## Points de désaccord
## Ce qui a changé dans le processus de veille
## Annexe — sources
| Id | Tier | Date | Auteur | Titre (lien) | Axe | Retenue | Raison |
```
