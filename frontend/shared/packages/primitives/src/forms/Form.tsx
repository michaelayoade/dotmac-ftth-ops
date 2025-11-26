/**
 * Unstyled, composable Form primitives with React Hook Form integration
 *
 * This module provides accessible, headless form components that integrate seamlessly
 * with React Hook Form for validation and state management. All components follow
 * WAI-ARIA guidelines and support keyboard navigation.
 *
 * @example
 * ```tsx
 * const form = useForm<FormData>();
 *
 * <Form form={form} onSubmit={handleSubmit}>
 *   <FormField name="email">
 *     {({ value, onChange, error, invalid }) => (
 *       <FormItem>
 *         <FormLabel required>Email Address</FormLabel>
 *         <Input
 *           value={value}
 *           onChange={onChange}
 *           state={invalid ? 'error' : 'default'}
 *         />
 *         {error && <FormMessage>{error}</FormMessage>}
 *       </FormItem>
 *     )}
 *   </FormField>
 * </Form>
 * ```
 */

import * as React from "react";
const { createContext, useContext, forwardRef } = React;

import * as LabelPrimitive from "@radix-ui/react-label";
import { Slot } from "@radix-ui/react-slot";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import { clsx } from "clsx";
import {
  Controller,
  type FieldValues,
  type RegisterOptions,
  type UseFormReturn,
} from "react-hook-form";

import type { ValidationRule } from "../types";
// useId is already destructured from React above

// Form variants
const formVariants = cva("", {
  variants: {
    layout: {
      vertical: "",
      horizontal: "",
      inline: "",
    },
    size: {
      sm: "",
      md: "",
      lg: "",
    },
  },
  defaultVariants: {
    layout: "vertical",
    size: "md",
  },
});

// Input variants
const inputBaseClass =
  "form-input flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

