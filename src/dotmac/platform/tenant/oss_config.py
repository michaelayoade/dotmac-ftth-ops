"""
Tenant-specific OSS/automation configuration helpers.

Provides utility functions to resolve per-tenant integration settings for
VOLTHA, GenieACS, NetBox, and Ansible AWX. Values are stored in tenant
settings (keyed by ``oss.<service>``) and fall back to global defaults in
``settings.oss``.
"""

from __future__ import annotations

import json
from collections.abc import Callable
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.settings import ServiceEndpointSettings, settings
from dotmac.platform.tenant.models import TenantSetting


class OSSService(str, Enum):
    """Supported OSS/automation services."""

    VOLTHA = "voltha"
    GENIEACS = "genieacs"
    NETBOX = "netbox"
    ANSIBLE = "ansible"
    PROMETHEUS = "prometheus"


class ServiceConfig(BaseModel):  # BaseModel resolves to Any in isolation
    """Validated service configuration."""

    model_config = ConfigDict()

    url: str
    username: str | None = None
    password: str | None = None
    api_token: str | None = None
    verify_ssl: bool = True
    timeout_seconds: float = 30.0
    max_retries: int = 2
    extras: dict[str, Any] = Field(default_factory=dict)

    @property
    def auth(self) -> tuple[str, str] | None:
        """Return basic-auth tuple when both username/password provided."""
        if self.username and self.password:
            return (self.username, self.password)
        return None


def _get_default_settings(service: OSSService) -> ServiceEndpointSettings:
    """Return global defaults for a service."""
    return getattr(settings.oss, service.value)


async def _get_tenant_setting(
    session: AsyncSession, tenant_id: str, key: str
) -> TenantSetting | None:
    stmt = (
        select(TenantSetting)
        .where(TenantSetting.tenant_id == tenant_id)
        .where(TenantSetting.key == key)
        .limit(1)
    )
    result = await session.execute(stmt)
    return result.scalars().first()


def _decode_setting_value(raw_value: str) -> dict[str, Any]:
    """Decode tenant setting JSON payload."""
    try:
        data = json.loads(raw_value)
        if not isinstance(data, dict):
            raise ValueError("Tenant OSS configuration must be a JSON object")
        return data
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON for tenant OSS configuration: {exc}") from exc


async def get_service_config(
    session: AsyncSession,
    tenant_id: str,
    service: OSSService,
    *,
    override_transform: Callable[[dict[str, Any]], dict[str, Any]] | None = None,
) -> ServiceConfig:
    """
    Resolve per-tenant service configuration.

    Args:
        session: Database session
        tenant_id: Tenant identifier
        service: Target OSS service
        override_transform: Optional transform to post-process tenant overrides

    Returns:
        ServiceConfig instance with merged tenant + default settings

    Raises:
        ValueError: When mandatory configuration (URL) is missing
    """

    tenant_key = f"oss.{service.value}"
    tenant_setting = await _get_tenant_setting(session, tenant_id, tenant_key)

    if tenant_setting:
        override_data = _decode_setting_value(tenant_setting.value)
        if override_transform:
            override_data = override_transform(override_data)
    else:
        override_data = {}

    default_config = _get_default_settings(service)
    override_copy = dict(override_data)
    override_extras = override_copy.pop("extras", None)

    merged: dict[str, Any] = {
        "url": default_config.url,
        "username": default_config.username,
        "password": default_config.password,
        "api_token": default_config.api_token,
        "verify_ssl": default_config.verify_ssl,
        "timeout_seconds": default_config.timeout_seconds,
        "max_retries": default_config.max_retries,
    }

    extras = dict(default_config.extras or {})
    if isinstance(override_extras, dict):
        for key, value in override_extras.items():
            if value is None:
                extras.pop(key, None)
            else:
                extras[key] = value
    elif override_extras is not None:
        extras = {}
    if extras:
        merged["extras"] = extras

    merged.update({k: v for k, v in override_copy.items() if v is not None})

    try:
        config = ServiceConfig(**merged)
    except ValidationError as exc:
        raise ValueError(f"Invalid configuration for {service.value}: {exc}") from exc

    if not config.url:
        raise ValueError(
            f"Missing OSS configuration for {service.value}. "
            "Set tenant-specific settings or configure defaults via environment variables."
        )

    return config


async def get_service_override(
    session: AsyncSession, tenant_id: str, service: OSSService
) -> dict[str, Any]:
    """Return raw override configuration for a service."""
    tenant_key = f"oss.{service.value}"
    tenant_setting = await _get_tenant_setting(session, tenant_id, tenant_key)
    if not tenant_setting:
        return {}
    return _decode_setting_value(tenant_setting.value)


async def update_service_config(
    session: AsyncSession,
    tenant_id: str,
    service: OSSService,
    updates: dict[str, Any],
) -> ServiceConfig:
    """Update tenant-specific service configuration with partial updates."""
    allowed_fields = set(ServiceConfig.model_fields.keys())
    invalid = set(updates.keys()) - allowed_fields
    if invalid:
        raise ValueError(f"Unsupported configuration fields: {', '.join(sorted(invalid))}")

    tenant_key = f"oss.{service.value}"
    existing_setting = await _get_tenant_setting(session, tenant_id, tenant_key)
    current_override = (
        _decode_setting_value(existing_setting.value) if existing_setting is not None else {}
    )

    for field, value in updates.items():
        if value is None:
            current_override.pop(field, None)
        else:
            current_override[field] = value

    if current_override:
        payload = json.dumps(current_override)
        if existing_setting:
            existing_setting.value = payload
            existing_setting.value_type = "json"
        else:
            session.add(
                TenantSetting(
                    tenant_id=tenant_id,
                    key=tenant_key,
                    value=payload,
                    value_type="json",
                )
            )
    else:
        if existing_setting:
            await session.delete(existing_setting)

    await session.commit()
    return await get_service_config(session, tenant_id, service)


async def reset_service_config(
    session: AsyncSession,
    tenant_id: str,
    service: OSSService,
) -> None:
    """Remove tenant-specific configuration override."""
    tenant_key = f"oss.{service.value}"
    tenant_setting = await _get_tenant_setting(session, tenant_id, tenant_key)
    if tenant_setting:
        await session.delete(tenant_setting)
        await session.commit()
