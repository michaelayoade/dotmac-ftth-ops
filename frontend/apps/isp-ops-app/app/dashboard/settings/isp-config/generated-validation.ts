import { makeApi, Zodios, type ZodiosOptions } from "@zodios/core";
import { z } from "zod";

const IDGenerationFormat = z.enum([
  "uuid",
  "sequential",
  "prefix_sequential",
  "custom_pattern",
  "import_preserved",
]);
const SubscriberIDSettings = z
  .object({
    format: IDGenerationFormat,
    prefix: z.string().min(1).max(10).default("SUB"),
    sequence_start: z.number().int().gte(1).default(1),
    sequence_padding: z.number().int().gte(1).lte(12).default(6),
    custom_pattern: z.union([z.string(), z.null()]),
    allow_custom_ids: z.boolean().default(false),
    validate_imported_ids: z.boolean().default(true),
  })
  .partial()
  .passthrough();
const PasswordHashMethod = z.enum(["sha256", "md5", "bcrypt", "cleartext"]);
const RADIUSDefaultSettings = z
  .object({
    default_password_hash: PasswordHashMethod,
    session_timeout: z.number().int().gte(60).lte(86400).default(3600),
    idle_timeout: z.number().int().gte(60).lte(7200).default(600),
    simultaneous_use: z.number().int().gte(1).lte(10).default(1),
    acct_interim_interval: z.number().int().gte(60).lte(3600).default(300),
    default_download_speed: z.union([z.string(), z.null()]),
    default_upload_speed: z.union([z.string(), z.null()]),
    custom_attributes: z.record(z.string(), z.string()),
    nas_vendor_defaults: z.record(z.string(), z.object({}).partial().passthrough()),
  })
  .partial()
  .passthrough();
const NetworkProvisioningSettings = z
  .object({
    vlan_range_start: z.number().int().gte(1).lte(4094).default(100),
    vlan_range_end: z.number().int().gte(1).lte(4094).default(999),
    ipv4_pool_prefix: z.string().default("10.0.0.0/8"),
    ipv6_pool_prefix: z.string().default("2001:db8::/32"),
    ipv6_prefix_length: z.number().int().gte(48).lte(128).default(64),
    auto_assign_ip: z.boolean().default(true),
    require_static_ip: z.boolean().default(false),
    enable_ipv6: z.boolean().default(true),
    default_cpe_template: z.union([z.string(), z.null()]),
    auto_provision_cpe: z.boolean().default(true),
    default_qos_policy: z.union([z.string(), z.null()]),
  })
  .partial()
  .passthrough();
const DataResidencyRegion = z.enum([
  "us",
  "eu",
  "uk",
  "apac",
  "canada",
  "australia",
  "middle_east",
  "africa",
]);
const ComplianceSettings = z
  .object({
    data_residency_region: DataResidencyRegion,
    gdpr_enabled: z.boolean().default(false),
    ccpa_enabled: z.boolean().default(false),
    hipaa_enabled: z.boolean().default(false),
    audit_retention_days: z.number().int().gte(30).lte(2555).default(90),
    customer_data_retention_days: z.number().int().gte(365).lte(3650).default(2555),
    pii_encryption_required: z.boolean().default(true),
    data_export_format: z.string().default("json"),
    right_to_deletion: z.boolean().default(true),
    right_to_access: z.boolean().default(true),
    anonymize_on_deletion: z.boolean().default(true),
  })
  .partial()
  .passthrough();
const PortalCustomizationSettings = z
  .object({
    custom_domain: z.union([z.string(), z.null()]),
    theme_primary_color: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .default("#0066cc"),
    theme_secondary_color: z.union([z.string(), z.null()]),
    logo_url: z.union([z.string(), z.null()]),
    favicon_url: z.union([z.string(), z.null()]),
    custom_css: z.union([z.string(), z.null()]),
    enable_self_service: z.boolean().default(true),
    enable_ticket_creation: z.boolean().default(true),
    enable_payment_methods: z.boolean().default(true),
    enable_usage_monitoring: z.boolean().default(true),
    welcome_message: z.union([z.string(), z.null()]),
    support_email: z.union([z.string(), z.null()]),
    support_phone: z.union([z.string(), z.null()]),
  })
  .partial()
  .passthrough();
const LocalizationSettings = z
  .object({
    default_currency: z.string().min(3).max(3).default("USD"),
    supported_currencies: z.array(z.string()),
    currency_display_format: z.string().default("{symbol}{amount:,.2f}"),
    default_language: z.string().min(2).max(5).default("en"),
    supported_languages: z.array(z.string()),
    timezone: z.string().default("UTC"),
    date_format: z.string().default("YYYY-MM-DD"),
    time_format: z.string().default("HH:mm:ss"),
    decimal_separator: z.string().min(1).max(1).default("."),
    thousands_separator: z.string().min(1).max(1).default(","),
  })
  .partial()
  .passthrough();
