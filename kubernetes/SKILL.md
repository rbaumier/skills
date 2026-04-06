---
name: kubernetes
description: Production-grade Kubernetes deployment patterns, manifest authoring, security hardening, autoscaling, RBAC, Helm basics, and operational debugging with kubectl.
---

## Gotchas
- `latest` tag: no rollback, no reproducibility. Always pin image versions.
- Privileged ports (<1024) require root. Use `>=1024` with `runAsNonRoot: true`, remap via Service `port:80 -> targetPort:8080`.
- Liveness probe on a heavy endpoint: cascading restarts under load. Use a dedicated lightweight `/healthz`.
- Missing resource limits: one pod starves the entire node. Always set requests AND limits.
- `kubectl apply` without `--namespace`: silently deploys to `default`. Always explicit.
- Selector mismatch between Service and Deployment labels: zero endpoints, zero traffic, zero errors in logs. Verify with `kubectl get endpoints`.
- Secrets in ConfigMaps: no encryption at rest. Use `Secret` (or sealed-secrets/external-secrets in prod).
- Single replica + rolling update = downtime. Min 2 replicas for zero-downtime deploys.
- `TRUNCATE`-style footgun: `kubectl delete pod` without `--grace-period` sends SIGKILL. Let `terminationGracePeriodSeconds` do its job.

## Critical Rules

### Pod Design Patterns

#### Sidecar Pattern
- Secondary container shares pod lifecycle, network, and volumes with the main app.
- Use cases: log collectors (fluentd), metrics exporters, service mesh proxies.
- Both containers mount the same `emptyDir` volume for data sharing.
- Sidecar should be lightweight — it runs alongside every replica.

#### Init Containers
- Run sequentially before main containers start. Each must exit 0.
- Use cases: wait for dependencies (`until nc -z postgres-svc 5432`), run migrations, download models.
- Init containers can have different images and security contexts than app containers.
- Failures block pod startup — good for enforcing prerequisites.

```yaml
# Init container: wait for DB, then run migrations before app starts
initContainers:
  - name: wait-for-db
    image: busybox:1.36
    command: ['sh', '-c', 'until nc -z postgres-svc 5432; do sleep 2; done']
  - name: run-migrations
    image: myapp:v1.2.0
    command: ['npx', 'prisma', 'migrate', 'deploy']
    envFrom:
      - secretRef:
          name: db-credentials
```

### Deployments & Rolling Updates
- `replicas: 2` minimum for availability during updates.
- `maxSurge: 1, maxUnavailable: 0` = zero-downtime rolling update.
- `terminationGracePeriodSeconds: 30` + `preStop` sleep = graceful drain of in-flight requests.
- Pin image tags to immutable versions (SHA or semver), never `latest`.
- Labels: use `app.kubernetes.io/*` standard labels for tooling compatibility.
- PodDisruptionBudget (PDB) for every production Deployment — `minAvailable: 50%` or `maxUnavailable: 1` prevents node drains (upgrades, scaling) from killing all pods simultaneously. Without PDB, `kubectl drain` respects nothing. PDB is mentioned in our checklist but has no dedicated section or example.
- Topology Spread Constraints — spread pods across zones/nodes: `topologySpreadConstraints: [{maxSkew: 1, topologyKey: topology.kubernetes.io/zone, whenUnsatisfiable: DoNotSchedule}]`. Prevents all replicas landing on one node/zone. Use with HPA for zone-aware autoscaling.
- Pod affinity/anti-affinity for co-location and spreading — `podAntiAffinity: preferredDuringSchedulingIgnoredDuringExecution` with `topologyKey: kubernetes.io/hostname` spreads replicas across nodes. `podAffinity` co-locates related pods (app + cache) for low latency. Use `preferred` not `required` to avoid scheduling deadlocks.

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1          # At most replicas+1 pods during update
    maxUnavailable: 0    # All current replicas stay up (zero downtime)
