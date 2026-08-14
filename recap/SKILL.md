---
name: recap
description: "Generate a Slack-ready recap (rendu HTML à coller depuis le navigateur) summarizing what was done in the current session for a non-technical audience (stakeholders, commerciaux/marketing), THEN ALWAYS ask (via AskUserQuestion) whether to publish it and on which channel(s) — no exception. Use when the user types /recap, asks for a 'recap', 'summary for Slack', 'what did we do', 'write a recap', or wants to communicate changes to a team. Works on any project."
---

# Recap

Generate a Slack message summarizing work done in the current session.

## Règle transverse — JAMAIS sauter une étape en autonomie (demander via AskUserQuestion)

Toutes les étapes de ce skill sont **obligatoires par défaut**, y compris l'étape 4
(tableau de captures nu + annoté).

**INTERDIT** : décider seul de sauter, réduire ou alléger une étape (« ça me paraît
disproportionné pour un ping court », « je garde la diffusion légère », « les captures
n'apportent pas grand-chose ici »). Ce type d'arbitrage de périmètre n'appartient jamais
à l'agent.

**OBLIGATOIRE** : dès qu'un doute apparaît sur l'opportunité d'exécuter une étape (captures
trop lourdes, audience sensible, coût jugé élevé, pertinence discutable), **poser la question
à l'utilisateur via `AskUserQuestion`** avant d'agir — avec le trade-off explicité et l'option
« exécuter l'étape complète » proposée en premier (recommandée). Ne jamais trancher en silence,
même sous pression de temps ou en session autonome. Exécuter l'étape complète, ou demander : il
n'y a pas de troisième voie « je saute discrètement ».

## Gate final — publication (INCONTOURNABLE, contrat de sortie du skill)

**Le skill `/recap` n'a jamais terminé son travail tant que la question de publication de la
Step 7 n'a pas été posée à l'utilisateur via `AskUserQuestion`.** Ce n'est pas une étape
optionnelle, ce n'est pas un « nice-to-have » : c'est le **contrat de sortie** du skill. Afficher
le texte du recap (Step 6) et s'arrêter là = skill **non terminé**, quelle que soit la raison
(temps, contexte, autonomie, absence de canal configuré, urgence perçue, « ça se voit qu'il faut
publier », etc.).

Le déclencheur de la Step 7 est **le fait d'avoir généré un recap** — pas le mot « publier »
dans la demande de l'utilisateur, pas la présence d'un canal préconfiguré.
Même quand aucun canal n'est configuré, la question **doit** être posée (cas « liste vide »
en 7.2 — au minimum : « fichier local seulement » vs « je précise un canal »).

Auto-check mental avant de rendre la main à l'utilisateur (à faire à CHAQUE recap, sans
exception) : **« Ai-je invoqué `AskUserQuestion` pour la publication ? »** Si la réponse est
non → revenir en Step 7 et poser la question AVANT toute autre sortie. Un skill `/recap` qui
finit sans cette question est un bug — le rattraper en enchaînant la question, ne jamais le
laisser passer.

## Step 0 — Résolution org (registre partagé `~/.claude/shared`)

Avant tout, résoudre l'org courante par matching du `$PWD` contre les
`cwd_pattern` du registre partagé. Cela conditionne le canal d'envoi
optionnel en fin de skill (cf. Step 7).

```bash
org_slug=$(jq -r --arg pwd "$PWD" '
  .orgs[]
  | select(.cwd_pattern != null)
  | select(.cwd_pattern as $p | $pwd | test($p))
  | .slug
' ~/.claude/shared/orgs/_index.json | head -1)
```

Note jq : le `select(...as $p ... test($p))` est volontaire — `$pwd | test(.cwd_pattern)`
échoue car le pipe change le contexte de `.`, qui devient le string `$pwd` au lieu
de l'objet org. La forme `cwd_pattern as $p` capture la regex avant le pipe.

- Si `$org_slug` est non vide → garder en mémoire pour le Step 7. NE PAS lire
  `tools.json` à la main : la liste des destinations de publication s'obtient
  via le resolver `validate-orgs --resolve-destinations $org_slug` (cf. 7.1),
  source unique de vérité.
