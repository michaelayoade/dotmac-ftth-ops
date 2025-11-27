"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { SkipLink } from "@dotmac/ui";
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
  TrendingUp,
} from "lucide-react";
import { ThemeToggle } from "@dotmac/ui";
import { Can } from "@/components/auth/PermissionGuard";
import { useRBAC } from "@/contexts/RBACContext";
import { useBranding } from "@/hooks/useBranding";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { ConnectionStatusIndicator } from "@/components/realtime/ConnectionStatusIndicator";
import { RealtimeAlerts } from "@/components/realtime/RealtimeAlerts";
import { GlobalCommandPalette } from "@/components/global-command-palette";
import { getPortalType, portalAllows, type PortalType } from "@/lib/portal";
import { useSession, logout } from "@shared/lib/auth";
import type { UserInfo } from "@shared/lib/auth";
import { TenantSelector } from "@/components/partner/TenantSelector";
import { RealtimeProvider } from "@/contexts/RealtimeProvider";
import { clearOperatorAuthTokens } from "../../../../shared/utils/operatorAuth";

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: string | undefined;
  permission?: string | undefined;
  portals?: PortalType[] | undefined;
}

interface NavSection {
  id: string;
  label: string;
  icon: React.ElementType;
  href: string;
  items?: NavItem[] | undefined;
  permission?: string | string[] | undefined;
  portals?: PortalType[] | undefined;
}

type DisplayUser = Pick<UserInfo, "email" | "username" | "full_name" | "roles">;

