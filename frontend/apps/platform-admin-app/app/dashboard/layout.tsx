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
import { useSession } from "@dotmac/better-auth";
import type { ExtendedUser } from "@dotmac/better-auth";
import { signOut } from "@dotmac/better-auth";
import { RealtimeProvider } from "@/contexts/RealtimeProvider";
import { clearOperatorAuthTokens } from "../../../../shared/utils/operatorAuth";

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

type DisplayUser = Pick<ExtendedUser, "email" | "username" | "full_name" | "roles">;

const platformAdminSectionIds = new Set<string>([
  "overview",
  "tenants",
  "configuration",
  "analytics",
  "audit",
  "automation",
  "communications",
  "marketplace",
]);

const allSections: NavSection[] = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    href: "/dashboard",
  },
  {
    id: "tenants",
    label: "Tenants",
    icon: Building2,
    href: "/dashboard/platform-admin/tenants",
    items: [
      { name: "Tenant Directory", href: "/dashboard/platform-admin/tenants", icon: Building2 },
      { name: "Licensing & Plans", href: "/dashboard/platform-admin/licensing", icon: BarChart3 },
      { name: "Cross-Tenant Search", href: "/dashboard/platform-admin/search", icon: Search },
    ],
  },
  {
    id: "configuration",
    label: "Platform Configuration",
    icon: Settings,
    href: "/dashboard/platform-admin/system",
    items: [
      { name: "System Settings", href: "/dashboard/platform-admin/system", icon: Settings },
      { name: "Feature Flags", href: "/dashboard/feature-flags", icon: ToggleLeft },
      { name: "Security & Access", href: "/dashboard/security-access", icon: Shield },
      { name: "Integrations", href: "/dashboard/integrations", icon: Plug },
      { name: "Webhooks", href: "/dashboard/webhooks", icon: Webhook },
      { name: "Notifications", href: "/dashboard/notifications", icon: Bell },
      { name: "Account & Billing", href: "/dashboard/settings", icon: CreditCard },
    ],
  },
  {
    id: "analytics",
    label: "Analytics & Insights",
    icon: BarChart3,
    href: "/dashboard/analytics",
    items: [
      { name: "Analytics Overview", href: "/dashboard/analytics", icon: BarChart3 },
      { name: "Billing & Revenue", href: "/dashboard/billing-revenue", icon: DollarSign },
    ],
  },
  {
    id: "audit",
    label: "Audit & Compliance",
    icon: FileText,
    href: "/dashboard/platform-admin/audit",
    items: [
      { name: "Audit Trail", href: "/dashboard/platform-admin/audit", icon: FileText },
      { name: "Security Events", href: "/dashboard/security-access/permissions", icon: Shield },
      { name: "Notification History", href: "/dashboard/notifications/history", icon: Mail },
    ],
  },
  {
    id: "automation",
    label: "Automation",
    icon: Activity,
    href: "/dashboard/jobs",
    items: [
      { name: "Automation Jobs", href: "/dashboard/jobs", icon: Activity },
      { name: "Orchestration", href: "/dashboard/orchestration", icon: GitBranch },
      { name: "Workflows", href: "/dashboard/workflows", icon: Repeat },
      { name: "Data Import", href: "/dashboard/data-import", icon: Database },
      { name: "Data Pipelines", href: "/dashboard/data-transfer", icon: ArrowLeftRight },
    ],
  },
  {
    id: "communications",
    label: "Communications",
    icon: Mail,
    href: "/dashboard/communications",
    items: [
      { name: "Campaigns", href: "/dashboard/communications", icon: Mail },
      { name: "Notification Templates", href: "/dashboard/notifications/templates", icon: FileText },
      { name: "Support", href: "/dashboard/ticketing", icon: LifeBuoy },
    ],
  },
  {
    id: "marketplace",
    label: "Integrations & Marketplace",
    icon: Package,
    href: "/dashboard/plugins",
    items: [
      { name: "Plugin Catalog", href: "/dashboard/plugins", icon: Package },
      { name: "Partner Integrations", href: "/dashboard/partners", icon: Handshake },
      { name: "Partner Revenue", href: "/dashboard/partners/revenue", icon: TrendingUp },
    ],
  },
];

const filteredSections = allSections.filter((section) => platformAdminSectionIds.has(section.id));

const tenantPortalSection: NavSection = {
  id: "tenant-portal",
  label: "Tenant Portal",
  icon: Building2,
  href: "/tenant-portal",
  items: [
    { name: "Overview", href: "/tenant-portal", icon: LayoutDashboard },
    { name: "Customers", href: "/tenant-portal/customers", icon: Users },
    { name: "Billing", href: "/tenant-portal/billing", icon: CreditCard },
    { name: "Usage & Limits", href: "/tenant-portal/usage", icon: BarChart3 },
    { name: "Integrations", href: "/tenant-portal/integrations", icon: Plug },
    { name: "Support", href: "/tenant-portal/support", icon: LifeBuoy },
    { name: "User Access", href: "/tenant-portal/users", icon: UserCheck },
  ],
};

const sections = [...filteredSections, tenantPortalSection];

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
  const { data: session, isPending: authLoading } = useSession();
  const userData = session?.user as DisplayUser | undefined;

  useEffect(() => {
    if (!authLoading && !session) {
      router.replace("/login");
    }
  }, [authLoading, session, router]);

  const portalScopedSections = useMemo(
    () =>
      sections
        .filter((section) => portalAllows(section.portals, portalType))
        .map((section) => ({
          ...section,
          ...(section.items && {
            items: section.items.filter((item) => portalAllows(item.portals, portalType)),
          }),
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

  const handleLogout = async () => {
    await signOut();
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
                      className={branding.logo.light ? "hidden h-6 w-auto dark:block" : "h-6 w-auto"}
                      priority
                      unoptimized
                    />
                  ) : null}
                </div>
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
