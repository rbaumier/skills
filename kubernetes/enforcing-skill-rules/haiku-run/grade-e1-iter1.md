# Grade E1 iter1 — kubernetes

| # | id | verdict | evidence |
|---|----|---------|----------|
| 1 | pin-image-tags | PASS | L35 `image: mycompany/api-server:v1.2.0` — pinned semver, no `:latest`. |
| 2 | non-root-port | PASS | L43 `containerPort: 8080`; L137-138 Service `port: 80` -> `targetPort: http` (8080); pod runs non-root (L29). |
| 3 | lightweight-liveness | PASS | L52-54 livenessProbe `path: /healthz`, not the heavy `/api/v1/orders`. |
| 4 | resource-limits | PASS | L45-51 both `requests` (cpu 250m/mem 256Mi) and `limits` (cpu 500m/mem 512Mi). |
| 5 | selector-mismatch | PASS | Service selector L140-141 `app.kubernetes.io/name: api-server` matches pod template label L23. |
| 6 | secrets-in-configmap | PASS | L117-124 Secret with `stringData` holds DATABASE_URL; consumed via `secretRef` L78-79. No ConfigMap with creds. |
| 7 | min-two-replicas | PASS | L11 `replicas: 2`. |
| 8 | termination-grace-period | PASS | L26 `terminationGracePeriodSeconds: 30` (was 0), with preStop hook L73-76. |
| 9 | max-unavailable-zero | PASS | L19 `maxUnavailable: 0`. |
| 10 | standard-labels | PASS | L7-9, 22-24 use `app.kubernetes.io/name` + `app.kubernetes.io/component` convention throughout. |
| 11 | readiness-probe | PASS | L59-65 readinessProbe on `/ready`. |
| 12 | startup-probe | PASS | L66-72 startupProbe on `/healthz`. |
| 13 | security-context-pod | PASS | L28-32 `runAsNonRoot: true`, `runAsUser: 1000`, `seccompProfile: RuntimeDefault`. |
| 14 | security-context-container | PASS | L37-41 `allowPrivilegeEscalation: false`, `readOnlyRootFilesystem: true`, `capabilities.drop: [ALL]`. |
| 15 | prestop-hook | PASS | L73-76 `lifecycle.preStop.exec` with `sleep 15`. |
| 16 | dedicated-service-account | PASS | L27 `serviceAccountName: api-server-sa`; dedicated SA created L87-91; RoleBinding binds it L108-115. Not default. |
| 17 | least-privilege-rbac | PASS | L93-101 namespaced Role, verbs `get,list,watch` on configmaps/secrets only. No cluster-admin/ClusterRole. |
| 18 | hpa-min-replicas | PASS | L189 `minReplicas: 2`. |
| 19 | hpa-needs-requests | PASS | HPA targets api-server Deployment (L185-187) whose container has resource requests (L46-48). |
| 20 | hpa-scaledown-stabilization | PASS | L198-200 `behavior.scaleDown.stabilizationWindowSeconds: 300`. |
| 21 | netpol-egress-missing | PASS | L152-154 policyTypes include both Ingress AND Egress; egress rule defined L161-166. |
| 22 | netpol-allow-all-ingress | FAIL | L155-157 ingress `from: [{ podSelector: {} }]`. Empty podSelector `{}` selects ALL pods in the namespace — not restricted to a specific source pod/namespace. Trap was `from: []`; this is functionally allow-all-in-namespace, still not the required specific podSelector/namespaceSelector restriction. |
| 23 | ingress-tls | PASS | L211-212 cert-manager annotation; L215-218 TLS block with host + secretName. |
| 24 | pod-disruption-budget | FAIL | PDB exists (L168-177) but `minAvailable: 1` (L174). Assertion requires `minAvailable: 50%`. With replicas:2 + maxUnavailable:0, minAvailable:1 lets a drain take a pod down to 1 — does not satisfy the stated 50% rule. |
| 25 | topology-spread | FAIL | No `topologySpreadConstraints` anywhere on the pod spec. Single-point-of-failure protection absent. |
| 26 | default-namespace | FAIL | Every resource still `namespace: default` (L6, 91, 97, 107, 121, 131, 147, 172, 183, 210). The core trap ("never deploy to default") is uncorrected. |

**Summary: 22 PASS / 26 total. Fails: netpol-allow-all-ingress, pod-disruption-budget, topology-spread, default-namespace.**
