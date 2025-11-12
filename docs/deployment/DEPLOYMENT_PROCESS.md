# DotMac Platform - Deployment Process Guide

**Last Updated:** November 9, 2025
**Status:** Production
**Version:** 1.0

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Build Process](#build-process)
4. [Platform Admin Deployment](#platform-admin-deployment)
5. [ISP Ops Deployment](#isp-ops-deployment)
6. [Shared Package Updates](#shared-package-updates)
7. [Configuration Management](#configuration-management)
8. [Health Checks and Validation](#health-checks-and-validation)
9. [Rollback Procedures](#rollback-procedures)
10. [Troubleshooting](#troubleshooting)

---

## Overview

This guide provides step-by-step instructions for deploying the DotMac platform's frontend applications. The deployment process covers:

- **Platform Admin App**: Single instance deployment to control plane
- **ISP Operations App**: Per-tenant deployment to isolated namespaces
- **Shared Packages**: Golden image updates that affect both apps

### Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│               Deployment Process Flow                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. Build Shared Packages (@dotmac/*)                   │
│     └─> Used by both apps                               │
│                                                          │
│  2. Build Platform Admin App                            │
│     └─> Single deployment to control plane              │
│                                                          │
│  3. Build ISP Ops App (Golden Image)                    │
│     └─> Deployed to all tenant namespaces               │
│                                                          │
│  4. Deploy Platform Admin (Blue-Green)                  │
│     └─> Zero downtime deployment                        │
│                                                          │
│  5. Deploy to Tenants (Rolling Update)                  │
│     └─> Gradual rollout across all tenants              │
│                                                          │
│  6. Verify Health Checks                                │
│     └─> Automated smoke tests                           │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Prerequisites

### Required Tools

```bash
# Node.js and package manager
node --version    # v20.x or higher
pnpm --version    # v8.x or higher

# Docker and container tools
docker --version  # v24.x or higher
docker compose version  # v2.x or higher

# Kubernetes tools
kubectl version   # v1.28 or higher
helm version      # v3.13 or higher

# Cloud CLI (choose based on provider)
aws --version     # AWS deployments
gcloud version    # GCP deployments
az version        # Azure deployments
```

### Access Requirements

**Platform Admin Deployment**:
- Kubernetes cluster access with `cluster-admin` role
- Access to `platform-admin` namespace
- Docker registry push credentials
- Platform admin API credentials

**Tenant Deployment**:
- Kubernetes cluster access with namespace admin role
- Access to `tenant-{slug}` namespaces
- Docker registry push credentials
- Tenant-specific configuration values

### Environment Setup

```bash
# Clone repository
git clone https://github.com/dotmac/dotmac-ftth-ops.git
cd dotmac-ftth-ops/frontend

# Install dependencies
pnpm install

# Verify build environment
pnpm run check-env
```

---

## Build Process

### Step 1: Build Shared Packages

**Purpose**: Build all shared packages that both apps depend on

**Location**: `/Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops/frontend/shared/packages/`

```bash
# Navigate to frontend directory
cd /Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops/frontend

# Build all shared packages
pnpm --filter ./shared/packages/** build

# Expected output:
# ✓ @dotmac/primitives built successfully
# ✓ @dotmac/ui built successfully
# ✓ @dotmac/headless built successfully
# ✓ @dotmac/graphql built successfully
# ✓ @dotmac/features built successfully
# ✓ @dotmac/auth built successfully
# ✓ @dotmac/design-system built successfully
```

**Build Time**: ~2-3 minutes

**Verification**:
```bash
# Check build artifacts
ls -la shared/packages/primitives/dist
ls -la shared/packages/ui/dist
ls -la shared/packages/features/dist

# Verify TypeScript types
pnpm --filter ./shared/packages/** type-check
```

### Step 2: Build Platform Admin App

**Purpose**: Create production Docker image for platform admin app

**Location**: `/Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops/frontend/apps/platform-admin-app/`

```bash
# Build Docker image from monorepo root
cd /Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops/frontend

docker build \
  -f apps/platform-admin-app/Dockerfile \
  -t dotmac/platform-admin-app:v1.3.0 \
  -t dotmac/platform-admin-app:latest \
  .

# Expected output:
# [+] Building 180.5s (15/15) FINISHED
# => [internal] load build context
# => => transferring context: 120.45MB
# => [builder] install dependencies
# => [builder] build application
# => [runner] copy artifacts
# => exporting to image
# => => naming to dotmac/platform-admin-app:v1.3.0
```

**Build Time**: ~3-5 minutes

**Image Size**: ~1.2 GB (compressed)

**Verification**:
```bash
# Verify image was created
docker images | grep platform-admin-app

# Run image locally (optional)
docker run -p 3002:3000 \
  -e NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 \
  -e DEPLOYMENT_MODE=platform_admin \
  dotmac/platform-admin-app:v1.3.0
```

### Step 3: Build ISP Ops App

**Purpose**: Create golden image for all tenant deployments

**Location**: `/Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops/frontend/apps/isp-ops-app/`

```bash
# Build Docker image from monorepo root
cd /Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops/frontend

docker build \
  -f apps/isp-ops-app/Dockerfile \
  -t dotmac/isp-ops-app:v1.3.0 \
  -t dotmac/isp-ops-app:latest \
  .

# Expected output:
# [+] Building 245.3s (15/15) FINISHED
# => [internal] load build context
# => => transferring context: 145.67MB
# => [builder] install dependencies
# => [builder] build application
# => [runner] copy artifacts
# => exporting to image
# => => naming to dotmac/isp-ops-app:v1.3.0
```

**Build Time**: ~4-6 minutes

**Image Size**: ~1.5 GB (compressed)

**Verification**:
```bash
# Verify image was created
docker images | grep isp-ops-app

# Run image locally with tenant context (optional)
docker run -p 3001:3000 \
  -e NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 \
  -e DEPLOYMENT_MODE=single_tenant \
  -e TENANT_ID=test-tenant-123 \
  -e TENANT_SLUG=test-tenant \
  dotmac/isp-ops-app:v1.3.0
```

### Step 4: Push Images to Registry

```bash
# Configure registry authentication (AWS ECR example)
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin 123456789.dkr.ecr.us-east-1.amazonaws.com

# Tag images for registry
docker tag dotmac/platform-admin-app:v1.3.0 \
  123456789.dkr.ecr.us-east-1.amazonaws.com/dotmac/platform-admin-app:v1.3.0

docker tag dotmac/isp-ops-app:v1.3.0 \
  123456789.dkr.ecr.us-east-1.amazonaws.com/dotmac/isp-ops-app:v1.3.0

# Push images
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/dotmac/platform-admin-app:v1.3.0
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/dotmac/isp-ops-app:v1.3.0
```

**Push Time**: ~5-10 minutes (depends on network speed)

---

## Platform Admin Deployment

### Deployment Strategy: Blue-Green

**Purpose**: Zero-downtime deployment of platform admin app

**Target**: Single instance in `platform-admin` namespace

### Step 1: Prepare Deployment

```bash
# Verify Kubernetes context
kubectl config current-context

# Verify access to platform-admin namespace
kubectl get namespace platform-admin
kubectl auth can-i create deployment --namespace platform-admin
```

### Step 2: Create ConfigMap

```yaml
# File: platform-admin-configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: platform-admin-config-v1.3.0
  namespace: platform-admin
data:
  # Deployment mode
  DEPLOYMENT_MODE: "platform_admin"
  ENABLE_PLATFORM_ROUTES: "true"

  # API endpoints
  NEXT_PUBLIC_API_BASE_URL: "https://api.dotmac.com"
  NEXT_PUBLIC_GRAPHQL_URL: "https://api.dotmac.com/graphql"

  # Feature flags
  NEXT_PUBLIC_ENABLE_TENANT_MANAGEMENT: "true"
  NEXT_PUBLIC_ENABLE_LICENSE_MANAGEMENT: "true"
  NEXT_PUBLIC_ENABLE_FEATURE_FLAGS: "true"
  NEXT_PUBLIC_ENABLE_DARK_MODE: "true"

  # Monitoring
  NEXT_PUBLIC_SENTRY_DSN: "https://..."
  NEXT_PUBLIC_ANALYTICS_ID: "UA-..."
```

```bash
# Apply ConfigMap
kubectl apply -f platform-admin-configmap.yaml
```

### Step 3: Deploy New Version (Blue-Green)

```yaml
# File: platform-admin-deployment-v1.3.0.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: platform-admin-app-v1-3-0
  namespace: platform-admin
  labels:
    app: platform-admin-app
    version: v1.3.0
spec:
  replicas: 1
  selector:
    matchLabels:
      app: platform-admin-app
      version: v1.3.0
  template:
    metadata:
      labels:
        app: platform-admin-app
        version: v1.3.0
    spec:
      containers:
        - name: frontend
          image: 123456789.dkr.ecr.us-east-1.amazonaws.com/dotmac/platform-admin-app:v1.3.0
          ports:
            - containerPort: 3000
              name: http
          envFrom:
            - configMapRef:
                name: platform-admin-config-v1.3.0
          env:
            - name: NODE_ENV
              value: "production"
            - name: PORT
              value: "3000"
          resources:
            requests:
              cpu: "2"
              memory: 4Gi
            limits:
              cpu: "4"
              memory: 8Gi
          livenessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /api/ready
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 5
```

```bash
# Deploy new version (green)
kubectl apply -f platform-admin-deployment-v1.3.0.yaml

# Wait for deployment to be ready
kubectl rollout status deployment/platform-admin-app-v1-3-0 -n platform-admin

# Expected output:
# Waiting for deployment "platform-admin-app-v1-3-0" rollout to finish: 0 of 1 updated replicas are available...
# deployment "platform-admin-app-v1-3-0" successfully rolled out
```

### Step 4: Verify Health

```bash
# Check pod status
kubectl get pods -n platform-admin -l version=v1.3.0

# View logs
kubectl logs -n platform-admin deployment/platform-admin-app-v1-3-0 --tail=50

# Test health endpoint
kubectl port-forward -n platform-admin deployment/platform-admin-app-v1-3-0 3002:3000 &
curl http://localhost:3002/api/health

# Expected response:
# {"status":"ok","version":"v1.3.0"}
```

### Step 5: Switch Traffic (Update Service)

```yaml
# File: platform-admin-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: platform-admin-app
  namespace: platform-admin
spec:
  selector:
    app: platform-admin-app
    version: v1.3.0  # Update to point to new version
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
  type: ClusterIP
```

```bash
# Update service to point to new deployment
kubectl apply -f platform-admin-service.yaml

# Verify service endpoints
kubectl get endpoints platform-admin-app -n platform-admin
```

### Step 6: Monitor and Validate

```bash
# Monitor error logs
kubectl logs -n platform-admin deployment/platform-admin-app-v1-3-0 --follow | grep ERROR

# Check metrics (if Prometheus configured)
curl http://platform-admin-app.platform-admin/metrics

# Smoke test (manual)
# - Login to https://admin.dotmac.com
# - Verify dashboard loads
# - Check tenant list
# - Test license management
```

### Step 7: Remove Old Deployment (Blue)

```bash
# Once new version is stable, remove old deployment
kubectl delete deployment platform-admin-app-v1-2-3 -n platform-admin

# Clean up old ConfigMaps
kubectl delete configmap platform-admin-config-v1.2.3 -n platform-admin
```

**Total Deployment Time**: 10-15 minutes

---

## ISP Ops Deployment

### Deployment Strategy: Rolling Update

**Purpose**: Gradual rollout to all tenant namespaces

**Target**: Multiple instances across tenant namespaces

### Deployment Methods

#### Method 1: Manual Per-Tenant Deployment

**Use Case**: Small number of tenants, custom configurations

```bash
# List all tenant namespaces
kubectl get namespaces -l app.kubernetes.io/component=tenant

# Deploy to specific tenant
TENANT_SLUG="fast-fiber"
TENANT_ID="fast-fiber-isp-123"

# Create ConfigMap for tenant
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: isp-ops-config
  namespace: tenant-${TENANT_SLUG}
data:
  DEPLOYMENT_MODE: "single_tenant"
  TENANT_ID: "${TENANT_ID}"
  TENANT_SLUG: "${TENANT_SLUG}"
  NEXT_PUBLIC_TENANT_NAME: "Fast Fiber ISP"
  NEXT_PUBLIC_API_BASE_URL: "https://api.${TENANT_SLUG}.isp.dotmac.com"
  NEXT_PUBLIC_GRAPHQL_URL: "https://api.${TENANT_SLUG}.isp.dotmac.com/graphql"
  NEXT_PUBLIC_ENABLE_CUSTOMER_PORTAL: "true"
  NEXT_PUBLIC_ENABLE_RADIUS: "true"
EOF

# Update deployment image
kubectl set image deployment/isp-ops-app \
  frontend=123456789.dkr.ecr.us-east-1.amazonaws.com/dotmac/isp-ops-app:v1.3.0 \
  -n tenant-${TENANT_SLUG}

# Wait for rollout
kubectl rollout status deployment/isp-ops-app -n tenant-${TENANT_SLUG}

# Verify pod status
kubectl get pods -n tenant-${TENANT_SLUG} -l app=isp-ops-app
```

**Deployment Time per Tenant**: ~2-3 minutes

#### Method 2: Automated Multi-Tenant Deployment

**Use Case**: Large number of tenants, standardized configurations

```bash
#!/bin/bash
# File: deploy-all-tenants.sh

# Configuration
VERSION="v1.3.0"
IMAGE="123456789.dkr.ecr.us-east-1.amazonaws.com/dotmac/isp-ops-app:${VERSION}"
BATCH_SIZE=5  # Number of tenants to deploy simultaneously
WAIT_TIME=60  # Seconds to wait between batches

# Get all tenant namespaces
TENANTS=$(kubectl get namespaces \
  -l app.kubernetes.io/component=tenant \
  -o jsonpath='{.items[*].metadata.name}')

# Convert to array
TENANT_ARRAY=($TENANTS)
TOTAL_TENANTS=${#TENANT_ARRAY[@]}

echo "Deploying to ${TOTAL_TENANTS} tenants in batches of ${BATCH_SIZE}"

# Deploy in batches
for ((i=0; i<$TOTAL_TENANTS; i+=BATCH_SIZE)); do
  BATCH_NUM=$((i / BATCH_SIZE + 1))
  echo "=== Deploying Batch ${BATCH_NUM} ==="

  # Deploy to batch
  for ((j=i; j<i+BATCH_SIZE && j<TOTAL_TENANTS; j++)); do
    NAMESPACE=${TENANT_ARRAY[$j]}
    echo "Updating ${NAMESPACE}..."

    kubectl set image deployment/isp-ops-app \
      frontend=${IMAGE} \
      -n ${NAMESPACE} &
  done

  # Wait for batch deployments to start
  wait

  # Wait for batch to complete
  for ((j=i; j<i+BATCH_SIZE && j<TOTAL_TENANTS; j++)); do
    NAMESPACE=${TENANT_ARRAY[$j]}
    echo "Waiting for ${NAMESPACE} rollout..."

    kubectl rollout status deployment/isp-ops-app \
      -n ${NAMESPACE} \
      --timeout=5m

    if [ $? -eq 0 ]; then
      echo "✓ ${NAMESPACE} deployed successfully"
    else
      echo "✗ ${NAMESPACE} deployment failed"
      # Continue or exit based on strategy
    fi
  done

  # Wait before next batch (if not last batch)
  if [ $((i + BATCH_SIZE)) -lt $TOTAL_TENANTS ]; then
    echo "Waiting ${WAIT_TIME} seconds before next batch..."
    sleep ${WAIT_TIME}
  fi
done

echo "=== Deployment Complete ==="
echo "Total tenants: ${TOTAL_TENANTS}"
```

```bash
# Make script executable
chmod +x deploy-all-tenants.sh

# Run deployment
./deploy-all-tenants.sh
```

**Total Deployment Time**: Varies by tenant count
- 10 tenants: ~20 minutes
- 50 tenants: ~90 minutes
- 100 tenants: ~3 hours

#### Method 3: Helm-Based Deployment

**Use Case**: Infrastructure as Code, GitOps workflows

```bash
# Install Helm chart for new tenant
helm upgrade --install fast-fiber-isp \
  ./helm-charts/isp-ops-tenant \
  --namespace tenant-fast-fiber \
  --create-namespace \
  --values - <<EOF
image:
  repository: 123456789.dkr.ecr.us-east-1.amazonaws.com/dotmac/isp-ops-app
  tag: v1.3.0
  pullPolicy: IfNotPresent

tenant:
  id: fast-fiber-isp-123
  slug: fast-fiber
  name: Fast Fiber ISP

config:
  deploymentMode: single_tenant
  enableCustomerPortal: true
  enableRadius: true
  apiBaseUrl: https://api.fast-fiber.isp.dotmac.com

ingress:
  enabled: true
  host: fast-fiber.isp.dotmac.com
  tls:
    enabled: true
    secretName: fast-fiber-tls

resources:
  requests:
    cpu: 1
    memory: 2Gi
  limits:
    cpu: 2
    memory: 4Gi
EOF

# Verify deployment
helm list -n tenant-fast-fiber
kubectl get all -n tenant-fast-fiber
```

### Health Checks After Deployment

```bash
# Function to check tenant health
check_tenant_health() {
  NAMESPACE=$1

  # Check pod status
  POD_STATUS=$(kubectl get pods -n ${NAMESPACE} \
    -l app=isp-ops-app \
    -o jsonpath='{.items[0].status.phase}')

  if [ "$POD_STATUS" != "Running" ]; then
    echo "✗ ${NAMESPACE}: Pod not running (${POD_STATUS})"
    return 1
  fi

  # Check ready replicas
  READY=$(kubectl get deployment isp-ops-app -n ${NAMESPACE} \
    -o jsonpath='{.status.readyReplicas}')
  DESIRED=$(kubectl get deployment isp-ops-app -n ${NAMESPACE} \
    -o jsonpath='{.spec.replicas}')

  if [ "$READY" != "$DESIRED" ]; then
    echo "✗ ${NAMESPACE}: Not all replicas ready (${READY}/${DESIRED})"
    return 1
  fi

  # Check health endpoint
  POD=$(kubectl get pod -n ${NAMESPACE} \
    -l app=isp-ops-app \
    -o jsonpath='{.items[0].metadata.name}')

  HEALTH=$(kubectl exec -n ${NAMESPACE} ${POD} -- \
    curl -s http://localhost:3000/api/health | jq -r .status)

  if [ "$HEALTH" != "ok" ]; then
    echo "✗ ${NAMESPACE}: Health check failed"
    return 1
  fi

  echo "✓ ${NAMESPACE}: Healthy"
  return 0
}

# Check all tenants
for ns in $(kubectl get ns -l app.kubernetes.io/component=tenant -o name | cut -d/ -f2); do
  check_tenant_health $ns
done
```

---

## Shared Package Updates

### When to Update Shared Packages

**Triggers**:
- Bug fix in shared component
- New feature added to `@dotmac/features`
- Security patch in `@dotmac/primitives`
- Performance improvement in `@dotmac/headless`
- Breaking API change in `@dotmac/graphql`

### Impact Analysis

**Shared package update affects**:
- ✅ Both `platform-admin-app` and `isp-ops-app`
- ✅ All tenant deployments
- ⚠️ Requires rebuilding both apps
- ⚠️ Requires deploying to control plane + all tenants

### Update Process

#### Step 1: Make Changes to Shared Package

```bash
# Navigate to shared package
cd /Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops/frontend/shared/packages/features

# Make code changes
# ... edit files ...

# Update package version
# Edit package.json: "version": "0.2.0" (was 0.1.0)
```

#### Step 2: Test Changes Locally

```bash
# Build shared package
pnpm build

# Test in platform-admin-app
cd ../../apps/platform-admin-app
pnpm dev
# Manual testing...

# Test in isp-ops-app
cd ../isp-ops-app
pnpm dev
# Manual testing...

# Run automated tests
cd ../..
pnpm test:all
```

#### Step 3: Build New App Versions

```bash
# Increment app versions
# Edit apps/platform-admin-app/package.json: "version": "1.3.1"
# Edit apps/isp-ops-app/package.json: "version": "1.3.1"

# Build both apps
docker build -f apps/platform-admin-app/Dockerfile -t dotmac/platform-admin-app:v1.3.1 .
docker build -f apps/isp-ops-app/Dockerfile -t dotmac/isp-ops-app:v1.3.1 .

# Push to registry
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/dotmac/platform-admin-app:v1.3.1
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/dotmac/isp-ops-app:v1.3.1
```

#### Step 4: Deploy Updates

```bash
# Deploy platform admin
kubectl set image deployment/platform-admin-app \
  frontend=123456789.dkr.ecr.us-east-1.amazonaws.com/dotmac/platform-admin-app:v1.3.1 \
  -n platform-admin

# Deploy to all tenants
./deploy-all-tenants.sh
```

### Versioning Strategy

**Semantic Versioning**:
- **Major** (v2.0.0): Breaking changes
  - Requires coordination with backend team
  - Update all tenants simultaneously
  - Plan migration window

- **Minor** (v1.3.0): New features
  - Backward compatible
  - Can roll out gradually
  - Test with subset of tenants first

- **Patch** (v1.3.1): Bug fixes
  - No breaking changes
  - Safe to deploy immediately
  - Automated rollout acceptable

### Testing Requirements

**Before Deploying Shared Package Update**:

```bash
# Run all tests
pnpm --filter ./shared/packages/** test

# Type check
pnpm --filter ./shared/packages/** type-check

# Lint
pnpm --filter ./shared/packages/** lint

# Build both apps
pnpm --filter @dotmac/platform-admin-app build
pnpm --filter @dotmac/isp-ops-app build

# E2E tests (platform admin)
pnpm --filter @dotmac/platform-admin-app test:e2e

# E2E tests (ISP ops)
pnpm --filter @dotmac/isp-ops-app test:e2e

# Visual regression tests (if configured)
pnpm test:visual
```

---

## Configuration Management

### Environment Variables by App

#### Platform Admin App

```bash
# Required variables
DEPLOYMENT_MODE=platform_admin
ENABLE_PLATFORM_ROUTES=true
NEXT_PUBLIC_API_BASE_URL=https://api.dotmac.com
NEXT_PUBLIC_GRAPHQL_URL=https://api.dotmac.com/graphql

# Optional variables
NEXT_PUBLIC_ENABLE_DARK_MODE=true
NEXT_PUBLIC_SENTRY_DSN=https://...
NEXT_PUBLIC_ANALYTICS_ID=UA-...
```

#### ISP Ops App (Per-Tenant)

```bash
# Required variables
DEPLOYMENT_MODE=single_tenant
TENANT_ID=<tenant-id>
TENANT_SLUG=<tenant-slug>
NEXT_PUBLIC_API_BASE_URL=https://api.<tenant>.isp.dotmac.com
NEXT_PUBLIC_GRAPHQL_URL=https://api.<tenant>.isp.dotmac.com/graphql

# Optional variables
NEXT_PUBLIC_TENANT_NAME=<tenant-name>
NEXT_PUBLIC_TENANT_LOGO_URL=https://cdn.dotmac.com/logos/<tenant>.png
NEXT_PUBLIC_PRIMARY_COLOR=#0066CC
NEXT_PUBLIC_ENABLE_CUSTOMER_PORTAL=true
NEXT_PUBLIC_ENABLE_RADIUS=true
```

### Secrets Management

**Using Kubernetes Secrets**:

```yaml
# Create secret
apiVersion: v1
kind: Secret
metadata:
  name: isp-ops-secrets
  namespace: tenant-fast-fiber
type: Opaque
data:
  database-url: <base64-encoded>
  redis-password: <base64-encoded>
  jwt-secret: <base64-encoded>
```

```bash
# Create from file
kubectl create secret generic isp-ops-secrets \
  --from-literal=database-url=postgresql://... \
  --from-literal=redis-password=... \
  --from-literal=jwt-secret=... \
  -n tenant-fast-fiber

# Reference in deployment
env:
  - name: DATABASE_URL
    valueFrom:
      secretKeyRef:
        name: isp-ops-secrets
        key: database-url
```

---

## Health Checks and Validation

### Automated Health Checks

```bash
#!/bin/bash
# File: health-check.sh

NAMESPACE=$1
APP=$2

# Check pod status
POD=$(kubectl get pod -n ${NAMESPACE} -l app=${APP} -o jsonpath='{.items[0].metadata.name}')

if [ -z "$POD" ]; then
  echo "✗ No pods found"
  exit 1
fi

# Check pod phase
PHASE=$(kubectl get pod ${POD} -n ${NAMESPACE} -o jsonpath='{.status.phase}')
if [ "$PHASE" != "Running" ]; then
  echo "✗ Pod not running: ${PHASE}"
  exit 1
fi

# Check container ready status
READY=$(kubectl get pod ${POD} -n ${NAMESPACE} -o jsonpath='{.status.containerStatuses[0].ready}')
if [ "$READY" != "true" ]; then
  echo "✗ Container not ready"
  exit 1
fi

# Check health endpoint
kubectl exec ${POD} -n ${NAMESPACE} -- curl -sf http://localhost:3000/api/health > /dev/null
if [ $? -ne 0 ]; then
  echo "✗ Health check failed"
  exit 1
fi

# Check readiness endpoint
kubectl exec ${POD} -n ${NAMESPACE} -- curl -sf http://localhost:3000/api/ready > /dev/null
if [ $? -ne 0 ]; then
  echo "✗ Readiness check failed"
  exit 1
fi

echo "✓ Health checks passed"
exit 0
```

### Smoke Tests

```bash
#!/bin/bash
# File: smoke-test.sh

NAMESPACE=$1
BASE_URL=$2

# Test homepage
curl -sf ${BASE_URL}/ > /dev/null || {
  echo "✗ Homepage failed"
  exit 1
}

# Test login page
curl -sf ${BASE_URL}/login > /dev/null || {
  echo "✗ Login page failed"
  exit 1
}

# Test API health
curl -sf ${BASE_URL}/api/health | jq -e '.status == "ok"' > /dev/null || {
  echo "✗ API health check failed"
  exit 1
}

# Test API ready
curl -sf ${BASE_URL}/api/ready | jq -e '.ready == true' > /dev/null || {
  echo "✗ API ready check failed"
  exit 1
}

echo "✓ Smoke tests passed"
exit 0
```

### Monitoring Metrics

**Key Metrics to Monitor**:

```bash
# Error rate
kubectl logs -n tenant-fast-fiber deployment/isp-ops-app | \
  grep ERROR | wc -l

# Response time (from logs)
kubectl logs -n tenant-fast-fiber deployment/isp-ops-app | \
  grep "response_time" | awk '{sum+=$5; count++} END {print sum/count}'

# Memory usage
kubectl top pod -n tenant-fast-fiber -l app=isp-ops-app

# CPU usage
kubectl top pod -n tenant-fast-fiber -l app=isp-ops-app --containers
```

---

## Rollback Procedures

### Rollback Triggers

**When to Rollback**:
- ✗ Health checks failing
- ✗ High error rate (>5%)
- ✗ Performance degradation (>2x response time)
- ✗ User-reported critical bugs
- ✗ Database migration failures

### Rollback Methods

#### Method 1: Kubernetes Rollback

```bash
# View rollout history
kubectl rollout history deployment/platform-admin-app -n platform-admin

# Rollback to previous version
kubectl rollout undo deployment/platform-admin-app -n platform-admin

# Rollback to specific revision
kubectl rollout undo deployment/platform-admin-app --to-revision=3 -n platform-admin

# Verify rollback
kubectl rollout status deployment/platform-admin-app -n platform-admin
```

#### Method 2: Blue-Green Rollback

```bash
# Switch service back to old deployment
kubectl patch service platform-admin-app -n platform-admin \
  -p '{"spec":{"selector":{"version":"v1.2.3"}}}'

# Verify traffic switched
kubectl get endpoints platform-admin-app -n platform-admin

# Delete failed deployment
kubectl delete deployment platform-admin-app-v1-3-0 -n platform-admin
```

#### Method 3: Helm Rollback

```bash
# View release history
helm history fast-fiber-isp -n tenant-fast-fiber

# Rollback to previous release
helm rollback fast-fiber-isp -n tenant-fast-fiber

# Rollback to specific revision
helm rollback fast-fiber-isp 3 -n tenant-fast-fiber

# Verify rollback
helm status fast-fiber-isp -n tenant-fast-fiber
```

### Automated Rollback

```bash
#!/bin/bash
# File: auto-rollback.sh

NAMESPACE=$1
DEPLOYMENT=$2
ERROR_THRESHOLD=5  # Percentage

# Deploy new version
kubectl set image deployment/${DEPLOYMENT} frontend=new-image -n ${NAMESPACE}

# Wait for rollout
kubectl rollout status deployment/${DEPLOYMENT} -n ${NAMESPACE} --timeout=5m

# Monitor error rate for 5 minutes
for i in {1..10}; do
  sleep 30

  # Get error rate
  ERROR_COUNT=$(kubectl logs -n ${NAMESPACE} deployment/${DEPLOYMENT} --since=30s | grep ERROR | wc -l)
  TOTAL_REQUESTS=$(kubectl logs -n ${NAMESPACE} deployment/${DEPLOYMENT} --since=30s | grep "HTTP" | wc -l)

  if [ ${TOTAL_REQUESTS} -gt 0 ]; then
    ERROR_RATE=$(( ERROR_COUNT * 100 / TOTAL_REQUESTS ))

    if [ ${ERROR_RATE} -gt ${ERROR_THRESHOLD} ]; then
      echo "✗ Error rate ${ERROR_RATE}% exceeds threshold ${ERROR_THRESHOLD}%"
      echo "Rolling back..."

      kubectl rollout undo deployment/${DEPLOYMENT} -n ${NAMESPACE}
      exit 1
    fi
  fi
done

echo "✓ Deployment successful (error rate below threshold)"
exit 0
```

---

## Troubleshooting

### Common Issues

#### Issue 1: Image Pull Errors

**Symptoms**:
```
kubectl get pods -n tenant-fast-fiber
# NAME                           READY   STATUS         RESTARTS   AGE
# isp-ops-app-5d9f8c7b6-abc123   0/1     ImagePullBackOff   0       2m
```

**Solution**:
```bash
# Check image exists in registry
docker pull 123456789.dkr.ecr.us-east-1.amazonaws.com/dotmac/isp-ops-app:v1.3.0

# Verify image pull secret
kubectl get secret -n tenant-fast-fiber | grep regcred

# Create image pull secret if missing
kubectl create secret docker-registry regcred \
  --docker-server=123456789.dkr.ecr.us-east-1.amazonaws.com \
  --docker-username=AWS \
  --docker-password=$(aws ecr get-login-password --region us-east-1) \
  -n tenant-fast-fiber

# Update deployment to use secret
kubectl patch deployment isp-ops-app -n tenant-fast-fiber \
  -p '{"spec":{"template":{"spec":{"imagePullSecrets":[{"name":"regcred"}]}}}}'
```

#### Issue 2: CrashLoopBackOff

**Symptoms**:
```
kubectl get pods -n tenant-fast-fiber
# NAME                           READY   STATUS             RESTARTS   AGE
# isp-ops-app-5d9f8c7b6-abc123   0/1     CrashLoopBackOff   5          10m
```

**Solution**:
```bash
# Check pod logs
kubectl logs -n tenant-fast-fiber isp-ops-app-5d9f8c7b6-abc123

# Check previous container logs (if restarted)
kubectl logs -n tenant-fast-fiber isp-ops-app-5d9f8c7b6-abc123 --previous

# Common causes:
# 1. Missing environment variables
kubectl get configmap isp-ops-config -n tenant-fast-fiber -o yaml

# 2. Invalid configuration
kubectl describe pod -n tenant-fast-fiber isp-ops-app-5d9f8c7b6-abc123

# 3. Database connection issues
kubectl exec -n tenant-fast-fiber isp-ops-app-5d9f8c7b6-abc123 -- \
  nc -zv tenant-fast-fiber-db 5432
```

#### Issue 3: High Memory Usage

**Symptoms**:
```
kubectl top pod -n tenant-fast-fiber
# NAME                           CPU(cores)   MEMORY(bytes)
# isp-ops-app-5d9f8c7b6-abc123   500m         7500Mi  # Near limit!
```

**Solution**:
```bash
# Increase memory limit
kubectl patch deployment isp-ops-app -n tenant-fast-fiber \
  -p '{"spec":{"template":{"spec":{"containers":[{"name":"frontend","resources":{"limits":{"memory":"8Gi"}}}]}}}}'

# Enable horizontal pod autoscaling
kubectl autoscale deployment isp-ops-app \
  --cpu-percent=70 \
  --min=1 \
  --max=5 \
  -n tenant-fast-fiber
```

#### Issue 4: Slow Deployments

**Symptoms**:
- Deployment takes >10 minutes per tenant

**Solution**:
```bash
# Optimize image size
# - Use multi-stage builds
# - Minimize dependencies
# - Use .dockerignore

# Parallel deployments
# - Deploy to multiple tenants simultaneously
# - Increase batch size in deploy script

# Regional registries
# - Use registry in same region as cluster
# - Enable registry mirroring
```

### Debug Commands

```bash
# Get deployment status
kubectl get deployment -n tenant-fast-fiber

# Describe deployment
kubectl describe deployment isp-ops-app -n tenant-fast-fiber

# Get pod status
kubectl get pods -n tenant-fast-fiber -l app=isp-ops-app

# Describe pod
kubectl describe pod <pod-name> -n tenant-fast-fiber

# View logs
kubectl logs <pod-name> -n tenant-fast-fiber

# Stream logs
kubectl logs -f <pod-name> -n tenant-fast-fiber

# Execute command in pod
kubectl exec -it <pod-name> -n tenant-fast-fiber -- /bin/sh

# Port forward for local testing
kubectl port-forward <pod-name> 3001:3000 -n tenant-fast-fiber

# View events
kubectl get events -n tenant-fast-fiber --sort-by='.lastTimestamp'

# Check resource usage
kubectl top pod <pod-name> -n tenant-fast-fiber
kubectl top node
```

---

## Summary

### Deployment Checklist

**Pre-Deployment**:
- [ ] Build and test shared packages
- [ ] Build Docker images for both apps
- [ ] Push images to container registry
- [ ] Update ConfigMaps with new version
- [ ] Review deployment strategy (blue-green vs rolling)
- [ ] Plan rollback procedure
- [ ] Notify stakeholders of maintenance window

**Platform Admin Deployment**:
- [ ] Deploy new version (blue-green)
- [ ] Verify health checks
- [ ] Switch traffic to new version
- [ ] Monitor error rates (5 minutes)
- [ ] Remove old deployment

**Tenant Deployment**:
- [ ] Test with 1-2 pilot tenants
- [ ] Monitor pilot tenants (30 minutes)
- [ ] Deploy to remaining tenants (batches)
- [ ] Verify all tenant health checks
- [ ] Monitor error rates across all tenants

**Post-Deployment**:
- [ ] Run smoke tests
- [ ] Verify metrics (error rate, response time)
- [ ] Check monitoring dashboards
- [ ] Update deployment documentation
- [ ] Notify stakeholders of completion

### Key Metrics

| Metric | Platform Admin | ISP Ops (per tenant) |
|--------|----------------|----------------------|
| Build time | ~3-5 min | ~4-6 min |
| Deployment time | ~10-15 min | ~2-3 min |
| Image size | ~1.2 GB | ~1.5 GB |
| Rollback time | ~2 min | ~2 min |

### Best Practices

1. **Always build shared packages first** before building apps
2. **Test in staging** before deploying to production
3. **Deploy platform admin first** before tenant deployments
4. **Use batched rollouts** for tenant deployments
5. **Monitor error rates** during and after deployment
6. **Have rollback plan ready** before starting deployment
7. **Document configuration changes** in version control
8. **Automate health checks** to reduce manual verification
9. **Use semantic versioning** for clear version tracking
10. **Maintain deployment runbooks** for team consistency

---

## Related Documentation

- [DEPLOYMENT_MODEL.md](/Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops/docs/architecture/DEPLOYMENT_MODEL.md) - Deployment architecture overview
- [DEPLOYMENT_TOPOLOGY.md](/Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops/docs/architecture/diagrams/DEPLOYMENT_TOPOLOGY.md) - Visual deployment diagrams
- [PRODUCTION_DEPLOYMENT_K8S.md](/Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops/frontend/PRODUCTION_DEPLOYMENT_K8S.md) - Kubernetes manifests and Helm charts

---

**Maintained by**: DotMac Platform Engineering
**Last Review**: November 9, 2025
**Next Review**: Quarterly or when deployment process changes
