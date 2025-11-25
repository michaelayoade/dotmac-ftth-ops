# Stack Health Runbook

Fast path to get every container reporting `healthy` when running the Compose bundles. These steps mirror the fixes applied during the latest recovery (worker env sync, Vault/OpenBao healthcheck, and secret seeding).

## 1) Baseline status commands

- Check overall health:  
  ```bash
  docker ps --format 'table {{.Names}}\t{{.Status}}'
  docker ps --format 'table {{.Names}}\t{{.Status}}' --filter health=unhealthy
  ```
- Follow backend logs while you iterate:  
  ```bash
  docker logs -f dotmac-ftth-ops_platform-backend_1
  ```

## 2) Make sure OpenBao/Vault is up (dev defaults)

The dev Compose bundle now declares `openbao` with a native healthcheck (`bao status`). Bring it up with the infrastructure file:

```bash
docker compose -f docker-compose.infra.yml up -d openbao
docker compose -f docker-compose.infra.yml ps openbao
```

OpenBao dev mode prints the root token in logs as `dev_local_vault_token`.

## 3) Seed required secrets into Vault/OpenBao

The backend runs with `ENVIRONMENT=production` and enforces production-grade validation, so secrets must be present in Vault. Seed the minimum set with the dev token:

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

You can also run `python scripts/store_paystack_secrets.py` with `VAULT_TOKEN` set to seed real Paystack keys (requires `sk_test_`/`pk_test_` or live prefixes).

## 4) Ensure service env matches Vault settings

Add these to the worker service (already present in `docker-compose.prod.yml`):

- `VAULT__URL=http://dotmac-openbao:8200`
- `VAULT__TOKEN=dev_local_vault_token`
- `SECRET_KEY=<matches secret/app/secret_key>`

The backend service uses the same values. Restart after editing Compose files:

```bash
docker compose -f docker-compose.base.yml up -d platform-backend platform-worker
```

## 5) Clean up stray migration containers

If you ever see multiple `dotmac/platform-api:latest` containers stuck running `alembic upgrade head`, remove them:

```bash
docker ps -a --filter ancestor=dotmac/platform-api:latest
docker rm -f $(docker ps -aq --filter ancestor=dotmac/platform-api:latest)
```

## 6) Validate health

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}'
curl -f http://localhost:8000/health           # platform backend
curl -f http://localhost:8200/v1/sys/health    # OpenBao/Vault
```

Expected healthy set (names may differ if you use a project prefix):

- `dotmac-ftth-ops_platform-backend_1` — healthy
- `dotmac-ftth-ops_platform-worker_1` — healthy
- `dotmac-openbao` — healthy (healthcheck uses `bao status`)
- `dotmac-redis`, `dotmac-postgres`, `dotmac-minio` — healthy
- Frontends (`platform-frontend`, `isp-frontend`) — up

If the backend fails again with Vault validation errors, re-run step 3 to confirm secrets exist and match the expected prefixes/lengths.
