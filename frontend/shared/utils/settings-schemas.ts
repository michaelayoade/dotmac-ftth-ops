/**
 * Zod schemas for admin settings validation
 */

import { z } from "zod";

/**
 * Settings categories as const array for type safety
 */
export const SETTINGS_CATEGORIES = [
  "database",
  "jwt",
  "redis",
  "vault",
  "storage",
  "email",
  "tenant",
  "cors",
  "rate_limit",
  "observability",
  "celery",
  "features",
  "billing",
  "branding",
  "urls",
] as const;

/**
 * Settings category schema
 */
export const SettingsCategorySchema = z.enum(SETTINGS_CATEGORIES);
export type SettingsCategory = z.infer<typeof SettingsCategorySchema>;

/**
 * Setting field schema
 */
export const SettingFieldSchema = z.object({
  name: z.string(),
  value: z.any(),
  type: z.string(),
  description: z.string().nullable().optional(),
  default: z.any().optional(),
  required: z.boolean(),
  sensitive: z.boolean(),
  validation_rules: z.record(z.string(), z.any()).nullable().optional(),
});

export type SettingField = z.infer<typeof SettingFieldSchema>;

/**
 * Settings response schema
 */
export const SettingsResponseSchema = z.object({
  category: SettingsCategorySchema,
  display_name: z.string(),
  fields: z.array(SettingFieldSchema),
  last_updated: z.string().nullable().optional(),
  updated_by: z.string().nullable().optional(),
});

export type SettingsResponse = z.infer<typeof SettingsResponseSchema>;

/**
 * Settings category info schema
 */
export const SettingsCategoryInfoSchema = z.object({
  category: SettingsCategorySchema,
  display_name: z.string(),
  description: z.string(),
  fields_count: z.number(),
  has_sensitive_fields: z.boolean(),
  restart_required: z.boolean(),
  last_updated: z.string().nullable().optional(),
});

export type SettingsCategoryInfo = z.infer<typeof SettingsCategoryInfoSchema>;

/**
 * Settings update request schema
 */
export const SettingsUpdateRequestSchema = z.object({
  updates: z.record(z.string(), z.any()),
  validate_only: z.boolean().optional(),
  restart_required: z.boolean().optional(),
  reason: z.string().nullable().optional(),
});

export type SettingsUpdateRequest = z.infer<typeof SettingsUpdateRequestSchema>;

/**
 * Settings validation result schema
 */
export const SettingsValidationResultSchema = z.object({
  valid: z.boolean(),
  errors: z.record(z.string(), z.string()),
  warnings: z.record(z.string(), z.string()),
  restart_required: z.boolean(),
});

export type SettingsValidationResult = z.infer<typeof SettingsValidationResultSchema>;

/**
 * Audit log schema
 */
export const AuditLogSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  user_id: z.string(),
  user_email: z.string(),
  category: SettingsCategorySchema,
  action: z.string(),
  changes: z.record(
    z.string(),
    z.object({
      old: z.any(),
      new: z.any(),
    }),
  ),
  reason: z.string().nullable().optional(),
  ip_address: z.string().nullable().optional(),
  user_agent: z.string().nullable().optional(),
});

export type AuditLog = z.infer<typeof AuditLogSchema>;
