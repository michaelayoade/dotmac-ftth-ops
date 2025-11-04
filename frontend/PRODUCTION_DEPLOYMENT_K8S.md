# Production Deployment Plan: Kubernetes with Helm

## Current Production State: ❌ CANNOT DEPLOY

**Problems:**
- `frontend/Dockerfile.prod` doesn't exist (referenced in docker-compose.production.yml:50)
- Only single frontend service configured
- docker-compose.production.yml is archived (outdated)
- No Helm charts exist yet despite having KubernetesAdapter

**But you HAVE:** ✅ KubernetesAdapter in `src/dotmac/platform/deployment/adapters/kubernetes.py`
- Namespace isolation
- Network policies
- Resource quotas
- Helm support
- "Suitable for cloud-native multi-tenant deployments" (line 20)

---

## Kubernetes Production Architecture

### Cluster Structure:

```
Kubernetes Cluster
├── Namespace: platform-admin (Single Instance)
│   ├── Deployment: platform-admin-frontend (Next.js)
│   ├── Deployment: platform-backend (FastAPI)
│   ├── Service: platform-admin-svc
│   ├── Ingress: admin.dotmac.com
│   ├── PostgreSQL (Platform DB - tenant metadata, licensing)
│   ├── Redis (Sessions, cache)
│   └── Vault (Secrets management)
│
├── Namespace: tenant-isp1 (ISP Tenant 1)
│   ├── Deployment: isp-ops-frontend (Next.js)
│   ├── Deployment: isp-backend (FastAPI)
│   ├── Service: isp-ops-svc
│   ├── Ingress: isp1.dotmac.com
│   ├── PostgreSQL (Tenant DB - ISOLATED)
│   ├── RADIUS, NetBox, GenieACS, WireGuard
│   └── Prometheus, Grafana (Tenant-specific)
│
├── Namespace: tenant-isp2 (ISP Tenant 2)
│   ├── Deployment: isp-ops-frontend (Next.js)
│   ├── Deployment: isp-backend (FastAPI)
│   ├── Service: isp-ops-svc
│   ├── Ingress: isp2.dotmac.com
│   ├── PostgreSQL (Tenant DB - ISOLATED)
│   ├── RADIUS, NetBox, GenieACS, WireGuard
│   └── Prometheus, Grafana (Tenant-specific)
│
└── Namespace: shared-services (Optional)
    ├── MinIO (Multi-tenant object storage with bucket isolation)
    ├── Observability Stack (Centralized monitoring)
    └── Backup Services
```

---

## Phase 0: Docker Infrastructure (Prerequisites)

### Step 1: Create Frontend Dockerfiles

**File: `/frontend/apps/platform-admin-app/Dockerfile`**

See ARCHITECTURE_OVERVIEW.md for full Dockerfile content and ownership guidelines.

Key requirements:
- Multi-stage build (base, deps, builder, runner)
- pnpm for dependency management
- Next.js standalone output
- Non-root user (nextjs:nodejs)
- Health checks
- Environment variables

**File: `/frontend/apps/isp-ops-app/Dockerfile`**

Same structure as platform-admin, different app path.

**Step 2: Enable Next.js Standalone Output**

Update both `apps/platform-admin-app/next.config.js` and `apps/isp-ops-app/next.config.js`:

```javascript
module.exports = {
  output: 'standalone',  // Enable for Docker
  // ... rest of config
}
```

---

## Phase 1: Helm Charts Structure

### Directory Structure:

```
helm-charts/
├── platform-admin/              # Platform admin Helm chart
│   ├── Chart.yaml
│   ├── values.yaml
│   ├── values-production.yaml
│   └── templates/
│       ├── deployment-frontend.yaml
│       ├── deployment-backend.yaml
│       ├── service.yaml
│       ├── ingress.yaml
│       ├── configmap.yaml
│       ├── secret.yaml
│       ├── postgresql.yaml
│       ├── redis.yaml
│       ├── vault.yaml
│       └── networkpolicy.yaml
│
├── isp-ops-tenant/             # ISP tenant Helm chart (template)
│   ├── Chart.yaml
│   ├── values.yaml
│   ├── values-tenant-template.yaml
│   └── templates/
│       ├── deployment-frontend.yaml
│       ├── deployment-backend.yaml
│       ├── service.yaml
│       ├── ingress.yaml
│       ├── configmap.yaml
│       ├── secret.yaml
│       ├── postgresql.yaml
│       ├── redis.yaml
│       ├── radius.yaml
│       ├── netbox.yaml
│       ├── genieacs.yaml
│       ├── wireguard.yaml
│       ├── librenms.yaml
│       ├── prometheus.yaml
│       ├── grafana.yaml
│       ├── resourcequota.yaml
│       └── networkpolicy.yaml
│
└── common/                     # Shared templates/helpers
    └── templates/
        └── _helpers.tpl
```

