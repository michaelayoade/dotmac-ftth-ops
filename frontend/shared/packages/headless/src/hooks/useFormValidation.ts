import { useCallback, useEffect, useRef, useState } from "react";

import {
  createDebouncedValidator,
  type FormValidationConfig,
  FormValidator,
  type ValidationError,
  type ValidationResult,
} from "../utils/formValidation";

export interface UseFormValidationOptions {
  validationConfig: FormValidationConfig;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  debounceTime?: number;
  onValidationComplete?: (result: ValidationResult) => void;
}

export interface UseFormValidationResult {
  formData: Record<string, unknown>;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isValid: boolean;
  isValidating: boolean;
  setValue: (field: string, value: unknown) => void;
  setValues: (values: Record<string, unknown>) => void;
  setError: (field: string, error: string) => void;
  clearError: (field: string) => void;
  clearAllErrors: () => void;
  validateField: (field: string) => Promise<void>;
  validateForm: () => Promise<ValidationResult>;
  resetForm: (initialValues?: Record<string, unknown>) => void;
  setTouched: (field: string, isTouched?: boolean) => void;
  getFieldProps: (field: string) => FieldProps;
  handleSubmit: (
    onSubmit: (data: Record<string, unknown>) => void | Promise<void>,
  ) => (e?: React.FormEvent) => Promise<void>;
}

export interface FieldProps {
  value: unknown;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => void;
  onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  error?: string;
  required?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

export function useFormValidation(
  initialValues: Record<string, unknown>,
  options: UseFormValidationOptions,
): UseFormValidationResult {
  const {
    validationConfig,
    validateOnChange = true,
    validateOnBlur = true,
    debounceTime = 300,
    onValidationComplete,
  } = options;

  const [formData, setFormData] = useState<Record<string, unknown>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouchedState] = useState<Record<string, boolean>>({});
  const [isValidating, setIsValidating] = useState(false);

  const validatorRef = useRef(new FormValidator(validationConfig));
  const debouncedValidatorRef = useRef(
    createDebouncedValidator(validatorRef.current, debounceTime),
  );

  // Update validator when config changes
  useEffect(() => {
    validatorRef.current = new FormValidator(validationConfig);
    debouncedValidatorRef.current = createDebouncedValidator(validatorRef.current, debounceTime);
  }, [validationConfig, debounceTime]);

  const setValue = useCallback(
    (field: string, value: unknown) => {
      setFormData((prev) => ({ ...prev, [field]: value }));

      if (validateOnChange && touched[field]) {
        debouncedValidatorRef.current?.(field, value, (fieldErrors) => {
          if (fieldErrors.length > 0) {
            const firstError = fieldErrors[0];
            if (firstError) {
              setErrors((prev) => ({ ...prev, [field]: firstError.message }));
            }
          } else {
            setErrors((prev) => {
              const newErrors = { ...prev };
              delete newErrors[field];
              return newErrors;
            });
          }
        });
      }
    },
    [validateOnChange, touched],
  );

  const setValues = useCallback((values: Record<string, unknown>) => {
    setFormData((prev) => ({ ...prev, ...values }));
  }, []);

  const setError = useCallback((field: string, error: string) => {
    setErrors((prev) => ({ ...prev, [field]: error }));
  }, []);

  const clearError = useCallback((field: string) => {
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  }, []);

  const clearAllErrors = useCallback(() => {
    setErrors({});
  }, []);

  const setTouched = useCallback((field: string, isTouched: boolean = true) => {
    setTouchedState((prev) => ({ ...prev, [field]: isTouched }));
  }, []);

