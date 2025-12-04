# Quick Start

Use this guide to get DotMac Platform Services running in your application within minutes.
It mirrors the README examples while living alongside deeper architecture docs for easy reference.

## Module Entry Points

- [Authentication (`dotmac.platform.auth`)](../src/dotmac/platform/auth/)
- [Secrets (`dotmac.platform.secrets`)](../src/dotmac/platform/secrets/)
- [Observability (`dotmac.platform.observability`)](../src/dotmac/platform/observability/)

## Authentication

```python
from dotmac.platform.auth import AuthService, JWTService, RBACEngine

# JWT token management
jwt_service = JWTService(
    secret_key="your-secret",
    algorithm="HS256"
)

token = jwt_service.create_access_token(
    subject="user123",
    permissions=["read:users", "write:users"]
)

# RBAC permissions
rbac = RBACEngine()
rbac.add_role("admin", ["read:*", "write:*", "delete:*"])
rbac.add_role("user", ["read:own", "write:own"])

has_permission = rbac.check_permission(
    user_roles=["admin"],
    required_permission="write:users"
)
```

### API Key dependency (FastAPI)

```python
from fastapi import Depends, FastAPI
from dotmac.platform.auth.api_keys import APIKeyService, api_key_dependency

app = FastAPI()

# Attach the service once (e.g., at startup)
app.state.api_key_service = APIKeyService(database_session)

@app.get("/users", dependencies=[Depends(api_key_dependency(["read:users"]))])
async def list_users():
    return {"ok": True}
```

### Service-to-service request signing (HMAC)

```python
import time
from dotmac.platform.auth.service_auth import (
    ServiceAuthMiddleware,
    sign_request,
)

signing_secret = "super-secret"

app.add_middleware(
    ServiceAuthMiddleware,
    token_manager=service_token_manager,
    service_name="users",
    require_request_signature=True,
    signing_secret=signing_secret,
)

# Client-side signing example
method, path, body, ts = "POST", "/internal/users", b"{}", str(int(time.time()))
sig = sign_request(signing_secret, method, path, body, ts)
headers = {"X-Signature": sig, "X-Timestamp": ts, "X-Service-Token": token}
```

### CSRF protection (double-submit cookie)

```python
from dotmac.platform.auth.csrf import CSRFMiddleware

app.add_middleware(CSRFMiddleware, secure=True, samesite="lax")
```

## Secrets Management

```python
import asyncio
from dotmac.platform.secrets import SecretsManager, OpenBaoProvider

async def main():
    # OpenBao-backed provider (aka Vault), KV v2 at mount "secret"
    provider = OpenBaoProvider(
        url="http://localhost:8200",
        token="root",
        mount_point="secret",
        kv_version=2,
    )

    # Optionally seed a secret directly via provider
    await provider.set_secret("myapp/config", {"api_key": "s3cr3t"})

    # Manager adds caching/validation and typed accessors
    secrets = SecretsManager(provider=provider)

    data = await secrets.get_custom_secret("myapp/config")
    print(data["api_key"])  # s3cr3t

    await provider.close()

asyncio.run(main())
```

### Rotation scheduler

```python
from dotmac.platform.secrets.rotation import (
    create_rotation_scheduler,
    create_database_rotation_rule,
)

scheduler = create_rotation_scheduler(secrets_provider)
scheduler.add_rotation_rule(create_database_rotation_rule("db/creds/app"))
# Run one-off rotation
result = asyncio.run(scheduler.rotate_secret("db/creds/app"))
print(result.status)
```

## Observability

```python
from fastapi import FastAPI
from dotmac.platform.observability import ObservabilityManager

# Initialize observability
mgr = ObservabilityManager(
    service_name="my-service",
    otlp_endpoint="http://localhost:4317",
    enable_tracing=True,
    enable_metrics=True,
    enable_logging=True,
)
mgr.initialize()

# Distributed tracing (optional)
from dotmac.platform.observability import get_tracer
tracer = get_tracer(__name__)
with tracer.start_as_current_span("operation"):
    ...

# Custom metrics via registry
registry = mgr.get_metrics_registry()
counter = registry.create_counter("requests_total")
counter.add(1, {"method": "GET", "status": "200"})

# FastAPI middleware
app = FastAPI()
mgr.apply_middleware(app)
```

For more details, continue exploring the `docs/` directory or the module source linked above.
