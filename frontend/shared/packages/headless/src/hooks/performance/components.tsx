/**
 * Performance Monitoring Components
 */

import React, { useEffect, useRef } from "react";
import { usePerformanceMonitoring } from "./usePerformanceMonitoring";
import type { PerformanceObserverConfig } from "./types";

// React component to wrap apps with performance monitoring
export const PerformanceMonitor: React.FC<{
  children: React.ReactNode;
  config?: PerformanceObserverConfig;
}> = ({ children, config }) => {
  usePerformanceMonitoring(config);
  return <>{children}</>;
};

// HOC for component performance tracking
export function withPerformanceTracking<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName?: string,
) {
  const ComponentWithPerformanceTracking = (props: P) => {
    const { trackComponentRender } = usePerformanceMonitoring();
    const renderStartTime = useRef<number>();

    useEffect(() => {
      renderStartTime.current = performance.now();
    });

    useEffect(() => {
      if (renderStartTime.current) {
        const renderDuration = performance.now() - renderStartTime.current;
        trackComponentRender(
          componentName || WrappedComponent.displayName || WrappedComponent.name || "Component",
          renderDuration,
        );
      }
    });

    return <WrappedComponent {...props} />;
  };

  ComponentWithPerformanceTracking.displayName = `withPerformanceTracking(${
    componentName || WrappedComponent.displayName || WrappedComponent.name
  })`;

  return ComponentWithPerformanceTracking;
}
