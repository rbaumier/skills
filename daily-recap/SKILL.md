---
name: daily-recap
description: Récap quotidien cross-projets GitLab, formaté pour Slack — features, correctifs, reviews, en-attente, avec liens MRs/tickets et captures des UIs livrées.
disable-model-invocation: true
---

# Daily recap

Récap de la journée de travail à partir des events GitLab de l'utilisateur, prêt à coller dans Slack.

## Argument

`/daily-recap [date]` — `YYYY-MM-DD` ou `hier` ; défaut : aujourd'hui (jour calendaire local).

## 1. Collecte

- Résoudre la date cible `D`.
- `mcp__gitlab__list_events` avec `after = D−1`, `before = D+1`, `per_page: 100` — **paginer jusqu'à épuisement** (une page pleine = il en reste peut-être).
- `mcp__gitlab__list_todos` avec `state: pending` — ne retenir que les types **bloquants** : `review_requested`, `approval_required`, `build_failed`, `unmergeable`. Les todos `assigned`/`mentioned`/`directly_addressed` sont du backlog d'issues, pas des attentes du jour — écartés.

Fait quand : toutes les pages d'events sont lues et les todos pending récupérés.

## 2. Enrichissement

- Pour chaque MR/issue référencée par un event : titre, état, URL web (`get_merge_request` / `get_issue`).
- Fusionner les events d'une même MR/issue en un seul item (push + comment + merge sur !42 = un item).

Fait quand : chaque item candidat porte un titre et une URL cliquable.

## 3. Captures d'UI

Item UI = sa MR touche du front (`list_merge_request_changed_files` : `.vue`/`.tsx`/`.jsx`/`.svelte`/`.css`/`.scss`, templates, dossiers `components`/`pages`/`views`). Pour chacun, joindre une capture de ce qui a été livré — sourcing dans l'ordre, premier qui aboutit :

1. Image déjà uploadée sur la MR (description ou notes) → `download_attachment` vers le scratchpad, nommée `recap-<date>-<projet>-<iid>.png` (suffixe `-2`, `-3` si plusieurs).
2. Capture live : le changement est visible sur une URL atteignable (review app de la MR, staging, app locale déjà lancée) → chrome-devtools `navigate_page` + `take_screenshot` de l'écran touché, même nommage.
3. Sinon l'item est marqué « sans capture ». Jamais de mockup ou de wireframe fabriqué à la place d'une capture réelle.

Fait quand : chaque item UI porte un PNG dans le scratchpad ou la mention « sans capture » ; les items sans front ne sont pas concernés.

## 4. Classement

Chaque event est classé dans une section ou écarté avec une raison (bruit : push technique sans MR, event dupliqué). **Zéro event ni classé ni écarté** — c'est le critère de complétude du skill.

Sections (omises si vides) :

- **Features** — MRs de fonctionnalités créées/mergées, issues feature fermées.
- **Correctifs** — fixes/hotfixes, issues bug fermées.
- **Reviews** — données (commentaires, approbations, merge de la MR d'un autre) et reçues. Les events utilisateur ne remontent pas toutes les approbations : pour chaque todo `review_requested` frais, vérifier sur la MR (notes/approbation de l'utilisateur) si la review a été donnée le jour J — si oui, l'item va en Reviews.
- **En attente** — uniquement ce qui bloque du travail : reviews demandées non encore faites (`review_requested`), approbations attendues (`approval_required`), pipelines rouges (`build_failed`), conflits (`unmergeable`) + MRs ouvertes ce jour toujours non mergées. Filtre de fraîcheur : todos ≤ 7 jours ou liés aux projets actifs du jour. Jamais : les issues simplement assignées/mentionnées (backlog), l'attente de réponses à ses propres commentaires, un `review_requested` dont la review a déjà été donnée.
- **Divers** — le reste (docs, CI, config…).
- **À suivre demain** — dérivé d'« En attente » : les actions concrètes du lendemain.

Classer Features vs Correctifs via le titre de la MR/issue (préfixe `feat`/`fix`, labels) ; en cas de doute → Divers.

## 5. Rendu Slack (copie du rendu navigateur)

Le collage riche dans Slack (gras + liens cliquables **sur les numéros**) passe par le rendu navigateur : générer le HTML, donner son lien `file://` — l'utilisateur l'ouvre, Cmd+A, Cmd+C, puis Cmd+V dans Slack.

1. Construire le récap en HTML dans le scratchpad (`recap-<date>.html`) :
   - Chaque ligne dans un `<p>` ; ligne vide entre sections = `<p><br></p>`.
   - Titre : `🗓️ <b>Récap — <date></b>`. Sections en `<b>` avec emoji : ✨ Features, 🐛 Correctifs, 👀 Reviews, ⏳ En attente, 📌 Divers, 📅 À suivre demain.
   - Item : `<p>&nbsp;&nbsp;&nbsp;&nbsp;•&nbsp;<projet> — <description> (<a href="URL">!55</a>,&nbsp;<a href="URL">#2</a>)</p>` — indentation par 4 `&nbsp;`, chaque numéro cité porte son lien, jamais d'URL nue visible.
   - Item UI avec capture : sous sa ligne, `<p><img src="file:///…/recap-<date>-<projet>-<iid>.png" width="480"></p>` — aperçu dans le navigateur seulement, le transport vers Slack se fait à l'étape 3.
   - Juste le numéro (!55, #2) — jamais son statut (mergée, fermée…).
   - Tout espace adjacent à un `<a>` = `&nbsp;` — Slack avale les espaces normaux autour des liens au collage.
   - Puces courtes, impersonnel actif (jamais « j'ai »/« on »), français, sections vides omises.
2. Écrire aussi `recap-<date>.txt` : même contenu en texte brut, chaque numéro suivi de son URL nue, chaque item UI suivi du chemin de son PNG — version de secours affichée dans le terminal.
3. Afficher le lien cliquable `file:///…/recap-<date>.html` et annoncer : « Ouvrir le fichier, Cmd+A, Cmd+C, puis Cmd+V dans Slack. » S'il y a des captures : le collage navigateur ne les transporte pas de façon fiable — annoncer de les glisser ensuite dans le message Slack, et lister leurs chemins.

Pièges constatés (2026-07-15, ne pas y revenir) : coller la syntaxe HTML en texte → balises visibles ; presse-papiers via `«data HTML»` → collage vide ; via NSPasteboard `public.html` → fonctionne une fois puis retombe sur le texte ; `<div>` unique avec `<br>` → gras/liens perdus ; `<ul><li>` → puces non indentées et espaces avalés autour des liens.

## Hors périmètre

- Stats personnelles → `git-activity-report`.
- Recap visuel interactif d'une MR (wireframes, plan annotable) → `builder-visual-recap`.
- Publication automatique → skill `recap`.
- Archive fichier : l'historique vit dans GitLab, régénérable pour toute date via l'argument.