const SLASettings = z
  .object({
    priority_urgent_response_hours: z.number().gte(0.1).lte(24).default(0.5),
    priority_high_response_hours: z.number().gte(0.1).lte(48).default(1),
    priority_medium_response_hours: z.number().gte(0.5).lte(72).default(4),
    priority_low_response_hours: z.number().gte(1).lte(168).default(24),
    priority_urgent_resolution_hours: z.number().gte(1).lte(48).default(4),
    priority_high_resolution_hours: z.number().gte(1).lte(72).default(8),
    business_hours_start: z.string().default("09:00:00"),
    business_hours_end: z.string().default("17:00:00"),
    business_days: z.array(z.number().int()),
    auto_escalate: z.boolean().default(true),
    escalation_threshold_percent: z.number().int().gte(50).lte(100).default(80),
  })
  .partial()
  .passthrough();
const ThrottlePolicy = z.enum(["hard_cap", "throttle", "overage_billing", "warn_only"]);
const ServiceDefaultSettings = z
  .object({
    default_trial_days: z.number().int().gte(0).lte(90).default(0),
    trial_requires_payment_method: z.boolean().default(false),
    default_data_cap_gb: z.union([z.number(), z.null()]),
    throttle_policy: ThrottlePolicy,
    throttle_speed_percent: z.number().int().gte(1).lte(100).default(10),
    default_credit_limit: z.number().gte(0).default(0),
    auto_suspend_threshold: z.number().gte(0).default(0),
    grace_period_days: z.number().int().gte(0).lte(30).default(7),
    reconnection_fee: z.number().gte(0).default(0),
  })
  .partial()
  .passthrough();
const TaxType = z.enum(["vat", "gst", "sales_tax", "custom"]);
const TaxCalculationMethod = z.enum(["inclusive", "exclusive", "compound"]);
const TaxSettings = z
  .object({
    tax_enabled: z.boolean().default(true),
    default_tax_type: TaxType,
    default_tax_rate: z.number().gte(0).lte(100).default(0),
    tax_calculation_method: TaxCalculationMethod,
    require_tax_id: z.boolean().default(false),
    tax_id_label: z.string().max(50).default("Tax ID"),
    validate_tax_id_format: z.boolean().default(false),
    allow_tax_exemptions: z.boolean().default(true),
    require_exemption_certificate: z.boolean().default(true),
    regional_tax_rates: z.record(z.string(), z.number()),
    tax_reporting_enabled: z.boolean().default(false),
    tax_registration_number: z.union([z.string(), z.null()]),
  })
  .partial()
  .passthrough();
const InvoiceNumberingFormat = z.enum([
  "sequential",
  "prefix_sequential",
  "year_sequential",
  "custom_pattern",
]);
const PaymentTerms = z.enum(["due_on_receipt", "net_7", "net_15", "net_30", "net_60", "custom"]);
const DunningStrategy = z.enum(["gentle", "moderate", "aggressive", "custom"]);
const BillingSettings = z
  .object({
    invoice_numbering_format: InvoiceNumberingFormat,
    invoice_prefix: z.string().min(1).max(10).default("INV"),
    invoice_sequence_start: z.number().int().gte(1).default(1),
    invoice_sequence_padding: z.number().int().gte(1).lte(12).default(6),
    invoice_custom_pattern: z.union([z.string(), z.null()]),
    default_payment_terms: PaymentTerms,
    custom_payment_terms_days: z.union([z.number(), z.null()]),
    late_fee_enabled: z.boolean().default(true),
    late_fee_type: z.string().default("percentage"),
    late_fee_amount: z.number().gte(0).default(5),
    late_fee_grace_days: z.number().int().gte(0).lte(30).default(5),
    late_fee_max_amount: z.union([z.number(), z.null()]),
    dunning_enabled: z.boolean().default(true),
    dunning_strategy: DunningStrategy,
    dunning_first_notice_days: z.number().int().gte(0).lte(30).default(3),
    dunning_escalation_days: z.number().int().gte(1).lte(30).default(7),
    dunning_max_notices: z.number().int().gte(1).lte(10).default(3),
    invoice_logo_url: z.union([z.string(), z.null()]),
    invoice_footer_text: z.union([z.string(), z.null()]),
    invoice_notes: z.union([z.string(), z.null()]),
    auto_billing_enabled: z.boolean().default(true),
    auto_billing_retry_enabled: z.boolean().default(true),
    auto_billing_retry_days: z.array(z.number().int()),
  })
  .partial()
  .passthrough();
const BankAccountSettings = z
  .object({
    default_bank_account_id: z.union([z.number(), z.null()]),
    default_bank_account_name: z.union([z.string(), z.null()]),
    payment_methods_enabled: z.array(z.string()),
    stripe_enabled: z.boolean().default(false),
    paypal_enabled: z.boolean().default(false),
    paystack_enabled: z.boolean().default(false),
    flutterwave_enabled: z.boolean().default(false),
    bank_transfer_enabled: z.boolean().default(true),
    bank_name: z.union([z.string(), z.null()]),
    bank_account_number: z.union([z.string(), z.null()]),
    bank_routing_number: z.union([z.string(), z.null()]),
    bank_iban: z.union([z.string(), z.null()]),
    bank_swift_code: z.union([z.string(), z.null()]),
    auto_reconcile_enabled: z.boolean().default(true),
    require_payment_reference: z.boolean().default(true),
    payment_reference_format: z.string().max(100).default("INV-{invoice_number}"),
  })
  .partial()
  .passthrough();
