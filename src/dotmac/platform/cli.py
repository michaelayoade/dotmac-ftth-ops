#!/usr/bin/env python
"""
CLI management commands for DotMac Platform Services.
"""

import asyncio
from datetime import datetime, timedelta, timezone

# Python 3.9/3.10 compatibility: UTC was added in 3.11
UTC = timezone.utc
from pathlib import Path

import click
from sqlalchemy import text

from dotmac.platform.db import get_session, init_db


@click.group()
def cli() -> None:
    """DotMac Platform Services CLI."""
    pass


@cli.command()
def init_database() -> None:
    """Initialize the database with required schemas."""
    click.echo("Initializing database...")
    init_db()  # This is a sync function
    click.echo("Database initialized successfully!")


@cli.command()
@click.option("--email", prompt=True, help="Admin user email")
@click.option("--password", prompt=True, hide_input=True, help="Admin user password")
def create_admin(email: str, password: str) -> None:
    """Create an admin user."""

    async def _create_admin() -> None:
        from dotmac.platform.auth.core import hash_password

        # Use same bcrypt hashing as regular users for consistency
        password_hash = hash_password(password)

        async with get_session() as session:
            # Check if user exists using raw SQL
            existing = await session.execute(
                text("SELECT email FROM users WHERE email = :email"), {"email": email}
            )
            if existing.first():
                click.echo(f"User with email {email} already exists!")
                return

            # Create admin user with raw SQL
            await session.execute(
                text(
                    "INSERT INTO users (email, password_hash, is_admin, is_active) "
                    "VALUES (:email, :password_hash, :is_admin, :is_active)"
                ),
                {
                    "email": email,
                    "password_hash": password_hash,
                    "is_admin": True,
                    "is_active": True,
                },
            )
            await session.commit()
            click.echo(f"Admin user {email} created successfully!")

    asyncio.run(_create_admin())


@cli.command()
def generate_jwt_keys() -> None:
    """Generate JWT signing keys."""
    from cryptography.hazmat.backends import default_backend
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import rsa

    click.echo("Generating RSA key pair for JWT signing...")

    # Generate private key
    private_key = rsa.generate_private_key(
        public_exponent=65537, key_size=2048, backend=default_backend()
    )

    # Get public key
    public_key = private_key.public_key()

    # Serialize private key
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )

    # Serialize public key
    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM, format=serialization.PublicFormat.SubjectPublicKeyInfo
    )

    # Save keys
    Path("jwt_private.pem").write_bytes(private_pem)
    Path("jwt_public.pem").write_bytes(public_pem)

    click.echo("Keys saved to jwt_private.pem and jwt_public.pem")


@cli.command()
def run_migrations() -> None:
    """Run database migrations."""
    import subprocess
    import sys

    click.echo("Running database migrations...")
    result = subprocess.run(["alembic", "upgrade", "head"], capture_output=True, text=True)

    if result.returncode == 0:
        click.echo("Migrations completed successfully!")
        click.echo(result.stdout)
    else:
        click.echo("Migration failed!")
        click.echo(result.stderr)
        sys.exit(1)


@cli.command()
@click.option("--test", is_flag=True, help="Run in test mode")
def check_services(test: bool) -> None:
    """Check connectivity to all required services."""

    async def _check_services() -> None:
        results = {}

        # Check database
        try:
            async with get_session() as session:
                await session.execute(text("SELECT 1"))
            results["database"] = "✓ Connected"
        except Exception as e:
            results["database"] = f"✗ Failed: {e}"

        # Check Redis
        try:
            from dotmac.platform.core.caching import redis_client

            if redis_client and redis_client.ping():
                results["redis"] = "✓ Connected"
            else:
                results["redis"] = "✗ Not configured"
        except Exception as e:
            results["redis"] = f"✗ Failed: {e}"

        # Check Vault/OpenBao
        try:
            import httpx

            async with httpx.AsyncClient() as client:
                response = await client.get("http://localhost:8200/v1/sys/health")
                if response.status_code in [200, 429, 501, 503]:
                    results["vault"] = "✓ Available"
                else:
                    results["vault"] = f"✗ Status: {response.status_code}"
        except Exception as e:
            results["vault"] = f"✗ Failed: {e}"

        # Print results
        click.echo("\nService Status:")
        click.echo("-" * 40)
        for service, status in results.items():
            click.echo(f"{service:15} {status}")

    asyncio.run(_check_services())


@cli.command()
@click.option("--days", default=30, help="Number of days to keep")
def cleanup_sessions(days: int) -> None:
    """Clean up expired sessions."""

    async def _cleanup() -> None:
        async with get_session() as session:
            cutoff = datetime.now(UTC) - timedelta(days=days)
            # Use raw SQL for DELETE operation
            await session.execute(
                text("DELETE FROM auth.sessions WHERE created_at < :cutoff"), {"cutoff": cutoff}
            )
            await session.commit()
            click.echo("Deleted expired sessions")

    asyncio.run(_cleanup())


@cli.command()
@click.option("--format", default="json", help="Export format (json/csv)")
def export_audit_logs(format: str) -> None:
    """Export audit logs."""
    import csv
    import json

    async def _export() -> None:
        async with get_session() as session:
            result = await session.execute(
                text("SELECT * FROM audit.audit_log ORDER BY event_timestamp DESC")
            )
            logs = result.fetchall()

            if format == "json":
                output = json.dumps([dict(log) for log in logs], default=str, indent=2)
                Path("audit_logs.json").write_text(output)
                click.echo(f"Exported {len(logs)} logs to audit_logs.json")
            elif format == "csv":
                with open("audit_logs.csv", "w", newline="") as f:
                    if logs:
                        writer = csv.DictWriter(f, fieldnames=logs[0].keys())
                        writer.writeheader()
                        writer.writerows([dict(log) for log in logs])
                click.echo(f"Exported {len(logs)} logs to audit_logs.csv")

    asyncio.run(_export())


if __name__ == "__main__":
    cli()
