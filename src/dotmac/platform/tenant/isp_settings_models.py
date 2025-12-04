"""
ISP-Specific Configuration Settings.

Comprehensive configuration models for ISP customization including:
- Subscriber ID generation formats
- RADIUS defaults
- Network provisioning defaults
- Compliance and data residency
- Portal customization
- Notification templates
- Localization settings
"""

from datetime import time
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class IDGenerationFormat(str, Enum):
    """Subscriber/Customer ID generation formats."""

    UUID = "uuid"  # Standard UUID v4
    SEQUENTIAL = "sequential"  # Simple incrementing numbers
    PREFIX_SEQUENTIAL = "prefix_sequential"  # PREFIX-000001
    CUSTOM_PATTERN = "custom_pattern"  # Custom pattern with variables
    IMPORT_PRESERVED = "import_preserved"  # Preserve IDs from migration


class PasswordHashMethod(str, Enum):
    """RADIUS password hashing methods."""

    SHA256 = "sha256"  # Recommended default
    MD5 = "md5"  # Legacy compatibility
    BCRYPT = "bcrypt"  # Strongest security
    CLEARTEXT = "cleartext"  # Not recommended (testing only)


class DataResidencyRegion(str, Enum):
    """Data residency regions for compliance."""

    US = "us"
    EU = "eu"
    UK = "uk"
    APAC = "apac"
    CANADA = "canada"
    AUSTRALIA = "australia"
    MIDDLE_EAST = "middle_east"
    AFRICA = "africa"


class ThrottlePolicy(str, Enum):
    """Bandwidth throttle policies when limit exceeded."""

    HARD_CAP = "hard_cap"  # Block all traffic
    THROTTLE = "throttle"  # Reduce speed to X%
    OVERAGE_BILLING = "overage_billing"  # Charge for excess
    WARN_ONLY = "warn_only"  # Notify but don't restrict


class TaxType(str, Enum):
    """Tax types for billing."""

    VAT = "vat"  # Value Added Tax
    GST = "gst"  # Goods and Services Tax
    SALES_TAX = "sales_tax"  # Sales Tax
    CUSTOM = "custom"  # Custom tax type


class TaxCalculationMethod(str, Enum):
    """Methods for calculating tax."""

    INCLUSIVE = "inclusive"  # Tax included in price
    EXCLUSIVE = "exclusive"  # Tax added to price
    COMPOUND = "compound"  # Tax calculated on tax


class InvoiceNumberingFormat(str, Enum):
    """Invoice numbering formats."""

    SEQUENTIAL = "sequential"  # 1, 2, 3, ...
    PREFIX_SEQUENTIAL = "prefix_sequential"  # INV-000001
    YEAR_SEQUENTIAL = "year_sequential"  # 2025-000001
    CUSTOM_PATTERN = "custom_pattern"  # {prefix}-{year}-{month}-{sequence}


class PaymentTerms(str, Enum):
    """Standard payment terms."""

    DUE_ON_RECEIPT = "due_on_receipt"  # Immediate payment
    NET_7 = "net_7"  # Due in 7 days
    NET_15 = "net_15"  # Due in 15 days
    NET_30 = "net_30"  # Due in 30 days
    NET_60 = "net_60"  # Due in 60 days
    CUSTOM = "custom"  # Custom terms


class DunningStrategy(str, Enum):
    """Dunning strategies for overdue payments."""

    GENTLE = "gentle"  # Friendly reminders
    MODERATE = "moderate"  # Escalating messages
    AGGRESSIVE = "aggressive"  # Strong language, rapid escalation
    CUSTOM = "custom"  # Custom dunning flow


# ============================================================================
# Subscriber ID Configuration
# ============================================================================