const inputVariants = cva(inputBaseClass, {
  variants: {
    variant: {
      default: "variant-default",
      outlined: "variant-outlined outlined border-2 border-primary/60",
      filled: "variant-filled filled bg-muted",
      underlined:
        "variant-underlined underlined border-0 border-b border-input focus-visible:ring-0",
    },
    size: {
      sm: "size-sm sm h-8 text-xs",
      md: "size-md md h-10 text-sm",
      lg: "size-lg lg h-12 text-base",
    },
    state: {
      default: "state-default",
      error: "state-error error border-destructive text-destructive",
      success: "state-success success border-success text-success",
      warning: "state-warning warning border-warning text-warning",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "md",
    state: "default",
  },
});

// Form Context
interface FormContextValue {
  form: UseFormReturn<FieldValues>;
}

const FormContext = createContext<FormContextValue | null>(null);

interface FormFieldContextValue {
  name: string;
  error: string;
  invalid: boolean;
}

const FormFieldContext = createContext<FormFieldContextValue | null>(null);

interface FormItemContextValue {
  id: string;
}

const FormItemContext = createContext<FormItemContextValue | null>(null);

export const useFormContext = () => {
  const context = useContext(FormContext);
  if (!context) {
    throw new Error("Form components must be used within a Form");
  }
  return context;
};

const useFormFieldState = () => {
  const fieldContext = useContext(FormFieldContext);
  const itemContext = useContext(FormItemContext);

  if (!fieldContext || !itemContext) {
    return null;
  }

  return {
    ...fieldContext,
    formItemId: itemContext.id,
    formDescriptionId: `${itemContext.id}-description`,
    formMessageId: `${itemContext.id}-message`,
    inputId: `${itemContext.id}-control`,
  };
};

/**
 * Form Provider component that manages form state and validation
 *
 * Wraps children with form context and handles form submission. Uses React Hook Form
 * for state management and validation. Supports different layouts and sizes.
 *
 * @param form - React Hook Form instance created with useForm()
 * @param onSubmit - Function called when form is submitted with valid data
 * @param layout - Visual layout of the form: 'vertical' | 'horizontal' | 'inline'
 * @param size - Size variant: 'sm' | 'md' | 'lg'
 * @param asChild - Merge props into child element instead of rendering a form
 * @param children - Form fields and content
 *
 * @example
 * ```tsx
 * const form = useForm<LoginData>();
 *
 * return (
 *   <Form
 *     form={form}
 *     layout="vertical"
 *     size="md"
 *     onSubmit={(data) => console.log('Submitted:', data)}
 *   >
 *     <FormField name="username">
 *       Field content here
 *     </FormField>
 *   </Form>
 * );
 * ```
 */
export interface FormProps<TFieldValues extends FieldValues = FieldValues>
  extends Omit<React.FormHTMLAttributes<HTMLFormElement>, "onSubmit">,
    VariantProps<typeof formVariants> {
  /** React Hook Form instance */
  form: UseFormReturn<TFieldValues>;
  /** Callback function called when form is submitted with valid data */
  onSubmit: (data: TFieldValues) => void | Promise<void>;
  /** Render as child element instead of form tag */
  asChild?: boolean;
}

export function Form<TFieldValues extends FieldValues = FieldValues>({
  form,
  onSubmit,
  children,
  layout,
  size,
  className,
  asChild = false,
  ...props
}: FormProps<TFieldValues>) {
  const Comp = asChild ? Slot : "form";

  return (
    <FormContext.Provider value={{ form: form as UseFormReturn<FieldValues> }}>
      <Comp
        className={clsx(formVariants({ layout, size }), className)}
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate // We handle validation through React Hook Form
        {...props}
      >
        {children}
      </Comp>
    </FormContext.Provider>
  );
}

// Form Field
export interface FormFieldProps {
  name: string;
  rules?: ValidationRule;
  defaultValue?: unknown;
  children: (field: {
    value: unknown;
    onChange: (value: unknown) => void;
    onBlur: () => void;
    error?: string;
    invalid: boolean;
  }) => React.ReactNode;
}

export function FormField({ name, rules, defaultValue, children }: FormFieldProps) {
  const { form } = useFormContext();
  const validationRules = rules ? createValidationRules(rules) : undefined;

  const controllerProps: any = {
    name: name as any,
    control: form.control,
    defaultValue: defaultValue as any,
    ...(validationRules && { rules: validationRules }),
  };

  return (
    <Controller
      {...controllerProps}
      render={({ field, fieldState }) => (
        <FormFieldContext.Provider
          value={{
            name,
            error: fieldState.error?.message ?? "",
            invalid: fieldState.invalid,
          }}
        >
          {children({
            value: field.value,
            onChange: (value) => field.onChange(value),
            onBlur: field.onBlur,
            error: fieldState.error?.message ?? "",
            invalid: fieldState.invalid,
          })}
        </FormFieldContext.Provider>
      )}
    />
  );
}

// Form Item (Field Container)
export interface FormItemProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
}

export const FormItem = forwardRef<HTMLDivElement, FormItemProps>(
  ({ className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "div";
    const id = useUniqueId("form-item");

    return (
      <FormItemContext.Provider value={{ id }}>
        <Comp ref={ref} className={clsx("form-item space-y-2", className)} {...props} />
      </FormItemContext.Provider>
    );
  },
);

// Form Label
export interface FormLabelProps extends React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> {
  required?: boolean;
}

export const FormLabel = forwardRef<React.ElementRef<typeof LabelPrimitive.Root>, FormLabelProps>(
  ({ className, required, children, htmlFor, ...props }, ref) => {
    const field = useFormFieldState();

    return (
      <LabelPrimitive.Root
        ref={ref}
        htmlFor={htmlFor ?? field?.inputId}
        className={clsx(
          "form-label",
          { required },
          field?.invalid && "text-destructive",
          className,
        )}
        {...props}
      >
        {children}
        {required ? <span className="required-indicator">*</span> : null}
      </LabelPrimitive.Root>
    );
  },
);

// Form Description
export const FormDescription = forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  const field = useFormFieldState();

  return (
    <p
      ref={ref}
      id={field?.formDescriptionId}
      className={clsx("form-description text-sm text-muted-foreground", className)}
      {...props}
    />
  );
});

// Form Message (Error/Success/Warning)
export interface FormMessageProps extends React.HTMLAttributes<HTMLParagraphElement> {
  variant?: "error" | "success" | "warning" | "info";
}