- Si vide → pas de destination préconfigurée, mais le Step 7 demande QUAND
  MÊME s'il faut publier (cf. cas « liste vide » en 7.2).

Cette résolution est silencieuse (pas de message à l'utilisateur). Elle ne
conditionne QUE la liste des destinations proposées en fin de skill — jamais
le fait de poser la question de publication, qui est posée à CHAQUE recap
(cf. Step 7).

## Arguments

`/recap [time range or commit range]`

- Commit range, branch, or time window passed to git log (default: last 24 hours).

## Audience

Le recap s'adresse à une audience **non technique** — stakeholders, commerciaux,
marketing — pour les tenir au courant des avancées. Pas de version technique : chaque
phrase doit être compréhensible par quelqu'un qui n'a jamais ouvert un éditeur de code.
Le test, phrase par phrase : « qu'est-ce que ça change pour l'utilisateur ou le
business ? » — une phrase qui n'y répond pas ne va pas dans le recap.

**La question de publication (Step 7) est posée à la fin de CHAQUE recap**, quels
que soient les arguments.

## Process

### 1. Gather context

Run in parallel:

```bash
git log --since="24 hours ago" --oneline --no-merges
git log --since="24 hours ago" --stat --no-merges
```

If ARGUMENTS specify a commit range, branch, or time window, use that instead.

Also use conversation context — the current conversation contains what was discussed, decided, and implemented.

### 2. Write the recap

**Format : texte brut, aucun marqueur markdown.** Le Step 6 rend ce texte en deux
versions (HTML pour le collage Slack, `.txt` de secours) : la mise en gras est
appliquée au rendu HTML, jamais dans le texte lui-même.

- NEVER wrap text in `*...*`, `**...**`, or `_..._`
- Lead with a plain-text title line: `[Project/Area] — recap [topic]` (no asterisks, no quotes around it)
- Group by theme (not by file or commit)
- Each theme: a plain-text title line, then 1-3 sentences below it
- Use a blank line between themes for visual separation
- Length: 100-250 words
- Pure user/business perspective: what can they do now that they couldn't before?
- No jargon: no "API", "migration", "JWT", "E2E", "zero-downtime", "deploy", "startupProbe", "retry", "502", "backend", "endpoint", "CI", etc. — remplacer chaque terme technique par le bénéfice qu'il produit pour l'utilisateur
- Use simple verbs: "vous pouvez maintenant...", "il est désormais possible de...", "l'application gère mieux..."
- Skip infra/ops/test/refactoring themes entirely — invisibles pour l'audience
- Match the user's language (French conversation → French recap)
- Write in first person singular ("j'ai", "je"), NEVER use "on" or "nous" to describe the work done
- No emojis
- When changes are deployed to production, include the relevant production URLs at the end of each theme so readers can click and see the result. Derive URLs from CLAUDE.md (deployment config, URL patterns, locale domains) and from the pages/routes that were added or modified. Dans le texte : URL nue sur sa propre ligne (le rendu HTML du Step 6 la transforme en lien cliquable).

### 3. Do NOT include

- "Let me know if you have questions" / "Feel free to..."
- Summaries of the summary
- Commit hashes or file paths
- Process narration ("First I analyzed..., then I...")
- Bullet-point walls — short paragraphs per theme

### 4. Screenshot evidence table

**Étape OBLIGATOIRE (cf. Règle transverse en tête de skill).** Ne jamais la sauter de sa
propre initiative. Si un doute surgit (captures
jugées lourdes/inutiles, page très longue, audience de diffusion sensible), NE PAS trancher seul :
poser la question via `AskUserQuestion` (option « générer les captures complètes » en premier,
recommandée) et attendre la réponse avant de continuer.

After writing the recap text, append a **screenshot evidence table** documenting every visible change.

**Process:**

1. **Identify all modified/created screens** (webpage, GUI, TUI, etc.) from git diff (same methodology as /qa-manual: `git diff` drives the list, never hardcode)
2. **Start local servers** if needed (check if the relevant service is already running, otherwise start it)
3. **Ensure `.screenshots/` is in the project's `.gitignore`** (idempotent check, add if missing)
4. **For each change**, take TWO screenshots — using Chrome headless for web apps and websites, or another appropriate tool for GUI/TUI:
   - **Clean screenshot** (no annotations) — the screen as a user would see it
   - **Annotated screenshot** (red highlight boxes on modified elements)

5. **Save screenshots** to `.screenshots/recap-<YYYYMMDD-HHMMSS>/`

#### How to take annotated screenshots (MANDATORY — do not skip)

For each annotated screenshot, you MUST produce a **visible** red-outlined version. The verification gate: open the resulting PNG and confirm a red box is actually drawn around the changed element. A clean-looking annotated PNG is a FAILED annotation, not a "no change" result — re-shoot with a different approach.

The technique depends on whether you can serve the page from a directory you control. **Option A is the default and works for 99% of recaps**; Option B / C are fallbacks for production-only URLs.

**Option A — Direct in-place injection (DEFAULT for localhost / dev server / any HTML you can write next to):**

DO NOT use an iframe. The iframe approach (loading the target page inside a wrapper iframe and injecting CSS via `contentDocument`) is the historical bug: `scrollIntoView` scrolls the iframe's internal content but NOT the outer viewport that the screenshot captures, so highlights that fall below the iframe's fixed height never appear in the PNG. This produces an "annotated" file that is visually identical to the clean shot — a silent failure.

The reliable approach: write a one-shot copy of the target HTML next to the original (so relative assets like `/style.css`, `/logo.svg`, fonts, images all resolve via the same local server), inject the highlight CSS + a DOM-scanning script directly into that copy's `<head>`, screenshot the page through the local server URL with a tall window so the full page (including footers) is captured, then delete the copy.

```bash
# Requires: a running local server already serving dist/ (or your build dir) on $PORT.
# CHROME and SHOTS_DIR must be set by the caller.

annotated_shot_local() {
  local slug="$1"          # "service-audit360" (no extension)
  local markers_json="$2"  # JSON array of unique substrings present on the page, e.g.
                           #   '["Questions fréquentes sur","Avant un audit complet"]'
                           # One marker per change. The nearest <section>/<article>/card
                           # ancestor of each matching text node gets the red outline.
  local out_png="$3"
  local port="${4:-57219}"
  local dist_dir="${5:-dist}"  # directory the local server is serving

  local src="${dist_dir}/${slug}.html"
  local tmp_name="${slug}.recap-annotated-tmp.html"
  local tmp="${dist_dir}/${tmp_name}"
  local url="http://localhost:${port}/${tmp_name}"

  [ -f "$src" ] || { echo "FAIL source missing: $src"; return 1; }

  python3 - "$src" "$markers_json" "$tmp" <<'PY'
import sys, json
src, markers_json, out = sys.argv[1], sys.argv[2], sys.argv[3]
html = open(src, encoding='utf-8').read()
markers = json.loads(markers_json)
style = """<style>
.qa-hl{outline:5px solid #ff0040 !important;outline-offset:6px !important;
  box-shadow:0 0 0 5px rgba(255,0,64,.25),0 0 40px 10px rgba(255,0,64,.45) !important;
  position:relative !important;z-index:9999 !important}
</style>"""
# Inline script: walk text nodes, match each marker, climb to nearest section/article/card.
script = (
  "<script>(function(){var M=" + json.dumps(markers) + ";"
  "function run(){M.forEach(function(t){"
    "var w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);var n;"
    "while((n=w.nextNode())){if(n.textContent.indexOf(t)>=0){var e=n.parentElement;"
    "while(e&&e.tagName!=='SECTION'&&e.tagName!=='ARTICLE'"
    "&&!(e.classList&&(e.classList.contains('rounded-2xl')||e.classList.contains('rounded-xl')||e.classList.contains('card')))){e=e.parentElement;}"
    "if(e){e.classList.add('qa-hl');}break;}}});}"
  "if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);"
  "else run();})();</script>"
)
import re
# Inject before <body (the safest anchor — works on minified HTML where
# parcel/esbuild strip the explicit <head>/</head> tags but always emit <body).
m = re.search(r'<body\b', html)
if not m:
    sys.exit("no <body in source: " + src)
inject_at = m.start()
open(out, 'w', encoding='utf-8').write(html[:inject_at] + style + script + html[inject_at:])
PY

  # Tall window-size: capture the full page, footer CTAs included. 8000px covers ~99% of marketing pages.
  # Increase if a page is taller; the resulting PNG is auto-cropped by Chrome to the actual content.
  "$CHROME" --headless --disable-gpu --no-sandbox --hide-scrollbars \
    --virtual-time-budget=12000 \
    --window-size=1440,8000 \
    --screenshot="$out_png" "$url" 2>/dev/null

  rm -f "$tmp"
  [ -s "$out_png" ] && echo "OK $(basename "$out_png")" || { echo "FAIL $out_png"; return 1; }
}
```

**Verification gate (MANDATORY):** after every annotated_shot_local invocation, the caller must Read the produced PNG and visually confirm a red outline is present. If the PNG looks identical to its clean counterpart, the markers did not match — re-check the marker strings against the actual rendered HTML (Read the dist file and grep for them; they must be present **verbatim and uniquely**) and re-shoot.

**Option B — iframe proxy (FALLBACK, production URLs you cannot serve locally):**

Use only when the target page is on a remote origin you cannot mirror to your local dist/. The iframe approach is fragile (cross-origin DOM access blocked by X-Frame-Options, scroll/viewport mismatch on long pages) and should be the last attempt before Option C.

```bash
annotated_shot_iframe() {
  local url="$1" selectors="$2" out_png="$3" viewport="${4:-1440,1100}"
  local proxy="/tmp/qa-proxy-$RANDOM.html"
  cat > "$proxy" <<PROXY_EOF
<!DOCTYPE html><html><head><style>
  body,html{margin:0;padding:0;overflow:hidden}
  iframe{border:none;width:100vw;height:100vh}
</style></head><body>
<iframe id="f" src="$url"></iframe>
<script>
document.getElementById('f').onload = function() {
  try {
    var doc = this.contentDocument;
    var style = doc.createElement('style');
    style.textContent = '.qa-highlight{outline:5px solid #ff0040!important;outline-offset:6px!important;box-shadow:0 0 0 5px rgba(255,0,64,0.25),0 0 40px 10px rgba(255,0,64,0.45)!important;position:relative!important;z-index:9999!important}';
    doc.head.appendChild(style);
    doc.querySelectorAll('$selectors').forEach(function(el){el.classList.add('qa-highlight')});
  } catch(e) {}
};
</script></body></html>
PROXY_EOF
  "$CHROME" --headless --disable-gpu --no-sandbox --hide-scrollbars \
    --disable-web-security --allow-file-access-from-files \
    --virtual-time-budget=8000 \
    --screenshot="$out_png" --window-size="$viewport" \
    "file://$proxy" 2>/dev/null
  rm -f "$proxy"
  [ -s "$out_png" ] && echo "OK $(basename "$out_png")" || echo "FAIL $out_png"
}
```

**Option C — ImageMagick rectangle on the clean shot (LAST RESORT):**

When the target page blocks iframing AND cannot be served locally. Draw red rectangles at known coordinates onto the clean screenshot:
```bash
magick clean.png -stroke '#ff0040' -strokewidth 5 -fill none \
  -draw "rectangle X1,Y1 X2,Y2" annotated.png
```
Or note in the table cell: "Annotation impossible (X-Frame-Options DENY, no local serve)".

**CRITICAL RULE:** the annotated column must NEVER be left empty with just `—`. Attempt Option A → B → C in order. A clean-looking annotated PNG that survived to the table = silent failure that misleads the recipient.

6. **Append the table** after the recap text:

```markdown
---

| Périmètre | Description | Screenshot nu | Screenshot annoté |
|---|---|---|---|
| play.hook0.com — homepage | Web UI webhook tester (URL card, feed, detail panel) | [desktop](path) [mobile](path) | [desktop](path) [mobile](path) |
| play.hook0.com — footer | Navigation 3 colonnes (Product, Community, Legal) | [desktop](path) | [desktop](path) |
| www.hook0.com — header | Ajout lien "Play" dans la navigation | [desktop](path) | [desktop](path) |
| ... | ... | ... | ... |
```

**Rules:**
- Use `file:///absolute/path` for screenshot links so they're clickable from terminal
- Take desktop (1440px) screenshots for all changes; add mobile (375px) only for responsive-critical changes
- If a change is invisible (meta tags, headers, redirects), put the `curl` verification command in the "Screenshot nu" column instead
- Group related changes (e.g., header + footer of same page = two rows, not one)
- The /qa-manual injection template (red boxes, labels, cookie dismissal, scroll-behavior:auto) applies to annotated screenshots

### 5. Humanize (MANDATORY — do NOT skip or simulate)

After generating the recap text:

1. **Derive the project name** from the git remote origin or the working directory basename (lowercase, hyphens only, e.g. `recapro`). Date format: `dd-mm-yy` (e.g. `17-04-26`).
2. **Write the raw recap** to `/tmp/{dd-mm-yy}-{project}-raw.txt` (this is the pre-humanized draft)
3. **Call the Skill tool with skill="humanizer"** — this is a REAL tool call, not a mental exercise. You MUST use the Skill tool to invoke `/humanizer`. The humanizer reads the raw file, fixes accents, grammar, AI-tells, and writes the corrected version to `/tmp/{dd-mm-yy}-{project}.txt`.
4. **After the humanizer has run**, read back the corrected content and check it against the Step 2 jargon list: any technical term that survived is rewritten in place as its user benefit.

This step is NOT optional. Do NOT attempt to humanize the text yourself. The Skill tool MUST be called.

### 6. Output (HTML navigateur → collage Slack, `.txt` en secours)

Le collage riche dans Slack (gras + liens cliquables) passe par le rendu navigateur,
même mécanique que /daily-recap : générer le HTML, donner son lien `file://` —
l'utilisateur l'ouvre, Cmd+A, Cmd+C, puis Cmd+V dans Slack. Ne jamais tenter de
remplir le presse-papiers soi-même : c'est le rendu navigateur qui transporte le
formatage.

1. **Compléter le `.txt`** : append the screenshot table (if any) to `/tmp/{dd-mm-yy}-{project}.txt` (écrit par le humanizer en Step 5). C'est la version de secours copier-coller et la source de la publication Step 7.
2. **Générer `/tmp/{dd-mm-yy}-{project}.html`** à partir du texte humanisé :
   - Chaque ligne dans un `<p>` ; ligne vide entre thèmes = `<p><br></p>`.
   - Ligne de titre et titres de thèmes en `<b>`.
   - Chaque URL de prod devient un lien `<a href="URL">` sur un libellé court (domaine ou nom de page), jamais d'URL nue visible ; tout espace adjacent à un `<a>` = `&nbsp;` (Slack avale les espaces normaux autour des liens au collage).
   - Jamais de `<ul><li>` (puces cassées au collage) ni de `<div>` unique avec des `<br>` (gras et liens perdus).
   - La table de captures ne va PAS dans le HTML : ses liens `file://` locaux ne survivent pas au collage. Elle reste dans le `.txt`, et les captures partent via l'upload Slack (7.4) en cas de publication.
3. **Display to the user:**
   - Le lien cliquable `file:///tmp/{dd-mm-yy}-{project}.html` + la consigne : « Ouvrir le fichier, Cmd+A, Cmd+C, puis Cmd+V dans Slack. »
   - Le contenu du `.txt` (texte + table de captures), en texte brut sans code block — le secours copier-coller.

### 7. Publication (post-output, TOUJOURS demander, multi-canal)

Cette étape a lieu à la fin de CHAQUE recap, sans exception — quels que soient
les arguments. Le
skill ne se termine JAMAIS après l'affichage Step 6 sans avoir posé la question
de publication (7.2). Ce qui varie selon la config, c'est UNIQUEMENT la liste
des destinations proposées — pas le fait de demander.

Le seul détecteur de « canal configuré ou non » est le resolver de 7.1
(`validate-orgs --resolve-destinations`) — jamais une évaluation manuelle d'un
chemin `tools.json`. Deux cas, tous deux traités par la question 7.2 :
- **Destinations configurées** — le resolver renvoie une liste NON vide
  → proposer ces destinations (cas « liste non vide » de 7.2).
- **Aucune destination** — le resolver renvoie `[]`, échoue, ou `org_slug` est
  vide → poser quand même la question en mode « liste vide » (7.2) : défaut =
  fichier local, avec possibilité de nommer une destination ad hoc.

#### 7.1. Construire la liste des destinations (resolver — JAMAIS de jq maison)

NE JAMAIS lire `tools.json` à la main ni improviser un chemin `jq`. Le piège
`.signal` vs `.tools.signal` (signal/slack vivent sous `.tools`) est la **cause
racine** du faux-négatif « aucun canal configuré » qui faisait skip la
publication en silence. La liste des destinations vient d'UNE seule source de
vérité, le binaire `validate-orgs` (qui valide aussi ce schéma en hook
PostToolUse + pre-commit, donc le chemin ne peut pas dériver) :

```bash
RESOLVER=~/.claude/shared/bin/validate-orgs/target/release/validate-orgs
DESTS=$("$RESOLVER" --resolve-destinations "$org_slug"); RC=$?
```

Interprétation **fail-loud** (un échec n'est JAMAIS lu comme « aucun canal ») :
- `RC == 0` → `DESTS` est un tableau JSON (possiblement `[]`), liste ordonnée
  Signal-d'abord-puis-Slack. Chaque élément porte TOUT le nécessaire (cible +
  transport), donc aucune relecture de `tools.json` ailleurs :
  - Signal direct → `{ "canal":"signal","mode":"direct","number":…,"label":…, "ssh_hosts":[…],"ssh_extra_args":…,"rpc_endpoint":…,"sender_number":… }`
  - Signal groupe → `{ "canal":"signal","mode":"group","group_id":…,"label":…, "ssh_hosts":[…],"ssh_extra_args":…,"rpc_endpoint":…,"sender_number":… }`
  - Slack → `{ "canal":"slack","channel":"<nom>","channel_id":"<id>","token_file":"<chemin>" }`
- `RC != 0` → ERREUR (tools.json absent/illisible, resolver introuvable, ou
  binaire non compilé). Afficher
  `⚠️ resolver des destinations en échec (RC={RC}) — recompiler validate-orgs / vérifier orgs/$org_slug/tools.json`
  PUIS traiter comme « liste vide » en 7.2 (on demande quand même). Ne JAMAIS
  prétendre silencieusement qu'aucun canal n'est configuré.

Si `org_slug` est vide (cwd hors registre, Step 0) → ne pas appeler le resolver,
aller directement au cas « liste vide » de 7.2.

`DESTS == []` → cas « liste vide » de 7.2. Sinon → cas « liste non vide » (une ou
plusieurs destinations) de 7.2, en proposant chaque entrée de `DESTS`.

Exemple (france-nuage) → 2 destinations : Signal « France Nuage - Communauté »,
Slack #france-nuage-updates.

#### 7.2. Demander quelle(s) destination(s) via AskUserQuestion (OBLIGATOIRE)

OBLIGATOIRE : invoquer `AskUserQuestion`, jamais envoyer sans confirmation
explicite, même en session autonome. La confirmation est rejouée à CHAQUE
recap (aucune mémorisation du choix précédent).

**La confirmation porte sur la DESTINATION précise, pas seulement sur le canal.**
Une instruction utilisateur du type « publie sur signal » nomme le canal mais
PAS la cible : elle ne dispense PAS de la confirmation `AskUserQuestion` ci-dessous,
surtout quand la cible est un **groupe à audience large / potentiellement externe**
(ex. un groupe « Communauté »). Le classifieur de sécurité **bloque** un envoi
sortant vers une audience large non explicitement nommée par l'utilisateur (vérifié
2026-06-16) — et c'est le comportement voulu. Toujours **nommer la cible exacte** dans
le libellé de l'option ET **signaler l'ampleur de l'audience** quand c'est un groupe
(« audience large, possiblement externe »). N'envoyer qu'après sélection explicite
de cette destination nommée.

