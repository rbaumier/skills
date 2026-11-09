# Points de contrôle et cibles

Un **point de contrôle** juge, refuse ou décide. Il échoue de deux façons :
il **fuit** (le défaut passe, un point plus loin l'attrape) ou il **bloque à
tort** (refus, rework ou rouge sans défaut réel). Sources : `T/` = tables
d'`extract.py`, `R/` = racine des rapports de la run.

| # | Point | Sources |
|---|---|---|
| 1 | `/issue` : scoper, reviewer, `check.sh` | spawns `issue-*`, `R/**/draft-*.md`, `published.md` |
| 2 | Tri et questions tranchées | `R/state.md` (`skip:`), `decision.md`, `clarification-note.md`, `a-savoir-*.md` |
| 3 | Revue de contrat | `contract-review.md`, `T/lots.tsv` (lots sans revue de contrat) |
| 4 | Auto-contrôle du builder | `slice-*.md`, `contract.md`, `T/reports.tsv` contre les constats de la revue qui suit |
| 5 | Hooks | `T/error_kinds.tsv` (`hook error`, `Refused`, `Blocked`) |
| 6 | Pre-commit du dépôt | `T/errors.tsv` sur `git commit` |
| 7 | comply (pack, deliver, `comply-added`) | `comply-raw*`, `comply.err`, `T/comply.tsv`, `report-fp` |
| 8 | Autres lints et `.sqlx` | `ship-*.md`, `merge-*.log` (rouges hors comply) |
| 9 | MR : description, captures | `mr-description.md`, `deliver-*.md` |
| 10 | Rounds de revue | `T/findings.md` (ids `F`), `fix-*.patch`, `.rework`, round suivant |
| 11 | Constats non payés et audits | `R/constats.md`, `R/audit-*/` |
| 12 | Fusion (`ci/lib/merge`) | `merge-*.md`, `merge-*.log`, `mechanic-*.md` |
| 13 | Dérive de la branche par défaut | `git log` intégration contre `origin/<default>` |
| 14 | Pipeline de la forge | MR de la run, réglages du projet |
| 15 | `ci/check` de clôture | `R/closing/check-*.log` |
| 16 | e2e (runner, pile partagée) | `R/e2e-runner/` |
| 17 | QA et Breakers | `R/closing/qa/`, constats `F` des `verdict*.md` |
| 18 | Fix lots de clôture | `R/closing-fix-*/` |
| 19 | Release (`publish`, `deploy`) | logs de release, `state.md` |
| 20 | Après la release | issues ouvertes depuis la release (`glab issue list`), Chatwoot, correctifs sur la branche par défaut |
| 21 | Effets de la forge | `Closes #` de la MR finale contre les issues réellement fermées |
| 22 | Orchestrateur | `T/boilerplate.tsv`, `T/repeats.tsv`, `T/sends.tsv`, lignes `orchestrator:` de `T/spawns.tsv` et `T/errors.tsv`, 🐢 de `state.md` |
| 23 | Romain | `T/user.tsv` : chaque relance, correction ou « pourquoi » |
| 24 | Deltas `/reflect` précédents | `~/.claude/reflect/**/report.md` (étape 2) |

## Cibles

Chaque recommandation vise la cible qui aurait empêché l'événement.

| Cible | Où |
|---|---|
| Skill de la boucle | `~/.claude/skills/loop-issues/*.md` |
| Autres skills | `~/.claude/skills/*` (`issue`, `qa`, `quality-bar*`, `ponytail*`, `e2e`, `testing`, langages), `<repo>/.claude/skills/*` |
| Définitions d'agents | `~/.claude/skills/loop-issues/agents/*.md`, `~/.claude/agents/*.md` (outils, modèle, effort, limites) |
| Hooks | `~/.claude/skills/loop-issues/hooks/*`, hooks de `settings.json` |
| comply | `<repo>/comply.toml` : règle manquante, faux positif récurrent, règle jamais déclenchée, sévérité |
| Portes CI | `<repo>/ci/**` |
| Docs du dépôt | `CODING_STANDARDS.md` et ses guides, `docs/review-checklist.md`, `DESIGN.md`, `docs/agents/*`, `CONTEXT.md`, `CLAUDE.md` |
| Mémoire | `~/.claude/projects/<projet>/memory/` : entrée contredite ou inutile |
| Environnement | `~/.zshrc`, `~/.claude/settings.json`, outils installés |
