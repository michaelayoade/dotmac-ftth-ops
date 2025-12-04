import { z } from "zod";

const subscriberIdSchema = z
  .object({
    strategy: z.string().optional(),
    prefix: z.string().optional(),
    next_id: z.number().optional(),
  })
  .passthrough();

const radiusSchema = z
  .object({
    default_vlan: z.string().optional(),
    default_shared_secret: z.string().optional(),
  })
  .passthrough();

const networkSchema = z
  .object({
    default_dns: z.array(z.string()).optional(),
    provisioning_mode: z.string().optional(),
  })
  .passthrough();

const complianceSchema = z
  .object({
    data_retention_days: z.number().optional(),
  })
  .passthrough();

const portalSchema = z
  .object({
    portal_url: z.string().url().optional(),
    support_email: z.string().email().optional(),
  })
  .passthrough();

const localizationSchema = z
  .object({
    timezone: z.string().optional(),
    locale: z.string().optional(),
    currency: z.string().optional(),
  })
  .passthrough();

const slaSchema = z
  .object({
    response_minutes: z.number().optional(),
    resolution_minutes: z.number().optional(),
  })
  .passthrough();

const serviceDefaultsSchema = z
  .object({
    default_speed_mbps: z.number().optional(),
    default_contract_months: z.number().optional(),
  })
  .passthrough();

const taxSchema = z
  .object({
    country_code: z.string().optional(),
    default_rate: z.number().optional(),
  })
  .passthrough();

const billingSchema = z
  .object({
    invoice_prefix: z.string().optional(),
    due_days: z.number().optional(),
  })
  .passthrough();

const bankAccountsSchema = z
  .object({
    accounts: z.array(z.record(z.any())).optional(),
  })
  .passthrough();

export const ispSettingsSchema = z
  .object({
    is_initial_setup: z.boolean(),
    settings_version: z.number(),
    subscriber_id: subscriberIdSchema.optional(),
    radius: radiusSchema.optional(),
    network: networkSchema.optional(),
    compliance: complianceSchema.optional(),
    portal: portalSchema.optional(),
    localization: localizationSchema.optional(),
    sla: slaSchema.optional(),
    service_defaults: serviceDefaultsSchema.optional(),
    tax: taxSchema.optional(),
    billing: billingSchema.optional(),
    bank_accounts: bankAccountsSchema.optional(),
  })
  .passthrough();

export const ispSettingsUpdateSchema = ispSettingsSchema.partial();
