# Ingress and Reverse Proxy Strategy

## Executive Summary

This document outlines the ingress/reverse proxy architecture for DotMac FTTH Operations Platform across different deployment scenarios. It addresses the critical decision between **single-host nginx** and **Kubernetes ingress-nginx** for multi-tenant deployments.

**Key Components:**
- nginx production config (`nginx/nginx.prod.conf`)
- Ansible tenant provisioning (`ansible/playbooks/deployment/provision-tenant.yml`)
- Domain verification APIs (`src/dotmac/platform/tenant/domain_verification_router.py`)
- White-labeling system (`frontend/apps/base-app/scripts/init-branding.cjs`)

**Deployment Scenarios:**
1. **Single-Host VM** - nginx with per-tenant virtual hosts (current)
2. **Multi-Server Cluster** - nginx load balancer + tenant backends
3. **Kubernetes** - ingress-nginx controller with namespace isolation

---

## Quick Navigation

- [Current Architecture: Single-Host Nginx](#current-architecture-single-host-nginx)
- [Deployment Scenario 1: Single-Host VM](#deployment-scenario-1-single-host-vm)
- [Deployment Scenario 2: Multi-Server Cluster](#deployment-scenario-2-multi-server-cluster)
- [Deployment Scenario 3: Kubernetes](#deployment-scenario-3-kubernetes)
- [Domain Management & Verification](#domain-management--verification)
- [White-Labeling & Branding](#white-labeling--branding)
- [SSL/TLS Certificate Management](#ssltls-certificate-management)
- [Decision Matrix](#decision-matrix)
- [Migration Paths](#migration-paths)

---

## Current Architecture: Single-Host Nginx

### Existing Configuration

**File: `nginx/nginx.prod.conf`** (303 lines)

**Features:**
- ✅ TLS termination (TLSv1.2, TLSv1.3)
- ✅ Security headers (HSTS, CSP, X-Frame-Options, etc.)
- ✅ Rate limiting (10r/s API, 5r/s auth)
- ✅ Caching (GET requests cached 10m)
- ✅ WebSocket support (via `Upgrade` header)
- ✅ Upstream load balancing (`api:8000` with keepalive)
- ✅ Health checks (`/health` endpoint)
- ✅ Metrics protection (`/metrics` restricted to private networks)

**Current Limitations:**
- ❌ Hard-coded single domain (`server_name api.example.com`)
- ❌ No per-tenant routing
- ❌ Single upstream backend (`api:8000`)
- ❌ Designed for Docker Compose, not multi-tenant

### What's Been Created

**Ansible Templates** (created in this session):

1. **`ansible/playbooks/deployment/templates/nginx-site.conf.j2`**
   - Per-tenant nginx virtual host configuration
   - Variables: `tenant_id`, `tenant_subdomain`, `domain`, `app_port`, `frontend_port`
   - Features: Tenant-specific rate limiting, logging, SSL, upstream backends

2. **`ansible/playbooks/deployment/templates/config.env.j2`**
   - Environment variables for each tenant instance
   - Database, Redis, RADIUS, OSS integrations, branding settings

3. **`ansible/playbooks/deployment/templates/tenant-service.service.j2`**
   - Systemd service unit for tenant backend
   - Resource limits, security hardening, watchdog

**Ansible Playbook**: `ansible/playbooks/deployment/provision-tenant.yml`
- Creates tenant database, user, directories
- Deploys nginx site config to `/etc/nginx/sites-available/tenant-{id}.conf`
- Enables site with symlink to `/etc/nginx/sites-enabled/`
- Sets endpoints: `https://{tenant_subdomain}.{domain}/`

---

## Deployment Scenario 1: Single-Host VM

**Use Case:** Small-to-medium deployments, 10-50 tenants on one powerful VM.

### Architecture Diagram

```
Internet
   │
   ├─ HTTPS (443)
   │      │
   │      ▼
   │   Nginx (single instance)
   │      │
   │      ├─ Virtual Host: tenant1.example.com
   │      │     └─> Backend: 127.0.0.1:8001
   │      │     └─> Frontend: 127.0.0.1:3001
   │      │
   │      ├─ Virtual Host: tenant2.example.com
   │      │     └─> Backend: 127.0.0.1:8002
   │      │     └─> Frontend: 127.0.0.1:3002
   │      │
   │      └─ Virtual Host: admin.example.com
   │            └─> Platform Admin: 127.0.0.1:8000
   │
   ├─ PostgreSQL (5432)
   │     ├─ Database: platform_db
   │     ├─ Database: tenant_1_db
   │     └─ Database: tenant_2_db
   │
   └─ Redis (6379)
         └─ Per-tenant key prefixes
```

### Implementation

#### 1. Install and Configure Nginx

```bash
# Install nginx
sudo apt-get update
sudo apt-get install nginx

# Copy production config
sudo cp nginx/nginx.prod.conf /etc/nginx/nginx.conf

# Validate config
sudo nginx -t
```

#### 2. Provision First Tenant with Ansible

```bash
# Create Ansible inventory
cat > inventory.ini <<EOF
[app_servers]
localhost ansible_connection=local

[db_servers]
localhost ansible_connection=local
EOF

# Create variables file
cat > tenant1_vars.yml <<EOF
tenant_id: tenant1
tenant_name: "ISP Customer 1"
tenant_subdomain: isp1
domain: example.com
instance_id: prod-vm1-tenant1
environment: production
version: 1.0.0

app_port: 8001
frontend_port: 3001

db_host: localhost
db_port: 5432
db_password: "{{ vault_tenant1_db_password }}"

redis_host: localhost
redis_port: 6379
redis_password: "{{ vault_redis_password }}"

radius_host: localhost
radius_port: 1812
radius_secret: "{{ vault_radius_secret }}"

netbox_url: http://localhost:8080
genieacs_url: http://localhost:7557
awx_url: http://localhost:80

ssl_certificate_path: /etc/letsencrypt/live/isp1.example.com/fullchain.pem
ssl_certificate_key_path: /etc/letsencrypt/live/isp1.example.com/privkey.pem

resources:
  max_workers: 4
  cpu_limit: 50
  memory_limit: 2G
  max_tasks: 512

features:
  radius_enabled: true
  wireguard_enabled: false
  billing_enabled: true
  graphql_enabled: true

vault_addr: http://localhost:8200
vault_token: "{{ vault_token }}"

secret_key: "{{ vault_tenant1_secret_key }}"
jwt_secret_key: "{{ vault_tenant1_jwt_secret }}"
EOF

# Run Ansible playbook
ansible-playbook -i inventory.ini \
  ansible/playbooks/deployment/provision-tenant.yml \
  --extra-vars @tenant1_vars.yml \
  --ask-vault-pass
```

#### 3. Obtain SSL Certificate with Let's Encrypt

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate for tenant subdomain
sudo certbot certonly --nginx \
  -d isp1.example.com \
  --non-interactive \
  --agree-tos \
  --email admin@example.com

# Auto-renewal is configured via systemd timer
sudo systemctl status certbot.timer
```

#### 4. Verify Deployment

```bash
# Check systemd service
sudo systemctl status dotmac-tenant-tenant1

# Check nginx site enabled
ls -l /etc/nginx/sites-enabled/tenant-tenant1.conf

# Test health endpoint
curl https://isp1.example.com/health

# Check logs
sudo journalctl -u dotmac-tenant-tenant1 -f
tail -f /var/log/nginx/tenant-tenant1-access.log
```

### Scaling Limits

**Single-Host VM Capacity:**
- **10-20 tenants**: Easy, minimal resource contention
- **20-50 tenants**: Manageable with tuning (CPU, RAM, DB connections)
- **50+ tenants**: Consider multi-server or Kubernetes

**Resource Allocation per Tenant:**
- Backend: 2-4 workers × 512MB RAM = 1-2GB per tenant
- Frontend: 1 instance × 256MB RAM
- Database connections: 20-50 per tenant
- Total: ~2-3GB RAM per tenant

**VM Specs for 20 Tenants:**
- CPU: 32 cores (2 per tenant avg)
- RAM: 64GB (3GB per tenant)
- Disk: 500GB SSD (10GB per tenant + OS + logs)
- Network: 10Gbps

---

## Deployment Scenario 2: Multi-Server Cluster

**Use Case:** High availability, 50-500 tenants across multiple VMs.

### Architecture Diagram

```
Internet
   │
   ├─ HTTPS (443)
   │      │
   │      ▼
   │   Nginx Load Balancer (HA Pair)
   │      │
   │      ├─ Virtual Host: tenant1.example.com
   │      │     └─> Upstream: [app-server-1:8001, app-server-2:8001]
   │      │
   │      ├─ Virtual Host: tenant2.example.com
   │      │     └─> Upstream: [app-server-1:8002, app-server-2:8002]
   │      │
   │      └─ Virtual Host: admin.example.com
   │            └─> Upstream: [app-server-1:8000, app-server-2:8000]
   │
   ├─ Application Servers (3+ nodes)
   │     ├─ app-server-1: Tenants 1-10
   │     ├─ app-server-2: Tenants 11-20
   │     └─ app-server-3: Tenants 21-30
   │
   ├─ PostgreSQL Cluster (Primary + Replicas)
   │     ├─ Primary: Write operations
   │     └─ Replicas: Read operations (connection pooling)
   │
   └─ Redis Cluster (Sentinel for HA)
         └─ Shared cache with tenant key prefixes
```

### Implementation

#### 1. Setup Load Balancer Nginx Config

**File: `/etc/nginx/conf.d/load-balancer.conf`**

```nginx
# Upstream pools for each tenant
upstream tenant1_backend {
    least_conn;
    server app-server-1:8001 max_fails=3 fail_timeout=30s weight=100;
    server app-server-2:8001 max_fails=3 fail_timeout=30s weight=100 backup;
    keepalive 32;
}

upstream tenant1_frontend {
    least_conn;
    server app-server-1:3001 max_fails=3 fail_timeout=30s;
    server app-server-2:3001 max_fails=3 fail_timeout=30s backup;
    keepalive 16;
}

# Virtual host for tenant1
server {
    listen 443 ssl http2;
    server_name isp1.example.com;

    ssl_certificate /etc/letsencrypt/live/isp1.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/isp1.example.com/privkey.pem;

    # Include security headers
    include /etc/nginx/security-headers.conf;

    # Backend API
    location /api {
        proxy_pass http://tenant1_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_next_upstream error timeout http_502 http_503 http_504;
        # ... (rest of proxy settings from nginx.prod.conf)
    }

    # Frontend
    location / {
        proxy_pass http://tenant1_frontend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        # ... (rest of proxy settings)
    }
}

# Repeat for each tenant...
```

#### 2. High Availability with Keepalived

**Install on both load balancer nodes:**

```bash
sudo apt-get install keepalived

# Configure virtual IP (VIP) for failover
cat > /etc/keepalived/keepalived.conf <<EOF
vrrp_instance VI_1 {
    state MASTER  # or BACKUP on secondary
    interface eth0
    virtual_router_id 51
    priority 100  # 90 on backup
    advert_int 1

    authentication {
        auth_type PASS
        auth_pass secretpass
    }

    virtual_ipaddress {
        192.168.1.100/24  # VIP for all tenants
    }
}
EOF

sudo systemctl enable keepalived
sudo systemctl start keepalived
```

#### 3. Shared PostgreSQL Cluster

**Use pgpool-II or Patroni for connection pooling and HA:**

```bash
# Install pgpool-II
sudo apt-get install pgpool2

# Configure connection pooling
cat > /etc/pgpool-II/pgpool.conf <<EOF
backend_hostname0 = 'db-primary.internal'
backend_port0 = 5432
backend_weight0 = 1

backend_hostname1 = 'db-replica-1.internal'
backend_port1 = 5432
backend_weight1 = 1

backend_hostname2 = 'db-replica-2.internal'
backend_port2 = 5432
backend_weight2 = 1

num_init_children = 100
max_pool = 4
EOF
```

#### 4. Ansible Inventory for Multi-Server

```ini
[load_balancers]
lb1.example.com
lb2.example.com

[app_servers]
app1.example.com
app2.example.com
app3.example.com

[db_servers]
db-primary.example.com
db-replica-1.example.com
db-replica-2.example.com

[redis_servers]
redis1.example.com
redis2.example.com
redis3.example.com
```

**Deploy tenant across cluster:**

```bash
ansible-playbook -i multi-server-inventory.ini \
  ansible/playbooks/deployment/provision-tenant.yml \
  --extra-vars @tenant_vars.yml \
  --limit app_servers
```

### Scaling Considerations

**Cluster Capacity:**
- **50-100 tenants**: 3-5 app servers
- **100-300 tenants**: 10-15 app servers
- **300-500 tenants**: 20+ app servers (consider Kubernetes at this scale)

**Pros:**
- ✅ High availability (load balancer failover)
- ✅ Horizontal scaling (add more app servers)
- ✅ Database connection pooling
- ✅ Fault isolation (one server failure doesn't kill all tenants)

**Cons:**
- ❌ Complex networking (VIPs, health checks, DNS)
- ❌ Manual server provisioning and configuration management
- ❌ Harder to auto-scale based on load
- ❌ Nginx config grows with every tenant (regenerate and reload)

---

## Deployment Scenario 3: Kubernetes

**Use Case:** Large-scale, 500+ tenants, auto-scaling, cloud-native.

### Architecture Diagram

```
Internet
   │
   ├─ HTTPS (443)
   │      │
   │      ▼
   │   ingress-nginx Controller (LoadBalancer)
   │      │
   │      ├─ Ingress: isp1.example.com
   │      │     └─> Service: tenant-isp1-frontend (tenant-isp1 namespace)
   │      │           └─> Pods: isp-ops-frontend [3 replicas]
   │      │
   │      ├─ Ingress: isp2.example.com
   │      │     └─> Service: tenant-isp2-frontend (tenant-isp2 namespace)
   │      │           └─> Pods: isp-ops-frontend [3 replicas]
   │      │
   │      └─ Ingress: admin.example.com
   │            └─> Service: platform-admin-frontend (platform-admin namespace)
   │                  └─> Pods: platform-admin-frontend [3 replicas]
   │
   ├─ Kubernetes Cluster
   │     ├─ Namespace: platform-admin
   │     │     ├─ Deployment: platform-admin-frontend
   │     │     ├─ Deployment: platform-backend
   │     │     ├─ PostgreSQL (platform DB)
   │     │     └─ Redis (shared cache)
   │     │
   │     ├─ Namespace: tenant-isp1
   │     │     ├─ Deployment: isp-ops-frontend
   │     │     ├─ Deployment: isp-backend
   │     │     ├─ StatefulSet: postgresql (tenant DB)
   │     │     ├─ StatefulSet: redis
   │     │     ├─ Deployment: freeradius
   │     │     ├─ Deployment: netbox
   │     │     └─ NetworkPolicy: deny-all + allow-list
   │     │
   │     └─ Namespace: tenant-isp2
   │           └─ (Same as tenant-isp1, isolated)
   │
   └─ External Services
         ├─ PostgreSQL (managed DB for platform)
         └─ Redis Cluster (managed cache)
```

### Implementation

#### 1. Install ingress-nginx Controller

```bash
# Add Helm repo
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

# Install controller with custom values
cat > ingress-nginx-values.yaml <<EOF
controller:
  replicaCount: 3

  service:
    type: LoadBalancer
    annotations:
      service.beta.kubernetes.io/aws-load-balancer-type: "nlb"  # For AWS

  resources:
    limits:
      cpu: 1000m
      memory: 1Gi
    requests:
      cpu: 500m
      memory: 512Mi

  config:
    # Security headers (matching nginx.prod.conf)
    add-headers: "default/nginx-security-headers"

    # Rate limiting
    limit-req-status-code: "429"
    limit-conn-status-code: "429"

    # SSL configuration
    ssl-protocols: "TLSv1.2 TLSv1.3"
    ssl-ciphers: "ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:..."

    # Enable real IP forwarding
    use-forwarded-headers: "true"
    compute-full-forwarded-for: "true"

    # Proxy settings
    proxy-connect-timeout: "5"
    proxy-send-timeout: "30"
    proxy-read-timeout: "30"
    proxy-body-size: "100m"

  metrics:
    enabled: true
    serviceMonitor:
      enabled: true
EOF

helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --values ingress-nginx-values.yaml
```

#### 2. Create Security Headers ConfigMap

```yaml
# k8s/ingress-nginx-security-headers.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: nginx-security-headers
  namespace: default
data:
  X-Frame-Options: "SAMEORIGIN"
  X-Content-Type-Options: "nosniff"
  X-XSS-Protection: "1; mode=block"
  Referrer-Policy: "strict-origin-when-cross-origin"
  Strict-Transport-Security: "max-age=63072000; includeSubDomains; preload"
```

#### 3. Per-Tenant Ingress Resources

**File: `helm-charts/isp-ops-tenant/templates/ingress.yaml`**

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ .Values.tenant.subdomain }}-ingress
  namespace: {{ .Values.namespace }}
  annotations:
    # Rate limiting (per tenant)
    nginx.ingress.kubernetes.io/limit-rps: "10"
    nginx.ingress.kubernetes.io/limit-connections: "20"

    # SSL configuration
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"

    # Security
    nginx.ingress.kubernetes.io/enable-cors: "false"

    # WebSocket support
    nginx.ingress.kubernetes.io/websocket-services: "backend"

    # Request ID
    nginx.ingress.kubernetes.io/configuration-snippet: |
      add_header X-Request-ID $request_id always;

    # CSP header (tenant-specific)
    nginx.ingress.kubernetes.io/server-snippet: |
      add_header Content-Security-Policy "{{ .Values.tenant.csp_header }}" always;

spec:
  ingressClassName: nginx

  tls:
    - hosts:
        - {{ .Values.tenant.subdomain }}.{{ .Values.domain }}
      {{- if .Values.tenant.customDomain }}
        - {{ .Values.tenant.customDomain }}
      {{- end }}
      secretName: {{ .Values.tenant.subdomain }}-tls

  rules:
    # Main subdomain
    - host: {{ .Values.tenant.subdomain }}.{{ .Values.domain }}
      http:
        paths:
          # Frontend
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend
                port:
                  number: 3000

          # Backend API
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: backend
                port:
                  number: 8000

          # WebSocket
          - path: /ws
            pathType: Prefix
            backend:
              service:
                name: backend
                port:
                  number: 8000

          # GraphQL
          - path: /graphql
            pathType: Prefix
            backend:
              service:
                name: backend
                port:
                  number: 8000

    {{- if .Values.tenant.customDomain }}
    # Custom domain (white-label)
    - host: {{ .Values.tenant.customDomain }}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend
                port:
                  number: 3000
    {{- end }}
```

#### 4. Cert-Manager for Automatic SSL

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Create ClusterIssuer for Let's Encrypt
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            class: nginx
EOF
```

#### 5. Deploy Tenant with Helm

```bash
# Create namespace
kubectl create namespace tenant-isp1

# Deploy using Helm
helm install tenant-isp1 ./helm-charts/isp-ops-tenant \
  --namespace tenant-isp1 \
  --set namespace=tenant-isp1 \
  --set tenant.id=isp1 \
  --set tenant.subdomain=isp1 \
  --set tenant.name="ISP Customer 1" \
  --set domain=example.com \
  --set postgres.database=tenant_isp1 \
  --set redis.db=0 \
  --values tenant-isp1-values.yaml
```

#### 6. Verify Ingress and SSL

```bash
# Check ingress resource
kubectl get ingress -n tenant-isp1

# Check certificate (should show Ready=True)
kubectl get certificate -n tenant-isp1

# Describe ingress for details
kubectl describe ingress isp1-ingress -n tenant-isp1

# Test HTTPS
curl -I https://isp1.example.com/health

# Check ingress-nginx logs
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx -f
```

### Kubernetes Advantages

**Pros:**
- ✅ **Auto-scaling**: HorizontalPodAutoscaler based on CPU/memory/request rate
- ✅ **Self-healing**: Pods restart automatically on failure
- ✅ **Rolling updates**: Zero-downtime deployments
- ✅ **Namespace isolation**: Complete network and resource separation per tenant
- ✅ **Declarative config**: Helm charts version controlled
- ✅ **Observability**: Prometheus, Grafana, Jaeger built-in
- ✅ **Automatic SSL**: cert-manager handles renewal
- ✅ **Load balancing**: ingress-nginx handles traffic distribution
- ✅ **Resource quotas**: Enforce CPU/RAM/storage limits per tenant

**Cons:**
- ❌ **Complexity**: Requires Kubernetes expertise
- ❌ **Cost**: Control plane overhead (etcd, kube-apiserver, etc.)
- ❌ **Learning curve**: Helm, kubectl, CRDs, operators
- ❌ **Debugging**: More moving parts than VM deployment

---

## Domain Management & Verification

### Backend Domain Verification API

**File: `src/dotmac/platform/tenant/domain_verification_router.py:244`**

**Features:**
- Verify custom domain ownership via DNS TXT record
- Check domain health (DNS propagation, SSL validity)
- Rotate verification tokens
- Enable/disable custom domain after verification

**API Endpoints:**

```bash
# Initiate domain verification
POST /api/v1/tenant/domains/verify
{
  "domain": "my-isp.com",
  "verification_method": "dns_txt"
}

# Returns:
{
  "verification_token": "dotmac-verify=abc123def456",
  "dns_instructions": "Add TXT record to _dotmac-challenge.my-isp.com",
  "status": "pending"
}

# Check verification status
GET /api/v1/tenant/domains/my-isp.com/status

# Confirm verification (after DNS propagation)
POST /api/v1/tenant/domains/my-isp.com/confirm

# Enable custom domain
POST /api/v1/tenant/domains/my-isp.com/enable
```

### Frontend Domain Verification UI

**File: `frontend/apps/platform-admin-app/components/tenant/DomainVerificationCard.tsx:152`**

**Features:**
- Step-by-step domain verification wizard
- DNS record instructions with copy-to-clipboard
- Real-time verification status polling
- Branding benefits explanation
- Domain removal flow

**User Flow:**
1. Tenant enters custom domain (e.g., `my-isp.com`)
2. Platform generates verification token
3. UI displays DNS TXT record to add
4. Tenant adds DNS record at their registrar
5. Platform polls for DNS propagation (every 30s for 5 minutes)
6. Once verified, tenant can enable custom domain
7. Platform updates ingress/nginx config with new domain

### Automated DNS Configuration

**Option 1: Ansible Updates Nginx** (Single-Host/Cluster)

```bash
# After domain verification, update nginx config
ansible-playbook -i inventory.ini \
  ansible/playbooks/deployment/update-tenant-domain.yml \
  --extra-vars "tenant_id=tenant1 custom_domain=my-isp.com"

# Playbook adds custom_domain to nginx-site.conf.j2 template
# Reloads nginx: sudo nginx -s reload
```

**Option 2: Kubernetes Updates Ingress** (Automatic)

```yaml
# helm-charts/isp-ops-tenant/values.yaml
tenant:
  customDomain: "my-isp.com"

# Helm upgrade applies new domain to Ingress
helm upgrade tenant-isp1 ./helm-charts/isp-ops-tenant \
  --namespace tenant-isp1 \
  --set tenant.customDomain=my-isp.com \
  --reuse-values

# cert-manager automatically requests SSL certificate for new domain
```

### SSL Certificate Automation

**Single-Host/Cluster: Let's Encrypt + Certbot**

```bash
# Obtain certificate for custom domain
sudo certbot certonly --nginx \
  -d my-isp.com \
  --non-interactive \
  --agree-tos \
  --email admin@example.com

# Certbot updates nginx SSL paths automatically
# Auto-renewal via systemd timer
```

**Kubernetes: cert-manager**

```yaml
# Certificate resource created automatically by Ingress annotation
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: my-isp-com-tls
  namespace: tenant-isp1
spec:
  secretName: my-isp-com-tls
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
    - my-isp.com
```

---

## White-Labeling & Branding

### Frontend Branding System

**File: `frontend/apps/base-app/scripts/init-branding.cjs`**

**Branding Variables** (21 total):
- Product name, tagline, company name
- Support email
- Logos (light/dark/icon/favicon)
- Primary color, foreground, hover (light/dark)
- Accent color, foreground (light/dark)
- Font stacks (heading/body)
- Border radius (lg/md/sm)

**Generation Script:**

```bash
cd frontend/apps/isp-ops-app
node scripts/init-branding.cjs

# Interactive prompts:
# Product name: [ISP Customer 1 Dashboard]
# Primary brand color: [#0ea5e9]
# Logo (light mode): [/logos/isp1-light.svg]
# ...

# Generates: .env.branding
```

### Backend Branding Settings

**Environment Variables** (from `config.env.j2`):

```bash
# Tenant Branding (for emails, notifications, API responses)
TENANT_NAME=ISP Customer 1
TENANT_DOMAIN=isp1.example.com
TENANT_LOGO_URL=https://isp1.example.com/assets/logo.svg
TENANT_PRIMARY_COLOR=#0ea5e9
TENANT_SUPPORT_EMAIL=support@isp1.example.com
```

**API Endpoint for Branding Settings:**

```bash
# Frontend fetches branding at runtime
GET /api/v1/tenant/branding

# Response:
{
  "product_name": "ISP Customer 1 Dashboard",
  "company_name": "ISP Customer 1",
  "logo_light": "https://cdn.example.com/isp1/logo-light.svg",
  "logo_dark": "https://cdn.example.com/isp1/logo-dark.svg",
  "primary_color": "#0ea5e9",
  "support_email": "support@isp1.example.com"
}
```

**File: `frontend/shared/packages/headless/src/hooks/tenant/useTenantSettings.ts:97`**

```typescript
export function useTenantSettings() {
  const { data: branding } = useQuery({
    queryKey: ['tenant', 'branding'],
    queryFn: () => apiClient.get('/api/v1/tenant/branding'),
  });

  // Apply branding to CSS variables at runtime
  useEffect(() => {
    if (branding) {
      document.documentElement.style.setProperty('--brand-primary', branding.primary_color);
      document.documentElement.style.setProperty('--brand-logo', `url(${branding.logo_light})`);
      // ...
    }
  }, [branding]);

  return branding;
}
```

### Custom Domain + White-Label Flow

**End-to-End Process:**

1. **Tenant verifies custom domain** via platform-admin UI
   - Adds DNS TXT record: `_dotmac-challenge.my-isp.com TXT "dotmac-verify=abc123"`
   - Platform confirms DNS propagation

2. **Platform updates ingress/nginx** with custom domain
   - **Nginx**: Ansible adds `server_name my-isp.com;` to nginx-site.conf
   - **Kubernetes**: Helm updates Ingress with new host rule

3. **SSL certificate obtained automatically**
   - **Nginx**: Certbot runs `certbot certonly -d my-isp.com`
   - **Kubernetes**: cert-manager creates Certificate resource

4. **Tenant uploads white-label assets**
   - Logos, favicon, brand colors uploaded to `/api/v1/tenant/branding/assets`
   - Stored in S3 or local file storage

5. **Frontend applies branding**
   - `useTenantSettings()` fetches branding from backend
   - CSS variables updated: `--brand-primary`, `--brand-logo`, etc.
   - Next.js App Router renders tenant-specific UI

**Result**: Tenant's subscribers access white-labeled portal at `https://my-isp.com` with custom branding.

---

## Decision Matrix

### When to Use Each Deployment Model

| Factor | Single-Host Nginx | Multi-Server Nginx | Kubernetes |
|--------|-------------------|-----------------------|------------|
| **Tenant Count** | 1-20 | 20-100 | 100+ |
| **Budget** | $100-500/mo | $500-2000/mo | $2000+/mo |
| **Team Expertise** | Linux admin | DevOps + networking | K8s + cloud-native |
| **High Availability** | ❌ Single point of failure | ✅ Load balancer failover | ✅ Built-in (pods, replicas) |
| **Auto-Scaling** | ❌ Manual | ❌ Manual | ✅ HPA, VPA |
| **Deployment Speed** | 🟢 Fast (Ansible 5-10min) | 🟡 Moderate (10-20min) | 🔴 Slow (20-30min first time) |
| **Operational Complexity** | 🟢 Low | 🟡 Moderate | 🔴 High |
| **Multi-Tenancy** | 🟡 Port-based isolation | 🟡 Server-based isolation | 🟢 Namespace isolation |
| **Resource Efficiency** | 🟡 Moderate (shared OS) | 🟡 Moderate | 🟢 High (bin packing) |
| **SSL Management** | 🟡 Certbot (manual renewal) | 🟡 Centralized certbot | 🟢 cert-manager (automatic) |
| **Monitoring** | 🟡 Manual setup | 🟡 Centralized Prometheus | 🟢 Built-in (kube-state-metrics) |
| **Disaster Recovery** | 🔴 Manual backups | 🟡 Snapshot VMs | 🟢 GitOps (Helm, ArgoCD) |
| **Network Policies** | ❌ iptables only | ❌ Complex iptables | ✅ NetworkPolicy CRDs |
| **Cost per Tenant** | $5-25/mo | $10-50/mo | $20-100/mo |

### Recommendations

**Start with Single-Host Nginx if:**
- ✅ Proof of concept or pilot deployment
- ✅ 1-20 tenants initially
- ✅ Small team (1-3 people)
- ✅ Limited budget (<$500/mo)
- ✅ Quick time-to-market (deploy in days)

**Migrate to Multi-Server Nginx when:**
- ✅ 20-50 tenants
- ✅ High availability required
- ✅ Single VM reaching resource limits (CPU >80%, RAM >80%)
- ✅ Team has networking expertise (VIPs, load balancing, HA)

**Migrate to Kubernetes when:**
- ✅ 100+ tenants (or growth trajectory)
- ✅ Need auto-scaling (traffic spikes, seasonal)
- ✅ Multi-region deployment
- ✅ Team has Kubernetes experience (or willing to invest in training)
- ✅ DevOps maturity (CI/CD, GitOps, monitoring)
- ✅ Complex microservices architecture emerging

---

## Migration Paths

### Path 1: Single-Host → Multi-Server Nginx

**Preparation:**

1. **Extract Ansible playbook variables to inventory**
   ```ini
   [app_servers:vars]
   db_host=db-primary.internal
   redis_host=redis-primary.internal
   ```

2. **Setup shared PostgreSQL cluster** (pgpool-II or Patroni)

3. **Deploy load balancer pair** with Keepalived for VIP

4. **Migrate tenants one-by-one**:
   ```bash
   # Stop tenant on single-host VM
   sudo systemctl stop dotmac-tenant-tenant1

   # Export database
   pg_dump -h localhost -U tenant_tenant1_user tenant_tenant1 > tenant1.sql

   # Import to shared cluster
   psql -h db-primary.internal -U tenant_tenant1_user tenant_tenant1 < tenant1.sql

   # Deploy tenant to app-server-1
   ansible-playbook provision-tenant.yml \
     --extra-vars @tenant1_vars.yml \
     --limit app-server-1

   # Update load balancer upstream
   # Add: server app-server-1:8001 to tenant1_backend upstream
   sudo nginx -s reload

   # Test: curl https://isp1.example.com/health
   ```

5. **Verify and decommission old single-host VM**

**Timeline**: 1-2 weeks for 20 tenants

---

### Path 2: Multi-Server Nginx → Kubernetes

**Preparation:**

1. **Create Kubernetes cluster** (EKS, GKE, AKS, or on-premises with kubeadm)

2. **Install core infrastructure**:
   ```bash
   # ingress-nginx controller
   helm install ingress-nginx ingress-nginx/ingress-nginx

   # cert-manager for SSL
   kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

   # Prometheus + Grafana (kube-prometheus-stack)
   helm install prometheus prometheus-community/kube-prometheus-stack
   ```

3. **Convert Ansible templates to Helm charts**:
   ```bash
   # Generate Helm chart from existing deployment
   helm create helm-charts/isp-ops-tenant

   # Copy nginx config → Ingress annotations
   # Copy config.env → ConfigMap
   # Copy systemd service → Deployment
   ```

4. **Migrate tenants in phases**:

   **Phase 1: Deploy to Kubernetes without switching traffic**
   ```bash
   # Deploy tenant to K8s (test URL)
   helm install tenant-isp1 ./helm-charts/isp-ops-tenant \
     --namespace tenant-isp1 \
     --set tenant.subdomain=isp1-k8s

   # Test: https://isp1-k8s.example.com/health
   ```

   **Phase 2: Switch DNS to Kubernetes Ingress LoadBalancer**
   ```bash
   # Get LoadBalancer external IP
   kubectl get svc -n ingress-nginx ingress-nginx-controller

   # Update DNS A record
   isp1.example.com. IN A 35.123.45.67  # K8s LoadBalancer IP

   # TTL: 60 seconds for quick rollback
   ```

   **Phase 3: Monitor and verify**
   ```bash
   # Check ingress-nginx logs
   kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx -f | grep isp1

   # Check metrics
   kubectl port-forward -n tenant-isp1 svc/prometheus 9090:9090
   # Open http://localhost:9090
   # Query: rate(nginx_ingress_controller_requests{host="isp1.example.com"}[5m])
   ```

   **Phase 4: Decommission nginx server for this tenant**
   ```bash
   # Stop service on app-server
   sudo systemctl stop dotmac-tenant-tenant1

   # Remove nginx site config
   sudo rm /etc/nginx/sites-enabled/tenant-tenant1.conf
   sudo nginx -s reload
   ```

5. **Repeat for all tenants** (or migrate in batches)

**Timeline**: 1-3 months for 100 tenants (parallel migration possible)

---

### Path 3: Direct Single-Host → Kubernetes (Skip Multi-Server)

**When to Use:**
- Fast-growing startup (10 → 100 tenants in 6 months)
- Team already has Kubernetes experience
- Cloud-native from day one

**Simplified Migration:**

1. **Setup Kubernetes cluster**

2. **Convert single Ansible playbook to Helm chart**

3. **Deploy all tenants to Kubernetes in one migration window**:
   ```bash
   # Export all tenant databases
   for tenant in tenant1 tenant2 tenant3; do
     pg_dump -h localhost -U ${tenant}_user $tenant > ${tenant}.sql
   done

   # Create K8s namespaces and deploy
   for tenant in tenant1 tenant2 tenant3; do
     kubectl create namespace $tenant

     # Import database to K8s StatefulSet PostgreSQL
     kubectl run psql-import --rm -i --tty --image=postgres:15 \
       --namespace=$tenant \
       -- psql -h postgresql -U ${tenant}_user $tenant < ${tenant}.sql

     # Deploy Helm chart
     helm install $tenant ./helm-charts/isp-ops-tenant \
       --namespace=$tenant \
       --values tenants/${tenant}-values.yaml
   done

   # Switch DNS all at once
   # Update wildcard DNS: *.example.com → K8s LoadBalancer IP
   ```

**Timeline**: 1-2 weeks (assuming small number of tenants)

---

## Summary: Final Recommendation

### Recommendation for DotMac FTTH Operations Platform

**Phase 1: Start with Single-Host Nginx (Months 1-6)**
- ✅ Use Ansible templates created in this session
- ✅ Deploy 10-20 pilot tenants
- ✅ Focus on product-market fit
- ✅ Iterate on features rapidly

**Phase 2: Scale to Multi-Server Nginx (Months 7-12)**
- ✅ Add load balancer pair (Keepalived + nginx)
- ✅ Setup PostgreSQL cluster (pgpool-II)
- ✅ Deploy Redis Sentinel for HA
- ✅ Support 50-100 tenants

**Phase 3: Migrate to Kubernetes (Year 2+)**
- ✅ Use Helm charts from `PRODUCTION_DEPLOYMENT_K8S.md`
- ✅ Leverage ingress-nginx for routing
- ✅ Auto-scale based on tenant traffic
- ✅ Support 100-1000+ tenants

### Key Takeaways

1. **Don't over-engineer early**: Start with single-host nginx, migrate when needed
2. **Automate with Ansible**: Tenant provisioning must be automated from day 1
3. **Domain verification is critical**: Required for white-labeling and custom domains
4. **SSL automation saves time**: Let's Encrypt + cert-manager handle renewals
5. **Kubernetes is not always the answer**: Overkill for <50 tenants
6. **Monitor everything**: Nginx logs, Prometheus metrics, application traces

---

## Related Documents

- **`nginx/nginx.prod.conf`** - Production nginx configuration (current)
- **`ansible/playbooks/deployment/provision-tenant.yml`** - Tenant provisioning playbook
- **`frontend/PRODUCTION_DEPLOYMENT_K8S.md`** - Kubernetes deployment plan for frontend
- **`BACKEND_DEPLOYMENT_REMEDIATION.md`** - Backend configuration fixes for cross-environment deployment
- **`frontend/ARCHITECTURE_OVERVIEW.md`** - Current frontend architecture and ownership guide
- **`src/dotmac/platform/tenant/domain_verification_router.py`** - Domain verification API
- **`frontend/apps/platform-admin-app/components/tenant/DomainVerificationCard.tsx`** - Domain verification UI

---

**Document Version**: 1.0
**Last Updated**: 2025-01-04
**Status**: Ready for Implementation
