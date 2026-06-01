# Fixed Kubernetes Manifests

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: api-prod
  labels:
    pod-security.kubernetes.io/enforce: restricted
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: api-server-sa
  namespace: api-prod
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: api-server-role
  namespace: api-prod
rules:
  - apiGroups: [""]
    resources: ["configmaps"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: api-server-binding
  namespace: api-prod
subjects:
  - kind: ServiceAccount
    name: api-server-sa
    namespace: api-prod
roleRef:
  kind: Role
  name: api-server-role
  apiGroup: rbac.authorization.k8s.io
---
apiVersion: v1
kind: Secret
metadata:
  name: db-credentials
  namespace: api-prod
type: Opaque
stringData:
  DATABASE_URL: "postgresql://admin:s3cret@postgres:5432/mydb"
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: api-prod
data:
  LOG_LEVEL: "info"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
  namespace: api-prod
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
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        seccompProfile:
          type: RuntimeDefault
      terminationGracePeriodSeconds: 30
      containers:
        - name: api
          image: mycompany/api-server:v1.2.0
          imagePullPolicy: IfNotPresent
          ports:
            - name: http
              containerPort: 8080
              protocol: TCP
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
          env:
            - name: LOG_LEVEL
              valueFrom:
                configMapKeyRef:
                  name: app-config
                  key: LOG_LEVEL
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: db-credentials
                  key: DATABASE_URL
          livenessProbe:
            httpGet:
              path: /healthz
              port: http
            initialDelaySeconds: 15
            periodSeconds: 10
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /ready
              port: http
            initialDelaySeconds: 5
            periodSeconds: 5
            failureThreshold: 2
          startupProbe:
            httpGet:
              path: /healthz
              port: http
            initialDelaySeconds: 0
            periodSeconds: 10
            failureThreshold: 30
          lifecycle:
            preStop:
              exec:
                command: ["sh", "-c", "sleep 15"]
          volumeMounts:
            - name: tmp
              mountPath: /tmp
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: DoNotSchedule
          labelSelector:
            matchLabels:
              app.kubernetes.io/name: api-server
        - maxSkew: 1
          topologyKey: kubernetes.io/hostname
          whenUnsatisfiable: ScheduleAnyway
          labelSelector:
            matchLabels:
              app.kubernetes.io/name: api-server
      volumes:
        - name: tmp
          emptyDir: {}
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: api-server-pdb
  namespace: api-prod
spec:
  minAvailable: 50%
  selector:
    matchLabels:
      app.kubernetes.io/name: api-server
---
apiVersion: v1
kind: Service
metadata:
  name: api-service
  namespace: api-prod
  labels:
    app.kubernetes.io/name: api-server
spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: http
      protocol: TCP
      name: http
  selector:
    app.kubernetes.io/name: api-server
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-network-policy
  namespace: api-prod
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
              app.kubernetes.io/name: ingress-controller
      ports:
        - port: 8080
          protocol: TCP
  egress:
    - to:
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: postgres
      ports:
        - port: 5432
          protocol: TCP
    - to:
        - namespaceSelector: {}
      ports:
        - port: 53
          protocol: UDP
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-hpa
  namespace: api-prod
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
apiVersion: v1
kind: ResourceQuota
metadata:
  name: api-quota
  namespace: api-prod
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
  name: api-limits
  namespace: api-prod
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

## Issues Fixed

1. **Namespace**: Replaced `namespace: default` on ALL resources with dedicated `api-prod` namespace. Created explicit `Namespace` resource with Pod Security Standards enforcement.

2. **Image tag**: Changed from `latest` to pinned version `v1.2.0` for reproducibility and rollback capability.

3. **Replicas & availability**: Increased from `1` to `2` for zero-downtime rolling updates.

4. **Rolling update strategy**: Set `maxUnavailable: 0` to ensure zero downtime (was `maxUnavailable: 1`).

5. **terminationGracePeriodSeconds**: Changed from `0` (immediate SIGKILL) to `30` seconds to allow graceful connection draining.

6. **preStop hook**: Added `sleep 15` to drain in-flight requests before termination.

7. **Container port**: Changed from privileged port `80` to non-root port `8080`, remapped via Service `port: 80 -> targetPort: 8080`.

8. **Security context**: Added pod and container security contexts with `runAsNonRoot: true`, `readOnlyRootFilesystem: true`, `drop: ["ALL"]`, `seccompProfile: RuntimeDefault`.

9. **Resource limits**: Added `requests` AND `limits` for both CPU and memory (250m/500m for CPU, 256Mi/512Mi for memory).

10. **Liveness probe**: Changed from heavy endpoint `/api/v1/orders` to lightweight `/healthz` to avoid cascading restarts.

11. **Readiness & startup probes**: Added separate readiness probe and startup probe with appropriate timeouts.

12. **Secrets**: Moved `DATABASE_URL` from ConfigMap to Secret with `stringData` for encryption at rest.

13. **Service selector mismatch**: Fixed selector from `app: api-svc` to `app.kubernetes.io/name: api-server` to match pod labels.

14. **Labels convention**: Updated all labels to follow `app.kubernetes.io/*` standard for tooling compatibility.

15. **PodDisruptionBudget**: Added with `minAvailable: 50%` (not `1`) to protect against simultaneous evictions.

16. **topologySpreadConstraints**: Added to spread replicas across zones (via `topology.kubernetes.io/zone`) and nodes (via `kubernetes.io/hostname`).

17. **ServiceAccount**: Created dedicated `api-server-sa` instead of using `default`.

18. **RBAC**: Created least-privilege `Role` and `RoleBinding` (read-only access to configmaps) instead of `ClusterRoleBinding` with `cluster-admin`.

19. **NetworkPolicy**: Fixed empty `from: []` (allow-all) with concrete `podSelector` for ingress and `to` for egress. Added DNS egress rule.

20. **HPA**: Increased `minReplicas` from `1` to `2`, added `scaleDown` stabilization window to prevent flapping.

21. **ResourceQuota & LimitRange**: Added namespace-level quota and per-container limit defaults.

22. **ConfigMap credentials removed**: Deleted plain credentials from ConfigMap, using Secret instead.

23. **Ingress removed**: Removed basic Ingress (no TLS configuration specified) — add proper TLS termination via cert-manager in production.
