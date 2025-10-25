# Development Database Setup

**SECURITY**: This project does NOT commit populated database files to version control. All test data must be generated declaratively using migrations and seed scripts.

## Quick Start

```bash
# 1. Apply latest migrations
make db-migrate

# 2. Seed with test data
make db-seed

# 3. Verify current revision
poetry run alembic current
```

## Database Files

- **Location**: Project root (`dotmac_dev.sqlite`, `dotmac.db`)
- **Gitignore**: ✅ Already excluded via `.gitignore`
- **Never commit**: Database files contain credentials and should never be tracked

## Seeding Test Data

### Using Make Commands

```bash
# Seed all modules
make db-seed

# Seed specific modules
python scripts/seed_data.py --module auth
python scripts/seed_data.py --module billing
python scripts/seed_data.py --module customers
```

### Declarative Seed Data

Create seed data in `scripts/seed_data/` directory:

```python
# scripts/seed_data/auth_users.py
from dotmac.platform.auth.models import User

async def seed_auth_users(db):
    """Seed test users."""
    users = [
        User(
            email="admin@example.com",
            username="admin",
            hashed_password=hash_password("admin123"),
            tenant_id="default-tenant",
            is_active=True,
        ),
        User(
            email="user@example.com",
            username="testuser",
            hashed_password=hash_password("user123"),
            tenant_id="default-tenant",
            is_active=True,
        ),
    ]

    for user in users:
        db.add(user)

    await db.commit()
    return len(users)
```

### Environment-Specific Seeds

```bash
# Development (full dataset)
ENVIRONMENT=development make db-seed

# Testing (minimal dataset)
ENVIRONMENT=testing make db-seed

# Production (never seed!)
# Production data comes from actual usage
```

## Multi-Tenant Test Data

### Creating Test Tenants

```python
# scripts/seed_data/tenants.py
async def seed_tenants(db):
    """Create test tenants."""
    from dotmac.platform.tenant.models import Tenant

    tenants = [
        Tenant(
            id="tenant-acme",
            name="ACME Corporation",
            slug="acme",
            is_active=True,
        ),
        Tenant(
            id="tenant-widgets",
            name="Widgets Inc",
            slug="widgets",
            is_active=True,
        ),
    ]

    for tenant in tenants:
        db.add(tenant)

    await db.commit()
    return tenants
```

### Tenant-Isolated Data

```python
async def seed_customers_for_tenant(db, tenant_id):
    """Seed customers for specific tenant."""
    from dotmac.platform.customer_management.models import Customer

    customers = [
        Customer(
            name="Customer 1",
            email="customer1@example.com",
            tenant_id=tenant_id,  # SECURITY: Always set tenant_id
        ),
        Customer(
            name="Customer 2",
            email="customer2@example.com",
            tenant_id=tenant_id,
        ),
    ]

    for customer in customers:
        db.add(customer)

    await db.commit()
    return len(customers)
```

## Resetting Database

```bash
# Drop all tables and recreate
make db-reset

# Reset and seed
make db-reset-seed
```

## Database Migrations

### Creating Migrations

```bash
# Auto-generate migration from models
alembic revision --autogenerate -m "Add customer management tables"

# Manual migration
alembic revision -m "Add custom indexes"
```

### Running Migrations

```bash
# Upgrade to latest
alembic upgrade head

# Downgrade one revision
alembic downgrade -1

# Show current version
alembic current
```

## Testing with Fresh Database

```bash
# Each test gets isolated database
pytest tests/  # Uses conftest.py fixtures

# Manual test database
export DATABASE_URL="postgresql://user:pass@localhost:5432/dotmac_test"
pytest tests/billing/
```

## Makefile Targets

```makefile
# Database initialization
db-init:
    alembic upgrade head

# Seed test data
seed-db:
    python scripts/seed_data.py

# Reset database (DESTRUCTIVE)
db-reset:
    alembic downgrade base
    alembic upgrade head

# Verify database state
db-verify:
    python scripts/verify_database.py
```

## Security Considerations

### ❌ Never Commit

- SQLite database files (`*.db`, `*.sqlite`)
- Database dumps with real data
- Credentials or API keys in seed data

### ✅ Always Do

- Use declarative seed scripts
- Generate random/fake data (Faker library)
- Hash passwords before storing
- Set tenant_id for all multi-tenant data
- Document seed data structure

## Example Seed Script

```python
#!/usr/bin/env python3
"""
Comprehensive seed script for development database.
"""

import asyncio
from faker import Faker

from dotmac.platform.db import get_async_session
from dotmac.platform.auth.core import hash_password

fake = Faker()


async def seed_all():
    """Seed all modules."""
    async for db in get_async_session():
        # Seed tenants
        tenant_ids = await seed_tenants(db)

        # Seed users for each tenant
        for tenant_id in tenant_ids:
            await seed_users(db, tenant_id)
            await seed_customers(db, tenant_id)
            await seed_invoices(db, tenant_id)

        print("✅ Database seeded successfully")
        break


async def seed_tenants(db):
    """Create test tenants."""
    from dotmac.platform.tenant.models import Tenant

    tenants = [
        Tenant(id="tenant-1", name="Tenant One", slug="tenant-one"),
        Tenant(id="tenant-2", name="Tenant Two", slug="tenant-two"),
    ]

    for tenant in tenants:
        db.add(tenant)

    await db.commit()

    return [t.id for t in tenants]


async def seed_users(db, tenant_id):
    """Create test users for tenant."""
    from dotmac.platform.auth.models import User

    users = [
        User(
            email=fake.email(),
            username=fake.user_name(),
            hashed_password=hash_password("password123"),
            tenant_id=tenant_id,
            is_active=True,
        )
        for _ in range(5)
    ]

    for user in users:
        db.add(user)

    await db.commit()


if __name__ == "__main__":
    asyncio.run(seed_all())
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Test with Fresh Database

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: dotmac_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.12'

      - name: Install dependencies
        run: |
          pip install poetry
          poetry install

      - name: Run migrations
        run: |
          poetry run alembic upgrade head

      - name: Seed test data
        run: |
          poetry run python scripts/seed_data.py

      - name: Run tests
        run: |
          poetry run pytest tests/ --cov
```

## Troubleshooting

### Database Locked

```bash
# Kill all connections
fuser -k dotmac_dev.sqlite

# Or recreate
rm dotmac_dev.sqlite
make db-init
```

### Migration Conflicts

```bash
# Show current migrations
alembic history

# Resolve conflicts
alembic merge heads -m "Merge migration branches"
```

### Seed Data Fails

```bash
# Check database state
alembic current

# Reset and try again
make db-reset-seed
```

## Related Documentation

- `[Legacy AI assistant guidelines](../CLAUDE_OLD.md)` - Historical reference
- `FIXTURE_DOCUMENTATION.md` - Test fixtures
- `scripts/seed_data.py` - Main seed script
- `.gitignore` - Excluded files (includes *.db, *.sqlite)
