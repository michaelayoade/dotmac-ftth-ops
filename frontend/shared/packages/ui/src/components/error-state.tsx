"use client";

import { AlertCircle, RefreshCw, type LucideIcon } from "lucide-react";

import { cn } from "../lib/utils";

import { Button } from "./button";

interface ErrorStateProps {
  title?: string;
  message: string;
  icon?: LucideIcon;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
  variant?: "inline" | "card" | "full";
}

export function ErrorState({
  title = "Something went wrong",
  message,
  icon: Icon = AlertCircle,
  onRetry,
  retryLabel = "Try again",
  className = "",
  variant = "card",
}: ErrorStateProps) {
  const variantStyles = {
    inline: "py-4",
    card: "rounded-lg border border-red-900/30 bg-red-950/20 p-6",
    full: "min-h-[400px] flex items-center justify-center py-12",
  };

  return (
    <div className={cn(variantStyles[variant], className)}>
      <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto">
        <div className="p-4 bg-red-900/30 rounded-full mb-4 animate-in fade-in zoom-in duration-300">
          <Icon className="h-8 w-8 text-red-400" aria-hidden="true" />
        </div>

        <h3 className="text-lg font-semibold text-red-200 mb-2">{title}</h3>

        <p className="text-sm text-red-300/80 mb-6">{message}</p>

        {onRetry && (
          <Button
            onClick={onRetry}
            variant="outline"
            className="border-red-800 hover:bg-red-900/30 hover:border-red-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {retryLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

interface ErrorBoundaryFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

export function ErrorBoundaryFallback({ error, resetErrorBoundary }: ErrorBoundaryFallbackProps) {
  return (
    <ErrorState
      title="Unexpected Error"
      message={error.message || "An unexpected error occurred while loading this component."}
      onRetry={resetErrorBoundary}
      variant="full"
    />
  );
}
