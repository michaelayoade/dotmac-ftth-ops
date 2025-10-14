# DotMac ISP Operations Platform - Infrastructure Quick Start

This guide will help you quickly deploy the complete ISP Operations infrastructure stack including RADIUS, NetBox, GenieACS, WireGuard, LibreNMS, and monitoring services.

## 📋 Prerequisites

Before starting, ensure you have:

- **Docker** (20.10+) installed and running
- **Docker Compose** (v2.0+)
- **Git** for cloning the repository
- **8GB+ RAM** available for containers
- **50GB+ disk space** for data volumes

### Quick Prerequisites Check

```bash
docker --version
docker compose version
```

## 🚀 Quick Start (5 Minutes)

### 1. Clone Repository & Setup Environment

```bash
# Clone the repository
git clone https://github.com/your-org/dotmac-isp-ops.git
cd dotmac-isp-ops

# Copy environment template
cp .env.example .env

# (Optional) Edit .env file with your settings
# For development, the defaults work fine
```

### 2. Run Infrastructure Setup Script

```bash
# Make the script executable (if not already)
chmod +x scripts/init-infrastructure.sh

# Run the complete setup
./scripts/init-infrastructure.sh
```

This script will:
- ✓ Check prerequisites
- ✓ Create Docker network
- ✓ Create required directories
- ✓ Start core services (PostgreSQL, Redis, MinIO, OpenBao)
- ✓ Initialize databases
- ✓ Start ISP services (RADIUS, NetBox, GenieACS, etc.)
- ✓ Start monitoring services (Prometheus, Grafana, Jaeger, etc.)
- ✓ Show service URLs and next steps

**Total time:** ~5 minutes (depending on your internet speed)

### 3. Verify Infrastructure

```bash
# Check service health
./scripts/healthcheck.sh

# View logs for any service
./scripts/logs.sh <service-name>
```

## 🌐 Service URLs

Once deployed, you can access:

### Core Services
- **PostgreSQL:** `localhost:5432`
- **Redis:** `localhost:6379`
- **MinIO Console:** http://localhost:9001 (minioadmin / change-me-in-production)
- **OpenBao Vault:** http://localhost:8200 (root token)

### ISP Services
- **NetBox (IPAM):** http://localhost:8080 (admin / admin)
- **GenieACS UI (TR-069):** http://localhost:7567
- **GenieACS API:** http://localhost:7557
- **LibreNMS:** http://localhost:8000 (admin / admin)
- **Ansible AWX:** http://localhost:8052 (admin / changeme_awx_admin)
- **FreeRADIUS Auth:** `localhost:1812` (UDP)
- **FreeRADIUS Accounting:** `localhost:1813` (UDP)
- **WireGuard VPN:** `localhost:51820` (UDP)

### Monitoring Services
- **Prometheus:** http://localhost:9090
- **Grafana:** http://localhost:3000 (admin / admin)
- **Jaeger (Tracing):** http://localhost:16686
- **Alertmanager:** http://localhost:9093
- **Loki (Logs):** http://localhost:3100

## 🔧 Common Operations

### View Service Logs

```bash
# View logs for a specific service
./scripts/logs.sh freeradius
./scripts/logs.sh netbox
./scripts/logs.sh prometheus

# List all available services
./scripts/logs.sh
```

### Check Service Health

```bash
./scripts/healthcheck.sh
```

### Stop All Services

```bash
./scripts/stop-all.sh
```

### Restart a Service

```bash
# For core services
docker compose restart <service-name>

# For ISP services
docker compose -f docker-compose.isp.yml restart <service-name>

# For monitoring services
docker compose -f docker-compose.monitoring.yml restart <service-name>
```

## 🗄️ Initialize RADIUS Database

After infrastructure is running, initialize RADIUS tables:

```bash
./scripts/init-radius-db.sh
```

This creates all necessary RADIUS tables in PostgreSQL for:
- Authentication (radcheck)
- Authorization (radreply)
- Accounting (radacct)
- NAS devices (nas)
- Bandwidth profiles
- And more...

## 🐛 Troubleshooting

### Container Won't Start

```bash
# Check logs for the failing service
./scripts/logs.sh <service-name>

# Check Docker resources
docker system df
docker system prune  # Clean up if needed
```

### Port Already in Use

If you see "port already in use" errors:

```bash
# Find what's using the port
lsof -i :8080  # Replace with your port

# Stop the conflicting service or change the port in docker-compose files
```

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker compose ps postgres

# Check PostgreSQL logs
./scripts/logs.sh postgres

# Test connection
docker compose exec postgres psql -U dotmac_user -d dotmac -c "SELECT 1;"
```

### Out of Disk Space

```bash
# Check Docker disk usage
docker system df

# Clean up old containers, images, and volumes
docker system prune -a --volumes
```

### Service Not Responding

```bash
# Check if container is running
docker compose ps

# Restart the service
docker compose restart <service-name>