const sections: NavSection[] = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    href: "/dashboard",
    items: [
      { name: "Overview Dashboard", href: "/dashboard", icon: LayoutDashboard },
      {
        name: "Observability & Health",
        href: "/dashboard/infrastructure",
        icon: Activity,
        permission: "infrastructure.read",
      },
    ],
  },
  {
    id: "customer-lifecycle",
    label: "Customer Lifecycle",
    icon: Users,
    href: "/dashboard/crm",
    items: [
      { name: "CRM Workspace", href: "/dashboard/crm", icon: Handshake },
      { name: "Sales Orders", href: "/dashboard/sales", icon: ShoppingCart },
      {
        name: "Subscribers",
        href: "/dashboard/subscribers",
        icon: Users,
        permission: "isp.radius.read",
      },
      { name: "Service Catalog", href: "/dashboard/services/internet-plans", icon: Package },
    ],
  },
  {
    id: "network-infra",
    label: "Network & Infrastructure",
    icon: Server,
    href: "/dashboard/network",
    items: [
      {
        name: "Network Inventory",
        href: "/dashboard/network",
        icon: Database,
        permission: "isp.ipam.read",
      },
      {
        name: "Fiber Management",
        href: "/dashboard/network/fiber",
        icon: Cable,
        permission: "isp.ipam.read",
      },
      { name: "Network Monitoring", href: "/dashboard/network-monitoring", icon: Activity },
      {
        name: "Faults & Incidents",
        href: "/dashboard/network/faults",
        icon: AlertTriangle,
        permission: "faults.alarms.read",
      },
      { name: "IPAM", href: "/dashboard/ipam", icon: NetworkIcon, permission: "isp.ipam.read" },
      { name: "DCIM", href: "/dashboard/dcim", icon: MapPin, permission: "isp.ipam.read" },
      {
        name: "PON Operations",
        href: "/dashboard/pon/olts",
        icon: Zap,
        permission: "isp.network.pon.read",
      },
      { name: "Wireless", href: "/dashboard/wireless", icon: Wifi },
      {
        name: "Device Management",
        href: "/dashboard/devices",
        icon: RouterIcon,
        permission: "devices.read",
      },
      {
        name: "Diagnostics Hub",
        href: "/dashboard/diagnostics",
        icon: Activity,
        permission: "diagnostics.read",
      },
    ],
  },
  {
    id: "operations-automation",
    label: "Operations & Automation",
    icon: Repeat,
    href: "/dashboard/operations",
    permission: "operations.read",
    items: [
      {
        name: "Operations Center",
        href: "/dashboard/operations",
        icon: LayoutDashboard,
        permission: "operations.read",
      },
      { name: "Automation Studio", href: "/dashboard/automation", icon: Repeat },
      { name: "Templates", href: "/dashboard/automation/templates", icon: FileCode },
      { name: "Instances", href: "/dashboard/automation/instances", icon: Server },
      { name: "Jobs", href: "/dashboard/jobs", icon: Briefcase },
      { name: "Workflows", href: "/dashboard/workflows", icon: GitBranch },
      { name: "Data Transfer", href: "/dashboard/data-transfer", icon: ArrowLeftRight },
      { name: "Orchestration", href: "/dashboard/orchestration", icon: Activity },
    ],
  },
  {
    id: "business-finance",
    label: "Business & Finance",
    icon: DollarSign,
    href: "/dashboard/billing-revenue",
    items: [
      { name: "Revenue Overview", href: "/dashboard/billing-revenue", icon: BarChart3 },
      { name: "Invoices", href: "/dashboard/billing-revenue/invoices", icon: FileText },
      { name: "Subscriptions", href: "/dashboard/billing-revenue/subscriptions", icon: Repeat },
      {
        name: "Usage Billing",
        href: "/dashboard/billing-revenue/usage",
        icon: Activity,
        permission: "billing.read",
      },
      { name: "Payments", href: "/dashboard/billing-revenue/payments", icon: CreditCard },
      { name: "Plans", href: "/dashboard/billing-revenue/plans", icon: Package },
      {
        name: "Add-ons",
        href: "/dashboard/billing-revenue/addons",
        icon: Plug,
        permission: "billing.read",
      },
      {
        name: "Banking Overview",
        href: "/dashboard/banking",
        icon: CreditCard,
        permission: "billing.read",
      },
      {
        name: "Payments & Reconciliation",
        href: "/dashboard/banking-v2",
        icon: Repeat,
        permission: "billing.payments",
      },
      { name: "Licensing", href: "/dashboard/licensing", icon: Key },
      {
        name: "Partner Directory",
        href: "/dashboard/partners",
        icon: Handshake,
        permission: "partner.manage",
      },
      {
        name: "Partner Revenue",
        href: "/dashboard/partners/revenue",
        icon: TrendingUp,
        permission: "partner.manage",
      },
      {
        name: "Managed Tenants",
        href: "/dashboard/partners/managed-tenants",
        icon: Building2,
        permission: "partner.tenants.list",
      },
    ],
  },
  {
    id: "support-comms",
    label: "Support & Communications",
    icon: LifeBuoy,
    href: "/dashboard/ticketing",
    items: [
      { name: "Tickets", href: "/dashboard/ticketing", icon: Ticket },
      { name: "Support Center", href: "/dashboard/support", icon: LifeBuoy },
      {
        name: "Communications Inbox",
        href: "/dashboard/communications",
        icon: Mail,
        permission: "communications.read",
      },
      {
        name: "Campaigns",
        href: "/dashboard/communications/campaigns",
        icon: Calendar,
        permission: "communications.campaigns",
      },
      {
        name: "Templates",
        href: "/dashboard/communications/templates",
        icon: FileText,
        permission: "communications.templates",
      },
      {
        name: "Notification History",
        href: "/dashboard/notifications/history",
        icon: Bell,
      },
    ],
  },
  {
    id: "integrations",
    label: "Integrations & Marketplace",
    icon: Plug,
    href: "/dashboard/integrations",
    items: [
      { name: "Integrations", href: "/dashboard/integrations", icon: Plug },
      { name: "Plugins", href: "/dashboard/plugins", icon: Puzzle },
      { name: "Feature Flags", href: "/dashboard/feature-flags", icon: ToggleLeft },
      {
        name: "Webhooks",
        href: "/dashboard/webhooks",
        icon: Webhook,
        permission: "webhooks.read",
      },
    ],
  },
  {
    id: "security",
    label: "Security & Admin",
    icon: Shield,
    href: "/dashboard/security-access",
    items: [
      { name: "Security Overview", href: "/dashboard/security-access", icon: Shield },
      {
        name: "API Keys",
        href: "/dashboard/security-access/api-keys",
        icon: Key,
        permission: "security.manage",
      },
      { name: "MFA & 2FA", href: "/dashboard/security-access/mfa", icon: Shield },
      { name: "Sessions", href: "/dashboard/security-access/sessions", icon: User },
      { name: "Auth Metrics", href: "/dashboard/security-access/auth-metrics", icon: Activity },
      { name: "Secrets", href: "/dashboard/security-access/secrets", icon: Lock },
      { name: "Roles", href: "/dashboard/security-access/roles", icon: Shield },
      { name: "Users", href: "/dashboard/security-access/users", icon: Users },
      { name: "Audit Logs", href: "/dashboard/audit", icon: FileText },
      { name: "Account & Settings", href: "/dashboard/settings", icon: Settings },
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
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const pathname = usePathname();
  const router = useRouter();
  const { hasPermission, hasAnyPermission } = useRBAC();
  const { branding } = useBranding();
  const portalType = getPortalType();
  const { user, isLoading: authLoading, isAuthenticated } = useSession();
  const userData = user as DisplayUser | undefined;

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  const portalScopedSections = useMemo(
    () =>
      sections
        .filter((section) => portalAllows(section.portals, portalType))
        .map((section) => {
          const filteredItems = section.items?.filter((item) =>
            portalAllows(item.portals, portalType),
          );
          return filteredItems !== undefined
            ? { ...section, items: filteredItems }
            : { ...section };
        }),
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

  const handleLogout = async () => {
    await logout();
    clearOperatorAuthTokens();
    router.push("/login");
  };

  return (
    <RealtimeProvider>
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
                  <div className="flex items-center h-6">
                    {branding.logo.light ? (
                      <Image
                        src={branding.logo.light}
                        alt={`${branding.productName} logo`}
                        width={160}
                        height={32}
                        className={`h-6 w-auto ${branding.logo.dark ? "dark:hidden" : ""}`}
                        priority
                        unoptimized
                      />
                    ) : null}
                    {branding.logo.dark ? (
                      <Image
                        src={branding.logo.dark}
                        alt={`${branding.productName} logo`}
                        width={160}
                        height={32}
                        className={
                          branding.logo.light ? "hidden h-6 w-auto dark:block" : "h-6 w-auto"
                        }
                        priority
                        unoptimized
                      />
                    ) : null}
                  </div>
                ) : (
                  <div className="text-xl font-semibold text-foreground">
                    {branding.productName}
                  </div>
                )}
              </div>
            </div>

            {/* Right side - Tenant selector, Notifications, Theme toggle and User menu */}
            <div className="flex items-center gap-4">
              <TenantSelector />
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
        <div className="pt-16 w-full lg:ml-[16rem] lg:w-[calc(100%-16rem)]">
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
    </RealtimeProvider>
  );
}
