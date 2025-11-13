/**
 * IP Address Validation and Utilities
 *
 * Provides validation, parsing, and manipulation of IPv4 and IPv6 addresses
 */

// IP address family
export enum IPFamily {
  IPv4 = 4,
  IPv6 = 6,
}

// IP address with CIDR notation
export interface IPAddressWithCIDR {
  address: string;
  cidr: number;
  family: IPFamily;
}

// Dual-stack IP configuration
export interface DualStackIP {
  ipv4?: string;
  ipv6?: string;
}

/**
 * Validate IPv4 address
 * @param ip IPv4 address string
 * @returns true if valid IPv4
 */
export function isValidIPv4(ip: string): boolean {
  const ipv4Regex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipv4Regex.test(ip);
}

/**
 * Validate IPv6 address (simplified)
 * @param ip IPv6 address string
 * @returns true if valid IPv6
 */
export function isValidIPv6(ip: string): boolean {
  // Simplified IPv6 validation (full validation is complex)
  // Matches standard notation, compressed notation, and IPv4-mapped IPv6
  const ipv6Regex =
    /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]+|::(ffff(:0{1,4})?:)?((25[0-5]|(2[0-4]|1?[0-9])?[0-9])\.){3}(25[0-5]|(2[0-4]|1?[0-9])?[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1?[0-9])?[0-9])\.){3}(25[0-5]|(2[0-4]|1?[0-9])?[0-9]))$/;
  return ipv6Regex.test(ip);
}

/**
 * Detect IP address family
 * @param ip IP address string
 * @returns IPFamily or null if invalid
 */
export function detectIPFamily(ip: string): IPFamily | null {
  if (isValidIPv4(ip)) return IPFamily.IPv4;
  if (isValidIPv6(ip)) return IPFamily.IPv6;
  return null;
}

/**
 * Validate IPv4 CIDR notation
 * @param cidr IPv4 CIDR string (e.g., "192.168.1.0/24")
 * @returns true if valid
 */
export function isValidIPv4CIDR(cidr: string): boolean {
  const parts = cidr.split("/");
  if (parts.length !== 2) return false;

  const [ip, prefix] = parts;
  if (!ip || !prefix) return false;
  if (!isValidIPv4(ip)) return false;

  const prefixNum = parseInt(prefix, 10);
  return prefixNum >= 0 && prefixNum <= 32;
}

/**
 * Validate IPv6 CIDR notation
 * @param cidr IPv6 CIDR string (e.g., "2001:db8::/32")
 * @returns true if valid
 */
export function isValidIPv6CIDR(cidr: string): boolean {
  const parts = cidr.split("/");
  if (parts.length !== 2) return false;

  const [ip, prefix] = parts;
  if (!ip || !prefix) return false;
  if (!isValidIPv6(ip)) return false;

  const prefixNum = parseInt(prefix, 10);
  return prefixNum >= 0 && prefixNum <= 128;
}

/**
 * Validate IP CIDR notation (IPv4 or IPv6)
 * @param cidr CIDR string
 * @returns true if valid
 */
export function isValidCIDR(cidr: string): boolean {
  return isValidIPv4CIDR(cidr) || isValidIPv6CIDR(cidr);
}

/**
 * Parse CIDR notation
 * @param cidr CIDR string
 * @returns Parsed IP address or null if invalid
 */
export function parseCIDR(cidr: string): IPAddressWithCIDR | null {
  const parts = cidr.split("/");
  if (parts.length !== 2) return null;

  const [address, prefixStr] = parts;
  if (!address || !prefixStr) return null;
  const family = detectIPFamily(address);
  if (!family) return null;

  const cidrNum = parseInt(prefixStr, 10);
  const maxPrefix = family === IPFamily.IPv4 ? 32 : 128;

  if (cidrNum < 0 || cidrNum > maxPrefix) return null;

  return {
    address,
    cidr: cidrNum,
    family,
  };
}

/**
 * Format IP address with CIDR
 * @param address IP address
 * @param cidr CIDR prefix length
 * @returns Formatted CIDR string
 */
