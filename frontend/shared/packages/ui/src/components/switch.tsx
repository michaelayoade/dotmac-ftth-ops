import * as React from "react";

export interface SwitchProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  checked?: boolean | undefined;
  onCheckedChange?: (checked: boolean) => void;
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className = "", checked = false, onCheckedChange, ...props }, ref) => {
    return (
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onCheckedChange?.(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-muted"
        } ${className}`}
        ref={ref}
        {...props}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-primary-foreground transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    );
  },
);
Switch.displayName = "Switch";

export { Switch };
