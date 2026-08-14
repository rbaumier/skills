# recap — Publication par canal (Signal, Slack)

Procédures d'envoi détaillées référencées depuis `skills/recap/SKILL.md` (Step 7). Charger ce fichier au moment d'envoyer effectivement le recap vers les destinations retenues en 7.2. La résolution des destinations (7.1, resolver `validate-orgs --resolve-destinations`) et la confirmation `AskUserQuestion` (7.2) restent dans le corps du skill ; ce fichier ne couvre que l'envoi effectif par canal. Chaque entrée `DESTS` produite par le resolver porte déjà toutes les valeurs nécessaires — ne JAMAIS relire `tools.json` à la main ici.

#### 7.3. Envoi Signal via signal-cli daemon JSON-RPC (canal `signal`)

Pour CHAQUE destination Signal retenue :

1. **Récupérer les valeurs depuis l'entrée `DESTS` de cette destination** (déjà
   produite par le resolver en 7.1 — ne PAS relire `tools.json`) :
   - `ssh_hosts` (liste d'objets `{label, spec, port}`, essayés dans l'ordre)
   - `ssh_extra_args` (typiquement `-o ConnectTimeout=5 -o StrictHostKeyChecking=accept-new`)
   - `rpc_endpoint` (URL HTTP du daemon signal-cli sur le NAS, ex `http://172.17.0.1:8085/api/v1/rpc`)
   - `sender_number` (E.164, ex `+33620591590`)
   - la **cible** selon le `mode` de la destination (cf. 7.1) :
     - mode `direct` → champ `number` (E.164, ex `+336...`)
     - mode `group` → champ `group_id` (base64, ex `qZhSMu...=`)

2. **Cascade SSH** : essayer les `ssh_hosts` dans l'ordre. Le premier qui
   répond OK pour un ping est utilisé. Pas de retry agressif — un host =
   un essai.

   ```bash
   ssh -p $port $ssh_extra_args $spec "echo ok" >/dev/null 2>&1
   ```

   ⚠️ **Piège zsh (shell par défaut)** : zsh ne word-splitte PAS `$ssh_extra_args`,
   donc ssh reçoit tout le bloc comme une seule valeur `-o` et échoue avec
   `keyword stricthostkeychecking extra arguments at end of line` — ce qui se
   traduit par un **faux négatif « host unreachable »**. Pour éviter ça : inliner
   les flags (`ssh -p $port -o StrictHostKeyChecking=accept-new -o ConnectTimeout=5 $spec …`)
   ou forcer le split en zsh avec `${=ssh_extra_args}`.

