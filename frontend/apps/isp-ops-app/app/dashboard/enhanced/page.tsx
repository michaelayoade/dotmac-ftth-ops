"use client";

/**
 * Enhanced Dashboard using Universal Dashboard Components
 * Demonstrates the UniversalDashboard, UniversalKPISection, and UniversalMetricCard
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  UniversalDashboard,
  UniversalKPISection,
  UniversalActivityFeed,
  type KPIItem,
  type ActivityItem,
} from "@dotmac/primitives";
import {
  Users,
  DollarSign,
  Activity,
  Server,
  TrendingUp,
  Wifi,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { useSession } from "@shared/lib/auth";
import type { UserInfo } from "@shared/lib/auth";
import { useRADIUSSubscribers, useRADIUSSessions } from "@/hooks/useRADIUS";
import { useServiceStatistics } from "@/hooks/useServiceLifecycle";
import { useAppConfig } from "@/providers/AppConfigContext";
import { useRBAC } from "@/contexts/RBACContext";

type DashboardUser = Pick<UserInfo, "id" | "email" | "roles" | "full_name">;

type IconRendererProps = {
  className?: string;
};

export default function EnhancedDashboardPage() {
  const router = useRouter();
  const { user: sessionUser, isLoading: authLoading, isAuthenticated } = useSession();
  const user = sessionUser as DashboardUser | undefined;
  const { hasPermission } = useRBAC();
  const { features } = useAppConfig();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const dashboardUser = (() => {
    if (user) {
      return {
        id: user.id,
        name: user.full_name || user.email,
        email: user.email ?? "unknown@dotmac",
        role: user.roles?.[0] || "operator",
      };
    }
    return {
      id: "loading",
      name: "Loading User",
      email: "loading@dotmac",
      role: "operator",
    };
  })();

  const hasRadiusAccess = features.enableRadius && hasPermission("isp.radius.read");

  const {
    data: radiusSubscribers,
    isLoading: subscribersLoading,
    refetch: refetchSubscribers,
  } = useRADIUSSubscribers(0, 100, {
    enabled: hasRadiusAccess,
  });
  const {
    data: activeSessions,
    isLoading: sessionsLoading,
    refetch: refetchSessions,
  } = useRADIUSSessions(0, 100, {
    enabled: hasRadiusAccess,
  });
  const {
    data: serviceStats,
    isLoading: serviceStatsLoading,
    refetch: refetchServices,
  } = useServiceStatistics({});

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchSubscribers?.(), refetchSessions?.(), refetchServices?.()]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const totalSubscribers = radiusSubscribers?.data?.length ?? 0;
  const activeSubscribers = radiusSubscribers?.data?.filter((s) => s.enabled).length ?? 0;
  const activeSessionsCount = activeSessions?.data?.length ?? 0;
  const provisioningCount = serviceStats?.provisioning_count ?? 0;
  const activeServices = serviceStats?.active_count ?? 0;

  // Calculate metrics
  const subscriberActiveRate =
    totalSubscribers > 0 ? ((activeSubscribers / totalSubscribers) * 100).toFixed(1) : 0;
  const sessionRate =
    activeSubscribers > 0 ? ((activeSessionsCount / activeSubscribers) * 100).toFixed(1) : 0;

  // KPI Data
  const kpis: KPIItem[] = [
    {
      id: "total-subscribers",
      title: "Total Subscribers",
      value: totalSubscribers,
      icon: ({ className }: IconRendererProps) => <Users className={className} />,
      format: "number",
      trend: {
        direction: "up",
        percentage: 12.5,
        label: "vs last month",
      },
      status: {
        type: "success",
        label: "Healthy",
      },
      onClick: () => router.push("/dashboard/subscribers"),
    },
    {
      id: "active-sessions",
      title: "Active Sessions",
      value: activeSessionsCount,
      icon: ({ className }: IconRendererProps) => <Wifi className={className} />,
      format: "number",
      progress: {
        current: activeSessionsCount,
        target: activeSubscribers,
        label: `${sessionRate}% online`,
        showPercentage: true,
      },
      status: {
        type: Number(sessionRate) > 80 ? "success" : "warning",
      },
      onClick: () => router.push("/dashboard/radius/sessions"),
    },
    {
      id: "active-services",
      title: "Active Services",
      value: activeServices,
      icon: ({ className }: IconRendererProps) => <Server className={className} />,
      format: "number",
      subtitle: `${provisioningCount} provisioning`,
      trend: {
        direction: provisioningCount > 0 ? "up" : "flat",
        percentage: 5.2,
      },
      status: {
        type: "info",
      },
    },
    {
      id: "subscriber-rate",
      title: "Subscriber Active Rate",
      value: `${subscriberActiveRate}%`,
      icon: ({ className }: IconRendererProps) => <Activity className={className} />,
      progress: {
        current: activeSubscribers,
        target: totalSubscribers,
        showPercentage: true,
      },
      status: {
        type:
          Number(subscriberActiveRate) > 90
            ? "success"
            : Number(subscriberActiveRate) > 70
              ? "warning"
              : "error",
      },
    },
  ];

  // Recent Activity
  const activities: ActivityItem[] = [
    {
      id: "1",
      type: "success",
      title: "New Subscriber Activated",
      description: "subscriber_12345 has been provisioned and activated",
      timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      user: {
        id: "system",
        name: "System",
      },
    },
    {
      id: "2",
      type: "info",
      title: "RADIUS Session Started",
      description: "New PPPoE session from 192.168.1.100",
      timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    },
    {
      id: "3",
      type: "system_event",
      title: "Service Provisioning",
      description: "Fiber service provisioning in progress",
      timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    },
    {
      id: "4",
      type: "warning",
      title: "High Bandwidth Usage",
      description: "Network utilization above 85%",
      timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    },
    {
      id: "5",
      type: "info",
      title: "Session Terminated",
      description: "subscriber_67890 disconnected after 8 hours",
      timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    },
  ];

  const dashboardActions = [
    {
      id: "add-subscriber",
      label: "Add Subscriber",
      icon: Users,
      onClick: () => router.push("/dashboard/radius/subscribers/new"),
      variant: "primary" as const,
    },
    {
      id: "view-sessions",
      label: "View Sessions",
      icon: Wifi,
      onClick: () => router.push("/dashboard/radius/sessions"),
      variant: "secondary" as const,
    },
  ];

  const isLoading = subscribersLoading || sessionsLoading || serviceStatsLoading;

  return (
    <UniversalDashboard
      variant="admin"
      user={dashboardUser}
      title="ISP Operations Dashboard"
      subtitle="Real-time overview of your network operations"
      actions={dashboardActions as any}
      isLoading={isLoading}
      onRefresh={handleRefresh}
      maxWidth="7xl"
      padding="md"
      spacing="normal"
      showGradientHeader={true}
      showUserInfo={true}
    >
      <div className="space-y-8">
        {/* KPI Section */}
        <UniversalKPISection
          title="Key Metrics"
          subtitle="Live performance indicators"
          kpis={kpis as any}
          columns={4}
          responsiveColumns={{ sm: 1, md: 2, lg: 4 }}
          gap="normal"
          cardSize="md"
          cardVariant="default"
          loading={isLoading}
          staggerChildren={true}
        />

        {/* Activity Feed */}
        <UniversalActivityFeed
          title="Recent Activity"
          activities={activities}
          maxItems={10}
          variant="default"
        />
      </div>
    </UniversalDashboard>
  );
}
