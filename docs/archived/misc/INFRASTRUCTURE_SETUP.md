# ISP Platform - Infrastructure Setup Guide

**Version:** 1.0
**Date:** 2025-10-14
**Owner:** DevOps Team (Team P2)

## Overview

This document provides complete instructions for setting up the ISP Operations Platform infrastructure using Docker and Docker Compose (for development/single-server) and Kubernetes (for production).

All external services run as Docker containers for easy deployment, isolation, and scalability.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Docker Images](#docker-images)
3. [Development Setup (Docker Compose)](#development-setup-docker-compose)
4. [Production Setup (Kubernetes)](#production-setup-kubernetes)
5. [Service Configuration](#service-configuration)
6. [Monitoring & Observability](#monitoring--observability)
7. [Backup & Disaster Recovery](#backup--disaster-recovery)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Hardware Requirements

**Development (Single Server):**
- CPU: 8 cores
- RAM: 32 GB
- Disk: 500 GB SSD
- Network: 1 Gbps

**Production (Per Node):**
- CPU: 16+ cores
- RAM: 64+ GB
- Disk: 1+ TB NVMe SSD
- Network: 10 Gbps

### Software Requirements

**All Environments:**
```bash
# Operating System
Ubuntu 22.04 LTS or later (recommended)
# OR
Rocky Linux 9 / AlmaLinux 9

# Docker
Docker Engine 24+
Docker Compose v2.20+

# For production
Kubernetes 1.28+
kubectl
Helm 3.12+

# Tools
git
curl
jq
openssl
```

### Installation Commands

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose
sudo apt install docker-compose-plugin

# Verify
docker --version
docker compose version

# For Kubernetes (production)
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
kubectl version --client

# Install Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
helm version
```

---

## Docker Images

All external services are deployed as Docker containers:

| Service | Docker Image | Version | Purpose |
|---------|--------------|---------|---------|
| **PostgreSQL** | `postgres` | 14-alpine | Primary database |
| **Redis** | `redis` | 7-alpine | Cache & message broker |
| **TimescaleDB** | `timescale/timescaledb` | latest-pg14 | Time-series metrics |
| **MongoDB** | `mongo` | 6 | GenieACS backend |
| **MinIO** | `minio/minio` | latest | Object storage (S3-compatible) |
| **Elasticsearch** | `elasticsearch` | 8.11.0 | Search & logs |
| **FreeRADIUS** | `freeradius/freeradius-server` | latest | AAA server |
| **NetBox** | `netboxcommunity/netbox` | latest | Network inventory (IPAM/DCIM) |
| **VOLTHA** | `voltha/voltha-rw-core` | latest | OLT management |
| **GenieACS** | `drumsergio/genieacs` | latest | TR-069 ACS server |
| **WireGuard** | `linuxserver/wireguard` | latest | VPN gateway |
| **LibreNMS** | `librenms/librenms` | latest | Network monitoring |
| **Ansible AWX** | `ansible/awx` | latest | Automation platform |
| **Prometheus** | `prom/prometheus` | latest | Metrics collection |
| **Grafana** | `grafana/grafana` | latest | Dashboards |
| **Jaeger** | `jaegertracing/all-in-one` | latest | Distributed tracing |

---

## Development Setup (Docker Compose)

### Directory Structure

```
dotmac-isp-ops/
├── docker-compose.yml                    # Core services (Postgres, Redis, etc.)
├── docker-compose.isp.yml                # ISP-specific services
├── docker-compose.monitoring.yml         # Monitoring stack
├── config/
│   ├── radius/
│   │   ├── clients.conf
│   │   ├── sql.conf
│   │   └── radiusd.conf
│   ├── nginx/
│   │   └── nginx.conf
│   ├── prometheus/
│   │   └── prometheus.yml
│   └── grafana/
│       ├── dashboards/
│       └── datasources/
├── scripts/
│   ├── init-db.sh
│   ├── seed-data.sh
│   └── backup.sh
└── volumes/                              # Persistent data (gitignored)
    ├── postgres/
    ├── redis/
    ├── minio/
    └── ...
```

### Core Services (docker-compose.yml)

```yaml
version: '3.8'

services:
  # PostgreSQL - Primary Database
  postgres:
    image: postgres:14-alpine
    container_name: isp-postgres
    environment:
      POSTGRES_USER: dotmac_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: dotmac
      POSTGRES_INITDB_ARGS: "-E UTF8 --locale=en_US.UTF-8"
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sh:/docker-entrypoint-initdb.d/init-db.sh
    networks:
      - isp-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dotmac_user"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  # Redis - Cache & Message Broker
  redis:
    image: redis:7-alpine
    container_name: isp-redis
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - isp-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
    restart: unless-stopped

  # MinIO - S3-Compatible Object Storage
  minio:
    image: minio/minio:latest
    container_name: isp-minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER:-minioadmin}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    ports:
      - "9000:9000"   # API
      - "9001:9001"   # Console
    volumes:
      - minio_data:/data
    networks:
      - isp-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped

  # TimescaleDB - Time-Series Metrics
  timescaledb:
    image: timescale/timescaledb:latest-pg14
    container_name: isp-timescaledb
    environment:
      POSTGRES_USER: timescale_user
      POSTGRES_PASSWORD: ${TIMESCALE_PASSWORD}
      POSTGRES_DB: metrics
    ports:
      - "5433:5432"
    volumes:
      - timescale_data:/var/lib/postgresql/data
    networks:
      - isp-network
    restart: unless-stopped

  # Elasticsearch - Search & Logs
  elasticsearch:
    image: elasticsearch:8.11.0
    container_name: isp-elasticsearch
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms1g -Xmx1g"
    ports:
      - "9200:9200"
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data
    networks:
      - isp-network
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
  minio_data:
  timescale_data:
  elasticsearch_data:

networks:
  isp-network:
    driver: bridge
```

### ISP Services (docker-compose.isp.yml)

```yaml
version: '3.8'

services:
  # FreeRADIUS - AAA Server
  freeradius:
    image: freeradius/freeradius-server:latest
    container_name: isp-freeradius
    environment:
      - RADIUS_DB_TYPE=postgresql
      - RADIUS_DB_HOST=postgres
      - RADIUS_DB_PORT=5432
      - RADIUS_DB_NAME=dotmac
      - RADIUS_DB_USER=dotmac_user
      - RADIUS_DB_PASSWORD=${POSTGRES_PASSWORD}
    ports:
      - "1812:1812/udp"   # RADIUS Auth
      - "1813:1813/udp"   # RADIUS Accounting
      - "18120:18120"     # Status server
    volumes:
      - ./config/radius/clients.conf:/etc/raddb/clients.conf
      - ./config/radius/sql.conf:/etc/raddb/mods-available/sql
      - ./config/radius/radiusd.conf:/etc/raddb/radiusd.conf
      - radius_logs:/var/log/radius
    networks:
      - isp-network
    depends_on:
      - postgres
    restart: unless-stopped

  # NetBox - Network Inventory (IPAM/DCIM)
  netbox:
    image: netboxcommunity/netbox:latest
    container_name: isp-netbox
    environment:
      - DB_HOST=postgres
      - DB_NAME=netbox
      - DB_USER=dotmac_user
      - DB_PASSWORD=${POSTGRES_PASSWORD}
      - REDIS_HOST=redis
      - REDIS_PASSWORD=${REDIS_PASSWORD}
      - SECRET_KEY=${NETBOX_SECRET_KEY}
      - SUPERUSER_NAME=admin
      - SUPERUSER_EMAIL=admin@example.com
      - SUPERUSER_PASSWORD=${NETBOX_ADMIN_PASSWORD}
    ports:
      - "8080:8080"
    volumes:
      - netbox_media:/opt/netbox/netbox/media
      - netbox_reports:/opt/netbox/netbox/reports
      - netbox_scripts:/opt/netbox/netbox/scripts
    networks:
      - isp-network
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  # NetBox Worker (for background tasks)
  netbox-worker:
    image: netboxcommunity/netbox:latest
    container_name: isp-netbox-worker
    entrypoint: /opt/netbox/venv/bin/python /opt/netbox/netbox/manage.py rqworker
    environment:
      - DB_HOST=postgres
      - DB_NAME=netbox
      - DB_USER=dotmac_user
      - DB_PASSWORD=${POSTGRES_PASSWORD}
      - REDIS_HOST=redis
      - REDIS_PASSWORD=${REDIS_PASSWORD}
      - SECRET_KEY=${NETBOX_SECRET_KEY}
    networks:
      - isp-network
    depends_on:
      - netbox
    restart: unless-stopped

  # MongoDB - for GenieACS
  mongodb:
    image: mongo:6
    container_name: isp-mongodb
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_USER}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD}
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    networks:
      - isp-network
    restart: unless-stopped

  # GenieACS - TR-069 ACS Server
  genieacs:
    image: drumsergio/genieacs:latest
    container_name: isp-genieacs
    environment:
      - GENIEACS_CWMP_ACCESS_LOG_FILE=/var/log/genieacs/cwmp-access.log
      - GENIEACS_NBI_ACCESS_LOG_FILE=/var/log/genieacs/nbi-access.log
      - GENIEACS_FS_ACCESS_LOG_FILE=/var/log/genieacs/fs-access.log
      - GENIEACS_UI_ACCESS_LOG_FILE=/var/log/genieacs/ui-access.log
      - GENIEACS_DEBUG_FILE=/var/log/genieacs/debug.yaml
      - GENIEACS_MONGODB_CONNECTION_URL=mongodb://${MONGO_USER}:${MONGO_PASSWORD}@mongodb:27017/genieacs?authSource=admin
    ports:
      - "7547:7547"   # TR-069 CWMP
      - "7557:7557"   # NBI (REST API)
      - "7567:7567"   # Web UI
      - "7577:7577"   # File Server
    volumes:
      - genieacs_logs:/var/log/genieacs
      - genieacs_config:/opt/genieacs/config
    networks:
      - isp-network
    depends_on:
      - mongodb
    restart: unless-stopped

  # WireGuard VPN Gateway
  wireguard:
    image: linuxserver/wireguard:latest
    container_name: isp-wireguard
    cap_add:
      - NET_ADMIN
      - SYS_MODULE
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=UTC
      - SERVERURL=${WG_SERVER_URL}
      - SERVERPORT=51820
      - PEERS=${WG_PEERS:-10}
      - PEERDNS=auto
      - INTERNAL_SUBNET=10.200.0.0/16
    ports:
      - "51820:51820/udp"
    volumes:
      - wireguard_config:/config
      - /lib/modules:/lib/modules
    sysctls:
      - net.ipv4.conf.all.src_valid_mark=1
    networks:
      - isp-network
    restart: unless-stopped

  # LibreNMS - Network Monitoring
  librenms:
    image: librenms/librenms:latest
    container_name: isp-librenms
    hostname: librenms
    cap_add:
      - NET_ADMIN
      - NET_RAW
    environment:
      - TZ=UTC
      - PUID=1000
      - PGID=1000
      - DB_HOST=postgres
      - DB_NAME=librenms
      - DB_USER=dotmac_user
      - DB_PASSWORD=${POSTGRES_PASSWORD}
      - DB_TIMEOUT=60
    ports:
      - "8000:8000"
    volumes:
      - librenms_data:/data
    networks:
      - isp-network
    depends_on:
      - postgres
    restart: unless-stopped

  # Ansible AWX - Automation Platform
  awx-web:
    image: ansible/awx:latest
    container_name: isp-awx-web
    hostname: awxweb
    user: "0"
    environment:
      - DATABASE_HOST=postgres
      - DATABASE_NAME=awx
      - DATABASE_USER=dotmac_user
      - DATABASE_PASSWORD=${POSTGRES_PASSWORD}
      - DATABASE_PORT=5432
      - AWX_ADMIN_USER=admin
      - AWX_ADMIN_PASSWORD=${AWX_ADMIN_PASSWORD}
      - SECRET_KEY=${AWX_SECRET_KEY}
    ports:
      - "8052:8052"
    volumes:
      - awx_projects:/var/lib/awx/projects
      - awx_rsyslog:/var/lib/awx/rsyslog
    networks:
      - isp-network
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  # AWX Task Manager
  awx-task:
    image: ansible/awx:latest
    container_name: isp-awx-task
    hostname: awx
    user: "0"
    command: /usr/bin/launch_awx_task.sh
    environment:
      - DATABASE_HOST=postgres
      - DATABASE_NAME=awx
      - DATABASE_USER=dotmac_user
      - DATABASE_PASSWORD=${POSTGRES_PASSWORD}
      - AWX_ADMIN_USER=admin
      - AWX_ADMIN_PASSWORD=${AWX_ADMIN_PASSWORD}
      - SECRET_KEY=${AWX_SECRET_KEY}
    volumes:
      - awx_projects:/var/lib/awx/projects
      - awx_rsyslog:/var/lib/awx/rsyslog
    networks:
      - isp-network
    depends_on:
      - awx-web
    restart: unless-stopped

volumes:
  radius_logs:
  netbox_media:
  netbox_reports:
  netbox_scripts:
  mongodb_data:
  genieacs_logs:
  genieacs_config:
  wireguard_config:
  librenms_data:
  awx_projects:
  awx_rsyslog:

networks:
  isp-network:
    external: true
```

### Monitoring Stack (docker-compose.monitoring.yml)

```yaml
version: '3.8'

services:
  # Prometheus - Metrics Collection
  prometheus:
    image: prom/prometheus:latest
    container_name: isp-prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--storage.tsdb.retention.time=30d'
      - '--web.enable-lifecycle'
    ports:
      - "9090:9090"
    volumes:
      - ./config/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - ./config/prometheus/alerts.yml:/etc/prometheus/alerts.yml
      - prometheus_data:/prometheus
    networks:
      - isp-network
    restart: unless-stopped

  # Grafana - Dashboards
  grafana:
    image: grafana/grafana:latest
    container_name: isp-grafana
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
      - GF_INSTALL_PLUGINS=grafana-clock-panel,grafana-worldmap-panel
    ports:
      - "3000:3000"
    volumes:
      - grafana_data:/var/lib/grafana
      - ./config/grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./config/grafana/datasources:/etc/grafana/provisioning/datasources
    networks:
      - isp-network
    depends_on:
      - prometheus
    restart: unless-stopped

  # Jaeger - Distributed Tracing
  jaeger:
    image: jaegertracing/all-in-one:latest
    container_name: isp-jaeger
    environment:
      - COLLECTOR_ZIPKIN_HOST_PORT=:9411
    ports:
      - "5775:5775/udp"   # zipkin.thrift compact
      - "6831:6831/udp"   # jaeger.thrift compact
      - "6832:6832/udp"   # jaeger.thrift binary
      - "5778:5778"       # serve configs
      - "16686:16686"     # UI
      - "14268:14268"     # jaeger.thrift directly
      - "14250:14250"     # model.proto
      - "9411:9411"       # zipkin
    networks:
      - isp-network
    restart: unless-stopped

  # Alertmanager - Alert Management
  alertmanager:
    image: prom/alertmanager:latest
    container_name: isp-alertmanager
    command:
      - '--config.file=/etc/alertmanager/config.yml'
      - '--storage.path=/alertmanager'
    ports:
      - "9093:9093"
    volumes:
      - ./config/alertmanager/config.yml:/etc/alertmanager/config.yml
      - alertmanager_data:/alertmanager
    networks:
      - isp-network
    restart: unless-stopped

volumes:
  prometheus_data:
  grafana_data:
  alertmanager_data:

networks:
  isp-network:
    external: true
```

### Environment Variables (.env)

```bash
# Create .env file in project root
cat > .env << 'EOF'
# PostgreSQL
POSTGRES_PASSWORD=changeme_secure_password

# Redis
REDIS_PASSWORD=changeme_redis_password

# MinIO
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=changeme_minio_password

# TimescaleDB
TIMESCALE_PASSWORD=changeme_timescale_password

# MongoDB
MONGO_USER=admin
MONGO_PASSWORD=changeme_mongo_password

# NetBox
NETBOX_SECRET_KEY=changeme_secret_key_50chars
NETBOX_ADMIN_PASSWORD=changeme_netbox_admin

# WireGuard
WG_SERVER_URL=vpn.yourdomain.com
WG_PEERS=50

# AWX
AWX_ADMIN_PASSWORD=changeme_awx_admin
AWX_SECRET_KEY=changeme_awx_secret

# Grafana
GRAFANA_PASSWORD=changeme_grafana_admin
EOF

# Secure the file
chmod 600 .env
```

### Starting the Stack

```bash
# Create network
docker network create isp-network

# Start core services
docker compose up -d

# Start ISP services
docker compose -f docker-compose.isp.yml up -d

# Start monitoring
docker compose -f docker-compose.monitoring.yml up -d

# Check status
docker compose ps
docker compose -f docker-compose.isp.yml ps
docker compose -f docker-compose.monitoring.yml ps

# View logs
docker compose logs -f
docker compose -f docker-compose.isp.yml logs -f freeradius
docker compose -f docker-compose.isp.yml logs -f netbox

# Stop everything
docker compose down
docker compose -f docker-compose.isp.yml down
docker compose -f docker-compose.monitoring.yml down
```

---

## Service Configuration

### FreeRADIUS Configuration

**config/radius/clients.conf:**
```conf
# Network Access Servers (Routers) that can query RADIUS

# MikroTik Router Example
client mikrotik_router1 {
    ipaddr = 10.0.1.1
    secret = shared_secret_here
    nastype = mikrotik
    shortname = router1
}

# Cisco Router Example
client cisco_bng {
    ipaddr = 10.0.2.1
    secret = cisco_secret_here
    nastype = cisco
    shortname = bng1
}

# Allow localhost (for testing)
client localhost {
    ipaddr = 127.0.0.1
    secret = testing123
    nastype = other
}

# Dynamic clients from database
client dynamic {
    ipaddr = 0.0.0.0/0
    proto = *
    secret = radsec
    dynamic_clients = dynamic_clients
}
```

**config/radius/sql.conf:**
```conf
sql {
    driver = "rlm_sql_postgresql"
    dialect = "postgresql"

    server = "${RADIUS_DB_HOST}"
    port = ${RADIUS_DB_PORT}
    login = "${RADIUS_DB_USER}"
    password = "${RADIUS_DB_PASSWORD}"
    radius_db = "${RADIUS_DB_NAME}"

    # Connection pool
    pool {
        start = 5
        min = 4
        max = 32
        spare = 3
        uses = 0
        lifetime = 0
        idle_timeout = 60
        retry_delay = 1
    }

    # Database schema
    read_clients = yes
    client_table = "nas"

    # Authorization
    authorize_check_query = "\
        SELECT id, username, attribute, value, op \
        FROM ${authcheck_table} \
        WHERE username = '%{SQL-User-Name}' \
        AND tenant_id = '%{Tenant-ID}' \
        ORDER BY id"

    # Accounting
    accounting {
        reference = "%{tolower:type.%{Acct-Status-Type}.query}"

        type {
            start {
                query = "\
                    INSERT INTO ${acct_table1} \
                    (acctsessionid, username, nasipaddress, framedipaddress, \
                     acctstarttime, tenant_id) \
                    VALUES \
                    ('%{Acct-Session-Id}', '%{SQL-User-Name}', \
                     '%{NAS-IP-Address}', '%{Framed-IP-Address}', \
                     NOW(), '%{Tenant-ID}')"
            }

            stop {
                query = "\
                    UPDATE ${acct_table1} \
                    SET acctstoptime = NOW(), \
                        acctsessiontime = %{Acct-Session-Time}, \
                        acctinputoctets = %{Acct-Input-Octets}, \
                        acctoutputoctets = %{Acct-Output-Octets}, \
                        acctterminatecause = '%{Acct-Terminate-Cause}' \
                    WHERE acctsessionid = '%{Acct-Session-Id}' \
                    AND username = '%{SQL-User-Name}' \
                    AND tenant_id = '%{Tenant-ID}' \
                    AND acctstoptime IS NULL"
            }
        }
    }
}
```

### NetBox Configuration

NetBox will auto-create its database on first run. Access the web UI at `http://localhost:8080` with credentials from `.env`.

**Initial Setup:**
```bash
# Wait for NetBox to be ready
docker compose -f docker-compose.isp.yml logs -f netbox | grep "Listening at"

# Access UI
open http://localhost:8080

# Login with credentials from .env
# SUPERUSER_NAME / SUPERUSER_PASSWORD
```

### GenieACS Configuration

**Access GenieACS:**
```bash
# Web UI
open http://localhost:7567

# REST API
curl http://localhost:7557/devices

# TR-069 ACS endpoint (for CPE to connect)
# http://your-server-ip:7547
```

**Configure CPE to use ACS:**
On the CPE/ONT, set:
- ACS URL: `http://your-server-ip:7547`
- ACS Username: (optional)
- ACS Password: (optional)

### WireGuard VPN Configuration

**Generate peer configs:**
```bash
# Configs are auto-generated in wireguard_config volume
docker compose -f docker-compose.isp.yml exec wireguard cat /config/peer1/peer1.conf

# Example output:
[Interface]
PrivateKey = <private-key>
Address = 10.200.0.2/32
DNS = 10.200.0.1

[Peer]
PublicKey = <server-public-key>
Endpoint = vpn.yourdomain.com:51820
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
```

---

## Production Setup (Kubernetes)

For production, use Kubernetes with Helm charts.

### Prerequisites

```bash
# Kubernetes cluster (EKS, GKE, AKS, or on-prem)
kubectl cluster-info

# Install Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Add Helm repositories
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update
```

### Deploy Core Services

```bash
# Create namespace
kubectl create namespace isp-platform

# PostgreSQL (High Availability)
helm install postgres bitnami/postgresql-ha \
  --namespace isp-platform \
  --set postgresqlPassword=changeme \
  --set persistence.size=100Gi \
  --set metrics.enabled=true

# Redis (HA with Sentinel)
helm install redis bitnami/redis \
  --namespace isp-platform \
  --set auth.password=changeme \
  --set master.persistence.size=10Gi \
  --set replica.replicaCount=2 \
  --set sentinel.enabled=true

# MinIO
helm install minio bitnami/minio \
  --namespace isp-platform \
  --set auth.rootPassword=changeme \
  --set persistence.size=500Gi \
  --set mode=distributed \
  --set statefulset.replicaCount=4
```

### Deploy ISP Services

See `k8s/` directory for Kubernetes manifests (to be created in separate docs).

---

## Monitoring & Observability

### Access Dashboards

| Service | URL | Default Credentials |
|---------|-----|---------------------|
| Grafana | http://localhost:3000 | admin / ${GRAFANA_PASSWORD} |
| Prometheus | http://localhost:9090 | (none) |
| Jaeger | http://localhost:16686 | (none) |
| NetBox | http://localhost:8080 | admin / ${NETBOX_ADMIN_PASSWORD} |
| GenieACS | http://localhost:7567 | (none) |
| LibreNMS | http://localhost:8000 | librenms / librenms (first time) |
| AWX | http://localhost:8052 | admin / ${AWX_ADMIN_PASSWORD} |

### Grafana Dashboard Import

Pre-built dashboards are available in `config/grafana/dashboards/`.

**Import via UI:**
1. Login to Grafana
2. Click "+" → "Import"
3. Upload JSON file or paste dashboard ID
4. Select Prometheus datasource

**Recommended Dashboards:**
- Node Exporter Full (ID: 1860) - Server metrics
- PostgreSQL Database (ID: 9628)
- Redis Dashboard (ID: 11835)
- NGINX Ingress (ID: 9614)

---

## Backup & Disaster Recovery

### Automated Backups

**scripts/backup.sh:**
```bash
#!/bin/bash
set -e

BACKUP_DIR="/backups/$(date +%Y-%m-%d)"
mkdir -p "$BACKUP_DIR"

# PostgreSQL backup
docker compose exec -T postgres pg_dumpall -U dotmac_user | gzip > "$BACKUP_DIR/postgres.sql.gz"

# NetBox backup
docker compose -f docker-compose.isp.yml exec -T netbox python3 /opt/netbox/netbox/manage.py dumpdata > "$BACKUP_DIR/netbox.json"

# GenieACS MongoDB backup
docker compose -f docker-compose.isp.yml exec -T mongodb mongodump --uri="mongodb://${MONGO_USER}:${MONGO_PASSWORD}@localhost:27017/genieacs?authSource=admin" --archive | gzip > "$BACKUP_DIR/genieacs.archive.gz"

# WireGuard configs
docker compose -f docker-compose.isp.yml exec -T wireguard tar czf - /config > "$BACKUP_DIR/wireguard-config.tar.gz"

# Compress and upload to S3 (optional)
tar czf "$BACKUP_DIR.tar.gz" "$BACKUP_DIR"
# aws s3 cp "$BACKUP_DIR.tar.gz" s3://your-backup-bucket/

echo "Backup completed: $BACKUP_DIR"
```

**Setup cron:**
```bash
# Run daily at 2 AM
echo "0 2 * * * /path/to/scripts/backup.sh" | crontab -
```

### Restore from Backup

```bash
# Stop services
docker compose down
docker compose -f docker-compose.isp.yml down

# Restore PostgreSQL
gunzip < /backups/2025-10-14/postgres.sql.gz | docker compose exec -T postgres psql -U dotmac_user

# Restore NetBox
docker compose -f docker-compose.isp.yml exec -T netbox python3 /opt/netbox/netbox/manage.py loaddata /backups/2025-10-14/netbox.json

# Restore MongoDB
gunzip < /backups/2025-10-14/genieacs.archive.gz | docker compose -f docker-compose.isp.yml exec -T mongodb mongorestore --uri="mongodb://${MONGO_USER}:${MONGO_PASSWORD}@localhost:27017/genieacs?authSource=admin" --archive

# Start services
docker compose up -d
docker compose -f docker-compose.isp.yml up -d
```

---

## Troubleshooting

### Common Issues

**1. FreeRADIUS not starting:**
```bash
# Check logs
docker compose -f docker-compose.isp.yml logs freeradius

# Verify database connection
docker compose -f docker-compose.isp.yml exec freeradius radtest test test localhost 0 testing123

# Check SQL module
docker compose -f docker-compose.isp.yml exec freeradius radiusd -X
```

**2. NetBox database error:**
```bash
# Run migrations manually
docker compose -f docker-compose.isp.yml exec netbox python3 /opt/netbox/netbox/manage.py migrate

# Create superuser
docker compose -f docker-compose.isp.yml exec netbox python3 /opt/netbox/netbox/manage.py createsuperuser
```

**3. GenieACS not connecting:**
```bash
# Check MongoDB connection
docker compose -f docker-compose.isp.yml exec mongodb mongosh -u $MONGO_USER -p $MONGO_PASSWORD --eval "db.adminCommand('ping')"

# Check GenieACS logs
docker compose -f docker-compose.isp.yml logs genieacs
```

**4. WireGuard peer can't connect:**
```bash
# Check server status
docker compose -f docker-compose.isp.yml exec wireguard wg show

# Check firewall
sudo ufw allow 51820/udp
sudo iptables -L -n | grep 51820
```

### Health Checks

```bash
# Check all service health
docker compose ps
docker compose -f docker-compose.isp.yml ps

# PostgreSQL
docker compose exec postgres pg_isready -U dotmac_user

# Redis
docker compose exec redis redis-cli ping

# FreeRADIUS
echo "User-Name=test,User-Password=test" | docker compose -f docker-compose.isp.yml exec -T freeradius radclient -x localhost:1812 auth testing123
```

### Performance Tuning

**PostgreSQL:**
```sql
-- Check slow queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Connection pooling
-- Use PgBouncer (add to docker-compose.yml)
```

**Redis:**
```bash
# Monitor performance
docker compose exec redis redis-cli --latency
docker compose exec redis redis-cli --stat
```

---

## Next Steps

1. **Deploy Infrastructure**: Follow this guide to deploy all services
2. **Initialize Databases**: Run migrations (see [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md))
3. **Configure Services**: Set up FreeRADIUS clients, NetBox sites, etc.
4. **Deploy Application**: Deploy FastAPI backend and Next.js frontend
5. **Test Integration**: Verify all services communicate correctly
6. **Load Test**: Run performance tests before production

---

## Related Documents

- [Architecture Overview](ISP_PLATFORM_ARCHITECTURE.md)
- [Database Schema](DATABASE_SCHEMA.md)
- [Deployment Guide](DEPLOYMENT_GUIDE.md)
- [Monitoring Setup](MONITORING_GUIDE.md)

---

**Document Version History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-14 | DevOps Team | Initial infrastructure guide with Docker images |

### Tenant OSS Configuration

Each ISP tenant may require different VOLTHA, GenieACS, NetBox, and AWX endpoints.
Store these overrides in the `tenant_settings` table via the helper script:

```bash
./scripts/seed_tenant_oss.py --tenant-slug core-isp --config-file tenant_oss.json
```

Example JSON (`tenant_oss.json`):

```json
{
  "voltha": {
    "url": "https://voltha.core-isp.net",
    "api_token": "VOLTHA_TOKEN"
  },
  "genieacs": {
    "url": "https://acs.core-isp.net",
    "username": "acs_user",
    "password": "super-secret"
  },
  "netbox": {
    "url": "https://netbox.core-isp.net",
    "api_token": "NETBOX_TOKEN"
  },
  "ansible": {
    "url": "https://awx.core-isp.net",
    "token": "AWX_BEARER_TOKEN"
  }
}
```

To update a single value without a file:

```bash
./scripts/seed_tenant_oss.py --tenant-slug core-isp --service netbox \
    --set url=https://netbox.core-isp.net --set api_token=NEW_TOKEN
```

To clear overrides (fall back to global defaults):

```bash
./scripts/seed_tenant_oss.py --tenant-slug core-isp --service voltha --clear
```

Global defaults live under `settings.oss`; any option (`url`, `username`, `password`, `api_token`,
`verify_ssl`, `timeout_seconds`, `max_retries`) can be overridden per tenant.