- **Aucune destination (liste vide)** → poser quand même la question, en mode
  informatif (la publication reste proposée même sans canal préconfiguré) :
  > Question : « Publier ce recap quelque part ? Aucun canal n'est configuré pour ce projet. ({N} mots, {M} captures) »
  > Header : « Send recap »
  > Options (première = recommandée) :
  >   - « Non — garder le fichier local seulement »
  >   - « Oui — je précise le canal »
  >
  > L'utilisateur peut aussi, via « Other », nommer directement une destination
  > ad hoc (canal Slack, numéro/groupe Signal, email…). S'il choisit « Oui — je
  > précise le canal » ou nomme une destination : l'aider à publier vers cette
  > cible, PUIS proposer d'enregistrer la config dans `tools.json` pour que les
  > prochains recaps la proposent d'office. Sinon → « OK, fichier local
  > seulement » et STOP.

- **Une seule destination** → question Oui/Non :
  > Question : « Publier ce recap sur {label} ? ({N} mots, {M} captures) »
  > Header : « Send recap »
  > Options : « Oui — publier sur {label} » / « Non — garder le fichier local seulement »
  >
  > Si {label} est un **groupe** (≠ DM 1:1), ajouter dans le `description` de l'option « Oui » :
  > « Audience large, possiblement externe. Action publique difficilement réversible. »