const ISPSettings = z
  .object({
    is_initial_setup: z.boolean().default(true),
    settings_version: z.number().int().default(1),
    subscriber_id: SubscriberIDSettings,
    radius: RADIUSDefaultSettings,
    network: NetworkProvisioningSettings,
    compliance: ComplianceSettings,
    portal: PortalCustomizationSettings,
    localization: LocalizationSettings,
    sla: SLASettings,
    service_defaults: ServiceDefaultSettings,
    tax: TaxSettings,
    billing: BillingSettings,
    bank_accounts: BankAccountSettings,
  })
  .partial()
  .passthrough();
const SettingsUpdateRequest = z
  .object({
    updates: z.object({}).partial().passthrough(),
    validate_only: z.boolean().optional().default(false),
  })
  .passthrough();
const SettingsUpdateResponse = z
  .object({ success: z.boolean(), settings: ISPSettings, message: z.string() })
  .passthrough();
const ValidationError = z
  .object({ loc: z.array(z.union([z.string(), z.number()])), msg: z.string(), type: z.string() })
  .passthrough();
const HTTPValidationError = z
  .object({ detail: z.array(ValidationError) })
  .partial()
  .passthrough();
const SettingsSectionUpdateRequest = z
  .object({ updates: z.object({}).partial().passthrough() })
  .passthrough();
const SettingsValidationRequest = z
  .object({ settings: z.object({}).partial().passthrough() })
  .passthrough();
const SettingsValidationResponse = z
  .object({ is_valid: z.boolean(), errors: z.array(z.string()).optional() })
  .passthrough();
const SettingsImportRequest = z
  .object({
    settings: z.object({}).partial().passthrough(),
    validate_only: z.boolean().optional().default(false),
  })
  .passthrough();

export const schemas = {
  IDGenerationFormat,
  SubscriberIDSettings,
  PasswordHashMethod,
  RADIUSDefaultSettings,
  NetworkProvisioningSettings,
  DataResidencyRegion,
  ComplianceSettings,
  PortalCustomizationSettings,
  LocalizationSettings,
  SLASettings,
  ThrottlePolicy,
  ServiceDefaultSettings,
  TaxType,
  TaxCalculationMethod,
  TaxSettings,
  InvoiceNumberingFormat,
  PaymentTerms,
  DunningStrategy,
  BillingSettings,
  BankAccountSettings,
  ISPSettings,
  SettingsUpdateRequest,
  SettingsUpdateResponse,
  ValidationError,
  HTTPValidationError,
  SettingsSectionUpdateRequest,
  SettingsValidationRequest,
  SettingsValidationResponse,
  SettingsImportRequest,
};

const endpoints = makeApi([
  {
    method: "get",
    path: "/isp-settings",
    alias: "get_isp_settings_isp_settings_get",
    description: `Get ISP settings - exposes ISPSettings schema.`,
    requestFormat: "json",
    response: ISPSettings,
  },
  {
    method: "patch",
    path: "/isp-settings",
    alias: "update_isp_settings_isp_settings_patch",
    description: `Update ISP settings - exposes update request/response schemas.`,
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: SettingsUpdateRequest,
      },
    ],
    response: SettingsUpdateResponse,
    errors: [
      {
        status: 422,
        description: `Validation Error`,
        schema: HTTPValidationError,
      },
    ],
  },
  {
    method: "patch",
    path: "/isp-settings/:section",
    alias: "update_isp_settings_section_isp_settings__section__patch",
    description: `Update ISP settings section - exposes section update schema.`,
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: z.object({ updates: z.object({}).partial().passthrough() }).passthrough(),
      },
      {
        name: "section",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: SettingsUpdateResponse,
    errors: [
      {
        status: 422,
        description: `Validation Error`,
        schema: HTTPValidationError,
      },
    ],
  },
  {
    method: "post",
    path: "/isp-settings/import",
    alias: "import_isp_settings_isp_settings_import_post",
    description: `Import ISP settings - exposes import schema.`,
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: SettingsImportRequest,
      },
    ],
    response: SettingsUpdateResponse,
    errors: [
      {
        status: 422,
        description: `Validation Error`,
        schema: HTTPValidationError,
      },
    ],
  },
  {
    method: "post",
    path: "/isp-settings/validate",
    alias: "validate_isp_settings_isp_settings_validate_post",
    description: `Validate ISP settings - exposes validation schemas.`,
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: z.object({ settings: z.object({}).partial().passthrough() }).passthrough(),
      },
    ],
    response: SettingsValidationResponse,
    errors: [
      {
        status: 422,
        description: `Validation Error`,
        schema: HTTPValidationError,
      },
    ],
  },
]);

export const api = new Zodios(endpoints);

export function createApiClient(baseUrl: string, options?: ZodiosOptions) {
  return new Zodios(baseUrl, endpoints, options);
}
