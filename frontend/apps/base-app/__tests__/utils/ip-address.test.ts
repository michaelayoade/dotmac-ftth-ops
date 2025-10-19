/**
 * Tests for IP Address Utilities
 */

import { describe, expect, it } from '@jest/globals';
import {
  isValidIPv4,
  isValidIPv6,
  detectIPFamily,
  IPFamily,
  isValidIPv4CIDR,
  isValidIPv6CIDR,
  isValidCIDR,
  parseCIDR,
  formatCIDR,
  compressIPv6,
  expandIPv6,
  getIPv4Network,
  getIPv4Broadcast,
  getIPv4UsableHosts,
  isPrivateIPv4,
  isULAIPv6,
  isLinkLocalIPv6,
  extractIPFromCIDR,
  extractPrefixFromCIDR,
  cidrToSubnetMask,
  subnetMaskToCIDR,
} from '@/lib/utils/ip-address';

describe('IPv4 Validation', () => {
  it('should validate correct IPv4 addresses', () => {
    expect(isValidIPv4('192.168.1.1')).toBe(true);
    expect(isValidIPv4('10.0.0.1')).toBe(true);
    expect(isValidIPv4('172.16.0.1')).toBe(true);
    expect(isValidIPv4('8.8.8.8')).toBe(true);
    expect(isValidIPv4('0.0.0.0')).toBe(true);
    expect(isValidIPv4('255.255.255.255')).toBe(true);
  });

  it('should reject invalid IPv4 addresses', () => {
    expect(isValidIPv4('256.1.1.1')).toBe(false);
    expect(isValidIPv4('1.1.1')).toBe(false);
    expect(isValidIPv4('1.1.1.1.1')).toBe(false);
    expect(isValidIPv4('abc.def.ghi.jkl')).toBe(false);
    expect(isValidIPv4('')).toBe(false);
    expect(isValidIPv4('192.168.1.1/24')).toBe(false);
  });
});

describe('IPv6 Validation', () => {
  it('should validate correct IPv6 addresses', () => {
    expect(isValidIPv6('2001:db8::1')).toBe(true);
    expect(isValidIPv6('2001:0db8:0000:0000:0000:0000:0000:0001')).toBe(true);
    expect(isValidIPv6('fe80::1')).toBe(true);
    expect(isValidIPv6('::')).toBe(true);
    expect(isValidIPv6('::1')).toBe(true);
    expect(isValidIPv6('fd00:1234:5678:abcd::1')).toBe(true);
  });

  it('should reject invalid IPv6 addresses', () => {
    expect(isValidIPv6('gggg::1')).toBe(false);
    expect(isValidIPv6('2001:db8')).toBe(false);
    expect(isValidIPv6('192.168.1.1')).toBe(false);
    expect(isValidIPv6('')).toBe(false);
  });
});

describe('IP Family Detection', () => {
  it('should detect IPv4 family', () => {
    expect(detectIPFamily('192.168.1.1')).toBe(IPFamily.IPv4);
    expect(detectIPFamily('10.0.0.1')).toBe(IPFamily.IPv4);
  });

  it('should detect IPv6 family', () => {
    expect(detectIPFamily('2001:db8::1')).toBe(IPFamily.IPv6);
    expect(detectIPFamily('fe80::1')).toBe(IPFamily.IPv6);
  });

  it('should return null for invalid IPs', () => {
    expect(detectIPFamily('invalid')).toBe(null);
    expect(detectIPFamily('')).toBe(null);
  });
});

