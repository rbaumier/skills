---
name: paperclip
description: >-
  Vide en une passe les blocages humains du Paperclip Natalia (https://paperclip.getnatalia.com) via l'API : questions
  d'agents, issues « blocked », décisions/approbations, agents en erreur, backlogs figés. Liste tout,
  te fait trancher via AskUserQuestion par lots de 4, puis applique chaque réponse. Triggers :
  /paperclip, « décisions paperclip », « débloquer les agents », « backlog paperclip », « agents en
  erreur », « tâches bloquantes paperclip ».
---

# Paperclip Natalia — trancher les blocages

Vider la file des points de blocage humains de Paperclip le plus vite possible, avec le moins
d'allers-retours. Tout l'I/O passe par le binaire `paperclip-decisions`, **uniquement par l'API
HTTP** de ton instance (jamais de base de données, jamais de `docker exec`/`kubectl exec`) ; ce skill
ne fait que **lister → demander → appliquer**.

Binaire : `~/.claude/skills/paperclip/paperclip-decisions/target/release/paperclip-decisions`,
construit par `install.sh` (`cargo build --release --locked`). Le `target/` n'est pas livré : s'il
manque, relancer `install.sh`.

## 0. Accès (instance unique, aucune sélection à faire)

Ce skill est livré en **mono-instance** : une seule instance, https://paperclip.getnatalia.com, et la company Natalia.
Ne JAMAIS demander quelle instance viser, ne lire aucun registre, n'ouvrir aucun tunnel SSH.

La configuration vit dans `~/.config/paperclip/env` (écrit par `install.sh`, mode 600) :
`PAPERCLIP_API_BASE`, `KEY_FILE` (ta board key personnelle, `~/.config/paperclip/board.key`),
`PAPERCLIP_COMPANY_ID` (vide = toutes les companies dont tu es membre).
La board key est liée à TON compte Paperclip : tu ne vois et ne modifies que ce que tes droits
de membre permettent. Elle n'est jamais affichée ni recopiée dans un message.

Chaque commande (le `list` du §1 comme celles du §3) se lance ainsi, en remplaçant `list` :

```sh
sh -c 'set -a; . "$HOME/.config/paperclip/env"; set +a; exec "$HOME/.claude/skills/paperclip/paperclip-decisions/target/release/paperclip-decisions" "$@"' _ list
```

Une réponse `401` = clé absente, expirée (1 an) ou révoquée : relancer `install.sh` (il régénère la
clé après suppression de `~/.config/paperclip/board.key`).

## 1. Lister

Sortie JSON compacte :
`{"companies":[…],"companies_truncated","stale_hours","interactions":[…],"blocked_issues":[…],
"decisions":[…],"approvals":[…],"recovery_actions":[…],"agents_in_error":[…],"stalled_backlog":[…],
"errors":[…]}`.

- Chaque item porte `age_days` (jours entiers depuis sa création ou son entrée dans l'état, `null`
  si inconnu ; `max_age_days` pour `stalled_backlog`) et chaque section sort **du plus ancien au plus
  récent**. Pour un agent, l'âge part de sa dernière mise à jour (une modification d'instructions le
  remet à zéro).
- Chaque `blocked_issues` déjà couvert par une `interactions` en attente est dédupliqué.
- `agents_in_error` : agents `error`/`paused` (30/company max) — `name`, `status`,
  `error_reason`/`pause_reason`, `adapter_type`, `heartbeat` (`enabled`, `wake_on_demand`),
  `last_run` (`status`, `at`, `error`).
