export interface ValidationRule {
  validate: (value: unknown) => boolean;
  message: string;
}

export interface FieldValidationConfig {
  required?: boolean;
  rules?: ValidationRule[];
  dependsOn?: string[];
}

export interface FormValidationConfig {
  [fieldName: string]: FieldValidationConfig;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  fieldErrors: Record<string, string>;
}

// Built-in validation rules
export const validationRules = {
  email: {
    validate: (value: unknown) => {
      if (typeof value !== "string") return false;
      const emailRegex = /^[^\s@]+@[^\s@]+.[^\s@]+$/;
      return emailRegex.test(value);
    },
    message: "Please enter a valid email address",
  },

  minLength: (length: number) => ({
    validate: (value: unknown) => typeof value === "string" && value.length >= length,
    message: `Must be at least ${length} characters long`,
  }),

  maxLength: (length: number) => ({
    validate: (value: unknown) => typeof value === "string" && value.length <= length,
    message: `Must be no more than ${length} characters long`,
  }),

  strongPassword: {
    validate: (value: unknown) => {
      if (typeof value !== "string") return false;
      // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special char
      const strongPasswordRegex =
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
      return strongPasswordRegex.test(value);
    },
    message:
      "Password must contain at least 8 characters with uppercase, lowercase, number, and special character",
  },

  phoneNumber: {
    validate: (value: unknown) => {
      if (typeof value !== "string") return false;
      const phoneRegex = /^\+?[\d\s\-()]{10,}$/;
      return phoneRegex.test(value);
    },
    message: "Please enter a valid phone number",
  },

  url: {
    validate: (value: unknown) => {
      if (typeof value !== "string") return false;
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    },
    message: "Please enter a valid URL",
  },

  numeric: {
    validate: (value: unknown) =>
      typeof value === "string" && !Number.isNaN(Number(value)) && !Number.isNaN(parseFloat(value)),
    message: "Must be a valid number",
  },

  positiveNumber: {
    validate: (value: unknown) => {
      if (typeof value !== "string") return false;
      const num = parseFloat(value);
      return !Number.isNaN(num) && num > 0;
    },
    message: "Must be a positive number",
  },

  integer: {
    validate: (value: unknown) => {
      if (typeof value !== "string") return false;
      const num = parseInt(value, 10);
      return !Number.isNaN(num) && num.toString() === value;
    },
    message: "Must be a whole number",
  },

  alphanumeric: {
    validate: (value: unknown) => typeof value === "string" && /^[a-zA-Z0-9]+$/.test(value),
    message: "Must contain only letters and numbers",
  },

  noWhitespace: {
    validate: (value: unknown) => typeof value === "string" && !/\s/.test(value),
    message: "Must not contain spaces",
  },

  matchField: (fieldName: string, getFieldValue: (name: string) => any) => ({
    validate: (value: unknown) => value === getFieldValue(fieldName),
    message: `Must match ${fieldName}`,
  }),
};

export class FormValidator {
  private config: FormValidationConfig;

  constructor(config: FormValidationConfig) {
    this.config = config;
    this.formData = {
      // Implementation pending
    };
  }

  setFormData(data: Record<string, unknown>) {
    this.formData = data;
  }

  validateField(fieldName: string, value: unknown): ValidationError[] {
    const fieldConfig = this.config[fieldName];
    if (!fieldConfig) {
      return [];
    }

    const errors: ValidationError[] = [];

    // Check required
    if (fieldConfig.required && this.isEmpty(value)) {
      errors.push({
        field: fieldName,
        message: "This field is required",
      });
      return errors; // Don't run other validations if required and empty
    }

    // Skip other validations if field is empty but not required
    if (!fieldConfig.required && this.isEmpty(value)) {
      return errors;
    }

    // Run custom validation rules
    if (fieldConfig.rules) {
      for (const rule of fieldConfig.rules) {
        if (!rule.validate(value)) {
          errors.push({
            field: fieldName,
            message: rule.message,
          });
        }
      }
    }

    return errors;
  }

