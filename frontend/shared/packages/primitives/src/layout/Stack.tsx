/**
 * Stack Layout Components
 */

import React from "react";
import { cn } from "../utils/cn";

export interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  direction?: "horizontal" | "vertical";
  spacing?: "none" | "xs" | "sm" | "md" | "lg" | "xl";
  align?: "start" | "center" | "end" | "stretch";
  justify?: "start" | "center" | "end" | "between" | "around" | "evenly";
  wrap?: boolean;
}

export const Stack = React.forwardRef<HTMLDivElement, StackProps>(
  (
    {
      className,
      direction = "vertical",
      spacing = "md",
      align = "stretch",
      justify = "start",
      wrap = false,
      children,
      ...props
    },
    ref,
  ) => {
    const spacingClasses = {
      none: "",
      xs: direction === "horizontal" ? "space-x-1" : "space-y-1",
      sm: direction === "horizontal" ? "space-x-2" : "space-y-2",
      md: direction === "horizontal" ? "space-x-4" : "space-y-4",
      lg: direction === "horizontal" ? "space-x-6" : "space-y-6",
      xl: direction === "horizontal" ? "space-x-8" : "space-y-8",
    };

    const alignClasses = {
      start: "items-start",
      center: "items-center",
      end: "items-end",
      stretch: "items-stretch",
    };

    const justifyClasses = {
      start: "justify-start",
      center: "justify-center",
      end: "justify-end",
      between: "justify-between",
      around: "justify-around",
      evenly: "justify-evenly",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "flex",
          direction === "horizontal" ? "flex-row" : "flex-col",
          spacingClasses[spacing],
          alignClasses[align],
          justifyClasses[justify],
          wrap && "flex-wrap",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
Stack.displayName = "Stack";

// Convenience components
export const HStack = React.forwardRef<HTMLDivElement, Omit<StackProps, "direction">>(
  (props, ref) => <Stack ref={ref} direction="horizontal" {...props} />,
);
HStack.displayName = "HStack";

export const VStack = React.forwardRef<HTMLDivElement, Omit<StackProps, "direction">>(
  (props, ref) => <Stack ref={ref} direction="vertical" {...props} />,
);
VStack.displayName = "VStack";
