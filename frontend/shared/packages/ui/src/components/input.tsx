import * as React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", type, error, ...props }, ref) => {
    const hasError = !!error;

    return (
      <input
        type={type}
        className={`flex h-10 w-full rounded-md border ${hasError ? "border-destructive" : "border-border"} bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation ${className}`}
        ref={ref}
        aria-invalid={hasError}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
