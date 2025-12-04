/**
 * VOLTHA Input Validation Utilities
 *
 * Validation functions for VOLTHA ONU provisioning and configuration
 */

import { ONUProvisionRequest } from "@/types/voltha";
import { VLAN_CONFIG, VALIDATION, PON_PORT_CONFIG } from "@/lib/constants/voltha";

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Validate ONU serial number format
 */
export function validateSerialNumber(serialNumber: string): ValidationError | null {
  if (!serialNumber || serialNumber.trim().length === 0) {
    return {
      field: "serial_number",
      message: "Serial number is required",
    };
  }

  const trimmed = serialNumber.trim();

  if (trimmed.length < VALIDATION.MIN_SERIAL_LENGTH) {
    return {
      field: "serial_number",
      message: `Serial number must be at least ${VALIDATION.MIN_SERIAL_LENGTH} characters`,
    };
  }

  if (trimmed.length > VALIDATION.MAX_SERIAL_LENGTH) {
    return {
      field: "serial_number",
      message: `Serial number must not exceed ${VALIDATION.MAX_SERIAL_LENGTH} characters`,
    };
  }

  if (!VALIDATION.SERIAL_PATTERN.test(trimmed)) {
    return {
      field: "serial_number",
      message: "Serial number must contain only uppercase letters and numbers",
    };
  }

  return null;
}

/**
 * Validate OLT device ID
 */
export function validateOLTDeviceId(oltDeviceId: string): ValidationError | null {
  if (!oltDeviceId || oltDeviceId.trim().length === 0) {
    return {
      field: "olt_device_id",
      message: "OLT device ID is required",
    };
  }

  return null;
}

/**
 * Validate PON port number
 */
export function validatePONPort(ponPort: number): ValidationError | null {
  if (ponPort === undefined || ponPort === null) {
    return {
      field: "pon_port",
      message: "PON port number is required",
    };
  }

  if (!Number.isInteger(ponPort)) {
    return {
      field: "pon_port",
      message: "PON port must be a whole number",
    };
  }

  if (ponPort < PON_PORT_CONFIG.MIN_PORT) {
    return {
      field: "pon_port",
      message: `PON port must be at least ${PON_PORT_CONFIG.MIN_PORT}`,
    };
  }

  if (ponPort > PON_PORT_CONFIG.MAX_PORT) {
    return {
      field: "pon_port",
      message: `PON port must not exceed ${PON_PORT_CONFIG.MAX_PORT} (typical maximum)`,
    };
  }

  return null;
}

/**
 * Validate VLAN ID (optional)
 */
export function validateVLAN(vlan: number | undefined): ValidationError | null {
  // VLAN is optional
  if (vlan === undefined || vlan === null) {
    return null;
  }

  if (!Number.isInteger(vlan)) {
    return {
      field: "vlan",
      message: "VLAN must be a whole number",
    };
  }

  if (vlan < VLAN_CONFIG.MIN_VLAN || vlan > VLAN_CONFIG.MAX_VLAN) {
    return {
      field: "vlan",
      message: `VLAN must be between ${VLAN_CONFIG.MIN_VLAN} and ${VLAN_CONFIG.MAX_VLAN}`,
    };
  }

  return null;
}

/**
 * Validate subscriber ID (optional)
 */
export function validateSubscriberId(subscriberId: string | undefined): ValidationError | null {
  // Subscriber ID is optional
  if (!subscriberId || subscriberId.trim().length === 0) {
    return null;
  }

  // Basic validation - adjust based on your business rules
  if (subscriberId.length > 64) {
    return {
      field: "subscriber_id",
      message: "Subscriber ID must not exceed 64 characters",
    };
  }

  return null;
}

/**
 * Validate bandwidth profile (optional)
 */
export function validateBandwidthProfile(profile: string | undefined): ValidationError | null {
  // Bandwidth profile is optional
  if (!profile || profile.trim().length === 0) {
    return null;
  }

  if (profile.length > 64) {
    return {
      field: "bandwidth_profile",
      message: "Bandwidth profile must not exceed 64 characters",
    };
  }

  return null;
}

/**
 * Validate line profile ID (optional)
 */
export function validateLineProfileId(profileId: string | undefined): ValidationError | null {
  // Line profile ID is optional
  if (!profileId || profileId.trim().length === 0) {
    return null;
  }

  if (profileId.length > 64) {
    return {
      field: "line_profile_id",
      message: "Line profile ID must not exceed 64 characters",
    };
  }

  return null;
}

/**
 * Validate service profile ID (optional)
 */
export function validateServiceProfileId(profileId: string | undefined): ValidationError | null {
  // Service profile ID is optional
  if (!profileId || profileId.trim().length === 0) {
    return null;
  }

  if (profileId.length > 64) {
    return {
      field: "service_profile_id",
      message: "Service profile ID must not exceed 64 characters",
    };
  }

  return null;
}

/**
 * Comprehensive validation for ONU provision request
 */
export function validateProvisionForm(form: ONUProvisionRequest): ValidationResult {
  const errors: ValidationError[] = [];

  // Required fields
  const serialError = validateSerialNumber(form.serial_number);
  if (serialError) errors.push(serialError);

  const oltError = validateOLTDeviceId(form.olt_device_id);
  if (oltError) errors.push(oltError);

  const ponPortError = validatePONPort(form.pon_port);
  if (ponPortError) errors.push(ponPortError);

  // Optional fields
  const vlanError = validateVLAN(form.vlan);
  if (vlanError) errors.push(vlanError);

  const subscriberError = validateSubscriberId(form.subscriber_id);
  if (subscriberError) errors.push(subscriberError);

  const bandwidthError = validateBandwidthProfile(form.bandwidth_profile);
  if (bandwidthError) errors.push(bandwidthError);

  const lineProfileError = validateLineProfileId(form.line_profile_id);
  if (lineProfileError) errors.push(lineProfileError);

  const serviceProfileError = validateServiceProfileId(form.service_profile_id);
  if (serviceProfileError) errors.push(serviceProfileError);

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Get first validation error message
 */
export function getFirstError(result: ValidationResult): string | null {
  return result.errors.length > 0 ? (result.errors[0]?.message ?? null) : null;
}

/**
 * Get all validation error messages as a formatted string
 */
export function getAllErrors(result: ValidationResult): string {
  return result.errors.map((error) => `${error.field}: ${error.message}`).join("; ");
}

/**
 * Sanitize serial number (uppercase, remove whitespace)
 */
export function sanitizeSerialNumber(serialNumber: string): string {
  return serialNumber.trim().toUpperCase();
}

/**
 * Sanitize string field (trim whitespace, handle empty)
 */
export function sanitizeStringField(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
