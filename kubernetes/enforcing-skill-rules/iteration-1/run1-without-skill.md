# Without Skill - Run 1

## Output



Here is the fixed YAML with all issues addressed:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
  namespace: default
  labels:
    app.kubernetes.io/name: api-server
    app.kubernetes.io/component: backend
spec:
  replicas: 2
  selector:
    matchLabels:
      app.kubernetes.io/name: api-server
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app.kubernetes.io/name: api-server
        app.kubernetes.io/component: backend
    spec:
      serviceAccountName: api-server-sa
      terminationGracePeriodSeconds: 30
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: api
          image: mycompany/api-server:v1.0.0
          ports:
            - containerPort: 8080
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: ["ALL"]
          resources:
            requests:
              cpu: 250m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
          livenessProbe:
            httpGet:
              path: /healthz
              port: 8080
            initialDelaySeconds: 15
            periodSeconds: 10
            failureThreshold: 3
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
            failureThreshold: 30
            periodSeconds: 10
          lifecycle:
            preStop:
              exec:
                command: ["sh", "-c", "sleep 5"]
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: db-credentials
                  key: DATABASE_URL
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: api-server-sa
  namespace: default
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: api-server-role
  namespace: default
rules:
  - apiGroups: [""]
    resources: ["configmaps"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: api-server-binding
  namespace: default
subjects:
  - kind: ServiceAccount
    name: api-server-sa
    namespace: default
roleRef:
  kind: Role
  name: api-server-role
  apiGroup: rbac.authorization.k8s.io
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: default
data:
  LOG_LEVEL: "info"
---
apiVersion: v1
kind: Secret
metadata:
  name: db-credentials
  namespace: default
type: Opaque
stringData:
  DATABASE_URL: "postgresql://admin:s3cret@postgres:5432/mydb"
---
apiVersion: v1
kind: Service
metadata:
  name: api-service
  namespace: default
spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: 8080
  selector:
    app.kubernetes.io/name: api-server
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-ingress
  namespace: default
spec:
  rules:
    - host: api.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: api-service
                port:
                  number: 80
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: api-server-pdb
  namespace: default
spec:
  minAvailable: "50%"
  selector:
    matchLabels:
      app.kubernetes.io/name: api-server
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-hpa
  namespace: default
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
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 25
          periodSeconds: 60
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-network-policy
  namespace: default
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: api-server
  policyTypes:
    - Ingress
    - Egress
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

**Issues fixed (15 total):**

1. **`image: latest` tag** -- Pinned to `mycompany/api-server:v1.0.0`. No rollback capability with `latest`.
2. **Liveness probe on heavy endpoint** (`/api/v1/orders`) -- Changed to lightweight `/healthz`. Heavy endpoints cause cascading restarts under load.
3. **Missing readiness and startup probes** -- Added both. Readiness gates traffic; startup protects slow boot.
4. **Privileged port 80 in container** -- Changed `containerPort` to `8080`. Ports <1024 require root. Service remaps `80 -> 8080`.
5. **No resource requests/limits** -- Added `cpu: 250m/500m`, `memory: 256Mi/512Mi`. Without them, one pod can starve the node.
6. **No security context** -- Added pod-level `runAsNonRoot`, `runAsUser: 1000`, `seccompProfile: RuntimeDefault`; container-level `allowPrivilegeEscalation: false`, `readOnlyRootFilesystem: true`, `drop: ["ALL"]`.
7. **`terminationGracePeriodSeconds: 0`** -- Changed to `30`. Zero means SIGKILL, dropping in-flight requests. Added `preStop` sleep for graceful drain.
8. **Secret in ConfigMap** (`DATABASE_URL` with password) -- Moved to a `Secret` resource with `stringData`. ConfigMaps have no encryption at rest. Removed it from the ConfigMap.
9. **Service selector mismatch** -- Service had `app: api-svc`, Deployment labels had `app: api-server`. Fixed to `app.kubernetes.io/name: api-server` everywhere.
10. **`ClusterRoleBinding` to `cluster-admin` on `default` SA** -- Replaced with a namespaced `Role` + `RoleBinding` with least-privilege (`get`, `list`, `watch` on configmaps only). Created a dedicated `ServiceAccount` (`api-server-sa`).
11. **Using `default` ServiceAccount** -- Created `api-server-sa` and set `serviceAccountName` on the pod spec.
12. **`replicas: 1`** -- Changed to `2`. Single replica + rolling update = downtime.
13. **HPA `minReplicas: 1`, `maxReplicas: 50`** -- Changed to `minReplicas: 2` (availability) and `maxReplicas: 20` (sane budget ceiling). Added scale-down stabilization window to prevent flapping.
14. **NetworkPolicy `ingress.from: []`** (allows all) -- Restricted to pods with `role: frontend` only. Added `Egress` policy type with explicit egress to postgres on port 5432.
15. **Labels not using standard convention** -- Changed from `app`/`tier` to `app.kubernetes.io/name` and `app.kubernetes.io/component` for tooling compatibility. Added missing **PodDisruptionBudget** to prevent node drains from killing all pods.