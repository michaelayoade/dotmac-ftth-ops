import * as React from "react";

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className = "", ...props }, ref) => {
    return (
      <input
        type="checkbox"
        className={`h-4 w-4 rounded border-border text-sky-500 focus:ring-sky-500 ${className}`}
        ref={ref}
        {...props}
      />
    );
  },
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
