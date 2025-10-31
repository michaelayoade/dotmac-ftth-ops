"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SkipLink } from "@/components/ui/skip-link";
import {
  Home,
  Settings,
  Users,
  UserCheck,
  Shield,
  Database,
  Activity,
  Mail,
  Search,
  FileText,
  ToggleLeft,
  Menu,
  X,
  LogOut,
  User,
  ChevronDown,
  ChevronRight,
  Key,
  Webhook,
  CreditCard,
  Repeat,
  Package,
  DollarSign,
  Server,
  Lock,
  BarChart3,
  Building2,
  Handshake,
  LifeBuoy,
  LayoutDashboard,
  Wifi,
  MapPin,
  Network as NetworkIcon,
  AlertTriangle,
  Cable,
  Bell,
  Calendar,
  Router as RouterIcon,
  Plus,
  Zap,
  FileCode,
  ArrowLeftRight,
  ShoppingCart,
  Briefcase,
  Ticket,
  Plug,
  GitBranch,
  Puzzle,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";
import { Can } from "@/components/auth/PermissionGuard";
import { useRBAC } from "@/contexts/RBACContext";
import { useBranding } from "@/hooks/useBranding";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { ConnectionStatusIndicator } from "@/components/realtime/ConnectionStatusIndicator";
import { RealtimeAlerts } from "@/components/realtime/RealtimeAlerts";
import { GlobalCommandPalette } from "@/components/global-command-palette";
import { getPortalType, portalAllows, type PortalType } from "@/lib/portal";

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  permission?: string;
  portals?: PortalType[];
}

interface NavSection {
  id: string;
  label: string;
  icon: React.ElementType;
  href: string;
  items?: NavItem[];
  permission?: string | string[];
  portals?: PortalType[];
}

