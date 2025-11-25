# Quick Start: Infrastructure Services

The backends are expecting these services to be available on the host:

## Required Services

1. **PostgreSQL** - Port 5432
2. **Redis** - Port 6379
3. **MinIO** - Port 9000

## Option 1: Quick Docker Setup (Recommended)

Create a simple docker-compose file to run these services (now also includes OpenBao/Vault for secrets):

```bash
cat > docker-compose.infra.yml <<'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: dotmac
      POSTGRES_USER: dotmac_user
      POSTGRES_PASSWORD: dev_local_pg_password_123
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dotmac_user"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --requirepass dev_local_redis_password_123
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  minio:
    image: minio/minio:latest
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: dev_local_minio_root_pw
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3

  openbao:
    image: openbao/openbao:latest
    restart: unless-stopped
    environment:
      VAULT_DEV_ROOT_TOKEN_ID: dev_local_vault_token
      VAULT_DEV_LISTEN_ADDRESS: 0.0.0.0:8200
    ports:
      - "8200:8200"
    healthcheck:
      test: ["CMD", "bao", "status"]
      interval: 15s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
  minio_data:
EOF

# Start infrastructure services
docker compose -f docker-compose.infra.yml up -d

# Wait for services to be healthy (OpenBao uses bao status)
sleep 20

# Check status
docker compose -f docker-compose.infra.yml ps
```

## Option 2: Use Existing Services

If you already have PostgreSQL, Redis, and MinIO installed on your server, update the `.env` file with the correct connection details.

## After Infrastructure is Running

1. Verify services are accessible:
```bash
# Test PostgreSQL
docker exec -it dotmac-ftth-ops-postgres-1 psql -U dotmac_user -d dotmac -c "SELECT 1;"

# Test Redis
docker exec -it dotmac-ftth-ops-redis-1 redis-cli -a dev_local_redis_password_123 ping

# Test MinIO
curl http://localhost:9000/minio/health/live

# Test OpenBao/Vault (dev token is printed in logs: dev_local_vault_token)
docker exec -e BAO_TOKEN=dev_local_vault_token dotmac-openbao bao status
```

2. Restart backend services:
```bash
docker restart dotmac-ftth-ops-isp-backend-1 dotmac-ftth-ops-platform-backend-1
```

3. Check backend logs:
```bash
docker logs dotmac-ftth-ops-isp-backend-1 --tail 50
docker logs dotmac-ftth-ops-platform-backend-1 --tail 50
```

4. Seed secrets into OpenBao/Vault (minimum set to satisfy production validation):
```bash
export BAO_TOKEN=dev_local_vault_token
docker exec -e BAO_TOKEN=$BAO_TOKEN dotmac-openbao bao kv put secret/app/secret_key value=13e7e1e98056ce1a440c856b78a78ee070c02e23ebdac20e67b8c10a77fa2906
docker exec -e BAO_TOKEN=$BAO_TOKEN dotmac-openbao bao kv put secret/auth/jwt_secret value=721f9941a066e018481095df8c52a31b6c7a87a496419598af7faae162dfb7ff59d79660543fd720f76de001be067ebb
docker exec -e BAO_TOKEN=$BAO_TOKEN dotmac-openbao bao kv put secret/database/password value=dev_local_pg_password_123
docker exec -e BAO_TOKEN=$BAO_TOKEN dotmac-openbao bao kv put secret/redis/password value=dev_local_redis_password_123
docker exec -e BAO_TOKEN=$BAO_TOKEN dotmac-openbao bao kv put secret/storage/access_key value=minioadmin
docker exec -e BAO_TOKEN=$BAO_TOKEN dotmac-openbao bao kv put secret/storage/secret_key value=dev_local_minio_root_pw
docker exec -e BAO_TOKEN=$BAO_TOKEN dotmac-openbao bao kv put secret/observability/alertmanager/webhook_secret value=dev_webhook_secret
docker exec -e BAO_TOKEN=$BAO_TOKEN dotmac-openbao bao kv put secret/billing/paystack/secret_key value=sk_test_example123456
docker exec -e BAO_TOKEN=$BAO_TOKEN dotmac-openbao bao kv put secret/billing/paystack/public_key value=pk_test_example123456
```

5. Run database migrations:
```bash
# ISP backend migrations
docker exec dotmac-ftth-ops-isp-backend-1 alembic upgrade head

# Platform backend migrations
docker exec dotmac-ftth-ops-platform-backend-1 alembic upgrade head
```

6. Verify backends are healthy:
```bash
curl http://149.102.135.97:8000/health
curl http://149.102.135.97:8001/health
```

## Environment Variables

The `.env` file should already have these defaults from `.env.example`:

```bash
# PostgreSQL
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=dotmac
POSTGRES_USER=dotmac_user
POSTGRES_PASSWORD=dev_local_pg_password_123

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=dev_local_redis_password_123

# MinIO
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=dev_local_minio_root_pw
MINIO_ENDPOINT=minio:9000

# Vault/OpenBao (dev defaults)
VAULT__ENABLED=true
VAULT__URL=http://openbao:8200
VAULT__TOKEN=dev_local_vault_token
```

**Note**: These are development passwords. Change them for production!
