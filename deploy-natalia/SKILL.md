---
name: deploy-natalia
description: >-
  Deploy a Natalia backend service (chathandler, voicehandler,
  analysishandler, dashboard, tools) to the prod k3s cluster, or roll back a
  bad release. Use when the user asks to deploy or rollout a service, move
  prod to a tag X.Y.Z-rcN, or rollback natalia.
---

# Deploy Natalia (prod k3s)

Deploys one Rust service to the `natalia` namespace of the prod **k3s mono-node**
cluster (`sd-172216`, `51.158.36.155:6443`). Manual, one service at a time.

## Prerequisites (verify before starting)

1. **Image built by CI.** For the chat/voice/analysis handlers, the image is
   pushed by the `voicehandler` repo pipeline, which builds **one image per
   app-prefixed Git tag** (since #76, merged 2026-07-25):

   | Git tag pushed | Job triggered | Image pushed |
   |---|---|---|
   | `voicehandler-X.Y.Z-rcN` | `build-voicehandler` | `<registry>/voicehandler:X.Y.Z-rcN` |
   | `replayhandler-X.Y.Z-rcN` | `build-replayhandler` | `<registry>/replayhandler:X.Y.Z-rcN` |
   | `chathandler-X.Y.Z-rcN` | `build-chathandler` | `<registry>/chathandler:X.Y.Z-rcN` |
   | `analysishandler-X.Y.Z-rcN` | `build-analysishandler` | `<registry>/analysishandler:X.Y.Z-rcN` |

   **A bare `X.Y.Z-rcN` tag now builds nothing** — it matches no job. To release,
   push one prefixed tag per app you need:
   ```bash
   cd /Users/rbaumier/www/natalia/natalia-voicehandler
   git tag voicehandler-2.17.1-rc1 && git push origin voicehandler-2.17.1-rc1
   ```
   The `<app>-` prefix is stripped before the push, so the **image tag stays bare
   semver** — `deploy.sh <service> X.Y.Z-rcN` takes the version without the prefix,
   unchanged from before. `dashboard` and `tools` are built by their own repos'
   pipelines (their tag conventions are untouched by this change).

   Confirm the pipeline is **green** — the image
   `rg.fr-par.scw.cloud/natalia-private-registry/<service>:<tag>` must exist, or
   the rollout pulls a missing image and the pod stays `ImagePullBackOff`:
   ```bash
   glab ci list -R getnatalia/getnatalia/voicehandler | head -5
   ```
2. **Kube access.** Use the dedicated kubeconfig:
   ```bash
   export KUBECONFIG=~/.kube/natalia.kubeconfig   # context `natalia`, ns `natalia`
   kubectl config current-context   # must print: natalia
   ```
   (The infra repo's CLAUDE.md names the context `natalia-production-scaleway`;
   the working kubeconfig on this machine is `~/.kube/natalia.kubeconfig` — same
   cluster. The machine's default `~/.kube/config` is empty, so always pass
   `KUBECONFIG` explicitly.)
3. **Infra repo.** `cd /Users/rbaumier/www/natalia/natalia-infrastructure` and
   `git pull` first — the local chart working copy can lag the live cluster (the
   committed `tag:` is often behind what's actually running). **The cluster is the
   source of truth**, not `values.yaml`: read the running image with
   `kubectl get deploy -n natalia <service> -o jsonpath='{.spec.template.spec.containers[0].image}'`,
   never trust the committed tag.

## Step 1 — Pre-flight: is the service idle? (blocking gate)

A `helm upgrade` **kills the running pod**. If a conversation or (worse) a live
voice call is in flight, it is dropped. Voice calls are long-lived WebSocket
streams — killing the pod cuts the caller off mid-sentence.

Check the last few minutes of logs, filtering out the health probes:
```bash
export KUBECONFIG=~/.kube/natalia.kubeconfig
kubectl logs -n natalia deploy/<service> --since=5m | grep -vi "/health"
```
- **Only health/healthcheck lines → idle → safe to deploy.**
- Any real traffic (SMS/WhatsApp `conversation`, `Twilio`, `stream`, `websocket`,
  an in-progress turn) → **WAIT** and re-check. Do not roll during activity.

For `voicehandler`, also scan wider for an open call before rolling:
```bash
kubectl logs -n natalia deploy/voicehandler --since=15m | grep -icE "twilio|stream|websocket"
```

## Step 2 — Deploy (bump tag + helm upgrade)

Canonical path — `deploy.sh` seds the `tag:` in `charts/<service>/values.yaml`
then runs the helm upgrade:
```bash
export KUBECONFIG=~/.kube/natalia.kubeconfig
cd /Users/rbaumier/www/natalia/natalia-infrastructure
./deploy.sh <service> <tag>          # e.g. ./deploy.sh chathandler 2.16.1-rc1
```
`deploy.sh` does exactly:
```bash
sed -i '' "s/^\(  tag: \).*/\1<tag>/" charts/<service>/values.yaml
helm upgrade --install --create-namespace --namespace natalia <service> ./charts/<service>
```
Manual equivalent (same result) if you need to edit values first:
```bash
# edit charts/<service>/values.yaml -> image.tag: <tag>
helm upgrade --install --create-namespace --namespace natalia <service> ./charts/<service>
```

## Step 3 — Verify the rollout

```bash
export KUBECONFIG=~/.kube/natalia.kubeconfig
kubectl rollout status -n natalia deploy/<service> --timeout=120s
kubectl get deploy -n natalia <service> \
  -o jsonpath='{.spec.template.spec.containers[0].image}{"\n"}'   # confirms new tag
kubectl get pods -n natalia | grep <service>                      # new pod, Running, 0 restarts
kubectl logs -n natalia deploy/<service> --tail=30                # clean boot
```
Clean boot markers:
- chathandler: `Close sweeper started` + `Listening on 0.0.0.0:5050`
- voicehandler: `Listening on 0.0.0.0:5050`
- No panic / repeated `ERROR` / `CrashLoopBackOff` / `ImagePullBackOff`.

## Step 4 — Commit the tag bump

If you deployed from the canonical infra checkout, commit the `values.yaml` tag
change so the repo matches live:
```bash
git add charts/<service>/values.yaml
git commit -m "deploy(<service>): <tag>"
git push
```

## Rollback

```bash
export KUBECONFIG=~/.kube/natalia.kubeconfig
helm rollback <service> -n natalia            # previous release
# or re-run deploy.sh with the prior good tag
```

## Gotchas

- **One service per `helm upgrade`.** A change in the `voicehandler` repo may
  touch several crates — if it affects both chat and voice, deploy
  `chathandler` **and** `voicehandler` (each idle-checked separately); bumping one
  chart does not move the other.
- **One Git tag per image, too.** Since #76, each app needs its own prefixed tag
  to get an image built. A shared-crate fix affecting chat and voice means pushing
  **both** `chathandler-X.Y.Z-rcN` and `voicehandler-X.Y.Z-rcN` — pushing only one
  leaves the other service with no image for that version.
- **Don't touch n8n / ndots here** — different namespace, different (CI-driven)
  process, and a load-bearing `ndots:1` DNS fix (see infra CLAUDE.md).
