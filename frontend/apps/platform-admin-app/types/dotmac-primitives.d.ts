declare module "@dotmac/primitives" {
  export * from "../../../shared/packages/primitives/src/index.ts";
  export function sanitizeRichHtml(content: string | null | undefined): string;
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
  export {
    AnimatedCard,
    AnimatedCounter,
    FadeInWhenVisible,
  } from "../../../shared/packages/primitives/src/animations/Animations";
}