---

## Phase 2: Platform Admin Helm Chart Examples

### Chart.yaml
```yaml
apiVersion: v2
name: platform-admin
description: DotMac Platform Admin - Manages ISP Tenants
version: 1.0.0
appVersion: "1.0.0"
type: application

dependencies:
  - name: postgresql
    version: "15.x.x"
    repository: https://charts.bitnami.com/bitnami
    condition: postgresql.enabled
  - name: redis
    version: "19.x.x"
    repository: https://charts.bitnami.com/bitnami
    condition: redis.enabled
```

### values.yaml (abbreviated)
```yaml
replicaCount: 2

frontend:
  image:
    repository: registry.example.com/dotmac-platform-admin
    tag: "1.0.0"
  resources:
    requests:
      memory: "512Mi"
      cpu: "250m"
  service:
    type: ClusterIP
    port: 3000

backend:
  image:
    repository: registry.example.com/dotmac-platform-backend
    tag: "1.0.0"
  resources:
    requests:
      memory: "1Gi"
      cpu: "500m"
  service:
    type: ClusterIP
    port: 8000

ingress:
  enabled: true
  className: "nginx"
  hosts:
    - host: admin.dotmac.com
      paths:
        - path: /
          backend: frontend
        - path: /api
          backend: backend
  tls:
    - secretName: platform-admin-tls
      hosts:
        - admin.dotmac.com

postgresql:
  enabled: true
  auth:
    username: dotmac_platform
    database: dotmac_platform
  primary:
    persistence:
      enabled: true
      size: 20Gi

redis:
  enabled: true
  architecture: standalone
  master:
    persistence:
      enabled: true
      size: 10Gi

networkPolicy:
  enabled: true
```

---

## Phase 3: ISP Tenant Helm Chart

### values-tenant-template.yaml (abbreviated)

```yaml
tenantId: "tenant-REPLACE_ME"
tenantName: "REPLACE_ME"

frontend:
  image:
    repository: registry.example.com/dotmac-isp-ops
    tag: "1.0.0"
  env:
    - name: TENANT_ID
      value: "REPLACE_ME"

ingress:
  hosts:
    - host: SUBDOMAIN.dotmac.com

# ISP-Specific Services
radius:
  enabled: true
  persistence:
    size: 5Gi

netbox:
  enabled: true
  persistence:
    size: 10Gi

genieacs:
  enabled: true
  mongodb:
    enabled: true

prometheus:
  enabled: true
  server:
    persistentVolume:
      size: 50Gi

# Resource Quotas per Tenant
resourceQuota:
  enabled: true
  hard:
    requests.cpu: "10"
    requests.memory: "20Gi"
    pods: "50"

networkPolicy:
  enabled: true
  denyAll: true  # Tenant isolation
```

---

## Phase 3.5: Network Policies - CRITICAL FIX REQUIRED ⚠️

### Problem: Current KubernetesAdapter Blocks All Traffic

**Location**: `src/dotmac/platform/deployment/adapters/kubernetes.py:454-467`

**Current Implementation:**
```python
async def _apply_network_policies(self, context: ExecutionContext) -> None:
    """Apply network policies for tenant isolation"""
    # Default deny all ingress
    policy = {
        "apiVersion": "networking.k8s.io/v1",
        "kind": "NetworkPolicy",
        "metadata": {"name": "deny-all-ingress", "namespace": context.namespace},
        "spec": {
            "podSelector": {},
            "policyTypes": ["Ingress"],
        },
    }
    await self._kubectl_apply(policy)
```

**Issue**: This policy denies ALL ingress traffic with no allow rules, which will:
- ❌ Block ingress controller from reaching frontend/backend pods
- ❌ Block inter-pod communication (backend → database, backend → redis)
- ❌ Break all services in production

### Solution: Implement Allow-List Network Policies

The KubernetesAdapter needs to be updated to create both deny-all AND allow rules for legitimate traffic.

#### Option 1: Update KubernetesAdapter (Recommended)

**File: `src/dotmac/platform/deployment/adapters/kubernetes.py`**

Replace `_apply_network_policies` method with:

