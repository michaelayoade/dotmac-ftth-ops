#!/usr/bin/env python3
"""Test database connection and table existence."""

import sys
from pathlib import Path

# Add src to path
project_root = Path(__file__).resolve().parent
src_root = project_root / "src"
sys.path.insert(0, str(src_root))

from sqlalchemy import create_engine, inspect, text  # noqa: E402

# Database URL from alembic.ini
DATABASE_URL = "postgresql://dotmac_user:change-me-in-production@localhost:5432/dotmac"


def main():
    print(f"Connecting to: {DATABASE_URL}")
    engine = create_engine(DATABASE_URL)

    try:
        # Test connection
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version();"))
            version = result.fetchone()[0]
            print("✅ Connected successfully!")
            print(f"PostgreSQL version: {version}\n")

            # Check for alembic_version
            result = conn.execute(
                text(
                    "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
                    "WHERE table_schema = 'public' AND table_name = 'alembic_version');"
                )
            )
            has_alembic = result.fetchone()[0]
            print(f"Has alembic_version table: {has_alembic}")

            if has_alembic:
                result = conn.execute(text("SELECT version_num FROM alembic_version;"))
                version_num = result.fetchone()
                if version_num:
                    print(f"Current migration: {version_num[0]}\n")

            # List all tables
            inspector = inspect(engine)
            tables = inspector.get_table_names(schema="public")
            print(f"Total tables in public schema: {len(tables)}")
            if tables:
                print("Tables:")
                for table in sorted(tables):
                    print(f"  - {table}")
            else:
                print("  (no tables found)")

            # Check specifically for customers table
            if "customers" in tables:
                print("\n✅ Customers table exists!")
                columns = inspector.get_columns("customers", schema="public")
                isp_columns = [
                    c["name"]
                    for c in columns
                    if "service_" in c["name"] or "installation_" in c["name"]
                ]
                print(f"ISP-specific columns found: {len(isp_columns)}")
                if isp_columns:
                    for col in isp_columns[:5]:
                        print(f"  - {col}")
            else:
                print("\n❌ Customers table NOT found")

    except Exception as e:
        print(f"❌ Error: {e}")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