class SubscriberIDSettings(BaseModel):
    """Subscriber and customer ID generation settings."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "format": "prefix_sequential",
                "prefix": "SUB",
                "sequence_start": 10000,
                "sequence_padding": 6,
                "custom_pattern": "{prefix}-{year}-{sequence:05d}",
            }
        }
    )

    # Format configuration
    format: IDGenerationFormat = Field(
        default=IDGenerationFormat.UUID,
        description="ID generation format strategy",
    )

    # Sequential settings
    prefix: str = Field(
        default="SUB",
        min_length=1,
        max_length=10,
        description="Prefix for sequential IDs",
    )
    sequence_start: int = Field(
        default=1,
        ge=1,
        description="Starting sequence number",
    )
    sequence_padding: int = Field(
        default=6,
        ge=1,
        le=12,
        description="Zero-padding for sequence (e.g., 6 = '000001')",
    )

    # Custom pattern settings
    custom_pattern: str | None = Field(
        default=None,
        description="Custom pattern with variables: {prefix}, {year}, {month}, {sequence}",
    )

    # Migration settings
    allow_custom_ids: bool = Field(
        default=False,
        description="Allow importing subscribers with existing IDs",
    )
    validate_imported_ids: bool = Field(
        default=True,
        description="Validate imported IDs match the configured format",
    )

    @field_validator("custom_pattern")
    @classmethod
    def validate_custom_pattern(cls, v: str | None, info: Any) -> str | None:
        """Validate custom pattern contains required placeholders."""
        if v and "{sequence" not in v:
            raise ValueError("Custom pattern must include {sequence} placeholder")
        return v


# ============================================================================
# RADIUS Configuration
# ============================================================================


class RADIUSDefaultSettings(BaseModel):
    """Default RADIUS settings for new subscribers."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "default_password_hash": "sha256",
                "session_timeout": 3600,
                "idle_timeout": 600,
                "simultaneous_use": 1,
            }
        }
    )

    # Authentication settings
    default_password_hash: PasswordHashMethod = Field(
        default=PasswordHashMethod.SHA256,
        description="Default password hashing method for new subscribers",
    )

    # Session settings
    session_timeout: int = Field(
        default=3600,
        ge=60,
        le=86400,
        description="Default session timeout in seconds (1 hour default)",
    )
    idle_timeout: int = Field(
        default=600,
        ge=60,
        le=7200,
        description="Default idle timeout in seconds (10 min default)",
    )
    simultaneous_use: int = Field(
        default=1,
        ge=1,
        le=10,
        description="Maximum simultaneous sessions per subscriber",
    )

    # Accounting settings
    acct_interim_interval: int = Field(
        default=300,
        ge=60,
        le=3600,
        description="Accounting interim update interval in seconds",
    )

    # Bandwidth settings
    default_download_speed: str | None = Field(
        default=None,
        description="Default download speed (e.g., '100M', '1G')",
    )
    default_upload_speed: str | None = Field(
        default=None,
        description="Default upload speed (e.g., '50M', '500M')",
    )

    # Custom RADIUS attributes
    custom_attributes: dict[str, str] = Field(
        default_factory=dict,
        description="Custom RADIUS reply attributes",
    )

    # NAS-specific defaults
    nas_vendor_defaults: dict[str, dict[str, Any]] = Field(
        default_factory=dict,
        description="Per-vendor NAS configuration overrides",
    )


# ============================================================================
# Network Provisioning Configuration
# ============================================================================


