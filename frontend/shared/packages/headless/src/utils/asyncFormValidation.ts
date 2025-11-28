/**
 * Async Form Validation
 *
 * Extends the basic form validation with async validation support
 * for server-side validation, uniqueness checks, etc.
 */

import { ValidationError, ValidationResult, FieldValidationConfig } from "./formValidation";
import { parseBackendError, type StandardErrorResponse } from "../types/error-contract";

export interface AsyncValidationRule {
  validate: (value: unknown, formData?: Record<string, unknown>) => Promise<boolean>;
  message: string | ((value: unknown) => string);
  debounce?: number; // Debounce delay in ms
}

export interface AsyncFieldValidationConfig extends FieldValidationConfig {
  asyncRules?: AsyncValidationRule[];
}

export interface AsyncFormValidationConfig {
  [fieldName: string]: AsyncFieldValidationConfig;
}

export interface AsyncValidationCache {
  [cacheKey: string]: {
    result: boolean;
    timestamp: number;
  };
}

/**
 * Async Form Validator with server-side validation support
 */
export class AsyncFormValidator {
  private cache: AsyncValidationCache = {};
  private readonly cacheDuration = 60000; // 1 minute
  private pendingValidations: Map<string, Promise<boolean>> = new Map();

  /**
   * Validate a single field asynchronously
   */
  async validateField(
    fieldName: string,
    value: unknown,
    config: AsyncFieldValidationConfig,
    formData?: Record<string, unknown>,
  ): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    // Check required
    if (config.required && !value) {
      errors.push({
        field: fieldName,
        message: `${fieldName} is required`,
      });
      return errors; // Don't run other validations if empty and required
    }

    // Run synchronous rules first
    if (config.rules) {
      for (const rule of config.rules) {
        if (!rule.validate(value)) {
          errors.push({
            field: fieldName,
            message: rule.message,
          });
        }
      }
    }

    // Return early if sync validation failed
    if (errors.length > 0) {
      return errors;
    }

    // Run async rules
    if (config.asyncRules) {
      for (const rule of config.asyncRules) {
        const isValid = await this.runAsyncRule(fieldName, value, rule, formData);
        if (!isValid) {
          const message = typeof rule.message === "function" ? rule.message(value) : rule.message;
          errors.push({
            field: fieldName,
            message,
          });
        }
      }
    }

    return errors;
  }

  /**
   * Validate entire form asynchronously
   */
  async validateForm(
    formData: Record<string, unknown>,
    config: AsyncFormValidationConfig,
  ): Promise<ValidationResult> {
    const allErrors: ValidationError[] = [];
    const fieldErrors: Record<string, string> = {};

    // Validate all fields in parallel for better performance
    const validationPromises = Object.entries(config).map(async ([fieldName, fieldConfig]) => {
      const value = formData[fieldName];
      const errors = await this.validateField(fieldName, value, fieldConfig, formData);
      return { fieldName, errors };
    });

    const results = await Promise.all(validationPromises);

    // Collect errors
    for (const { fieldName, errors } of results) {
      if (errors.length > 0) {
        allErrors.push(...errors);
        fieldErrors[fieldName] = errors[0].message; // First error only
      }
    }

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      fieldErrors,
    };
  }

  /**
   * Run async validation rule with caching and deduplication
   */
  private async runAsyncRule(
    fieldName: string,
    value: unknown,
    rule: AsyncValidationRule,
    formData?: Record<string, unknown>,
  ): Promise<boolean> {
    const cacheKey = this.getCacheKey(fieldName, value, rule);

    // Check cache
    const cached = this.cache[cacheKey];
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      return cached.result;
    }

    // Check for pending validation of same field/value
    const pendingKey = `${fieldName}:${value}`;
    const pending = this.pendingValidations.get(pendingKey);
    if (pending) {
      return pending; // Reuse in-flight validation
    }

    // Run validation
    const validationPromise = rule.validate(value, formData);
    this.pendingValidations.set(pendingKey, validationPromise);

    try {
      const result = await validationPromise;

      // Cache result
      this.cache[cacheKey] = {
        result,
        timestamp: Date.now(),
      };

      return result;
    } finally {
      this.pendingValidations.delete(pendingKey);
    }
  }

  /**
   * Generate cache key for validation result
   */
  private getCacheKey(fieldName: string, value: unknown, rule: AsyncValidationRule): string {
    return `${fieldName}:${JSON.stringify(value)}:${rule.message}`;
  }

  /**
   * Clear validation cache
   */
  clearCache(): void {
    this.cache = {};
  }

  /**
   * Clear cache for specific field
   */
  clearFieldCache(fieldName: string): void {
    Object.keys(this.cache).forEach((key) => {
      if (key.startsWith(fieldName + ":")) {
        delete this.cache[key];
      }
    });
  }
}