const messageVariantClasses: Record<NonNullable<FormMessageProps["variant"]>, string> = {
  error: "text-destructive",
  success: "text-success",
  warning: "text-warning",
  info: "text-info",
};

export const FormMessage = forwardRef<HTMLParagraphElement, FormMessageProps>(
  ({ className, variant = "error", children, ...props }, ref) => {
    const field = useFormFieldState();
    const body = children ?? field?.error;

    if (!body) {
      return null;
    }

    const shouldAnnounce = variant === "error" || field?.invalid;

    return (
      <p
        ref={ref}
        id={field?.formMessageId}
        role={shouldAnnounce ? "alert" : undefined}
        aria-live={shouldAnnounce ? "assertive" : undefined}
        className={clsx(
          "form-message text-sm",
          `variant-${variant}`,
          messageVariantClasses[variant],
          className,
        )}
        {...props}
      >
        {body}
      </p>
    );
  },
);

/**
 * Accessible input component with support for icons and validation states
 *
 * Provides a flexible input field that supports various visual states and
 * accessibility features. Can include start/end icons and integrates with
 * form validation systems.
 *
 * @param variant - Visual style: 'default' | 'outlined' | 'filled' | 'underlined'
 * @param size - Size variant: 'sm' | 'md' | 'lg'
 * @param state - Validation state: 'default' | 'error' | 'success' | 'warning'
 * @param type - HTML input type (text, email, password, etc.)
 * @param startIcon - Icon element to display at the start of the input
 * @param endIcon - Icon element to display at the end of the input
 * @param asChild - Merge props into child element instead of rendering input
 *
 * @example
 * ```tsx
 * return (
 *   <Input
 *     type="email"
 *     variant="outlined"
 *     size="md"
 *     state="error"
 *     startIcon={MailIcon}
 *     placeholder="Enter your email"
 *     aria-describedby="email-error"
 *   />
 * );
 * ```
 */
export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {
  /** Render as child element instead of input tag */
  asChild?: boolean;
  /** Icon to display at the start of the input */
  startIcon?: React.ReactNode;
  /** Icon to display at the end of the input */
  endIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      variant,
      size,
      state,
      type = "text",
      startIcon,
      endIcon,
      asChild = false,
      "aria-invalid": ariaInvalid,
      "aria-describedby": ariaDescribedBy,
      name,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "input";
    const generatedId = useUniqueId("input");
    const field = useFormFieldState();

    const controlId = field?.inputId ?? generatedId;
    const isInvalid = field ? field.invalid : (ariaInvalid ?? state === "error");
    const describedBy =
      [ariaDescribedBy, field?.formDescriptionId, field?.error ? field?.formMessageId : null]
        .filter(Boolean)
        .join(" ") || undefined;

    const resolvedName = name ?? field?.name;
    const sharedProps = {
      id: controlId,
      name: resolvedName,
      "aria-invalid": (isInvalid ? "true" : "false") as "true" | "false",
      "aria-describedby": describedBy,
    };

    if (startIcon || endIcon) {
      return (
        <div className={clsx("input-wrapper", inputVariants({ variant, size, state }), className)}>
          {startIcon ? (
            <span className="input-start-icon" aria-hidden="true" role="presentation">
              {startIcon}
            </span>
          ) : null}
          <Comp type={type} ref={ref} {...sharedProps} {...props} className="input-element" />
          {endIcon ? (
            <span className="input-end-icon" aria-hidden="true" role="presentation">
              {endIcon}
            </span>
          ) : null}
        </div>
      );
    }

    return (
      <Comp
        type={type}
        ref={ref}
        {...sharedProps}
        {...props}
        className={clsx(inputVariants({ variant, size, state }), className)}
      />
    );
  },
);

