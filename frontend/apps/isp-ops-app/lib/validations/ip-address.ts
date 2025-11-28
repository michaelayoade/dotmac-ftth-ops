/**
 * Zod validation schemas for IP addresses
 *
 * Provides runtime validation for IP addresses, CIDR notation, and dual-stack configurations
 */

import { z } from "zod";
import {
  isValidIPv4,
  isValidIPv6,
  isValidIPv4CIDR,
  isValidIPv6CIDR,
  isValidCIDR,
  detectIPFamily,
  IPFamily,
} from "@/lib/utils/ip-address";

// IPv4 address validation
export const ipv4Schema = z.string().refine((val) => isValidIPv4(val), {
  message: "Invalid IPv4 address format (e.g., 192.168.1.1)",
});

// IPv6 address validation
export const ipv6Schema = z.string().refine((val) => isValidIPv6(val), {
  message: "Invalid IPv6 address format (e.g., 2001:db8::1)",
});

// IP address validation (IPv4 or IPv6)
export const ipAddressSchema = z.string().refine((val) => detectIPFamily(val) !== null, {
  message: "Invalid IP address format",
});

// IPv4 CIDR notation validation
export const ipv4CIDRSchema = z.string().refine((val) => isValidIPv4CIDR(val), {
  message: "Invalid IPv4 CIDR notation (e.g., 192.168.1.0/24)",
});

// IPv6 CIDR notation validation
export const ipv6CIDRSchema = z.string().refine((val) => isValidIPv6CIDR(val), {
  message: "Invalid IPv6 CIDR notation (e.g., 2001:db8::/64)",
});

// IP CIDR notation validation (IPv4 or IPv6)
export const ipCIDRSchema = z.string().refine((val) => isValidCIDR(val), {
  message: "Invalid IP CIDR notation",
});

// Optional IPv4 address
export const optionalIPv4Schema = z
  .union([ipv4Schema, z.literal(""), z.null(), z.undefined()])
  .transform((val) => val || null);

// Optional IPv6 address
export const optionalIPv6Schema = z
  .union([ipv6Schema, z.literal(""), z.null(), z.undefined()])
  .transform((val) => val || null);

// Optional IPv4 CIDR
export const optionalIPv4CIDRSchema = z
  .union([ipv4CIDRSchema, z.literal(""), z.null(), z.undefined()])
  .transform((val) => val || null);

// Optional IPv6 CIDR
export const optionalIPv6CIDRSchema = z
  .union([ipv6CIDRSchema, z.literal(""), z.null(), z.undefined()])
  .transform((val) => val || null);

// Dual-stack IP configuration
export const dualStackIPSchema = z
  .object({
    ipv4: optionalIPv4Schema,
    ipv6: optionalIPv6Schema,
  })
  .refine((data) => data.ipv4 !== null || data.ipv6 !== null, {
    message: "At least one IP address (IPv4 or IPv6) must be provided",
    path: ["ipv4"],
  });

// Dual-stack CIDR configuration
export const dualStackCIDRSchema = z
  .object({
    ipv4: optionalIPv4CIDRSchema,
    ipv6: optionalIPv6CIDRSchema,
  })
  .refine((data) => data.ipv4 !== null || data.ipv6 !== null, {
    message: "At least one IP CIDR (IPv4 or IPv6) must be provided",
    path: ["ipv4"],
  });

// Subnet mask validation (IPv4 only)
export const subnetMaskSchema = z.string().refine(
  (val) => {
    if (!isValidIPv4(val)) return false;

    // Check if it's a valid subnet mask (contiguous 1s followed by 0s)
    const octets = val.split(".").map(Number);
    const binary = octets.map((o) => o.toString(2).padStart(8, "0")).join("");

    // Must be all 1s followed by all 0s
    const match = binary.match(/^(1*)(0*)$/);
    return match !== null && (match[1]?.length ?? 0) > 0;
  },
  {
    message: "Invalid subnet mask (e.g., 255.255.255.0)",
  },
);

// CIDR prefix length validation
export const ipv4PrefixSchema = z.number().int().min(0).max(32);
export const ipv6PrefixSchema = z.number().int().min(0).max(128);

// DNS name validation (for NetBox)
export const dnsNameSchema = z.string().refine(
  (val) => {
    // Allow empty string
    if (!val) return true;

    // RFC 1123 hostname validation
    const pattern = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z0-9-]{1,63})*$/;
    return pattern.test(val);
  },
  {
    message: "Invalid DNS name format",
  },
);

// NetBox IP allocation request schema
export const netboxIPAllocationSchema = z.object({
  description: z.string().optional(),
  dns_name: dnsNameSchema.optional(),
  tenant: z.number().int().positive().optional(),
});

