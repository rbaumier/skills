# Skills — pipelines d'agents

Vocabulaire partagé des skills d'orchestration de ce dépôt, en premier lieu la boucle d'implémentation continue (`loop-issues`). Sert de référence quand un skill, un prompt de spawn ou une session parle d'un rôle ou d'un gate.

## Language

### Rôles (loop-issues)

**Orchestrateur** :
La session qui fait tourner la boucle — sélectionne, verrouille, spawne, relaie les one-liners, vérifie les gates, merge ; ne lit jamais le code source.
_Avoid_ : superviseur, main agent

**Planificateur** :
Agent fable one-shot qui lit l'issue et le code (read-only, sans worktree), décide du split et écrit le plan-contrat.
_Avoid_ : architecte, planner persistant

**Implémenteur** :
Agent opus qui exécute le plan-contrat dans un worktree, écrit les fixes des rounds de review et dispose de chaque finding.
_Avoid_ : codeur, fixeur (c'est le même agent)

**Reviewer** :
Agent fable read-only persistant sur toute la MR, qui produit des findings exhaustifs avec fix proposé, round après round, jusqu'à convergence.
_Avoid_ : correcteur (il n'édite jamais)

**Exécuteur QA** :
Agent opus qui conduit l'application réelle selon la matrice QA du plan-contrat et rend un verdict GO / GO-PROVISIONAL / NO-GO / ABORTED.
_Avoid_ : testeur

### Artefacts et mécanique

**Plan-contrat** :
Fichier écrit par le planificateur (scratchpad, hors worktree) : périmètre, décisions, tests attendus, non-buts, matrice QA — l'implémenteur le suit et documente tout écart.
_Avoid_ : spec, plan d'implémentation informel

**One-liner** :
L'unique ligne de sortie d'un agent enfant (verdict + chemin du fichier rapport) ; tout rapport recopié verbatim ailleurs est une process failure.

**Gate** :
Condition bloquante avant push/merge — comply, boucle review/fix convergée, QA GO/GO-PROVISIONAL.

**Convergence** :
État où le reviewer ne rapporte plus rien au-dessus de `nit` (cap 8 rounds ; cap atteint → draft flaggée, jamais mergée).

**Disposition** :
Le sort tranché par l'implémenteur pour chaque finding — fixed, filed (issue liée) ou dropped avec raison ; la table des dispositions est renvoyée au reviewer à chaque round.

## Relationships

- L'**Orchestrateur** spawne un **Planificateur** puis un **Implémenteur** par issue/tâche.
- L'**Implémenteur** spawne son **Reviewer** (un seul, persistant) et son **Exécuteur QA**.
- Le **Plan-contrat** alimente l'**Implémenteur** (contrat), le **Reviewer** (input round 1) et l'**Exécuteur QA** (matrice).
- Les notifications des enfants remontent toujours à l'**Orchestrateur**, qui ne relaie que la **One-liner**.

## Example dialogue

> **Dev :** « Le **Reviewer** a trouvé un bug, il le corrige ? »
> **Expert :** « Jamais — il propose un fix dans son finding, c'est l'**Implémenteur** qui commit et qui tranche la **Disposition** ; le **Reviewer** la conteste au round suivant s'il la juge injustifiée. »

## Flagged ambiguities

- « implémenteur » et « fixeur » désignaient parfois deux rôles — résolu : un seul agent, du worktree au push.
- « plan » désignait tantôt le plan d'implémentation, tantôt le plan QA — résolu : un seul **Plan-contrat**, la matrice QA en est une section.
- « fable partout » (implémenteur inclus) était le réglage historique — résolu : fable aux pôles de jugement (planificateur, reviewer), opus à l'exécution (implémenteur, QA) pour préserver le bucket hebdo fable.
