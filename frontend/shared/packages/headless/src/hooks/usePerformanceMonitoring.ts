/**
 * DEPRECATED: This file has been refactored into multiple smaller modules
 * Please use the performance module instead: import from './performance'
 *
 * This refactoring was done to:
 * - Reduce complexity from 450+ lines to manageable modules
 * - Follow ESLint complexity rules (max 10 complexity, 50 lines per function)
 * - Improve maintainability and testability
 * - Enable better tree shaking
 */

// Re-export the refactored implementation for backward compatibility
export {
  usePerformanceMonitoring,
  useApiPerformanceTracking,
  PerformanceMonitor,
  withPerformanceTracking,
} from "./performance";
export type { PerformanceMetrics, PerformanceObserverConfig } from "./performance";
