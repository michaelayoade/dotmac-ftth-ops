/**
 * Zod schemas for RADIUS data validation
 */

import { z } from "zod";

/**
 * RADIUS Subscriber schema
 */
export const RADIUSSubscriberSchema = z.object({
  id: z.number(),
  tenant_id: z.string(),
  subscriber_id: z.string(),
  username: z.string(),
  enabled: z.boolean(),
  bandwidth_profile_id: z.string().nullable().optional(),
  framed_ipv4_address: z.string().nullable().optional(),
  framed_ipv6_address: z.string().nullable().optional(),
  delegated_ipv6_prefix: z.string().nullable().optional(),
  session_timeout: z.number().nullable().optional(),
  idle_timeout: z.number().nullable().optional(),
  created_at: z.string(),
});

export type RADIUSSubscriber = z.infer<typeof RADIUSSubscriberSchema>;

/**
 * RADIUS Session schema
 */
export const RADIUSSessionSchema = z.object({
  radacctid: z.number(),
  tenant_id: z.string(),
  subscriber_id: z.string().nullable(),
  username: z.string(),
  acctsessionid: z.string(),
  nasipaddress: z.string(),
  framedipaddress: z.string().nullable(),
  framedipv6address: z.string().nullable(),
  framedipv6prefix: z.string().nullable(),
  delegatedipv6prefix: z.string().nullable(),
  acctstarttime: z.string().nullable(),
  acctsessiontime: z.number().nullable(),
  acctinputoctets: z.number().nullable(),
  acctoutputoctets: z.number().nullable(),
});

export type RADIUSSession = z.infer<typeof RADIUSSessionSchema>;