```python
async def _apply_network_policies(self, context: ExecutionContext) -> None:
    """Apply network policies for tenant isolation with allow-list rules"""

    # 1. Default deny all ingress (baseline security)
    deny_all_policy = {
        "apiVersion": "networking.k8s.io/v1",
        "kind": "NetworkPolicy",
        "metadata": {"name": "deny-all-ingress", "namespace": context.namespace},
        "spec": {
            "podSelector": {},
            "policyTypes": ["Ingress"],
        },
    }
    await self._kubectl_apply(deny_all_policy)

    # 2. Allow ingress controller → frontend pods
    allow_ingress_to_frontend = {
        "apiVersion": "networking.k8s.io/v1",
        "kind": "NetworkPolicy",
        "metadata": {"name": "allow-ingress-to-frontend", "namespace": context.namespace},
        "spec": {
            "podSelector": {
                "matchLabels": {"app": "frontend"}
            },
            "policyTypes": ["Ingress"],
            "ingress": [
                {
                    # Allow from ingress-nginx namespace
                    "from": [
                        {
                            "namespaceSelector": {
                                "matchLabels": {"kubernetes.io/metadata.name": "ingress-nginx"}
                            }
                        }
                    ],
                    "ports": [{"protocol": "TCP", "port": 3000}]
                }
            ]
        }
    }
    await self._kubectl_apply(allow_ingress_to_frontend)

    # 3. Allow ingress controller → backend pods (for /api routes)
    allow_ingress_to_backend = {
        "apiVersion": "networking.k8s.io/v1",
        "kind": "NetworkPolicy",
        "metadata": {"name": "allow-ingress-to-backend", "namespace": context.namespace},
        "spec": {
            "podSelector": {
                "matchLabels": {"app": "backend"}
            },
            "policyTypes": ["Ingress"],
            "ingress": [
                {
                    "from": [
                        {
                            "namespaceSelector": {
                                "matchLabels": {"kubernetes.io/metadata.name": "ingress-nginx"}
                            }
                        }
                    ],
                    "ports": [{"protocol": "TCP", "port": 8000}]
                }
            ]
        }
    }
    await self._kubectl_apply(allow_ingress_to_backend)

    # 4. Allow frontend → backend (internal API calls)
    allow_frontend_to_backend = {
        "apiVersion": "networking.k8s.io/v1",
        "kind": "NetworkPolicy",
        "metadata": {"name": "allow-frontend-to-backend", "namespace": context.namespace},
        "spec": {
            "podSelector": {
                "matchLabels": {"app": "backend"}
            },
            "policyTypes": ["Ingress"],
            "ingress": [
                {
                    "from": [
                        {
                            "podSelector": {
                                "matchLabels": {"app": "frontend"}
                            }
                        }
                    ],
                    "ports": [{"protocol": "TCP", "port": 8000}]
                }
            ]
        }
    }
    await self._kubectl_apply(allow_frontend_to_backend)

    # 5. Allow backend → postgres
    allow_backend_to_postgres = {
        "apiVersion": "networking.k8s.io/v1",
        "kind": "NetworkPolicy",
        "metadata": {"name": "allow-backend-to-postgres", "namespace": context.namespace},
        "spec": {
            "podSelector": {
                "matchLabels": {"app": "postgresql"}
            },
            "policyTypes": ["Ingress"],
            "ingress": [
                {
                    "from": [
                        {
                            "podSelector": {
                                "matchLabels": {"app": "backend"}
                            }
                        }
                    ],
                    "ports": [{"protocol": "TCP", "port": 5432}]
                }
            ]
        }
    }
    await self._kubectl_apply(allow_backend_to_postgres)

    # 6. Allow backend → redis
    allow_backend_to_redis = {
        "apiVersion": "networking.k8s.io/v1",
        "kind": "NetworkPolicy",
        "metadata": {"name": "allow-backend-to-redis", "namespace": context.namespace},
        "spec": {
            "podSelector": {
                "matchLabels": {"app": "redis"}
            },
            "policyTypes": ["Ingress"],
            "ingress": [
                {
                    "from": [
                        {
                            "podSelector": {
                                "matchLabels": {"app": "backend"}
                            }
                        }
                    ],
                    "ports": [{"protocol": "TCP", "port": 6379}]
                }
            ]
        }
    }
    await self._kubectl_apply(allow_backend_to_redis)

    # 7. Allow DNS queries (all pods need DNS)
    allow_dns = {
        "apiVersion": "networking.k8s.io/v1",
        "kind": "NetworkPolicy",
        "metadata": {"name": "allow-dns", "namespace": context.namespace},
        "spec": {
            "podSelector": {},
            "policyTypes": ["Egress"],
            "egress": [
                {
                    "to": [
                        {
                            "namespaceSelector": {
                                "matchLabels": {"kubernetes.io/metadata.name": "kube-system"}
                            },
                            "podSelector": {
                                "matchLabels": {"k8s-app": "kube-dns"}
                            }
                        }
                    ],
                    "ports": [
                        {"protocol": "UDP", "port": 53},
                        {"protocol": "TCP", "port": 53}
                    ]
                }
            ]
        }
    }
    await self._kubectl_apply(allow_dns)

    # 8. Allow egress to internet (for external APIs, webhooks, etc.)
    # Note: Restrict this further in production based on requirements
    allow_external_egress = {
        "apiVersion": "networking.k8s.io/v1",
        "kind": "NetworkPolicy",
        "metadata": {"name": "allow-external-egress", "namespace": context.namespace},
        "spec": {
            "podSelector": {
                "matchLabels": {"app": "backend"}
            },
            "policyTypes": ["Egress"],
            "egress": [
                {
                    # Allow all egress for backend (payment gateways, email services, etc.)
                    "to": [{"ipBlock": {"cidr": "0.0.0.0/0"}}]
                }
            ]
        }
    }
    await self._kubectl_apply(allow_external_egress)
```