class NetworkProvisioningSettings(BaseModel):
    """Network provisioning defaults."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "vlan_range_start": 100,
                "vlan_range_end": 999,
                "ipv4_pool_prefix": "10.50.0.0/16",
                "ipv6_pool_prefix": "2001:db8:1234::/48",
            }
        }
    )

    # VLAN configuration
    vlan_range_start: int = Field(
        default=100,
        ge=1,
        le=4094,
        description="Start of VLAN range for subscribers",
    )
    vlan_range_end: int = Field(
        default=999,
        ge=1,
        le=4094,
        description="End of VLAN range for subscribers",
    )

    # IP addressing
    ipv4_pool_prefix: str = Field(
        default="10.0.0.0/8",
        description="IPv4 address pool in CIDR notation",
    )
    ipv6_pool_prefix: str = Field(
        default="2001:db8::/32",
        description="IPv6 address pool in CIDR notation",
    )
    ipv6_prefix_length: int = Field(
        default=64,
        ge=48,
        le=128,
        description="IPv6 prefix length to assign to subscribers",
    )

    # Assignment policies
    auto_assign_ip: bool = Field(
        default=True,
        description="Automatically assign IP addresses",
    )
    require_static_ip: bool = Field(
        default=False,
        description="Require static IP assignment (no DHCP)",
    )
    enable_ipv6: bool = Field(
        default=True,
        description="Enable IPv6 provisioning",
    )

    # CPE provisioning
    default_cpe_template: str | None = Field(
        default=None,
        description="Default CPE configuration template ID",
    )
    auto_provision_cpe: bool = Field(
        default=True,
        description="Automatically provision CPE on subscriber activation",
    )

    # QoS settings
    default_qos_policy: str | None = Field(
        default=None,
        description="Default QoS policy name",
    )

    @field_validator("vlan_range_end")
    @classmethod
    def validate_vlan_range(cls, v: int, info: Any) -> int:
        """Ensure VLAN end is greater than start."""
        if "vlan_range_start" in info.data and v <= info.data["vlan_range_start"]:
            raise ValueError("vlan_range_end must be greater than vlan_range_start")
        return v


# ============================================================================
# Compliance & Data Residency
# ============================================================================


class ComplianceSettings(BaseModel):
    """Compliance and data residency settings."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "data_residency_region": "eu",
                "gdpr_enabled": True,
                "audit_retention_days": 90,
            }
        }
    )

    # Data residency
    data_residency_region: DataResidencyRegion = Field(
        default=DataResidencyRegion.US,
        description="Primary data residency region",
    )

    # Regulatory compliance
    gdpr_enabled: bool = Field(
        default=False,
        description="Enable GDPR compliance features (EU)",
    )
    ccpa_enabled: bool = Field(
        default=False,
        description="Enable CCPA compliance features (California)",
    )
    hipaa_enabled: bool = Field(
        default=False,
        description="Enable HIPAA compliance features (Healthcare)",
    )

    # Data retention
    audit_retention_days: int = Field(
        default=90,
        ge=30,
        le=2555,  # 7 years
        description="Audit log retention period in days",
    )
    customer_data_retention_days: int = Field(
        default=2555,  # 7 years default
        ge=365,
        le=3650,
        description="Customer data retention after account closure",
    )

    # Data protection
    pii_encryption_required: bool = Field(
        default=True,
        description="Require encryption for PII at rest",
    )
    data_export_format: str = Field(
        default="json",
        description="Default format for data exports (json, csv, xml)",
    )

    # Privacy features
    right_to_deletion: bool = Field(
        default=True,
        description="Enable customer data deletion requests",
    )
    right_to_access: bool = Field(
        default=True,
        description="Enable customer data access requests",
    )
    anonymize_on_deletion: bool = Field(
        default=True,
        description="Anonymize data instead of hard delete",
    )


# ============================================================================
# Portal Customization
# ============================================================================


