---
name: legal
version: 2.0.0
description: |
  Vérification, audit et rédaction juridique de contenu textuel (contrats, conventions,
  programmes, CGV, emails, pages web, contrats de sous-traitance, factures freelance, NDA,
  politiques RGPD/cookies/lanceur d'alerte, lettres de licenciement, requêtes CPH, assignations
  en référé, notifications de violation de données, AIPD/DPIA, contrats NIL…).
  Routeur multi-spécialistes : selon le type de document, dispatche un ou plusieurs sous-agents
  juristes spécialisés (formation professionnelle France, droit social & contentieux, RGPD EU &
  multi-juridiction, politiques CNIL, contrats commerciaux & NDA, risque & recherche juridique,
  NIL NCAA), puis consolide en un rapport unique en français.

  Utiliser quand :
  - L'utilisateur tape /legal
  - Du texte est généré pour des documents contractuels (convention, contrat, attestation, CGV)
  - Une page marketing / un article de blog cite des obligations ou des articles de loi
  - L'utilisateur demande une vérification, un audit ou une rédaction juridique
  - Un contrat de sous-traitance / prestation freelance est rédigé ou modifié
  - L'utilisateur mentionne un risque social, une requalification, du prêt de main-d'œuvre
  - Un NDA, un contrat SaaS, une politique de confidentialité / cookies / lanceur d'alerte,
    une notification de breach RGPD, une AIPD/DPIA, une lettre de licenciement ou une requête
    prud'homale est en jeu
allowed-tools:
  - Agent
  - Read
  - Glob
  - Grep
  - AskUserQuestion
---

# Legal — Routeur juridique multi-spécialistes

Ce skill transforme une demande de revue / audit / rédaction juridique en un **rapport français
consolidé**, en dispatchant un ou plusieurs **sous-agents juristes spécialisés** (pattern `/del`).
La connaissance ne vit PAS dans ce fichier : elle est dans `references/` (modules distillés) et les
prompts spécialistes dans `agents/`. Le routeur ne fait que **détecter, dispatcher, consolider**.

Racine du skill : `~/.claude/skills/legal/`. Tous les chemins ci-dessous sont relatifs à cette racine.

## Étape 1 — Identifier le périmètre

- Argument = chemin de fichier (`/legal chemin/vers/fichier.md`) → lire ce fichier via `Read`.
- Sinon → chercher le contenu pertinent dans le contexte courant (fichiers modifiés, texte cité dans
  la conversation, pièce jointe).
- Si le périmètre n'est pas clair → demander via `AskUserQuestion`. Ne jamais lancer le pipeline sans
  contenu identifié.

Lire l'intégralité du contenu à analyser avant de router.

## Étape 2 — Détecter le(s) domaine(s)

Lire `references/INDEX.md` (table de dispatch : type de document → spécialiste(s) → dossier de
références → fondements clés). Croiser le type de document détecté avec cette table.

**Un document peut activer plusieurs spécialistes.** Exemples (cf. INDEX) :
- Contrat de sous-traitance freelance + annexe RGPD → `formation-france` + `contrats-commerciaux` + `rgpd-eu`
- CGV d'OF + politique de cookies → `formation-france` + `privacy-fr-cnil`
- Contrat SaaS traitant des données perso → `contrats-commerciaux` + `rgpd-eu`

Les 7 spécialistes disponibles (prompts dans `agents/`) :
`formation-france` · `droit-social-contentieux-fr` · `rgpd-eu` · `privacy-fr-cnil` ·
`contrats-commerciaux` · `risque-recherche-juridique` · `nil-sports`.

Afficher en un message court la liste des spécialistes retenus (1 ligne chacun : `Nom — pourquoi`).

## Étape 3 — Dispatcher les spécialistes (en parallèle)

Pour **chaque** spécialiste retenu, lancer un sous-agent via l'outil `Agent`. **Si plusieurs
spécialistes, les lancer en parallèle dans un seul message** (plusieurs appels `Agent` dans le même
bloc).

Pour chaque appel :
1. Lire `agents/<spécialiste>.md` (le prompt du spécialiste).
2. Lancer `Agent` avec `subagent_type: "general-purpose"` et un prompt composé de :
   - le contenu intégral de `agents/<spécialiste>.md` ;
   - puis : « Voici le document à analyser (type : … ) : \n\n<CONTENU> » ;
   - la consigne : « Lis d'abord, via Read, les modules `references/<domaine>/*` pertinents listés
     dans ton prompt, puis produis ton rapport au format imposé. Ne modifie aucun fichier. »
   - **Résolution des chemins** (à rappeler au sous-agent) : la racine de TOUS les chemins est
     `~/.claude/skills/legal/`. Dans la section « Modules » du prompt spécialiste, chaque sous-section
     indique un dossier de base (en en-tête après `→`/`—`, ou via `.../`, ou via « sous `references/X/…` ») ;
     les fichiers listés en dessous (`SKILL.md`, `references/xxx.md`, `assets/xxx.docx`) sont **relatifs
     à ce dossier de base** et se lisent en le préfixant (ex. base `references/rgpd-eu/gdpr-breach-sentinel/`
     + `references/enisa-methodology.md` → `~/.claude/skills/legal/references/rgpd-eu/gdpr-breach-sentinel/references/enisa-methodology.md`).

**Rétro-compatibilité** : le spécialiste `formation-france` est aussi exposé comme agent enregistré
`subagent_type: "legal-reviewer"` (utilisé par le hook `/humanizer` et d'autres flux). Pour le domaine
formation, l'un ou l'autre convient ; par défaut, utiliser `general-purpose` + `agents/formation-france.md`
pour rester homogène avec les autres spécialistes.

## Étape 4 — Consolider

Une fois les rapports reçus, fusionner en **un seul rapport français**. Si un seul spécialiste a été
lancé, restituer son rapport tel quel. Si plusieurs :

```
# Review juridique — <type de document>

**Conformité globale** : [conforme / partiellement conforme / non-conforme]
**Spécialistes mobilisés** : [liste]

<pour chaque spécialiste, sa section `## Review — …` intégrale>

## Synthèse transverse
- Points bloquants (toutes disciplines confondues), priorisés
- Risques cumulés / interactions entre domaines
- Recommandations de correction (sans modifier les fichiers)
```

En cas de désaccord ou de chevauchement entre spécialistes (ex. RGPD vu côté `rgpd-eu` et
`privacy-fr-cnil`), expliciter et trancher, ne pas masquer.

## Étape 5 — Règles du routeur

- **Ne jamais modifier** les fichiers analysés. Lister les corrections nécessaires ; ne les appliquer
  que sur demande explicite de l'utilisateur.
- **Rédaction** (assignation, politique, lettre, mémo) : seulement si l'utilisateur le demande
  explicitement. Le spécialiste produit alors le livrable (`.docx` via `references/_production-documents/`
  si un format Word est requis).
- Rester concis pendant l'orchestration (un message court par étape).
- Ne pas réinjecter la connaissance ici : toujours passer par `references/` et `agents/`.