// Textarea Component
export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    VariantProps<typeof inputVariants> {
  asChild?: boolean;
  resize?: "none" | "vertical" | "horizontal" | "both";
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      variant,
      size,
      state,
      resize = "vertical",
      asChild = false,
      "aria-invalid": ariaInvalid,
      "aria-describedby": ariaDescribedBy,
      name,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "textarea";
    const generatedId = useUniqueId("textarea");
    const field = useFormFieldState();
    const controlId = field?.inputId ?? generatedId;
    const isInvalid = field ? field.invalid : (ariaInvalid ?? state === "error");
    const describedBy =
      [ariaDescribedBy, field?.formDescriptionId, field?.error ? field?.formMessageId : null]
        .filter(Boolean)
        .join(" ") || undefined;

    const resolvedName = name ?? field?.name;

    return (
      <Comp
        id={controlId}
        name={resolvedName}
        aria-invalid={isInvalid ? "true" : "false"}
        aria-describedby={describedBy}
        className={clsx(inputVariants({ variant, size, state }), `resize-${resize}`, className)}
        ref={ref}
        {...props}
      />
    );
  },
);

// Select Component (basic HTML select)
export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size">,
    VariantProps<typeof inputVariants> {
  asChild?: boolean;
  placeholder?: string;
  options?: Array<{ value: string; label: string; disabled?: boolean }>;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      variant,
      size,
      state,
      placeholder,
      options = [],
      children,
      asChild = false,
      "aria-invalid": ariaInvalid,
      "aria-describedby": ariaDescribedBy,
      name,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "select";
    const generatedId = useUniqueId("select");
    const field = useFormFieldState();
    const controlId = field?.inputId ?? generatedId;
    const isInvalid = field ? field.invalid : (ariaInvalid ?? state === "error");
    const describedBy =
      [ariaDescribedBy, field?.formDescriptionId, field?.error ? field?.formMessageId : null]
        .filter(Boolean)
        .join(" ") || undefined;
    const resolvedName = name ?? field?.name;

    return (
      <Comp
        id={controlId}
        name={resolvedName}
        aria-invalid={isInvalid ? "true" : "false"}
        aria-describedby={describedBy}
        className={clsx(inputVariants({ variant, size, state }), className)}
        ref={ref}
        {...props}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map(({ value, label, disabled }) => (
          <option key={value} value={value} disabled={disabled}>
            {label}
          </option>
        ))}
        {children}
      </Comp>
    );
  },
);

// Checkbox Component
export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  "data-testid"?: string;
  label?: string;
  description?: string;
  indeterminate?: boolean;
  id?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      className,
      label,
      description,
      indeterminate,
      id,
      "data-testid": dataTestId,
      "aria-invalid": ariaInvalid,
      "aria-describedby": ariaDescribedBy,
      name,
      ...props
    },
    ref,
  ) => {
    const generatedId = useUniqueId();
    const checkboxId = id || `checkbox-${generatedId}`;
    const field = useFormFieldState();
    const inputRef = React.useRef<HTMLInputElement | null>(null);

    const controlId = field?.inputId ?? checkboxId;
    const isInvalid = field ? field.invalid : (ariaInvalid ?? false);
    const describedBy =
      [ariaDescribedBy, field?.formDescriptionId, field?.error ? field?.formMessageId : null]
        .filter(Boolean)
        .join(" ") || undefined;
    const resolvedName = name ?? field?.name;

    React.useEffect(() => {
      if (inputRef.current) {
        inputRef.current.indeterminate = !!indeterminate;
      }
    }, [indeterminate]);

    const assignRef = (node: HTMLInputElement | null) => {
      inputRef.current = node;
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
      }
    };

    return (
      <div className={clsx("checkbox-wrapper space-y-1.5", className)} data-testid={dataTestId}>
        <input
          type="checkbox"
          ref={assignRef}
          id={controlId}
          name={resolvedName}
          aria-invalid={isInvalid ? "true" : "false"}
          aria-describedby={describedBy}
          className="checkbox-input"
          {...props}
        />
        {label || description ? (
          <div className="checkbox-content">
            {label ? (
              <label htmlFor={controlId} className="checkbox-label">
                {label}
              </label>
            ) : null}
            {description ? <p className="checkbox-description">{description}</p> : null}
          </div>
        ) : null}
      </div>
    );
  },
);