- **Plusieurs destinations** → question **multiSelect** (`multiSelect: true`),
  une option par destination, libellée explicitement par canal :
  > Question : « Publier ce recap sur quel(s) canal(aux) ? ({N} mots, {M} captures) »
  > Header : « Send recap »
  > Options (multi-sélection, première = recommandée) :
  >   - « Signal — {nom du groupe} »
  >   - « Slack — #{channel-1} »
  >   - « Slack — #{channel-2} »
  >   - … (une par destination)
  > L'utilisateur peut en cocher plusieurs. Pour ne rien envoyer : « Other » → « aucun ».

Destinations retenues = celles cochées. Si aucune (ou « aucun ») → afficher
« OK, fichier local seulement » et STOP.

Envoyer ENSUITE à chaque destination retenue via la sous-procédure de son
canal (7.3 Signal, 7.4 Slack). Rapporter un statut PAR destination ; l'échec
d'un canal n'empêche pas les autres ni ne plante le skill (le fichier local
reste le fallback de copier-coller).

#### 7.3–7.4. Envoi effectif par canal (Signal, Slack)

Les procédures d'envoi détaillées de chaque canal vivent dans **`references/publish-channels.md`** — charger ce fichier au moment d'envoyer effectivement le recap, après la sélection des destinations en 7.2. Il couvre :