describe('CIDR Validation', () => {
  it('should validate IPv4 CIDR notation', () => {
    expect(isValidIPv4CIDR('192.168.1.0/24')).toBe(true);
    expect(isValidIPv4CIDR('10.0.0.0/8')).toBe(true);
    expect(isValidIPv4CIDR('172.16.0.0/12')).toBe(true);
    expect(isValidIPv4CIDR('192.168.1.1/32')).toBe(true);
    expect(isValidIPv4CIDR('0.0.0.0/0')).toBe(true);
  });

  it('should reject invalid IPv4 CIDR notation', () => {
    expect(isValidIPv4CIDR('192.168.1.0/33')).toBe(false);
    expect(isValidIPv4CIDR('192.168.1.0/-1')).toBe(false);
    expect(isValidIPv4CIDR('192.168.1.0')).toBe(false);
    expect(isValidIPv4CIDR('192.168.1.0/24/8')).toBe(false);
  });

  it('should validate IPv6 CIDR notation', () => {
    expect(isValidIPv6CIDR('2001:db8::/32')).toBe(true);
    expect(isValidIPv6CIDR('fd00::/8')).toBe(true);
    expect(isValidIPv6CIDR('2001:db8::1/128')).toBe(true);
    expect(isValidIPv6CIDR('::/0')).toBe(true);
  });

  it('should reject invalid IPv6 CIDR notation', () => {
    expect(isValidIPv6CIDR('2001:db8::/129')).toBe(false);
    expect(isValidIPv6CIDR('2001:db8::/-1')).toBe(false);
    expect(isValidIPv6CIDR('2001:db8::')).toBe(false);
  });

  it('should validate mixed CIDR notation', () => {
    expect(isValidCIDR('192.168.1.0/24')).toBe(true);
    expect(isValidCIDR('2001:db8::/32')).toBe(true);
  });
});

describe('CIDR Parsing', () => {
  it('should parse IPv4 CIDR', () => {
    const result = parseCIDR('192.168.1.0/24');
    expect(result).toEqual({
      address: '192.168.1.0',
      cidr: 24,
      family: IPFamily.IPv4,
    });
  });

  it('should parse IPv6 CIDR', () => {
    const result = parseCIDR('2001:db8::/64');
    expect(result).toEqual({
      address: '2001:db8::',
      cidr: 64,
      family: IPFamily.IPv6,
    });
  });

  it('should return null for invalid CIDR', () => {
    expect(parseCIDR('invalid')).toBe(null);
    expect(parseCIDR('192.168.1.0')).toBe(null);
  });
});

describe('CIDR Formatting', () => {
  it('should format CIDR notation', () => {
    expect(formatCIDR('192.168.1.0', 24)).toBe('192.168.1.0/24');
    expect(formatCIDR('2001:db8::', 64)).toBe('2001:db8::/64');
  });
});

describe('IPv6 Compression', () => {
  it('should compress IPv6 addresses', () => {
    expect(compressIPv6('2001:0db8:0000:0000:0000:0000:0000:0001')).toBe('2001:db8::1');
    expect(compressIPv6('fe80:0000:0000:0000:0000:0000:0000:0001')).toBe('fe80::1');
  });

  it('should return original for invalid IPv6', () => {
    const invalid = 'invalid';
    expect(compressIPv6(invalid)).toBe(invalid);
  });
});

describe('IPv6 Expansion', () => {
  it('should expand IPv6 addresses', () => {
    expect(expandIPv6('2001:db8::1')).toBe('2001:0db8:0000:0000:0000:0000:0000:0001');
    expect(expandIPv6('fe80::1')).toBe('fe80:0000:0000:0000:0000:0000:0000:0001');
    expect(expandIPv6('::')).toBe('0000:0000:0000:0000:0000:0000:0000:0000');
  });

  it('should return original for invalid IPv6', () => {
    const invalid = 'invalid';
    expect(expandIPv6(invalid)).toBe(invalid);
  });
});

