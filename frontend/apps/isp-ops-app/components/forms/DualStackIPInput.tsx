"use client";

/**
 * Dual-Stack IP Input Component
 *
 * Form input for configuring both IPv4 and IPv6 addresses
 */

import React from "react";
import { Label } from "@dotmac/ui";
import { IPAddressInput } from "./IPAddressInput";
import { IPCIDRInput } from "./IPCIDRInput";
import { cn } from "@/lib/utils";

export interface DualStackIPInputProps {
  ipv4Value: string;
  ipv6Value: string;
  onIPv4Change: (value: string) => void;
  onIPv6Change: (value: string) => void;
  onIPv4Blur?: () => void;
  onIPv6Blur?: () => void;
  label?: string;
  ipv4Error?: string;
  ipv6Error?: string;
  disabled?: boolean;
  requireAtLeastOne?: boolean;
  useCIDR?: boolean;
  className?: string;
  ipv4Label?: string;
  ipv6Label?: string;
  ipv4Placeholder?: string;
  ipv6Placeholder?: string;
  showInfo?: boolean;
}

export function DualStackIPInput({
  ipv4Value,
  ipv6Value,
  onIPv4Change,
  onIPv6Change,
  onIPv4Blur,
  onIPv6Blur,
  label = "IP Addresses",
  ipv4Error,
  ipv6Error,
  disabled = false,
  requireAtLeastOne = true,
  useCIDR = false,
  className,
  ipv4Label = "IPv4 Address",
  ipv6Label = "IPv6 Address",
  ipv4Placeholder,
  ipv6Placeholder,
  showInfo = true,
}: DualStackIPInputProps) {
  const hasNeitherValue = !ipv4Value && !ipv6Value;
  const showRequiredError = requireAtLeastOne && hasNeitherValue;

  const InputComponent = useCIDR ? IPCIDRInput : IPAddressInput;

  const defaultIPv4Placeholder = useCIDR ? "192.168.1.0/24" : "192.168.1.1";
  const defaultIPv6Placeholder = useCIDR ? "2001:db8::/64" : "2001:db8::1";

  return (
    <div className={cn("space-y-4", className)}>
      {label && (
        <div>
          <Label>
            {label}
            {requireAtLeastOne && <span className="text-red-500 ml-1">*</span>}
          </Label>
          {requireAtLeastOne && (
            <p className="text-xs text-muted-foreground mt-1">
              At least one IP address (IPv4 or IPv6) is required
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InputComponent
          label={ipv4Label}
          value={ipv4Value}
          onChange={onIPv4Change}
          {...(onIPv4Blur ? { onBlur: onIPv4Blur } : {})}
          placeholder={ipv4Placeholder || defaultIPv4Placeholder}
          {...(ipv4Error ? { error: ipv4Error } : {})}
          disabled={disabled}
          allowIPv4={true}
          allowIPv6={false}
          showInfo={showInfo}
          helpText="Optional - Leave empty for IPv6-only"
        />

        <InputComponent
          label={ipv6Label}
          value={ipv6Value}
          onChange={onIPv6Change}
          {...(onIPv6Blur ? { onBlur: onIPv6Blur } : {})}
          placeholder={ipv6Placeholder || defaultIPv6Placeholder}
          {...(ipv6Error ? { error: ipv6Error } : {})}
          disabled={disabled}
          allowIPv4={false}
          allowIPv6={true}
          showInfo={showInfo}
          helpText="Optional - Leave empty for IPv4-only"
        />
      </div>

      {showRequiredError && (
        <p className="text-sm text-red-500" role="alert">
          At least one IP address must be provided
        </p>
      )}
    </div>
  );
}
