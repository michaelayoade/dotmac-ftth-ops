declare module "@dotmac/primitives" {
  export * from "../../../shared/packages/primitives/src/index.ts";
  export { sanitizeRichHtml } from "../../../shared/packages/primitives/src/utils/security";
  export {
    default as UniversalDashboard,
    type UniversalDashboardProps,
    type DashboardVariant,
    type DashboardUser,
    type DashboardTenant,
    type DashboardHeaderAction,
  } from "../../../shared/packages/primitives/src/dashboard/UniversalDashboard";
  export {
    default as UniversalKPISection,
    type UniversalKPISectionProps,
    type KPIItem,
  } from "../../../shared/packages/primitives/src/dashboard/UniversalKPISection";
  export {
    default as UniversalActivityFeed,
    type UniversalActivityFeedProps,
    type ActivityItem,
    type ActivityAction,
  } from "../../../shared/packages/primitives/src/dashboard/UniversalActivityFeed";
  export {
    default as UniversalChart,
    type UniversalChartProps,
  } from "../../../shared/packages/primitives/src/charts/UniversalChart";
  export {
    NetworkTopologyMap,
    type NetworkTopologyMapProps,
    type NetworkTopologyNode,
  } from "../../../shared/packages/primitives/src/maps";
  export {
    VirtualizedTable,
    type VirtualizedTableProps,
  } from "../../../shared/packages/primitives/src/performance/VirtualizedTable";
  export {
    AnimatedCard,
    AnimatedProgressBar,
    AnimatedCounter,
    PulseIndicator,
    FadeInWhenVisible,
  } from "../../../shared/packages/primitives/src/animations/Animations";
}
