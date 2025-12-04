/**
 * Input validation utilities for form data and user input
 * Provides sanitization and validation functions for security
 */

import { sanitizeText, sanitizeEmail, sanitizeHTML, escapeHTML } from "./sanitization";

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedValue?: any;
}

export interface ValidationOptions {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  sanitize?: boolean;
  allowHTML?: boolean;
}

/**
 * Main input sanitization function - the missing function that was causing build errors
 */
export function sanitizeInput(
  input: unknown,
  type: "text" | "email" | "phone" | "url" | "html" | "alphanumeric" = "text",
  options: { maxLength?: number; allowHTML?: boolean } = {},
): string {
  if (input === null || input === undefined) {
    return "";
  }

  const stringValue = String(input).trim();

  if (!stringValue) {
    return "";
  }

  const { maxLength = 1000, allowHTML = false } = options;

  switch (type) {
    case "email":
      const emailResult = sanitizeEmail(stringValue);
      return emailResult || "";

    case "phone":
      // Remove all non-digit characters except + and -
      return stringValue.replace(/[^\d+\-\s()]/g, "").substring(0, maxLength);

    case "url":
      // Basic URL sanitization - remove dangerous protocols
      const urlCleaned = stringValue.replace(/^(javascript|data|vbscript):/i, "");
      return urlCleaned.substring(0, maxLength);

    case "html":
      if (allowHTML) {
        return sanitizeHTML(stringValue, { maxLength });
      }
      return sanitizeText(stringValue, maxLength);

    case "alphanumeric":
      // Allow only alphanumeric characters, spaces, and common punctuation
      return stringValue.replace(/[^a-zA-Z0-9\s\-_.,!?]/g, "").substring(0, maxLength);

    case "text":
    default:
      return sanitizeText(stringValue, maxLength);
  }
}

/**
 * Validate and sanitize form input
 */
export function validateInput(
  value: unknown,
  type: string,
  options: ValidationOptions = {},
): ValidationResult {
  const {
    required = false,
    minLength,
    maxLength,
    pattern,
    sanitize = true,
    allowHTML = false,
  } = options;

  // Convert to string and basic cleanup
  const stringValue = value === null || value === undefined ? "" : String(value).trim();

  // Required field validation
  if (required && !stringValue) {
    return {
      isValid: false,
      error: "This field is required",
    };
  }

  // If not required and empty, return valid
  if (!required && !stringValue) {
    return {
      isValid: true,
      sanitizedValue: "",
    };
  }

  // Sanitize if requested
  const processedValue = sanitize
    ? sanitizeInput(stringValue, type as any, { maxLength, allowHTML })
    : stringValue;

  // Length validation
  if (minLength && processedValue.length < minLength) {
    return {
      isValid: false,
      error: `Must be at least ${minLength} characters long`,
    };
  }

  if (maxLength && processedValue.length > maxLength) {
    return {
      isValid: false,
      error: `Must be no more than ${maxLength} characters long`,
    };
  }

  // Pattern validation
  if (pattern && !pattern.test(processedValue)) {
    return {
      isValid: false,
      error: "Invalid format",
    };
  }

  // Type-specific validation
  switch (type) {
    case "email":
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(processedValue)) {
        return {
          isValid: false,
          error: "Please enter a valid email address",
        };
      }
      break;

    case "phone":
      const phoneRegex = /^[\+]?[1-9]?[\d\s\-\(\)]{7,15}$/;
      if (!phoneRegex.test(processedValue)) {
        return {
          isValid: false,
          error: "Please enter a valid phone number",
        };
      }
      break;

    case "url":
      try {
        new URL(processedValue);
      } catch {
        return {
          isValid: false,
          error: "Please enter a valid URL",
        };
      }
      break;

    case "password":
      if (processedValue.length < 8) {
        return {
          isValid: false,
          error: "Password must be at least 8 characters long",
        };
      }
      if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(processedValue)) {
        return {
          isValid: false,
          error: "Password must contain uppercase, lowercase, and numeric characters",
        };
      }
      break;
  }

  return {
    isValid: true,
    sanitizedValue: processedValue,
  };
}

