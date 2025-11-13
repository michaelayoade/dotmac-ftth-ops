import { AlertCircle } from "lucide-react";
import * as React from "react";

interface FormErrorProps {
  id?: string;
  error?: string;
  className?: string;
}

export function FormError({ id, error, className = "" }: FormErrorProps) {
  if (!error) return null;

  return (
    <div
      id={id}
      role="alert"
      aria-live="polite"
      className={`flex items-center gap-2 mt-1 text-sm text-red-400 ${className}`}
    >
      <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <span>{error}</span>
    </div>
  );
}
