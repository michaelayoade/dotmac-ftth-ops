/**
 * Universal Dashboard Components
 * Consistent dashboard patterns across all portal variants
 */

// Main Dashboard Container
export { default as UniversalDashboard } from "./UniversalDashboard";
export type {
  UniversalDashboardProps,
  DashboardVariant,
  DashboardUser,
  DashboardTenant,
  DashboardHeaderAction,
} from "./UniversalDashboard";

// Metric Display Components
export { default as UniversalMetricCard } from "./UniversalMetricCard";
export type {
  UniversalMetricCardProps,
  MetricTrend,
  MetricProgress,
  MetricStatus,
} from "./UniversalMetricCard";

// KPI Section Component
export { default as UniversalKPISection } from "./UniversalKPISection";
export type { UniversalKPISectionProps, KPIItem } from "./UniversalKPISection";

// Activity Feed Component
export { default as UniversalActivityFeed } from "./UniversalActivityFeed";
export type {
  UniversalActivityFeedProps,
  ActivityItem,
  ActivityAction,
} from "./UniversalActivityFeed";
