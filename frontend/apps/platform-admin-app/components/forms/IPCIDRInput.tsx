"use client";

/**
 * IP CIDR Input Component
 *
 * Form input with validation for CIDR notation (e.g., 192.168.1.0/24)
 */

import React, { useState, useCallback, useMemo } from "react";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import {
  parseCIDR,
  IPFamily,
  getIPv4UsableHosts,
  getIPv4Network,
  getIPv4Broadcast,
} from "@/lib/utils/ip-address";
import { cn } from "@/lib/utils";

export interface IPCIDRInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  allowIPv4?: boolean;
  allowIPv6?: boolean;
  className?: string;
  showInfo?: boolean;
  helpText?: string;
}

export function IPCIDRInput({
  value,
  onChange,
  onBlur,
  label,
  placeholder = "Enter CIDR notation (e.g., 192.168.1.0/24)",
  error,
  disabled = false,
  required = false,
  allowIPv4 = true,
  allowIPv6 = true,
  className,
  showInfo = true,
  helpText,
}: IPCIDRInputProps) {
  const [touched, setTouched] = useState(false);

  const parsed = useMemo(() => parseCIDR(value), [value]);
  const isValid = parsed !== null;

  const handleBlur = useCallback(() => {
    setTouched(true);
    onBlur?.();
  }, [onBlur]);

  const validationError = touched && value ? getValidationError() : null;

  function getValidationError(): string | null {
    if (!value) return null;

    if (!allowIPv4 && parsed?.family === IPFamily.IPv4) {
      return "IPv4 CIDR is not allowed";
    }

    if (!allowIPv6 && parsed?.family === IPFamily.IPv6) {
      return "IPv6 CIDR is not allowed";
    }

    if (!isValid) {
      if (allowIPv4 && allowIPv6) {
        return "Invalid CIDR notation format";
      } else if (allowIPv4) {
        return "Invalid IPv4 CIDR format (e.g., 192.168.1.0/24)";
      } else {
        return "Invalid IPv6 CIDR format (e.g., 2001:db8::/64)";
      }
    }

    return null;
  }

  const displayError = error || validationError;

  // Calculate network info for IPv4
  const networkInfo = useMemo(() => {
    if (!parsed || parsed.family !== IPFamily.IPv4 || !showInfo) return null;

    const network = getIPv4Network(value);
    const broadcast = getIPv4Broadcast(value);
    const usableHosts = getIPv4UsableHosts(parsed.cidr);

    return { network, broadcast, usableHosts };
  }, [value, parsed, showInfo]);

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <div className="flex items-center justify-between">
          <Label htmlFor={label}>
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          {isValid && parsed && (
            <Badge variant={parsed.family === IPFamily.IPv4 ? "default" : "secondary"}>
              {parsed.family === IPFamily.IPv4 ? "IPv4" : "IPv6"} /{parsed.cidr}
            </Badge>
          )}
        </div>
      )}

      <Input
        id={label}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(displayError && "border-red-500 focus-visible:ring-red-500")}
        aria-invalid={!!displayError}
        aria-describedby={displayError ? `${label}-error` : undefined}
      />

      {helpText && !displayError && !networkInfo && (
        <p className="text-sm text-muted-foreground">{helpText}</p>
      )}

      {networkInfo && !displayError && (
        <div className="text-xs text-muted-foreground space-y-1 bg-muted p-2 rounded-md">
          <div className="flex justify-between">
            <span className="font-medium">Network:</span>
            <span className="font-mono">{networkInfo.network}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium">Broadcast:</span>
            <span className="font-mono">{networkInfo.broadcast}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium">Usable Hosts:</span>
            <span className="font-mono">{networkInfo.usableHosts.toLocaleString()}</span>
          </div>
        </div>
      )}

      {displayError && (
        <p id={`${label}-error`} className="text-sm text-red-500" role="alert">
          {displayError}
        </p>
      )}
    </div>
  );
}
