#!/usr/bin/env python3
"""Reset and recreate the database."""

import os

import psycopg2
from psycopg2 import sql

# Database settings
DB_USER = os.getenv("DB_USER", "dotmac_user")
DB_PASSWORD = os.getenv("DB_PASSWORD", "change-me-in-production")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "dotmac")


def reset_database():
    # Connect to PostgreSQL server (not to specific database)
    try:
        conn = psycopg2.connect(
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST,
            port=DB_PORT,
            database="postgres",  # Connect to default database
        )
        conn.autocommit = True
        cursor = conn.cursor()

        # Terminate existing connections
        print(f"Terminating connections to {DB_NAME}...")
        cursor.execute(
            sql.SQL(
                "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = %s AND pid <> pg_backend_pid()"
            ),
            [DB_NAME],
        )

        # Drop database if exists
        print(f"Dropping database {DB_NAME} if exists...")
        cursor.execute(sql.SQL("DROP DATABASE IF EXISTS {}").format(sql.Identifier(DB_NAME)))

        # Create fresh database
        print(f"Creating fresh database {DB_NAME}...")
        cursor.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(DB_NAME)))

        cursor.close()
        conn.close()
        print(f"✅ Database {DB_NAME} reset successfully!")

    except Exception as e:
        print(f"❌ Error resetting database: {e}")
        raise


if __name__ == "__main__":
    reset_database()
