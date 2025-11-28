/**
 * React Hook Form Integration for IP Addresses
 *
 * Custom hooks for managing IP address forms with validation
 */

import { useCallback } from "react";
import { UseFormReturn, FieldValues, Path } from "react-hook-form";
import { z } from "zod";
import {
  ipv4Schema,
  ipv6Schema,
  ipv4CIDRSchema,
  ipv6CIDRSchema,
  dualStackIPSchema,
  dualStackCIDRSchema,
} from "@/lib/validations/ip-address";

/**
 * Hook for managing a single IP address field
 */
export function useIPAddressField<T extends FieldValues>(
  form: UseFormReturn<T>,
  fieldName: Path<T>,
  options: {
    allowIPv4?: boolean;
    allowIPv6?: boolean;
    useCIDR?: boolean;
  } = {},
) {
  const { allowIPv4 = true, allowIPv6 = true, useCIDR = false } = options;

  const value = form.watch(fieldName);
  const error = form.formState.errors[fieldName]?.message as string | undefined;

  const handleChange = useCallback(
    (newValue: string) => {
      form.setValue(fieldName, newValue as any, {
        shouldValidate: form.formState.isSubmitted,
        shouldDirty: true,
      });
    },
    [form, fieldName],
  );

  const handleBlur = useCallback(() => {
    form.trigger(fieldName);
  }, [form, fieldName]);

  // Get validation schema based on options
  const getSchema = useCallback(() => {
    if (useCIDR) {
      if (allowIPv4 && !allowIPv6) return ipv4CIDRSchema;
      if (allowIPv6 && !allowIPv4) return ipv6CIDRSchema;
      return z.union([ipv4CIDRSchema, ipv6CIDRSchema]);
    } else {
      if (allowIPv4 && !allowIPv6) return ipv4Schema;
      if (allowIPv6 && !allowIPv4) return ipv6Schema;
      return z.union([ipv4Schema, ipv6Schema]);
    }
  }, [allowIPv4, allowIPv6, useCIDR]);

  return {
    value: value as string,
    error,
    onChange: handleChange,
    onBlur: handleBlur,
    schema: getSchema(),
  };
}

/**
 * Hook for managing dual-stack IP address fields
 */
export function useDualStackIPFields<T extends FieldValues>(
  form: UseFormReturn<T>,
  ipv4FieldName: Path<T>,
  ipv6FieldName: Path<T>,
  options: {
    requireAtLeastOne?: boolean;
    useCIDR?: boolean;
  } = {},
) {
  const { requireAtLeastOne = true, useCIDR = false } = options;

  const ipv4Value = form.watch(ipv4FieldName);
  const ipv6Value = form.watch(ipv6FieldName);

  const ipv4Error = form.formState.errors[ipv4FieldName]?.message as string | undefined;
  const ipv6Error = form.formState.errors[ipv6FieldName]?.message as string | undefined;

  const handleIPv4Change = useCallback(
    (newValue: string) => {
      form.setValue(ipv4FieldName, newValue as any, {
        shouldValidate: form.formState.isSubmitted,
        shouldDirty: true,
      });

      // Trigger validation on both fields if requireAtLeastOne
      if (requireAtLeastOne && form.formState.isSubmitted) {
        form.trigger([ipv4FieldName, ipv6FieldName]);
      }
    },
    [form, ipv4FieldName, ipv6FieldName, requireAtLeastOne],
  );

  const handleIPv6Change = useCallback(
    (newValue: string) => {
      form.setValue(ipv6FieldName, newValue as any, {
        shouldValidate: form.formState.isSubmitted,
        shouldDirty: true,
      });

      // Trigger validation on both fields if requireAtLeastOne
      if (requireAtLeastOne && form.formState.isSubmitted) {
        form.trigger([ipv4FieldName, ipv6FieldName]);
      }
    },
    [form, ipv4FieldName, ipv6FieldName, requireAtLeastOne],
  );

  const handleIPv4Blur = useCallback(() => {
    form.trigger(ipv4FieldName);
  }, [form, ipv4FieldName]);

  const handleIPv6Blur = useCallback(() => {
    form.trigger(ipv6FieldName);
  }, [form, ipv6FieldName]);

  // Get validation schema
  const schema = useCIDR ? dualStackCIDRSchema : dualStackIPSchema;

  return {
    ipv4Value: ipv4Value as string,
    ipv6Value: ipv6Value as string,
    ipv4Error,
    ipv6Error,
    onIPv4Change: handleIPv4Change,
    onIPv6Change: handleIPv6Change,
    onIPv4Blur: handleIPv4Blur,
    onIPv6Blur: handleIPv6Blur,
    schema,
  };
}

/**
 * Custom validator for dual-stack requirement
 */
export function createDualStackValidator(requireAtLeastOne: boolean = true) {
  return (ipv4: string | null | undefined, ipv6: string | null | undefined) => {
    if (!requireAtLeastOne) return true;

    const hasIPv4 = ipv4 && ipv4.trim() !== "";
    const hasIPv6 = ipv6 && ipv6.trim() !== "";

    return hasIPv4 || hasIPv6;
  };
}

/**
 * Helper to create IP field registration for React Hook Form
 */
export function createIPFieldRegistration(
  allowIPv4: boolean = true,
  allowIPv6: boolean = true,
  required: boolean = false,
) {
  return {
    required: required ? "IP address is required" : false,
    validate: (value: string) => {
      if (!value && !required) return true;
      if (!value && required) return "IP address is required";

      // Use the appropriate schema for validation
      let schema;
      if (allowIPv4 && !allowIPv6) {
        schema = ipv4Schema;
      } else if (allowIPv6 && !allowIPv4) {
        schema = ipv6Schema;
      } else {
        schema = z.union([ipv4Schema, ipv6Schema]);
      }

      const result = schema.safeParse(value);
      return result.success || result.error?.issues[0]?.message || "Invalid IP address";
    },
  };
}
