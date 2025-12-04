"""
Billing settings service
"""

import json
import logging
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.billing.metrics import get_billing_metrics
from dotmac.platform.billing.models import BillingSettingsTable

from .models import (
    BillingSettings,
    CompanyInfo,
    InvoiceSettings,
    NotificationSettings,
    PaymentSettings,
    TaxSettings,
)

logger = logging.getLogger(__name__)


class BillingSettingsService:
    """Service for managing billing settings"""

    def __init__(self, db_session: AsyncSession) -> None:
        self.db = db_session
        self.metrics = get_billing_metrics()

    async def get_settings(self, tenant_id: str) -> BillingSettings:
        """Get billing settings for tenant"""

        row = await self._get_settings_row(tenant_id)
        if row:
            settings = self._table_to_model(row)
        else:
            settings = self._get_default_settings(tenant_id)

        logger.info("Retrieved billing settings", extra={"tenant_id": tenant_id})
        return settings

    async def update_settings(self, tenant_id: str, settings: BillingSettings) -> BillingSettings:
        """Update billing settings for tenant"""

        await self._validate_settings(settings)
        settings.tenant_id = tenant_id
        persisted = await self._save_settings(tenant_id, settings)

        logger.info("Updated billing settings", extra={"tenant_id": tenant_id})
        return persisted

    async def update_company_info(
        self, tenant_id: str, company_info: CompanyInfo
    ) -> BillingSettings:
        """Update company information"""

        settings = await self.get_settings(tenant_id)
        settings.company_info = company_info
        return await self.update_settings(tenant_id, settings)

    async def update_tax_settings(
        self, tenant_id: str, tax_settings: TaxSettings
    ) -> BillingSettings:
        """Update tax settings"""

        settings = await self.get_settings(tenant_id)
        settings.tax_settings = tax_settings
        return await self.update_settings(tenant_id, settings)

    async def update_payment_settings(
        self, tenant_id: str, payment_settings: PaymentSettings
    ) -> BillingSettings:
        """Update payment settings"""

        settings = await self.get_settings(tenant_id)
        settings.payment_settings = payment_settings
        return await self.update_settings(tenant_id, settings)

    async def update_invoice_settings(
        self, tenant_id: str, invoice_settings: InvoiceSettings
    ) -> BillingSettings:
        """Update invoice settings"""

        settings = await self.get_settings(tenant_id)
        settings.invoice_settings = invoice_settings
        return await self.update_settings(tenant_id, settings)

    async def update_notification_settings(
        self, tenant_id: str, notification_settings: NotificationSettings
    ) -> BillingSettings:
        """Update notification settings"""

        settings = await self.get_settings(tenant_id)
        settings.notification_settings = notification_settings
        return await self.update_settings(tenant_id, settings)

    async def update_feature_flags(
        self, tenant_id: str, features: dict[str, bool]
    ) -> BillingSettings:
        """Update feature flags"""

        settings = await self.get_settings(tenant_id)
        settings.features_enabled.update(features)
        return await self.update_settings(tenant_id, settings)

    async def get_feature_flag(self, tenant_id: str, feature_name: str) -> bool:
        """Get specific feature flag value"""

        settings = await self.get_settings(tenant_id)
        return settings.features_enabled.get(feature_name, False)

    async def update_custom_setting(self, tenant_id: str, key: str, value: Any) -> BillingSettings:
        """Update custom setting"""

        settings = await self.get_settings(tenant_id)
        settings.custom_settings[key] = value
        return await self.update_settings(tenant_id, settings)

    async def get_custom_setting(self, tenant_id: str, key: str, default: Any | None = None) -> Any:
        """Get custom setting value"""

        settings = await self.get_settings(tenant_id)
        return settings.custom_settings.get(key, default)

    async def reset_to_defaults(self, tenant_id: str) -> BillingSettings:
        """Reset settings to defaults"""

        default_settings = self._get_default_settings(tenant_id)
        return await self.update_settings(tenant_id, default_settings)

    async def validate_settings_for_tenant(self, tenant_id: str) -> dict[str, Any]:
        """Validate current settings and return validation report"""

        settings = await self.get_settings(tenant_id)
        validation_report: dict[str, Any] = {
            "valid": True,
            "warnings": [],
            "errors": [],
        }

        errors: list[str] = validation_report["errors"]
        warnings: list[str] = validation_report["warnings"]

        # Validate company info
        if not settings.company_info.name:
            errors.append("Company name is required")
            validation_report["valid"] = False

        if not settings.company_info.address_line1:
            errors.append("Company address is required")
            validation_report["valid"] = False

        # Validate tax settings
        if settings.tax_settings.calculate_tax and not settings.tax_settings.tax_registrations:
            warnings.append("Tax calculation enabled but no tax registrations configured")

        # Validate payment settings
        if not settings.payment_settings.enabled_payment_methods:
            errors.append("At least one payment method must be enabled")
            validation_report["valid"] = False

        # Validate invoice settings
        if (
            settings.invoice_settings.send_payment_reminders
            and not settings.invoice_settings.reminder_schedule_days
        ):
            warnings.append("Payment reminders enabled but no reminder schedule configured")

        logger.info(
            "Billing settings validation",
            extra={
                "tenant_id": tenant_id,
                "valid": validation_report["valid"],
            },
        )
        return validation_report

    # ============================================================================
    # Private helper methods
    # ============================================================================

    async def _get_settings_row(self, tenant_id: str) -> BillingSettingsTable | None:
        stmt = select(BillingSettingsTable).where(BillingSettingsTable.tenant_id == tenant_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def _save_settings(self, tenant_id: str, settings: BillingSettings) -> BillingSettings:
        row = await self._get_settings_row(tenant_id)
        if row is None:
            row = BillingSettingsTable(
                settings_id=settings.settings_id or str(uuid4()),
                tenant_id=tenant_id,
            )
            self.db.add(row)
        self._apply_model_to_row(row, settings)
        row.updated_at = datetime.now(UTC)
        await self.db.commit()
        await self.db.refresh(row)
        return self._table_to_model(row)

    def _apply_model_to_row(self, row: BillingSettingsTable, settings: BillingSettings) -> None:
        row.tenant_id = settings.tenant_id
        row.settings_id = settings.settings_id or row.settings_id or str(uuid4())
        row.company_info = json.loads(settings.company_info.model_dump_json())
        row.tax_settings = json.loads(settings.tax_settings.model_dump_json())
        row.payment_settings = json.loads(settings.payment_settings.model_dump_json())
        row.invoice_settings = json.loads(settings.invoice_settings.model_dump_json())
        row.notification_settings = json.loads(settings.notification_settings.model_dump_json())
        row.features_enabled = dict(settings.features_enabled)
        row.custom_settings = dict(settings.custom_settings)
        row.api_settings = dict(settings.api_settings)
        row.metadata_json = row.metadata_json or {}

    def _table_to_model(self, row: BillingSettingsTable) -> BillingSettings:
        defaults = self._get_default_settings(row.tenant_id)
        defaults.settings_id = row.settings_id
        defaults.company_info = CompanyInfo.model_validate(row.company_info or {})
        defaults.tax_settings = TaxSettings.model_validate(row.tax_settings or {})
        defaults.payment_settings = PaymentSettings.model_validate(row.payment_settings or {})
        defaults.invoice_settings = InvoiceSettings.model_validate(row.invoice_settings or {})
        defaults.notification_settings = NotificationSettings.model_validate(
            row.notification_settings or {}
        )
        defaults.features_enabled.update(row.features_enabled or {})
        defaults.custom_settings.update(row.custom_settings or {})
        defaults.api_settings.update(row.api_settings or {})
        defaults.tenant_id = row.tenant_id
        defaults.settings_id = row.settings_id
        defaults.created_at = row.created_at
        defaults.updated_at = row.updated_at
        return defaults

    def _get_default_settings(self, tenant_id: str) -> BillingSettings:
        """Get default billing settings"""

        return BillingSettings(
            tenant_id=tenant_id,
            company_info=CompanyInfo(
                name="Your Company",
                legal_name=None,
                tax_id=None,
                registration_number=None,
                address_line1="123 Business Street",
                address_line2=None,
                city="San Francisco",
                state="CA",
                postal_code="94105",
                country="US",
                phone=None,
                email="billing@yourcompany.com",
                website=None,
                logo_url=None,
                brand_color=None,
            ),
            tax_settings=TaxSettings(
                calculate_tax=True,
                tax_inclusive_pricing=False,
                default_tax_rate=0.0,
                tax_provider=None,
            ),
            payment_settings=PaymentSettings(
                default_currency="USD",
                default_payment_terms=30,
                late_payment_fee=None,
                retry_failed_payments=True,
                max_retry_attempts=3,
                retry_interval_hours=24,
            ),
            invoice_settings=InvoiceSettings(
                invoice_number_prefix="INV",
                invoice_number_format="{prefix}-{tenant_suffix}-{year}-{sequence:06d}",
                default_due_days=30,
                include_payment_instructions=True,
                payment_instructions=None,
                footer_text=None,
                terms_and_conditions=None,
                send_invoice_emails=True,
                send_payment_reminders=True,
                logo_on_invoices=True,
                color_scheme=None,
            ),
            notification_settings=NotificationSettings(
                send_invoice_notifications=True,
                send_payment_confirmations=True,
                send_overdue_notices=True,
                send_receipt_emails=True,
                webhook_url=None,
                webhook_secret=None,
            ),
        )

    async def _validate_settings(self, settings: BillingSettings) -> None:
        """Validate settings before saving"""

        # Basic validation is handled by Pydantic models
        # Add any business logic validation here

        # Validate currency codes
        if (
            settings.payment_settings.default_currency
            not in settings.payment_settings.supported_currencies
        ):
            raise ValueError("Default currency must be in supported currencies list")

        # Validate tax registrations format
        for reg in settings.tax_settings.tax_registrations:
            if "jurisdiction" not in reg or "registration_number" not in reg:
                raise ValueError("Tax registrations must have jurisdiction and registration_number")

        # Validate webhook URL format if provided
        if settings.notification_settings.webhook_url:
            if not settings.notification_settings.webhook_url.startswith(("http://", "https://")):
                raise ValueError("Webhook URL must be a valid HTTP/HTTPS URL")

        logger.debug("Settings validation completed successfully")