#### Option 2: Manual NetworkPolicy Manifests (Helm Templates)

If you prefer to keep network policies in Helm charts instead of KubernetesAdapter:

**File: `helm-charts/isp-ops-tenant/templates/networkpolicy.yaml`**

```yaml
---
# 1. Default deny all ingress
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all-ingress
  namespace: {{ .Values.namespace }}
spec:
  podSelector: {}
  policyTypes:
    - Ingress

---
# 2. Allow ingress → frontend
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-ingress-to-frontend
  namespace: {{ .Values.namespace }}
spec:
  podSelector:
    matchLabels:
      app: frontend
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: ingress-nginx
      ports:
        - protocol: TCP
          port: 3000

---
# 3. Allow ingress → backend
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-ingress-to-backend
  namespace: {{ .Values.namespace }}
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: ingress-nginx
      ports:
        - protocol: TCP
          port: 8000

---
# 4. Allow frontend → backend
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-to-backend
  namespace: {{ .Values.namespace }}
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: frontend
      ports:
        - protocol: TCP
          port: 8000

---
# 5. Allow backend → postgres
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-backend-to-postgres
  namespace: {{ .Values.namespace }}
spec:
  podSelector:
    matchLabels:
      app: postgresql
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: backend
      ports:
        - protocol: TCP
          port: 5432

---
# 6. Allow backend → redis
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-backend-to-redis
  namespace: {{ .Values.namespace }}
spec:
  podSelector:
    matchLabels:
      app: redis
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: backend
      ports:
        - protocol: TCP
          port: 6379

---
# 7. Allow DNS
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-dns
  namespace: {{ .Values.namespace }}
spec:
  podSelector: {}
  policyTypes:
    - Egress
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
          podSelector:
            matchLabels:
              k8s-app: kube-dns
      ports:
        - protocol: UDP
          port: 53
        - protocol: TCP
          port: 53

---
# 8. Allow external egress from backend
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-external-egress
  namespace: {{ .Values.namespace }}
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
    - Egress
  egress:
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0
```

### ISP-Specific Network Policies

For ISP tenant namespaces with additional services (RADIUS, NetBox, GenieACS):

**Add to `helm-charts/isp-ops-tenant/templates/networkpolicy.yaml`:**

```yaml
---
# Allow backend → RADIUS
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-backend-to-radius
  namespace: {{ .Values.namespace }}
spec:
  podSelector:
    matchLabels:
      app: freeradius
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: backend
      ports:
        - protocol: UDP
          port: 1812  # RADIUS auth
        - protocol: UDP
          port: 1813  # RADIUS accounting

---
# Allow backend → NetBox
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-backend-to-netbox
  namespace: {{ .Values.namespace }}
spec:
  podSelector:
    matchLabels:
      app: netbox
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: backend
      ports:
        - protocol: TCP
          port: 8080

---
# Allow backend → GenieACS
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-backend-to-genieacs
  namespace: {{ .Values.namespace }}
spec:
  podSelector:
    matchLabels:
      app: genieacs
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: backend
      ports:
        - protocol: TCP
          port: 7547  # TR-069
        - protocol: TCP
          port: 7557  # GenieACS UI
        - protocol: TCP
          port: 7567  # GenieACS FS
```

### Testing Network Policies

**1. Verify policies are applied:**
```bash
kubectl get networkpolicies -n tenant-isp1
```