const sections: NavSection[] = [
  {
    id: "noc",
    label: "NOC Dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
  },
  {
    id: "subscribers",
    label: "Subscribers",
    icon: Users,
    href: "/dashboard/subscribers",
    permission: "isp.radius.read",
    items: [
      {
        name: "Overview",
        href: "/dashboard/subscribers",
        icon: LayoutDashboard,
        permission: "isp.radius.read",
      },
    ],
  },
  {
    id: "radius",
    label: "RADIUS",
    icon: Shield,
    href: "/dashboard/radius",
    permission: "isp.radius.read",
    items: [
      {
        name: "Overview",
        href: "/dashboard/radius",
        icon: LayoutDashboard,
        permission: "isp.radius.read",
      },
      {
        name: "Subscribers",
        href: "/dashboard/radius/subscribers",
        icon: Users,
        permission: "isp.radius.read",
      },
      {
        name: "Active Sessions",
        href: "/dashboard/radius/sessions",
        icon: Activity,
        permission: "isp.radius.read",
      },
      {
        name: "NAS Devices",
        href: "/dashboard/radius/nas",
        icon: Server,
        permission: "isp.radius.read",
      },
    ],
  },
  {
    id: "devices",
    label: "Devices",
    icon: RouterIcon,
    href: "/dashboard/devices",
    permission: "devices.read",
    items: [
      { name: "All Devices", href: "/dashboard/devices", icon: RouterIcon },
      { name: "Provision", href: "/dashboard/devices/provision", icon: Plus },
      { name: "Presets", href: "/dashboard/devices/presets", icon: Settings },
    ],
  },
  {
    id: "diagnostics",
    label: "Diagnostics",
    icon: Activity,
    href: "/dashboard/diagnostics",
    permission: "diagnostics.read",
    items: [
      { name: "History", href: "/dashboard/diagnostics", icon: Activity },
    ],
  },
  {
    id: "pon",
    label: "PON Network",
    icon: Zap,
    href: "/dashboard/pon/olts",
    permission: "isp.network.pon.read",
    items: [
      { name: "OLTs", href: "/dashboard/pon/olts", icon: Server },
      { name: "ONUs", href: "/dashboard/pon/onus", icon: Wifi },
      { name: "Discover ONUs", href: "/dashboard/pon/onus/discover", icon: Search },
    ],
  },
  {
    id: "network",
    label: "Network",
    icon: Server,
    href: "/dashboard/network",
    permission: "isp.ipam.read",
    items: [
      {
        name: "Inventory",
        href: "/dashboard/network",
        icon: Database,
        permission: "isp.ipam.read",
      },
      {
        name: "Fiber Infrastructure",
        href: "/dashboard/network/fiber",
        icon: Cable,
        permission: "isp.ipam.read",
      },
      {
        name: "Monitoring",
        href: "/dashboard/network-monitoring",
        icon: Activity,
      },
      {
        name: "Faults",
        href: "/dashboard/network/faults",
        icon: AlertTriangle,
        permission: "faults.alarms.read",
      },
      {
        name: "IPAM",
        href: "/dashboard/ipam",
        icon: NetworkIcon,
        permission: "isp.ipam.read",
      },
      {
        name: "DCIM",
        href: "/dashboard/dcim",
        icon: MapPin,
        permission: "isp.ipam.read",
      },
    ],
  },
  {
    id: "wireless",
    label: "Wireless",
    icon: Wifi,
    href: "/dashboard/wireless",
    items: [{ name: "Overview", href: "/dashboard/wireless", icon: LayoutDashboard }],
  },
  {
    id: "automation",
    label: "Automation",
    icon: Repeat,
    href: "/dashboard/automation",
    permission: "deployment.template.read",
    items: [
      {
        name: "Overview",
        href: "/dashboard/automation",
        icon: LayoutDashboard,
      },
      {
        name: "Templates",
        href: "/dashboard/automation/templates",
        icon: FileCode,
        permission: "deployment.template.read",
      },
      {
        name: "Instances",
        href: "/dashboard/automation/instances",
        icon: Server,
        permission: "deployment.instance.read",
      },
    ],
  },
  {
    id: "workflows",
    label: "Workflows",
    icon: GitBranch,
    href: "/dashboard/workflows",
    permission: "workflows:read",
    items: [
      {
        name: "All Workflows",
        href: "/dashboard/workflows",
        icon: LayoutDashboard,
        permission: "workflows:read",
      },
    ],
  },
  {
    id: "data-transfer",
    label: "Data Transfer",
    icon: ArrowLeftRight,
    href: "/dashboard/data-transfer",
    permission: "admin",
    portals: ["admin"],
    items: [
      {
        name: "Import/Export",
        href: "/dashboard/data-transfer",
        icon: Database,
        permission: "admin",
      },
    ],
  },
  {
    id: "jobs",
    label: "Background Jobs",
    icon: Briefcase,
    href: "/dashboard/jobs",
    permission: "jobs:read",
    portals: ["admin"],
    items: [
      {
        name: "All Jobs",
        href: "/dashboard/jobs",
        icon: LayoutDashboard,
        permission: "jobs:read",
      },
    ],
  },
  {
    id: "services",
    label: "Services",
    icon: Package,
    href: "/dashboard/services/internet-plans",
    permission: "isp.plans.read",
    items: [
      {
        name: "Internet Plans",
        href: "/dashboard/services/internet-plans",
        icon: Wifi,
        permission: "isp.plans.read",
      },
    ],
  },
  {
    id: "sales",
    label: "Sales Orders",
    icon: ShoppingCart,
    href: "/dashboard/sales",
    permission: "order.read",
    items: [
      {
        name: "All Orders",
        href: "/dashboard/sales",
        icon: LayoutDashboard,
        permission: "order.read",
      },
    ],
  },
  {
    id: "ticketing",
    label: "Support Tickets",
    icon: Ticket,
    href: "/dashboard/ticketing",
    permission: "tickets:read",
    items: [
      {
        name: "All Tickets",
        href: "/dashboard/ticketing",
        icon: LayoutDashboard,
        permission: "tickets:read",
      },
    ],
  },
  {
    id: "orchestration",
    label: "Orchestration",
    icon: Activity,
    href: "/dashboard/orchestration",
    items: [
      {
        name: "Workflow Monitor",
        href: "/dashboard/orchestration",
        icon: Activity,
      },
      {
        name: "Workflow History",
        href: "/dashboard/orchestration/history",
        icon: FileText,
      },
      {
        name: "Analytics",
        href: "/dashboard/orchestration/analytics",
        icon: BarChart3,
      },
      {
        name: "Schedule Deployment",
        href: "/dashboard/orchestration/schedule",
        icon: Calendar,
        permission: "deployment.schedule.create",
      },
    ],
  },
  {
    id: "support",
    label: "Support",
    icon: LifeBuoy,
    href: "/dashboard/support",
    items: [
      { name: "Tickets", href: "/dashboard/support", icon: LifeBuoy },
      { name: "New Ticket", href: "/dashboard/support/new", icon: FileText },
    ],
  },
  {
    id: "crm",
    label: "Sales CRM",
    icon: Handshake,
    href: "/dashboard/crm",
    permission: ["customers.read"],
    items: [
      {
        name: "Overview",
        href: "/dashboard/crm",
        icon: LayoutDashboard,
        permission: "customers.read",
      },
      {
        name: "Contacts",
        href: "/dashboard/crm/contacts",
        icon: Users,
        permission: "contacts.read",
      },
      {
        name: "Leads",
        href: "/dashboard/crm/leads",
        icon: Users,
        permission: "customers.read",
      },
      {
        name: "Quotes",
        href: "/dashboard/crm/quotes",
        icon: FileText,
        permission: "customers.read",
      },
      {
        name: "Site Surveys",
        href: "/dashboard/crm/site-surveys",
        icon: Activity,
        permission: "customers.read",
      },
    ],
  },
  {
    id: "business-support",
    label: "Business Operations",
    icon: DollarSign,
    href: "/dashboard/billing-revenue",
    permission: "billing.read",
    items: [
      {
        name: "Revenue Overview",
        href: "/dashboard/billing-revenue",
        icon: BarChart3,
        permission: "billing.read",
      },
      {
        name: "Invoices",
        href: "/dashboard/billing-revenue/invoices",
        icon: FileText,
        permission: "billing.read",
      },
      {
        name: "Subscriptions",
        href: "/dashboard/billing-revenue/subscriptions",
        icon: Repeat,
        permission: "billing.read",
      },
      {
        name: "Payments",
        href: "/dashboard/billing-revenue/payments",
        icon: CreditCard,
        permission: "billing.read",
      },
      {
        name: "Plans",
        href: "/dashboard/billing-revenue/plans",
        icon: Package,
        permission: "billing.read",
      },
    ],
  },
  {
    id: "licensing",
    label: "Licensing",
    icon: Key,
    href: "/dashboard/licensing",
    permission: "admin",
    items: [
      {
        name: "All Licenses",
        href: "/dashboard/licensing",
        icon: LayoutDashboard,
        permission: "admin",
      },
    ],
  },
  {
    id: "integrations",
    label: "Integrations",
    icon: Plug,
    href: "/dashboard/integrations",
    permission: "admin",
    portals: ["admin"],
    items: [
      {
        name: "All Integrations",
        href: "/dashboard/integrations",
        icon: LayoutDashboard,
        permission: "admin",
      },
    ],
  },
  {
    id: "plugins",
    label: "Plugins",
    icon: Puzzle,
    href: "/dashboard/plugins",
    permission: "admin",
    portals: ["admin"],
    items: [
      {
        name: "All Plugins",
        href: "/dashboard/plugins",
        icon: LayoutDashboard,
        permission: "admin",
      },
    ],
  },
  {
    id: "feature-flags",
    label: "Feature Flags",
    icon: ToggleLeft,
    href: "/dashboard/feature-flags",
    permission: "admin",
    portals: ["admin"],
    items: [
      {
        name: "All Flags",
        href: "/dashboard/feature-flags",
        icon: LayoutDashboard,
        permission: "admin",
      },
    ],
  },
  {
    id: "audit",
    label: "Audit Logs",
    icon: FileText,
    href: "/dashboard/audit",
    permission: "security.audit.read",
    items: [
      {
        name: "Activity Logs",
        href: "/dashboard/audit",
        icon: LayoutDashboard,
        permission: "security.audit.read",
      },
    ],
  },
  {
    id: "security-access",
    label: "Security & Access",
    icon: Shield,
    href: "/dashboard/security-access",
    portals: ["admin"],
    items: [
      { name: "Overview", href: "/dashboard/security-access", icon: BarChart3 },
      {
        name: "API Keys",
        href: "/dashboard/security-access/api-keys",
        icon: Key,
        permission: "settings.read",
      },
      {
        name: "Secrets",
        href: "/dashboard/security-access/secrets",
        icon: Lock,
        permission: "secrets.read",
      },
      {
        name: "Roles",
        href: "/dashboard/security-access/roles",
        icon: Shield,
        permission: "system.read",
      },
      {
        name: "Users",
        href: "/dashboard/security-access/users",
        icon: Users,
        permission: "users.read",
      },
    ],
  },
  {
    id: "observability",
    label: "Observability & Health",
    icon: Activity,
    href: "/dashboard/infrastructure",
    permission: "infrastructure.read",
    portals: ["admin"],
    items: [
      {
        name: "Overview",
        href: "/dashboard/infrastructure",
        icon: BarChart3,
        permission: "infrastructure.read",
      },
      {
        name: "Health",
        href: "/dashboard/infrastructure/health",
        icon: Activity,
        permission: "infrastructure.read",
      },
      {
        name: "Logs",
        href: "/dashboard/infrastructure/logs",
        icon: FileText,
        permission: "infrastructure.read",
      },
      {
        name: "Observability",
        href: "/dashboard/infrastructure/observability",
        icon: Search,
        permission: "infrastructure.read",
      },
      {
        name: "Feature Flags",
        href: "/dashboard/infrastructure/feature-flags",
        icon: ToggleLeft,
        permission: "infrastructure.read",
      },
    ],
  },
  {
    id: "platform-admin",
    label: "Platform Admin",
    icon: Shield,
    href: "/dashboard/platform-admin",
    permission: "platform:admin",
    portals: ["admin"],
    items: [
      {
        name: "Overview",
        href: "/dashboard/platform-admin",
        icon: LayoutDashboard,
      },
      {
        name: "Tenant Management",
        href: "/dashboard/platform-admin/tenants",
        icon: Building2,
      },
      {
        name: "Cross-Tenant Search",
        href: "/dashboard/platform-admin/search",
        icon: Search,
      },
      {
        name: "Audit Activity",
        href: "/dashboard/platform-admin/audit",
        icon: Activity,
      },
      {
        name: "System Configuration",
        href: "/dashboard/platform-admin/system",
        icon: Settings,
      },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    href: "/dashboard/settings",
    items: [
      { name: "Profile", href: "/dashboard/settings/profile", icon: User },
      {
        name: "Organization",
        href: "/dashboard/settings/organization",
        icon: Users,
        permission: "settings.read",
      },
      {
        name: "Billing",
        href: "/dashboard/settings/billing",
        icon: CreditCard,
        permission: "billing.read",
      },
      {
        name: "Notifications",
        href: "/dashboard/settings/notifications",
        icon: Mail,
        permission: "settings.read",
      },
      {
        name: "Team Notifications",
        href: "/dashboard/notifications/team",
        icon: Bell,
        permission: "notifications.write",
      },
      {
        name: "Integrations",
        href: "/dashboard/settings/integrations",
        icon: Package,
        permission: "settings.read",
      },
    ],
  },
];

// Helper function to check if section should be visible
function checkSectionVisibility(
  section: NavSection,
  hasPermission: (permission: string) => boolean,
  hasAnyPermission: (permissions: string[]) => boolean,
): boolean {
  // If section has explicit permission requirement, check it
  if (section.permission) {
    if (Array.isArray(section.permission)) {
      return hasAnyPermission(section.permission);
    }
    return hasPermission(section.permission);
  }

  // If section has no permission but has items, check if user has access to any item
  if (section.items && section.items.length > 0) {
    return section.items.some((item) => {
      if (!item.permission) return true;
      return hasPermission(item.permission);
    });
  }

  // If no permission requirement and no items, show by default
  return true;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [user, setUser] = useState<Record<string, unknown> | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const pathname = usePathname();
  const { hasPermission, hasAnyPermission } = useRBAC();
  const { branding } = useBranding();
  const portalType = getPortalType();

  // Type helper for user data
  const userData = user as {
    id?: string;
    username?: string;
    email?: string;
    full_name?: string;
    roles?: string[];
  } | null;

  const portalScopedSections = useMemo(
    () =>
      sections
        .filter((section) => portalAllows(section.portals, portalType))
        .map((section) => ({
          ...section,
          items: section.items?.filter((item) => portalAllows(item.portals, portalType)),
        })),
    [portalType],
  );

  // Filter sections based on permissions
  const visibleSections = useMemo(
    () =>
      portalScopedSections.filter((section) =>
        checkSectionVisibility(section, hasPermission, hasAnyPermission),
      ),
    [hasAnyPermission, hasPermission, portalScopedSections],
  );

  // Toggle section expansion
  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  // Auto-expand active section
  useEffect(() => {
    const activeSections = new Set<string>();

    visibleSections.forEach((section) => {
      const hasActiveItem = section.items?.some(
        (item) =>
          pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href)),
      );

      if (hasActiveItem) {
        activeSections.add(section.id);
      }
    });

    if (activeSections.size === 0) {
      return;
    }

    setExpandedSections((prev) => {
      const next = new Set(prev);
      let changed = false;

      activeSections.forEach((sectionId) => {
        if (!next.has(sectionId)) {
          next.add(sectionId);
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [pathname, visibleSections]);

  // Fetch current user
  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    // Skip auth check in E2E test mode
    if (typeof window !== "undefined" && (window as any).__e2e_test__) {
      logger.info("Dashboard: E2E test mode detected, skipping auth check");
      setUser({
        id: "e2e-test-user",
        username: "admin",
        email: "admin@example.com",
        full_name: "Test Admin",
        roles: ["platform_admin"],
      });
      return;
    }

    try {
      logger.debug("Dashboard: Fetching current user");
      const response = await apiClient.get("/auth/me");

      if (response.data) {
        const userData = response.data as Record<string, unknown> & {
          id?: string;
        };
        logger.info("Dashboard: User fetched successfully", {
          userId: userData.id,
        });
        setUser(userData);
      } else {
        logger.warn("Dashboard: Failed to fetch user, redirecting to login", {
          response: response,
        });
        // Token expired or invalid - redirect to login
        window.location.href = "/login";
      }
    } catch (error) {
      logger.error(
        "Dashboard: Error fetching user",
        error instanceof Error ? error : new Error(String(error)),
      );
      // On error, redirect to login
      window.location.href = "/login";
    }
  };

  const handleLogout = async () => {
    try {
      await apiClient.post("/auth/logout");
      window.location.href = "/login";
    } catch (error) {
      logger.error("Logout error", error instanceof Error ? error : new Error(String(error)));
      // Still redirect even if logout fails
      window.location.href = "/login";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SkipLink />
      {/* Top Navigation Bar */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border"
        aria-label="Main navigation"
      >
        <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center">
            <button
              type="button"
              className="lg:hidden -m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-muted-foreground hover:bg-accent min-h-[44px] min-w-[44px]"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle sidebar"
              aria-expanded={sidebarOpen}
            >
              <Menu className="h-6 w-6" aria-hidden="true" />
            </button>
            <div className="flex items-center ml-4 lg:ml-0">
              {branding.logo.light || branding.logo.dark ? (
                <picture>
                  {branding.logo.dark ? (
                    <source srcSet={branding.logo.dark} media="(prefers-color-scheme: dark)" />
                  ) : null}
                  <img
                    src={branding.logo.light || branding.logo.dark || ""}
                    alt={`${branding.productName} logo`}
                    className="h-6 w-auto"
                  />
                </picture>
              ) : (
                <div className="text-xl font-semibold text-foreground">{branding.productName}</div>
              )}
            </div>
          </div>

          {/* Right side - Notifications, Theme toggle and User menu */}
          <div className="flex items-center gap-4">
            <NotificationCenter
              maxNotifications={5}
              refreshInterval={30000}
              viewAllUrl="/dashboard/notifications"
            />
            <ThemeToggle />
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors min-h-[44px]"
                aria-label="User menu"
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
              >
                <User className="h-5 w-5" aria-hidden="true" />
                <span className="hidden sm:block">{userData?.username || "User"}</span>
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-md bg-popover shadow-lg ring-1 ring-border">
                  <div className="py-1">
                    <div className="px-4 py-2 text-sm text-muted-foreground">
                      <div className="font-semibold text-foreground">
                        {userData?.full_name || userData?.username}
                      </div>
                      <div className="text-xs">{userData?.email}</div>
                      <div className="text-xs mt-1">
                        Role: {userData?.roles?.join(", ") || "User"}
                      </div>
                    </div>
                    <hr className="my-1 border-border" />
                    <Link
                      href="/dashboard/profile"
                      className="block px-4 py-2 text-sm text-foreground hover:bg-accent"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      Profile Settings
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm text-foreground hover:bg-accent"
                    >
                      <div className="flex items-center gap-2">
                        <LogOut className="h-4 w-4" />
                        Sign Out
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-card border-r border-border pt-16 transform transition-transform duration-300 ease-in-out lg:translate-x-0 flex flex-col ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Mobile close button */}
        <div className="lg:hidden absolute top-20 right-4 z-10">
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-md p-2 text-muted-foreground hover:bg-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation items - scrollable area */}
        <nav className="flex-1 overflow-y-auto mt-8 px-4 pb-4">
          <ul className="space-y-1">
            {visibleSections.map((section) => {
              const isExpanded = expandedSections.has(section.id);
              const isSectionActive =
                pathname === section.href ||
                (section.href !== "/dashboard" && pathname.startsWith(section.href));
              const hasActiveChild = section.items?.some(
                (item) =>
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href)),
              );

              return (
                <li key={section.id}>
                  <div>
                    {/* Section header */}
                    <div className="flex items-center">
                      <Link
                        href={section.href}
                        className={`flex-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          isSectionActive && !hasActiveChild
                            ? "bg-primary/10 text-primary"
                            : hasActiveChild
                              ? "text-foreground"
                              : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        }`}
                        onClick={() => setSidebarOpen(false)}
                      >
                        <section.icon className="h-5 w-5 flex-shrink-0" />
                        <span>{section.label}</span>
                      </Link>
                      {section.items && section.items.length > 0 && (
                        <button
                          onClick={() => toggleSection(section.id)}
                          className="p-1 mr-1 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ChevronRight
                            className={`h-4 w-4 transform transition-transform ${
                              isExpanded ? "rotate-90" : ""
                            }`}
                          />
                        </button>
                      )}
                    </div>

                    {/* Section items */}
                    {section.items && isExpanded && (
                      <ul className="mt-1 ml-4 border-l border-border space-y-1">
                        {section.items.map((item) => {
                          const isItemActive =
                            pathname === item.href ||
                            (item.href !== "/dashboard" && pathname.startsWith(item.href));

                          // If item has permission requirement, wrap with Can component
                          if (item.permission) {
                            return (
                              <Can key={item.href} I={item.permission}>
                                <li>
                                  <Link
                                    href={item.href}
                                    className={`flex items-center gap-3 rounded-lg px-3 py-1.5 ml-2 text-sm transition-colors ${
                                      isItemActive
                                        ? "bg-primary/10 text-primary"
                                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                                    }`}
                                    onClick={() => setSidebarOpen(false)}
                                  >
                                    <item.icon className="h-4 w-4 flex-shrink-0" />
                                    <span>{item.name}</span>
                                    {item.badge && (
                                      <span className="ml-auto bg-primary/20 text-primary text-xs px-2 py-0.5 rounded-full">
                                        {item.badge}
                                      </span>
                                    )}
                                  </Link>
                                </li>
                              </Can>
                            );
                          }

                          // No permission requirement, show by default
                          return (
                            <li key={item.href}>
                              <Link
                                href={item.href}
                                className={`flex items-center gap-3 rounded-lg px-3 py-1.5 ml-2 text-sm transition-colors ${
                                  isItemActive
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                                }`}
                                onClick={() => setSidebarOpen(false)}
                              >
                                <item.icon className="h-4 w-4 flex-shrink-0" />
                                <span>{item.name}</span>
                                {item.badge && (
                                  <span className="ml-auto bg-primary/20 text-primary text-xs px-2 py-0.5 rounded-full">
                                    {item.badge}
                                  </span>
                                )}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Bottom section with version info */}
        <div className="flex-shrink-0 p-4 border-t border-border bg-card">
          <div className="text-xs text-muted-foreground">
            <div>Platform Version: 1.0.0</div>
            <div>Environment: Development</div>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="lg:pl-64 pt-16">
        <main
          id="main-content"
          className="min-h-screen p-4 sm:p-6 lg:p-8 bg-background"
          aria-label="Main content"
        >
          {children}
        </main>
      </div>

      {/* Real-time connection status indicator */}
      <ConnectionStatusIndicator position="bottom-right" />

      {/* Real-time alerts notifications */}
      <RealtimeAlerts minSeverity="warning" />

      {/* Global Command Palette (⌘K) */}
      <GlobalCommandPalette />

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 dark:bg-black/70 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