/**
 * Built-in async validation rules
 */
export const asyncValidationRules = {
  /**
   * Check if email is unique (not already registered)
   */
  uniqueEmail: (apiClient: any): AsyncValidationRule => ({
    validate: async (value: unknown) => {
      if (typeof value !== "string") return false;

      try {
        const response = await apiClient.get(
          `/api/isp/v1/admin/auth/check-email?email=${encodeURIComponent(value)}`,
        );
        return !response.data.exists; // Returns true if email is available
      } catch (error) {
        console.error("Email uniqueness check failed:", error);
        return true; // Allow on error (fail open for better UX)
      }
    },
    message: "This email is already registered",
    debounce: 500,
  }),

  /**
   * Check if username is unique
   */
  uniqueUsername: (apiClient: any): AsyncValidationRule => ({
    validate: async (value: unknown) => {
      if (typeof value !== "string") return false;

      try {
        const response = await apiClient.get(
          `/api/isp/v1/admin/auth/check-username?username=${encodeURIComponent(value)}`,
        );
        return !response.data.exists;
      } catch (error) {
        console.error("Username uniqueness check failed:", error);
        return true;
      }
    },
    message: "This username is already taken",
    debounce: 500,
  }),

  /**
   * Validate address using geocoding API
   */
  validAddress: (apiClient: any): AsyncValidationRule => ({
    validate: async (value: unknown) => {
      if (typeof value !== "string" || value.length < 5) return false;

      try {
        const response = await apiClient.post("/api/isp/v1/admin/geocoding/validate", {
          address: value,
        });
        return response.data.valid;
      } catch (error) {
        console.error("Address validation failed:", error);
        return true; // Fail open
      }
    },
    message: "Please enter a valid address",
    debounce: 800,
  }),

  /**
   * Check if phone number is valid and properly formatted
   */
  validPhoneNumber: (apiClient: any): AsyncValidationRule => ({
    validate: async (value: unknown) => {
      if (typeof value !== "string") return false;

      try {
        const response = await apiClient.post("/api/isp/v1/admin/validation/phone", {
          phone: value,
        });
        return response.data.valid;
      } catch (error) {
        console.error("Phone validation failed:", error);
        return true;
      }
    },
    message: "Please enter a valid phone number",
    debounce: 500,
  }),

  /**
   * Validate credit card number using Luhn algorithm (client-side + server verification)
   */
  validCreditCard: (apiClient: any): AsyncValidationRule => ({
    validate: async (value: unknown) => {
      if (typeof value !== "string") return false;

      // Client-side Luhn check first
      const cleaned = value.replace(/\s/g, "");
      if (!/^\d+$/.test(cleaned)) return false;

      // Luhn algorithm
      let sum = 0;
      let isEven = false;
      for (let i = cleaned.length - 1; i >= 0; i--) {
        let digit = parseInt(cleaned[i], 10);
        if (isEven) {
          digit *= 2;
          if (digit > 9) digit -= 9;
        }
        sum += digit;
        isEven = !isEven;
      }

      if (sum % 10 !== 0) return false;

      // Server-side verification (BIN check, etc.)
      try {
        const response = await apiClient.post("/api/isp/v1/admin/payment/validate-card", {
          card_number: cleaned,
        });
        return response.data.valid;
      } catch (error) {
        console.error("Card validation failed:", error);
        return true; // Fail open (Luhn passed)
      }
    },
    message: "Please enter a valid credit card number",
    debounce: 1000,
  }),

  /**
   * Check if subdomain is available
   */
  availableSubdomain: (apiClient: any): AsyncValidationRule => ({
    validate: async (value: unknown) => {
      if (typeof value !== "string") return false;

      try {
        const response = await apiClient.get(
          `/api/platform/v1/admin/tenants/check-subdomain?subdomain=${encodeURIComponent(value)}`,
        );
        return response.data.available;
      } catch (error) {
        console.error("Subdomain check failed:", error);
        return true;
      }
    },
    message: (value) => `The subdomain "${value}" is not available`,
    debounce: 600,
  }),

  /**
   * Validate IBAN (International Bank Account Number)
   */
  validIBAN: (apiClient: any): AsyncValidationRule => ({
    validate: async (value: unknown) => {
      if (typeof value !== "string") return false;

      try {
        const response = await apiClient.post("/api/isp/v1/admin/validation/iban", {
          iban: value,
        });
        return response.data.valid;
      } catch (error) {
        console.error("IBAN validation failed:", error);
        return true;
      }
    },
    message: "Please enter a valid IBAN",
    debounce: 500,
  }),

  /**
   * Check password against Have I Been Pwned API
   */
  securePassword: (): AsyncValidationRule => ({
    validate: async (value: unknown) => {
      if (typeof value !== "string") return false;

      // Hash password using SHA-1
      const encoder = new TextEncoder();
      const data = encoder.encode(value);
      const hashBuffer = await crypto.subtle.digest("SHA-1", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase();

      // Use k-anonymity model (only send first 5 chars)
      const prefix = hashHex.substring(0, 5);
      const suffix = hashHex.substring(5);

      try {
        const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
        const text = await response.text();

        // Check if our suffix is in the response
        const hashes = text.split("\n");
        for (const hash of hashes) {
          const [hashSuffix] = hash.split(":");
          if (hashSuffix === suffix) {
            return false; // Password found in breach database
          }
        }

        return true; // Password not found
      } catch (error) {
        console.error("Password breach check failed:", error);
        return true; // Fail open
      }
    },
    message: "This password has been compromised in a data breach. Please choose a different one.",
    debounce: 1000,
  }),
};

/**
 * Map backend validation errors to form field errors
 */
export function mapBackendValidationErrors(
  backendError: StandardErrorResponse,
): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  // Check if error has field details
  if (backendError.details && typeof backendError.details === "object") {
    // Handle Pydantic validation errors
    if ("fields" in backendError.details) {
      const fields = backendError.details.fields as Record<string, string>;
      Object.entries(fields).forEach(([field, message]) => {
        fieldErrors[field] = message;
      });
    }

    // Handle generic field errors
    Object.entries(backendError.details).forEach(([key, value]) => {
      if (typeof value === "string" && !fieldErrors[key]) {
        fieldErrors[key] = value;
      }
    });
  }

  return fieldErrors;
}

