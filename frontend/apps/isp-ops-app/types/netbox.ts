/**
 * NetBox IPAM & DCIM Type Definitions
 *
 * Type definitions matching NetBox backend API schemas
 */

// ============================================================================
// IPAM (IP Address Management)
// ============================================================================

export interface IPAddress {
  id: number;
  address: string; // e.g., "10.0.0.1/24"
  status: {
    value: string;
    label: string;
  };
  tenant?: {
    id: number;
    name: string;
    slug: string;
  };
  vrf?: {
    id: number;
    name: string;
    rd: string;
  };
  description: string;
  dns_name: string;
  assigned_object_type?: string;
  assigned_object_id?: number;
  assigned_object?: any;
  created?: string;
  last_updated?: string;
  tags: Array<{
    id: number;
    name: string;
    slug: string;
    color: string;
  }>;
}

export interface CreateIPAddressRequest {
  address: string;
  status?: string; // active, reserved, deprecated, dhcp, slaac
  tenant?: number;
  vrf?: number;
  description?: string;
  dns_name?: string;
  assigned_object_type?: string;
  assigned_object_id?: number;
  tags?: string[];
  custom_fields?: Record<string, any>;
}

export interface UpdateIPAddressRequest {
  status?: string;
  tenant?: number;
  vrf?: number;
  description?: string;
  dns_name?: string;
  tags?: string[];
  custom_fields?: Record<string, any>;
}

export interface Prefix {
  id: number;
  prefix: string; // e.g., "10.0.0.0/24"
  status: {
    value: string;
    label: string;
  };
  tenant?: {
    id: number;
    name: string;
    slug: string;
  };
  vrf?: {
    id: number;
    name: string;
    rd: string;
  };
  site?: {
    id: number;
    name: string;
    slug: string;
  };
  vlan?: {
    id: number;
    vid: number;
    name: string;
  };
  role?: {
    id: number;
    name: string;
    slug: string;
  };
  is_pool: boolean;
  description: string;
  created?: string;
  last_updated?: string;
}

export interface CreatePrefixRequest {
  prefix: string;
  status?: string;
  tenant?: number;
  vrf?: number;
  site?: number;
  vlan?: number;
  role?: number;
  is_pool?: boolean;
  description?: string;
  tags?: string[];
}

export interface VRF {
  id: number;
  name: string;
  rd?: string; // Route distinguisher
  tenant?: {
    id: number;
    name: string;
    slug: string;
  };
  enforce_unique: boolean;
  description: string;
  created?: string;
  last_updated?: string;
}

export interface CreateVRFRequest {
  name: string;
  rd?: string;
  tenant?: number;
  enforce_unique?: boolean;
  description?: string;
  tags?: string[];
}

export interface VLAN {
  id: number;
  vid: number; // VLAN ID (1-4094)
  name: string;
  status: {
    value: string;
    label: string;
  };
  tenant?: {
    id: number;
    name: string;
    slug: string;
  };
  site?: {
    id: number;
    name: string;
    slug: string;
  };
  group?: {
    id: number;
    name: string;
    slug: string;
  };
  role?: {
    id: number;
    name: string;
    slug: string;
  };
  description: string;
  created?: string;
  last_updated?: string;
}

export interface CreateVLANRequest {
  vid: number;
  name: string;
  status?: string;
  tenant?: number;
  site?: number;
  group?: number;
  role?: number;
  description?: string;
  tags?: string[];
}

export interface UpdateVLANRequest {
  name?: string;
  status?: string;
  tenant?: number;
  site?: number;
  group?: number;
  role?: number;
  description?: string;
  tags?: string[];
}

export interface IPAllocationRequest {
  description?: string;
  dns_name?: string;
  tenant?: number;
}

export interface AvailableIP {
  address: string;
  family: number; // 4 or 6
}

// Dual-stack IP allocation request
export interface DualStackAllocationRequest {
  ipv4_prefix_id: number;
  ipv6_prefix_id: number;
  description?: string;
  dns_name?: string;
  tenant?: number;
}

// Dual-stack IP allocation response
export interface DualStackAllocationResponse {
  ipv4: IPAddress;
  ipv6: IPAddress;
}

// Bulk IP allocation request
export interface BulkIPAllocationRequest {
  prefix_id: number;
  count: number;
  description_prefix?: string;
  tenant?: number;
}

// Bulk IP allocation response
export interface BulkIPAllocationResponse {
  allocated: IPAddress[];
  count: number;
}

// ============================================================================
// DCIM (Data Center Infrastructure Management)
// ============================================================================

export interface Site {
  id: number;
  name: string;
  slug: string;
  status: {
    value: string;
    label: string;
  };
  tenant?: {
    id: number;
    name: string;
    slug: string;
  };
  facility: string;
  description: string;
  physical_address: string;
  latitude?: number;
  longitude?: number;
  created?: string;
  last_updated?: string;
}

export interface CreateSiteRequest {
  name: string;
  slug: string;
  status?: string;
  tenant?: number;
  facility?: string;
  asn?: number;
  time_zone?: string;
  description?: string;
  physical_address?: string;
  shipping_address?: string;
  latitude?: number;
  longitude?: number;
  tags?: string[];
}