  const validateField = useCallback(
    async (field: string): Promise<void> => {
      const value = formData[field];
      const fieldErrors = validatorRef.current.validateField(field, value);

      if (fieldErrors.length > 0) {
        const firstError = fieldErrors[0];
        if (firstError) {
          setErrors((prev) => ({ ...prev, [field]: firstError.message }));
        }
      } else {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        });
      }
    },
    [formData],
  );

  const validateForm = useCallback(async (): Promise<ValidationResult> => {
    setIsValidating(true);

    try {
      const result = await validatorRef.current.validateFormAsync(formData);
      setErrors(result.fieldErrors);

      if (onValidationComplete) {
        onValidationComplete(result);
      }

      return result;
    } finally {
      setIsValidating(false);
    }
  }, [formData, onValidationComplete]);

  const resetForm = useCallback(
    (newInitialValues?: Record<string, unknown>) => {
      const resetValues = newInitialValues || initialValues;
      setFormData(resetValues);
      setErrors({});
      setTouchedState({});
    },
    [initialValues],
  );

  const getFieldProps = useCallback(
    (field: string): FieldProps => {
      const isRequired = validatorRef.current.isFieldRequired(field);
      const hasError = !!errors[field];

      const fieldProps: FieldProps = {
        value: formData[field] ?? "",
        onChange: (event) => {
          const target = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
          const nextValue =
            target instanceof HTMLInputElement && target.type === "checkbox"
              ? target.checked
              : target.value;
          setValue(field, nextValue);
        },
        onBlur: () => {
          setTouched(field, true);
          if (validateOnBlur) {
            void validateField(field);
          }
        },
        required: isRequired,
        "aria-invalid": hasError,
      };

      if (errors[field]) {
        fieldProps.error = errors[field];
        fieldProps["aria-describedby"] = `${field}-error`;
      }

      return fieldProps;
    },
    [formData, errors, setValue, setTouched, validateField, validateOnBlur],
  );

  const handleSubmit = useCallback(
    (onSubmit: (data: Record<string, unknown>) => void | Promise<void>) =>
      async (e?: React.FormEvent) => {
        if (e) {
          e.preventDefault();
        }

        // Mark all fields as touched
        const allTouched = Object.keys(validationConfig).reduce(
          (acc, field) => ({ ...acc, [field]: true }),
          {} as Record<string, boolean>,
        );
        setTouchedState(allTouched);

        const validationResult = await validateForm();

        if (validationResult.isValid) {
          await onSubmit(formData);
        }
      },
    [formData, validationConfig, validateForm],
  );

  const isValid = Object.keys(errors).length === 0;

  return {
    formData,
    errors,
    touched,
    isValid,
    isValidating,
    setValue,
    setValues,
    setError,
    clearError,
    clearAllErrors,
    validateField,
    validateForm,
    resetForm,
    setTouched,
    getFieldProps,
    handleSubmit,
  };
}

// Hook for handling form submission states
export interface UseFormSubmissionOptions {
  onSuccess?: (data: unknown) => void;
  onError?: (error: unknown) => void;
  resetOnSuccess?: boolean;
}

export interface UseFormSubmissionResult {
  isSubmitting: boolean;
  submitError: string | null;
  submitSuccess: boolean;
  submit: (submitFn: () => Promise<unknown>) => Promise<void>;
  reset: () => void;
}

export function useFormSubmission(options: UseFormSubmissionOptions = {}): UseFormSubmissionResult {
  const { onSuccess, onError, resetOnSuccess = false } = options;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const submit = useCallback(
    async (submitFn: () => Promise<unknown>) => {
      setIsSubmitting(true);
      setSubmitError(null);
      setSubmitSuccess(false);

      try {
        const result = await submitFn();
        setSubmitSuccess(true);

        if (onSuccess) {
          onSuccess(result);
        }

        if (resetOnSuccess) {
          // Reset will be handled by the calling component
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "An error occurred during submission";
        setSubmitError(errorMessage);

        if (onError) {
          onError(error);
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [onSuccess, onError, resetOnSuccess],
  );

  const reset = useCallback(() => {
    setSubmitError(null);
    setSubmitSuccess(false);
    setIsSubmitting(false);
  }, []);

  return {
    isSubmitting,
    submitError,
    submitSuccess,
    submit,
    reset,
  };
}

// Hook for handling async validation (e.g., checking if email exists)
export interface UseAsyncValidationOptions {
  validator: (value: unknown) => Promise<ValidationError[]>;
  debounceTime?: number;
  dependencies?: unknown[];
}

export function useAsyncValidation(
  field: string,
  value: unknown,
  options: UseAsyncValidationOptions,
) {
  const { validator, debounceTime = 500, dependencies = [] } = options;

  const [isValidating, setIsValidating] = useState(false);
  const [errors, setErrors] = useState<ValidationError[]>([]);

  const validateAsync = useCallback(async () => {
    if (!value) {
      setErrors([]);
      return;
    }

    setIsValidating(true);

    try {
      const validationErrors = await validator(value);
      setErrors(validationErrors);
    } catch (_error) {
      setErrors([
        {
          field,
          message: "Validation failed",
        },
      ]);
    } finally {
      setIsValidating(false);
    }
  }, [value, validator, field]);

  useEffect(() => {
    const timeoutId = setTimeout(validateAsync, debounceTime);
    return () => clearTimeout(timeoutId);
  }, [validateAsync, debounceTime, ...dependencies]);

  return {
    isValidating,
    errors,
    hasErrors: errors.length > 0,
  };
}