**2. Test connectivity:**
```bash
# From within a pod, test connections:
kubectl exec -n tenant-isp1 deployment/backend -- curl http://postgresql:5432
kubectl exec -n tenant-isp1 deployment/backend -- curl http://redis:6379
kubectl exec -n tenant-isp1 deployment/frontend -- curl http://backend:8000/health
```

**3. Test from outside cluster:**
```bash
curl https://isp1.dotmac.com/  # Should work (ingress allowed)
```

**4. Test blocked traffic (should fail):**
```bash
# Try to access postgres from frontend (should be denied)
kubectl exec -n tenant-isp1 deployment/frontend -- nc -zv postgresql 5432
# Expected: Connection refused or timeout
```

### Recommended Approach

**For production readiness:**

1. ✅ **Use Option 2 (Helm Templates)** - More maintainable, version-controlled
2. ✅ Keep KubernetesAdapter `_apply_network_policies` minimal (just deny-all)
3. ✅ Let Helm charts manage the allow-list policies
4. ✅ Makes policies explicit and easy to audit

**Update KubernetesAdapter to skip policy creation if Helm manages it:**
```python
async def _apply_network_policies(self, context: ExecutionContext) -> None:
    """Apply network policies for tenant isolation"""
    # Skip if network policies are managed by Helm
    if context.variables.get("helm_manages_network_policies", True):
        logger.info("Network policies managed by Helm chart, skipping")
        return

    # Otherwise apply minimal deny-all policy
    # (Allow rules must be added separately)
    policy = {...}  # deny-all as before
    await self._kubectl_apply(policy)
```

### Action Items Before Production:

- [ ] Choose Option 1 (KubernetesAdapter) or Option 2 (Helm templates)
- [ ] Implement all 8 base network policies
- [ ] Add ISP-specific policies (RADIUS, NetBox, GenieACS)
- [ ] Test with real traffic in staging environment
- [ ] Verify tenant isolation (tenant1 cannot access tenant2 pods)
- [ ] Document network policy architecture for ops team
- [ ] Set up monitoring/alerting for network policy violations

---

## Phase 3.6: Prometheus & Grafana in Multi-Tenant Kubernetes

### Problem: How Does Your Existing Monitoring Stack Work in Kubernetes?

Your current `docker-compose.isp.yml` has:
- ✅ Prometheus (port 9090)
- ✅ Grafana (port 3400)
- ✅ Node Exporter, cAdvisor, postgres-exporter, redis-exporter
- ✅ Alertmanager

But the Kubernetes deployment plan needs to specify:
- How Prometheus scrapes metrics in a namespace-isolated environment
- Whether each ISP tenant gets their own Prometheus/Grafana or shares one
- Network policies to allow scraping
- How to prevent tenant data leakage

### Recommended Architecture: Per-Tenant Prometheus/Grafana

**Deploy your existing monitoring stack per tenant:**

```
┌─────────────────────────────────────────────────────────────────┐
│ Tenant Namespace (tenant-isp1) - ISOLATED                       │
├─────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────────┐│
│ │ Monitoring Stack (per tenant)                                ││
│ │                                                               ││
│ │ Prometheus (port 9090):                                      ││
│ │ - Scrapes metrics from pods in THIS namespace only          ││
│ │ - Uses existing prometheus.yml config                       ││
│ │ - 15-day retention                                           ││
│ │                                                               ││
│ │ Grafana (port 3000):                                         ││
│ │ - Connected to this namespace's Prometheus                  ││
│ │ - Pre-loaded dashboards from monitoring/grafana/            ││
│ │ - ISP can customize dashboards                              ││
│ │                                                               ││
│ │ Exporters:                                                   ││
│ │ - postgres-exporter (port 9187)                             ││
│ │ - redis-exporter (port 9121)                                ││
│ │ - node-exporter (port 9100) - optional                      ││
│ │ - cadvisor (port 8080) - optional                           ││
│ └──────────────────────────────────────────────────────────────┘│
│                                                                   │
│ Application Pods expose /metrics:                                 │
│ - backend: /metrics on port 8000 (add prometheus_client)        │
│ - postgres via postgres-exporter                                 │
│ - redis via redis-exporter                                       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Tenant Namespace (tenant-isp2) - ISOLATED                       │
├─────────────────────────────────────────────────────────────────┤
│ Same stack, completely isolated from tenant-isp1                │
└─────────────────────────────────────────────────────────────────┘
```

