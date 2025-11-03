#!/usr/bin/env python
"""
CLI management commands for DotMac Platform Services.
"""

import asyncio
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, Protocol

import click
from sqlalchemy import text

from dotmac.platform.auth.core import hash_password
from dotmac.platform.db import get_session, init_db


class AsyncSessionManager(Protocol):
    async def __aenter__(self) -> Any: ...  # pragma: no cover - protocol definition
    async def __aexit__(self, exc_type: Any, exc: Any, tb: Any) -> Any: ...  # pragma: no cover


@dataclass
class CLIDependencies:
    """Bundle of injectable dependencies used by CLI commands."""

    session_factory: Callable[[], AsyncSessionManager]
    init_db: Callable[[], None]
    hash_password: Callable[[str], str]
    subprocess_run: Callable[..., Any]
    redis_client: Any
    http_client_cls: type
    path_factory: Callable[[str], Path]


def _get_cli_dependencies() -> CLIDependencies:
    """Return the default dependency bundle for CLI commands."""
    import subprocess

    import httpx

    from dotmac.platform.core.caching import redis_client

    return CLIDependencies(
        session_factory=get_session,
        init_db=init_db,
        hash_password=hash_password,
        subprocess_run=subprocess.run,
        redis_client=redis_client,
        http_client_cls=httpx.AsyncClient,
        path_factory=Path,
    )


@click.group()
def cli() -> None:
    """DotMac Platform Services CLI."""
    pass


@cli.command()
def init_database() -> None:
    """Initialize the database with required schemas."""
    deps = _get_cli_dependencies()
    click.echo("Initializing database...")
    deps.init_db()  # This is a sync function
    click.echo("Database initialized successfully!")


@cli.command()
@click.option("--email", prompt=True, help="Admin user email")
@click.option("--password", prompt=True, hide_input=True, help="Admin user password")
def create_admin(email: str, password: str) -> None:
    """Create an admin user."""

    deps = _get_cli_dependencies()

    async def _create_admin() -> None:
        # Use same bcrypt hashing as regular users for consistency
        password_hash = deps.hash_password(password)

        async with deps.session_factory() as session:
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
    deps = _get_cli_dependencies()
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
    deps.path_factory("jwt_private.pem").write_bytes(private_pem)
    deps.path_factory("jwt_public.pem").write_bytes(public_pem)

    click.echo("Keys saved to jwt_private.pem and jwt_public.pem")


@cli.command()
def run_migrations() -> None:
    """Run database migrations."""
    deps = _get_cli_dependencies()
    import sys

    click.echo("Running database migrations...")
    result = deps.subprocess_run(["alembic", "upgrade", "head"], capture_output=True, text=True)

    if result.returncode == 0:
        click.echo("Migrations completed successfully!")
        click.echo(result.stdout)
    else:
        click.echo("Migration failed!")
        click.echo(result.stderr)
        sys.exit(1)


async def _collect_service_statuses(test: bool, deps: CLIDependencies) -> dict[str, str]:
    """Collect service connectivity status with optional test-mode short circuit."""
    if test:
        return {
            "database": "skipped (test mode)",
            "redis": "skipped (test mode)",
            "vault": "skipped (test mode)",
        }

    session_factory = deps.session_factory
    redis_client_obj = deps.redis_client
    http_client_cls = deps.http_client_cls

    results: dict[str, str] = {}

    # Database
    try:
        async with session_factory() as session:
            await session.execute(text("SELECT 1"))
        results["database"] = "✓ Connected"
    except Exception as exc:  # pragma: no cover - defensive logging
        results["database"] = f"✗ Failed: {exc}"

    # Redis
    try:
        if redis_client_obj and hasattr(redis_client_obj, "ping"):
            if redis_client_obj.ping():
                results["redis"] = "✓ Connected"
            else:
                results["redis"] = "✗ Unresponsive"
        else:
            results["redis"] = "✗ Not configured"
    except Exception as exc:  # pragma: no cover - defensive logging
        results["redis"] = f"✗ Failed: {exc}"

    # Vault/OpenBao
    try:
        async with http_client_cls() as client:
            response = await client.get("http://localhost:8200/v1/sys/health")
            if response.status_code in [200, 429, 501, 503]:
                results["vault"] = "✓ Available"
            else:
                results["vault"] = f"✗ Status: {response.status_code}"
    except Exception as exc:  # pragma: no cover - defensive logging
        results["vault"] = f"✗ Failed: {exc}"

    return results


@cli.command()
@click.option("--test", is_flag=True, help="Run in test mode")
def check_services(test: bool) -> None:
    """Check connectivity to all required services."""

    deps = _get_cli_dependencies()

    async def _check_services() -> None:
        results = await _collect_service_statuses(test, deps)

        click.echo("\nService Status:")
        click.echo("-" * 40)
        for service in ("database", "redis", "vault"):
            status = results.get(service, "✗ Unknown")
            click.echo(f"{service:15} {status}")

    asyncio.run(_check_services())


@cli.command()
@click.option("--days", default=30, help="Number of days to keep")
def cleanup_sessions(days: int) -> None:
    """Clean up expired sessions."""

    deps = _get_cli_dependencies()

    async def _cleanup() -> None:
        async with deps.session_factory() as session:
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
    deps = _get_cli_dependencies()
    import csv
    import json

    async def _export() -> None:
        async with deps.session_factory() as session:
            result = await session.execute(
                text("SELECT * FROM audit.audit_log ORDER BY event_timestamp DESC")
            )
            logs = result.fetchall()

            if format == "json":
                output = json.dumps([dict(log) for log in logs], default=str, indent=2)
                deps.path_factory("audit_logs.json").write_text(output)
                click.echo(f"Exported {len(logs)} logs to audit_logs.json")
            elif format == "csv":
                with deps.path_factory("audit_logs.csv").open("w", newline="") as file_handle:
                    if logs:
                        writer = csv.DictWriter(file_handle, fieldnames=logs[0].keys())
                        writer.writeheader()
                        writer.writerows([dict(log) for log in logs])
                click.echo(f"Exported {len(logs)} logs to audit_logs.csv")

    asyncio.run(_export())


if __name__ == "__main__":
    cli()
