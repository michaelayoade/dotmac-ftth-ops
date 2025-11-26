"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
  Skeleton,
} from "@dotmac/ui";
import {
  Building2,
  Flag,
  ShieldCheck,
  Server,
  BarChart3,
  Compass,
} from "lucide-react";

import { PlatformStatsOverview } from "./platform-admin/components/PlatformStatsOverview";
import { usePlatformTenants } from "@/hooks/usePlatformTenants";
import type { TenantDetails } from "@/lib/services/platform-admin-tenant-service";
import { useRecentActivities } from "@/hooks/useAudit";
import {
  formatActivityType,
  formatSeverity,
  SEVERITY_COLORS,
  type AuditActivity,
} from "@/types/audit";
import { useSystemHealth, type SystemHealth } from "@/hooks/useOperations";
import { ROUTES } from "@/lib/routes";
import { useSession } from "@dotmac/better-auth";
import type { ExtendedUser } from "@dotmac/better-auth";

type DisplayUser = Pick<ExtendedUser, "email" | "roles">;

const TENANT_STATUS_LABELS: Record<TenantDetails["status"], string> = {
  active: "Active",
  suspended: "Suspended",
  disabled: "Disabled",
};

const TENANT_STATUS_CLASSES: Record<TenantDetails["status"], string> = {
  active: "border-emerald-500/20 bg-emerald-500/10 text-emerald-500",
  suspended: "border-amber-500/20 bg-amber-500/10 text-amber-500",
  disabled: "border-red-500/20 bg-red-500/10 text-red-500",
};

const QUICK_LINKS = [
  {
    title: "Manage Tenants",
    description: "Onboard, suspend, or impersonate tenants across the platform.",
    href: "/dashboard/platform-admin/tenants",
    icon: Building2,
  },
  {
    title: "Feature Flags",
    description: "Roll out functionality safely with platform-wide flags.",
    href: "/dashboard/feature-flags",
    icon: Flag,
  },
  {
    title: "System Settings",
    description: "Review security, authentication, and environment toggles.",
    href: "/dashboard/platform-admin/system",
    icon: ShieldCheck,
  },
  {
    title: "Licensing",
    description: "Audit tenant plans and subscription compliance.",
    href: "/dashboard/platform-admin/licensing",
    icon: BarChart3,
  },
  {
    title: "Audit Trail",
    description: "Investigate recent administrative actions and changes.",
    href: "/dashboard/platform-admin/audit",
    icon: Compass,
  },
  {
    title: "Observability",
    description: "Inspect platform infrastructure and telemetry health.",
    href: "/dashboard/infrastructure/observability",
    icon: Server,
  },
];

export default function PlatformAdminDashboardPage() {
  const router = useRouter();
  const { data: session, isPending: authLoading } = useSession();
  const user = session?.user as DisplayUser | undefined;

  const { data: tenantData, isLoading: tenantsLoading } = usePlatformTenants({
    page: 1,
    limit: 5,
  });
  const { data: recentActivities, isLoading: auditLoading } = useRecentActivities(6, 14);
  const { data: systemHealth, isLoading: systemLoading } = useSystemHealth();

  useEffect(() => {
    if (!authLoading && !session) {
      router.replace(ROUTES.LOGIN);
    }
  }, [authLoading, session, router]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading platform administration overview…</div>
      </div>
    );
  }

  const tenants = tenantData?.tenants ?? [];
  const totalTenants = tenantData?.total ?? tenants.length;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="bg-card/50 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col gap-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Platform Administration Overview</h1>
              <p className="text-sm text-muted-foreground">
                Monitor tenants, platform services, and operational health from a single view.
              </p>
            </div>
            {user && (
              <div className="text-sm text-muted-foreground hidden sm:block">
                <div className="font-medium text-foreground">{user.email}</div>
                <div>{user.roles?.join(", ") || "Platform Admin"}</div>
              </div>
            )}
          </div>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <PlatformStatsOverview />

        <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
          <TopTenantsCard
            tenants={tenants}
            totalTenants={totalTenants}
            isLoading={tenantsLoading}
          />
          <OperationsQuickLinks />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <RecentActivityCard activities={recentActivities ?? []} isLoading={auditLoading} />
          <SystemHealthCard systemHealth={systemHealth} isLoading={systemLoading} />
        </div>
      </section>
    </main>
  );
}

function TopTenantsCard({
  tenants,
  totalTenants,
  isLoading,
}: {
  tenants: TenantDetails[];
  totalTenants: number;
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Tenant Snapshot</CardTitle>
          <CardDescription>Most active tenants across the platform</CardDescription>
        </div>
        <Badge variant="outline">{totalTenants} tenants</Badge>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : tenants.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No tenants found. Create your first tenant to start onboarding customers.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead className="text-right">Users</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{tenant.name}</span>
                      <span className="text-xs text-muted-foreground">{tenant.slug}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`border ${TENANT_STATUS_CLASSES[tenant.status]}`} variant="outline">
                      {TENANT_STATUS_LABELS[tenant.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="capitalize">
                    {tenant.subscription?.plan
                      ? tenant.subscription.plan.replace(/_/g, " ")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {tenant.usage?.users ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <div className="mt-4 flex justify-end">
          <Link
            href="/dashboard/platform-admin/tenants"
            className="text-sm font-medium text-sky-400 hover:text-sky-300"
          >