/**
 * Create debounced async validation function
 */
export function createDebouncedAsyncValidator(
  validator: AsyncFormValidator,
  fieldName: string,
  config: AsyncFieldValidationConfig,
  delay: number = 300,
): (value: unknown, formData?: Record<string, unknown>) => Promise<ValidationError[]> {
  let timeoutId: NodeJS.Timeout | null = null;
  let pendingPromise: Promise<ValidationError[]> | null = null;

  return (value: unknown, formData?: Record<string, unknown>): Promise<ValidationError[]> => {
    // Clear existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Return existing promise if validation is already in progress
    if (pendingPromise) {
      return pendingPromise;
    }

    // Create new promise
    pendingPromise = new Promise((resolve) => {
      timeoutId = setTimeout(async () => {
        const errors = await validator.validateField(fieldName, value, config, formData);
        pendingPromise = null;
        resolve(errors);
      }, delay);
    });

    return pendingPromise;
  };
}

// Singleton instance
let globalValidator: AsyncFormValidator | null = null;

/**
 * Get global async form validator instance
 */
export function getAsyncValidator(): AsyncFormValidator {
  if (globalValidator === null) {
    globalValidator = new AsyncFormValidator();
  }
  return globalValidator;
}

/**
 * Reset global async form validator
 */
export function resetAsyncValidator(): void {
  globalValidator = null;
}
