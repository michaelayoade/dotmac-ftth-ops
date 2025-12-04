"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface DataPoint {
  label: string;
  value: number;
  color?: string;
}

interface LineChartProps {
  data: DataPoint[];
  className?: string;
  height?: number;
  showGrid?: boolean;
  showLabels?: boolean;
  showValues?: boolean;
  animated?: boolean;
  gradient?: boolean;
}

export function LineChart({
  data,
  className = "",
  height = 200,
  showGrid = true,
  showLabels = true,
  showValues = false,
  animated = true,
  gradient = true,
}: LineChartProps) {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);
  const gradientId = React.useId();

  if (!data || data.length === 0) {
    return (
      <div className={cn("flex items-center justify-center", className)} style={{ height }}>
        <p className="text-sm text-slate-500 dark:text-slate-400">No data available</p>
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value));
  const minValue = Math.min(...data.map((d) => d.value));
  const range = maxValue - minValue || 1;
  const padding = 40;
  const chartWidth = 100;
  const pointRadius = 4;

  // Calculate points for the line
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * chartWidth;
    const y = 100 - ((d.value - minValue) / range) * (100 - padding);
    return { x, y, value: d.value, label: d.label };
  });

  // Create SVG path
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  // Create area path for gradient
  const lastPoint = points[points.length - 1];
  const areaPath = gradient && lastPoint ? `${linePath} L ${lastPoint.x} 100 L 0 100 Z` : "";

  return (
    <div className={cn("relative", className)}>
      {/* Labels */}
      {showLabels && (
        <div className="flex justify-between mb-2 px-2">
          {data.map((d, i) => (
            <span
              key={i}
              className={cn(
                "text-xs transition-colors",
                hoveredIndex === i
                  ? "text-sky-500 font-medium"
                  : "text-slate-600 dark:text-slate-400",
              )}
            >
              {d.label}
            </span>
          ))}
        </div>
      )}

      {/* Chart */}
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
          {/* Grid lines */}
          {showGrid && (
            <g className="opacity-20">
              {[0, 25, 50, 75, 100].map((y) => (
                <line
                  key={y}
                  x1="0"
                  y1={y}
                  x2="100"
                  y2={y}
                  stroke="currentColor"
                  strokeWidth="0.2"
                  className="text-slate-400 dark:text-slate-600"
                />
              ))}
            </g>
          )}

          {/* Gradient area */}
          {gradient && (
            <>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(14, 165, 233)" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="rgb(14, 165, 233)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d={areaPath}
                fill={`url(#${gradientId})`}
                className={animated ? "animate-in fade-in duration-500" : ""}
              />
            </>
          )}

          {/* Line */}
          <path
            d={linePath}
            fill="none"
            stroke="rgb(14, 165, 233)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={animated ? "animate-in slide-in-from-left duration-700" : ""}
          />

          {/* Data points */}
          {points.map((p, i) => (
            <g key={i}>
              <circle
                cx={p.x}
                cy={p.y}
                r={hoveredIndex === i ? pointRadius * 1.5 : pointRadius}
                fill="rgb(14, 165, 233)"
                className={cn(
                  "transition-all duration-200 cursor-pointer",
                  animated && "animate-in zoom-in",
                  hoveredIndex === i && "drop-shadow-lg",
                )}
                style={{ animationDelay: `${i * 50}ms` }}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
              {hoveredIndex === i && showValues && (
                <text
                  x={p.x}
                  y={p.y - 10}
                  textAnchor="middle"
                  className="text-xs fill-sky-500 font-medium"
                  style={{ fontSize: "4px" }}
                >
                  {p.value}
                </text>
              )}
            </g>
          ))}
        </svg>

        {/* Hover tooltip */}
        {hoveredIndex !== null && points[hoveredIndex] && data[hoveredIndex] && (
          <div
            className="absolute bg-slate-900 dark:bg-slate-800 text-white px-3 py-2 rounded-lg shadow-lg text-sm pointer-events-none z-10 animate-in fade-in zoom-in duration-200"
            style={{
              left: `${points[hoveredIndex].x}%`,
              top: `${points[hoveredIndex].y}%`,
              transform: "translate(-50%, -120%)",
            }}
          >
            <div className="font-medium">{data[hoveredIndex].label}</div>
            <div className="text-sky-400">{points[hoveredIndex].value.toLocaleString()}</div>
          </div>
        )}
      </div>
    </div>
  );
}