3. **Construire le payload JSON-RPC en python3 ET l'écrire dans un FICHIER.**
   Règle non négociable : **JAMAIS** capturer le payload dans une variable pour
   le `echo`er / `<<<`-here-stringer ensuite. Sous **zsh** (shell par défaut),
   `echo "$PAYLOAD"` ré-interprète les `\n` du JSON et transforme les sauts de
   ligne ÉCHAPPÉS du message en vrais retours chariot → JSON invalide, erreur
   JSON-RPC `-32700 "Illegal unquoted character (CTRL-CHAR, code 10)"` (vérifié
   2026-06-16). Les here-strings `<<< "$PAYLOAD"` ont le même risque. NE PAS
   utiliser non plus `jq --rawfile` (filtré par un proxy CLI type RTK → JSON
   corrompu). La seule méthode fiable : python3 sérialise dans un fichier, puis
   on `cat` ce fichier dans le pipe (étape 4).

   **Pièces jointes (screenshots du recap)** : le daemon `signal-cli` accepte
   un champ `attachments` (liste de chaînes) où chaque entrée peut être une
   data URI `data:image/png;base64,…`. C'est le SEUL format utilisable depuis
   ton Mac : un chemin de fichier local n'est PAS accessible au conteneur
   Docker du daemon (filesystem isolé). Le builder ci-dessous scanne donc le
   `SHOTS_DIR` du recap (`.screenshots/recap-<TS>/`) et encode chaque PNG en
   data URI dans `params.attachments`. La taille du payload peut atteindre
   plusieurs Mo (5 PNG × ~500 Ko base64 ≈ 2,5 Mo de JSON) — c'est OK pour le
   daemon. Si `SHOTS_DIR` est vide ou inexistant, `attachments` est omis et
   seul le texte part. **Le destinataire reçoit alors UN seul message Signal
   avec le texte du recap + toutes les captures groupées**, dans l'ordre
   alphabétique du nom de fichier (donc cohérent avec l'ordre du tableau).

   ```bash
   RECAP_FILE=/tmp/{dd-mm-yy}-{project}.txt
   PAYLOAD_FILE=/tmp/signal-payload-{project}.json
   SHOTS_DIR=<chemin .screenshots/recap-<TS>/ produit en Step 4 ; vide si pas de screenshots>
   # MODE = "direct" (cible = number) ou "group" (cible = group_id) ; TARGET = la valeur correspondante.

   python3 - "$sender_number" "$TARGET" "$MODE" "$RECAP_FILE" "$SHOTS_DIR" "$PAYLOAD_FILE" <<'PY'
   import json, sys, os, base64, glob
   sender, target, mode, recap_path, shots_dir, payload_path = sys.argv[1:7]
   message = open(recap_path).read()
   params = {"account": sender, "message": message}
   if mode == "direct":
       params["recipient"] = [target]
   elif mode == "group":
       params["groupId"] = [target]
   if shots_dir and os.path.isdir(shots_dir):
       attachments = []
       for png in sorted(glob.glob(os.path.join(shots_dir, "*.png"))):
           with open(png, "rb") as f:
               b64 = base64.b64encode(f.read()).decode("ascii")
           attachments.append("data:image/png;base64," + b64)
       if attachments:
           params["attachments"] = attachments
   open(payload_path, "w").write(json.dumps({"jsonrpc":"2.0","method":"send","params":params,"id":1}))
   PY
   # Valider le JSON avant envoi (fail-fast)
   python3 -c "import json,sys; json.load(open(sys.argv[1]))" "$PAYLOAD_FILE"
   ```

4. **POST via SSH + curl** — `cat` le FICHIER de payload dans le pipe, avec le
   chemin **COMPLET** `/usr/bin/ssh` (le hook RTK sur `ssh`/`rtk proxy ssh` ne
   transmet PAS stdin au curl distant → erreur `-32600 "unexpected type:
   MISSING"`), et **`--data-binary @-`** (PAS `-d @-`, qui retire les sauts de
   ligne). Inliner les flags SSH (pas `$ssh_extra_args` non splitté en zsh, cf.
   piège étape 2). Le daemon est en localhost-NAS only → d'où le SSH.

   ```bash
   send() { cat "$PAYLOAD_FILE" | /usr/bin/ssh -p $port -o StrictHostKeyChecking=accept-new -o ConnectTimeout=5 "$1" \
     "curl -s -X POST '$rpc_endpoint' -H 'Content-Type: application/json' --data-binary @-" 2>/dev/null; }
   # Cascade ssh_hosts (cf. étape 2) : 1er host, fallback au suivant si réponse vide
   RESPONSE=$(send "$spec_host1"); [ -z "$RESPONSE" ] && RESPONSE=$(send "$spec_host2")
   ```

5. **Parser la réponse JSON-RPC** :
   - `result.results[*].type == "SUCCESS"` partout → afficher
     « ✅ Recap envoyé sur Signal "{label}" via {ssh_label} » (label = nom du destinataire en mode direct, nom du groupe en mode group)
   - Présence d'un `error.code` ou d'un type != SUCCESS → afficher
     l'erreur + le chemin du fichier local en fallback, NE PAS retry
     automatiquement, NE PAS planter le skill. L'utilisateur peut
     toujours copier-coller manuellement.

6. **Si tous les `ssh_hosts` échouent** (réseau down, NAS éteint) :
   afficher « ❌ NAS inaccessible (hosts essayés : {labels}). Fichier
   local conservé : {chemin}. Copier-coller manuel possible. » Pas de
   plantage du skill — le fichier local reste disponible.

#### 7.4. Envoi Slack via bot token (canal `slack`, chat.postMessage OU files.uploadV2)

Pour CHAQUE destination Slack retenue :

1. **Token** : lire le champ `token_file` de l'entrée `DESTS` de cette destination
   (fourni par le resolver en 7.1 — ne PAS relire `tools.json`), puis `cat` ce
   fichier (format `xoxb-`). Absent/vide → afficher « ❌ Token Slack absent
   ({token_file}) » et passer au suivant.

2. **`channel_id`** : utiliser directement le champ `channel_id` de l'entrée
   `DESTS` (le resolver le fournit déjà, et le verrou de schéma garantit qu'il
   existe). S'il est vide (cas anormal), fallback de résolution depuis le nom :
   - cache `~/.claude/shared/orgs/$org_slug/memory/recap/slack.json` (map nom→id) ;
   - sinon résolution API (et mise en cache du résultat) :
     ```bash
     TOKEN=$(cat "$token_file")
     curl -s -H "Authorization: Bearer $TOKEN" \
       "https://slack.com/api/conversations.list?types=public_channel,private_channel&limit=1000&exclude_archived=true" \
       | jq -r --arg n "<nom>" '.channels[]? | select(.name==$n) | .id'
     ```
   - introuvable (channel inexistant OU privé sans le bot) → afficher
     « ⚠️ Slack #{channel} introuvable côté bot — créer le channel et/ou
     inviter le bot ({workspace}, `/invite @{bot}`) » et passer au suivant.

3. **Publier en python3** — deux chemins selon la présence de screenshots :

   - **Pas de screenshots** (`SHOTS_DIR` vide ou inexistant) → un seul appel
     `chat.postMessage` avec le texte brut (le recap est PLAIN TEXT :
     `mrkdwn:false` pour que `—`, `**`, `_` passent verbatim ; python évite le
     piège `jq --rawfile` filtré par un proxy CLI type RTK — vérifié 2026-06-09).

   - **Screenshots présents** → flow `files.uploadV2` (chat.postMessage n'accepte
     PAS de pièces jointes inline ; l'ancien `files.upload` est retiré depuis
     2025-03-11). Trois étapes par batch :
     1. `files.getUploadURLExternal` (une fois par fichier) → renvoie un
        `upload_url` éphémère + un `file_id`.
     2. POST du binaire (en `application/octet-stream`) vers l'`upload_url`
        retourné.
     3. `files.completeUploadExternal` UNE seule fois avec la liste des
        `file_id`, le `channel_id`, et `initial_comment = texte du recap` →
        Slack poste un message unique avec toutes les images + le texte en
        commentaire d'introduction.

     ⚠️ `initial_comment` est interprété en **mrkdwn par défaut** (l'option
     `mrkdwn:false` de chat.postMessage n'existe pas sur cette route). Pas de
     workaround — le recap doit déjà être plain text propre (sans `*`/`_` qui
     pourraient être interprétés comme italique/bold). C'est déjà garanti par
     le format imposé en Step 2 (« plain text, no markdown markers »).

   Le même python3 gère les deux chemins :
   ```bash
   RECAP_FILE=/tmp/{dd-mm-yy}-{project}.txt
   SHOTS_DIR=<chemin .screenshots/recap-<TS>/ produit en Step 4 ; vide si pas de screenshots>
   python3 - "$channel_id" "$token_file" "$RECAP_FILE" "$SHOTS_DIR" <<'PY'
   import json, os, sys, glob, urllib.request, urllib.parse
   ch, tokenf, recapf, shots_dir = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
   token = open(tokenf).read().strip(); text = open(recapf).read()
   auth = {"Authorization": "Bearer " + token}

   def post_json(url, body):
       data = json.dumps(body).encode("utf-8")
       req = urllib.request.Request(url, data=data, method="POST",
           headers=dict(auth, **{"Content-Type": "application/json; charset=utf-8"}))
       return json.load(urllib.request.urlopen(req))

   pngs = sorted(glob.glob(os.path.join(shots_dir, "*.png"))) if shots_dir and os.path.isdir(shots_dir) else []

   if not pngs:
       r = post_json("https://slack.com/api/chat.postMessage",
           {"channel": ch, "text": text, "unfurl_links": False, "unfurl_media": False, "mrkdwn": False})
       print("ok" if r.get("ok") else "error:" + str(r.get("error")), r.get("ts") or "")
       sys.exit(0 if r.get("ok") else 1)

   # uploadV2 flow
   files = []
   for p in pngs:
       q = urllib.parse.urlencode({"filename": os.path.basename(p), "length": os.path.getsize(p)})
       r = json.load(urllib.request.urlopen(urllib.request.Request(
           "https://slack.com/api/files.getUploadURLExternal?" + q, headers=auth)))
       if not r.get("ok"):
           print("error:getUploadURL:" + str(r.get("error"))); sys.exit(1)
       upload_url, file_id = r["upload_url"], r["file_id"]
       with open(p, "rb") as f:
           body = f.read()
       urllib.request.urlopen(urllib.request.Request(
           upload_url, data=body, method="POST",
           headers={"Content-Type": "application/octet-stream"})).read()
       files.append({"id": file_id, "title": os.path.basename(p)})
   r = post_json("https://slack.com/api/files.completeUploadExternal",
       {"files": files, "channel_id": ch, "initial_comment": text})
   print("ok" if r.get("ok") else "error:complete:" + str(r.get("error")))
   sys.exit(0 if r.get("ok") else 1)
   PY
   ```

4. **Parser** `.ok` :
   - `true` → « ✅ Recap publié sur Slack #{channel} » (suivi de `+{N} captures`
     si l'envoi est passé par `files.uploadV2`).
   - `false` → lire `.error` (`not_in_channel`, `channel_not_found`,
     `invalid_auth`, `is_archived`, ou côté uploadV2 : `not_allowed`,
     `file_uploads_disabled`…), afficher l'erreur + le remède (`not_in_channel`
     → inviter le bot ; `invalid_auth` → token expiré ; `file_uploads_disabled`
     → l'admin du workspace a coupé l'upload bot), rappeler le fichier local.
     NE PAS retry, NE PAS planter.
