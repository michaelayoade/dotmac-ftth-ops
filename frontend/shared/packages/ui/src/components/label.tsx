import * as React from "react";

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className = "", children, ...props }, ref) => (
    <label ref={ref} className={`text-sm font-medium text-foreground ${className}`} {...props}>
      {children}
    </label>
  ),
);
Label.displayName = "Label";

export { Label };