/**
 * Validate form data object
 */
export function validateFormData(
  data: Record<string, unknown>,
  schema: Record<string, ValidationOptions & { type: string }>,
): {
  isValid: boolean;
  errors: Record<string, string>;
  sanitizedData: Record<string, any>;
} {
  const errors: Record<string, string> = {};
  const sanitizedData: Record<string, any> = {};

  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];
    const result = validateInput(value, rules.type, rules);

    if (!result.isValid) {
      errors[field] = result.error || "Invalid value";
    } else {
      sanitizedData[field] = result.sanitizedValue;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitizedData,
  };
}

/**
 * Rate limiting helper
 */
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: any) => string;
  store?: "memory" | "redis";
  redisUrl?: string;
}

/**
 * Create rate limiter instance
 */
export function createRateLimit(config: RateLimitConfig) {
  const attempts = new Map<string, { count: number; resetTime: number }>();

  return {
    async checkLimit(key: string): Promise<{
      allowed: boolean;
      remainingRequests: number;
      resetTime: number;
    }> {
      const now = Date.now();
      const windowStart = now - config.windowMs;

      // Clean old entries
      for (const [k, v] of attempts.entries()) {
        if (v.resetTime < now) {
          attempts.delete(k);
        }
      }

      const current = attempts.get(key) || {
        count: 0,
        resetTime: now + config.windowMs,
      };

      if (current.count >= config.maxRequests && current.resetTime > now) {
        return {
          allowed: false,
          remainingRequests: 0,
          resetTime: current.resetTime,
        };
      }

      if (current.resetTime <= now) {
        current.count = 1;
        current.resetTime = now + config.windowMs;
      } else {
        current.count++;
      }

      attempts.set(key, current);

      return {
        allowed: true,
        remainingRequests: Math.max(0, config.maxRequests - current.count),
        resetTime: current.resetTime,
      };
    },

    async clearLimit(key: string): Promise<void> {
      attempts.delete(key);
    },
  };
}

// Export commonly used validation patterns
export const VALIDATION_PATTERNS = {
  email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  phone: /^[\+]?[1-9]?[\d\s\-\(\)]{7,15}$/,
  password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/,
  alphanumeric: /^[a-zA-Z0-9]+$/,
  url: /^https?:\/\/(?:[-\w.])+(?::[0-9]+)?(?:\/(?:[\w/_.])*(?:\?(?:[\w&%=.]*))?(?:#(?:\w*))?)?$/,
};

/**
 * DEPRECATED: Plugin validation has been moved to use existing validation systems
 * This section remains for backward compatibility but should use @dotmac/primitives
 *
 * @deprecated Use validationPatterns and validate from '@dotmac/primitives'
 */

// Re-export placeholder for backward compatibility
export const PLUGIN_PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^\+?[\d\s-()]+$/,
  url: /^https?:\/\/[^\s]+$/,
};

// Legacy schemas - consider migrating to existing validation system
export const COMMON_SCHEMAS = {
  login: {
    email: { type: "email", required: true, maxLength: 255 },
    password: {
      type: "password",
      required: true,
      minLength: 8,
      maxLength: 128,
    },
  },

  registration: {
    email: { type: "email", required: true, maxLength: 255 },
    password: {
      type: "password",
      required: true,
      minLength: 8,
      maxLength: 128,
    },
    name: { type: "text", required: true, minLength: 2, maxLength: 100 },
    phone: { type: "phone", required: false, maxLength: 20 },
  },

  profile: {
    name: { type: "text", required: true, minLength: 2, maxLength: 100 },
    phone: { type: "phone", required: false, maxLength: 20 },
    address: { type: "text", required: false, maxLength: 500 },
  },
};
