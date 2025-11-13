declare module "@dotmac/primitives" {
  export * from "../../../shared/packages/primitives/src/index.ts";
  export { sanitizeRichHtml } from "../../../shared/packages/primitives/src/utils/security";
  export {
    default as UniversalDashboard,
    UniversalDashboardProps,
    DashboardVariant,
    DashboardUser,
    DashboardTenant,
    DashboardHeaderAction,
  } from "../../../shared/packages/primitives/src/dashboard/UniversalDashboard";
  export {
    default as UniversalKPISection,
    UniversalKPISectionProps,
    KPIItem,
  } from "../../../shared/packages/primitives/src/dashboard/UniversalKPISection";
  export {
    default as UniversalChart,
    UniversalChartProps,
  } from "../../../shared/packages/primitives/src/charts/UniversalChart";
  export {
    TableSkeleton,
    TableSkeletons,
    type TableSkeletonProps,
  } from "../../../shared/packages/primitives/src/skeletons/TableSkeleton";
  export {
    CardGridSkeleton,
    type CardGridSkeletonProps,
  } from "../../../shared/packages/primitives/src/skeletons/CardSkeleton";
}