  validateForm(formData: Record<string, unknown>): ValidationResult {
    this.setFormData(formData);
    const allErrors: ValidationError[] = [];
    const fieldErrors: Record<string, string> = {
      // Implementation pending
    };

    // Validate each configured field
    for (const fieldName in this.config) {
      const fieldValue = formData[fieldName];
      const errors = this.validateField(fieldName, fieldValue);

      if (errors.length > 0) {
        allErrors.push(...errors);
        fieldErrors[fieldName] = errors[0]?.message || "Validation error"; // Show first error for each field
      }
    }

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      fieldErrors,
    };
  }

  validateFormAsync(formData: Record<string, unknown>): Promise<ValidationResult> {
    // For future async validation support (e.g., server-side checks)
    return Promise.resolve(this.validateForm(formData));
  }

  private isEmpty(value: unknown): boolean {
    if (value === null || value === undefined) {
      return true;
    }
    if (typeof value === "string") {
      return value.trim() === "";
    }
    if (Array.isArray(value)) {
      return value.length === 0;
    }
    if (typeof value === "object") {
      return Object.keys(value).length === 0;
    }
    return false;
  }

  // Utility method to get validation config for a specific field
  getFieldConfig(fieldName: string): FieldValidationConfig | undefined {
    return this.config[fieldName];
  }

  // Check if a field is required
  isFieldRequired(fieldName: string): boolean {
    return this.config[fieldName]?.required ?? false;
  }
}

// Debounced validation for real-time validation
export function createDebouncedValidator(validator: FormValidator, delay: number = 300) {
  let timeoutId: NodeJS.Timeout;

  return (fieldName: string, value: unknown, callback: (errors: ValidationError[]) => void) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      const errors = validator.validateField(fieldName, value);
      callback(errors);
    }, delay);
  };
}

// Pre-configured validators for common forms
export const commonValidators = {
  loginForm: new FormValidator({
    email: {
      required: true,
      rules: [validationRules.email],
    },
    password: {
      required: true,
      rules: [validationRules.minLength(1)], // Basic requirement for login
    },
  }),

  registrationForm: new FormValidator({
    firstName: {
      required: true,
      rules: [validationRules.minLength(2), validationRules.maxLength(50)],
    },
    lastName: {
      required: true,
      rules: [validationRules.minLength(2), validationRules.maxLength(50)],
    },
    email: {
      required: true,
      rules: [validationRules.email],
    },
    password: {
      required: true,
      rules: [validationRules.strongPassword],
    },
    confirmPassword: {
      required: true,
      rules: [
        {
          validate: (_value: unknown) => {
            // This would need access to the form data context
            return true; // Implement in component
          },
          message: "Passwords must match",
        },
      ],
    },
  }),

  profileForm: new FormValidator({
    firstName: {
      required: true,
      rules: [validationRules.minLength(2), validationRules.maxLength(50)],
    },
    lastName: {
      required: true,
      rules: [validationRules.minLength(2), validationRules.maxLength(50)],
    },
    email: {
      required: true,
      rules: [validationRules.email],
    },
    phone: {
      required: false,
      rules: [validationRules.phoneNumber],
    },
    website: {
      required: false,
      rules: [validationRules.url],
    },
  }),

  passwordChangeForm: new FormValidator({
    currentPassword: {
      required: true,
      rules: [validationRules.minLength(1)],
    },
    newPassword: {
      required: true,
      rules: [validationRules.strongPassword],
    },
    confirmNewPassword: {
      required: true,
      rules: [
        {
          validate: (_value: unknown) => true, // Implement in component
          message: "Passwords must match",
        },
      ],
    },
  }),
};

// Utility function to create validation messages
export function formatValidationMessage(
  fieldName: string,
  message: string,
  customFieldNames?: Record<string, string>,
): string {
  const displayName =
    customFieldNames?.[fieldName] ||
    fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/([A-Z])/g, " $1");

  return message.replace(/this field/i, displayName.toLowerCase());
}