### Benefits of Per-Tenant Monitoring:
- ✅ Complete data isolation (ISP1 cannot see ISP2 metrics)
- ✅ Tenants can customize dashboards
- ✅ Same setup you already have in Docker Compose
- ✅ Resource usage charged per tenant

### Helm Chart: Prometheus Deployment

**File: `helm-charts/isp-ops-tenant/templates/prometheus.yaml`**

This directly mirrors your existing `docker-compose.isp.yml` setup:

```yaml
---
# ServiceAccount for Prometheus
apiVersion: v1
kind: ServiceAccount
metadata:
  name: prometheus
  namespace: {{ .Values.namespace }}

---
# Role for Prometheus to discover pods/services
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: prometheus
  namespace: {{ .Values.namespace }}
rules:
  - apiGroups: [""]
    resources: [pods, services, endpoints]
    verbs: [get, list, watch]

---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: prometheus
  namespace: {{ .Values.namespace }}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: prometheus
subjects:
  - kind: ServiceAccount
    name: prometheus

---
# Prometheus ConfigMap (from your monitoring/prometheus/prometheus.yml)
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
  namespace: {{ .Values.namespace }}
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
      evaluation_interval: 15s

    # Alert rules
    rule_files:
      - /etc/prometheus/alerts/*.yml

    # Scrape configs - only scrapes THIS namespace
    scrape_configs:
      # Backend /metrics endpoint
      - job_name: 'backend'
        kubernetes_sd_configs:
          - role: pod
            namespaces:
              names: [{{ .Values.namespace }}]
        relabel_configs:
          - source_labels: [__meta_kubernetes_pod_label_app]
            action: keep
            regex: backend

      # PostgreSQL Exporter
      - job_name: 'postgres'
        static_configs:
          - targets: ['postgres-exporter:9187']

      # Redis Exporter
      - job_name: 'redis'
        static_configs:
          - targets: ['redis-exporter:9121']

      # Node Exporter (optional)
      - job_name: 'node'
        static_configs:
          - targets: ['node-exporter:9100']

---
# Prometheus Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prometheus
  namespace: {{ .Values.namespace }}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: prometheus
  template:
    metadata:
      labels:
        app: prometheus
    spec:
      serviceAccountName: prometheus
      containers:
        - name: prometheus
          image: prom/prometheus:latest
          args:
            - '--config.file=/etc/prometheus/prometheus.yml'
            - '--storage.tsdb.path=/prometheus'
            - '--web.console.libraries=/usr/share/prometheus/console_libraries'
            - '--web.console.templates=/usr/share/prometheus/consoles'
          ports:
            - containerPort: 9090
              name: web
          volumeMounts:
            - name: config
              mountPath: /etc/prometheus
            - name: alerts
              mountPath: /etc/prometheus/alerts
            - name: storage
              mountPath: /prometheus
          resources:
            requests:
              cpu: 100m
              memory: 512Mi
            limits:
              cpu: 500m
              memory: 2Gi
      volumes:
        - name: config
          configMap:
            name: prometheus-config
        - name: alerts
          configMap:
            name: prometheus-alerts
        - name: storage
          persistentVolumeClaim:
            claimName: prometheus-storage

---
# Prometheus Service
apiVersion: v1
kind: Service
metadata:
  name: prometheus
  namespace: {{ .Values.namespace }}
spec:
  selector:
    app: prometheus
  ports:
    - port: 9090
      targetPort: 9090
      name: web
```

### Helm Chart: Grafana Deployment

**File: `helm-charts/isp-ops-tenant/templates/grafana.yaml`**

```yaml
---
# Grafana Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: grafana
  namespace: {{ .Values.namespace }}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: grafana
  template:
    metadata:
      labels:
        app: grafana
    spec:
      containers:
        - name: grafana
          image: grafana/grafana:latest
          ports:
            - containerPort: 3000
              name: web
          env:
            - name: GF_SECURITY_ADMIN_USER
              value: {{ .Values.grafana.adminUser | default "admin" }}
            - name: GF_SECURITY_ADMIN_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: grafana-secrets
                  key: admin-password
          volumeMounts:
            - name: storage
              mountPath: /var/lib/grafana
            - name: dashboards
              mountPath: /etc/grafana/provisioning/dashboards
            - name: datasources
              mountPath: /etc/grafana/provisioning/datasources
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
      volumes:
        - name: storage
          persistentVolumeClaim:
            claimName: grafana-storage
        - name: dashboards
          configMap:
            name: grafana-dashboards
        - name: datasources
          configMap:
            name: grafana-datasources

---
# Grafana Service
apiVersion: v1
kind: Service
metadata:
  name: grafana
  namespace: {{ .Values.namespace }}
spec:
  selector:
    app: grafana
  ports:
    - port: 3000
      targetPort: 3000
      name: web

---
# Grafana Datasource ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-datasources
  namespace: {{ .Values.namespace }}
data:
  datasources.yml: |
    apiVersion: 1
    datasources:
      - name: Prometheus
        type: prometheus
        access: proxy
        url: http://prometheus:9090
        isDefault: true
        editable: true
```

