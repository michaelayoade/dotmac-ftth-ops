"""
Webhook subscription management API router.
"""

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.dependencies import UserInfo, get_current_user
from dotmac.platform.auth.rbac_dependencies import require_permission
from dotmac.platform.db import get_async_db

from .delivery import WebhookDeliveryService
from .events import get_event_bus
from .models import (
    DeliveryStatus,
    WebhookDeliveryResponse,
    WebhookSubscriptionCreate,
    WebhookSubscriptionCreateResponse,
    WebhookSubscriptionResponse,
    WebhookSubscriptionUpdate,
)
from .service import WebhookSubscriptionService

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


# Subscription endpoints


@router.post(
    "/subscriptions",
    response_model=WebhookSubscriptionCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_webhook_subscription(
    subscription_data: WebhookSubscriptionCreate,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
    _: UserInfo = Depends(require_permission("webhooks:manage")),
) -> WebhookSubscriptionCreateResponse:
    """
    Create a new webhook subscription.

    The webhook endpoint will receive POST requests with the following payload:
    ```json
    {
        "id": "event_abc123",
        "type": "invoice.created",
        "timestamp": "2025-09-30T12:00:00Z",
        "data": { ... event-specific data ... },
        "tenant_id": "tenant_xyz",
        "metadata": {}
    }
    ```

    The request will include headers:
    - `X-Webhook-Signature`: HMAC-SHA256 signature for verification
    - `X-Webhook-Event-Id`: Idempotency key
    - `X-Webhook-Event-Type`: Event type
    - `X-Webhook-Timestamp`: Request timestamp
    """
    if not current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant ID is required for webhook subscriptions",
        )

    try:
        service = WebhookSubscriptionService(db)
        subscription = await service.create_subscription(
            tenant_id=current_user.tenant_id,
            subscription_data=subscription_data,
        )

        logger.info(
            "Webhook subscription created via API",
            subscription_id=str(subscription.id),
            tenant_id=current_user.tenant_id,
            user_id=current_user.user_id,
        )

        response = WebhookSubscriptionResponse.model_validate(subscription)
        return WebhookSubscriptionCreateResponse(
            **response.model_dump(),
            secret=subscription.secret,
        )

    except Exception as e:
        logger.error("Failed to create webhook subscription", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create webhook subscription: {str(e)}",
        )


@router.get("/subscriptions", response_model=list[WebhookSubscriptionResponse])
async def list_webhook_subscriptions(
    is_active: bool | None = Query(None, description="Filter by active status"),
    event_type: str | None = Query(None, description="Filter by event type"),
    limit: int = Query(100, ge=1, le=500, description="Maximum subscriptions to return"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
    _: UserInfo = Depends(require_permission("webhooks:manage")),
) -> list[WebhookSubscriptionResponse]:
    """List all webhook subscriptions for the current tenant."""
    if not current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant ID is required for webhook subscriptions",
        )

    try:
        service = WebhookSubscriptionService(db)
        subscriptions = await service.list_subscriptions(
            tenant_id=current_user.tenant_id,
            is_active=is_active,
            event_type=event_type,
            limit=limit,
            offset=offset,
        )

        return [WebhookSubscriptionResponse.model_validate(sub) for sub in subscriptions]

    except Exception as e:
        logger.error("Failed to list webhook subscriptions", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list webhook subscriptions",
        )


@router.get("/subscriptions/{subscription_id}", response_model=WebhookSubscriptionResponse)
async def get_webhook_subscription(
    subscription_id: str,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
    _: UserInfo = Depends(require_permission("webhooks:manage")),
) -> WebhookSubscriptionResponse:
    """Get webhook subscription by ID."""
    if not current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant ID is required for webhook subscriptions",
        )

    try:
        service = WebhookSubscriptionService(db)
        subscription = await service.get_subscription(
            subscription_id=subscription_id,
            tenant_id=current_user.tenant_id,
        )

        if not subscription:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Webhook subscription not found: {subscription_id}",
            )

        return WebhookSubscriptionResponse.model_validate(subscription)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get webhook subscription", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get webhook subscription",
        )


@router.patch("/subscriptions/{subscription_id}", response_model=WebhookSubscriptionResponse)
async def update_webhook_subscription(
    subscription_id: str,
    update_data: WebhookSubscriptionUpdate,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
    _: UserInfo = Depends(require_permission("webhooks:manage")),
) -> WebhookSubscriptionResponse:
    """Update webhook subscription."""
    if not current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant ID is required for webhook subscriptions",
        )

    try:
        service = WebhookSubscriptionService(db)
        subscription = await service.update_subscription(
            subscription_id=subscription_id,
            tenant_id=current_user.tenant_id,
            update_data=update_data,
        )

        if not subscription:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Webhook subscription not found: {subscription_id}",
            )

        return WebhookSubscriptionResponse.model_validate(subscription)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to update webhook subscription", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update webhook subscription",
        )


@router.delete("/subscriptions/{subscription_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_webhook_subscription(
    subscription_id: str,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
    _: UserInfo = Depends(require_permission("webhooks:manage")),
) -> None:
    """Delete webhook subscription."""
    if not current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant ID is required for webhook subscriptions",
        )

    try:
        service = WebhookSubscriptionService(db)
        deleted = await service.delete_subscription(
            subscription_id=subscription_id,
            tenant_id=current_user.tenant_id,
        )

        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Webhook subscription not found: {subscription_id}",
            )

        return None

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to delete webhook subscription", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete webhook subscription",
        )


