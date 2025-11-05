"use client";

/**
 * IP Address Input Component
 *
 * Form input with validation for IPv4 and IPv6 addresses
 */

import React, { useState, useCallback } from "react";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { isValidIPv4, isValidIPv6, detectIPFamily, IPFamily } from "@/lib/utils/ip-address";
import { cn } from "@/lib/utils";

export interface IPAddressInputProps {
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
  showFamily?: boolean;
  helpText?: string;
}

export function IPAddressInput({
  value,
  onChange,
  onBlur,
  label,
  placeholder = "Enter IP address",
  error,
  disabled = false,
  required = false,
  allowIPv4 = true,
  allowIPv6 = true,
  className,
  showFamily = true,
  helpText,
}: IPAddressInputProps) {
  const [touched, setTouched] = useState(false);

  const family = detectIPFamily(value);
  const isValid = family !== null;

  const handleBlur = useCallback(() => {
    setTouched(true);
    onBlur?.();
  }, [onBlur]);

  const validationError = touched && value ? getValidationError() : null;

  function getValidationError(): string | null {
    if (!value) return null;

    if (!allowIPv4 && family === IPFamily.IPv4) {
      return "IPv4 addresses are not allowed";
    }

    if (!allowIPv6 && family === IPFamily.IPv6) {
      return "IPv6 addresses are not allowed";
    }

    if (!isValid) {
      if (allowIPv4 && allowIPv6) {
        return "Invalid IP address format";
      } else if (allowIPv4) {
        return "Invalid IPv4 address format";
      } else {
        return "Invalid IPv6 address format";
      }
    }

    return null;
  }

  const displayError = error || validationError;

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <div className="flex items-center justify-between">
          <Label htmlFor={label}>
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          {showFamily && value && isValid && (
            <Badge variant={family === IPFamily.IPv4 ? "default" : "secondary"}>
              {family === IPFamily.IPv4 ? "IPv4" : "IPv6"}
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

      {helpText && !displayError && <p className="text-sm text-muted-foreground">{helpText}</p>}

      {displayError && (
        <p id={`${label}-error`} className="text-sm text-red-500" role="alert">
          {displayError}
        </p>
      )}
    </div>
  );
}