### Helm Chart: Exporters

**File: `helm-charts/isp-ops-tenant/templates/exporters.yaml`**

```yaml
---
# PostgreSQL Exporter
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres-exporter
  namespace: {{ .Values.namespace }}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres-exporter
  template:
    metadata:
      labels:
        app: postgres-exporter
    spec:
      containers:
        - name: postgres-exporter
          image: prometheuscommunity/postgres-exporter:latest
          ports:
            - containerPort: 9187
          env:
            - name: DATA_SOURCE_NAME
              value: "postgresql://{{ .Values.postgres.user }}:{{ .Values.postgres.password }}@postgresql:5432/{{ .Values.postgres.database }}?sslmode=disable"
          resources:
            requests:
              cpu: 50m
              memory: 64Mi

---
apiVersion: v1
kind: Service
metadata:
  name: postgres-exporter
  namespace: {{ .Values.namespace }}
spec:
  selector:
    app: postgres-exporter
  ports:
    - port: 9187

---
# Redis Exporter
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis-exporter
  namespace: {{ .Values.namespace }}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis-exporter
  template:
    metadata:
      labels:
        app: redis-exporter
    spec:
      containers:
        - name: redis-exporter
          image: oliver006/redis_exporter:latest
          ports:
            - containerPort: 9121
          env:
            - name: REDIS_ADDR
              value: "redis:6379"
          resources:
            requests:
              cpu: 50m
              memory: 64Mi

---
apiVersion: v1
kind: Service
metadata:
  name: redis-exporter
  namespace: {{ .Values.namespace }}
spec:
  selector:
    app: redis-exporter
  ports:
    - port: 9121
```

### Network Policies for Prometheus/Grafana

**Add to `helm-charts/isp-ops-tenant/templates/networkpolicy.yaml`:**

```yaml
---
# Allow Prometheus to scrape metrics from pods
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-prometheus-scraping
  namespace: {{ .Values.namespace }}
spec:
  podSelector:
    matchLabels:
      app: prometheus
  policyTypes:
    - Egress
  egress:
    # Allow Prometheus to scrape backend
    - to:
        - podSelector:
            matchLabels:
              app: backend
      ports:
        - protocol: TCP
          port: 8000
    # Allow Prometheus to scrape exporters
    - to:
        - podSelector:
            matchLabels:
              app: postgres-exporter
      ports:
        - protocol: TCP
          port: 9187
    - to:
        - podSelector:
            matchLabels:
              app: redis-exporter
      ports:
        - protocol: TCP
          port: 9121

---
# Allow pods to be scraped by Prometheus
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-metrics-scraping
  namespace: {{ .Values.namespace }}
spec:
  podSelector: {}  # Apply to all pods
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: prometheus
      ports:
        - protocol: TCP
          port: 8000  # Backend metrics
        - protocol: TCP
          port: 9187  # Postgres exporter
        - protocol: TCP
          port: 9121  # Redis exporter

---
# Allow Grafana to query Prometheus
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-grafana-to-prometheus
  namespace: {{ .Values.namespace }}
spec:
  podSelector:
    matchLabels:
      app: grafana
  policyTypes:
    - Egress
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: prometheus
      ports:
        - protocol: TCP
          port: 9090

---
# Allow users to access Grafana UI (via ingress)
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-ingress-to-grafana
  namespace: {{ .Values.namespace }}
spec:
  podSelector:
    matchLabels:
      app: grafana
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: ingress-nginx
      ports:
        - protocol: TCP
          port: 3000
```

### Add Metrics Endpoint to Backend

Your backend already has FastAPI metrics middleware, just ensure it's exposed:

**File: `src/dotmac/platform/main.py` (should already have this)**

```python
from prometheus_client import make_asgi_app

app = FastAPI()

# Mount Prometheus metrics at /metrics
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)
```

### How ISPs Access Grafana

Each tenant gets their own Grafana instance at:
- URL: `https://isp1.dotmac.com/grafana` (via Ingress)
- Admin credentials from Helm values
- Pre-loaded dashboards from `monitoring/grafana/dashboards/`
- Connected to their namespace's Prometheus only

