# Lancer kirby-bot

Le bot lit sa configuration **uniquement** depuis les variables d'environnement
(pas de config `glab`, pas de sniffing du remote git). Une variable manquante
fait échouer le démarrage immédiatement avec une `ProviderConfigError` (le bot
crée la run-dir puis sort en exit code 1).

## Variables d'environnement

| Variable | Requis | Valeur pour Amadeo | Rôle |
|---|---|---|---|
| `KIRBY_GITLAB_TOKEN` | oui | *(PAT scope `api`, jamais commité)* | Personal access token GitLab. OAuth2 non supporté. |
| `GITLAB_HOST` | oui | `https://gitlab.com` | URL de base de l'instance (trailing `/` toléré). |
| `GITLAB_PROJECT_PATH` | oui | `cristal-group/amadeo` | Chemin `owner/repo` du projet. |
| `KIRBY_PROVIDER` | non | *(défaut `gitlab`)* | `github` ou `gitlab`. Non défini → `gitlab`. |

Source : `kirby-bot/src/gitlab/http.ts` (`computeConfig`) et
`kirby-bot/src/provider/select.ts` (`selectProvider`).

> ⚠️ Le preflight du skill ne vérifie que `KIRBY_GITLAB_TOKEN`. `GITLAB_HOST` et
> `GITLAB_PROJECT_PATH` doivent être présents aussi, sinon le bot échoue au boot.

## Commande de lancement (depuis le repo cible)

```bash
GITLAB_HOST=https://gitlab.com \
GITLAB_PROJECT_PATH=cristal-group/amadeo \
bun run /Users/rbaumier/www/kirby-bot/src/main.ts
```

`KIRBY_GITLAB_TOKEN` est supposé déjà exporté dans l'environnement du shell. Le
bot détecte `repo` et `defaultBranch` depuis `GITLAB_PROJECT_PATH`, pas depuis le
cwd — mais lancer depuis le repo cible reste la convention.

## Diagnostic des échecs au boot

Lire le `.output` de la tâche background (ou `run.jsonl` de la run-dir créée) :

- `GITLAB_HOST is not set` → exporter `GITLAB_HOST=https://gitlab.com`.
- `GITLAB_PROJECT_PATH is not set` → exporter `GITLAB_PROJECT_PATH=cristal-group/amadeo`.
- `KIRBY_GITLAB_TOKEN is not set` → exporter le PAT (`api` scope).
- `KIRBY_PROVIDER must be "github" or "gitlab"` → valeur invalide ; laisser non défini.
