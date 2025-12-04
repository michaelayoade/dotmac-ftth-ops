#!/usr/bin/env python3
"""
Database Seeding Script

This script seeds the database with test data for different environments.
It combines multiple seeding scripts and provides a unified interface.

Usage:
    python scripts/seed_data.py --env=development
    python scripts/seed_data.py --env=staging --clear
    python scripts/seed_data.py --help
"""

import argparse
import asyncio
import logging
import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "src"))

from dotmac.platform.db import AsyncSessionLocal as async_session_maker
from dotmac.platform.settings import get_settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


async def clear_database(db):
    """Clear all data from database (except migrations)."""
    from sqlalchemy import text

    logger.warning("⚠️  Clearing all data from database...")

    # Get all table names
    result = await db.execute(
        text(
            """
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename != 'alembic_version'
        ORDER BY tablename
    """
        )
    )
    tables = [row[0] for row in result.fetchall()]

    if not tables:
        logger.info("No tables to clear")
        return

    # Disable foreign key checks temporarily
    await db.execute(text("SET session_replication_role = 'replica';"))

    # Truncate all tables
    for table in tables:
        logger.info(f"  Clearing table: {table}")
        await db.execute(text(f'TRUNCATE TABLE "{table}" CASCADE'))

    # Re-enable foreign key checks
    await db.execute(text("SET session_replication_role = 'origin';"))

    await db.commit()
    logger.info("✅ Database cleared successfully")


async def seed_demo_data(db):
    """Seed demo data for staging/development."""
    logger.info("📦 Seeding demo data...")

    try:
        # Import and run seed_demo_data
        from scripts.seed_demo_data import (
            create_demo_customers,
            create_demo_subscriptions,
            create_demo_tenant,
            create_demo_users,
        )

        # Create demo tenant
        tenant = await create_demo_tenant(db)
        logger.info(f"✓ Created demo tenant: {tenant.name}")

        # Create demo users
        users = await create_demo_users(db, tenant)
        logger.info(f"✓ Created {len(users)} demo users")

        # Create demo customers
        customers = await create_demo_customers(db, tenant)
        logger.info(f"✓ Created {len(customers)} demo customers")

        # Create demo subscriptions
        await create_demo_subscriptions(db, tenant, customers)
        logger.info(f"✓ Created demo subscriptions")

        await db.commit()
        logger.info("✅ Demo data seeded successfully")

        return {
            "tenant": tenant,
            "users": users,
            "customers": customers,
        }

    except Exception as e:
        logger.error(f"❌ Error seeding demo data: {e}", exc_info=True)
        await db.rollback()
        raise


async def seed_rbac_data(db):
    """Seed RBAC roles and permissions."""
    logger.info("🔐 Seeding RBAC data...")

    try:
        # Import RBAC seeding logic
        from scripts.seed_rbac_simple import seed_rbac

        await seed_rbac(db)
        await db.commit()
        logger.info("✅ RBAC data seeded successfully")

    except ImportError:
        logger.warning("⚠️  RBAC seeding script not found, skipping...")
    except Exception as e:
        logger.error(f"❌ Error seeding RBAC data: {e}", exc_info=True)
        await db.rollback()
        raise


async def seed_test_users(db):
    """Seed test users for development."""
    logger.info("👥 Seeding test users...")

    try:
        # Import test user seeding logic
        from scripts.seed_test_users import main as seed_users_main

        await seed_users_main()
        logger.info("✅ Test users seeded successfully")

    except ImportError:
        logger.warning("⚠️  Test users seeding script not found, skipping...")
    except Exception as e:
        logger.error(f"❌ Error seeding test users: {e}", exc_info=True)
        await db.rollback()
        # Don't raise - this is optional


async def seed_database(env: str, clear: bool = False):
    """Main seeding function."""
    settings = get_settings()

    logger.info("=" * 60)
    logger.info(f"🌱 Database Seeding - {env.upper()} Environment")
    logger.info("=" * 60)
    logger.info(f"Database: {settings.database.host}:{settings.database.port}/{settings.database.database}")
    logger.info(f"Environment: {settings.environment.value}")
    logger.info("=" * 60)

    # Safety check for production
    if settings.environment.value == "production" and not settings.allow_destructive_operations:
        logger.error("❌ Cannot seed production database without ALLOW_DESTRUCTIVE_OPERATIONS=true")
        sys.exit(1)

    async with async_session_maker() as db:
        try:
            # Clear database if requested
            if clear:
                confirm = input("\n⚠️  This will DELETE ALL DATA. Type 'yes' to confirm: ")
                if confirm.lower() != "yes":
                    logger.info("Aborted by user")
                    return
                await clear_database(db)
                print()

            # Seed based on environment
            if env in ["development", "staging", "demo"]:
                # Seed RBAC first
                await seed_rbac_data(db)

                # Seed demo data
                result = await seed_demo_data(db)

                # Display summary
                print()
                logger.info("=" * 60)
                logger.info("✅ SEEDING COMPLETED SUCCESSFULLY")
                logger.info("=" * 60)
                logger.info(f"Tenant: {result['tenant'].name} (ID: {result['tenant'].id})")
                logger.info(f"Users: {len(result['users'])} created")
                logger.info(f"Customers: {len(result['customers'])} created")
                logger.info("")
                logger.info("Demo User Credentials:")
                logger.info("  Admin:        admin@dotmac.com / Admin123!")
                logger.info("  ISP Admin:    isp-admin@demo.com / IspAdmin123!")
                logger.info("  Billing:      billing@demo.com / Billing123!")
                logger.info("  Support:      support@demo.com / Support123!")
                logger.info("  Customer:     customer@demo.com / Customer123!")
                logger.info("=" * 60)

            elif env == "test":
                logger.info("Test environment - minimal seeding")
                await seed_rbac_data(db)
                logger.info("✅ Test data seeded successfully")

            else:
                logger.error(f"❌ Unknown environment: {env}")
                sys.exit(1)

        except Exception as e:
            logger.error(f"❌ Seeding failed: {e}", exc_info=True)
            sys.exit(1)


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Seed database with test data",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --env=development           # Seed development database
  %(prog)s --env=staging --clear       # Clear and reseed staging
  %(prog)s --env=demo                  # Seed demo database

Environments:
  development    Full demo data for local development
  staging        Full demo data for staging environment
  demo           Full demo data for demo environment
  test           Minimal data for testing
        """,
    )

    parser.add_argument(
        "--env",
        type=str,
        required=True,
        choices=["development", "staging", "demo", "test"],
        help="Target environment",
    )

    parser.add_argument(
        "--clear",
        action="store_true",
        help="Clear all existing data before seeding",
    )

    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable verbose logging",
    )

    args = parser.parse_args()

    # Set logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Run seeding
    try:
        asyncio.run(seed_database(args.env, args.clear))
    except KeyboardInterrupt:
        logger.info("\n⚠️  Interrupted by user")
        sys.exit(130)
    except Exception as e:
        logger.error(f"❌ Fatal error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
