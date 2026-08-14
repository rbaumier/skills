---
name: mr-review-doc
description: Générer un document HTML de review pour une MR/PR — un explainer autonome et complet, lisible par quelqu'un qui ne connaît pas le projet. Utiliser quand on demande un doc/document HTML de review pour une MR, ou d'expliquer une MR à un lecteur externe.
---

# Doc HTML de review de MR

Produire une page HTML autonome qui explique une MR : son objectif métier, ses
décisions, son code — de sorte qu'un lecteur **qui ne connaît pas le projet**
comprenne ce qui est livré, pourquoi, et ce qu'on lui demande de valider.

## Séquence

1. **Lire** le diff complet et les fichiers clés de la branche — référence :
   « Règle d'or ».
2. **Rédiger** selon la « Structure canonique » (et ses « Variantes »), avec
   le « Design » du template.
3. **Couper** : passe de suppression, puis budget de mots mesuré — référence :
   « Budget de mots ». **Ne pas passer à la suite tant que le budget n'est
   pas respecté.**
4. **Contre-vérifier** : relire chaque affirmation technique du doc (après la
   coupe) et la confronter au code. **Ne pas livrer avant que cette passe
   soit faite.**
5. **Écrire** le fichier HTML final en local — référence : « Sortie ».

## Règle d'or : exactitude vérifiée (étape 1)

Chaque affirmation du doc doit être vérifiée contre le code réel de la branche,
jamais écrite de mémoire :

- Lire le diff complet de la MR (`git diff <target>...<source>`) et les fichiers
  clés AVANT d'écrire. Les extraits de code du doc sont copiés du vrai code.
- Les chiffres viennent de `git`, pas d'une estimation : `git rev-list --count`
  pour les commits, `git diff --name-only | wc -l` pour les fichiers. Les
  métadonnées GitLab (URL, titre, statuts) viennent des outils MCP GitLab quand
  ils sont disponibles. Si git local et GitLab divergent (MR re-ciblée, branche
  mergée depuis), **GitLab fait foi** pour la cible, les statuts et les comptes.
- Pour le compte de tests : exécuter la suite de tests du projet sur la branche
  source (avec la commande du projet).
- Les noms (types, fonctions, tables, constantes, valeurs de timeouts) sont
  recopiés exactement. En cas de doute, re-grep.
- Si la MR fait partie d'une série/stack, relire le doc précédent pour la
  continuité (mêmes termes, même position du diagramme de stack) — mécanique
  de relecture dans « Sortie ». Doc précédent introuvable dans `mr-docs/` →
  appliquer la variante « premier doc d'une série ».

## Budget de mots (étape 3) : la concision se mesure

Le doc est un outil de review, pas une documentation : sa taille est indexée
sur le diff, et le budget est un critère de sortie, pas un souhait.

- **Prose totale** — le texte des `<section>` hors graphe (`.g6`), hors
  tables, chips et contenu `<svg>` (les figcaptions comptent) : **≤ 600 mots**
  pour une MR ≤ 15 fichiers, **≤ 1000 mots** au-delà. Par brique :
  **≤ 100 mots** hors encarts ; un encart « À valider » : ≤ 60 mots.
- **Mesurer, jamais estimer** : extraire le texte concerné (script jetable au
  scratchpad : strip des tags, exclusion `.g6`/lexique/tables) et compter avec
  `wc -w`. Re-mesurer après chaque coupe.
- **La passe de coupe** supprime toute phrase qui :
  - répète ce que le graphe montre déjà (nœuds, popups) — le mécanisme vit là ;
  - répète le lexique, la vue d'ensemble ou une autre section ;
  - décrit ce que le reviewer verra dans le diff sans y ajouter un pourquoi ;
  - rappelle du contexte qu'un renvoi `(§0N)` suffit à pointer.
- Au-dessus du budget après la coupe → supprimer des phrases entières,
  jamais compresser en paragraphes plus denses.

## Le lecteur ne connaît pas le projet

C'est la contrainte qui structure tout :

