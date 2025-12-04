"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PropsWithChildren, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  Building2,
  LayoutDashboard,
  Search,
  Settings,
  Shield,
  type LucideIcon,
} from "lucide-react";

import { RouteGuard } from "@/components/auth/PermissionGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Alert, AlertDescription } from "@dotmac/ui";
import { cn } from "@/lib/utils";
import {
  platformAdminService,
  type PlatformAdminHealth,
} from "@/lib/services/platform-admin-service";

type NavSection = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

const NAV_SECTIONS: NavSection[] = [
  {
    href: "/dashboard/platform-admin",
    label: "Dashboard & Stats",
    description: "Monitor platform health and key metrics",
    icon: LayoutDashboard,
  },
  {
    href: "/dashboard/platform-admin/tenants",
    label: "Tenant Administration",
    description: "Manage tenants, status, and impersonation",
    icon: Building2,
  },
  {
    href: "/dashboard/platform-admin/search",
    label: "Cross-Tenant Search",
    description: "Find users and resources across tenants",
    icon: Search,
  },
  {
    href: "/dashboard/platform-admin/audit",
    label: "Audit Activity",
    description: "Review privileged administrator activity",
    icon: Shield,
  },
  {
    href: "/dashboard/platform-admin/system",
    label: "System Configuration",
    description: "Feature flags and platform-wide settings",
    icon: Settings,
  },
];

export default function PlatformAdminLayout({ children }: PropsWithChildren) {
  return (
    <RouteGuard permission="platform:admin">
      <PlatformAdminLayoutContent>{children}</PlatformAdminLayoutContent>
    </RouteGuard>
  );
}

function PlatformAdminLayoutContent({ children }: PropsWithChildren) {
  const [health, setHealth] = useState<PlatformAdminHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    let mounted = true;

    const loadHealth = async () => {
      try {
        const data = await platformAdminService.getHealth();
        if (!mounted) return;
        setHealth(data);
      } catch (err) {
        if (!mounted) return;
        const message =
          err instanceof Error ? err.message : "Failed to verify platform admin access.";
        setError(message);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadHealth().catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  const activeHref = useMemo(() => {
    if (!pathname) {
      return "/dashboard/platform-admin";
    }

    const matched = NAV_SECTIONS.find(
      (section) => pathname === section.href || pathname.startsWith(`${section.href}/`),
    );

    return matched ? matched.href : "/dashboard/platform-admin";
  }, [pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Activity className="mx-auto mb-4 h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Verifying platform admin access...</p>
        </div>
      </div>
    );
  }

  if (error || !health) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error ?? "Platform admin access not available"}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const statusLabel = health.status || "Unknown";
  const normalizedStatus = statusLabel.toLowerCase();
  const statusIndicatorClass =
    normalizedStatus.includes("ok") || normalizedStatus.includes("healthy")
      ? "bg-green-500 dark:bg-green-400"
      : "bg-amber-500 dark:bg-amber-400";

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <Shield className="h-8 w-8" />
            Platform Administration
          </h1>
          <p className="mt-1 text-muted-foreground">
            Cross-tenant system management and monitoring
          </p>
        </div>
        <Badge variant="outline" className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", statusIndicatorClass)} />
          {statusLabel}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Admin Session</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">User ID</p>
              <p className="font-mono text-sm">{health.user_id}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Admin Status</p>
              <Badge variant={health.is_platform_admin ? "default" : "secondary"}>
                {health.is_platform_admin ? "Platform Admin" : "Limited Access"}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Permissions</p>
              <p className="text-sm">{health.permissions.length} active</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <nav
        className="flex gap-2 overflow-x-auto rounded-lg border border-border bg-card p-2 lg:hidden"
        aria-label="Platform admin navigation"
      >
        {NAV_SECTIONS.map((section) => {
          const isActive = activeHref === section.href;
          const Icon = section.icon;
          return (
            <Link
              key={section.href}
              href={section.href}
              className={cn(
                "flex min-w-[180px] flex-1 items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                isActive
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-transparent text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span>{section.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside>
          <div className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Administrative modules
            </p>
            <div className="space-y-2">
              {NAV_SECTIONS.map((section) => {
                const isActive = activeHref === section.href;
                const Icon = section.icon;
                return (
                  <Link
                    key={section.href}
                    href={section.href}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors",
                      isActive
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-transparent text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <Icon className="mt-0.5 h-5 w-5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold">{section.label}</p>
                      <p className="text-xs text-muted-foreground">{section.description}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </aside>

        <main className="space-y-6">{children}</main>
      </div>
    </div>
  );
}
