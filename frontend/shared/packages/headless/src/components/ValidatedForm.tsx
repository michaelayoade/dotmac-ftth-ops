"use client";

import React, { useState } from "react";
import type { FormEvent, ReactNode } from "react";

/**
 * Form data structure for key-value pairs
 * @interface FormData
 */
interface FormData {
  [key: string]: any;
}

/**
 * Validation error messages mapped by field name
 * @interface ValidationErrors
 */
interface ValidationErrors {
  [key: string]: string;
}

/**
 * Current state of the form including data and validation status
 * @interface FormState
 */
interface FormState {
  /** Current form field values */
  data: FormData;
  /** Validation errors by field name */
  errors: ValidationErrors;
  /** Whether form is currently being submitted */
  isSubmitting: boolean;
  /** Whether all form validations pass */
  isValid: boolean;
}

/**
 * Props for the ValidatedForm component
 * @interface ValidatedFormProps
 */
interface ValidatedFormProps {
  /** Initial form data values */
  initialData?: FormData;
  /** Form submission handler */
  onSubmit: (data: FormData) => Promise<void> | void;
  /** Custom validation function */
  validate?: (data: FormData) => ValidationErrors;
  /** Render prop for form children */
  children: (props: ChildProps) => ReactNode;
  /** Optional CSS class name */
  className?: string;
}

/**
 * Props passed to the render function children
 * @interface ChildProps
 */
interface ChildProps {
  /** Current form data */
  data: FormData;
  /** Current validation errors */
  errors: ValidationErrors;
  /** Form submission state */
  isSubmitting: boolean;
  /** Form validation state */
  isValid: boolean;
  /** Handler for field value changes */
  handleChange: (name: string, value: any) => void;
  /** Handler for field blur events */
  handleBlur: (name: string) => void;
  /** Form submission handler */
  handleSubmit: (e?: FormEvent) => void;
}

/**
 * ValidatedForm Component
 *
 * A headless form component that provides form state management, validation,
 * and submission handling through render props pattern.
 *
 * @component
 * @example
 * ```tsx
 * <ValidatedForm
 *   initialData={{ email: '', password: '' }}
 *   validate={(data) => {
 *     const errors = {};
 *     if (!data.email) errors.email = 'Email is required';
 *     if (data.password.length < 8) errors.password = 'Password must be at least 8 characters';
 *     return errors;
 *   }}
 *   onSubmit={async (data) => {
 *     await api.login(data);
 *   }}
 * >
 *   {({ data, errors, handleChange, handleSubmit, isSubmitting }) => (
 *     <>
 *       <input
 *         value={data.email}
 *         onChange={(e) => handleChange('email', e.target.value)}
 *       />
 *       {errors.email && <span>{errors.email}</span>}
 *       <button onClick={handleSubmit} disabled={isSubmitting}>
 *         Submit
 *       </button>
 *     </>
 *   )}
 * </ValidatedForm>
 * ```
 *
 * @param {ValidatedFormProps} props - Component props
 * @returns {JSX.Element} Form element with render prop children
 */
export const ValidatedForm: React.FC<ValidatedFormProps> = ({
  initialData = {},
  onSubmit,
  validate,
  children,
  className,
}) => {
  const [formState, setFormState] = useState<FormState>({
    data: initialData,
    errors: {},
    isSubmitting: false,
    isValid: true,
  });

  const runValidation = (data: FormData) => {
    const errors = validate ? validate(data) : {};
    const isValid = Object.keys(errors).length === 0;
    return { errors, isValid };
  };

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();

    setFormState((prev) => ({ ...prev, isSubmitting: true }));
    const { errors, isValid } = runValidation(formState.data);

    setFormState((prev) => ({
      ...prev,
      errors,
      isValid,
    }));

    if (isValid) {
      await onSubmit(formState.data);
    }

    setFormState((prev) => ({ ...prev, isSubmitting: false }));
  };

  const handleChange = (name: string, value: any) => {
    setFormState((prev) => {
      const data = { ...prev.data, [name]: value };
      const { errors, isValid } = runValidation(data);
      return { ...prev, data, errors, isValid };
    });
  };

  const handleBlur = (_name: string) => {
    setFormState((prev) => {
      const { errors, isValid } = runValidation(prev.data);
      return { ...prev, errors, isValid };
    });
  };

  return (
    <form className={className} onSubmit={handleSubmit}>
      {children({ ...formState, handleChange, handleBlur, handleSubmit })}
    </form>
  );
};

