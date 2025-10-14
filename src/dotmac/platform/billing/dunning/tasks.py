"""
Celery tasks for dunning & collections automation.

Provides background workers for executing scheduled dunning actions.
"""

import asyncio
from concurrent.futures import Future
from datetime import UTC, datetime
from typing import Any, Coroutine
from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.celery_app import celery_app
from dotmac.platform.db import _async_session_maker

from .models import DunningActionType, DunningExecution, DunningExecutionStatus
from .service import DunningService

logger = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------


def _run_async[T](coro: Coroutine[Any, Any, T]) -> T:
    """Execute an async coroutine from a synchronous Celery task."""
    try:
        return asyncio.run(coro)
    except RuntimeError:
        # Fallback for contexts where an event loop is already running (tests).
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:  # pragma: no cover - defensive
            loop = asyncio.new_event_loop()
            try:
                return loop.run_until_complete(coro)
            finally:  # pragma: no cover - defensive clean-up
                loop.close()

        if loop.is_running():
            future: Future[T] = asyncio.run_coroutine_threadsafe(coro, loop)
            return future.result()
        return loop.run_until_complete(coro)


# ---------------------------------------------------------------------------
# Dunning Tasks
# ---------------------------------------------------------------------------


@celery_app.task(
    name="dunning.process_pending_actions",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def process_pending_dunning_actions_task(self) -> dict[str, Any]:
    """
    Periodic task to process pending dunning actions.

    Polls for executions with actions ready to execute and processes them.
    This task should run every 5-10 minutes via Celery beat.

    Returns:
        dict: Processing results including counts and errors
    """
    logger.info("dunning.task.started", task="process_pending_actions")

    try:
        result = _run_async(_process_pending_actions())
        logger.info(
            "dunning.task.completed",
            task="process_pending_actions",
            processed=result["processed"],
            errors=result["errors"],
        )
        return result
    except Exception as e:
        logger.error(
            "dunning.task.failed",
            task="process_pending_actions",
            error=str(e),
            error_type=type(e).__name__,
        )
        raise self.retry(exc=e)


@celery_app.task(
    name="dunning.execute_action",
    bind=True,
    max_retries=3,
    default_retry_delay=300,  # 5 minutes
)
def execute_dunning_action_task(
    self,
    execution_id: str,
    action_config: dict[str, Any],
    step_number: int,
) -> dict[str, Any]:
    """
    Execute a single dunning action for an execution.

    Args:
        execution_id: UUID of the dunning execution
        action_config: Action configuration dict
        step_number: Step number in the action sequence

    Returns:
        dict: Execution result including status and details
    """
    logger.info(
        "dunning.action.started",
        execution_id=execution_id,
        action_type=action_config.get("type"),
        step=step_number,
    )

    try:
        result = _run_async(
            _execute_action(
                execution_id=UUID(execution_id),
                action_config=action_config,
                step_number=step_number,
            )
        )
        logger.info(
            "dunning.action.completed",
            execution_id=execution_id,
            step=step_number,
            status=result["status"],
        )
        return result
    except Exception as e:
        logger.error(
            "dunning.action.failed",
            execution_id=execution_id,
            step=step_number,
            error=str(e),
            error_type=type(e).__name__,
        )
        raise self.retry(exc=e)


# ---------------------------------------------------------------------------
# Async Helper Functions
# ---------------------------------------------------------------------------


async def _process_pending_actions() -> dict[str, Any]:
    """
    Process all pending dunning actions.

    Returns:
        dict: Processing statistics
    """
    processed = 0
    errors = 0
    results = []

    async with _async_session_maker() as session:
        service = DunningService(session)

        # Get all tenants with pending actions (we'll iterate through all)
        # In production, you might want to query distinct tenant_ids first
        executions = await service.get_pending_actions(tenant_id="", limit=100)

        for execution in executions:
            try:
                # Get campaign to retrieve actions
                campaign = await service.get_campaign(
                    campaign_id=execution.campaign_id,
                    tenant_id=execution.tenant_id,
                )

                if not campaign or not campaign.is_active:
                    logger.warning(
                        "dunning.execution.inactive_campaign",
                        execution_id=execution.id,
                        campaign_id=execution.campaign_id,
                    )
                    continue

                # Get the current action to execute
                if execution.current_step >= len(campaign.actions):
                    # All actions completed
                    await _complete_execution(session, execution)
                    processed += 1
                    continue

                action_config = campaign.actions[execution.current_step]

                # Execute the action
                result = await _execute_action(
                    execution_id=execution.id,
                    action_config=action_config,
                    step_number=execution.current_step,
                )

                results.append(result)
                processed += 1

            except Exception as e:
                logger.error(
                    "dunning.execution.processing_error",
                    execution_id=execution.id,
                    error=str(e),
                )
                errors += 1

        await session.commit()

    return {
        "processed": processed,
        "errors": errors,
        "total_executions": len(executions),
        "timestamp": datetime.now(UTC).isoformat(),
        "results": results[:10],  # Return first 10 results
    }


async def _execute_action(
    execution_id: UUID,
    action_config: dict[str, Any],
    step_number: int,
) -> dict[str, Any]:
    """
    Execute a specific dunning action.

    Args:
        execution_id: Execution UUID
        action_config: Action configuration
        step_number: Current step number

    Returns:
        dict: Execution result
    """
    action_type = DunningActionType(action_config["type"])
    executed_at = datetime.now(UTC)

    logger.info(
        "dunning.action.executing",
        execution_id=execution_id,
        action_type=action_type,
        step=step_number,
    )

    result: dict[str, Any] = {
        "status": "pending",
        "action_type": action_type.value,
        "step_number": step_number,
        "executed_at": executed_at.isoformat(),
        "details": {},
    }

    try:
        async with _async_session_maker() as session:
            service = DunningService(session)

            # Get execution details
            execution = await service.get_execution(
                execution_id=execution_id,
                tenant_id="",  # Will be filtered in service
            )

            if not execution:
                result["status"] = "failed"
                result["error"] = "Execution not found"
                return result

            # Route to appropriate action handler
            if action_type == DunningActionType.EMAIL:
                result = await _send_dunning_email(execution, action_config)
            elif action_type == DunningActionType.SMS:
                result = await _send_dunning_sms(execution, action_config)
            elif action_type == DunningActionType.SUSPEND_SERVICE:
                result = await _suspend_service(execution, action_config)
            elif action_type == DunningActionType.TERMINATE_SERVICE:
                result = await _terminate_service(execution, action_config)
            elif action_type == DunningActionType.WEBHOOK:
                result = await _trigger_webhook(execution, action_config)
            elif action_type == DunningActionType.CUSTOM:
                result = await _execute_custom_action(execution, action_config)
            else:
                result["status"] = "failed"
                result["error"] = f"Unknown action type: {action_type}"

            # Log the action execution
            from .models import DunningActionLog

            action_log = DunningActionLog(
                execution_id=execution_id,
                action_type=action_type,
                action_config=action_config,
                step_number=step_number,
                executed_at=executed_at,
                status=result["status"],
                result=result.get("details", {}),
                error_message=result.get("error"),
                external_id=result.get("external_id"),
            )
            session.add(action_log)

            # Update execution progress
            execution.current_step = step_number + 1
            execution.execution_log.append(
                {
                    "step": step_number,
                    "action": action_type.value,
                    "status": result["status"],
                    "timestamp": executed_at.isoformat(),
                }
            )

            # Calculate next action time if there are more steps
            campaign = await service.get_campaign(
                campaign_id=execution.campaign_id,
                tenant_id=execution.tenant_id,
            )

            if execution.current_step < len(campaign.actions):
                next_action = campaign.actions[execution.current_step]
                delay_days = next_action.get("delay_days", 0)
                from datetime import timedelta

                execution.next_action_at = datetime.now(UTC) + timedelta(days=delay_days)
                execution.status = DunningExecutionStatus.IN_PROGRESS
            else:
                # All actions completed
                await _complete_execution(session, execution)

            await session.commit()

    except Exception as e:
        logger.error(
            "dunning.action.exception",
            execution_id=execution_id,
            action_type=action_type,
            error=str(e),
            error_type=type(e).__name__,
        )
        result["status"] = "failed"
        result["error"] = str(e)

    return result


# ---------------------------------------------------------------------------
# Action Handlers (Stubs for Integration)
# ---------------------------------------------------------------------------


async def _send_dunning_email(
    execution: DunningExecution,
    action_config: dict[str, Any],
) -> dict[str, Any]:
    """
    Send dunning email notification.

    TODO: Integrate with communications module
    """
    logger.info(
        "dunning.email.sending",
        execution_id=execution.id,
        customer_id=execution.customer_id,
        template=action_config.get("template"),
    )

    # Placeholder - integrate with communications.task_service
    # from dotmac.platform.communications.task_service import send_single_email_task
    # email_message = EmailMessage(
    #     to=[customer.email],
    #     subject="Payment Reminder",
    #     body=render_template(action_config["template"], execution),
    # )
    # result = send_single_email_task.delay(email_message.model_dump())

    return {
        "status": "success",
        "action_type": "email",
        "details": {
            "template": action_config.get("template"),
            "customer_id": str(execution.customer_id),
        },
        "external_id": f"email_{execution.id}",
    }


async def _send_dunning_sms(
    execution: DunningExecution,
    action_config: dict[str, Any],
) -> dict[str, Any]:
    """
    Send dunning SMS notification.

    TODO: Integrate with SMS provider
    """
    logger.info(
        "dunning.sms.sending",
        execution_id=execution.id,
        customer_id=execution.customer_id,
    )

    return {
        "status": "success",
        "action_type": "sms",
        "details": {
            "template": action_config.get("template"),
            "customer_id": str(execution.customer_id),
        },
        "external_id": f"sms_{execution.id}",
    }


async def _suspend_service(
    execution: DunningExecution,
    action_config: dict[str, Any],
) -> dict[str, Any]:
    """
    Suspend customer service.

    TODO: Integrate with service lifecycle management
    """
    logger.info(
        "dunning.service.suspending",
        execution_id=execution.id,
        subscription_id=execution.subscription_id,
    )

    # Placeholder - integrate with subscription service
    # from dotmac.platform.billing.subscriptions.service import SubscriptionService
    # await subscription_service.suspend(execution.subscription_id)

    return {
        "status": "success",
        "action_type": "suspend_service",
        "details": {
            "subscription_id": execution.subscription_id,
            "suspended_at": datetime.now(UTC).isoformat(),
        },
    }


async def _terminate_service(
    execution: DunningExecution,
    action_config: dict[str, Any],
) -> dict[str, Any]:
    """
    Terminate customer service.

    TODO: Integrate with service lifecycle management
    """
    logger.info(
        "dunning.service.terminating",
        execution_id=execution.id,
        subscription_id=execution.subscription_id,
    )

    # Placeholder - integrate with subscription service
    # from dotmac.platform.billing.subscriptions.service import SubscriptionService
    # await subscription_service.terminate(execution.subscription_id)

    return {
        "status": "success",
        "action_type": "terminate_service",
        "details": {
            "subscription_id": execution.subscription_id,
            "terminated_at": datetime.now(UTC).isoformat(),
        },
    }


async def _trigger_webhook(
    execution: DunningExecution,
    action_config: dict[str, Any],
) -> dict[str, Any]:
    """
    Trigger webhook for external system integration.

    TODO: Implement HTTP webhook delivery
    """
    webhook_url = action_config.get("webhook_url")

    logger.info(
        "dunning.webhook.triggering",
        execution_id=execution.id,
        webhook_url=webhook_url,
    )

    # Placeholder - implement HTTP POST to webhook_url
    # import httpx
    # async with httpx.AsyncClient() as client:
    #     response = await client.post(
    #         webhook_url,
    #         json={
    #             "event": "dunning.action",
    #             "execution_id": str(execution.id),
    #             "subscription_id": execution.subscription_id,
    #             "outstanding_amount": execution.outstanding_amount,
    #         }
    #     )

    return {
        "status": "success",
        "action_type": "webhook",
        "details": {
            "webhook_url": webhook_url,
            "triggered_at": datetime.now(UTC).isoformat(),
        },
    }


async def _execute_custom_action(
    execution: DunningExecution,
    action_config: dict[str, Any],
) -> dict[str, Any]:
    """
    Execute custom dunning action.

    TODO: Implement plugin system for custom actions
    """
    logger.info(
        "dunning.custom.executing",
        execution_id=execution.id,
        custom_config=action_config.get("custom_config"),
    )

    return {
        "status": "success",
        "action_type": "custom",
        "details": action_config.get("custom_config", {}),
    }


async def _complete_execution(
    session: AsyncSession,
    execution: DunningExecution,
) -> None:
    """
    Mark execution as completed.

    Args:
        session: Database session
        execution: Execution to complete
    """
    execution.status = DunningExecutionStatus.COMPLETED
    execution.completed_at = datetime.now(UTC)
    execution.next_action_at = None

    # Update campaign statistics
    from sqlalchemy import select

    from .models import DunningCampaign

    stmt = select(DunningCampaign).where(DunningCampaign.id == execution.campaign_id)
    result = await session.execute(stmt)
    campaign = result.scalar_one_or_none()

    if campaign:
        campaign.successful_executions += 1
        campaign.total_recovered_amount += execution.recovered_amount

    logger.info(
        "dunning.execution.completed",
        execution_id=execution.id,
        campaign_id=execution.campaign_id,
        recovered_amount=execution.recovered_amount,
    )


__all__ = [
    "process_pending_dunning_actions_task",
    "execute_dunning_action_task",
]
