"use client";

import { Loader2 } from "lucide-react";
import * as React from "react";

import { cn } from "../lib/utils";

interface LoadingOverlayProps {
  loading?: boolean;
  message?: string;
  className?: string;
  variant?: "spinner" | "pulse" | "dots";
  size?: "sm" | "md" | "lg";
}

export function LoadingOverlay({
  loading = true,
  message,
  className = "",
  variant = "spinner",
  size = "md",
}: LoadingOverlayProps) {
  if (!loading) return null;

  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  return (
    <div
      className={cn(
        "absolute inset-0 bg-card/80 backdrop-blur-sm flex items-center justify-center z-50 rounded-lg",
        "animate-in fade-in duration-200",
        className,
      )}
    >
      <div className="text-center space-y-3">
        {variant === "spinner" && (
          <Loader2 className={cn(sizeClasses[size], "animate-spin text-sky-400 mx-auto")} />
        )}

        {variant === "pulse" && (
          <div className="flex gap-2 justify-center">
            <div className={cn(sizeClasses[size], "bg-sky-400 rounded-full animate-pulse")} />
          </div>
        )}

        {variant === "dots" && (
          <div className="flex gap-2 justify-center">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={cn(
                  "w-3 h-3 bg-sky-400 rounded-full animate-bounce",
                  i === 1 && "animation-delay-100",
                  i === 2 && "animation-delay-200",
                )}
                style={{
                  animationDelay: `${i * 150}ms`,
                }}
              />
            ))}
          </div>
        )}

        {message && (
          <p className="text-sm text-muted-foreground animate-in slide-in-from-bottom-2 duration-300">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

interface InlineLoaderProps {
  message?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function InlineLoader({ message, size = "md", className = "" }: InlineLoaderProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Loader2 className={cn(sizeClasses[size], "animate-spin text-sky-400")} />
      {message && <span className="text-sm text-muted-foreground">{message}</span>}
    </div>
  );
}