```

### Services & Networking
- `ClusterIP` (default): internal only. Safest for backend services.
- `NodePort`: dev/testing. Exposes on every node's IP.
- `LoadBalancer`: prod external access. Cloud-provisioned.
- Service `port` (what clients connect to) vs `targetPort` (pod's containerPort). Use this to remap 80->8080.
- Selector MUST exactly match pod template labels. Mismatch = silent failure.
- Verify: `kubectl get endpoints <svc-name>` — shows pod IPs if wired correctly, `<none>` if broken.
- Ingress with TLS termination — use Ingress (or Gateway API for newer clusters) with cert-manager for automatic Let's Encrypt certificates. `annotations: cert-manager.io/cluster-issuer: letsencrypt-prod` + `tls: [{secretName: app-tls}]`. Never terminate TLS at the application level in K8s.
- Gateway API as Ingress successor — for new clusters (K8s 1.26+), prefer `HTTPRoute` + `Gateway` over `Ingress`. Typed, extensible, multi-tenant. `HTTPRoute` supports header-based routing, traffic splitting, and URL rewriting natively. Check if your cloud provider's LB controller supports it.

```yaml
# Service abstracts unprivileged port — clients hit :80, pod runs :8080
spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: 8080
      protocol: TCP
  selector:
    app.kubernetes.io/name: my-app    # MUST match pod labels exactly
```

### ConfigMaps & Secrets
- ConfigMap: non-sensitive config (log levels, feature flags, connection strings without passwords).
- Secret: sensitive data. `stringData` field auto-encodes to base64 — never commit plain `data` values.
- Mount as env vars (`envFrom`) or as files (`volumeMounts`). Files support hot-reload without restart.
- Prod secrets: use sealed-secrets, external-secrets-operator, or Vault. Never plain YAML in git.

```yaml
# ConfigMap for app config
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  LOG_LEVEL: "info"
  MAX_CONNECTIONS: "100"

---
# Secret — use stringData (auto-encodes), never commit to git
apiVersion: v1
kind: Secret
metadata:
  name: db-credentials
type: Opaque
stringData:
  DATABASE_URL: "postgresql://user:pass@postgres:5432/mydb"
```

### Resource Limits & Requests
- `requests`: scheduler uses this to place pods on nodes. Set to typical usage.
- `limits`: hard ceiling. CPU throttled, memory OOM-killed beyond this.
- Always set both. Missing limits = unbounded resource consumption.
- Adapt to cluster size: local (<6GB) use 128Mi-256Mi, standard (6-16GB) use 256Mi-512Mi, prod (>16GB) use 512Mi-1Gi.

```yaml
resources:
  requests:          # "I typically need this much"
    cpu: 250m        # 0.25 CPU cores
    memory: 256Mi
  limits:            # "Kill/throttle me beyond this"
    cpu: 500m
    memory: 512Mi
```

### Health Checks (Probes)
- **Liveness**: "Is the process stuck?" Failure = container restart. Use lightweight endpoint.
- **Readiness**: "Can it handle traffic?" Failure = removed from Service endpoints. Use DB/dependency check.
- **Startup**: "Is it still booting?" Disables liveness/readiness until app is ready. Essential for slow starters (ML models).
- `initialDelaySeconds`: give the app time to boot before checking.
- `failureThreshold * periodSeconds` = total tolerance window.

```yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
  initialDelaySeconds: 15
  periodSeconds: 10
  failureThreshold: 3       # 3 consecutive failures = restart

readinessProbe:
  httpGet:
    path: /ready
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 5

startupProbe:
  httpGet:
    path: /healthz
    port: 8080
  failureThreshold: 30      # 30 * 10s = 5 min max boot time
  periodSeconds: 10
```

### Horizontal Pod Autoscaler (HPA)
- Requires `requests` set on containers (HPA compares actual vs requested).
- `minReplicas >= 2` for availability. `maxReplicas` = budget ceiling.
- Scale-down stabilization window prevents flapping (default 300s is sane).
- Scale on CPU (70%) and/or memory (80%). Custom metrics via Prometheus adapter for queue depth, etc.

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-server
  minReplicas: 2
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300   # Prevents flapping
      policies:
        - type: Percent
          value: 25                     # Max 25% scale-down per minute
          periodSeconds: 60
```

