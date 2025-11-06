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
import type { FieldValues, RegisterOptions, UseFormReturn } from "react-hook-form";

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
const inputVariants = cva("", {
  variants: {
    variant: {
      default: "",
      outlined: "",
      filled: "",
      underlined: "",
    },
    size: {
      sm: "",
      md: "",
      lg: "",
    },
    state: {
      default: "",
      error: "",
      success: "",
      warning: "",
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

export const useFormContext = () => {
  const context = useContext(FormContext);
  if (!context) {
    throw new Error("Form components must be used within a Form");
  }
  return context;
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
  children: (field: {
    value: unknown;
    onChange: (value: unknown) => void;
    onBlur: () => void;
    error?: string;
    invalid: boolean;
  }) => React.ReactNode;
}

export function FormField({ name, children }: FormFieldProps) {
  const { form } = useFormContext();
  const {
    register,
    formState: { errors },
    watch,
    setValue,
    trigger,
  } = form;

  const value = watch(name);
  const error = errors[name]?.message as string | undefined;

  return (
    <>
      {children({
        value,
        onChange: (newValue) => setValue(name, newValue),
        onBlur: () => void trigger(name),
        ...(error && { error }),
        invalid: !!error,
      })}
    </>
  );
}

// Form Item (Field Container)
export interface FormItemProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
}

export const FormItem = forwardRef<HTMLDivElement, FormItemProps>(
  ({ className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "div";

    return <Comp ref={ref} className={clsx("form-item", className)} {...props} />;
  },
);

// Form Label
export interface FormLabelProps extends React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> {
  required?: boolean;
}

export const FormLabel = forwardRef<React.ElementRef<typeof LabelPrimitive.Root>, FormLabelProps>(
  ({ className, required, children, ...props }, ref) => (
    <LabelPrimitive.Root
      ref={ref}
      className={clsx("form-label", { required }, className)}
      {...props}
    >
      {children}
      {required ? <span className="required-indicator">*</span> : null}
    </LabelPrimitive.Root>
  ),
);

// Form Description
export const FormDescription = forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={clsx("form-description", className)} {...props} />
));

// Form Message (Error/Success/Warning)
export interface FormMessageProps extends React.HTMLAttributes<HTMLParagraphElement> {
  variant?: "error" | "success" | "warning" | "info";
}

export const FormMessage = forwardRef<HTMLParagraphElement, FormMessageProps>(
  ({ className, variant = "error", ...props }, ref) => (
    <p ref={ref} className={clsx("form-message", `variant-${variant}`, className)} {...props} />
  ),
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
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "input";
    const inputId = useUniqueId("input");

    // Automatically set aria-invalid based on state
    const invalid = ariaInvalid ?? state === "error";

    if (startIcon || endIcon) {
      return (
        <div className={clsx("input-wrapper", inputVariants({ variant, size, state }))}>
          {startIcon ? (
            <span className="input-start-icon" aria-hidden="true" role="presentation">
              {startIcon}
            </span>
          ) : null}
          <Comp
            id={inputId}
            type={type}
            className={clsx("input-element", className)}
            ref={ref}
            aria-invalid={invalid}
            {...props}
          />
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
        id={inputId}
        type={type}
        className={clsx(inputVariants({ variant, size, state }), className)}
        ref={ref}
        aria-invalid={invalid}
        {...props}
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
  ({ className, variant, size, state, resize = "vertical", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "textarea";

    return (
      <Comp
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
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "select";

    return (
      <Comp
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
  label?: string;
  description?: string;
  indeterminate?: boolean;
  id?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, description, indeterminate, id, ...props }, ref) => {
    const generatedId = useUniqueId();
    const checkboxId = id || `checkbox-${generatedId}`;

    return (
      <div className={clsx("checkbox-wrapper", className)}>
        <input type="checkbox" ref={ref} id={checkboxId} className="checkbox-input" {...props} />
        {label || description ? (
          <div className="checkbox-content">
            {label ? (
              <label htmlFor={checkboxId} className="checkbox-label">
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
  label?: string;
  description?: string;
  id?: string;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(
  ({ className, label, description, id, ...props }, ref) => {
    const generatedId = useUniqueId();
    const radioId = id || `radio-${generatedId}`;

    return (
      <div className={clsx("radio-wrapper", className)}>
        <input type="radio" ref={ref} id={radioId} className="radio-input" {...props} />
        {label || description ? (
          <div className="radio-content">
            {label ? (
              <label htmlFor={radioId} className="radio-label">
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
  const [generatedId] = React.useState(() => `${prefix}-${Math.random().toString(36).slice(2, 11)}`);
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
