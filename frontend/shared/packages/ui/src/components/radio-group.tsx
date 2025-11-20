import * as React from "react";

interface RadioGroupProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  value?: string;
  onValueChange?: (value: string) => void;
  defaultValue?: string;
  name?: string;
}

export const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ className = "", value, onValueChange, defaultValue, name, children, ...props }, ref) => {
    const [internalValue, setInternalValue] = React.useState(defaultValue);
    const currentValue = value !== undefined ? value : internalValue;
    const generatedName = React.useId().replace(/:/g, "");
    const groupName = name ?? `radio-group-${generatedName}`;

    const handleChange = React.useCallback(
      (newValue: string) => {
        if (value === undefined) {
          setInternalValue(newValue);
        }
        onValueChange?.(newValue);
      },
      [value, onValueChange],
    );

    return (
      <div ref={ref} className={`grid gap-2 ${className}`} {...props}>
        {React.Children.map(children, (child) => {
          if (
            React.isValidElement<React.ComponentProps<typeof RadioGroupItem>>(child) &&
            child.type === RadioGroupItem
          ) {
            return React.cloneElement(child, {
              ...child.props,
              name: groupName,
              checked: child.props.value === currentValue,
              onChange: () => handleChange(child.props.value as string),
            });
          }
          return child;
        })}
      </div>
    );
  },
);
RadioGroup.displayName = "RadioGroup";

export const RadioGroupItem = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className = "", ...props }, ref) => (
  <input
    type="radio"
    ref={ref}
    className={`h-4 w-4 rounded-full border border-border text-sky-500 focus:ring-sky-500 ${className}`}
    {...props}
  />
));
RadioGroupItem.displayName = "RadioGroupItem";