### Action Items:

- [ ] Deploy Prometheus + Grafana in each tenant namespace via Helm
- [ ] Verify backend /metrics endpoint works
- [ ] Deploy postgres-exporter and redis-exporter
- [ ] Configure network policies for Prometheus scraping
- [ ] Add Grafana Ingress rules to access UI
- [ ] Copy existing dashboards from `monitoring/grafana/` to Helm chart
- [ ] Test Prometheus scraping and Grafana queries
- [ ] Verify tenant isolation (tenant1 cannot query tenant2 Prometheus)

---

## Phase 4: Deployment Process

### Deploy Platform Admin:

```bash
# Create namespace
kubectl create namespace platform-admin

# Install platform admin
helm install platform-admin \
  ./helm-charts/platform-admin \
  --namespace platform-admin \
  --values helm-charts/platform-admin/values-production.yaml
```

### Deploy ISP Tenant (via KubernetesAdapter):

```python
from dotmac.platform.deployment.adapters.kubernetes import KubernetesAdapter

adapter = KubernetesAdapter({
    "kubeconfig_path": "/path/to/kubeconfig",
    "helm_repo_url": "https://helm.dotmac.com",
    "helm_repo_name": "dotmac",
    "network_policy_enabled": True,
    "resource_quotas_enabled": True,
})

context = ExecutionContext(
    namespace="tenant-isp1",
    template_name="isp-ops-tenant",
    template_version="1.0.0",
    cluster_name="production",
    variables={
        "tenantId": "isp1",
        "tenantName": "ISP One",
        "tenantSubdomain": "isp1",
    }
)

result = await adapter.provision(context)
```

Or via Helm CLI:

```bash
kubectl create namespace tenant-isp1

helm install isp1 \
  ./helm-charts/isp-ops-tenant \
  --namespace tenant-isp1 \
  --set tenantId=isp1 \
  --set tenantSubdomain=isp1
```

---

## Phase 5: CI/CD Pipeline

### GitHub Actions Example:

```yaml
name: Build and Push Docker Images

on:
  push:
    branches: [main]
    tags: ['v*']

jobs:
  build-platform-admin:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3

      - name: Login to Registry
        uses: docker/login-action@v3
        with:
          registry: registry.example.com
          username: ${{ secrets.REGISTRY_USERNAME }}
          password: ${{ secrets.REGISTRY_PASSWORD }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: ./frontend
          file: ./frontend/apps/platform-admin-app/Dockerfile
          push: true
          tags: registry.example.com/dotmac-platform-admin:latest
```

---

## Phase 6: Automated Tenant Provisioning

When a new ISP is created via Platform Admin UI:

1. **Platform Admin creates tenant in DB**
2. **Triggers deployment via KubernetesAdapter**
3. **KubernetesAdapter provisions:**
   - Namespace with resource quotas
   - Network policies for isolation
   - Helm release with all ISP services
   - Ingress with custom subdomain
4. **Post-deployment:**
   - Initialize tenant database
   - Create admin user
   - Send welcome email

---

## Summary: Production Deployment Checklist

### Phase 0: Prerequisites ✅
- [ ] Create frontend/apps/platform-admin-app/Dockerfile
- [ ] Create frontend/apps/isp-ops-app/Dockerfile
- [ ] Enable output: 'standalone' in Next.js configs
- [ ] Test Docker builds locally

### Phase 1: Helm Charts ✅
- [ ] Create helm-charts/platform-admin/
- [ ] Create helm-charts/isp-ops-tenant/
- [ ] Create values templates
- [ ] Test Helm installations locally (minikube/kind)

### Phase 2: Container Registry ✅
- [ ] Set up container registry
- [ ] Configure CI/CD pipelines
- [ ] Tag images with versions

### Phase 3: Kubernetes Cluster ✅
- [ ] Provision cluster (GKE/EKS/AKS)
- [ ] Install cert-manager
- [ ] Install ingress-nginx
- [ ] Configure DNS wildcard

### Phase 4: Deploy Platform ✅
- [ ] Deploy platform-admin chart
- [ ] Verify admin.dotmac.com
- [ ] Test platform UI

### Phase 5: Deploy First Tenant ✅
- [ ] Deploy isp-ops-tenant chart
- [ ] Verify tenant.dotmac.com
- [ ] Test tenant isolation

### Phase 6: Automate ✅
- [ ] Integrate KubernetesAdapter
- [ ] Test auto-provisioning
- [ ] Set up monitoring

**CRITICAL**: Code refactoring should happen AFTER infrastructure is working.
