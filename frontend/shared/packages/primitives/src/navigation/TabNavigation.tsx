/**
 * Tab Navigation Component
 */

import React from "react";
import { cn } from "../utils/cn";

// Tab Navigation Container
export interface TabNavigationProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "pills" | "bordered";
}

export const TabNavigation = React.forwardRef<HTMLDivElement, TabNavigationProps>(
  ({ className, variant = "default", ...props }, ref) => {
    const variantStyles = {
      default: "border-b border-gray-200",
      pills: "bg-gray-100 p-1 rounded-lg",
      bordered: "border border-gray-200 rounded-lg p-1",
    };

    return (
      <div
        ref={ref}
        className={cn("flex space-x-1", variantStyles[variant], className)}
        role="tablist"
        {...props}
      />
    );
  },
);
TabNavigation.displayName = "TabNavigation";

// Tab Item
export interface TabItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  variant?: "default" | "pills" | "bordered";
}

export const TabItem = React.forwardRef<HTMLButtonElement, TabItemProps>(
  ({ className, active = false, variant = "default", children, ...props }, ref) => {
    const baseStyles =
      "px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2";

    const variantStyles = {
      default: active
        ? "border-b-2 border-blue-500 text-blue-600"
        : "border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
      pills: active
        ? "bg-white shadow-sm text-gray-900"
        : "text-gray-600 hover:text-gray-900 hover:bg-white/50 rounded-md",
      bordered: active
        ? "bg-white border border-gray-300 shadow-sm text-gray-900 rounded-md"
        : "text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md",
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variantStyles[variant], className)}
        role="tab"
        aria-selected={active}
        {...props}
      >
        {children}
      </button>
    );
  },
);
TabItem.displayName = "TabItem";

// Tab Panel
export interface TabPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  active?: boolean;
}

export const TabPanel = React.forwardRef<HTMLDivElement, TabPanelProps>(
  ({ className, active = false, ...props }, ref) => {
    if (!active) return null;

    return <div ref={ref} className={cn("mt-4", className)} role="tabpanel" {...props} />;
  },
);
TabPanel.displayName = "TabPanel";
