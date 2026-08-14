---
name: grill-mr
description: Griller la MR d'un tiers — agent fable adversarial et exhaustif, doc HTML accepter/refuser (shiki), publication GitLab des retours validés (fichier/ligne).
disable-model-invocation: true
---

# Grill MR

Griller une MR GitLab : un agent **fable** extrêmement sévère et adversarial par MR,
retours exhaustifs (fichier/ligne), livrés dans un doc HTML interactif où l'utilisateur
accepte ou refuse chaque finding, puis publication des acceptés sur GitLab.

Arguments : une ou plusieurs références de MR — IID (`65`), `repo!65`, ou URL complète.
Une MR = un agent + un doc. Plusieurs MRs = agents en parallèle.

## Séquence

### 1. Résoudre

Pour chaque MR : identifier le projet (URL > `repo!N` > recherche GitLab ; ambigu →
demander). `get_merge_request` → noter `head_sha`, `diff_refs`, branche source,
`web_url` du projet, `changes_count`, titre + description. Diff complet via
`get_merge_request_diffs` ; tronqué → paginer `list_merge_request_diffs` (per_page=100).
MR déjà mergée : la griller quand même (retours = tickets de suivi, à noter pour le prompt).

**Critère : fichiers couverts = `changes_count`, ou troncature signalée à l'utilisateur.**

### 2. Armer

Skills que le reviewer chargera :

- socle, toujours : `coding-standards:quality-bar-review` + `thermo-nuclear-code-quality-review` ;
- langage, selon les extensions du diff : `.rs` → `language-rust` · `.ts`/`.tsx`/`.js` →
  `language-typescript` · `.swift` → `language-swift` · `.vue` → `vue` ;
- domaine, si le diff le touche : SQL/migrations → `database` · UI/CSS → `frontend`
  (+ `tailwind`, `react` si présents) · schémas zod → `zod` · tests → `testing` ·
  CI → `ci-cd` · Docker → `docker` · k8s → `kubernetes` · auth/secrets → `security-defensive`.

**Critère : liste arrêtée, insérée dans le prompt du reviewer.**

### 3. Griller

Lire [`reviewer-prompt.md`](reviewer-prompt.md) (dossier de ce skill), remplacer les
placeholders, puis spawner **un agent par MR** : Agent tool, `model: "fable"`,
`run_in_background: true`, tous dans le même message pour paralléliser. L'agent
retourne le JSON décrit dans `reviewer-prompt.md` (ids `1..n` triés par sévérité,
couverture déclarée). Le sauvegarder au scratchpad : `findings-<repo>-<N>.json`.

**Critère : JSON valide — chaque finding a fichier + ligne + sévérité + description +
recommandation ; couverture déclarée, jamais de troncature silencieuse.**

### 4. Expliquer

Explainer compact en tête de doc (fragment HTML pour `META.explainerHtml` du script),
inspiré de `mr-review-doc`, **≤ 400 mots** :

- encart « Pour situer » (`aside.context`) : le domaine métier + le problème que la MR résout ;
- table des call sites touchés : point d'entrée → ce qui change ;
- décisions clés annoncées par la description de la MR.

Pas de graphe interactif. Mêmes règles que `mr-review-doc` : tout vérifié contre le
code réel, jamais de mémoire ; phrases courtes, listes.

### 5. Bâtir

- Miroir au scratchpad : `get_file_contents` @ `head_sha` pour **chaque fichier portant
  un finding** (uniquement ceux-là), écrit sous `mirror/<chemin du repo>`. Fichier
  supprimé par la MR → `sans_extrait: true` sur le finding.
- Copier [`build-grill-doc.example.mjs`](build-grill-doc.example.mjs) au scratchpad,
  `npm i shiki`, adapter le bloc CONFIG (le template se lit en place depuis le dossier
  du skill), exécuter. Une ligne hors du fichier = build en échec bruyant, pas de doc faux.
- Sortie : `<dossier parent du repo>/mr-docs/<repo>-mr<N>-grill.html` (créer `mr-docs/`
  au besoin ; jamais dans le repo). Puis `open <fichier>`.

**Critère : build sans erreur, nb de cards = nb de findings du JSON, chemin donné à
l'utilisateur.**

### 6. Publier

Rien n'est posté sans la ligne de décision, produite par le bouton « Copier la
décision » du doc : `grill <repo>!<N> accept:1,3,7-9 reject:2,4` (plages permises,
`-` = vide). Si l'utilisateur a modifié des commentaires dans le doc, la décision est
suivie de blocs `#<id>` + texte : ce texte remplace la `description` du finding.
Quand l'utilisateur la colle, pour chaque numéro **accepté** :

- `create_merge_request_thread` positionné (charger le schéma via ToolSearch) :
  `position = { position_type: "text", base_sha, head_sha, start_sha` (les trois de
  `diff_refs`)`, new_path: fichier, new_line: ligne }` ; corps = le commentaire
  pré-rempli du doc (`description` + `recommandation`), ou le texte du bloc `#<id>`
  s'il existe ;
- si `suggestion` couvre les lignes commentées → ajouter au corps un bloc GitLab
  ` ```suggestion:-0+<ligne_fin - ligne_debut> ` avec le remplacement (applicable en
  un clic par l'auteur) ;
- position rejetée par l'API (ligne hors du diff — fréquent pour les findings
  « hors diff ») → fallback `create_merge_request_note` préfixée `📍 fichier:ligne`.

Numéros ni acceptés ni refusés : ne pas poster, les lister comme non tranchés.

**Critère : chaque numéro accepté posté, récap final avec un lien par commentaire.**

## Langue

Doc et commentaires en français (identifiants techniques tels quels), typographie
soignée — mêmes règles que `mr-review-doc`.
