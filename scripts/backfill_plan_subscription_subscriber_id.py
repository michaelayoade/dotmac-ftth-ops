#!/usr/bin/env python3
"""
Backfill script for plan_subscriptions.subscriber_id foreign key.

This script populates the subscriber_id column for existing plan_subscriptions
that were created before the FK was added.

Usage:
    # Dry run (no changes)
    poetry run python scripts/backfill_plan_subscription_subscriber_id.py --dry-run

    # Commit changes
    poetry run python scripts/backfill_plan_subscription_subscriber_id.py --commit

    # With custom batch size
    poetry run python scripts/backfill_plan_subscription_subscriber_id.py --commit --batch-size 50
"""

import argparse
import asyncio
import sys
from datetime import datetime
from typing import Dict, List

import structlog
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.customer_management.models import Customer
from dotmac.platform.database import async_session_maker
from dotmac.platform.services.internet_plans.models import PlanSubscription
from dotmac.platform.subscribers.models import Subscriber

logger = structlog.get_logger(__name__)


class BackfillStats:
    """Track backfill statistics."""

    def __init__(self):
        self.total_subscriptions = 0
        self.updated = 0
        self.skipped_no_subscriber = 0
        self.skipped_already_set = 0
        self.ambiguous_cases = 0  # Customer has multiple subscribers
        self.errors = 0
        self.ambiguous_details: List[Dict] = []

    def summary(self) -> str:
        """Return formatted summary."""
        return f"""
Backfill Summary:
================
Total subscriptions checked: {self.total_subscriptions}
Updated successfully:        {self.updated}
Skipped (already set):       {self.skipped_already_set}
Skipped (no subscriber):     {self.skipped_no_subscriber}
Ambiguous cases:             {self.ambiguous_cases}
Errors:                      {self.errors}

Success Rate: {(self.updated / max(self.total_subscriptions, 1)) * 100:.1f}%
"""


async def find_subscriber_for_customer(
    session: AsyncSession, customer_id: str, tenant_id: str
) -> tuple[str | None, int]:
    """
    Find the subscriber for a customer.

    Returns:
        Tuple of (subscriber_id, total_subscriber_count)
    """
    result = await session.execute(
        select(Subscriber.id)
        .where(
            and_(
                Subscriber.customer_id == customer_id,
                Subscriber.tenant_id == tenant_id,
                Subscriber.deleted_at.is_(None),
            )
        )
        .order_by(Subscriber.created_at)  # Deterministic: oldest first
    )
    subscribers = result.scalars().all()

    if not subscribers:
        return None, 0

    return subscribers[0], len(subscribers)


async def backfill_batch(
    session: AsyncSession,
    subscriptions: List[PlanSubscription],
    stats: BackfillStats,
    dry_run: bool = True,
) -> None:
    """Process a batch of subscriptions."""

    for subscription in subscriptions:
        stats.total_subscriptions += 1

        # Skip if already set
        if subscription.subscriber_id:
            stats.skipped_already_set += 1
            logger.debug(
                "subscription.already_has_subscriber_id",
                subscription_id=str(subscription.id),
                subscriber_id=subscription.subscriber_id,
            )
            continue

        # Find subscriber for this customer
        subscriber_id, subscriber_count = await find_subscriber_for_customer(
            session, subscription.customer_id, subscription.tenant_id
        )

        if not subscriber_id:
            stats.skipped_no_subscriber += 1
            logger.warning(
                "subscription.no_subscriber_found",
                subscription_id=str(subscription.id),
                customer_id=str(subscription.customer_id),
                tenant_id=subscription.tenant_id,
                action="skipped",
            )
            continue

        # Check for ambiguous cases (multiple subscribers)
        if subscriber_count > 1:
            stats.ambiguous_cases += 1
            ambiguous_detail = {
                "subscription_id": str(subscription.id),
                "customer_id": str(subscription.customer_id),
                "tenant_id": subscription.tenant_id,
                "subscriber_count": subscriber_count,
                "chosen_subscriber_id": subscriber_id,
            }
            stats.ambiguous_details.append(ambiguous_detail)
            logger.warning(
                "subscription.ambiguous_subscriber",
                **ambiguous_detail,
                action="using_first_subscriber",
            )

        # Update subscription
        if dry_run:
            logger.info(
                "subscription.would_update",
                subscription_id=str(subscription.id),
                subscriber_id=subscriber_id,
                mode="dry_run",
            )
        else:
            subscription.subscriber_id = subscriber_id
            stats.updated += 1
            logger.info(
                "subscription.updated",
                subscription_id=str(subscription.id),
                subscriber_id=subscriber_id,
            )