# Check health status
./scripts/healthcheck.sh
```

## 📊 Service Dependencies

```
┌─────────────────────────────────────────┐
│           Core Services                  │
│  PostgreSQL, Redis, MinIO, OpenBao      │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│           ISP Services                   │
│  RADIUS, NetBox, GenieACS, WireGuard    │
│  LibreNMS, Ansible AWX, MongoDB         │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│       Monitoring Services                │
│  Prometheus, Grafana, Jaeger            │
│  Alertmanager, Loki, Promtail           │
└─────────────────────────────────────────┘
```

**Start order:**
1. Core services (PostgreSQL, Redis) must start first
2. ISP services depend on PostgreSQL/Redis
3. Monitoring services can start independently

## 🔐 Default Credentials

**⚠️ CHANGE THESE IN PRODUCTION!**

| Service | Username | Password |
|---------|----------|----------|
| Grafana | admin | admin |
| NetBox | admin | admin |
| LibreNMS | admin | admin |
| Ansible AWX | admin | changeme_awx_admin |
| MinIO | minioadmin | change-me-in-production |
| PostgreSQL | dotmac_user | change-me-in-production |
| MongoDB | admin | changeme_mongo_password |

## 📝 Configuration Files

All configuration files are located in the `config/` directory:

```
config/
├── radius/
│   ├── clients.conf        # RADIUS NAS clients
│   ├── sql.conf            # PostgreSQL connection
│   └── radiusd.conf        # Main RADIUS config
├── prometheus/
│   ├── prometheus.yml      # Metrics collection
│   └── alerts.yml          # Alert rules
├── grafana/
│   ├── datasources/        # Data sources
│   └── dashboards/         # Dashboard provisioning
├── alertmanager/
│   └── config.yml          # Alert routing
├── loki/
│   └── loki-config.yaml    # Log aggregation
└── promtail/
    └── promtail-config.yaml # Log shipping
```

## 🔄 Updating Services

### Pull Latest Images

```bash
# Pull latest images for all services
docker compose pull
docker compose -f docker-compose.isp.yml pull
docker compose -f docker-compose.monitoring.yml pull

# Restart services with new images
docker compose up -d
docker compose -f docker-compose.isp.yml up -d
docker compose -f docker-compose.monitoring.yml up -d
```

### Update Configuration

```bash
# After editing config files, restart the service
docker compose restart <service-name>
```

## 📦 Data Persistence

All data is persisted in Docker volumes:

```bash
# List all volumes
docker volume ls | grep dotmac

# Backup a volume
docker run --rm -v dotmac-isp-ops_postgres_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/postgres_backup.tar.gz /data

# Restore a volume
docker run --rm -v dotmac-isp-ops_postgres_data:/data -v $(pwd):/backup \
  alpine tar xzf /backup/postgres_backup.tar.gz -C /
```

## 🎯 Next Steps

After infrastructure is running:

1. **Backend Setup:**
   ```bash
   cd backend
   poetry install --with dev
   poetry run alembic upgrade head
   poetry run uvicorn dotmac.platform.api.main:app --reload
   ```

2. **Frontend Setup:**
   ```bash
   cd frontend
   pnpm install
   pnpm --filter @dotmac/base-app dev
   ```

3. **Access Services:**
   - Backend API: http://localhost:8000/docs
   - Frontend: http://localhost:3000
   - Grafana Dashboards: http://localhost:3000

4. **Create Your First Tenant:**
   Use the API to create a tenant and start testing ISP operations.

## 📚 Additional Documentation

- **[Complete Architecture](docs/ISP_PLATFORM_ARCHITECTURE.md)** - Detailed system design
- **[Infrastructure Setup](docs/INFRASTRUCTURE_SETUP.md)** - In-depth deployment guide
- **[Team Assignments](docs/TEAM_ASSIGNMENTS.md)** - Team structure and responsibilities
- **[Implementation Plan](docs/IMPLEMENTATION_PLAN.md)** - Project timeline and milestones
- **[Database Schema](docs/DATABASE_SCHEMA.md)** - Complete database design
- **[API Specifications](docs/API_SPECIFICATIONS.md)** - API documentation

## 🆘 Getting Help

- Check logs: `./scripts/logs.sh <service-name>`
- Health check: `./scripts/healthcheck.sh`
- GitHub Issues: [Report a bug or request a feature]
- Documentation: See `docs/` directory

## ⚠️ Production Deployment

This quick start is for **development only**. For production:

1. **Security:**
   - Change ALL default passwords
   - Generate secure secrets: `openssl rand -hex 32`
   - Enable HTTPS/TLS
   - Configure firewall rules
   - Use HashiCorp Vault for secrets

2. **High Availability:**
   - Use Kubernetes instead of Docker Compose
   - Configure PostgreSQL replication
   - Setup Redis Sentinel/Cluster
   - Use external load balancers

3. **Monitoring:**
   - Configure alert destinations (PagerDuty, Slack)
   - Set up log retention policies
   - Configure backup schedules
   - Enable audit logging

4. **Compliance:**
   - Review GDPR settings
   - Configure data retention policies
   - Enable audit trails
   - Setup compliance monitoring

See **[Infrastructure Setup](docs/INFRASTRUCTURE_SETUP.md)** for production deployment details.

---

**Ready to build an ISP? Let's go! 🚀**