### Security Context & RBAC
- Pod-level: `runAsNonRoot: true`, `runAsUser: 1000`, `seccompProfile: RuntimeDefault`.
- Container-level: `allowPrivilegeEscalation: false`, `readOnlyRootFilesystem: true`, `drop: ["ALL"]`.
- RBAC: create a `ServiceAccount` per app. Bind a `Role` (namespaced) or `ClusterRole` (cluster-wide) via `RoleBinding`.
- Least privilege: only grant verbs (`get`, `list`, `watch`, `create`) on resources the app actually needs.
- Never use `default` ServiceAccount in prod — it may have excessive permissions.
- Pod Security Standards (PSS) enforcement — apply namespace labels: `pod-security.kubernetes.io/enforce: restricted`. Three levels: privileged (unrestricted), baseline (prevents known escalations), restricted (hardened). Use `restricted` for all production namespaces. PSS replaces deprecated PodSecurityPolicy.
- Policy engines (Kyverno/OPA Gatekeeper) — enforce organizational policies as admission controllers. Examples: require labels, block latest tag, enforce resource limits, require non-root. Kyverno uses YAML policies (simpler). OPA uses Rego language (more powerful). Choose one for production clusters.

```yaml
# ServiceAccount — one per app, never share
apiVersion: v1
kind: ServiceAccount
metadata:
  name: api-server-sa

---
# Role — namespaced, least privilege
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: api-server-role
rules:
  - apiGroups: [""]
    resources: ["configmaps", "secrets"]
    verbs: ["get", "list", "watch"]      # Read-only, no create/delete

---
# RoleBinding — connects ServiceAccount to Role
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: api-server-binding
subjects:
  - kind: ServiceAccount
    name: api-server-sa
roleRef:
  kind: Role
  name: api-server-role
  apiGroup: rbac.authorization.k8s.io
```

### Network Policies
- Default deny all ingress/egress, then allowlist specific paths.
- `podSelector` + `namespaceSelector` for fine-grained control.
- Always allow monitoring namespace to scrape metrics.
- Without a CNI that supports NetworkPolicy (Calico, Cilium), policies are silently ignored.

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-network-policy
spec:
  podSelector:
    matchLabels:
      app: api-server
  policyTypes: [Ingress, Egress]
  ingress:
    - from:
        - podSelector:
            matchLabels:
              role: frontend
      ports:
        - port: 8080
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: postgres
      ports:
        - port: 5432
```

### Debugging with kubectl
- `kubectl get pods -n <ns>`: first check — are pods Running, Pending, CrashLoopBackOff?
- `kubectl describe pod <name>`: events section reveals scheduling failures, image pull errors, probe failures.
- `kubectl logs <pod> [-c container] [--previous]`: app logs. `--previous` shows logs from the last crash.
- `kubectl exec -it <pod> -- sh`: shell into container for live debugging. Requires a shell in the image.
- `kubectl debug -it <pod> --image=busybox --target=<container>`: ephemeral debug container when image has no shell.
- `kubectl port-forward svc/<name> 8080:80`: test service locally without exposing.
- `kubectl top pods -n <ns>`: actual CPU/memory usage (requires metrics-server).
- `kubectl get events --sort-by=.lastTimestamp -n <ns>`: cluster events sorted by time.

```bash
# Quick debug flow for CrashLoopBackOff
kubectl describe pod <name> -n <ns>          # Check events
kubectl logs <name> -n <ns> --previous       # Last crash logs
kubectl get events -n <ns> --sort-by=.lastTimestamp  # Timeline
```

### Helm Basics
- Helm = package manager for K8s. Charts = reusable manifest templates.
- `helm install <release> <chart>`: deploy. `helm upgrade <release> <chart>`: update. `helm rollback <release> <revision>`: undo.
- `values.yaml`: configuration layer. Override with `-f custom-values.yaml` or `--set key=value`.
- `helm template <release> <chart>`: render manifests locally without deploying. Use for review/CI.
- `helm list -n <ns>`: see deployed releases. `helm history <release>`: revision history for rollback.
- Pin chart versions in CI: `helm install --version 1.2.3`. Never use unpinned chart versions in production.
- Kustomize for environment overlays — `base/` with shared manifests, `overlays/{dev,staging,prod}/` with per-environment patches. `kustomization.yaml` with `resources:`, `patches:`, `configMapGenerator:`. No templating language — pure overlay model. Use when Helm is overkill.

```bash
# Standard Helm workflow
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update
helm search repo bitnami/postgresql --versions