async def run_backfill(
    batch_size: int = 100, dry_run: bool = True, log_file: str = "backfill.log"
) -> BackfillStats:
    """
    Main backfill logic.

    Args:
        batch_size: Number of subscriptions to process per batch
        dry_run: If True, don't commit changes
        log_file: Path to log file for ambiguous cases

    Returns:
        BackfillStats with results
    """
    stats = BackfillStats()
    start_time = datetime.utcnow()

    logger.info(
        "backfill.started",
        mode="dry_run" if dry_run else "commit",
        batch_size=batch_size,
    )

    async with async_session_maker() as session:
        # Count total subscriptions needing backfill
        count_result = await session.execute(
            select(func.count(PlanSubscription.id)).where(
                PlanSubscription.subscriber_id.is_(None)
            )
        )
        total_count = count_result.scalar()

        logger.info(
            "backfill.subscriptions_found",
            total_count=total_count,
            batch_size=batch_size,
            batches=((total_count + batch_size - 1) // batch_size),
        )

        # Process in batches
        offset = 0
        batch_num = 1

        while True:
            # Fetch batch
            result = await session.execute(
                select(PlanSubscription)
                .where(PlanSubscription.subscriber_id.is_(None))
                .limit(batch_size)
                .offset(offset)
            )
            subscriptions = result.scalars().all()

            if not subscriptions:
                break

            logger.info(
                "backfill.processing_batch",
                batch=batch_num,
                count=len(subscriptions),
                progress=f"{min(offset + batch_size, total_count)}/{total_count}",
            )

            # Process batch
            await backfill_batch(session, subscriptions, stats, dry_run=dry_run)

            # Commit if not dry run
            if not dry_run:
                await session.commit()
                logger.info(
                    "backfill.batch_committed",
                    batch=batch_num,
                    updated=stats.updated,
                )

            offset += batch_size
            batch_num += 1

    # Write ambiguous cases to log file
    if stats.ambiguous_details:
        with open(log_file, "w") as f:
            f.write("Ambiguous Cases (customers with multiple subscribers)\n")
            f.write("=" * 80 + "\n\n")
            for detail in stats.ambiguous_details:
                f.write(f"Subscription ID: {detail['subscription_id']}\n")
                f.write(f"Customer ID:     {detail['customer_id']}\n")
                f.write(f"Tenant ID:       {detail['tenant_id']}\n")
                f.write(f"Subscriber Count: {detail['subscriber_count']}\n")
                f.write(f"Chosen Subscriber: {detail['chosen_subscriber_id']}\n")
                f.write("-" * 80 + "\n\n")

        logger.info(
            "backfill.ambiguous_cases_logged",
            count=len(stats.ambiguous_details),
            log_file=log_file,
        )

    duration = (datetime.utcnow() - start_time).total_seconds()
    logger.info(
        "backfill.completed",
        mode="dry_run" if dry_run else "commit",
        duration_seconds=duration,
        **{
            "total_checked": stats.total_subscriptions,
            "updated": stats.updated,
            "skipped_no_subscriber": stats.skipped_no_subscriber,
            "skipped_already_set": stats.skipped_already_set,
            "ambiguous": stats.ambiguous_cases,
            "errors": stats.errors,
        },
    )

    return stats


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Backfill plan_subscriptions.subscriber_id foreign key"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run without committing changes (default)",
    )
    parser.add_argument(
        "--commit", action="store_true", help="Commit changes to database"
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=100,
        help="Number of subscriptions to process per batch (default: 100)",
    )
    parser.add_argument(
        "--log-file",
        type=str,
        default="backfill_ambiguous_cases.log",
        help="Log file for ambiguous cases (default: backfill_ambiguous_cases.log)",
    )

    args = parser.parse_args()

    # Validate arguments
    if args.commit and args.dry_run:
        print("Error: Cannot specify both --commit and --dry-run")
        sys.exit(1)

    dry_run = not args.commit

    if dry_run:
        print("\n⚠️  DRY RUN MODE - No changes will be committed\n")
    else:
        print("\n✅ COMMIT MODE - Changes will be persisted\n")
        response = input("Are you sure you want to proceed? (yes/no): ")
        if response.lower() != "yes":
            print("Aborted.")
            sys.exit(0)

    # Run backfill
    stats = asyncio.run(
        run_backfill(
            batch_size=args.batch_size, dry_run=dry_run, log_file=args.log_file
        )
    )

    # Print summary
    print(stats.summary())

    if stats.ambiguous_cases > 0:
        print(f"\n⚠️  {stats.ambiguous_cases} ambiguous cases detected!")
        print(f"   Review {args.log_file} for details")
        print("   Manual verification recommended for these subscriptions\n")

    if dry_run:
        print("\n💡 This was a dry run. To commit changes, run with --commit\n")

    # Exit code
    if stats.errors > 0:
        sys.exit(1)
    else:
        sys.exit(0)


if __name__ == "__main__":
    main()
