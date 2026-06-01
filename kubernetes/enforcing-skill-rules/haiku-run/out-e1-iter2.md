```yaml
# Dedicated namespace — declare once, use everywhere
apiVersion: v1
kind: Namespace
metadata:
  name: api-prod
  labels:
    pod-security.kubernetes.io/enforce: restricted

---
# Secret for sensitive data — not ConfigMap
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
# ServiceAccount — one per app, never share
apiVersion: v1
kind: ServiceAccount
metadata:
  name: api-server-sa
  namespace: api-prod

---
# Role — namespaced, least privilege
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: api-server-role
  namespace: api-prod
rules:
  - apiGroups: [""]
    resources: ["configmaps", "secrets"]
    verbs: ["get", "list"]

---
# RoleBinding — connects ServiceAccount to Role
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: api-server-binding
  namespace: api-prod
subjects:
  - kind: ServiceAccount
    name: api-server-sa
roleRef:
  kind: Role
  name: api-server-role
  apiGroup: rbac.authorization.k8s.io

---
# Deployment — 2+ replicas, zero-downtime rolling update
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
  namespace: api-prod
  labels:
    app.kubernetes.io/name: api-server
    app.kubernetes.io/tier: backend
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
        app.kubernetes.io/tier: backend
    spec:
      serviceAccountName: api-server-sa
      terminationGracePeriodSeconds: 30
      containers:
        - name: api
          image: mycompany/api-server:v1.2.0
          ports:
            - name: http
              containerPort: 8080
              protocol: TCP
          securityContext:
            runAsNonRoot: true
            runAsUser: 1000
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
                command: ["sh", "-c", "sleep 15"]
          envFrom:
            - configMapRef:
                name: app-config
            - secretRef:
                name: db-credentials
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

---
# PodDisruptionBudget — minAvailable: 50%, not 1
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
# Service — selector MUST match pod labels exactly
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
      targetPort: 8080
      protocol: TCP
      name: http
  selector:
    app.kubernetes.io/name: api-server

---
# Ingress with TLS termination — requires cert-manager
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-ingress
  namespace: api-prod
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

---
# HorizontalPodAutoscaler — minReplicas: 2, with stabilization window
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
# NetworkPolicy — default deny, allow only required traffic
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
              role: frontend
      ports:
        - protocol: TCP
          port: 8080
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: postgres
      ports:
        - protocol: TCP
          port: 5432
    - to:
        - namespaceSelector: {}
      ports:
        - protocol: TCP
          port: 53
        - protocol: UDP
          port: 53

---
# ResourceQuota — namespace-wide ceiling
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
# LimitRange — per-container defaults and bounds
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