class PortalCustomizationSettings(BaseModel):
    """Customer portal customization settings."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "custom_domain": "portal.myisp.com",
                "theme_primary_color": "#0066cc",
                "enable_self_service": True,
            }
        }
    )

    # Domain and branding
    custom_domain: str | None = Field(
        default=None,
        description="Custom domain for customer portal",
    )
    theme_primary_color: str = Field(
        default="#0066cc",
        pattern=r"^#[0-9A-Fa-f]{6}$",
        description="Primary brand color (hex)",
    )
    theme_secondary_color: str | None = Field(
        default=None,
        pattern=r"^#[0-9A-Fa-f]{6}$",
        description="Secondary brand color (hex)",
    )
    logo_url: str | None = Field(
        default=None,
        description="URL to company logo",
    )
    favicon_url: str | None = Field(
        default=None,
        description="URL to favicon",
    )

    # Custom CSS
    custom_css: str | None = Field(
        default=None,
        max_length=50000,
        description="Custom CSS for portal styling",
    )

    # Features
    enable_self_service: bool = Field(
        default=True,
        description="Enable self-service features",
    )
    enable_ticket_creation: bool = Field(
        default=True,
        description="Allow customers to create support tickets",
    )
    enable_payment_methods: bool = Field(
        default=True,
        description="Allow customers to manage payment methods",
    )
    enable_usage_monitoring: bool = Field(
        default=True,
        description="Show usage monitoring to customers",
    )

    # Content
    welcome_message: str | None = Field(
        default=None,
        max_length=1000,
        description="Welcome message on portal homepage",
    )
    support_email: str | None = Field(
        default=None,
        description="Support contact email",
    )
    support_phone: str | None = Field(
        default=None,
        description="Support contact phone",
    )


# ============================================================================
# Localization & Currency
# ============================================================================


class LocalizationSettings(BaseModel):
    """Localization and regional settings."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "default_currency": "USD",
                "supported_currencies": ["USD", "EUR", "GBP"],
                "default_language": "en",
                "timezone": "America/New_York",
            }
        }
    )

    # Currency (Initial setup - rarely changed)
    default_currency: str = Field(
        default="USD",
        min_length=3,
        max_length=3,
        description="Default currency code (ISO 4217)",
    )
    supported_currencies: list[str] = Field(
        default_factory=lambda: ["USD"],
        description="List of supported currency codes",
    )
    currency_display_format: str = Field(
        default="{symbol}{amount:,.2f}",
        description="Currency display format",
    )

    # Language and locale
    default_language: str = Field(
        default="en",
        min_length=2,
        max_length=5,
        description="Default language code (ISO 639-1)",
    )
    supported_languages: list[str] = Field(
        default_factory=lambda: ["en"],
        description="List of supported language codes",
    )

    # Date and time
    timezone: str = Field(
        default="UTC",
        description="Default timezone (IANA timezone name)",
    )
    date_format: str = Field(
        default="YYYY-MM-DD",
        description="Date format string",
    )
    time_format: str = Field(
        default="HH:mm:ss",
        description="Time format string",
    )

    # Number formatting
    decimal_separator: str = Field(
        default=".",
        min_length=1,
        max_length=1,
        description="Decimal separator character",
    )
    thousands_separator: str = Field(
        default=",",
        min_length=1,
        max_length=1,
        description="Thousands separator character",
    )

    @field_validator("default_currency", "supported_currencies")
    @classmethod
    def validate_currency_codes(cls, v: str | list[str]) -> str | list[str]:
        """Validate currency codes are uppercase."""
        if isinstance(v, str):
            return v.upper()
        return [c.upper() for c in v]


# ============================================================================
# SLA & Support Settings
# ============================================================================


class SLASettings(BaseModel):
    """SLA and support configuration."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "priority_high_response_hours": 1,
                "priority_medium_response_hours": 4,
                "priority_low_response_hours": 24,
            }
        }
    )

    # Response time SLAs (in hours)
    priority_urgent_response_hours: float = Field(
        default=0.5,
        ge=0.1,
        le=24,
        description="Response time for urgent tickets (hours)",
    )
    priority_high_response_hours: float = Field(
        default=1.0,
        ge=0.1,
        le=48,
        description="Response time for high priority tickets (hours)",
    )
    priority_medium_response_hours: float = Field(
        default=4.0,
        ge=0.5,
        le=72,
        description="Response time for medium priority tickets (hours)",
    )
    priority_low_response_hours: float = Field(
        default=24.0,
        ge=1,
        le=168,
        description="Response time for low priority tickets (hours)",
    )

    # Resolution time SLAs (in hours)
    priority_urgent_resolution_hours: float = Field(
        default=4.0,
        ge=1,
        le=48,
        description="Resolution time for urgent tickets (hours)",
    )
    priority_high_resolution_hours: float = Field(
        default=8.0,
        ge=1,
        le=72,
        description="Resolution time for high priority tickets (hours)",
    )

    # Business hours
    business_hours_start: time = Field(
        default=time(9, 0),
        description="Business hours start time",
    )
    business_hours_end: time = Field(
        default=time(17, 0),
        description="Business hours end time",
    )
    business_days: list[int] = Field(
        default_factory=lambda: [1, 2, 3, 4, 5],  # Monday-Friday
        description="Business days (1=Monday, 7=Sunday)",
    )

    # Escalation settings
    auto_escalate: bool = Field(
        default=True,
        description="Automatically escalate tickets approaching SLA breach",
    )
    escalation_threshold_percent: int = Field(
        default=80,
        ge=50,
        le=100,
        description="Escalate when X% of SLA time elapsed",
    )


# ============================================================================
# Service Defaults
# ============================================================================


class ServiceDefaultSettings(BaseModel):
    """Default service and plan settings."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "default_trial_days": 30,
                "default_data_cap_gb": 1000,
                "throttle_policy": "throttle",
            }
        }
    )

    # Trial settings
    default_trial_days: int = Field(
        default=0,
        ge=0,
        le=90,
        description="Default trial period in days (0 = no trial)",
    )
    trial_requires_payment_method: bool = Field(
        default=False,
        description="Require payment method for trial activation",
    )

    # Data cap settings
    default_data_cap_gb: int | None = Field(
        default=None,
        ge=1,
        le=100000,
        description="Default data cap in GB (null = unlimited)",
    )
    throttle_policy: ThrottlePolicy = Field(
        default=ThrottlePolicy.WARN_ONLY,
        description="Policy when data cap exceeded",
    )
    throttle_speed_percent: int = Field(
        default=10,
        ge=1,
        le=100,
        description="Throttled speed as % of original (if throttle policy)",
    )

    # Credit and payment
    default_credit_limit: float = Field(
        default=0.0,
        ge=0,
        description="Default credit limit for new customers",
    )
    auto_suspend_threshold: float = Field(
        default=0.0,
        ge=0,
        description="Auto-suspend when balance exceeds this amount",
    )
    grace_period_days: int = Field(
        default=7,
        ge=0,
        le=30,
        description="Grace period before suspension (days)",
    )
    reconnection_fee: float = Field(
        default=0.0,
        ge=0,
        description="Fee to reconnect suspended service",
    )


