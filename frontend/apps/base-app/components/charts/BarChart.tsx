"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface DataPoint {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: DataPoint[];
  className?: string;
  height?: number;
  horizontal?: boolean;
  showValues?: boolean;
  animated?: boolean;
  colorScheme?: "blue" | "green" | "purple" | "gradient";
}

export function BarChart({
  data,
  className = "",
  height = 300,
  horizontal = false,
  showValues = true,
  animated = true,
  colorScheme = "blue",
}: BarChartProps) {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50",
          className,
        )}
        style={{ height }}
      >
        <p className="text-sm text-slate-500 dark:text-slate-400">No data available</p>
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value));

  const colors = {
    blue: "bg-sky-500",
    green: "bg-green-500",
    purple: "bg-purple-500",
    gradient: "bg-gradient-to-r from-sky-500 to-purple-500",
  };

  const hoverColors = {
    blue: "hover:bg-sky-600",
    green: "hover:bg-green-600",
    purple: "hover:bg-purple-600",
    gradient: "hover:from-sky-600 hover:to-purple-600",
  };

  return (
    <div className={cn("space-y-3", className)}>
      {data.map((item, index) => {
        const percentage = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
        const isHovered = hoveredIndex === index;

        return (
          <div key={index} className="space-y-1">
            {/* Label and value */}
            <div className="flex items-center justify-between text-sm">
              <span
                className={cn(
                  "font-medium transition-colors",
                  isHovered ? "text-sky-500" : "text-slate-700 dark:text-slate-300",
                )}
              >
                {item.label}
              </span>
              {showValues && (
                <span
                  className={cn(
                    "font-semibold tabular-nums transition-colors",
                    isHovered ? "text-sky-500" : "text-slate-900 dark:text-white",
                  )}
                >
                  {item.value.toLocaleString()}
                </span>
              )}
            </div>

            {/* Bar */}
            <div className="relative h-8 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden">
              <div
                className={cn(
                  "absolute top-0 left-0 h-full rounded-lg transition-all duration-500",
                  item.color || colors[colorScheme],
                  item.color || hoverColors[colorScheme],
                  animated && "animate-in slide-in-from-left",
                  isHovered && "shadow-lg",
                )}
                style={{
                  width: `${percentage}%`,
                  animationDelay: `${index * 100}ms`,
                }}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Shimmer effect */}
                {animated && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                )}
              </div>

              {/* Percentage label inside bar */}
              {percentage > 15 && (
                <div className="absolute inset-0 flex items-center px-3">
                  <span className="text-xs font-medium text-white">{percentage.toFixed(0)}%</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