// NetBox dual-stack allocation request schema
export const netboxDualStackAllocationSchema = z.object({
  ipv4_prefix_id: z.number().int().positive(),
  ipv6_prefix_id: z.number().int().positive(),
  description: z.string().optional(),
  dns_name: dnsNameSchema.optional(),
  tenant: z.number().int().positive().optional(),
});

// NetBox bulk allocation request schema
export const netboxBulkAllocationSchema = z.object({
  prefix_id: z.number().int().positive(),
  count: z.number().int().min(1).max(100),
  description_prefix: z.string().optional(),
  tenant: z.number().int().positive().optional(),
});

// RADIUS subscriber schema with IPv6 support
export const radiusSubscriberSchema = z.object({
  subscriber_id: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(8),
  bandwidth_profile_id: z.string().optional().nullable(),
  framed_ip_address: optionalIPv4Schema,
  framed_ipv6_prefix: optionalIPv6CIDRSchema,
  framed_ipv6_address: optionalIPv6CIDRSchema,
  delegated_ipv6_prefix: optionalIPv6CIDRSchema,
  session_timeout: z.number().int().positive().optional().nullable(),
  idle_timeout: z.number().int().positive().optional().nullable(),
});

// WireGuard server schema with IPv6 support
export const wireguardServerSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  public_endpoint: z.string().min(1), // hostname:port
  listen_port: z.number().int().min(1).max(65535).default(51820),
  server_ipv4: ipv4CIDRSchema,
  server_ipv6: optionalIPv6CIDRSchema,
  location: z.string().max(200).optional().nullable(),
  max_peers: z.number().int().min(1).default(1000),
  dns_servers: z.array(ipAddressSchema).default(["1.1.1.1", "1.0.0.1"]),
  allowed_ips: z.array(ipCIDRSchema).default(["0.0.0.0/0", "::/0"]),
  persistent_keepalive: z.number().int().min(0).max(3600).default(25),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// WireGuard peer schema with IPv6 support
export const wireguardPeerSchema = z.object({
  server_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  customer_id: z.string().uuid().optional().nullable(),
  subscriber_id: z.string().optional().nullable(),
  generate_keys: z.boolean().default(true),
  public_key: z.string().optional(),
  peer_ipv4: optionalIPv4CIDRSchema,
  peer_ipv6: optionalIPv6CIDRSchema,
  allowed_ips: z.array(ipCIDRSchema).optional(),
  expires_at: z.string().datetime().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().max(1000).optional().nullable(),
});

// Device monitoring schema with dual-stack support
export const deviceMonitoringSchema = z
  .object({
    device_id: z.string().uuid(),
    ipv4_address: optionalIPv4Schema,
    ipv6_address: optionalIPv6Schema,
    management_ip: ipAddressSchema,
    snmp_community: z.string().optional(),
    snmp_version: z.enum(["v1", "v2c", "v3"]).default("v2c"),
  })
  .refine((data) => data.ipv4_address !== null || data.ipv6_address !== null, {
    message: "At least one IP address must be provided for monitoring",
    path: ["ipv4_address"],
  });

// Prefix creation schema
export const prefixSchema = z.object({
  prefix: ipCIDRSchema,
  status: z.enum(["active", "reserved", "deprecated"]).default("active"),
  tenant: z.number().int().positive().optional(),
  site: z.number().int().positive().optional(),
  vlan: z.number().int().positive().optional(),
  role: z.number().int().positive().optional(),
  is_pool: z.boolean().default(false),
  description: z.string().max(500).optional(),
  tags: z.array(z.string()).optional(),
});

// Export TypeScript types from Zod schemas
export type IPv4Address = z.infer<typeof ipv4Schema>;
export type IPv6Address = z.infer<typeof ipv6Schema>;
export type IPAddress = z.infer<typeof ipAddressSchema>;
export type IPv4CIDR = z.infer<typeof ipv4CIDRSchema>;
export type IPv6CIDR = z.infer<typeof ipv6CIDRSchema>;
export type IPCIDR = z.infer<typeof ipCIDRSchema>;
export type DualStackIP = z.infer<typeof dualStackIPSchema>;
export type DualStackCIDR = z.infer<typeof dualStackCIDRSchema>;
export type NetBoxIPAllocation = z.infer<typeof netboxIPAllocationSchema>;
export type NetBoxDualStackAllocation = z.infer<typeof netboxDualStackAllocationSchema>;
export type NetBoxBulkAllocation = z.infer<typeof netboxBulkAllocationSchema>;
export type RADIUSSubscriber = z.infer<typeof radiusSubscriberSchema>;
export type WireGuardServer = z.infer<typeof wireguardServerSchema>;
export type WireGuardPeer = z.infer<typeof wireguardPeerSchema>;
export type DeviceMonitoring = z.infer<typeof deviceMonitoringSchema>;
export type PrefixCreate = z.infer<typeof prefixSchema>;
