# Docker Compose Portability Fixes

## Executive Summary

This document addresses **critical machine-specific issues** in Docker Compose configurations that prevent deployment across different hardware architectures, operating systems, and hosting environments. These issues complement the general backend remediation plan (`BACKEND_DEPLOYMENT_REMEDIATION.md`).

**Critical Issues Found:**
- Hardcoded AMD64 architecture constraint
- Local file system dependencies (relative path mounts)
- Host system path mounts (security and portability concerns)
- Custom/untagged Docker images
- Hardcoded database tuning for specific hardware

**Impact**: Current Docker Compose setup works on developer machines but fails on ARM servers, cloud platforms, and different Linux distributions.

---

## Quick Navigation

- [Phase 7.1: Platform Architecture Constraints](#phase-71-platform-architecture-constraints)
- [Phase 7.2: Local File System Volume Mounts](#phase-72-local-file-system-volume-mounts)
- [Phase 7.3: Host System Path Mounts](#phase-73-host-system-path-mounts)
- [Phase 7.4: Custom Docker Images](#phase-74-custom-docker-images)
- [Phase 7.5: Database Configuration Tuning](#phase-75-database-configuration-tuning)
- [Phase 7.6: Storage Path Configuration](#phase-76-storage-path-configuration)
- [Testing & Validation](#testing--validation)

---

## Phase 7.1: Platform Architecture Constraints

### Problem: Hardcoded AMD64 Architecture

**File**: `docker-compose.isp.yml:9`

**Current state**:
```yaml
services:
  freeradius:
    image: freeradius-postgresql:latest
    platform: linux/amd64  # ❌ Hardcoded
```

**Impact**:
- ❌ Won't work on ARM servers (AWS Graviton, Oracle Ampere, Raspberry Pi)
- ❌ Won't work on Apple Silicon Macs (M1/M2/M3) without Rosetta
- ❌ Blocks cloud cost optimization (ARM instances are 20-40% cheaper)
- ❌ Performance penalty on ARM (x86 emulation overhead)

### Fix Option 1: Make Architecture Configurable

```yaml
services:
  freeradius:
    image: freeradius-postgresql:latest
    platform: ${PLATFORM_ARCH:-linux/amd64}  # ✅ Environment variable with default
```

**Add to `.env`**:
```bash
# .env
# Set to linux/arm64 for ARM servers, linux/amd64 for x86
PLATFORM_ARCH=linux/amd64
```

**For ARM deployment**:
```bash
# .env.arm64
PLATFORM_ARCH=linux/arm64
```

### Fix Option 2: Remove Platform Constraint (Recommended)

```yaml
services:
  freeradius:
    image: freeradius-postgresql:latest
    # No platform constraint - Docker automatically uses host architecture
```

**Why Option 2 is better**:
- ✅ Docker automatically uses the host's native architecture
- ✅ No configuration needed
- ✅ Works everywhere (AMD64, ARM64, ARM32)
- ✅ Best performance (no emulation)

**Requirements**:
- Build FreeRADIUS image as multi-arch (see Phase 7.4)

### Fix Option 3: Build Platform-Specific Images

```yaml
services:
  freeradius:
    image: ${FREERADIUS_IMAGE:-freeradius-postgresql:latest}
```

**Build script** for multi-architecture:
```bash
#!/bin/bash
# scripts/build-multiarch.sh

# Build for both AMD64 and ARM64
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t your-registry/freeradius-postgresql:latest \
  -f docker/Dockerfile.freeradius \
  --push \
  .
```

**Testing**:
```bash
# Test on AMD64
PLATFORM_ARCH=linux/amd64 docker-compose up freeradius

# Test on ARM64
PLATFORM_ARCH=linux/arm64 docker-compose up freeradius

# Or remove platform constraint entirely
docker-compose up freeradius  # Uses host architecture
```

---

## Phase 7.2: Local File System Volume Mounts

### Problem: Relative Path Mounts Assume Directory Structure

**Files**: `docker-compose.isp.yml`, `docker-compose.base.yml`

**Current state**:
```yaml
volumes:
  # RADIUS configuration
  - ./config/radius/clients.conf:/etc/freeradius/clients.conf:ro
  - ./config/radius/dictionary:/etc/freeradius/dictionary.local:ro

  # AWX configuration
  - ./config/awx/settings.py:/etc/tower/settings.py:ro

  # Monitoring configurations
  - ./monitoring/prometheus/alertmanager.yml:/etc/alertmanager/alertmanager.yml:ro
  - ./monitoring/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
  - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards:ro

  # Database initialization
  - ./database/init:/docker-entrypoint-initdb.d:ro
```

**Impact**:
- ❌ Deployment fails if these directories/files don't exist
- ❌ Git clone on new server doesn't include generated files
- ❌ CI/CD pipelines may not have these paths
- ❌ Cannot run from a different working directory

### Fix Option 1: Use Named Volumes with Init Containers

**Create ConfigMaps/init scripts instead of file mounts**:

```yaml
# docker-compose.isp.yml
services:
  freeradius:
    image: freeradius-postgresql:latest
    volumes:
      - radius_config:/etc/freeradius  # Named volume, not host mount
    environment:
      - RADIUS_CLIENTS=${RADIUS_CLIENTS}  # Pass config via env
      - RADIUS_SECRET=${RADIUS_SECRET}

volumes:
  radius_config:
    driver: local
```

**Init container pattern** (for Kubernetes migration):
```yaml
# k8s/freeradius-deployment.yaml
spec:
  initContainers:
    - name: config-init
      image: busybox
      command: ['sh', '-c', 'cp /config-template/* /config/']
      volumeMounts:
        - name: config-template
          mountPath: /config-template
        - name: config
          mountPath: /config
  containers:
    - name: freeradius
      volumeMounts:
        - name: config
          mountPath: /etc/freeradius
```

### Fix Option 2: Build Configs into Docker Images

**Create Dockerfile that includes configs**:

```dockerfile
# docker/Dockerfile.freeradius
FROM freeradius/freeradius-server:latest

# Copy configs into image
COPY config/radius/clients.conf /etc/freeradius/clients.conf
COPY config/radius/dictionary /etc/freeradius/dictionary.local

# Allow override via environment variables
ENV RADIUS_SECRET=${RADIUS_SECRET:-changeme}
ENV RADIUS_CLIENT_IP=${RADIUS_CLIENT_IP:-0.0.0.0/0}

# Templating script to replace env vars in config
COPY docker/scripts/config-templater.sh /docker-entrypoint.d/
RUN chmod +x /docker-entrypoint.d/config-templater.sh

CMD ["freeradius", "-f"]
```

**Templater script**:
```bash
#!/bin/bash
# docker/scripts/config-templater.sh

# Replace environment variables in config files
envsubst < /etc/freeradius/clients.conf.template > /etc/freeradius/clients.conf
```

**Update docker-compose.yml**:
```yaml
services:
  freeradius:
    build:
      context: .
      dockerfile: docker/Dockerfile.freeradius
    # No volume mounts needed - configs are in the image
    environment:
      - RADIUS_SECRET=${RADIUS_SECRET}
```

### Fix Option 3: Create Pre-Deployment Validation Script

```bash
#!/bin/bash
# scripts/validate-docker-compose-env.sh

echo "Validating Docker Compose environment..."

# Required directories
REQUIRED_DIRS=(
    "config/radius"
    "config/awx"
    "monitoring/prometheus"
    "monitoring/grafana/dashboards"
    "database/init"
)

# Required files
REQUIRED_FILES=(
    "config/radius/clients.conf"
    "config/radius/dictionary"
    "config/awx/settings.py"
    "monitoring/prometheus/prometheus.yml"
    "monitoring/prometheus/alertmanager.yml"
)

MISSING_DIRS=()
MISSING_FILES=()

# Check directories
for dir in "${REQUIRED_DIRS[@]}"; do
    if [ ! -d "$dir" ]; then
        MISSING_DIRS+=("$dir")
    fi
done

# Check files
for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        MISSING_FILES+=("$file")
    fi
done

if [ ${#MISSING_DIRS[@]} -gt 0 ]; then
    echo "❌ Missing required directories:"
    printf '  - %s\n' "${MISSING_DIRS[@]}"
    echo ""
fi

if [ ${#MISSING_FILES[@]} -gt 0 ]; then
    echo "❌ Missing required files:"
    printf '  - %s\n' "${MISSING_FILES[@]}"
    echo ""
fi

if [ ${#MISSING_DIRS[@]} -gt 0 ] || [ ${#MISSING_FILES[@]} -gt 0 ]; then
    echo "Run: scripts/setup-config-files.sh to create missing files"
    exit 1
fi

echo "✅ All required files and directories exist"
```

**Add setup script**:
```bash
#!/bin/bash
# scripts/setup-config-files.sh

echo "Setting up default configuration files..."

# Create directories
mkdir -p config/radius
mkdir -p config/awx
mkdir -p monitoring/prometheus
mkdir -p monitoring/grafana/dashboards
mkdir -p database/init

# Create default RADIUS clients.conf if missing
if [ ! -f "config/radius/clients.conf" ]; then
    cat > config/radius/clients.conf <<EOF
client localhost {
    ipaddr = 127.0.0.1
    secret = ${RADIUS_SECRET:-changeme}
    require_message_authenticator = no
    nas_type = other
}

client docker_network {
    ipaddr = 172.16.0.0/12
    secret = ${RADIUS_SECRET:-changeme}
    require_message_authenticator = no
}
EOF
fi

# Create default dictionary if missing
if [ ! -f "config/radius/dictionary" ]; then
    curl -o config/radius/dictionary https://raw.githubusercontent.com/FreeRADIUS/freeradius-server/v3.0.x/share/dictionary
fi

# Create default AWX settings if missing
if [ ! -f "config/awx/settings.py" ]; then
    cp config/awx/settings.py.example config/awx/settings.py
fi

# Create default Prometheus config if missing
if [ ! -f "monitoring/prometheus/prometheus.yml" ]; then
    cat > monitoring/prometheus/prometheus.yml <<EOF
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'backend'
    static_configs:
      - targets: ['app:8000']
EOF
fi

echo "✅ Configuration files created successfully"
```

**Update docker-compose startup**:
```bash
# Run validation before starting
./scripts/validate-docker-compose-env.sh || exit 1

# Start services
docker-compose up -d
```

### Recommended Approach

**Use Fix Option 2 (Build into Images)** for production:
- ✅ Images are self-contained
- ✅ No dependency on host filesystem
- ✅ Works in any environment (cloud, on-prem, CI/CD)
- ✅ Version controlled (image tags)

**Use Fix Option 3 (Validation Script)** for development:
- ✅ Faster iteration (no image rebuilds)
- ✅ Clear error messages for missing files
- ✅ Setup script creates defaults

---

## Phase 7.3: Host System Path Mounts

### Problem: Direct Host Access is Insecure and Non-Portable

**File**: `docker-compose.isp.yml:189, 343-371`

**Current state**:
```yaml
services:
  # WireGuard service
  wireguard:
    volumes:
      - /lib/modules:/lib/modules:ro  # ❌ Kernel modules

  # Node Exporter (monitoring)
  node-exporter:
    volumes:
      - /proc:/host/proc:ro           # ❌ Process info
      - /sys:/host/sys:ro             # ❌ System info
      - /:/host:ro                    # ❌ ENTIRE HOST FILESYSTEM

  # cAdvisor (container monitoring)
  cadvisor:
    volumes:
      - /:/rootfs:ro                  # ❌ Root filesystem
      - /var/run:/var/run:ro          # ❌ Docker socket
      - /var/lib/docker:/var/lib/docker:ro  # ❌ Docker data
      - /dev/disk:/dev/disk:ro        # ❌ Disk devices
      - /dev/kmsg                     # ❌ Kernel messages
```

**Impact**:
- ❌ Security risk (container can read entire host filesystem)
- ❌ Doesn't work on non-Linux (macOS, Windows with Docker Desktop)
- ❌ Paths may not exist on different Linux distributions
- ❌ Blocked by security policies on some cloud platforms (GKE Autopilot, Fargate)
- ❌ seLinux/AppArmor conflicts

### Fix Option 1: Remove Host Mounts, Use Remote Agents

**Problem**: These mounts are for monitoring - there are better ways.

**Replace with remote exporters**:

```yaml
# docker-compose.isp.yml
services:
  # node-exporter: REMOVE or deploy as host service
  # cadvisor: REMOVE or deploy as host service

  # Keep only application-level monitoring
  backend:
    image: dotmac-backend:latest
    # Expose Prometheus metrics endpoint
    # No host mounts needed
```

**Deploy node-exporter and cAdvisor on host** (outside Docker Compose):

```bash
# Install node-exporter as systemd service
sudo apt-get install prometheus-node-exporter
sudo systemctl enable prometheus-node-exporter
sudo systemctl start prometheus-node-exporter

# Or use binary download
wget https://github.com/prometheus/node_exporter/releases/download/v1.7.0/node_exporter-1.7.0.linux-amd64.tar.gz
tar xvfz node_exporter-1.7.0.linux-amd64.tar.gz
sudo cp node_exporter-1.7.0.linux-amd64/node_exporter /usr/local/bin/
sudo useradd -rs /bin/false node_exporter

# Create systemd service
cat > /etc/systemd/system/node-exporter.service <<EOF
[Unit]
Description=Node Exporter
After=network.target

[Service]
User=node_exporter
Group=node_exporter
Type=simple
ExecStart=/usr/local/bin/node_exporter

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable node-exporter
sudo systemctl start node-exporter
```

**Update Prometheus config** to scrape host-level metrics:

```yaml
# monitoring/prometheus/prometheus.yml
scrape_configs:
  # Application metrics (in Docker)
  - job_name: 'backend'
    static_configs:
      - targets: ['backend:8000']

  # Host metrics (outside Docker)
  - job_name: 'node'
    static_configs:
      - targets: ['host.docker.internal:9100']  # macOS/Windows
      # OR
      - targets: ['172.17.0.1:9100']  # Linux (Docker bridge IP)
```

### Fix Option 2: Use Docker Socket Proxy (Security Improvement)

**If you must access Docker daemon, use a proxy**:

```yaml
# docker-compose.isp.yml
services:
  docker-socket-proxy:
    image: tecnativa/docker-socket-proxy:latest
    environment:
      - CONTAINERS=1  # Allow read-only container info
      - NETWORKS=0
      - VOLUMES=0
      - IMAGES=0
      - BUILD=0
      - AUTH=0
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    networks:
      - monitoring

  cadvisor:
    image: gcr.io/cadvisor/cadvisor:latest
    # Don't mount Docker socket directly
    # Connect to socket proxy instead
    environment:
      - DOCKER_HOST=tcp://docker-socket-proxy:2375
    networks:
      - monitoring
```

**Benefits**:
- ✅ Limits what cAdvisor can access (read-only containers only)
- ✅ No write access to Docker daemon
- ✅ Auditable (proxy logs all requests)

### Fix Option 3: Kubernetes-Native Monitoring (For K8s Deployment)

**Replace with Kubernetes-native resources**:

```yaml
# k8s/daemonset-node-exporter.yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: node-exporter
spec:
  selector:
    matchLabels:
      app: node-exporter
  template:
    spec:
      hostNetwork: true
      hostPID: true
      containers:
        - name: node-exporter
          image: prom/node-exporter:latest
          args:
            - '--path.procfs=/host/proc'
            - '--path.sysfs=/host/sys'
            - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($|/)'
          volumeMounts:
            - name: proc
              mountPath: /host/proc
              readOnly: true
            - name: sys
              mountPath: /host/sys
              readOnly: true
      volumes:
        - name: proc
          hostPath:
            path: /proc
        - name: sys
          hostPath:
            path: /sys
```

**Why this is better**:
- ✅ Kubernetes controls access (RBAC, PodSecurityPolicy)
- ✅ Runs on every node (DaemonSet)
- ✅ Standard practice for K8s monitoring

### WireGuard Kernel Modules Fix

**Problem**: `/lib/modules` mount for WireGuard

**Fix**: Install WireGuard kernel module on host:

```bash
# Install WireGuard on host
sudo apt-get update
sudo apt-get install wireguard

# Verify module is loaded
sudo modprobe wireguard
lsmod | grep wireguard
```

**Update docker-compose.yml**:
```yaml
services:
  wireguard:
    image: linuxserver/wireguard:latest
    cap_add:
      - NET_ADMIN
      - SYS_MODULE
    sysctls:
      - net.ipv4.conf.all.src_valid_mark=1
    # No /lib/modules mount needed if module is pre-loaded on host
    environment:
      - PUID=1000
      - PGID=1000
```

### Recommended Approach

**For Docker Compose (Development/Small Deployments)**:
- ✅ Use Fix Option 1 (host-level exporters)
- ✅ Keep Docker Compose simple (application containers only)
- ✅ Run monitoring agents on host

**For Kubernetes (Production)**:
- ✅ Use Fix Option 3 (DaemonSets)
- ✅ Leverage Kubernetes RBAC and security policies

---

## Phase 7.4: Custom Docker Images

### Problem: Custom Image Not in Public Registry

**File**: `docker-compose.isp.yml:7`

**Current state**:
```yaml
services:
  freeradius:
    image: freeradius-postgresql:latest  # ❌ Not in any registry
```

**Impact**:
- ❌ Image doesn't exist on new servers - `docker-compose up` fails
- ❌ Cannot deploy to cloud (ECS, GKE, AKS) without registry
- ❌ No version control for images
- ❌ Team members can't pull the image

### Fix: Build and Push to Container Registry

#### Step 1: Create Dockerfile for FreeRADIUS

```dockerfile
# docker/Dockerfile.freeradius
FROM freeradius/freeradius-server:3.2

# Install PostgreSQL client libraries
RUN apt-get update && \
    apt-get install -y postgresql-client libpq-dev && \
    rm -rf /var/lib/apt/lists/*

# Copy configuration files
COPY config/radius/clients.conf /etc/freeradius/clients.conf
COPY config/radius/dictionary /etc/freeradius/dictionary.local

# Environment variables for dynamic configuration
ENV RADIUS_SECRET=changeme
ENV POSTGRES_HOST=postgres
ENV POSTGRES_PORT=5432
ENV POSTGRES_DB=dotmac
ENV POSTGRES_USER=dotmac_user
ENV POSTGRES_PASSWORD=changeme

# SQL module configuration
COPY config/radius/sql.conf /etc/freeradius/mods-available/sql

# Enable SQL module
RUN ln -s /etc/freeradius/mods-available/sql /etc/freeradius/mods-enabled/sql

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD radtest test password localhost 0 $RADIUS_SECRET || exit 1

EXPOSE 1812/udp 1813/udp

CMD ["freeradius", "-f", "-X"]
```

#### Step 2: Build Multi-Architecture Image

```bash
#!/bin/bash
# scripts/build-and-push-freeradius.sh

set -e

REGISTRY="your-registry.example.com"  # Or docker.io/yourusername
IMAGE_NAME="freeradius-postgresql"
VERSION="${1:-latest}"

echo "Building multi-architecture FreeRADIUS image..."

# Create buildx builder if it doesn't exist
docker buildx create --name multiarch-builder --use || true
docker buildx use multiarch-builder

# Build for AMD64 and ARM64
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t ${REGISTRY}/${IMAGE_NAME}:${VERSION} \
  -t ${REGISTRY}/${IMAGE_NAME}:latest \
  -f docker/Dockerfile.freeradius \
  --push \
  .

echo "✅ Image pushed to ${REGISTRY}/${IMAGE_NAME}:${VERSION}"
echo "Available platforms: linux/amd64, linux/arm64"
```

#### Step 3: Update docker-compose.yml

```yaml
# docker-compose.isp.yml
services:
  freeradius:
    image: ${FREERADIUS_IMAGE:-your-registry.example.com/freeradius-postgresql:latest}
    # No platform constraint - automatically uses host architecture
    environment:
      - RADIUS_SECRET=${RADIUS_SECRET}
      - POSTGRES_HOST=postgres
      - POSTGRES_PORT=5432
```

#### Step 4: Setup CI/CD to Build Images

```yaml
# .github/workflows/build-images.yml
name: Build and Push Docker Images

on:
  push:
    branches: [main, develop]
    tags: ['v*']

jobs:
  build-freeradius:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2

      - name: Login to Container Registry
        uses: docker/login-action@v2
        with:
          registry: ${{ secrets.REGISTRY_URL }}
          username: ${{ secrets.REGISTRY_USERNAME }}
          password: ${{ secrets.REGISTRY_PASSWORD }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v4
        with:
          images: ${{ secrets.REGISTRY_URL }}/freeradius-postgresql
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}

      - name: Build and push
        uses: docker/build-push-action@v4
        with:
          context: .
          file: docker/Dockerfile.freeradius
          platforms: linux/amd64,linux/arm64
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### Registry Options

**1. Docker Hub (Public)**:
```bash
docker login
docker tag freeradius-postgresql:latest yourusername/freeradius-postgresql:latest
docker push yourusername/freeradius-postgresql:latest
```

**2. AWS ECR (Private)**:
```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com
docker tag freeradius-postgresql:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/freeradius-postgresql:latest
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/freeradius-postgresql:latest
```

**3. Google GCR (Private)**:
```bash
gcloud auth configure-docker
docker tag freeradius-postgresql:latest gcr.io/your-project-id/freeradius-postgresql:latest
docker push gcr.io/your-project-id/freeradius-postgresql:latest
```

**4. GitHub Container Registry (Free)**:
```bash
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
docker tag freeradius-postgresql:latest ghcr.io/your-org/freeradius-postgresql:latest
docker push ghcr.io/your-org/freeradius-postgresql:latest
```

---

## Phase 7.5: Database Configuration Tuning

### Problem: Hardcoded Memory Settings for Specific Hardware

**File**: `database/init/01-init.sql:16-46`

**Current state**:
```sql
-- Hardcoded tuning for specific server specs
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET work_mem = '4MB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
```

**Impact**:
- ❌ Too high → Out of Memory (OOM) kills on small VMs
- ❌ Too low → Poor performance on large servers
- ❌ Not optimized for cloud (e.g., AWS RDS, Google Cloud SQL)
- ❌ One-size-fits-all doesn't work

### Fix Option 1: Environment-Based Tuning

```sql
-- database/init/01-init-tuned.sql
-- Dynamic configuration based on environment variables

-- Shared buffers (25% of RAM is recommended)
ALTER SYSTEM SET shared_buffers = COALESCE(current_setting('dotmac.shared_buffers', true), '256MB');

-- Effective cache size (50-75% of RAM)
ALTER SYSTEM SET effective_cache_size = COALESCE(current_setting('dotmac.effective_cache_size', true), '1GB');

-- Max connections
ALTER SYSTEM SET max_connections = COALESCE(current_setting('dotmac.max_connections', true)::integer, 200);

-- Work mem (RAM / max_connections / 4)
ALTER SYSTEM SET work_mem = COALESCE(current_setting('dotmac.work_mem', true), '4MB');

-- Maintenance work mem (RAM / 16)
ALTER SYSTEM SET maintenance_work_mem = COALESCE(current_setting('dotmac.maintenance_work_mem', true), '64MB');
```

**Update docker-compose.yml**:
```yaml
services:
  postgres:
    image: postgres:15
    environment:
      - POSTGRES_INITDB_ARGS=-c shared_buffers=${DB_SHARED_BUFFERS:-256MB} -c effective_cache_size=${DB_CACHE_SIZE:-1GB}
    command: >
      postgres
      -c shared_buffers=${DB_SHARED_BUFFERS:-256MB}
      -c effective_cache_size=${DB_CACHE_SIZE:-1GB}
      -c max_connections=${DB_MAX_CONNECTIONS:-200}
      -c work_mem=${DB_WORK_MEM:-4MB}
```

**Create environment-specific configs**:

```bash
# .env.small (2GB RAM)
DB_SHARED_BUFFERS=512MB
DB_CACHE_SIZE=1536MB
DB_MAX_CONNECTIONS=100
DB_WORK_MEM=5MB

# .env.medium (8GB RAM)
DB_SHARED_BUFFERS=2GB
DB_CACHE_SIZE=6GB
DB_MAX_CONNECTIONS=200
DB_WORK_MEM=10MB

# .env.large (32GB RAM)
DB_SHARED_BUFFERS=8GB
DB_CACHE_SIZE=24GB
DB_MAX_CONNECTIONS=500
DB_WORK_MEM=16MB
```

### Fix Option 2: Auto-Detection Script

```bash
#!/bin/bash
# scripts/generate-db-config.sh

# Auto-detect server resources and generate optimal PostgreSQL config

TOTAL_RAM_MB=$(free -m | awk '/^Mem:/{print $2}')
CPU_CORES=$(nproc)

echo "Detected: ${TOTAL_RAM_MB}MB RAM, ${CPU_CORES} CPU cores"

# Calculate optimal settings
SHARED_BUFFERS=$((TOTAL_RAM_MB / 4))  # 25% of RAM
EFFECTIVE_CACHE=$((TOTAL_RAM_MB * 3 / 4))  # 75% of RAM
MAX_CONNECTIONS=$((CPU_CORES * 50))  # 50 connections per core
WORK_MEM=$((TOTAL_RAM_MB / MAX_CONNECTIONS / 4))
MAINTENANCE_WORK_MEM=$((TOTAL_RAM_MB / 16))

# Cap max connections at 500
if [ $MAX_CONNECTIONS -gt 500 ]; then
    MAX_CONNECTIONS=500
fi

# Generate .env file
cat > .env.db <<EOF
# Auto-generated PostgreSQL configuration
# Total RAM: ${TOTAL_RAM_MB}MB, CPU Cores: ${CPU_CORES}
# Generated: $(date)

DB_SHARED_BUFFERS=${SHARED_BUFFERS}MB
DB_CACHE_SIZE=${EFFECTIVE_CACHE}MB
DB_MAX_CONNECTIONS=${MAX_CONNECTIONS}
DB_WORK_MEM=${WORK_MEM}MB
DB_MAINTENANCE_WORK_MEM=${MAINTENANCE_WORK_MEM}MB
EOF

echo "✅ PostgreSQL configuration written to .env.db"
echo "Load with: docker-compose --env-file .env.db up"
```

**Usage**:
```bash
# Generate config based on server specs
./scripts/generate-db-config.sh

# Review generated config
cat .env.db

# Use generated config
docker-compose --env-file .env --env-file .env.db up postgres
```

### Fix Option 3: Use PGTune Recommendations

```bash
#!/bin/bash
# scripts/pgtune.sh

# Generate PostgreSQL config using pgtune algorithm

TOTAL_RAM_MB=$1
DB_TYPE=${2:-web}  # web, oltp, dw, desktop, mixed

if [ -z "$TOTAL_RAM_MB" ]; then
    echo "Usage: $0 <total_ram_mb> [db_type]"
    echo "  db_type: web, oltp, dw (data warehouse), desktop, mixed"
    exit 1
fi

# pgtune formula: https://pgtune.leopard.in.ua/
case $DB_TYPE in
    web)
        SHARED_BUFFERS=$((TOTAL_RAM_MB / 4))
        EFFECTIVE_CACHE=$((TOTAL_RAM_MB * 3 / 4))
        MAX_CONNECTIONS=200
        ;;
    oltp)
        SHARED_BUFFERS=$((TOTAL_RAM_MB / 4))
        EFFECTIVE_CACHE=$((TOTAL_RAM_MB * 3 / 4))
        MAX_CONNECTIONS=300
        ;;
    dw)
        SHARED_BUFFERS=$((TOTAL_RAM_MB / 4))
        EFFECTIVE_CACHE=$((TOTAL_RAM_MB * 3 / 4))
        MAX_CONNECTIONS=40
        ;;
esac

cat <<EOF
# PostgreSQL Configuration for ${DB_TYPE} (${TOTAL_RAM_MB}MB RAM)
DB_SHARED_BUFFERS=${SHARED_BUFFERS}MB
DB_CACHE_SIZE=${EFFECTIVE_CACHE}MB
DB_MAX_CONNECTIONS=${MAX_CONNECTIONS}
EOF
```

**Usage**:
```bash
# For 4GB RAM server (web workload)
./scripts/pgtune.sh 4096 web > .env.db

# For 16GB RAM server (OLTP workload)
./scripts/pgtune.sh 16384 oltp > .env.db
```

### Recommended Approach

**Use Fix Option 2 (Auto-Detection)** for:
- ✅ Automated deployments
- ✅ Unknown server specs
- ✅ Dynamic scaling environments

**Use Fix Option 1 (Environment Variables)** for:
- ✅ Controlled environments (you know the specs)
- ✅ Kubernetes (resource requests/limits)
- ✅ Manual tuning and optimization

---

## Phase 7.6: Storage Path Configuration

### Problem: Ephemeral /tmp Storage

**File**: `src/dotmac/platform/settings.py:1245`

**Current state**:
```python
local_path: str = Field(
    "/tmp/storage",  # Development default
    description="Local storage path for dev",
)
```

**Impact**:
- ❌ `/tmp` is cleared on reboot (files lost)
- ❌ Shared /tmp in multi-tenant deployments (security risk)
- ❌ No size limits (can fill disk)

### Fix: Use Persistent Volumes

**Update settings.py**:
```python
def get_storage_path() -> str:
    """Get storage path based on deployment environment"""
    deployment_env = os.getenv("DEPLOYMENT_ENV", "docker")

    if deployment_env == "kubernetes":
        # Kubernetes PersistentVolume
        return os.getenv("FILE_STORAGE_PATH", "/var/lib/dotmac/storage")
    elif deployment_env == "docker":
        # Docker named volume
        return os.getenv("FILE_STORAGE_PATH", "/app/storage")
    else:
        # Development
        return os.getenv("FILE_STORAGE_PATH", "/tmp/storage")

class FileStorageSettings(BaseSettings):
    local_path: str = Field(
        default_factory=get_storage_path,
        description="Local storage path",
    )
```

**Update docker-compose.yml**:
```yaml
services:
  backend:
    volumes:
      - upload_storage:/app/storage  # Named volume, not /tmp
    environment:
      - FILE_STORAGE_PATH=/app/storage

volumes:
  upload_storage:
    driver: local
```

---

## Testing & Validation

### Multi-Architecture Testing

```bash
# Test on AMD64
docker-compose up --build

# Test on ARM64 (if available)
docker-compose up --build

# Test with emulation (AMD64 on ARM or vice versa)
docker-compose --env-file .env.arm64 up
```

### Pre-Deployment Checklist

```bash
#!/bin/bash
# scripts/docker-compose-pre-flight.sh

echo "Running pre-flight checks..."

# 1. Check for hardcoded platform
if grep -q "platform: linux/amd64" docker-compose*.yml; then
    echo "⚠️  WARNING: Hardcoded platform architecture found"
fi

# 2. Check for relative path mounts
if grep -q "\./config" docker-compose*.yml; then
    echo "⚠️  WARNING: Relative path mounts found"
    ./scripts/validate-docker-compose-env.sh
fi

# 3. Check for host path mounts
if grep -q "- /:" docker-compose*.yml; then
    echo "⚠️  WARNING: Host filesystem mounts found"
fi

# 4. Check custom images are in registry
IMAGES=$(grep "image:" docker-compose.isp.yml | awk '{print $2}' | grep -v ":" | head -5)
for img in $IMAGES; do
    if ! docker manifest inspect $img > /dev/null 2>&1; then
        echo "❌ ERROR: Image not found in registry: $img"
    fi
done

# 5. Validate database config
if [ -z "$DB_SHARED_BUFFERS" ]; then
    echo "⚠️  WARNING: DB_SHARED_BUFFERS not set. Run: ./scripts/generate-db-config.sh"
fi

echo "✅ Pre-flight checks complete"
```

---

## Summary: Before and After

### Before Remediation ❌

```yaml
# docker-compose.isp.yml
services:
  freeradius:
    image: freeradius-postgresql:latest  # ❌ Custom image, not in registry
    platform: linux/amd64                 # ❌ Hardcoded architecture
    volumes:
      - ./config/radius/clients.conf:/etc/freeradius/clients.conf  # ❌ Local path

  node-exporter:
    volumes:
      - /:/host:ro  # ❌ Entire host filesystem

  postgres:
    volumes:
      - ./database/init:/docker-entrypoint-initdb.d  # ❌ Local path
    # Database config hardcoded in init SQL  # ❌ Not configurable
```

### After Remediation ✅

```yaml
# docker-compose.isp.yml
services:
  freeradius:
    image: ${FREERADIUS_IMAGE:-ghcr.io/your-org/freeradius-postgresql:latest}  # ✅ In registry
    # No platform constraint  # ✅ Auto-detects architecture
    # No volume mounts  # ✅ Configs built into image

  # node-exporter: removed from docker-compose  # ✅ Runs on host

  postgres:
    image: postgres:15
    command: >
      postgres
      -c shared_buffers=${DB_SHARED_BUFFERS:-256MB}
      -c max_connections=${DB_MAX_CONNECTIONS:-200}
    # ✅ Configurable via environment
    volumes:
      - postgres_data:/var/lib/postgresql/data  # ✅ Named volume

volumes:
  postgres_data:
```

---

## Implementation Timeline

**Week 1** - Critical Container Fixes:
- [ ] Phase 7.1: Remove or make platform constraint configurable
- [ ] Phase 7.2: Build configs into Docker images (Option 2)
- [ ] Phase 7.4: Build and push FreeRADIUS image to registry

**Week 2** - Security & Portability:
- [ ] Phase 7.3: Remove host path mounts, use host-level exporters
- [ ] Phase 7.5: Auto-detection script for database tuning
- [ ] Phase 7.6: Fix storage paths to use persistent volumes

**Week 3** - Validation & Testing:
- [ ] Create pre-flight check script
- [ ] Test on AMD64 and ARM64 (if available)
- [ ] Deploy to staging environment
- [ ] Update CI/CD to build multi-arch images

---

## Related Documents

- **`BACKEND_DEPLOYMENT_REMEDIATION.md`** - General backend configuration fixes
- **`docker-compose.isp.yml`** - ISP services Docker Compose
- **`docker-compose.base.yml`** - Base services Docker Compose
- **`INGRESS_AND_REVERSE_PROXY.md`** - Networking and multi-tenancy

---

**Document Version**: 1.0
**Last Updated**: 2025-01-04
**Status**: Ready for Implementation