# ============================================================================
# Tax Settings
# ============================================================================


class TaxSettings(BaseModel):
    """Tax configuration and compliance settings."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "default_tax_type": "vat",
                "default_tax_rate": 15.0,
                "tax_calculation_method": "exclusive",
            }
        }
    )

    # Tax configuration
    tax_enabled: bool = Field(
        default=True,
        description="Enable tax calculations on invoices",
    )
    default_tax_type: TaxType = Field(
        default=TaxType.VAT,
        description="Default tax type for invoices",
    )
    default_tax_rate: float = Field(
        default=0.0,
        ge=0.0,
        le=100.0,
        description="Default tax rate as percentage (e.g., 15.0 for 15%)",
    )
    tax_calculation_method: TaxCalculationMethod = Field(
        default=TaxCalculationMethod.EXCLUSIVE,
        description="How tax is calculated on prices",
    )

    # Tax ID requirements
    require_tax_id: bool = Field(
        default=False,
        description="Require customers to provide tax ID",
    )
    tax_id_label: str = Field(
        default="Tax ID",
        max_length=50,
        description="Label for tax ID field (e.g., 'VAT Number', 'GST Number')",
    )
    validate_tax_id_format: bool = Field(
        default=False,
        description="Validate tax ID format based on country",
    )

    # Tax exemptions
    allow_tax_exemptions: bool = Field(
        default=True,
        description="Allow customers to claim tax exemption",
    )
    require_exemption_certificate: bool = Field(
        default=True,
        description="Require exemption certificate upload for tax-exempt customers",
    )

    # Regional tax rates (by state/province)
    regional_tax_rates: dict[str, float] = Field(
        default_factory=dict,
        description="Tax rates by region/state code (e.g., {'CA': 7.25, 'NY': 8.875})",
    )

    # Tax reporting
    tax_reporting_enabled: bool = Field(
        default=False,
        description="Enable tax reporting and filing features",
    )
    tax_registration_number: str | None = Field(
        default=None,
        max_length=50,
        description="Company tax registration number",
    )


# ============================================================================
# Billing Settings
# ============================================================================


class BillingSettings(BaseModel):
    """Billing and invoicing configuration."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "invoice_numbering_format": "prefix_sequential",
                "invoice_prefix": "INV",
                "payment_terms": "net_30",
            }
        }
    )

    # Invoice numbering
    invoice_numbering_format: InvoiceNumberingFormat = Field(
        default=InvoiceNumberingFormat.PREFIX_SEQUENTIAL,
        description="Format for invoice numbers",
    )
    invoice_prefix: str = Field(
        default="INV",
        min_length=1,
        max_length=10,
        description="Prefix for invoice numbers",
    )
    invoice_sequence_start: int = Field(
        default=1,
        ge=1,
        description="Starting number for invoice sequence",
    )
    invoice_sequence_padding: int = Field(
        default=6,
        ge=1,
        le=12,
        description="Zero-padding for invoice numbers (e.g., 6 = 000001)",
    )
    invoice_custom_pattern: str | None = Field(
        default=None,
        max_length=100,
        description="Custom invoice number pattern (e.g., {prefix}-{year}-{sequence:05d})",
    )

    # Payment terms
    default_payment_terms: PaymentTerms = Field(
        default=PaymentTerms.NET_30,
        description="Default payment terms for invoices",
    )
    custom_payment_terms_days: int | None = Field(
        default=None,
        ge=1,
        le=365,
        description="Custom payment terms in days (if payment_terms = custom)",
    )

    # Late fees
    late_fee_enabled: bool = Field(
        default=True,
        description="Charge late fees on overdue invoices",
    )
    late_fee_type: str = Field(
        default="percentage",
        description="Type of late fee (percentage or fixed)",
    )
    late_fee_amount: float = Field(
        default=5.0,
        ge=0.0,
        description="Late fee amount (percentage or fixed amount)",
    )
    late_fee_grace_days: int = Field(
        default=5,
        ge=0,
        le=30,
        description="Days after due date before late fee applies",
    )
    late_fee_max_amount: float | None = Field(
        default=None,
        ge=0.0,
        description="Maximum late fee amount (null = no cap)",
    )

    # Dunning
    dunning_enabled: bool = Field(
        default=True,
        description="Enable automated dunning for overdue invoices",
    )
    dunning_strategy: DunningStrategy = Field(
        default=DunningStrategy.MODERATE,
        description="Dunning escalation strategy",
    )
    dunning_first_notice_days: int = Field(
        default=3,
        ge=0,
        le=30,
        description="Days after due date to send first dunning notice",
    )
    dunning_escalation_days: int = Field(
        default=7,
        ge=1,
        le=30,
        description="Days between escalating dunning notices",
    )
    dunning_max_notices: int = Field(
        default=3,
        ge=1,
        le=10,
        description="Maximum number of dunning notices before suspension",
    )

    # Invoice settings
    invoice_logo_url: str | None = Field(
        default=None,
        max_length=500,
        description="URL to company logo for invoices",
    )
    invoice_footer_text: str | None = Field(
        default=None,
        max_length=500,
        description="Footer text on invoices",
    )
    invoice_notes: str | None = Field(
        default=None,
        max_length=1000,
        description="Default notes on invoices",
    )

    # Auto-billing
    auto_billing_enabled: bool = Field(
        default=True,
        description="Automatically charge payment method on invoice due date",
    )
    auto_billing_retry_enabled: bool = Field(
        default=True,
        description="Retry failed auto-billing attempts",
    )
    auto_billing_retry_days: list[int] = Field(
        default_factory=lambda: [3, 7, 14],
        description="Days after failed attempt to retry auto-billing",
    )


