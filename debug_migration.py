#!/usr/bin/env python3
"""Debug migration execution."""

from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://dotmac_user:change-me-in-production@localhost:5432/dotmac"

def main():
    engine = create_engine(DATABASE_URL, echo=True)  # echo=True for SQL logging

    with engine.connect() as conn:
        # Start a transaction
        trans = conn.begin()

        try:
            # Create alembic_version table if it doesn't exist
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS alembic_version (
                    version_num VARCHAR(32) NOT NULL,
                    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
                )
            """))

            print("✅ Created alembic_version table")

            # Commit the transaction
            trans.commit()
            print("✅ Transaction committed")

            # Verify it persisted
            result = conn.execute(text("SELECT version_num FROM alembic_version"))
            rows = result.fetchall()
            print(f"Rows in alembic_version: {len(rows)}")

        except Exception as e:
            trans.rollback()
            print(f"❌ Error: {e}")
            raise

if __name__ == "__main__":
    main()
