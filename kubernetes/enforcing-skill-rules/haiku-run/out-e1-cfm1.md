# Fixed Kubernetes Manifests - All Rules Applied

```yaml
---
# Dedicated namespace (never use default)
apiVersion: v1
kind: Namespace
metadata:
  name: api-prod
  labels:
    pod-security.kubernetes.io/enforce: restricted

---
# ServiceAccount per app, least privilege
apiVersion: v1
kind: ServiceAccount
metadata:
  name: api-server-sa
  namespace: api-prod

---
# Role with least privilege (only what's needed)
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
# RoleBinding (not ClusterRoleBinding, not cluster-admin)
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
# Secret for sensitive data (not ConfigMap with plaintext passwords)
apiVersion: v1
kind: Secret
metadata:
  name: db-credentials
  namespace: api-prod
type: Opaque
stringData:
  DATABASE_URL: "postgresql://admin:s3cret@postgres:5432/mydb"

---
# ConfigMap for non-sensitive config only
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: api-prod
data:
  LOG_LEVEL: "info"

---
# Deployment with all critical rules applied
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
  namespace: api-prod
  labels:
    app.kubernetes.io/name: api-server
    app.kubernetes.io/tier: backend
spec:
  # Minimum 2 replicas for zero-downtime during updates
  replicas: 2
  selector:
    matchLabels:
      app.kubernetes.io/name: api-server
  strategy:
    type: RollingUpdate
    rollingUpdate:
      # Zero-downtime: all current replicas stay up during update
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app.kubernetes.io/name: api-server
        app.kubernetes.io/tier: backend
    spec:
      # Non-root security context
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        seccompProfile:
          type: RuntimeDefault
      
      # Service account with least privilege
      serviceAccountName: api-server-sa
      
      # Graceful shutdown: give connections time to drain
      terminationGracePeriodSeconds: 30
      
      containers:
        - name: api
          # Pinned image tag (never latest)
          image: mycompany/api-server:v1.2.3
          imagePullPolicy: IfNotPresent
          
          # Non-privileged port (>=1024)
          ports:
            - name: http
              containerPort: 8080
              protocol: TCP
          
          # Container security context
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop:
                - ALL
          
          # Lightweight liveness probe (not a heavy endpoint)
          livenessProbe:
            httpGet:
              path: /healthz
              port: http
            initialDelaySeconds: 15
            periodSeconds: 10
            failureThreshold: 3
          
          # Readiness probe checks dependencies
          readinessProbe:
            httpGet:
              path: /ready
              port: http
            initialDelaySeconds: 5
            periodSeconds: 5
            failureThreshold: 3
          
          # Startup probe for slow starters
          startupProbe:
            httpGet:
              path: /healthz
              port: http
            failureThreshold: 30
            periodSeconds: 10
          
          # Graceful shutdown hook
          lifecycle:
            preStop:
              exec:
                command: ["/bin/sh", "-c", "sleep 15"]
          
          # Resource requests AND limits (required)
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 512Mi
          
          # Environment variables from Secret (not ConfigMap for sensitive data)
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: db-credentials
                  key: DATABASE_URL
            - name: LOG_LEVEL
              valueFrom:
                configMapKeyRef:
                  name: app-config
                  key: LOG_LEVEL
          
          # Read-only filesystem mount for temp files
          volumeMounts:
            - name: tmp
              mountPath: /tmp
            - name: cache
              mountPath: /app/cache
      
      # Spread replicas across zones AND nodes
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
      
      # Pod anti-affinity to spread across nodes
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchLabels:
                    app.kubernetes.io/name: api-server
                topologyKey: kubernetes.io/hostname
      
      # Temporary volumes for read-only filesystem
      volumes:
        - name: tmp
          emptyDir: {}
        - name: cache
          emptyDir: {}

---
# PodDisruptionBudget (required, minAvailable: 50%, not 1)
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
# Service with port remapping (80 -> 8080)
apiVersion: v1
kind: Service
metadata:
  name: api-service
  namespace: api-prod
  labels:
    app.kubernetes.io/name: api-server
spec:
  type: ClusterIP
  # Selector MUST match pod labels exactly
  selector:
    app.kubernetes.io/name: api-server
  ports:
    - name: http
      port: 80
      targetPort: http
      protocol: TCP

---
# HPA with scale-down stabilization window
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
  # minReplicas >= 2 for availability
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
      # Prevents flapping during load changes
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 25
          periodSeconds: 60

---
# Ingress with TLS (no TLS termination at app level)
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-ingress
  namespace: api-prod
  annotations:
    # Let cert-manager handle TLS with Let's Encrypt
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
# NetworkPolicy: default deny, then allowlist only what's needed
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
  # Ingress: only from frontend pods
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: frontend
      ports:
        - protocol: TCP
          port: 8080
  # Egress: only to database pod
  egress:
    - to:
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: postgres
      ports:
        - protocol: TCP
          port: 5432
    # Allow DNS for external lookups
    - to:
        - namespaceSelector: {}
      ports:
        - protocol: UDP
          port: 53

---
# ResourceQuota: namespace-wide ceiling
apiVersion: v1
kind: ResourceQuota
metadata:
  name: api-quota
  namespace: api-prod
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 4Gi
    limits.cpu: "8"
    limits.memory: 8Gi
    pods: "50"

---
# LimitRange: per-container defaults
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

1. **Namespace**: Replaced `namespace: default` with dedicated `api-prod` namespace on all resources
2. **Image tag**: Changed `latest` to pinned version `v1.2.3`
3. **Replicas**: Changed from `1` to `2` (minimum for zero-downtime)
4. **Rolling update**: Fixed `maxUnavailable: 1` to `maxUnavailable: 0` (zero-downtime)
5. **Liveness probe**: Changed from heavy `/api/v1/orders` to lightweight `/healthz`
6. **Port**: Changed from `80` (privileged) to `8080` (unprivileged) with non-root security context
7. **Secrets**: Moved `DATABASE_URL` from ConfigMap to Secret with `stringData`
8. **Service selector**: Fixed mismatch (`app: api-svc` → `app.kubernetes.io/name: api-server`)
9. **RBAC**: Replaced `ClusterRoleBinding` with cluster-admin to namespaced `RoleBinding` with least-privilege `Role`
10. **Security context**: Added `runAsNonRoot`, `readOnlyRootFilesystem`, `drop: ALL`, `seccompProfile`
11. **Resource limits**: Added requests AND limits on all containers
12. **Probes**: Added startup, readiness, and separate lightweight liveness
13. **terminationGracePeriodSeconds**: Changed from `0` to `30` with `preStop` sleep
14. **PodDisruptionBudget**: Added with `minAvailable: 50%` (not 1)
15. **topologySpreadConstraints**: Added to spread across zones and nodes
16. **Pod anti-affinity**: Added to prevent stacking on single node
17. **HPA**: Fixed `minReplicas: 1` to `minReplicas: 2` with scale-down stabilization
18. **NetworkPolicy**: Fixed empty `from: []` (allow-all) to concrete `podSelector` with `namespaceSelector`
19. **ServiceAccount**: Created dedicated service account, removed `default`
20. **Labels**: Updated to `app.kubernetes.io/*` standard convention
21. **Ingress**: Added TLS with cert-manager annotation, removed app-level TLS termination
22. **ResourceQuota + LimitRange**: Added namespace governance