# ============================================================================
# Bank Account Settings
# ============================================================================


class BankAccountSettings(BaseModel):
    """Bank account and payment gateway configuration."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "default_bank_account_name": "Main Operating Account",
                "payment_methods_enabled": ["card", "bank_transfer"],
            }
        }
    )

    # Default bank account
    default_bank_account_id: int | None = Field(
        default=None,
        description="ID of default bank account for payments",
    )
    default_bank_account_name: str | None = Field(
        default=None,
        max_length=100,
        description="Name of default bank account",
    )

    # Payment methods
    payment_methods_enabled: list[str] = Field(
        default_factory=lambda: ["card", "bank_transfer"],
        description="Enabled payment methods (card, bank_transfer, check, cash, crypto)",
    )

    # Payment gateways
    stripe_enabled: bool = Field(
        default=False,
        description="Enable Stripe payment gateway",
    )
    paypal_enabled: bool = Field(
        default=False,
        description="Enable PayPal payment gateway",
    )
    paystack_enabled: bool = Field(
        default=False,
        description="Enable Paystack payment gateway (Africa)",
    )
    flutterwave_enabled: bool = Field(
        default=False,
        description="Enable Flutterwave payment gateway (Africa)",
    )

    # Bank transfer settings
    bank_transfer_enabled: bool = Field(
        default=True,
        description="Accept bank transfers",
    )
    bank_name: str | None = Field(
        default=None,
        max_length=100,
        description="Bank name for customer transfers",
    )
    bank_account_number: str | None = Field(
        default=None,
        max_length=50,
        description="Account number for customer transfers",
    )
    bank_routing_number: str | None = Field(
        default=None,
        max_length=50,
        description="Bank routing/sort code",
    )
    bank_iban: str | None = Field(
        default=None,
        max_length=50,
        description="IBAN for international transfers",
    )
    bank_swift_code: str | None = Field(
        default=None,
        max_length=20,
        description="SWIFT/BIC code",
    )

    # Payment reconciliation
    auto_reconcile_enabled: bool = Field(
        default=True,
        description="Automatically reconcile bank statement imports",
    )
    require_payment_reference: bool = Field(
        default=True,
        description="Require payment reference for bank transfers",
    )
    payment_reference_format: str = Field(
        default="INV-{invoice_number}",
        max_length=100,
        description="Format for payment references",
    )


# ============================================================================
# Master ISP Settings Container
# ============================================================================


class ISPSettings(BaseModel):
    """
    Complete ISP configuration settings.

    This is the master container for all ISP-specific settings. Some settings
    are typically configured once during initial setup (currency, compliance region),
    while others can be modified through the settings UI at any time.
    """

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "is_initial_setup": False,
                "subscriber_id": {"format": "uuid"},
                "radius": {"default_password_hash": "sha256"},
            }
        }
    )

    # Metadata
    is_initial_setup: bool = Field(
        default=True,
        description="True if this is the initial tenant setup",
    )
    settings_version: int = Field(
        default=1,
        description="Settings schema version for migrations",
    )

    # Configuration sections
    subscriber_id: SubscriberIDSettings = Field(
        default_factory=SubscriberIDSettings,
        description="Subscriber/Customer ID generation settings",
    )
    radius: RADIUSDefaultSettings = Field(
        default_factory=RADIUSDefaultSettings,
        description="RADIUS authentication defaults",
    )
    network: NetworkProvisioningSettings = Field(
        default_factory=NetworkProvisioningSettings,
        description="Network provisioning defaults",
    )
    compliance: ComplianceSettings = Field(
        default_factory=ComplianceSettings,
        description="Compliance and data residency settings",
    )
    portal: PortalCustomizationSettings = Field(
        default_factory=PortalCustomizationSettings,
        description="Customer portal customization",
    )
    localization: LocalizationSettings = Field(
        default_factory=LocalizationSettings,
        description="Localization and currency settings",
    )
    sla: SLASettings = Field(
        default_factory=SLASettings,
        description="SLA and support settings",
    )
    service_defaults: ServiceDefaultSettings = Field(
        default_factory=ServiceDefaultSettings,
        description="Default service and plan settings",
    )
    tax: TaxSettings = Field(
        default_factory=TaxSettings,
        description="Tax configuration and compliance",
    )
    billing: BillingSettings = Field(
        default_factory=BillingSettings,
        description="Billing and invoicing settings",
    )
    bank_accounts: BankAccountSettings = Field(
        default_factory=BankAccountSettings,
        description="Bank account and payment gateway configuration",
    )

    @classmethod
    def get_initial_setup_fields(cls) -> list[str]:
        """
        Get list of field paths that should be configured during initial setup.

        These are settings that are difficult to change later without data migration.
        """
        return [
            "localization.default_currency",
            "localization.supported_currencies",
            "localization.timezone",
            "compliance.data_residency_region",
            "subscriber_id.format",
            "subscriber_id.prefix",
            "subscriber_id.sequence_start",
            "billing.invoice_numbering_format",
            "billing.invoice_prefix",
            "billing.invoice_sequence_start",
        ]

    @classmethod
    def get_runtime_changeable_fields(cls) -> list[str]:
        """
        Get list of field paths that can be safely changed at runtime.

        These settings can be modified through the settings UI without
        requiring data migration or causing system disruption.
        """
        return [
            "radius",  # All RADIUS settings
            "network",  # All network settings
            "portal",  # All portal settings
            "sla",  # All SLA settings
            "service_defaults",  # All service defaults
            "tax",  # All tax settings
            "billing",  # All billing settings (except initial setup fields)
            "bank_accounts",  # All bank account settings
            "compliance.gdpr_enabled",
            "compliance.ccpa_enabled",
            "compliance.audit_retention_days",
            "localization.default_language",
            "localization.date_format",
            "localization.time_format",
        ]
