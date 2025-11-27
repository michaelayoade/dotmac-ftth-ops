/**
 * Zod schemas for service lifecycle framework validation
 */

import { z } from "zod";

// ============================================================================
// Enums
// ============================================================================

export const ServiceStatusValueSchema = z.enum([
  "pending",
  "provisioning",
  "provisioning_failed",
  "active",
  "suspended",
  "suspended_fraud",
  "degraded",
  "maintenance",
  "terminating",
  "terminated",
  "failed",
]);
export type ServiceStatusValue = z.infer<typeof ServiceStatusValueSchema>;

// ============================================================================
// Service Statistics
// ============================================================================

export const ServiceStatisticsSchema = z.object({
  total_services: z.number(),
  active_count: z.number(),
  provisioning_count: z.number(),
  suspended_count: z.number(),
  terminated_count: z.number(),
  failed_count: z.number(),
  services_by_type: z.record(z.number()),
  healthy_count: z.number(),
  degraded_count: z.number(),
  average_uptime: z.number(),
  active_workflows: z.number(),
  failed_workflows: z.number(),
});
export type ServiceStatistics = z.infer<typeof ServiceStatisticsSchema>;

// ============================================================================
// Service Instance Summary
// ============================================================================

export const ServiceInstanceSummarySchema = z.object({
  id: z.string(),
  service_identifier: z.string(),
  service_name: z.string(),
  service_type: z.string(),
  customer_id: z.string(),
  status: ServiceStatusValueSchema,
  provisioning_status: z.string().nullable().optional(),
  activated_at: z.string().nullable().optional(),
  health_status: z.string().nullable().optional(),
  created_at: z.string(),
});
export type ServiceInstanceSummary = z.infer<typeof ServiceInstanceSummarySchema>;

// ============================================================================
// Service Instance Detail
// ============================================================================

export const ServiceInstanceDetailSchema = ServiceInstanceSummarySchema.extend({
  subscription_id: z.string().nullable().optional(),
  plan_id: z.string().nullable().optional(),
  provisioned_at: z.string().nullable().optional(),
  suspended_at: z.string().nullable().optional(),
  terminated_at: z.string().nullable().optional(),
  service_config: z.record(z.unknown()).optional(),
  equipment_assigned: z.array(z.string()).optional(),
  ip_address: z.string().nullable().optional(),
  vlan_id: z.number().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
  notes: z.string().nullable().optional(),
});
export type ServiceInstanceDetail = z.infer<typeof ServiceInstanceDetailSchema>;

// ============================================================================
// API Response Types
// ============================================================================

export const ProvisionServiceResponseSchema = z.object({
  service_instance_id: z.string(),
});
export type ProvisionServiceResponse = z.infer<typeof ProvisionServiceResponseSchema>;