export function formatCIDR(address: string, cidr: number): string {
  return `${address}/${cidr}`;
}

/**
 * Compress IPv6 address (convert to shortest form)
 * @param ipv6 IPv6 address string
 * @returns Compressed IPv6 or original if invalid
 */
export function compressIPv6(ipv6: string): string {
  if (!isValidIPv6(ipv6)) return ipv6;

  // Remove leading zeros in each group
  let compressed = ipv6.replace(/\b0+([0-9a-fA-F]+)/g, "$1");

  // Replace longest sequence of zeros with ::
  const sequences = compressed.match(/(:0)+/g) || [];
  if (sequences.length > 0) {
    const longest = sequences.reduce((a, b) => (a.length > b.length ? a : b));
    compressed = compressed.replace(longest, ":");
  }

  return compressed;
}

/**
 * Expand IPv6 address (convert to full form)
 * @param ipv6 IPv6 address string
 * @returns Expanded IPv6 or original if invalid
 */
export function expandIPv6(ipv6: string): string {
  if (!isValidIPv6(ipv6)) return ipv6;

  // Handle :: notation
  if (ipv6.includes("::")) {
    const parts = ipv6.split("::");
    const left = parts[0] ? parts[0].split(":") : [];
    const right = parts[1] ? parts[1].split(":") : [];
    const missing = 8 - left.length - right.length;
    const middle = Array(missing).fill("0000");
    ipv6 = [...left, ...middle, ...right].join(":");
  }

  // Pad each group to 4 digits
  return ipv6
    .split(":")
    .map((group) => group.padStart(4, "0"))
    .join(":");
}

/**
 * Calculate IPv4 network address from CIDR
 * @param cidr IPv4 CIDR string
 * @returns Network address or null if invalid
 */
export function getIPv4Network(cidr: string): string | null {
  const parsed = parseCIDR(cidr);
  if (!parsed || parsed.family !== IPFamily.IPv4) return null;

  const octets = parsed.address.split(".").map(Number);
  const mask = ~((1 << (32 - parsed.cidr)) - 1);

  const network = octets.map((octet, i) => {
    const shift = 24 - i * 8;
    const maskByte = (mask >> shift) & 0xff;
    return octet & maskByte;
  });

  return network.join(".");
}

/**
 * Calculate IPv4 broadcast address from CIDR
 * @param cidr IPv4 CIDR string
 * @returns Broadcast address or null if invalid
 */
export function getIPv4Broadcast(cidr: string): string | null {
  const parsed = parseCIDR(cidr);
  if (!parsed || parsed.family !== IPFamily.IPv4) return null;

  const octets = parsed.address.split(".").map(Number);
  const mask = ~((1 << (32 - parsed.cidr)) - 1);

  const broadcast = octets.map((octet, i) => {
    const shift = 24 - i * 8;
    const maskByte = (mask >> shift) & 0xff;
    return octet | (~maskByte & 0xff);
  });

  return broadcast.join(".");
}

/**
 * Calculate number of usable hosts in IPv4 subnet
 * @param cidr CIDR prefix length
 * @returns Number of usable hosts
 */
export function getIPv4UsableHosts(cidr: number): number {
  if (cidr < 0 || cidr > 32) return 0;
  if (cidr === 31 || cidr === 32) return 0; // Point-to-point or single host
  return Math.pow(2, 32 - cidr) - 2; // Subtract network and broadcast
}

/**
 * Check if IP is in private range (RFC 1918)
 * @param ip IPv4 address
 * @returns true if private
 */
export function isPrivateIPv4(ip: string): boolean {
  if (!isValidIPv4(ip)) return false;

  const octets = ip.split(".").map(Number);
  const firstOctet = octets[0] ?? 0;
  const secondOctet = octets[1] ?? 0;

  // 10.0.0.0/8
  if (firstOctet === 10) return true;

  // 172.16.0.0/12
  if (firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31) return true;

  // 192.168.0.0/16
  if (firstOctet === 192 && secondOctet === 168) return true;

  return false;
}

