/**
 * Secure form validation hook with XSS prevention and input sanitization
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { z } from "zod";

interface FormError {
  field: string;
  message: string;
  code: string;
}

interface UseSecureFormOptions<T> {
  schema: z.ZodSchema<T>;
  onSubmit: (data: T) => Promise<void> | void;
  initialValues?: Partial<T>;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  sanitizeHtml?: boolean;
  preventXSS?: boolean;
  enableCSRFProtection?: boolean;
}

interface UseSecureFormReturn<T> {
  values: Partial<T>;
  errors: FormError[];
  isValid: boolean;
  isSubmitting: boolean;
  isDirty: boolean;
  setValue: (field: keyof T, value: any) => void;
  setValues: (values: Partial<T>) => void;
  validateField: (field: keyof T) => Promise<boolean>;
  validateForm: () => Promise<boolean>;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  handleChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => void;
  handleBlur: (
    e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => void;
  reset: () => void;
  getFieldError: (field: keyof T) => string | undefined;
  hasFieldError: (field: keyof T) => boolean;
  csrfToken?: string;
}

// XSS Prevention utilities
const xssPatterns = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  /javascript:/gi,
  /vbscript:/gi,
  /onload\s*=/gi,
  /onerror\s*=/gi,
  /onclick\s*=/gi,
  /onmouseover\s*=/gi,
];

const sanitizeHtml = (input: string): string => {
  let sanitized = input;

  // Remove potentially dangerous patterns
  xssPatterns.forEach((pattern) => {
    sanitized = sanitized.replace(pattern, "");
  });

  // Escape remaining HTML entities
  return sanitized
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
};

const preventXSS = (input: any): any => {
  if (typeof input === "string") {
    // Remove or escape dangerous characters
    return input
      .replace(/[<>]/g, "") // Remove angle brackets
      .replace(/javascript:/gi, "") // Remove javascript: protocol
      .replace(/vbscript:/gi, "") // Remove vbscript: protocol
      .replace(/data:text\/html/gi, "") // Remove data URIs that could contain HTML
      .trim();
  }

  if (Array.isArray(input)) {
    return input.map(preventXSS);
  }

  if (typeof input === "object" && input !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = preventXSS(value);
    }
    return sanitized;
  }

  return input;
};

// Generate CSRF token
const generateCSRFToken = (): string => {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  // Fallback for environments without crypto.getRandomValues
  return Date.now().toString(36) + Math.random().toString(36);
};

export function useSecureForm<T extends Record<string, any>>({
  schema,
  onSubmit,
  initialValues = {},
  validateOnChange = false,
  validateOnBlur = true,
  sanitizeHtml: shouldSanitizeHtml = true,
  preventXSS: shouldPreventXSS = true,
  enableCSRFProtection = true,
}: UseSecureFormOptions<T>): UseSecureFormReturn<T> {
  const [values, setValuesState] = useState<Partial<T>>(initialValues);
  const [errors, setErrors] = useState<FormError[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [csrfToken] = useState<string>(() => (enableCSRFProtection ? generateCSRFToken() : ""));

  const initialValuesRef = useRef(initialValues);
  const formRef = useRef<HTMLFormElement>(null);

  // Security: Store CSRF token in session storage
  useEffect(() => {
    if (enableCSRFProtection && csrfToken) {
      sessionStorage.setItem("csrf-token", csrfToken);
    }

    return () => {
      if (enableCSRFProtection) {
        sessionStorage.removeItem("csrf-token");
      }
    };
  }, [csrfToken, enableCSRFProtection]);

  const sanitizeInput = useCallback(
    (value: any): any => {
      if (shouldPreventXSS) {
        value = preventXSS(value);
      }

      if (shouldSanitizeHtml && typeof value === "string") {
        value = sanitizeHtml(value);
      }

      return value;
    },
    [shouldPreventXSS, shouldSanitizeHtml],
  );

  const validateField = useCallback(
    async (field: keyof T): Promise<boolean> => {
      try {
        // Create a partial schema for the specific field
        const fieldValue = values[field];
        const fieldSchema = schema.pick({ [field]: true } as any);

        await fieldSchema.parseAsync({ [field]: fieldValue });

        // Remove any existing errors for this field
        setErrors((prev) => prev.filter((error) => error.field !== (field as string)));
        return true;
      } catch (error) {
        if (error instanceof z.ZodError) {
          const fieldErrors = error.errors.map((err) => ({
            field: err.path[0] as string,
            message: err.message,
            code: err.code,
          }));

          setErrors((prev) => [
            ...prev.filter((error) => error.field !== (field as string)),
            ...fieldErrors,
          ]);
        }
        return false;
      }
    },
    [values, schema],
  );

  const validateForm = useCallback(async (): Promise<boolean> => {
    try {
      await schema.parseAsync(values);
      setErrors([]);
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formErrors = error.errors.map((err) => ({
          field: err.path[0] as string,
          message: err.message,
          code: err.code,
        }));
        setErrors(formErrors);
      }
      return false;
    }
  }, [values, schema]);

  const setValue = useCallback(
    (field: keyof T, value: any) => {
      const sanitizedValue = sanitizeInput(value);

      setValuesState((prev) => ({
        ...prev,
        [field]: sanitizedValue,
      }));

      setIsDirty(true);

      if (validateOnChange) {
        validateField(field);
      }
    },
    [sanitizeInput, validateOnChange, validateField],
  );

  const setValues = useCallback(
    (newValues: Partial<T>) => {
      const sanitizedValues = sanitizeInput(newValues);
      setValuesState(sanitizedValues);
      setIsDirty(true);
    },
    [sanitizeInput],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value, type } = e.target;
      const finalValue = type === "checkbox" ? (e.target as HTMLInputElement).checked : value;

      setValue(name as keyof T, finalValue);
    },
    [setValue],
  );

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name } = e.target;

      if (validateOnBlur) {
        validateField(name as keyof T);
      }
    },
    [validateOnBlur, validateField],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Security check: Verify CSRF token if enabled
      if (enableCSRFProtection) {
        const storedToken = sessionStorage.getItem("csrf-token");
        if (storedToken !== csrfToken) {
          console.error("CSRF token mismatch");
          return;
        }
      }

      setIsSubmitting(true);

      try {
        const isValid = await validateForm();
        if (!isValid) {
          return;
        }

        // Final sanitization before submission
        const sanitizedValues = sanitizeInput(values);
        await onSubmit(sanitizedValues as T);
      } catch (error) {
        console.error("Form submission error:", error);
        // Could add error handling here
      } finally {
        setIsSubmitting(false);
      }
    },
    [values, onSubmit, validateForm, sanitizeInput, enableCSRFProtection, csrfToken],
  );

  const reset = useCallback(() => {
    setValuesState(initialValuesRef.current);
    setErrors([]);
    setIsDirty(false);
    setIsSubmitting(false);
  }, []);

  const getFieldError = useCallback(
    (field: keyof T): string | undefined => {
      return errors.find((error) => error.field === (field as string))?.message;
    },
    [errors],
  );

  const hasFieldError = useCallback(
    (field: keyof T): boolean => {
      return errors.some((error) => error.field === (field as string));
    },
    [errors],
  );

  const isValid = errors.length === 0;

  return {
    values,
    errors,
    isValid,
    isSubmitting,
    isDirty,
    setValue,
    setValues,
    validateField,
    validateForm,
    handleSubmit,
    handleChange,
    handleBlur,
    reset,
    getFieldError,
    hasFieldError,
    csrfToken: enableCSRFProtection ? csrfToken : undefined,
  };
}