// Radio Component
export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  "data-testid"?: string;
  label?: string;
  description?: string;
  id?: string;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(
  (
    {
      className,
      label,
      description,
      id,
      "data-testid": dataTestId,
      "aria-invalid": ariaInvalid,
      "aria-describedby": ariaDescribedBy,
      name,
      ...props
    },
    ref,
  ) => {
    const generatedId = useUniqueId();
    const radioId = id || `radio-${generatedId}`;
    const field = useFormFieldState();

    const controlId = field?.inputId ?? radioId;
    const isInvalid = field ? field.invalid : (ariaInvalid ?? false);
    const describedBy =
      [ariaDescribedBy, field?.formDescriptionId, field?.error ? field?.formMessageId : null]
        .filter(Boolean)
        .join(" ") || undefined;
    const resolvedName = name ?? field?.name;

    return (
      <div className={clsx("radio-wrapper space-y-1.5", className)} data-testid={dataTestId}>
        <input
          type="radio"
          ref={ref}
          id={controlId}
          name={resolvedName}
          aria-invalid={isInvalid ? "true" : "false"}
          aria-describedby={describedBy}
          className="radio-input"
          {...props}
        />
        {label || description ? (
          <div className="radio-content">
            {label ? (
              <label htmlFor={controlId} className="radio-label">
                {label}
              </label>
            ) : null}
            {description ? <p className="radio-description">{description}</p> : null}
          </div>
        ) : null}
      </div>
    );
  },
);

// RadioGroup Component
export interface RadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
  value?: string;
  onValueChange?: (value: string) => void;
  options: Array<{
    value: string;
    label: string;
    description?: string;
    disabled?: boolean;
  }>;
  orientation?: "horizontal" | "vertical";
}

export const RadioGroup = forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ className, name, value, onValueChange, options, orientation = "vertical", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx("radio-group", `orientation-${orientation}`, className)}
        {...props}
      >
        {options.map(({ value: optionValue, label, description, disabled }) => (
          <Radio
            key={optionValue}
            name={name}
            value={optionValue}
            checked={value === optionValue}
            onChange={() => onValueChange?.(optionValue)}
            disabled={disabled}
            label={label}
            {...(description && { description })}
          />
        ))}
      </div>
    );
  },
);

// Validation helpers
export function createValidationRules(rules: ValidationRule): RegisterOptions {
  const validation: RegisterOptions = {
    // Implementation pending
  };

  if (rules.required) {
    validation.required =
      typeof rules.required === "string" ? rules.required : "This field is required";
  }

  if (rules.pattern) {
    validation.pattern = rules.pattern;
  }

  if (rules.min) {
    validation.min = rules.min;
  }

  if (rules.max) {
    validation.max = rules.max;
  }

  if (rules.minLength) {
    validation.minLength = rules.minLength;
  }

  if (rules.maxLength) {
    validation.maxLength = rules.maxLength;
  }

  if (rules.validate) {
    validation.validate = rules.validate;
  }

  return validation;
}

// Common validation patterns
export const validationPatterns = {
  email: {
    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+.[A-Z]{2,}$/i,
    message: "Please enter a valid email address",
  },
  phone: {
    value: /^[+]?[1-9][\d]{0,15}$/,
    message: "Please enter a valid phone number",
  },
  url: {
    value:
      /^https?:\/\/(?:[-\w.])+(?::[0-9]+)?(?:\/(?:[\w/_.])*(?:\?(?:[\w&=%.])*)?(?:#(?:[\w.])*)?)?$/,
    message: "Please enter a valid URL",
  },
  ipAddress: {
    value:
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?).){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
    message: "Please enter a valid IP address",
  },
};

function useUniqueId(prefix = "id"): string {
  const [generatedId] = React.useState(
    () => `${prefix}-${Math.random().toString(36).slice(2, 11)}`,
  );
  return generatedId;
}

// Export all components
FormItem.displayName = "FormItem";
FormLabel.displayName = "FormLabel";
FormDescription.displayName = "FormDescription";
FormMessage.displayName = "FormMessage";
Input.displayName = "Input";
Textarea.displayName = "Textarea";

// Components are already exported inline where they are defined