- `stalled_backlog` : issues `backlog`/`todo` créées il y a plus de `stale_hours` (défaut 24,
  `PAPERCLIP_STALE_HOURS` 1..720), **agrégées par agent** : `backlog`, `todo`, `max_age_days`,
  5 `examples` (les plus vieilles), `agent_status`, `wake_on_demand` et `why` :
  `assignee_deleted` (agent inconnu de la company), `agent_error`, `agent_paused`,
  `wake_on_demand_off`, `backlog_never_wakes` (le statut backlog ne réveille jamais l'agent),
  `todo_not_picked`. Une entrée `why: "unassigned"` regroupe les issues sans assignee. Les entrées
  `assignee_deleted`/`unassigned` portent aussi `issue_ids` (200 max).
- `errors` : section d'une company illisible (les autres sections restent valides) → le signaler.
- `companies[].issues_truncated: true` = plus de 10 000 issues backlog/todo, liste partielle.

Toutes les listes vides → le dire en une phrase et s'arrêter.

## 2. Faire trancher — AskUserQuestion, lots de 4

Un item = **une** question. Regrouper par paquets de 4 (max/appel) et enchaîner les appels jusqu'à
épuisement. Dans chaque type, garder l'ordre de la sortie (âge décroissant) et ouvrir la `question`
par l'âge quand `age_days` ≥ 3 (« J+5, … »), pour que les plus vieux blocages passent en tête. Ordre conseillé : `interactions` (débloquent un agent immédiatement), `blocked_issues`,
`decisions`, `approvals`, `recovery_actions`, `agents_in_error`, puis `stalled_backlog` (une remise
en service peut changer la réponse sur son backlog).

Règles communes :
- **`header`** (≤ 12 car.) : l'identifiant de l'issue (`HOO-137`) quand il existe, sinon
  `Décision N` / `Appro N` / le prénom de l'agent.
- **`question`** : DONNER TOUT LE CONTEXTE (l'utilisateur ne voit rien d'autre) : company, titre,
  texte de la demande (`prompt` / `action` / `body`), infos utiles (`details`, `summary`, `since`,
  `expires`). Reformuler court si très long, sans perdre le sens.
- **Carte de décision** : si le `description`/`body`/`details` contient un bloc `Décision / Vérifié
  / Reco / Sans décision / Réversibilité` (les tickets Ops en posent un en tête), **s'en servir**.
  La `question` reprend `Décision` + `Vérifié` (ce qui est déjà écarté, pour ne pas le faire ré-enquêter) ; la **`Reco` devient l'option mise EN PREMIER, suffixée `(Recommandé)`** ; le `Sans décision`
  (coût de l'inaction) va dans le `description` de cette option. Ne jamais présenter un binaire nu
  quand la carte offre une reco : l'utilisateur doit voir l'option conseillée et son pourquoi, pas deviner.
- L'utilisateur garde toujours « Other » ; l'exploiter à l'étape 3 (raison, réponse libre).

Mapping des options par type :

- **`interactions`**, `kind = request_confirmation` : options = `accept_label` puis `reject_label`
  (exactement ces libellés). `allow_decline_reason=true` → s'il rejette, capter sa raison
  (notes/Other).
- **`interactions`**, `kind` avec `questions` non-null (question à choix) : mapper
  `questions[].options[]` → options AskUserQuestion, garder la correspondance libellé → `option.id`.
- **`blocked_issues`** : options `Débloquer (→ todo)`, `Annuler l'issue`, `Laisser bloqué`. Lire le
  champ `action` (ce qui manque pour débloquer) et METTRE EN PREMIER l'option la plus probable :
  si l'issue attend un tiers (souvent un tiers / un input externe), défaut = `Laisser bloqué
  (Recommandé)` ; si c'est l'utilisateur le bloqueur et qu'il vient d'agir, `Débloquer`. Ne jamais forcer.
  **Cas d'un vrai choix métier** (la description porte une carte de décision dont la `Reco` n'est
  ni « débloquer » ni « annuler » mais une action domaine : redémarrer vs investiguer, réactiver vs
  assumer) : la `question` **pose le choix métier** avec la `Reco (Recommandé)` en premier et le
  coût d'inaction en `description` ; sa réponse est reportée en **commentaire** de l'issue via
  « Other »/notes (`issue-comment`), et le statut (`débloquer`/`laisser`) suit ce que sa réponse
  implique. Le tri-état seul aplatit le vrai choix — ne pas le présenter nu quand une reco existe.
- **`decisions`** : mapper `options[]` (libellé = `label`/`title`/`text`/`id`, `description` =
  `description`/`detail`/`hint`) ; option marquée `recommended`/`isDefault` en premier. Garder la
  correspondance libellé → `option.id`. Champ `inputs` non vide → réclamer les valeurs texte
  (labels) dans la question, les récupérer pour `--input`.
- **`approvals`** : options `Approuver` puis `Rejeter` (le `description` résume `payload`).
- **`recovery_actions`** (la plateforme demande à un humain de trancher une reprise stalled — lire
  `cause` / `next_action`) : options → couple `outcome` + `sourceIssueStatus` : `Restaurée`
  (restored → todo/done), `Faux positif` (false_positive → todo), `Rester bloqué` (blocked →
  blocked), `Annuler`. **N'annuler en lot que des passes de routine** (`originKind:
  routine_execution`) ; une tâche ponctuelle (`manual`) dont l'agent a disparu se réassigne ou se
  recrée sur l'instance où l'agent a migré, jamais annulée (règle de la maison).
- **`agents_in_error`** : la question cite `error_reason`/`pause_reason` et l'erreur du `last_run`.
  Options : `Remettre en service` — **(Recommandé)** si l'erreur est une auth/un accès désormais
  réparé (ex. « terminal access failure », 401 OAuth corrigé), sinon en second ; `Laisser` ;
  `Mettre en pause` (agent `error` qu'on ne veut plus voir tourner). Un agent `paused` avec
  `pause_reason: "manual"` = pause voulue → `Laisser (Recommandé)`.
- **`stalled_backlog`** : **une question PAR AGENT** (`header` = prénom de l'agent ; question =
  company, compte backlog/todo, âge max, `why` en clair, 2-3 `examples`). Options : `Passer le
  backlog en todo`, `Réassigner`, `Annuler les plus vieilles`, `Laisser`. Option mise en premier
  `(Recommandé)` selon `why` :
  - `backlog_never_wakes`, `todo_not_picked` (agent sain) → `Passer le backlog en todo` ;
  - `agent_error`, `agent_paused` → `Laisser`, sauf si l'utilisateur vient de remettre l'agent en service dans
    cette passe → `Passer le backlog en todo` ;
  - `wake_on_demand_off` → `Laisser` (l'agent ne travaille que sur son heartbeat, souvent voulu) ;
  - `assignee_deleted` → `Réassigner` : les options nomment 2-3 agents existants **de la même
    company** au rôle proche (lus dans les autres entrées du `list` ou via « Other ») ;
  - `unassigned` → `Réassigner` (même règle) ou `Laisser`.

## 3. Appliquer — débloquer les runs

Une invocation du binaire par item tranché, par la forme du §0 (plusieurs commandes d'une même
instance peuvent partager un sous-shell et donc un tunnel). Selon la réponse :

- **Interaction / confirmation** :
  - accepte → `int-accept <issue_id> <interaction_id>`
  - rejette → `int-reject <issue_id> <interaction_id> --reason "<raison de l'utilisateur>"`
- **Interaction / question** : `int-respond <issue_id> <interaction_id> --answer <questionId>=<optionId>[,<optionId>] [--summary "…"]`
- **Blocked issue** :
  - Débloquer → `issue-status <issue_id> todo --clear-unblock [--comment "<décision/réponse de l'utilisateur>"]`
  - Annuler → `issue-status <issue_id> cancelled [--comment "<pourquoi>"]`
  - Répondre sans débloquer (Other) → `issue-comment <issue_id> --body "<texte>"`
  - Laisser bloqué → ne rien faire.
- **Décision** : retrouver l'`option.id` du libellé choisi → `decide <decision_id> <option_id> [--input k=v …]`.
  Réponse via « Other » (hors liste) → ne PAS deviner d'`option.id` : reposer la question avec la
  consigne de l'utilisateur.
- **Approbation** : `appr-approve <approval_id> [--note "…"]` ou `appr-reject <approval_id> [--note "…"]`.
- **Recovery action** : `recovery-resolve <issue_id> <action_id> <outcome> <sourceIssueStatus> [--note "…"]`
  (outcome ∈ restored|false_positive|blocked ; status ∈ todo|done|in_review|blocked — l'API refuse
  `cancelled` comme statut). Pièges vérifiés le 2026-10-04 (916.1) :
  - Annuler → `issue-status <issue_id> cancelled --comment "<pourquoi>"` : un changement de statut
    solde la reprise active.
  - `legacy_execution_requires_reconciliation` + `restored → todo` → 409 (exige une attestation
    `executionReconciliation`, puis bute sur « execution environment has not finished releasing »
    quand le bail du run hérité a fui) → `issue-status <issue_id> todo --comment "<consigne>"` : une
    issue todo avec un agent assigné rend la reprise caduque et réveille l'agent.
- **Agent en erreur** :
  - Remettre en service → `agent-clear-error <agent_id>` (statut `error`) ou `agent-resume
    <agent_id>` (statut `paused`), puis `agent-wake <agent_id>`.
  - Mettre en pause → `agent-pause <agent_id>`. Laisser → rien.
- **Backlog bloqué** :
  - Passer en todo → `backlog-promote <agent_id> [--limit N] [--older-than-hours H]` (N 1..200,
    défaut 50, les plus vieilles d'abord ; imprime la liste traitée dans `processed`).
  - Réassigner → `issue-assign <issue_id> <agent_id> --status todo` par issue (`issue_ids` de
    l'entrée, sinon les `examples` désignées par l'utilisateur).
  - Annuler les plus vieilles → `issue-status <issue_id> cancelled --comment "<pourquoi>"` sur les
    `examples`.

Chaque commande imprime `{"action","id","ok","http","response"}` ; `ok:false` (exit 1) = échec à
signaler, pas à compter comme tranché (exit 2 = erreur d'usage ou de transport).

## 4. Récapituler

Récap bref, par instance/company : interactions acceptées/rejetées, issues débloquées/annulées/
laissées, décisions et approbations résolues, agents remis en service/mis en pause, backlogs
promus/réassignés, + la liste des échecs (`ok:false`) à reprendre.

## Notes

- Ne jamais trancher à la place de l'utilisateur : ce skill présente et transmet SES choix uniquement.
- Beaucoup de `blocked_issues` attendent un humain externe (souvent un tiers) — les présenter pour
  info, défaut « Laisser bloqué », ne débloquer que si l'utilisateur le décide.
- `list` ne modifie rien ; seules les commandes du §3 écrivent, et uniquement après la réponse
  de l'utilisateur.
