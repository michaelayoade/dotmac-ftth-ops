/**
 * IP Address List Component
 *
 * Wrapper that connects the shared IPAddressList to app-specific utilities.
 */

"use client";

import { IPAddressList as SharedIPAddressList, IPFamily } from "@dotmac/features/ipam";
import type { IPAddressListProps as SharedIPAddressListProps } from "@dotmac/features/ipam";
import { detectIPFamily, formatIPAddress } from "@/lib/utils/ip-address";
import { DualStackBadge } from "@/components/forms/IPAddressDisplay";
import type { IPAddress } from "@/types/netbox";

export interface IPAddressListProps
  extends Omit<SharedIPAddressListProps, "ipUtilities" | "DualStackBadge" | "addresses"> {
  addresses: IPAddress[];
}

export function IPAddressList(props: IPAddressListProps) {
  const ipUtilities = {
    detectIPFamily: (ip: string) => {
      const family = detectIPFamily(ip) ?? IPFamily.IPv4;
      const normalized = family.toString().toLowerCase();
      return normalized === "ipv6" ? IPFamily.IPv6 : IPFamily.IPv4;
    },
    formatIPAddress,
  };

  return (
    <SharedIPAddressList {...props} ipUtilities={ipUtilities} DualStackBadge={DualStackBadge} />
  );
}
