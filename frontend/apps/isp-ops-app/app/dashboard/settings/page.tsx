"use client";

import { useEffect, useMemo, useState } from "react";
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
import { RouteGuard } from "@/components/auth/PermissionGuard";
import { useSession } from "@shared/lib/auth";
import type { UserInfo } from "@shared/lib/auth";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";

type DisplayUser = Pick<UserInfo, "email" | "username" | "full_name" | "tenant_id">;

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
    id: "branding",
    title: "Branding & Links",
    description: "Customize logos, colors, and customer-facing support links",
    icon: Palette,
    href: "/dashboard/settings/branding",
  },
  {
    id: "billing",
    title: "Billing Preferences",
    description: "Payment methods, billing address, and invoice settings",
    icon: CreditCard,
    href: "/dashboard/settings/billing",
    badge: "Payment due",
  },
  {
    id: "notifications",
    title: "Notifications",
    description: "Email alerts, push notifications, and communication preferences",
    icon: Bell,
    href: "/dashboard/settings/notifications",
  },
  {
    id: "security",
    title: "Security",
    description: "Password, two-factor authentication, and security settings",
    icon: Shield,
    href: "/dashboard/settings/security",
    status: "warning",
    badge: "MFA disabled",
  },
  {
    id: "integrations",
    title: "Integrations",
    description: "Connect with third-party services and APIs",
    icon: Package,
    href: "/dashboard/settings/integrations",
  },
  {
    id: "oss",
    title: "OSS Configuration",
    description: "Configure NetBox, GenieACS, VOLTHA, and Ansible integrations",
    icon: Database,
    href: "/dashboard/settings/oss",
    status: "info",
    badge: "NetBox, GenieACS",
  },
  {
    id: "api-tokens",
    title: "API Tokens",
    description: "Manage personal API access tokens for programmatic access",
    icon: Key,
    href: "/dashboard/settings/tokens",
  },
  {
    id: "plugins",
    title: "Plugins",
    description: "Manage ISP-specific plugins and extensions",
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
        card["status"] ? statusColors[card.status] : "border-border bg-card hover:bg-accent/50"
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
            <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          {card.badge && (
            <span
              className={`inline-block mt-3 px-2 py-1 text-xs font-medium rounded-full ${
                card["status"] ? badgeColors[card.status] : "bg-muted text-muted-foreground"
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
  const { user: sessionUser, isLoading: authLoading } = useSession();
  const user = sessionUser as DisplayUser | undefined;
  const [tenantStats, setTenantStats] = useState<TenantStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    if (!user?.tenant_id) {
      return;
    }

    let isMounted = true;

    const fetchTenantStats = async () => {
      try {
        setStatsLoading(true);
        const response = await apiClient
          .get<TenantStats>(`/tenants/${user.tenant_id}/stats`)
          .catch(() => ({ data: null as TenantStats | null }));

        if (isMounted && response.data) {
          setTenantStats(response.data);
        }
      } catch (err) {
        logger.error("Failed to fetch tenant stats", toError(err));
      } finally {
        if (isMounted) {
          setStatsLoading(false);
        }
      }
    };

    void fetchTenantStats();

    return () => {
      isMounted = false;
    };
  }, [user?.tenant_id]);

  const quickStats: QuickStat[] = useMemo(() => {
    return [
      {
        label: "Active Users",
        value: tenantStats ? `${tenantStats.active_users}/${tenantStats.total_users}` : "—",
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
          Loading settings…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <SettingsIcon className="h-8 w-8 text-sky-400" />
            <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          </div>
          <p className="text-muted-foreground">
            Manage your account, organization, and platform preferences
          </p>
        </div>

        {/* Quick Stats */}
        <QuickStats stats={quickStats} />

        {/* User Info Banner */}
        {user && (
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-foreground font-semibold text-lg">
                  {(user.username as string)?.charAt(0).toUpperCase() || "U"}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {(user.full_name || user.username) as string}
                  </h2>
                  <p className="text-sm text-muted-foreground">{user.email as string}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Organization: {user.tenant_id || "Personal"} • Plan:{" "}
                    {tenantStats?.plan_type || "—"} • Users: {tenantStats?.total_users ?? "—"}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Link
                  href="/dashboard/settings/profile"
                  className="px-4 py-2 bg-accent hover:bg-muted text-foreground rounded-lg text-sm font-medium transition-colors"
                >
                  Edit Profile
                </Link>
                <Link
                  href="/dashboard/settings/security"
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Security Settings
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Settings Categories */}
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-4">Configuration Areas</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {settingCards.map((card) => (
              <SettingCard key={card.id} card={card} />
            ))}
          </div>
        </div>

        {/* Quick Links */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              href="/dashboard/settings/security"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-sky-400 transition-colors"
            >
              <Lock className="h-4 w-4" />
              Change Password
            </Link>
            <Link
              href="/dashboard/settings/security"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-sky-400 transition-colors"
            >
              <Shield className="h-4 w-4" />
              Enable 2FA
            </Link>
            <Link
              href="/dashboard/settings/oss"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-sky-400 transition-colors"
            >
              <Database className="h-4 w-4" />
              Configure OSS
            </Link>
            <Link
              href="/dashboard/settings/billing"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-sky-400 transition-colors"
            >
              <CreditCard className="h-4 w-4" />
              Update Payment
            </Link>
          </div>
        </div>

        {/* Help Section */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-lg font-semibold text-foreground mb-2">Need Help?</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Check out our documentation or contact support for assistance with your settings.
          </p>
          <div className="flex gap-3">
            <Link
              href="/docs/settings"
              className="px-4 py-2 bg-accent hover:bg-muted text-foreground rounded-lg text-sm font-medium transition-colors"
            >
              <FileText className="inline h-4 w-4 mr-2" />
              Documentation
            </Link>
            <Link
              href="/support"
              className="px-4 py-2 border border-border hover:bg-accent text-foreground rounded-lg text-sm font-medium transition-colors"
            >
              <Mail className="inline h-4 w-4 mr-2" />
              Contact Support
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SettingsHubPage() {
  return (
    <RouteGuard permission="settings.read">
      <SettingsHubPageContent />
    </RouteGuard>
  );
}
