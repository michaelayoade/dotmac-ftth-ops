/**
 * Validation patterns and utilities
 */

// Common validation patterns
export const validationPatterns = {
  email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  phone: /^\+?[1-9]\d{1,14}$/,
  url: /^https?:\/\/.+/,
  ipv4: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
  ipv6: /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/,
  mac: /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/,
  creditCard: /^\d{13,19}$/,
  ssn: /^\d{3}-?\d{2}-?\d{4}$/,
  zipCode: /^\d{5}(-\d{4})?$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
} as const;

// Validation functions
export const validate = {
  required: (value: any) => {
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return value != null;
  },

  minLength: (value: string, length: number) => value.length >= length,
  maxLength: (value: string, length: number) => value.length <= length,

  min: (value: number, min: number) => value >= min,
  max: (value: number, max: number) => value <= max,

  pattern: (value: string, pattern: RegExp) => pattern.test(value),

  email: (value: string) => validationPatterns.email.test(value),
  phone: (value: string) => validationPatterns.phone.test(value),
  url: (value: string) => validationPatterns.url.test(value),

  oneOf: (value: any, options: any[]) => options.includes(value),

  custom: (value: any, validator: (value: any) => boolean) => validator(value),
} as const;

// Validation rule builder
export function createValidationRules() {
  return {
    required: (message = "This field is required") => ({
      validate: validate.required,
      message,
    }),

    minLength: (length: number, message = `Minimum length is ${length}`) => ({
      validate: (value: string) => validate.minLength(value, length),
      message,
    }),

    maxLength: (length: number, message = `Maximum length is ${length}`) => ({
      validate: (value: string) => validate.maxLength(value, length),
      message,
    }),

    pattern: (pattern: RegExp, message = "Invalid format") => ({
      validate: (value: string) => validate.pattern(value, pattern),
      message,
    }),

    email: (message = "Invalid email address") => ({
      validate: validate.email,
      message,
    }),

    phone: (message = "Invalid phone number") => ({
      validate: validate.phone,
      message,
    }),

    url: (message = "Invalid URL") => ({
      validate: validate.url,
      message,
    }),
  };
}

export type ValidationRule = ReturnType<
  ReturnType<typeof createValidationRules>[keyof ReturnType<typeof createValidationRules>]
>;
