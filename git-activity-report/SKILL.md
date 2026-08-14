---
name: git-activity-report
description: Generate a CTO-oriented git activity audit report (French) for the current repository. Use when asked for a "rapport d'activité git", "qui travaille sur quoi", a review-health check, or a bus-factor analysis.
---

# Rapport d'activité git

Produit un rapport markdown d'audit d'activité de l'équipe sur le dépôt courant, avec un regard de CTO de startup — tranché, chiffré, actionnable. Le rapport est écrit **en français**.

## Paramètres

- **Période** : `N = 90` jours par défaut (surchargeable par l'utilisateur). Fenêtre = `aujourd'hui − N jours → aujourd'hui`.
- **Sortie** : `.git-analysis/$(date +%Y-%m-%d-%H%M).md` à la racine du dépôt.
- **Mémoire** : compter les rapports déjà présents dans `.git-analysis/` (hors celui en cours d'écriture). S'il y en a, lire le plus récent et ajouter des comparaisons de tendance (volume, h/jour, self-merge %, évolutions par dev) dans chaque section pertinente. Sinon, indiquer « premier rapport — baseline ».

## 1. Collecte des données

### Commits

```bash
git log --all --no-merges --since="$N days ago" \
  --pretty=format:'%H|%an|%ae|%ad|%s' --date=format:'%Y-%m-%d %H:%M'
```

- **Dédoublonner par hash** (un commit présent sur plusieurs branches ne compte qu'une fois).
- Les heures affichées par `--date=format:` sont dans le **fuseau de l'auteur** — c'est la référence pour le profil horaire (ne pas convertir en heure locale).
- Pour les domaines d'expertise, refaire un passage avec `--name-only` par développeur.

### Fusion des identités

`git shortlog -sne --all --since=...` pour lister les identités. Fusionner celles qui appartiennent visiblement à la même personne (même email avec noms différents, pseudos évidents, `.mailmap` s'il existe). En cas de doute, demander à l'utilisateur. Toujours documenter les fusions dans une note sous le tableau global (ex. « X utilise 3 identités git — fusionnées ici »).

### MR/PR et protection de branche

Détecter la plateforme via `git remote -v` : GitLab → `glab` (ou MCP gitlab), GitHub → `gh`. Récupérer :

- les MR **créées dans la fenêtre** : auteur, état, date de création, date de merge, mergée par, nombre de commentaires/reviews ;
- les **règles de protection** de la branche principale (approbations requises ? push direct autorisé ?) — alimente la section risques.

Si aucun CLI/API disponible, omettre les sections MR avec une note explicite en méthodologie.

## 2. Calculs

- **Heures estimées** : par dev et par jour actif : `(dernier commit − premier commit) + 30 min de préparation`, **cap 10h**, **plancher 0.5h**. Sommer par mois et sur la période.
- **h/jour** : heures estimées ÷ jours actifs.
- **Self-merge** : `merged_by == auteur` de la MR. Un push direct sur une branche principale sans MR est signalé à part.
- **Review donnée** : commentaire de review, approbation, **ou merge de la MR d'un autre** — noter la nature entre parenthèses, ex. `1 (merge !46)`.
- **TTM** (time-to-merge) : `date de merge − date de création`, médiane par dev, en jours.
- **Profil horaire** : matin < 12h, après-midi 12h–18h59, soirée ≥ 19h — en % des commits, heure de l'auteur.
- **Weekend** : % de commits le samedi/dimanche.
- **Pause** : trou > 14 jours sans commit pour un dev actif — signaler la durée et les dates. Inclure le **trou terminal** (dernier commit → date du rapport) : « plus rien depuis X jours ».
- **Burst** : ≥ 8 commits en moins de 4h. **Marathon** : journée > 8h estimées.
- **Conventional commits** : message matchant `^(feat|fix|chore|docs|refactor|test|ci|perf|build|style|revert)(\(.+\))?!?:` — ratio sur le total.
- **Messages low-quality** : message ≤ 2 mots sans contenu descriptif, ou purement mécanique (ex. `wip`, `rebase done`, `before cherry pick`) — lister verbatim avec l'auteur.
- **Typos** : relever les fautes de frappe dans les messages (signal de précipitation, pas critique).
- **Reverts/hotfixes** : compter les `revert`/`hotfix` — leur absence est un signal positif à mentionner.

## 3. Structure du rapport (sections dans cet ordre)

Titre : `# Rapport d'activité git — <service> (<projet>)` où `<service>` est le nom court du composant audité (dossier sans préfixe d'organisation) et `<projet>` le nom du projet sur la plateforme, tiré du remote. En-tête : période, date de génération, nombre de rapports historiques (cf. Mémoire). Format exact : voir [EXAMPLE.md](EXAMPLE.md). Séparer chaque section de niveau 2 par `---`.

1. **Résumé exécutif** — 4-6 puces : devs actifs, volume total avec commits/jour **et qualification** (faible/normal/élevé), MR mergées + % self-merges, concentration du volume (top dev), et le **constat principal** en gras.
2. **Tableau global par développeur** — colonnes : Dev, Commits, Jours actifs, Heures estimées, h/jour, MR mergées, Self-merges. Ligne **Total**. Notes sous le tableau (identités fusionnées, push directs sans MR).
3. **Tableau mensuel par développeur** — une sous-section par dev : Mois, Jours, Commits, Heures, h/jour + une phrase d'interprétation (progression, burst unique, décrochage…).
4. **Heatmap journalière** — bloc ASCII, une ligne par identité **non fusionnée** (pour rendre visibles les identités alternatives). Format exact et légende : voir [EXAMPLE.md](EXAMPLE.md).
5. **Analyse MR/PR — Santé review** —
   - Sous-titre : `### MR dans la fenêtre (créées après le <date de début>)`. Tableau trié antichronologiquement : MR, Auteur, État, Créée, Mergée, Mergée par, Self-merge (**OUI** en gras), Reviews.
   - Tableau de synthèse par dev : MR créées, MR mergées, Self-merges (avec %), TTM médian, Reviews données, Reviews reçues.
   - **Verdict** : une phrase tranchée en gras, suivie de 2-3 preuves chiffrées.
6. **Bursts et patterns** — une sous-section par dev : profil horaire, weekend, bursts/marathons, pauses. Les identités secondaires fusionnées ont leur **propre sous-section** (ex. « Cyrik (identité secondaire de X) »). Qualifier chaque signal (« bon signal », « drapeau si ça se répète », « décrochage majeur »).
7. **Domaines d'expertise** — tableau Dev × Zone 1/2/3 (répertoires les plus touchés, compte de fichiers si ≥ 10). Puis **chevauchements** (potentiel de review croisée) et **silos** (modules touchés par un seul dev).
8. **Qualité des commits** — conventional %, messages low-quality verbatim, reverts/hotfixes, typos.
9. **Analyse CTO startup** — six sous-sections numérotées :
   1. Répartition de charge (déséquilibres, qui fait tourner le produit)
   2. Santé review (et ses risques concrets : bugs non détectés, pas de transfert de connaissance)
   3. Patterns de travail / risque burnout (dev par dev)
   4. Qualité du delivery (taille des MR, TTM, discipline commit)
   5. Risques identifiés — liste numérotée, **bus factor** en premier si pertinent, protection de branche vérifiée en 1. Collecte
   6. Recommandations actionables — liste numérotée, chaque item = action concrète en gras + le « pourquoi/comment » (config à activer, personne à cibler, module concerné)
10. **Méthodologie & limites** — rappeler : formule d'estimation des heures, ce qui n'est pas capturé (review, réunions, debug, pair-programming), source des données MR, fusions d'identités, `git log --all --no-merges` + dédoublonnage par hash, rôle mémoire de `.git-analysis/`.

## Ton et exigences

- Chiffré partout : chaque affirmation s'appuie sur un nombre (« 27/45 commits », « 83% de self-merges »).
- Tranché, pas diplomatique : « Inexistante. », « Déséquilibre critique. » — c'est un audit interne, pas un rapport RH.
- Interpréter, pas seulement compter : une pause de 52 jours appelle une question (congé ? départ ? réaffectation ?), pas juste un constat.
- Ne rien inventer : si une donnée manque (pas d'API MR, historique tronqué), le dire en méthodologie plutôt que d'extrapoler.