export interface Device {
  id: number;
  name: string;
  device_type: {
    id: number;
    manufacturer: {
      id: number;
      name: string;
      slug: string;
    };
    model: string;
    slug: string;
  };
  device_role: {
    id: number;
    name: string;
    slug: string;
  };
  tenant?: {
    id: number;
    name: string;
    slug: string;
  };
  platform?: {
    id: number;
    name: string;
    slug: string;
  };
  serial: string;
  asset_tag?: string;
  site: {
    id: number;
    name: string;
    slug: string;
  };
  rack?: {
    id: number;
    name: string;
    display_name: string;
  };
  position?: number;
  face?: {
    value: string;
    label: string;
  };
  status: {
    value: string;
    label: string;
  };
  primary_ip?: {
    id: number;
    address: string;
    family: number;
  };
  primary_ip4?: {
    id: number;
    address: string;
  };
  primary_ip6?: {
    id: number;
    address: string;
  };
  created?: string;
  last_updated?: string;
}

export interface CreateDeviceRequest {
  name: string;
  device_type: number;
  device_role: number;
  site: number;
  tenant?: number;
  platform?: number;
  serial?: string;
  asset_tag?: string;
  status?: string;
  rack?: number;
  position?: number;
  face?: string;
  primary_ip4?: number;
  primary_ip6?: number;
  comments?: string;
  tags?: string[];
}

export interface UpdateDeviceRequest {
  name?: string;
  device_role?: number;
  tenant?: number;
  platform?: number;
  serial?: string;
  asset_tag?: string;
  status?: string;
  primary_ip4?: number;
  primary_ip6?: number;
  comments?: string;
  tags?: string[];
}

export interface Interface {
  id: number;
  device: {
    id: number;
    name: string;
  };
  name: string;
  type: {
    value: string;
    label: string;
  };
  enabled: boolean;
  mtu?: number;
  mac_address?: string;
  description: string;
  mode?: {
    value: string;
    label: string;
  };
  untagged_vlan?: {
    id: number;
    vid: number;
    name: string;
  };
  tagged_vlans: Array<{
    id: number;
    vid: number;
    name: string;
  }>;
  created?: string;
  last_updated?: string;
}

export interface CreateInterfaceRequest {
  device: number;
  name: string;
  type: string; // 1000base-t, 10gbase-x, sfp-plus, etc.
  enabled?: boolean;
  mtu?: number;
  mac_address?: string;
  description?: string;
  mode?: string; // access, tagged, tagged-all
  untagged_vlan?: number;
  tagged_vlans?: number[];
  tags?: string[];
}

export interface Cable {
  id: number;
  type: {
    value: string;
    label: string;
  };
  status: {
    value: string;
    label: string;
  };
  tenant?: {
    id: number;
    name: string;
    slug: string;
  };
  label: string;
  color: string;
  length?: number;
  length_unit?: {
    value: string;
    label: string;
  };
  a_terminations: any[];
  b_terminations: any[];
  created?: string;
  last_updated?: string;
}

export interface CreateCableRequest {
  type: string;
  status?: string;
  tenant?: number;
  label?: string;
  color?: string;
  length?: number;
  length_unit?: string;
  a_terminations: Array<{
    object_type: string;
    object_id: number;
  }>;
  b_terminations: Array<{
    object_type: string;
    object_id: number;
  }>;
  tags?: string[];
}

// ============================================================================
// Circuits
// ============================================================================

export interface CircuitProvider {
  id: number;
  name: string;
  slug: string;
  asn?: number;
  account: string;
  portal_url: string;
  noc_contact: string;
  admin_contact: string;
  created?: string;
  last_updated?: string;
}

export interface CreateCircuitProviderRequest {
  name: string;
  slug: string;
  asn?: number;
  account?: string;
  portal_url?: string;
  noc_contact?: string;
  admin_contact?: string;
  tags?: string[];
}

export interface CircuitType {
  id: number;
  name: string;
  slug: string;
  description: string;
  created?: string;
  last_updated?: string;
}

export interface CreateCircuitTypeRequest {
  name: string;
  slug: string;
  description?: string;
  tags?: string[];
}

export interface Circuit {
  id: number;
  cid: string; // Circuit ID
  provider: {
    id: number;
    name: string;
    slug: string;
  };
  type: {
    id: number;
    name: string;
    slug: string;
  };
  status: {
    value: string;
    label: string;
  };
  tenant?: {
    id: number;
    name: string;
    slug: string;
  };
  install_date?: string;
  commit_rate?: number; // Kbps
  description: string;
  comments: string;
  created?: string;
  last_updated?: string;
}

export interface CreateCircuitRequest {
  cid: string;
  provider: number;
  type: number;
  status?: string;
  tenant?: number;
  install_date?: string;
  commit_rate?: number;
  description?: string;
  comments?: string;
  tags?: string[];
}

export interface UpdateCircuitRequest {
  cid?: string;
  provider?: number;
  type?: number;
  status?: string;
  tenant?: number;
  install_date?: string;
  commit_rate?: number;
  description?: string;
  comments?: string;
  tags?: string[];
}

// ============================================================================
// Health & Utility
// ============================================================================

export interface NetBoxHealth {
  healthy: boolean;
  message: string;
  version?: string;
}

export interface NetBoxQueryParams {
  tenant?: string;
  site?: string;
  limit?: number;
  offset?: number;
}