describe('IPv4 Network Calculations', () => {
  it('should calculate network address', () => {
    expect(getIPv4Network('192.168.1.100/24')).toBe('192.168.1.0');
    expect(getIPv4Network('10.1.2.3/8')).toBe('10.0.0.0');
    expect(getIPv4Network('172.16.50.100/12')).toBe('172.16.0.0');
  });

  it('should calculate broadcast address', () => {
    expect(getIPv4Broadcast('192.168.1.0/24')).toBe('192.168.1.255');
    expect(getIPv4Broadcast('10.0.0.0/8')).toBe('10.255.255.255');
    expect(getIPv4Broadcast('172.16.0.0/12')).toBe('172.31.255.255');
  });

  it('should calculate usable hosts', () => {
    expect(getIPv4UsableHosts(24)).toBe(254); // 256 - 2
    expect(getIPv4UsableHosts(30)).toBe(2); // 4 - 2
    expect(getIPv4UsableHosts(31)).toBe(0); // Point-to-point
    expect(getIPv4UsableHosts(32)).toBe(0); // Single host
    expect(getIPv4UsableHosts(8)).toBe(16777214); // 2^24 - 2
  });
});

describe('Private IP Detection', () => {
  it('should detect private IPv4 addresses', () => {
    expect(isPrivateIPv4('10.0.0.1')).toBe(true);
    expect(isPrivateIPv4('172.16.0.1')).toBe(true);
    expect(isPrivateIPv4('192.168.1.1')).toBe(true);
  });

  it('should reject public IPv4 addresses', () => {
    expect(isPrivateIPv4('8.8.8.8')).toBe(false);
    expect(isPrivateIPv4('1.1.1.1')).toBe(false);
    expect(isPrivateIPv4('172.15.0.1')).toBe(false); // Not in range
    expect(isPrivateIPv4('172.32.0.1')).toBe(false); // Not in range
  });

  it('should detect ULA IPv6 addresses', () => {
    expect(isULAIPv6('fc00::1')).toBe(true);
    expect(isULAIPv6('fd00:1234::1')).toBe(true);
  });

  it('should reject non-ULA IPv6 addresses', () => {
    expect(isULAIPv6('2001:db8::1')).toBe(false);
    expect(isULAIPv6('fe80::1')).toBe(false);
  });

  it('should detect link-local IPv6 addresses', () => {
    expect(isLinkLocalIPv6('fe80::1')).toBe(true);
    expect(isLinkLocalIPv6('fe80:1234::1')).toBe(true);
  });

  it('should reject non-link-local IPv6 addresses', () => {
    expect(isLinkLocalIPv6('2001:db8::1')).toBe(false);
    expect(isLinkLocalIPv6('fd00::1')).toBe(false);
  });
});

describe('CIDR Extraction', () => {
  it('should extract IP from CIDR', () => {
    expect(extractIPFromCIDR('192.168.1.0/24')).toBe('192.168.1.0');
    expect(extractIPFromCIDR('2001:db8::/64')).toBe('2001:db8::');
  });

  it('should extract prefix from CIDR', () => {
    expect(extractPrefixFromCIDR('192.168.1.0/24')).toBe(24);
    expect(extractPrefixFromCIDR('2001:db8::/64')).toBe(64);
    expect(extractPrefixFromCIDR('invalid')).toBe(null);
  });
});

describe('Subnet Mask Conversion', () => {
  it('should convert CIDR to subnet mask', () => {
    expect(cidrToSubnetMask(24)).toBe('255.255.255.0');
    expect(cidrToSubnetMask(16)).toBe('255.255.0.0');
    expect(cidrToSubnetMask(8)).toBe('255.0.0.0');
    expect(cidrToSubnetMask(30)).toBe('255.255.255.252');
  });

  it('should return null for invalid CIDR', () => {
    expect(cidrToSubnetMask(33)).toBe(null);
    expect(cidrToSubnetMask(-1)).toBe(null);
  });

  it('should convert subnet mask to CIDR', () => {
    expect(subnetMaskToCIDR('255.255.255.0')).toBe(24);
    expect(subnetMaskToCIDR('255.255.0.0')).toBe(16);
    expect(subnetMaskToCIDR('255.0.0.0')).toBe(8);
    expect(subnetMaskToCIDR('255.255.255.252')).toBe(30);
  });

  it('should return null for invalid subnet mask', () => {
    expect(subnetMaskToCIDR('255.255.255.1')).toBe(null); // Not contiguous
    expect(subnetMaskToCIDR('invalid')).toBe(null);
  });
});
