"use client";

/**
 * IP Address Display Component
 *
 * Displays IP addresses with formatting and family badges
 */

import React from "react";
import { Badge } from "@dotmac/ui";
import { Card } from "@dotmac/ui";
import {
  detectIPFamily,
  IPFamily,
  formatIPAddress,
  isPrivateIPv4,
  isULAIPv6,
  isLinkLocalIPv6,
} from "@/lib/utils/ip-address";
import { cn } from "@/lib/utils";

export interface IPAddressDisplayProps {
  ipv4?: string | null | undefined;
  ipv6?: string | null | undefined;
  className?: string;
  showBadges?: boolean | undefined;
  compress?: boolean | undefined;
  layout?: "inline" | "stacked" | "card" | undefined;
}

export function IPAddressDisplay({
  ipv4,
  ipv6,
  className,
  showBadges = true,
  compress = true,
  layout = "inline",
}: IPAddressDisplayProps) {
  const hasIPv4 = ipv4 && ipv4.trim() !== "";
  const hasIPv6 = ipv6 && ipv6.trim() !== "";

  if (!hasIPv4 && !hasIPv6) {
    return (
      <span className={cn("text-muted-foreground italic", className)}>
        No IP addresses configured
      </span>
    );
  }

  if (layout === "card") {
    return (
      <Card className={cn("p-3 space-y-2", className)}>
        {hasIPv4 && (
          <IPAddressSingle
            ip={ipv4}
            family={IPFamily.IPv4}
            showBadges={showBadges}
            compress={compress}
          />
        )}
        {hasIPv6 && (
          <IPAddressSingle
            ip={ipv6}
            family={IPFamily.IPv6}
            showBadges={showBadges}
            compress={compress}
          />
        )}
      </Card>
    );
  }

  if (layout === "stacked") {
    return (
      <div className={cn("space-y-1", className)}>
        {hasIPv4 && (
          <IPAddressSingle
            ip={ipv4}
            family={IPFamily.IPv4}
            showBadges={showBadges}
            compress={compress}
          />
        )}
        {hasIPv6 && (
          <IPAddressSingle
            ip={ipv6}
            family={IPFamily.IPv6}
            showBadges={showBadges}
            compress={compress}
          />
        )}
      </div>
    );
  }

  // Inline layout
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {hasIPv4 && (
        <IPAddressSingle
          ip={ipv4}
          family={IPFamily.IPv4}
          showBadges={showBadges}
          compress={compress}
        />
      )}
      {hasIPv4 && hasIPv6 && <span className="text-muted-foreground">|</span>}
      {hasIPv6 && (
        <IPAddressSingle
          ip={ipv6}
          family={IPFamily.IPv6}
          showBadges={showBadges}
          compress={compress}
        />
      )}
    </div>
  );
}

interface IPAddressSingleProps {
  ip: string;
  family: IPFamily;
  showBadges: boolean;
  compress: boolean;
}

function IPAddressSingle({ ip, family, showBadges, compress }: IPAddressSingleProps) {
  const formatted = formatIPAddress(ip, compress);

  const ipWithoutMask = ip.split("/")[0] ?? "";
  const isPrivate =
    family === IPFamily.IPv4
      ? isPrivateIPv4(ipWithoutMask)
      : isULAIPv6(ipWithoutMask) || isLinkLocalIPv6(ipWithoutMask);

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-sm">{formatted}</span>
      {showBadges && (
        <>
          <Badge variant={family === IPFamily.IPv4 ? "default" : "secondary"} className="text-xs">
            {family === IPFamily.IPv4 ? "IPv4" : "IPv6"}
          </Badge>
          {isPrivate && (
            <Badge variant="outline" className="text-xs">
              Private
            </Badge>
          )}
        </>
      )}
    </div>
  );
}

export interface DualStackBadgeProps {
  ipv4?: string | null;
  ipv6?: string | null;
  className?: string;
}

/**
 * Simple badge showing dual-stack status
 */
export function DualStackBadge({ ipv4, ipv6, className }: DualStackBadgeProps) {
  const hasIPv4 = ipv4 && ipv4.trim() !== "";
  const hasIPv6 = ipv6 && ipv6.trim() !== "";

  if (!hasIPv4 && !hasIPv6) {
    return (
      <Badge variant="destructive" className={className}>
        No IP
      </Badge>
    );
  }

  if (hasIPv4 && hasIPv6) {
    return (
      <Badge variant="default" className={className}>
        Dual-Stack
      </Badge>
    );
  }

  if (hasIPv4) {
    return (
      <Badge variant="secondary" className={className}>
        IPv4 Only
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className={className}>
      IPv6 Only
    </Badge>
  );
}
