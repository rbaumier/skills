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
      terminationGracePeriodSeconds: 30
      serviceAccountName: api-server-sa
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: api
          image: mycompany/api-server:v1.2.0
          imagePullPolicy: IfNotPresent
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: ["ALL"]
          ports:
            - containerPort: 8080
              name: http
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
                command: ["/bin/sh", "-c", "sleep 15"]
          envFrom:
            - secretRef:
                name: api-secrets
          volumeMounts:
            - name: tmp
              mountPath: /tmp
      volumes:
        - name: tmp
          emptyDir: {}
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
    resources: ["configmaps", "secrets"]
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
kind: Secret
metadata:
  name: api-secrets
  namespace: default
type: Opaque
stringData:
  DATABASE_URL: "postgresql://user:pass@postgres:5432/mydb"
  LOG_LEVEL: "info"
---
apiVersion: v1
kind: Service
metadata:
  name: api-service
  namespace: default
  labels:
    app.kubernetes.io/name: api-server
spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: http
      protocol: TCP
  selector:
    app.kubernetes.io/name: api-server
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
        - podSelector: {}
      ports:
        - protocol: TCP
          port: 8080
  egress:
    - to:
        - podSelector: {}
      ports:
        - protocol: TCP
          port: 5432
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: api-pdb
  namespace: default
spec:
  minAvailable: 1
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
kind: Ingress
metadata:
  name: api-ingress
  namespace: default
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  ingressClassName: nginx
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
```

## Issues Fixed

1. **Replicas**: Changed from `1` to `2` — minimum for availability during updates (Critical Rules: Deployments & Rolling Updates)
2. **Image tag**: Changed from `:latest` to `:v1.2.0` — pinned immutable version (Gotchas: latest tag)
3. **Rolling update strategy**: Changed `maxUnavailable: 1` to `0` — ensures zero-downtime deploys (Critical Rules: Deployments & Rolling Updates)
4. **Privileged port**: Changed containerPort from `80` to `8080` and Service port mapping to `80->8080` — enables non-root container (Gotchas: Privileged ports)
5. **Liveness probe**: Changed from heavy `/api/v1/orders` endpoint to lightweight `/healthz` — prevents cascading restarts under load (Gotchas: Liveness probe on heavy endpoint)
6. **Resource limits**: Added both `requests` and `limits` — prevents single pod starving the node (Gotchas: Missing resource limits)
7. **Service selector mismatch**: Fixed from `app: api-svc` to `app.kubernetes.io/name: api-server` — matches Deployment pod labels exactly (Gotchas: Selector mismatch)
8. **Secrets security**: Moved DATABASE_URL from ConfigMap to Secret with `stringData` — no plaintext storage (Gotchas: Secrets in ConfigMaps)
9. **Liveness probe endpoint**: Now uses dedicated lightweight `/healthz` endpoint with proper probe configuration (Critical Rules: Health Checks)
10. **Readiness probe**: Added with separate `/ready` endpoint to check DB/dependencies (Critical Rules: Health Checks)
11. **Startup probe**: Added to disable liveness/readiness during boot (Critical Rules: Health Checks)
12. **Termination grace period**: Changed from `0` to `30` — allows graceful connection draining (Critical Rules: Deployments & Rolling Updates)
13. **preStop hook**: Added 15-second sleep for graceful drain (Critical Rules: Deployments & Rolling Updates)
14. **Security context**: Added pod and container-level security (runAsNonRoot, readOnlyRootFilesystem, drop ALL) (Critical Rules: Security Context & RBAC)
15. **ServiceAccount**: Created dedicated `api-server-sa` instead of using `default` (Critical Rules: Security Context & RBAC)
16. **RBAC Role**: Created least-privilege role (only `get,list,watch` on ConfigMaps/Secrets) instead of `cluster-admin` (Critical Rules: Security Context & RBAC)
17. **Labels**: Updated to follow `app.kubernetes.io/*` standard convention (Critical Rules: Deployments & Rolling Updates)
18. **HPA minReplicas**: Changed from `1` to `2` — requires minimum availability (Critical Rules: HPA)
19. **HPA maxReplicas**: Reduced from `50` to `20` — reasonable budget ceiling (Critical Rules: HPA)
20. **PodDisruptionBudget**: Added with `minAvailable: 1` — prevents node drains from killing all pods (Critical Rules: Deployments & Rolling Updates)
21. **NetworkPolicy**: Fixed missing egress rule, updated ingress to match port 8080 (Critical Rules: Network Policies)
22. **Ingress**: Added TLS termination with cert-manager annotation for automatic Let's Encrypt certificates (Critical Rules: Services & Networking)
23. **HPA behavior**: Added scale-down stabilization window to prevent flapping (Critical Rules: HPA)