- **Encart « Pour situer »** en tête : 3-5 phrases courtes (listes bienvenues)
  qui expliquent le domaine métier (qu'est-ce qu'un connecteur ? pourquoi
  cette feature ?) avant toute technique. Un lecteur externe doit pouvoir
  suivre à partir de zéro. C'est le SEUL endroit qui pose le contexte : le
  lede ne fait qu'annoncer ce que la MR livre, et la liste des briques,
  c'est le sommaire.
- **Lexique** (grille de définitions) juste après le sommaire : 4-6 termes,
  uniquement ceux employés dans plusieurs sections, définis en ≤ 20 mots.
  Une définition vit là et nulle part ailleurs — pas de rappel dans les
  sections.
- Chaque section répond **pourquoi avant comment** — et le comment est déjà
  porté par le graphe : une brique n'en garde que les décisions.
- Les sections se lisent **seules** au sens : aucune dépendance de lecture.
  Un renvoi explicite `(§0N)` remplace le rappel — ne pas re-raconter.
- La **doctrine** du changement (l'invariant métier qui justifie les choix,
  ex. « un doublon est pire qu'un manque ») est énoncée explicitement, tôt, et
  rappelée là où elle tranche un choix.

## Structure canonique

Dans l'ordre. Adapter les sections au contenu, garder l'ossature :

1. **Header** — eyebrow, titre court (le *sujet*, pas le numéro), lede de 1-2
   phrases courtes (ce que la MR livre + la phrase-clé en gras — pas de
   contexte, c'est le rôle du « Pour situer »), rangée de chips : lien MR,
   `source → target`, nb commits, nb fichiers, nb tests verts.
   Dans la chip tests, `N verts` = la suite complète exécutée sur la branche,
   `+N` = fonctions de test ajoutées par le diff (un test paramétré = 1) ;
   si la suite ne peut pas tourner ou si la MR n'ajoute pas de tests, omettre
   la chip plutôt qu'estimer.
2. **Vue d'ensemble** — encart « Pour situer », puis si la MR fait partie d'une
   stack : diagramme SVG de position (les MRs sœurs en grisé, celle-ci en
   surbrillance, statuts). Pas de paragraphe listant les briques : le sommaire
   s'en charge.
3. **Sommaire** (toc, une entrée par ligne) + note d'une ligne sur l'ordre de
   lecture.
4. **Lexique** — liste de `<dt>/<dd>`, un terme par ligne.
5. **Section « Chaîne d'appel de bout en bout »** — première section : la
   carte avant les briques. Graphe interactif généré par script (voir « Le
   graphe de chaîne d'appel » plus bas) : le mécanisme se lit dans les popups,
   sur le vrai code. Remplace l'ancien composant statique `.chain` du template.
6. **Une section par brique** — découper par partie logique du code de la MR
   (un port, un mécanisme, un client, un câblage…), jamais par nature de
   contenu (pas de section « décisions » ni « tests » globales) : ça scale
   avec la taille de la MR. Chaque brique, ≤ 100 mots hors encarts :
   - chips des fichiers concernés sous le titre ;
   - chaque décision : un gras-tête ≤ 8 mots + 2-4 puces d'une ligne —
     aucun paragraphe libre ;
   - jamais re-décrire un mécanisme visible dans le graphe (§01) : la brique
     ne porte que les choix contestables ;
   - ses encarts « À valider ».
   Pas de partie tests (la chip du header suffit), pas d'extrait de code ni de
   SVG de flux : le graphe porte déjà le mécanisme.
7. **Section « Hors périmètre & avant merge »** — avec son `sec-head` numéroté
   comme les autres sections (le template ne l'illustre pas) : tableau des
   exclusions avec qui les livre (MR suivante, chantier séparé — indispensable
   pour une MR découpée), puis l'encart warn des actions pré-merge : DDL à
   appliquer, re-ciblage de branche, vérifications.
8. **Footer** — rappel MR/branche/issue + lien de continuité avec les docs
   précédents de la série.

### Variantes

- **MR isolée (pas de série)** : eyebrow `Revue de code · issue #N` (et sans
  issue : `Revue de code · <repo>`), titre sans `(lettre · i/n)`, pas de
  diagramme de stack, footer sans lien de continuité.
- **Premier doc d'une série** : pas de doc précédent à relire ; fixer ici les
  termes et la position du diagramme de stack que les docs suivants reprendront.

## Le graphe de chaîne d'appel

La section « chaîne d'appel » est un graphe de nœuds compacts, générée par un
script de build Node (shiki), jamais écrite à la main. Modèle complet et
fonctionnel : `chain-graph-build.example.mjs` (dossier de ce skill) — le copier
dans le scratchpad de session, `npm i shiki`, et adapter les données (sources,
ancres, popups) en gardant les helpers et le CSS tels quels.

Ce que montre le graphe :

- **Un nœud par fonction** : sa signature réelle colorisée (github-light), sans
  les types des paramètres (types de retour conservés). Les méthodes sont
  préfixées `Type.nom(&self, …)` (type en violet), les fonctions libres
  `module::nom(…)` (module en gris). Flèches verticales entre nœuds ; branche
  latérale (`.row`/`.hedge`) pour un aller-retour hors chemin principal.
- **Hover sur le nom de fonction** → carte : description (gras), étapes
  numérotées, puis le vrai code de la fonction où chaque phrase d'étape est
  répétée en tête de son bloc avec un badge numéroté ; l'appel au nœud suivant
  en gras sur fond jaune (`.callee`). Le code est colorisé en **diff de la MR** :
  lignes ajoutées sur fond vert (`+`), supprimées interleavées sur fond rouge
  (`-`) — le reviewer voit ce que la MR change dans chaque fonction ; les
  fonctions qu'elle ne touche pas restent en contexte neutre.
- **Hover sur un paramètre ou un type de retour** → déclaration typée + la
  définition complète de la struct (doc-comments inclus).
- **Hover sur le module ou le type porteur** → squelette : `mod x { …signatures… }`
  ou `struct X { … }` + `impl X { …signatures… }`.

Règles du script (déjà encodées dans l'exemple) :

- **Tout le code affiché est extrait du repo au build** — `extract()` par ancres
  textuelles (jamais de numéros de ligne en dur), `fnSignatures()` pour les
  squelettes, `stepRanges()` pour ancrer les étapes. Une ancre absente = build
  en échec bruyant : le doc ne peut pas dériver du code.
- **Overlay diff** : le code des popups est colorisé en diff de la MR. `extract()`
  mémorise la plage de chaque bloc, `git diff DIFF_BASE -- <fichier>` donne les
  lignes ajoutées/supprimées, `applyDiff()` les superpose (vert `.dfa` / rouge
  `.dfd`, gouttière `+/-`). **Seul point à adapter : `DIFF_BASE`** = la branche
  cible (ou le merge-base) de la MR ; la provenance est automatique, rien à tenir
  à la main.
- **Empilement (z-index)** : au survol, le CSS élève le conteneur `.g6` *et* le
  nœud survolé (`:has(.tok:hover)`) — les deux sont nécessaires. Chaque graphe est
  un contexte d'empilement (via `transform`) : sans lever le `.g6`, un graphe
  suivant recouvre la popup ; sans lever le nœud, un voisin du même graphe la
  recouvre. Le `display:block` va sur le wrapper shiki seul (`pre > code`), jamais
  sur les `<code>` inline des steplines — sinon un `<code>` casse la phrase sur sa
  propre ligne.
- Les tokens en fin de ligne d'un nœud prennent `pr` (popup ancrée à droite) —
  mais pas ceux qui wrappent en début de ligne suivante, sinon la popup déborde
  à gauche. Vérifier avec `getBoundingClientRect()` dans Chrome.
- Le script écrit un standalone de travail (au scratchpad de session — seul
  le doc final va dans `mr-docs/`) ET injecte la section dans le doc final
  entre marqueurs, de façon idempotente ; le CSS du graphe est préfixé
  `.g6` et le conteneur fait un breakout centré (`min(960px, 100vw - 48px)`)
  pour déborder du corps de texte en 780px.
- Vérifier les popups dans Chrome malgré le `:hover` non persistant du MCP :
  injecter `<style id="dbg-style">.dbg > .pop { display: block !important }</style>`
  + classe `.dbg` sur le token, screenshot, puis retirer style et classes. Pour
  l'empilement, forcer aussi les règles `:hover` sur `.dbg`
  (`.g6:has(.dbg){z-index:60} .g6 .node:has(.dbg){z-index:60}`) et confirmer avec
  `elementFromPoint` que la popup couvre bien les nœuds qu'elle recouvre. Contrôler
  au passage la colorisation diff (lignes `+`/`-`) et l'absence de double interligne.

## Les encarts « À valider »

Le doc est un outil de review : il expose les **décisions discutables** au lieu
de les enterrer. Pour chaque choix non évident (trade-off, comportement limite,
dette assumée) : un encart `aside.validate` qui énonce la décision prise, sa
conséquence concrète, et la position recommandée. Le reviewer doit pouvoir
contester chaque encart sans lire le code. Ne pas en abuser : 2 à 5 par doc,
uniquement des vrais points de décision.

## Design

Copier intégralement le CSS de `template.html` (dossier de ce skill) — c'est
l'identité visuelle de la série, ne pas re-designer — et suivre son squelette
commenté (classes de diagramme, colorisation du code, formats de `<title>` et
d'eyebrow y sont documentés). En cas de désaccord entre le squelette du
template et ce SKILL.md (le template peut retarder : composant `.chain`,
paragraphe des briques…), **la structure de SKILL.md prime** ; le template ne
fait foi que pour le CSS et les classes. Seules contraintes non visibles dans le template :

- Diagrammes SVG : `viewBox` large (~760 de large), dans un conteneur
  `.dg-scroll` ; `aria-label` descriptif sur chaque SVG.
- Jamais de scroll horizontal de page (les tables/diagrammes scrollent dans
  leur conteneur).

## Sortie (étape 5)

- **Pas d'Artifact ni d'autre publication externe** : le livrable est un fichier
  HTML local. L'écrire dans `<dossier parent du repo>/mr-docs/<repo>-mr<N>.html`
  (créer `mr-docs/` au besoin ; jamais dans le repo lui-même, pour ne pas polluer
  `git status`). Donner le chemin complet à l'utilisateur en fin de tâche.
- Le fichier est un document HTML **complet et autonome** : `<!doctype html>`,
  `<html lang="fr">`, `<head>` avec `<meta charset="utf-8">`, viewport, `<title>`,
  le CSS inline, puis `<body>` — il doit s'ouvrir tel quel dans un navigateur.
- Mettre à jour le doc quand la MR évolue après review : même fichier, réécrit
  en place ; ne pas créer un second fichier pour la même MR.
- Depuis une nouvelle session, pour relire un doc précédent de la série ou
  mettre à jour un doc existant : le lire directement dans `mr-docs/`.

## Langue et ton

Français, orthographe et typographie soignées (espaces insécables avant `:`,
`;`, `?`, guillemets «&nbsp;»). Identifiants techniques et noms de code en
anglais tels quels, dans `code.inline`. Ton : explicatif et direct, phrases
complètes, pas d'enthousiasme marketing. L'italique et le gras portent les
phrases-clés (doctrine, invariants), avec parcimonie.

**Pas de gros blocs de texte — le lecteur décroche.** Chaque mot mérite sa
présence :

- phrases courtes, pas de phrases à rallonge ni d'incises en cascade ;
- un paragraphe = une idée, ~3 lignes max ;
- toute énumération dans une phrase → liste à puces (`<ul>`), y compris dans
  les asides et le lede ;
- schéma type d'une décision : une phrase gras-tête, puis des puces.