@router.post("/subscriptions/{subscription_id}/rotate-secret")
async def rotate_webhook_secret(
    subscription_id: str,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
    _: UserInfo = Depends(require_permission("webhooks:manage")),
) -> dict[str, str]:
    """
    Rotate webhook signing secret.

    Returns the new secret. Store it securely - it won't be retrievable later.
    """
    if not current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant ID is required for webhook subscriptions",
        )

    try:
        service = WebhookSubscriptionService(db)
        new_secret = await service.rotate_secret(
            subscription_id=subscription_id,
            tenant_id=current_user.tenant_id,
        )

        if not new_secret:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Webhook subscription not found: {subscription_id}",
            )

        return {
            "secret": new_secret,
            "message": "Secret rotated successfully. Store this value securely.",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to rotate webhook secret", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to rotate webhook secret",
        )


# Delivery endpoints


@router.get(
    "/subscriptions/{subscription_id}/deliveries", response_model=list[WebhookDeliveryResponse]
)
async def list_webhook_deliveries(
    subscription_id: str,
    status_filter: DeliveryStatus | None = Query(
        None, alias="status", description="Filter by delivery status"
    ),
    limit: int = Query(50, ge=1, le=200, description="Maximum deliveries to return"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
    _: UserInfo = Depends(require_permission("webhooks:manage")),
) -> list[WebhookDeliveryResponse]:
    """List webhook deliveries for a subscription."""
    if not current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant ID is required for webhook subscriptions",
        )

    try:
        service = WebhookSubscriptionService(db)
        deliveries = await service.get_deliveries(
            subscription_id=subscription_id,
            tenant_id=current_user.tenant_id,
            status=status_filter,
            limit=limit,
            offset=offset,
        )

        return [WebhookDeliveryResponse.model_validate(delivery) for delivery in deliveries]

    except Exception as e:
        logger.error("Failed to list webhook deliveries", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list webhook deliveries",
        )


@router.get("/deliveries", response_model=list[WebhookDeliveryResponse])
async def list_all_deliveries(
    limit: int = Query(50, ge=1, le=200, description="Maximum deliveries to return"),
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
    _: UserInfo = Depends(require_permission("webhooks:manage")),
) -> list[WebhookDeliveryResponse]:
    """List recent webhook deliveries across all subscriptions."""
    if not current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant ID is required for webhook subscriptions",
        )

    try:
        service = WebhookSubscriptionService(db)
        deliveries = await service.get_recent_deliveries(
            tenant_id=current_user.tenant_id,
            limit=limit,
        )

        return [WebhookDeliveryResponse.model_validate(delivery) for delivery in deliveries]

    except Exception as e:
        logger.error("Failed to list recent deliveries", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list recent deliveries",
        )


@router.get("/deliveries/{delivery_id}", response_model=WebhookDeliveryResponse)
async def get_webhook_delivery(
    delivery_id: str,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
    _: UserInfo = Depends(require_permission("webhooks:manage")),
) -> WebhookDeliveryResponse:
    """Get webhook delivery details."""
    if not current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant ID is required for webhook subscriptions",
        )

    try:
        service = WebhookSubscriptionService(db)
        delivery = await service.get_delivery(
            delivery_id=delivery_id,
            tenant_id=current_user.tenant_id,
        )

        if not delivery:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Webhook delivery not found: {delivery_id}",
            )

        return WebhookDeliveryResponse.model_validate(delivery)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get webhook delivery", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get webhook delivery",
        )


@router.post("/deliveries/{delivery_id}/retry")
async def retry_webhook_delivery(
    delivery_id: str,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
    _: UserInfo = Depends(require_permission("webhooks:manage")),
) -> dict[str, str]:
    """Manually retry a failed webhook delivery."""
    if not current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant ID is required for webhook subscriptions",
        )

    try:
        delivery_service = WebhookDeliveryService(db)
        retried = await delivery_service.retry_delivery(
            delivery_id=delivery_id,
            tenant_id=current_user.tenant_id,
        )

        if not retried:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Delivery cannot be retried (not found, already succeeded, or subscription inactive)",
            )

        return {"message": "Delivery retry initiated successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to retry webhook delivery", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retry webhook delivery",
        )


# Event information endpoints


@router.get("/events")
async def list_available_events(
    current_user: UserInfo = Depends(get_current_user),
    _: UserInfo = Depends(require_permission("webhooks:manage")),
) -> dict[str, int | list[dict[str, str | bool]]]:
    """
    List all available webhook event types.

    Returns event types that can be subscribed to via webhook subscriptions.
    """
    try:
        event_bus = get_event_bus()
        registered_events = event_bus.get_registered_events()

        events_list: list[dict[str, str | bool]] = [
            {
                "event_type": schema.event_type,
                "description": schema.description,
                "has_schema": schema.json_schema is not None,
                "has_example": schema.example is not None,
            }
            for schema in registered_events.values()
        ]

        # Sort by event type
        events_list.sort(key=lambda x: str(x["event_type"]))

        return {
            "total": len(events_list),
            "events": events_list,
        }

    except Exception as e:
        logger.error("Failed to list available events", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list available events",
        )


@router.get("/events/{event_type}")
async def get_event_details(
    event_type: str,
    current_user: UserInfo = Depends(get_current_user),
    _: UserInfo = Depends(require_permission("webhooks:manage")),
) -> dict[str, str | dict[str, object] | None]:
    """Get details about a specific event type."""
    try:
        event_bus = get_event_bus()
        registered_events = event_bus.get_registered_events()

        if event_type not in registered_events:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Event type not found: {event_type}",
            )

        event_schema = registered_events[event_type]

        return {
            "event_type": event_schema.event_type,
            "description": event_schema.description,
            "schema": event_schema.json_schema,
            "example": event_schema.example,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get event details", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get event details",
        )
