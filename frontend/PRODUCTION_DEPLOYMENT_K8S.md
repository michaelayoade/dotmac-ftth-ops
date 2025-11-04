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

See ARCHITECTURE_ANALYSIS.md for full Dockerfile content.

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