/**
 * Check if IPv6 is a ULA (Unique Local Address)
 * @param ip IPv6 address
 * @returns true if ULA (fc00::/7)
 */
export function isULAIPv6(ip: string): boolean {
  if (!isValidIPv6(ip)) return false;

  const expanded = expandIPv6(ip);
  const firstByte = parseInt(expanded.substring(0, 2), 16);

  // ULA range: fc00::/7 (fc00 - fdff)
  return firstByte >= 0xfc && firstByte <= 0xfd;
}

/**
 * Check if IPv6 is link-local
 * @param ip IPv6 address
 * @returns true if link-local (fe80::/10)
 */
export function isLinkLocalIPv6(ip: string): boolean {
  if (!isValidIPv6(ip)) return false;

  return ip.toLowerCase().startsWith("fe80:");
}

/**
 * Validate dual-stack configuration
 * @param config Dual-stack IP configuration
 * @returns true if at least one valid IP is present
 */
export function isValidDualStack(config: DualStackIP): boolean {
  const hasIPv4 = config.ipv4 ? isValidIPv4(config.ipv4) || isValidIPv4CIDR(config.ipv4) : false;
  const hasIPv6 = config.ipv6 ? isValidIPv6(config.ipv6) || isValidIPv6CIDR(config.ipv6) : false;

  return hasIPv4 || hasIPv6;
}

/**
 * Extract IP address from CIDR notation
 * @param cidr CIDR string
 * @returns IP address without prefix
 */
export function extractIPFromCIDR(cidr: string): string {
  return cidr.split("/")[0] ?? "";
}

/**
 * Extract CIDR prefix from notation
 * @param cidr CIDR string
 * @returns CIDR prefix number or null
 */
export function extractPrefixFromCIDR(cidr: string): number | null {
  const parts = cidr.split("/");
  if (parts.length !== 2 || !parts[1]) return null;

  const prefix = parseInt(parts[1], 10);
  return isNaN(prefix) ? null : prefix;
}

/**
 * Format IP address for display
 * @param ip IP address (with or without CIDR)
 * @param compress Whether to compress IPv6 addresses
 * @returns Formatted IP address
 */
export function formatIPAddress(ip: string, compress: boolean = true): string {
  const parsed = parseCIDR(ip);

  if (!parsed) {
    // Not CIDR notation, check if it's a plain IP
    if (isValidIPv6(ip) && compress) {
      return compressIPv6(ip);
    }
    return ip;
  }

  // Format with CIDR
  const address =
    parsed.family === IPFamily.IPv6 && compress ? compressIPv6(parsed.address) : parsed.address;

  return formatCIDR(address, parsed.cidr);
}

/**
 * Get subnet mask from CIDR prefix (IPv4 only)
 * @param cidr CIDR prefix length
 * @returns Subnet mask in dotted notation
 */
export function cidrToSubnetMask(cidr: number): string | null {
  if (cidr < 0 || cidr > 32) return null;

  const mask = ~((1 << (32 - cidr)) - 1);
  const octets = [(mask >> 24) & 0xff, (mask >> 16) & 0xff, (mask >> 8) & 0xff, mask & 0xff];

  return octets.join(".");
}

/**
 * Convert subnet mask to CIDR prefix (IPv4 only)
 * @param mask Subnet mask in dotted notation
 * @returns CIDR prefix length or null
 */
export function subnetMaskToCIDR(mask: string): number | null {
  if (!isValidIPv4(mask)) return null;

  const octets = mask.split(".").map(Number);
  const binaryString = octets.map((o) => o.toString(2).padStart(8, "0")).join("");

  // Count consecutive 1s from the start
  const ones = binaryString.match(/^1+/);
  if (!ones) return 0;

  const cidr = ones[0].length;

  // Verify it's a valid mask (all 1s followed by all 0s)
  const expected = "1".repeat(cidr) + "0".repeat(32 - cidr);
  if (binaryString !== expected) return null;

  return cidr;
}
