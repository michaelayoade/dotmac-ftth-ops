# PostgreSQL-Specific Migration Features

## Overview
This project's migrations are **PostgreSQL-only** and will not work with SQLite, MySQL, or other databases without modifications.

## Postgres-Specific Features Used

### 1. Partial Indexes (Line 78, Migration a72ec3c5e945)
```python
op.create_index(
    "ix_domain_verification_active",
    "domain_verification_attempts",
    ["tenant_id", "status", "expires_at"],
    postgresql_where=sa.text("status = 'pending'"),  # ← Postgres-only
)
```
**Purpose**: Indexes only rows where `status = 'pending'` for faster active verification lookups.
**Alternative for other DBs**: Remove `postgresql_where` parameter (indexes all rows, uses more space).

### 2. JSON Column Type (Multiple Migrations)
```python
sa.Column("metadata", sa.JSON(), nullable=True)
```
**Used in**:
- `domain_verification_attempts.metadata`
- `teams.metadata`
- Various other tables

**Purpose**: Native JSON storage with querying capabilities.
**Alternative for other DBs**: Use `sa.Text()` and serialize/deserialize JSON manually.

### 3. UUID Column Type
```python
sa.Column("id", sa.UUID(), nullable=False)
```
**Used extensively**: Most primary keys use UUID type.
**Alternative for other DBs**: Use `sa.String(36)` or `sa.CHAR(36)` for UUID strings.

### 4. Enum Types (Fixed in Migration 364eab9b9915)
Originally used PostgreSQL `CREATE TYPE ... AS ENUM`, now uses CHECK constraints for better compatibility.

### 5. CASCADE Foreign Keys
```python
sa.ForeignKeyConstraint(
    ["tenant_id"],
    ["tenants.id"],
    ondelete="CASCADE",  # Supported in Postgres, MySQL, not SQLite by default
)
```

## Migration Configuration

### alembic.ini
```ini
sqlalchemy.url = postgresql://dotmac_user:change-me-in-production@localhost:5432/dotmac
```
**Hard-coded PostgreSQL URL**. Override with environment variable:
```bash
export ALEMBIC_DATABASE_URL="postgresql://user:pass@host:port/db"
```

### Version Location
```ini
script_location = alembic
version_locations = alembic/versions
```
**Note**: `versions_old/` and `versions_old_backup/` are NOT in `version_locations` and won't be loaded.

## Porting to Other Databases

If you need to support non-Postgres databases:

### SQLite Compatibility
1. **Remove `postgresql_where`** from partial indexes (a72ec3c5e945:78)
2. **Change JSON to TEXT** in all migrations
3. **Change UUID to String(36)** in all migrations
4. **Enable foreign keys**: SQLite requires `PRAGMA foreign_keys=ON`
5. **Remove CASCADE**: SQLite foreign keys don't cascade by default

### MySQL Compatibility
1. **Remove `postgresql_where`** from partial indexes
2. **Change JSON to JSON** (MySQL 5.7+ supports JSON)
3. **Change UUID to CHAR(36)** or use BINARY(16)
4. **Test CASCADE behavior**: Works but syntax differs slightly

## Testing Migrations on Fresh Database

```bash
# Create test database
createdb dotmac_test

# Run migrations
export DATABASE_URL="postgresql://user:pass@localhost:5432/dotmac_test"
poetry run alembic upgrade head

# Verify
poetry run alembic current
poetry run alembic heads

# Cleanup
dropdb dotmac_test
```

## CI/CD Considerations

- **CI uses PostgreSQL**: `.github/workflows/check-migrations.yml` line 69-76
- **Migrations tested from scratch**: CI applies all migrations to empty DB
- **No SQLite fallback**: Tests assume PostgreSQL is available

## Summary

✅ **Current State**: Postgres-optimized, production-ready  
⚠️  **Portability**: Requires modifications for non-Postgres databases  
📌 **Recommendation**: Document Postgres requirement in main README