// Validation message component
export interface ValidationMessageProps {
  error?: string;
  fieldId?: string;
  className?: string;
}

export function ValidationMessage({ error, fieldId, className = "" }: ValidationMessageProps) {
  if (!error) {
    return null;
  }

  return (
    <p
      id={fieldId ? `${fieldId}-error` : undefined}
      className={`mt-1 text-red-600 text-sm ${className}`}
      role="alert"
    >
      {error}
    </p>
  );
}

// Form field wrapper component
export interface FormFieldProps {
  label: string;
  fieldId: string;
  required?: boolean;
  error?: string;
  helpText?: string;
  children: ReactNode;
  className?: string;
}

export function FormField({
  label,
  fieldId,
  required = false,
  error,
  helpText,
  children,
  className = "",
}: FormFieldProps) {
  return (
    <div className={`space-y-1 ${className}`}>
      <label htmlFor={fieldId} className="block font-medium text-gray-700 text-sm">
        {label}
        {required && (
          <span className="ml-1 text-red-500" aria-label="required">
            *
          </span>
        )}
      </label>

      {children}

      {error && <ValidationMessage error={error} fieldId={fieldId} />}

      {helpText && !error && <p className="text-gray-500 text-sm">{helpText}</p>}
    </div>
  );
}

// Success message component
export interface SuccessMessageProps {
  message: string;
  onDismiss?: () => void;
  className?: string;
}

export function SuccessMessage({ message, onDismiss, className = "" }: SuccessMessageProps) {
  return (
    <div className={`rounded-md border border-green-200 bg-green-50 p-4 ${className}`}>
      <div className="flex">
        <div className="flex-shrink-0">
          <svg
            aria-hidden="true"
            className="h-5 w-5 text-green-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <title>Icon</title>
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3">
          <p className="font-medium text-green-800 text-sm">{message}</p>
        </div>
        {onDismiss && (
          <div className="ml-auto pl-3">
            <div className="-mx-1.5 -my-1.5">
              <button
                type="button"
                onClick={onDismiss}
                onKeyDown={(e) => e.key === "Enter" && onDismiss()}
                className="inline-flex rounded-md bg-green-50 p-1.5 text-green-500 hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2 focus:ring-offset-green-50"
              >
                <span className="sr-only">Dismiss</span>
                <svg aria-hidden="true" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                  <title>Icon</title>
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Error message component
export interface ErrorMessageProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function ErrorMessage({
  title = "Error",
  message,
  onRetry,
  onDismiss,
  className = "",
}: ErrorMessageProps) {
  return (
    <div className={`rounded-md border border-red-200 bg-red-50 p-4 ${className}`}>
      <div className="flex">
        <div className="flex-shrink-0">
          <svg
            aria-hidden="true"
            className="h-5 w-5 text-red-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <title>Icon</title>
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="font-medium text-red-800 text-sm">{title}</h3>
          <p className="mt-2 text-red-700 text-sm">{message}</p>
          {onRetry && (
            <div className="mt-4">
              <button
                type="button"
                onClick={onRetry}
                onKeyDown={(e) => e.key === "Enter" && onRetry()}
                className="rounded-md bg-red-100 px-2 py-1 font-medium text-red-800 text-sm hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
        {onDismiss && (
          <div className="ml-auto pl-3">
            <div className="-mx-1.5 -my-1.5">
              <button
                type="button"
                onClick={onDismiss}
                onKeyDown={(e) => e.key === "Enter" && onDismiss()}
                className="inline-flex rounded-md bg-red-50 p-1.5 text-red-500 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 focus:ring-offset-red-50"
              >
                <span className="sr-only">Dismiss</span>
                <svg aria-hidden="true" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                  <title>Icon</title>
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
