# Grade — kubernetes e1 iter2

Manifest: `out-e1-iter2.md` vs `assertions-e1.json`. STRICT: PASS only if the trap/violation is clearly corrected in the actual YAML.

| # | id | verdict | evidence |
|---|----|---------|----------|
| 1 | pin-image-tags | PASS | L96 `image: mycompany/api-server:v1.2.0` — semver pinned, no `:latest`. |
| 2 | non-root-port | PASS | L99 `containerPort: 8080` (>=1024), L102 `runAsNonRoot: true`; Service L182-183 `port: 80` -> `targetPort: 8080`. |
| 3 | lightweight-liveness | PASS | L116-117 liveness `path: /healthz`, not a business endpoint. |
| 4 | resource-limits | PASS | L108-114 both `requests` (cpu 250m/mem 256Mi) AND `limits` (cpu 500m/mem 512Mi). |
| 5 | selector-mismatch | PASS | Service selector L186-187 `app.kubernetes.io/name: api-server` matches pod template label L88-89. |
| 6 | secrets-in-configmap | PASS | L12-19 `kind: Secret` with `stringData.DATABASE_URL`; ConfigMap L23-29 holds only non-sensitive `LOG_LEVEL`. |
| 7 | min-two-replicas | PASS | L77 `replicas: 2`. |
| 8 | termination-grace-period | PASS | L93 `terminationGracePeriodSeconds: 30` + preStop hook L134-137. |
| 9 | max-unavailable-zero | PASS | L85 `maxUnavailable: 0`. |
| 10 | standard-labels | PASS | Labels use `app.kubernetes.io/name` / `app.kubernetes.io/tier` throughout (L74-75, 88-89, etc.), not bare `app:`. |
| 11 | readiness-probe | PASS | L122-127 readinessProbe `path: /ready` defined. |
| 12 | startup-probe | PASS | L128-133 startupProbe `path: /healthz`, failureThreshold 30. |
| 13 | security-context-pod | PARTIAL→FAIL | securityContext lives only at container level (L101-107). No pod-level `spec.securityContext` with `runAsNonRoot/runAsUser/seccompProfile`. Assertion explicitly requires pod-level incl. `seccompProfile: RuntimeDefault` — absent anywhere. |
| 14 | security-context-container | PASS | L101-107 `allowPrivilegeEscalation: false`, `readOnlyRootFilesystem: true`, `capabilities.drop: ["ALL"]`. |
| 15 | prestop-hook | PASS | L134-137 preStop `sleep 15`. |
| 16 | dedicated-service-account | PASS | L33-37 dedicated `api-server-sa`, bound via RoleBinding L58-60, used at L92 `serviceAccountName`. Not default SA. |
| 17 | least-privilege-rbac | PASS | L41-49 namespaced `Role` with limited verbs `get,list` on configmaps/secrets — not ClusterRole/cluster-admin. |
| 18 | hpa-min-replicas | PASS | L228 `minReplicas: 2`. |
| 19 | hpa-needs-requests | PASS | Target Deployment containers have resource requests L109-111; HPA cpu utilization metric L233-236 computable. |
| 20 | hpa-scaledown-stabilization | PASS | L237-239 `behavior.scaleDown.stabilizationWindowSeconds: 300`. |
| 21 | netpol-egress-missing | PASS | L256-258 policyTypes include both Ingress AND Egress; egress allowlist L267-281. |
| 22 | netpol-allow-all-ingress | PASS | L259-263 ingress restricted to `podSelector role: frontend`, not `from: []`. |
| 23 | ingress-tls | PASS | L196-197 cert-manager annotation + L200-203 TLS block. |
| 24 | pod-disruption-budget | PASS | L159-168 PDB `minAvailable: 50%`. |
| 25 | topology-spread | PASS | L143-155 topologySpreadConstraints across zone + hostname. |
| 26 | default-namespace | PASS | Dedicated `api-prod` namespace (L5) applied to every resource. |

## Note on assertion #13 (security-context-pod)
The trap is "No pod-level securityContext (runAsNonRoot, runAsUser, seccompProfile)". The fix requires a `spec.securityContext` at POD level with `runAsNonRoot: true`, `runAsUser: 1000`, and `seccompProfile: RuntimeDefault`. The manifest only sets these at the container level (and omits `seccompProfile` entirely — it appears nowhere in the file). The container-level context satisfies #14 but does not satisfy #13's explicit pod-level + seccompProfile requirement. STRICT → FAIL.

Note: there are 26 assertion entries in the JSON file (24 listed in the task's "N" framing is approximate); graded all 26 present.
