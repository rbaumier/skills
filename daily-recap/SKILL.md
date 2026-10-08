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
- Si l'argument restreint les projets (« natalia uniquement »), ne garder que les events de ces projets (`project_id`), le reste est écarté.

Fait quand : toutes les pages d'events sont lues.

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

Chaque event est classé dans un scope ou écarté avec une raison (bruit : push technique sans MR, event dupliqué). **Zéro event ni classé ni écarté** — c'est le critère de complétude du skill.

Le récap est **groupé par scope uniquement** (Facturation, Console, WhatsApp, Voix, Imports, Sécurité, Outillage, Backlog…), jamais par grande partie (pas de sections Features / Correctifs / Divers). Un scope réunit les MRs d'un même sujet ; plusieurs MRs d'un même sujet peuvent tenir en un seul item portant tous leurs numéros.

Chaque item porte son type en préfixe, repris du titre de la MR (conventional commit) : `feat: `, `fix: `, `perf: `, `refactor: `, `docs: `, `chore: `… ; en cas de doute ou sans MR (tri de backlog, issues ouvertes) → `chore: `. Dans un scope, les items sont ordonnés feat, fix, puis le reste.

Jamais de Reviews, En attente ni À suivre demain : les reviews données, les MRs encore ouvertes et les conflits sont écartés (raison : hors livré).

## 5. Rendu Slack (copie du rendu navigateur)

Le collage riche dans Slack (gras + liens cliquables **sur les descriptions**) passe par le rendu navigateur : générer le HTML, donner son chemin absolu (sans préfixe `file://`) — l'utilisateur l'ouvre, Cmd+A, Cmd+C, puis Cmd+V dans Slack.

1. Construire le récap en HTML dans le scratchpad (`recap-<date>.html`) :
   - Chaque ligne dans un `<p>`.
   - **Jamais de tiret cadratin « — »** nulle part dans le rendu (titre, items, légendes).
   - Titre : `🗓️ <b>Récap du <date></b>`.
   - Scope : une ligne vide puis le nom en gras : `<p><br></p><p><b><scope></b></p>`.
   - Item : `<p>•&nbsp;<a href="URL"><type>: <description></a></p>` — le lien porte **sur toute la ligne, type compris**, aucun numéro affiché ; **un seul lien par item** (la MR principale ; l'issue et les MRs sœurs seulement dans le `.txt`), pas d'indentation, jamais d'URL nue visible. Préfixer `<projet> : ` seulement si le récap couvre plusieurs projets ; sur un seul projet, aucun préfixe.
   - **Budget Slack** : le collage compte le texte visible **plus la longueur de chaque URL de lien** ; un récap à 6 340 caractères visibles et 170 liens a dépassé la limite de 5 892 (limite déduite ≈ 12 000). Mesurer avant de livrer (texte visible + somme des longueurs d'URL) et viser **≤ 8 000** : fusionner les items d'un même scope, descriptions de 60 caractères au plus, un lien par item. Au-delà, raccourcir, jamais scinder en deux messages sans le dire.
   - Captures : **jamais dans le HTML** (ni image, ni section Captures). Les PNG restent seulement dans le dossier, l'utilisateur les glisse lui-même dans Slack.
   - Jamais le statut d'une MR ou d'une issue (mergée, fermée…).
   - Tout espace adjacent à un `<a>` = `&nbsp;` — Slack avale les espaces normaux autour des liens au collage.
   - Puces courtes, impersonnel actif (jamais « j'ai »/« on »), français, scopes vides omis.
2. Écrire aussi `recap-<date>.txt` : même contenu en texte brut, chaque numéro suivi de son URL nue, chaque item UI suivi du chemin de son PNG — version de secours affichée dans le terminal.
3. Annoncer : « Ouvrir le fichier, Cmd+A, Cmd+C, puis Cmd+V dans Slack. » S'il y a des captures : le collage navigateur ne les transporte pas de façon fiable — annoncer de les glisser ensuite dans le message Slack depuis le dossier. Le message se termine **toujours** par ces deux lignes, dans cet ordre, rien après :
   - `HTML : /…/recap-<date>.html` (chemin absolu nu, jamais `file://`)
   - `Dossier : /…/` (le scratchpad qui contient le HTML, le `.txt` et les PNG)

Pièges constatés (2026-07-15, ne pas y revenir) : coller la syntaxe HTML en texte → balises visibles ; presse-papiers via `«data HTML»` → collage vide ; via NSPasteboard `public.html` → fonctionne une fois puis retombe sur le texte ; `<div>` unique avec `<br>` → gras/liens perdus ; `<ul><li>` → puces non indentées et espaces avalés autour des liens.

## Hors périmètre

- Stats personnelles → `git-activity-report`.
- Recap visuel interactif d'une MR (wireframes, plan annotable) → `builder-visual-recap`.
- Publication automatique → skill `recap`.
- Archive fichier : l'historique vit dans GitLab, régénérable pour toute date via l'argument.
