"use client";

import type React from "react";

export interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg" | "xl";
  color?: "primary" | "secondary" | "white" | "gray";
  className?: string;
}

export function LoadingSpinner({
  size = "md",
  color = "primary",
  className = "",
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
    xl: "h-12 w-12",
  };

  const colorClasses = {
    primary: "text-blue-600",
    secondary: "text-gray-600",
    white: "text-white",
    gray: "text-gray-400",
  };

  return (
    <svg
      className={`animate-spin ${sizeClasses[size]} ${colorClasses[color]} ${className}`}
      fill="none"
      viewBox="0 0 24 24"
      role="alert"
      aria-live="polite"
      aria-label="Loading"
    >
      <title>Icon</title>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

export interface LoadingDotsProps {
  size?: "sm" | "md" | "lg";
  color?: "primary" | "secondary" | "white" | "gray";
  className?: string;
}

export function LoadingDots({ size = "md", color = "primary", className = "" }: LoadingDotsProps) {
  const sizeClasses = {
    sm: "h-1 w-1",
    md: "h-2 w-2",
    lg: "h-3 w-3",
  };

  const colorClasses = {
    primary: "bg-blue-600",
    secondary: "bg-gray-600",
    white: "bg-white",
    gray: "bg-gray-400",
  };

  return (
    <div
      className={`flex space-x-1 ${className}`}
      role="alert"
      aria-live="polite"
      aria-label="Loading"
    >
      <div
        className={`${sizeClasses[size]} ${colorClasses[color]} animate-bounce rounded-full`}
        style={{ animationDelay: "0ms" }}
      />
      <div
        className={`${sizeClasses[size]} ${colorClasses[color]} animate-bounce rounded-full`}
        style={{ animationDelay: "150ms" }}
      />
      <div
        className={`${sizeClasses[size]} ${colorClasses[color]} animate-bounce rounded-full`}
        style={{ animationDelay: "300ms" }}
      />
    </div>
  );
}

export interface LoadingBarProps {
  progress?: number;
  indeterminate?: boolean;
  height?: "sm" | "md" | "lg";
  color?: "primary" | "secondary" | "success" | "warning" | "danger";
  className?: string;
}

export function LoadingBar({
  progress = 0,
  indeterminate = false,
  height = "md",
  color = "primary",
  className = "",
}: LoadingBarProps) {
  const heightClasses = {
    sm: "h-1",
    md: "h-2",
    lg: "h-3",
  };

  const colorClasses = {
    primary: "bg-blue-600",
    secondary: "bg-gray-600",
    success: "bg-green-600",
    warning: "bg-yellow-600",
    danger: "bg-red-600",
  };

  return (
    <div
      className={`w-full overflow-hidden rounded-full bg-gray-200 ${heightClasses[height]} ${className}`}
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : progress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Loading progress"
    >
      <div
        className={`${heightClasses[height]} ${colorClasses[color]} rounded-full transition-all duration-300 ${
          indeterminate ? "animate-pulse" : ""
        }`}
        style={{
          width: indeterminate ? "100%" : `${Math.max(0, Math.min(100, progress))}%`,
          animation: indeterminate ? "loading-bar 2s ease-in-out infinite" : undefined,
        }}
      />
      <style>{`
        @keyframes loading-bar {
          0% {
            transform: translateX(-100%);
          }
          50% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}

export interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
  spinner?: "spinner" | "dots";
  backdrop?: "light" | "dark" | "blur";
  className?: string;
  children?: React.ReactNode;
}

export function LoadingOverlay({
  isVisible,
  message = "Loading...",
  spinner = "spinner",
  backdrop = "light",
  className = "",
  children,
}: LoadingOverlayProps) {
  if (!isVisible) {
    return children ? children : null;
  }

  const backdropClasses = {
    light: "bg-white bg-opacity-75",
    dark: "bg-gray-900 bg-opacity-75",
    blur: "bg-white bg-opacity-75 backdrop-blur-sm",
  };

  return (
    <div className="relative">
      {children}
      <div
        className={`absolute inset-0 z-50 flex items-center justify-center ${backdropClasses[backdrop]} ${className}`}
        role="alert"
        aria-live="polite"
        aria-label={message}
      >
        <div className="flex flex-col items-center space-y-3">
          {spinner === "spinner" ? (
            <LoadingSpinner size="lg" color={backdrop === "dark" ? "white" : "primary"} />
          ) : (
            <LoadingDots size="lg" color={backdrop === "dark" ? "white" : "primary"} />
          )}
          {message ? (
            <p
              className={`font-medium text-sm ${
                backdrop === "dark" ? "text-white" : "text-gray-900"
              }`}
            >
              {message}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  className?: string;
  animated?: boolean;
}

export function Skeleton({
  width = "100%",
  height = "1rem",
  className = "",
  animated = true,
}: SkeletonProps) {
  const widthStyle = typeof width === "number" ? `${width}px` : width;
  const heightStyle = typeof height === "number" ? `${height}px` : height;

  return (
    <div
      className={`rounded bg-gray-200 ${animated ? "animate-pulse" : ""} ${className}`}
      style={{ width: widthStyle, height: heightStyle }}
      role="alert"
      aria-live="polite"
      aria-label="Loading content"
    />
  );
}

export interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

export function SkeletonText({ lines = 3, className = "" }: SkeletonTextProps) {
  return (
    <div
      className={`space-y-2 ${className}`}
      role="alert"
      aria-live="polite"
      aria-label="Loading text"
    >
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={`item-${index}`}
          height="1rem"
          width={index === lines - 1 ? "75%" : "100%"}
        />
      ))}
    </div>
  );
}

export interface SkeletonCardProps {
  className?: string;
  showAvatar?: boolean;
  showTitle?: boolean;
  showContent?: boolean;
  contentLines?: number;
}

export function SkeletonCard({
  className = "",
  showAvatar = true,
  showTitle = true,
  showContent = true,
  contentLines = 3,
}: SkeletonCardProps) {
  return (
    <div
      className={`rounded-lg border border-gray-200 p-4 ${className}`}
      role="alert"
      aria-live="polite"
      aria-label="Loading card"
    >
      <div className="animate-pulse">
        {showAvatar ? (
          <div className="mb-4 flex items-center space-x-3">
            <Skeleton width="2.5rem" height="2.5rem" className="rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton height="1rem" width="40%" />
              <Skeleton height="0.75rem" width="60%" />
            </div>
          </div>
        ) : null}

        {showTitle ? <Skeleton height="1.25rem" width="80%" className="mb-3" /> : null}

        {showContent ? <SkeletonText lines={contentLines} /> : null}
      </div>
    </div>
  );
}

export interface ButtonLoadingProps {
  children: React.ReactNode;
  isLoading: boolean;
  loadingText?: string;
  disabled?: boolean;
  className?: string;
  [key: string]: unknown;
}

export function ButtonLoading({
  children,
  isLoading,
  loadingText,
  disabled,
  className = "",
  ...props
}: ButtonLoadingProps) {
  return (
    <button
      type="button"
      disabled={disabled || isLoading}
      className={`relative ${className}`}
      {...props}
    >
      <span className={isLoading ? "opacity-0" : "opacity-100"}>{children}</span>
      {isLoading ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <LoadingSpinner size="sm" color="white" className="mr-2" />
          {loadingText || "Loading..."}
        </span>
      ) : null}
    </button>
  );
}

// Loading state for tables
export interface LoadingTableProps {
  columns: number;
  rows?: number;
  showHeader?: boolean;
  className?: string;
}

export function LoadingTable({
  columns,
  rows = 5,
  showHeader = true,
  className = "",
}: LoadingTableProps) {
  return (
    <div
      className={`animate-pulse ${className}`}
      role="alert"
      aria-live="polite"
      aria-label="Loading table"
    >
      <table className="min-w-full">
        {showHeader ? (
          <thead>
            <tr>
              {Array.from({ length: columns }, (_, index) => (
                <th key={`item-${index}`} className="px-6 py-3">
                  <Skeleton height="1rem" />
                </th>
              ))}
            </tr>
          </thead>
        ) : null}
        <tbody>
          {Array.from({ length: rows }, (_, rowIndex) => (
            <tr key={rowIndex}>
              {Array.from({ length: columns }, (_, colIndex) => (
                <td key={colIndex} className="px-6 py-4">
                  <Skeleton height="1rem" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
