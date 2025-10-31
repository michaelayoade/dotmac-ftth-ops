import * as React from "react";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "text" | "circular" | "rectangular";
}

export function Skeleton({ className = "", variant = "default", ...props }: SkeletonProps) {
  const variants = {
    default: "rounded-lg",
    text: "rounded h-4",
    circular: "rounded-full",
    rectangular: "rounded-md",
  };

  return <div className={`animate-pulse bg-muted ${variants[variant]} ${className}`} {...props} />;
}

export function SkeletonCard() {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="space-y-4">
        <Skeleton className="h-6 w-1/3" variant="text" />
        <Skeleton className="h-4 w-full" variant="text" />
        <Skeleton className="h-4 w-5/6" variant="text" />
        <div className="flex gap-2 mt-4">
          <Skeleton className="h-10 w-24" variant="rectangular" />
          <Skeleton className="h-10 w-24" variant="rectangular" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonMetricCard() {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-3">
          <Skeleton className="h-4 w-32" variant="text" />
          <Skeleton className="h-8 w-24" variant="text" />
          <Skeleton className="h-3 w-20" variant="text" />
        </div>
        <Skeleton className="h-12 w-12" variant="rectangular" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" variant="circular" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/4" variant="text" />
            <Skeleton className="h-3 w-1/3" variant="text" />
          </div>
          <Skeleton className="h-8 w-20" variant="rectangular" />
        </div>
      ))}
    </div>
  );
}