# Install with custom values
helm install my-db bitnami/postgresql \
  --namespace databases \
  --create-namespace \
  -f values-prod.yaml \
  --version 12.5.0

# Preview before applying
helm template my-db bitnami/postgresql -f values-prod.yaml

# Upgrade and rollback
helm upgrade my-db bitnami/postgresql -f values-prod.yaml
helm rollback my-db 1    # Revision number from helm history
```

### Observability
- Observability stack — ServiceMonitor CRD (Prometheus Operator) to auto-discover pod metrics. Instrument apps with `/metrics` endpoint. AlertManager rules for SLO violations. Minimum alerts: high error rate (>1%), high latency (p99 > Xms), pod restarts.

### GitOps
- GitOps with ArgoCD/Flux — store manifests in git, let ArgoCD sync cluster state to git state. `Application` CR points to git repo + path + target cluster. Auto-sync with `syncPolicy: automated: {prune: true, selfHeal: true}`. Never `kubectl apply` manually in production.

### Namespace Governance
- `ResourceQuota`: caps total CPU/memory/pod-count per namespace. Prevents one team from starving others.
- `LimitRange`: sets default requests/limits per container. Safety net for manifests that forget resource specs.
- Combine both: LimitRange provides defaults, ResourceQuota enforces ceiling.

```yaml
# ResourceQuota — namespace-wide ceiling
apiVersion: v1
kind: ResourceQuota
metadata:
  name: team-quota
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 8Gi
    limits.cpu: "8"
    limits.memory: 16Gi
    pods: "20"

---
# LimitRange — per-container defaults and bounds
apiVersion: v1
kind: LimitRange
metadata:
  name: container-limits
spec:
  limits:
    - type: Container
      default:           # Applied when manifest omits limits
        cpu: 500m
        memory: 512Mi
      defaultRequest:    # Applied when manifest omits requests
        cpu: 100m
        memory: 128Mi
      max:               # Hard ceiling per container
        cpu: "2"
        memory: 2Gi
```

### Workload Type Selection
- **Deployment**: stateless apps (APIs, frontends). Default choice.
- **StatefulSet**: stable network identity + ordered deployment (databases, Kafka).
- **Job**: one-time batch tasks that run to completion.
- **CronJob**: scheduled Jobs (reports, cleanup, backups).
- **DaemonSet**: must run on every node (log agents, monitoring, CNI).

## Checklist
- [ ] Image tags pinned (never `latest`)
- [ ] Resource requests AND limits on every container
- [ ] Liveness, readiness, and startup probes configured
- [ ] Security context: `runAsNonRoot`, `readOnlyRootFilesystem`, `drop: ALL`
- [ ] containerPort >= 1024 (compatible with non-root)
- [ ] Rolling update with `maxUnavailable: 0` for zero-downtime deploys
- [ ] `preStop` hook with sleep for graceful connection draining
- [ ] `terminationGracePeriodSeconds` set appropriately
- [ ] PodDisruptionBudget (`minAvailable: 50%`) for maintenance windows
- [ ] Network policies restrict ingress/egress to required paths only
- [ ] Secrets via sealed-secrets or external-secrets, not plain YAML in git
- [ ] HPA with scale-down stabilization window
- [ ] Namespace has ResourceQuota + LimitRange
- [ ] ServiceAccount per app, RBAC with least privilege
- [ ] Labels follow `app.kubernetes.io/*` convention
- [ ] Service selector matches pod template labels exactly

## Anti-Patterns
- No resource limits: single pod starves the entire node.
- Liveness probe on heavy endpoint: cascading restarts under load.
- `latest` tag: no rollback capability, unpredictable deployments.
- Secrets in ConfigMaps: no encryption at rest.
- Single replica for stateful services: downtime during updates.
- Missing PodDisruptionBudget: node drain kills all pods simultaneously.
- `kubectl exec` in prod without audit trail: security and compliance risk.
- Hardcoded namespace in manifests: breaks multi-env deployment.
- Sharing `default` ServiceAccount across apps: excessive implicit permissions.
