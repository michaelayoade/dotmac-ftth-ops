import * as React from "react";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  indicatorClassName?: string;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className = "", value = 0, indicatorClassName = "", ...props }, ref) => {
    const safeValue = isNaN(value) ? 0 : Math.min(100, Math.max(0, value));
    return (
      <div
        ref={ref}
        className={`relative h-2 w-full overflow-hidden rounded-full bg-muted ${className}`}
        {...props}
      >
        <div
          className={`h-full transition-all ${indicatorClassName || "bg-sky-500"}`}
          style={{ width: `${safeValue}%` }}
        />
      </div>
    );
  },
);
Progress.displayName = "Progress";

export { Progress };
