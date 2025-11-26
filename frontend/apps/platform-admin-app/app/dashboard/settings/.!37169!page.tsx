"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  User,
  Users,
  CreditCard,
  Mail,
  Lock,
  Bell,
  Shield,
  Globe,
  Palette,
  Database,
  Key,
  Package,
  Building,
  ArrowUpRight,
  Settings as SettingsIcon,
  Sliders,
  FileText,
  Zap,
  Cloud,
  Smartphone,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import { logger } from "@/lib/logger";
import { useSession } from "@dotmac/better-auth";
import type { ExtendedUser } from "@dotmac/better-auth";

type DisplayUser = Pick<ExtendedUser, "email" | "username" | "full_name" | "tenant_id">;

const toError = (error: unknown) =>
  error instanceof Error ? error : new Error(typeof error === "string" ? error : String(error));

interface SettingCard {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  status?: "active" | "warning" | "info";
  badge?: string;
}

const settingCards: SettingCard[] = [
  {
    id: "profile",
    title: "Profile",
    description: "Manage your personal information and account details",
    icon: User,
    href: "/dashboard/settings/profile",
    status: "active",
  },
  {
    id: "organization",
    title: "Organization",
    description: "Company information, team management, and roles",
    icon: Building,
    href: "/dashboard/settings/organization",
  },
  {
    id: "security",
    title: "Security",
    description: "Password, two-factor authentication, and security settings",
    icon: Shield,
    href: "/dashboard/settings/security",
  },
  {
    id: "oss",
    title: "Infrastructure (OSS)",
    description: "Configure NetBox for infrastructure and data center management",
    icon: Database,
    href: "/dashboard/settings/oss",
    status: "info",
    badge: "NetBox",
  },
  {
    id: "billing",
    title: "Billing Preferences",
    description: "Payment methods, billing address, and invoice settings",
    icon: CreditCard,
    href: "/dashboard/settings/billing",
  },
  {
    id: "notifications",
    title: "Notifications",
    description: "Email alerts, push notifications, and communication preferences",
    icon: Bell,
    href: "/dashboard/settings/notifications",
  },
  {
    id: "branding",
    title: "Branding & Links",
    description: "Customize company identity, support contacts, and portal URLs",
    icon: Palette,
    href: "/dashboard/platform-admin/system?tab=settings&category=branding",
  },
  {
    id: "integrations",
    title: "Integrations",
    description: "Connect with third-party services and APIs",
    icon: Package,
    href: "/dashboard/settings/integrations",
  },
  {
    id: "plugins",
    title: "Plugins",
    description: "Manage platform plugins and extensions",
    icon: Package,
    href: "/dashboard/settings/plugins",
  },
];

interface QuickStat {
  label: string;
  value: string | number;
  icon: React.ElementType;
  trend?: "up" | "down" | "stable";
}

function QuickStats({ stats }: { stats: QuickStat[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <div key={index} className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{stat.value}</p>
            </div>
            <div className="p-2 bg-accent rounded-lg">
              <stat.icon className="h-5 w-5 text-sky-400" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SettingCard({ card }: { card: SettingCard }) {
  const statusColors = {
    active: "border-green-900/20 bg-green-950/10",
    warning: "border-orange-900/20 bg-orange-950/10",
    info: "border-blue-900/20 bg-blue-950/10",
  };

  const badgeColors = {
    active: "bg-green-500/20 text-green-400",
    warning: "bg-orange-500/20 text-orange-400",
    info: "bg-blue-500/20 text-blue-400",
  };

  return (
    <Link
      href={card.href}
      className={`group relative rounded-lg border p-6 hover:border-border transition-all ${
        card['status']? statusColors[card.status] : "border-border bg-card hover:bg-accent/50"
      }`}
    >
      <div className="flex items-start gap-4">
        <div className="p-3 bg-accent rounded-lg group-hover:bg-muted transition-colors">
          <card.icon className="h-6 w-6 text-sky-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-foreground group-hover:text-sky-400 transition-colors">
                {card.title}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">{card.description}</p>
            </div>
            <ArrowUpRight className="h-4 w-4 text-foreground0 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          {card.badge && (
            <span
              className={`inline-block mt-3 px-2 py-1 text-xs font-medium rounded-full ${
                card['status']? badgeColors[card.status] : "bg-muted text-muted-foreground"
              }`}
            >
              {card.badge}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

interface TenantStats {
  tenant_id: string;
  total_users: number;
  active_users: number;
  total_api_calls: number;
  total_storage_gb: number;
  total_bandwidth_gb: number;
  user_limit: number;
  api_limit: number;
  storage_limit: number;
  user_usage_percent: number;
  api_usage_percent: number;
  storage_usage_percent: number;
  plan_type: string;
  status: string;
  days_until_expiry?: number | null;
}

function SettingsHubPageContent() {
  const { data: session, isPending: authLoading } = useSession();
  const user = session?.user as DisplayUser | undefined;
  const [tenantStats, setTenantStats] = useState<TenantStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    if (!user?.tenant_id) {
      return;
    }

    let isMounted = true;

    const fetchSettingsData = async () => {
      try {
        setStatsLoading(true);
        const response = await apiClient
          .get<TenantStats>(`/tenants/${user.tenant_id}/stats`)
          .catch(() => ({ data: null as TenantStats | null }));

        if (isMounted && response.data) {
          setTenantStats(response.data);
        }
      } catch (err) {
        logger.error("Failed to fetch settings data", toError(err));
      } finally {
        if (isMounted) {
          setStatsLoading(false);
        }
      }
    };

    void fetchSettingsData();

    return () => {
      isMounted = false;
    };
  }, [user?.tenant_id]);

  const quickStats: QuickStat[] = useMemo(() => {
    return [
      {
        label: "Active Users",
        value: tenantStats
          ? `${tenantStats.active_users}/${tenantStats.total_users}`
          : "—",
        icon: Users,
      },
      {
        label: "API Calls",
        value: tenantStats ? tenantStats.total_api_calls.toLocaleString() : "—",
        icon: Zap,
      },
      {
        label: "Storage Used",
        value: tenantStats
          ? `${tenantStats.total_storage_gb.toFixed(1)} GB / ${tenantStats.storage_limit} GB`
          : "—",
        icon: Cloud,
      },
      {
        label: "Plan",
        value: tenantStats?.plan_type ?? "—",
        icon: Smartphone,
      },
    ];
  }, [tenantStats]);

  if (authLoading && statsLoading) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-7xl mx-auto flex items-center justify-center py-24 text-muted-foreground">
