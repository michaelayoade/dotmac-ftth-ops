"""
Celery tasks for dunning & collections automation.

Provides background workers for executing scheduled dunning actions.
"""

import asyncio
from collections.abc import Coroutine
from concurrent.futures import Future
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import structlog
from celery import Task
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.celery_app import celery_app
from dotmac.platform.db import async_session_maker
from dotmac.platform.tenant import get_current_tenant_id, set_current_tenant_id

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


def _set_tenant_context(tenant_id: str) -> str | None:
    """Set tenant context and return previous."""
    previous = get_current_tenant_id()
    set_current_tenant_id(tenant_id)
    return previous


# ---------------------------------------------------------------------------
# Dunning Tasks
# ---------------------------------------------------------------------------


@celery_app.task(  # type: ignore[misc]  # Celery decorator is untyped
    name="dunning.process_pending_actions",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def process_pending_dunning_actions_task(self: Task) -> dict[str, Any]:
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


@celery_app.task(  # type: ignore[misc]  # Celery decorator is untyped
    name="dunning.execute_action",
    bind=True,
    max_retries=3,
    default_retry_delay=300,  # 5 minutes
)
def execute_dunning_action_task(
    self: Task,
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

    async with async_session_maker() as session:
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
        async with async_session_maker() as session:
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
                result["status"] = "failed"  # type: ignore[unreachable]  # Fallback for unknown action types
                result["error"] = f"Unknown action type: {action_type}"

            # Log the action execution
            from .models import DunningActionLog

            action_log = DunningActionLog(
                execution_id=execution_id,
                action_type=action_type,
                action_config=action_config,
                step_number=step_number,
                attempted_at=executed_at,
                completed_at=datetime.now(UTC),
                success=result.get("status") == "success",
                response_data=result.get("details", {}),
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

    Integrates with communications module to send templated emails.
    """
    logger.info(
        "dunning.email.sending",
        execution_id=execution.id,
        customer_id=execution.customer_id,
        template=action_config.get("template"),
    )

    try:
        # Import communications service
        from dotmac.platform.communications.task_service import send_single_email_task

        # Get customer email - would need to query customer service
        async with async_session_maker() as session:
            from dotmac.platform.customer_management.service import CustomerService

            customer_service = CustomerService(session)
            previous_tenant = _set_tenant_context(execution.tenant_id)
            try:
                customer = await customer_service.get_customer(customer_id=execution.customer_id)
            finally:
                set_current_tenant_id(previous_tenant)

            if not customer or not customer.email:
                return {
                    "status": "failed",
                    "action_type": "email",
                    "error": "Customer email not found",
                    "details": {"customer_id": str(execution.customer_id)},
                }

            # Prepare email data
            template_name = action_config.get("template", "dunning_reminder")
            subject = action_config.get("subject", "Payment Reminder")

            # Send email asynchronously via Celery
            task = send_single_email_task.delay(
                to_email=customer.email,
                subject=subject,
                template_name=template_name,
                context={
                    "customer_name": customer.name,
                    "outstanding_amount": str(execution.outstanding_amount),
                    "subscription_id": execution.subscription_id,
                    "due_date": execution.created_at.isoformat(),
                },
                tenant_id=execution.tenant_id,
            )

            return {
                "status": "success",
                "action_type": "email",
                "details": {
                    "template": template_name,
                    "customer_id": str(execution.customer_id),
                    "customer_email": customer.email,
                    "subject": subject,
                },
                "external_id": task.id,
            }

    except Exception as e:
        logger.error(
            "dunning.email.failed",
            execution_id=execution.id,
            error=str(e),
            error_type=type(e).__name__,
        )
        return {
            "status": "failed",
            "action_type": "email",
            "error": str(e),
            "details": {"customer_id": str(execution.customer_id)},
        }


async def _send_dunning_sms(
    execution: DunningExecution,
    action_config: dict[str, Any],
) -> dict[str, Any]:
    """
    Send dunning SMS notification.

    Integrates with SMS provider (Twilio) via integrations module.
    """
    logger.info(
        "dunning.sms.sending",
        execution_id=execution.id,
        customer_id=execution.customer_id,
    )

    try:
        # Get customer phone number
        async with async_session_maker() as session:
            from dotmac.platform.customer_management.service import CustomerService

            customer_service = CustomerService(session)
            previous_tenant = _set_tenant_context(execution.tenant_id)
            try:
                customer = await customer_service.get_customer(customer_id=execution.customer_id)
            finally:
                set_current_tenant_id(previous_tenant)

            if not customer or not customer.phone:
                return {
                    "status": "failed",
                    "action_type": "sms",
                    "error": "Customer phone not found",
                    "details": {"customer_id": str(execution.customer_id)},
                }

            # Get SMS integration
            from dotmac.platform.integrations import get_integration_async

            sms_integration = await get_integration_async("sms")

            if not sms_integration:
                return {
                    "status": "failed",
                    "action_type": "sms",
                    "error": "SMS integration not configured",
                    "details": {"customer_id": str(execution.customer_id)},
                }

            # Send SMS
            message_text = action_config.get(
                "message",
                f"Payment reminder: ${execution.outstanding_amount} outstanding. "
                f"Please update your payment method.",
            )

            result = await sms_integration.send_sms(to=customer.phone, message=message_text)

            return {
                "status": result.get("status", "success"),
                "action_type": "sms",
                "details": {
                    "customer_id": str(execution.customer_id),
                    "phone": customer.phone,
                    "message_length": len(message_text),
                },
                "external_id": result.get("message_id", f"sms_{execution.id}"),
            }

    except Exception as e:
        logger.error(
            "dunning.sms.failed",
            execution_id=execution.id,
            error=str(e),
            error_type=type(e).__name__,
        )
        return {
            "status": "failed",
            "action_type": "sms",
            "error": str(e),
            "details": {"customer_id": str(execution.customer_id)},
        }


async def _suspend_service(
    execution: DunningExecution,
    action_config: dict[str, Any],
) -> dict[str, Any]:
    """
    Suspend customer service.

    Integrates with service lifecycle management to suspend services.
    """
    logger.info(
        "dunning.service.suspending",
        execution_id=execution.id,
        subscription_id=execution.subscription_id,
    )

    try:
        if not execution.subscription_id:
            return {
                "status": "failed",
                "action_type": "suspend_service",
                "error": "No subscription ID provided",
                "details": {"execution_id": str(execution.id)},
            }

        # Check if service lifecycle integration exists
        try:
            from dotmac.platform.services.lifecycle.service import LifecycleOrchestrationService

            async with async_session_maker() as session:
                lifecycle_service = LifecycleOrchestrationService(session)

                try:
                    service_instance_uuid = UUID(execution.subscription_id)
                except (ValueError, TypeError):
                    raise ValueError(
                        f"Invalid subscription ID for lifecycle suspend: {execution.subscription_id}"
                    ) from None

                await lifecycle_service.suspend_service(
                    tenant_id=execution.tenant_id,
                    service_instance_id=service_instance_uuid,
                    reason="dunning_non_payment",
                    metadata={
                        "execution_id": str(execution.id),
                        "outstanding_amount": str(execution.outstanding_amount),
                    },
                )

                await session.commit()

                return {
                    "status": "success",
                    "action_type": "suspend_service",
                    "details": {
                        "subscription_id": execution.subscription_id,
                        "suspended_at": datetime.now(UTC).isoformat(),
                        "reason": "dunning_non_payment",
                    },
                }

        except ImportError:
            # Fallback if service lifecycle not available - use subscription service directly
            from dotmac.platform.billing.subscriptions.service import SubscriptionService

            async with async_session_maker() as session:
                subscription_service = SubscriptionService(session)

                await subscription_service.cancel_subscription(
                    subscription_id=str(execution.subscription_id),
                    tenant_id=str(execution.tenant_id),
                    at_period_end=False,
                )

                await session.commit()

                return {
                    "status": "success",
                    "action_type": "suspend_service",
                    "details": {
                        "subscription_id": execution.subscription_id,
                        "suspended_at": datetime.now(UTC).isoformat(),
                        "method": "subscription_service_fallback",
                    },
                }

    except Exception as e:
        logger.error(
            "dunning.suspend.failed",
            execution_id=execution.id,
            error=str(e),
            error_type=type(e).__name__,
        )
        return {
            "status": "failed",
            "action_type": "suspend_service",
            "error": str(e),
            "details": {"subscription_id": execution.subscription_id},
        }


async def _terminate_service(
    execution: DunningExecution,
    action_config: dict[str, Any],
) -> dict[str, Any]:
    """
    Terminate customer service.

    Integrates with service lifecycle management to terminate services.
    """
    logger.info(
        "dunning.service.terminating",
        execution_id=execution.id,
        subscription_id=execution.subscription_id,
    )

    try:
        if not execution.subscription_id:
            return {
                "status": "failed",
                "action_type": "terminate_service",
                "error": "No subscription ID provided",
                "details": {"execution_id": str(execution.id)},
            }

        # Check if service lifecycle integration exists
        try:
            from dotmac.platform.services.lifecycle.service import LifecycleOrchestrationService

            async with async_session_maker() as session:
                lifecycle_service = LifecycleOrchestrationService(session)

                try:
                    service_instance_uuid = UUID(execution.subscription_id)
                except (ValueError, TypeError):
                    raise ValueError(
                        f"Invalid subscription ID for lifecycle terminate: {execution.subscription_id}"
                    ) from None

                await lifecycle_service.terminate_service(
                    tenant_id=execution.tenant_id,
                    service_instance_id=service_instance_uuid,
                    reason="dunning_final_action",
                    metadata={
                        "execution_id": str(execution.id),
                        "outstanding_amount": str(execution.outstanding_amount),
                        "final_notice": True,
                    },
                )

                await session.commit()

                return {
                    "status": "success",
                    "action_type": "terminate_service",
                    "details": {
                        "subscription_id": execution.subscription_id,
                        "terminated_at": datetime.now(UTC).isoformat(),
                        "reason": "dunning_final_action",
                    },
                }

        except ImportError:
            # Fallback if service lifecycle not available - use subscription service directly
            from dotmac.platform.billing.subscriptions.service import SubscriptionService

            async with async_session_maker() as session:
                subscription_service = SubscriptionService(session)

                # Cancel subscription (simplified fallback)
                await subscription_service.cancel_subscription(
                    subscription_id=str(execution.subscription_id),
                    tenant_id=str(execution.tenant_id),
                    at_period_end=False,
                )

                await session.commit()

                return {
                    "status": "success",
                    "action_type": "terminate_service",
                    "details": {
                        "subscription_id": execution.subscription_id,
                        "terminated_at": datetime.now(UTC).isoformat(),
                        "method": "subscription_cancellation_fallback",
                    },
                }

    except Exception as e:
        logger.error(
            "dunning.terminate.failed",
            execution_id=execution.id,
            error=str(e),
            error_type=type(e).__name__,
        )
        return {
            "status": "failed",
            "action_type": "terminate_service",
            "error": str(e),
            "details": {"subscription_id": execution.subscription_id},
        }


async def _trigger_webhook(
    execution: DunningExecution,
    action_config: dict[str, Any],
) -> dict[str, Any]:
    """
    Trigger webhook for external system integration.

    Sends HTTP POST request to configured webhook URL with dunning event data.
    """
    webhook_url = action_config.get("webhook_url")

    if not webhook_url:
        return {
            "status": "failed",
            "action_type": "webhook",
            "error": "No webhook URL configured",
            "details": {"execution_id": str(execution.id)},
        }

    logger.info(
        "dunning.webhook.triggering",
        execution_id=execution.id,
        webhook_url=webhook_url,
    )

    try:
        import httpx

        # Prepare webhook payload
        payload = {
            "event": "dunning.action",
            "event_type": "dunning_notification",
            "timestamp": datetime.now(UTC).isoformat(),
            "data": {
                "execution_id": str(execution.id),
                "customer_id": str(execution.customer_id),
                "subscription_id": execution.subscription_id,
                "outstanding_amount": str(execution.outstanding_amount),
                "recovered_amount": str(execution.recovered_amount),
                "current_step": execution.current_step,
                "status": (
                    execution.status.value
                    if hasattr(execution.status, "value")
                    else str(execution.status)
                ),
                "tenant_id": execution.tenant_id,
            },
            "metadata": action_config.get("metadata", {}),
        }

        # Add custom headers if configured
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "DotMac-Dunning/1.0",
        }

        # Add authentication if configured
        webhook_secret = action_config.get("webhook_secret")
        if webhook_secret:
            import hashlib
            import hmac
            import json

            payload_bytes = json.dumps(payload).encode("utf-8")
            signature = hmac.new(
                webhook_secret.encode("utf-8"), payload_bytes, hashlib.sha256
            ).hexdigest()
            headers["X-Webhook-Signature"] = signature

        # Send webhook with timeout and retry
        timeout = httpx.Timeout(10.0, connect=5.0)

        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                webhook_url,
                json=payload,
                headers=headers,
            )

            response.raise_for_status()

            logger.info(
                "dunning.webhook.success",
                execution_id=execution.id,
                webhook_url=webhook_url,
                status_code=response.status_code,
            )

            return {
                "status": "success",
                "action_type": "webhook",
                "details": {
                    "webhook_url": webhook_url,
                    "status_code": response.status_code,
                    "triggered_at": datetime.now(UTC).isoformat(),
                    "response_time_ms": response.elapsed.total_seconds() * 1000,
                },
                "external_id": f"webhook_{execution.id}",
            }

    except httpx.HTTPStatusError as e:
        logger.error(
            "dunning.webhook.http_error",
            execution_id=execution.id,
            webhook_url=webhook_url,
            status_code=e.response.status_code,
            error=str(e),
        )
        return {
            "status": "failed",
            "action_type": "webhook",
            "error": f"HTTP {e.response.status_code}: {str(e)}",
            "details": {
                "webhook_url": webhook_url,
                "status_code": e.response.status_code,
            },
        }

    except httpx.TimeoutException:
        logger.error(
            "dunning.webhook.timeout",
            execution_id=execution.id,
            webhook_url=webhook_url,
        )
        return {
            "status": "failed",
            "action_type": "webhook",
            "error": "Webhook request timed out",
            "details": {"webhook_url": webhook_url},
        }

    except Exception as e:
        logger.error(
            "dunning.webhook.failed",
            execution_id=execution.id,
            webhook_url=webhook_url,
            error=str(e),
            error_type=type(e).__name__,
        )
        return {
            "status": "failed",
            "action_type": "webhook",
            "error": str(e),
            "details": {"webhook_url": webhook_url},
        }


async def _execute_custom_action(
    execution: DunningExecution,
    action_config: dict[str, Any],
) -> dict[str, Any]:
    """
    Execute custom dunning action.

    Supports plugin-based custom actions through dynamic import.
    Configure via action_config:
    {
        "type": "custom",
        "handler": "module.path.to.custom_handler",  # Python import path
        "config": {...}  # Custom configuration passed to handler
    }

    Handler signature: async def handler(execution: DunningExecution, config: dict[str, Any]) -> dict[str, Any]
    """
    logger.info(
        "dunning.custom.executing",
        execution_id=execution.id,
        custom_config=action_config.get("custom_config"),
    )

    try:
        handler_path = action_config.get("handler")

        if not handler_path:
            # No custom handler specified, just log the action
            logger.info(
                "dunning.custom.no_handler",
                execution_id=execution.id,
                config=action_config.get("config", {}),
            )
            return {
                "status": "success",
                "action_type": "custom",
                "details": action_config.get("custom_config", {}),
                "note": "No custom handler specified, action logged only",
            }

        # Dynamic import of custom handler
        import importlib

        module_path, function_name = handler_path.rsplit(".", 1)
        module = importlib.import_module(module_path)
        handler_func = getattr(module, function_name)

        # Execute custom handler
        result = await handler_func(execution, action_config.get("config", {}))

        logger.info(
            "dunning.custom.success",
            execution_id=execution.id,
            handler=handler_path,
            result=result,
        )

        return {
            "status": "success",
            "action_type": "custom",
            "details": {
                "handler": handler_path,
                "result": result,
                "custom_config": action_config.get("custom_config", {}),
            },
            "external_id": result.get("external_id") if isinstance(result, dict) else None,
        }

    except ImportError as e:
        logger.error(
            "dunning.custom.import_error",
            execution_id=execution.id,
            handler=action_config.get("handler"),
            error=str(e),
        )
        return {
            "status": "failed",
            "action_type": "custom",
            "error": f"Failed to import custom handler: {str(e)}",
            "details": {"handler": action_config.get("handler")},
        }

    except Exception as e:
        logger.error(
            "dunning.custom.failed",
            execution_id=execution.id,
            handler=action_config.get("handler"),
            error=str(e),
            error_type=type(e).__name__,
        )
        return {
            "status": "failed",
            "action_type": "custom",
            "error": str(e),
            "details": {
                "handler": action_config.get("handler"),
                "custom_config": action_config.get("custom_config", {}),
            },
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
