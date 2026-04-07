# With Skill - Run 1

## Output

Now I have both the skill rules and the prompt. Let me analyze every issue and produce the fixed YAML.

Here is the fixed YAML with all issues resolved:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
  namespace: production
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
          image: mycompany/api-server:1.0.0
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
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: db-credentials
                  key: DATABASE_URL
          lifecycle:
            preStop:
              exec:
                command: ["sh", "-c", "sleep 5"]
---
apiVersion: v1
kind: Secret
metadata:
  name: db-credentials
  namespace: production
type: Opaque
stringData:
  DATABASE_URL: "postgresql://admin:s3cret@postgres:5432/mydb"
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: production
data:
  LOG_LEVEL: "info"
---
apiVersion: v1
kind: Service
metadata:
  name: api-service
  namespace: production
spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: 8080
      protocol: TCP
  selector:
    app.kubernetes.io/name: api-server
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-ingress
  namespace: production
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
    - hosts:
        - api.example.com
      secretName: api-tls
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
apiVersion: v1
kind: ServiceAccount
metadata:
  name: api-server-sa
  namespace: production
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: api-server-role
  namespace: production
rules:
  - apiGroups: [""]
    resources: ["configmaps", "secrets"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: api-server-binding
  namespace: production
subjects:
  - kind: ServiceAccount
    name: api-server-sa
    namespace: production
roleRef:
  kind: Role
  name: api-server-role
  apiGroup: rbac.authorization.k8s.io
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-hpa
  namespace: production
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
  namespace: production
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
              app.kubernetes.io/component: frontend
      ports:
        - port: 8080
  egress:
    - to:
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: postgres
      ports:
        - port: 5432
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: api-server-pdb
  namespace: production
spec:
  minAvailable: "50%"
  selector:
    matchLabels:
      app.kubernetes.io/name: api-server
---
apiVersion: v1
kind: ResourceQuota
metadata:
  name: production-quota
  namespace: production
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 8Gi
    limits.cpu: "8"
    limits.memory: 16Gi
    pods: "20"
---
apiVersion: v1
kind: LimitRange
metadata:
  name: container-limits
  namespace: production
spec:
  limits:
    - type: Container
      default:
        cpu: 500m
        memory: 512Mi
      defaultRequest:
        cpu: 100m
        memory: 128Mi
      max:
        cpu: "2"
        memory: 2Gi
```

**Issues fixed (25 total):**

1. **`latest` image tag** -- pinned to `mycompany/api-server:1.0.0`. No rollback possible with `latest`.
2. **`replicas: 1`** -- raised to `2`. Single replica + rolling update = downtime.
3. **`maxUnavailable: 1`** -- changed to `0`. Zero-downtime rolling updates require `maxUnavailable: 0`.
4. **`terminationGracePeriodSeconds: 0`** -- set to `30`. Zero means SIGKILL immediately, no graceful drain.
5. **Missing `preStop` hook** -- added `sleep 5` to drain in-flight requests before SIGTERM.
6. **`containerPort: 80`** -- changed to `8080`. Privileged ports (<1024) require root; incompatible with `runAsNonRoot`.
7. **Liveness probe on `/api/v1/orders`** -- changed to `/healthz`. Heavy endpoint causes cascading restarts under load.
8. **Missing readiness probe** -- added on `/ready` to gate traffic until the app is ready.
9. **Missing startup probe** -- added to disable liveness/readiness during boot.
10. **Missing resource requests and limits** -- added `cpu: 250m/500m`, `memory: 256Mi/512Mi`. Without limits, one pod starves the node.
11. **Missing security context (pod-level)** -- added `runAsNonRoot`, `runAsUser: 1000`, `seccompProfile: RuntimeDefault`.
12. **Missing security context (container-level)** -- added `allowPrivilegeEscalation: false`, `readOnlyRootFilesystem: true`, `drop: ["ALL"]`.
13. **`DATABASE_URL` in ConfigMap** -- moved to a `Secret` with `stringData`. Credentials must not be in ConfigMaps (no encryption at rest).
14. **`configMapKeyRef` for secret** -- changed to `secretKeyRef` pointing to the new Secret.
15. **Service selector mismatch** -- selector was `app: api-svc`, pod labels were `app: api-server`. Fixed to `app.kubernetes.io/name: api-server`. Mismatch = zero endpoints, zero traffic, zero errors.
16. **Service `targetPort: 80`** -- changed to `8080` to match the new unprivileged container port. Service remaps `port: 80 -> targetPort: 8080`.
17. **Labels not using standard convention** -- changed all labels to `app.kubernetes.io/name` and `app.kubernetes.io/component`.
18. **Using `default` namespace** -- changed to `production`. Default namespace is an anti-pattern for production workloads.
19. **Using `default` ServiceAccount with `cluster-admin`** -- replaced with a dedicated `api-server-sa` ServiceAccount, a namespaced `Role` with least-privilege (read-only configmaps/secrets), and a `RoleBinding`. The original `ClusterRoleBinding` to `cluster-admin` granted god-mode to the default SA.
20. **HPA `minReplicas: 1`** -- raised to `2` for availability. Must match Deployment replicas minimum.
21. **HPA `maxReplicas: 50`** -- reduced to `20` (sane budget ceiling). Original had no scale-down stabilization.
22. **Missing HPA scale-down stabilization** -- added `stabilizationWindowSeconds: 300` and `25%` max scale-down per minute to prevent flapping.
23. **NetworkPolicy open ingress (`from: []`)** -- restricted to frontend pods only, on port `8080`. Added egress policy restricting to postgres on `5432`. Original allowed all ingress and had no egress rules.
24. **Missing PodDisruptionBudget** -- added `minAvailable: 50%`. Without PDB, `kubectl drain` kills all pods simultaneously.
25. **Missing Ingress TLS** -- added cert-manager annotation and `tls` block. Never terminate TLS at the application level in K8s.
26. **Missing ResourceQuota and LimitRange** -- added namespace governance resources per checklist.