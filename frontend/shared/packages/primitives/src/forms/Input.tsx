/**
 * Input Primitive Component
 *
 * Enhanced input component with comprehensive TypeScript support,
 * accessibility features, and security validation
 */
"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";
import { forwardRef, useState, useCallback, useId, useEffect } from "react";
import { Eye, EyeOff, AlertCircle, Check } from "lucide-react";

const inputVariants = cva(
  "flex w-full rounded-md border bg-background px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
  {
    variants: {
      variant: {
        default: "border-input focus-visible:ring-ring",
        error: "border-destructive text-destructive focus-visible:ring-destructive",
        success: "border-success text-success focus-visible:ring-success",
        warning: "border-warning text-warning focus-visible:ring-warning",
      },
      size: {
        sm: "h-8 px-2 text-xs",
        default: "h-9 px-3",
        lg: "h-10 px-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {
  /** Label for the input */
  label?: string;
  /** Helper text displayed below the input */
  helperText?: string;
  /** Error message to display */
  error?: string;
  /** Success message to display */
  success?: string;
  /** Warning message to display */
  warning?: string;
  /** Whether the input is in a loading state */
  isLoading?: boolean;
  /** Icon to display on the left */
  leftIcon?: React.ReactNode;
  /** Icon to display on the right */
  rightIcon?: React.ReactNode;
  /** Whether to show password toggle for password inputs */
  showPasswordToggle?: boolean;
  /** Custom validation function */
  validate?: (value: string) => string | null;
  /** Whether to validate on blur */
  validateOnBlur?: boolean;
  /** Whether to validate on change */
  validateOnChange?: boolean;
  /** Whether to sanitize input */
  sanitize?: boolean;
  /** Maximum character count */
  maxLength?: number;
  /** Whether to show character count */
  showCharCount?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      variant,
      size,
      type = "text",
      label,
      helperText,
      error,
      success,
      warning,
      isLoading,
      leftIcon,
      rightIcon,
      showPasswordToggle = false,
      validate,
      validateOnBlur = false,
      validateOnChange = false,
      sanitize = true,
      maxLength,
      showCharCount = false,
      disabled,
      value,
      onChange,
      onBlur,
      id,
      "aria-describedby": ariaDescribedBy,
      "aria-label": ariaLabel,
      role: roleAttr,
      tabIndex,
      ...props
    },
    ref,
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [charCount, setCharCount] = useState(0);

    const inputId = useId();
    const actualId = id || inputId;
    const helperTextId = `${actualId}-helper`;
    const errorId = `${actualId}-error`;

    // Determine current state
    const currentError = error || validationError;
    const currentVariant = currentError
      ? "error"
      : success
        ? "success"
        : warning
          ? "warning"
          : variant;

    // Input type handling
    const inputType = type === "password" && showPassword ? "text" : type;
    const shouldShowPasswordToggle = type === "password" && showPasswordToggle;

    // Sanitize input value
    const sanitizeValue = useCallback(
      (val: string) => {
        if (!sanitize) return val;

        // Basic XSS prevention
        return val
          .replace(/[<>]/g, "") // Remove angle brackets
          .replace(/javascript:/gi, "") // Remove javascript protocol
          .replace(/on\w+=/gi, ""); // Remove event handlers
      },
      [sanitize],
    );

    // Validation handler
    const performValidation = useCallback(
      (val: string) => {
        if (!validate) return null;

        try {
          return validate(val);
        } catch (err) {
          return "Validation error occurred";
        }
      },
      [validate],
    );

    // Change handler
    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        let newValue = e.target.value;

        // Apply sanitization
        newValue = sanitizeValue(newValue);

        // Update character count
        setCharCount(newValue.length);

        // Validate on change if enabled
        if (validateOnChange) {
          const validationResult = performValidation(newValue);
          setValidationError(validationResult);
        } else if (validationError) {
          // Clear validation error if user is typing
          setValidationError(null);
        }

        // Create synthetic event with sanitized value
        const syntheticEvent = {
          ...e,
          target: {
            ...e.target,
            value: newValue,
          },
        };

        onChange?.(syntheticEvent as React.ChangeEvent<HTMLInputElement>);
      },
      [sanitizeValue, validateOnChange, performValidation, validationError, onChange],
    );

    // Blur handler
    const handleBlur = useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        if (validateOnBlur) {
          const validationResult = performValidation(e.target.value);
          setValidationError(validationResult);
        }

        onBlur?.(e);
      },
      [validateOnBlur, performValidation, onBlur],
    );

    // Password toggle handler
    const togglePasswordVisibility = useCallback(() => {
      setShowPassword((prev) => !prev);
    }, []);

    // Build aria-describedby
    const describedBy =
      [ariaDescribedBy, helperText ? helperTextId : null, currentError ? errorId : null]
        .filter(Boolean)
        .join(" ") || undefined;

    // Character count display
    const showCharCountDisplay = showCharCount && maxLength;
    const isCharLimitExceeded = maxLength && charCount > maxLength;

    useEffect(() => {
      if (typeof value === "string") {
        setCharCount(value.length);
      } else if (typeof value === "number") {
        setCharCount(value.toString().length);
      } else if (value == null) {
        setCharCount(0);
      }
    }, [value]);

    return (
      <div className="space-y-1">
        {/* Label */}
        {label && (
          <label
            htmlFor={actualId}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {label}
            {props.required && (
              <span className="ml-1 text-destructive" aria-label="required">
                *
              </span>
            )}
          </label>
        )}

        {/* Input Container */}
        <div className="relative">
          {/* Left Icon */}
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
              {leftIcon}
            </div>
          )}

          {/* Input */}
          <input
            ref={ref}
            id={actualId}
            type={inputType}
            className={clsx(inputVariants({ variant: currentVariant, size, className }), {
              "pl-10": leftIcon,
              "pr-10": rightIcon || shouldShowPasswordToggle,
              "pr-20": rightIcon && shouldShowPasswordToggle,
            })}
            disabled={disabled || isLoading}
            value={value}
            onChange={handleChange}
            onBlur={handleBlur}
            maxLength={maxLength}
            aria-invalid={currentError ? "true" : "false"}
            aria-describedby={describedBy}
            aria-label={ariaLabel ?? (label ? undefined : "Input field")}
            role={roleAttr ?? (type === "password" ? "textbox" : undefined)}
            tabIndex={tabIndex ?? 0}
            {...props}
          />

          {/* Right Icons */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {/* Validation Status Icon */}
            {currentError && (
              <AlertCircle className="h-4 w-4 text-destructive" aria-hidden="true" />
            )}
            {success && !currentError && (
              <Check className="h-4 w-4 text-success" aria-hidden="true" />
            )}

            {/* Custom Right Icon */}
            {rightIcon && <div className="text-muted-foreground">{rightIcon}</div>}

            {/* Password Toggle */}
            {shouldShowPasswordToggle && (
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={disabled ? -1 : 0}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            )}
          </div>

          {/* Loading Overlay */}
          {isLoading && (
            <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-md">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          )}
        </div>

        {/* Character Count */}
        {showCharCountDisplay && (
          <div
            className={clsx(
              "text-xs text-right",
              isCharLimitExceeded ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {charCount}/{maxLength}
          </div>
        )}

        {/* Helper Text */}
        {helperText && !currentError && (
          <p id={helperTextId} className="text-xs text-muted-foreground">
            {helperText}
          </p>
        )}

        {/* Error Message */}
        {currentError && (
          <p id={errorId} className="text-xs text-destructive" role="alert">
            {currentError}
          </p>
        )}

        {/* Success Message */}
        {success && !currentError && <p className="text-xs text-success">{success}</p>}

        {/* Warning Message */}
        {warning && !currentError && !success && <p className="text-xs text-warning">{warning}</p>}
      </div>
    );
  },
);

Input.displayName = "Input";

export { inputVariants };