- **7.3 Signal** (canal `signal`) — envoi via le daemon `signal-cli` JSON-RPC : récupération des valeurs depuis l'entrée `DESTS`, cascade SSH, construction du payload en python3 dans un FICHIER (pièges zsh `echo`/here-string, `--data-binary @-`, chemin complet `/usr/bin/ssh`), pièces jointes en data URI, parsing de la réponse, fallback fichier local.
- **7.4 Slack** (canal `slack`) — `chat.postMessage` (texte seul, `mrkdwn:false`) OU flow `files.uploadV2` (screenshots) : résolution/caching du `channel_id`, publication python3 des deux chemins, parsing `.ok` + remèdes d'erreur.

Chaque canal est indépendant : l'échec de l'un n'empêche pas les autres ni ne plante le skill (le fichier local reste le fallback de copier-coller). Rapporter un statut PAR destination.


#### 7.5. Garde-fou multi-org

Pas de spam silencieux : la confirmation `AskUserQuestion` (7.2) est
OBLIGATOIRE à chaque envoi, par canal, même si l'utilisateur vient de cocher
ces mêmes canaux au recap précédent. La règle CLAUDE.md « actions à effet de
bord visibles demandent confirmation » s'applique strictement.

Pour ajouter un canal (Telegram, Mattermost…) à une org : (1) ajouter un bloc
sous `.tools.<canal>` du `tools.json` de cette org ; (2) étendre le verrou de
schéma ET le resolver (`run_resolve`) de `validate-orgs` pour qu'il émette la
destination — la skill ne lit JAMAIS `tools.json` en direct, elle ne voit que la
sortie du resolver ; (3) ajouter une sous-procédure 7.x d'envoi dédiée (chaque
canal est indépendant ; pas de fusion implicite). Recompiler le binaire après (2).
