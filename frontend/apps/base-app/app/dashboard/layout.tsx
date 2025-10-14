'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SkipLink } from '@/components/ui/skip-link';
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
  LayoutDashboard
} from 'lucide-react';
import { TenantSelector } from '@/components/tenant-selector';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { apiClient } from '@/lib/api/client';
import { logger } from '@/lib/logger';
import { Can } from '@/components/auth/PermissionGuard';
import { useRBAC } from '@/contexts/RBACContext';
import { useBranding } from '@/hooks/useBranding';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  permission?: string;
}

interface NavSection {
  id: string;
  label: string;
  icon: React.ElementType;
  href: string;
  items?: NavItem[];
  permission?: string | string[];
}

const sections: NavSection[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: Home,
    href: '/dashboard'
    // No permission required for overview
  },
  {
    id: 'tenant-portal',
    label: 'Tenant Portal',
    icon: Building2,
    href: '/tenant',
    permission: ['tenants:read', 'platform:tenants:read'],
    items: [
      { name: 'Overview', href: '/tenant', icon: Home },
      { name: 'Customers', href: '/tenant/customers', icon: Users },
      { name: 'Billing & Plans', href: '/tenant/billing', icon: CreditCard },
      { name: 'Users & Access', href: '/tenant/users', icon: User },
      { name: 'Usage & Limits', href: '/tenant/usage', icon: Activity },
      { name: 'Integrations', href: '/tenant/integrations', icon: ToggleLeft },
      { name: 'Support', href: '/tenant/support', icon: LifeBuoy },
    ],
  },
  {
    id: 'partner-portal',
    label: 'Partner Portal',
    icon: Handshake,
    href: '/partner',
    permission: ['partners.read', 'platform:partners:read'],
    items: [
      { name: 'Overview', href: '/partner', icon: Home },
      { name: 'Managed Tenants', href: '/partner/tenants', icon: Users },
      { name: 'Partner Billing', href: '/partner/billing', icon: CreditCard },
      { name: 'Resources', href: '/partner/resources', icon: FileText },
      { name: 'Support', href: '/partner/support', icon: LifeBuoy },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    icon: Activity,
    href: '/dashboard/operations',
    items: [
      { name: 'Overview', href: '/dashboard/operations', icon: BarChart3 },
      { name: 'Customers', href: '/dashboard/operations/customers', icon: UserCheck, permission: 'customers.read' },
      { name: 'Communications', href: '/dashboard/operations/communications', icon: Mail, permission: 'communications.read' },
      { name: 'Files', href: '/dashboard/operations/files', icon: FileText },
    ],
  },
  {
    id: 'billing-revenue',
    label: 'Billing & Revenue',
    icon: DollarSign,
    href: '/dashboard/billing-revenue',
    permission: 'billing.read',
    items: [
      { name: 'Overview', href: '/dashboard/billing-revenue', icon: BarChart3, permission: 'billing.read' },
      { name: 'Invoices', href: '/dashboard/billing-revenue/invoices', icon: FileText, permission: 'billing.read' },
      { name: 'Subscriptions', href: '/dashboard/billing-revenue/subscriptions', icon: Repeat, permission: 'billing.read' },
      { name: 'Payments', href: '/dashboard/billing-revenue/payments', icon: CreditCard, permission: 'billing.read' },
      { name: 'Plans', href: '/dashboard/billing-revenue/plans', icon: Package, permission: 'billing.read' },
      { name: 'Partners', href: '/dashboard/partners', icon: Handshake, permission: 'partners.read' },
    ],
  },
  {
    id: 'security-access',
    label: 'Security & Access',
    icon: Shield,
    href: '/dashboard/security-access',
    items: [
      { name: 'Overview', href: '/dashboard/security-access', icon: BarChart3 },
      { name: 'API Keys', href: '/dashboard/security-access/api-keys', icon: Key, permission: 'settings.read' },
      { name: 'Secrets', href: '/dashboard/security-access/secrets', icon: Lock, permission: 'secrets.read' },
      { name: 'Roles', href: '/dashboard/security-access/roles', icon: Shield, permission: 'system.read' },
      { name: 'Role Management', href: '/dashboard/admin/roles', icon: Shield, permission: 'system.manage' },
      { name: 'Users', href: '/dashboard/security-access/users', icon: Users, permission: 'users.read' },
    ],
  },
  {
    id: 'infrastructure',
    label: 'Infrastructure',
    icon: Server,
    href: '/dashboard/infrastructure',
    permission: 'infrastructure.read',
    items: [
      { name: 'Overview', href: '/dashboard/infrastructure', icon: BarChart3, permission: 'infrastructure.read' },
      { name: 'Health', href: '/dashboard/infrastructure/health', icon: Activity, permission: 'infrastructure.read' },
      { name: 'Logs', href: '/dashboard/infrastructure/logs', icon: FileText, permission: 'infrastructure.read' },
      { name: 'Observability', href: '/dashboard/infrastructure/observability', icon: Search, permission: 'infrastructure.read' },
      { name: 'Feature Flags', href: '/dashboard/infrastructure/feature-flags', icon: ToggleLeft, permission: 'infrastructure.read' },
    ],
  },
  {
    id: 'platform-admin',
    label: 'Platform Admin',
    icon: Shield,
    href: '/dashboard/platform-admin',
    permission: 'platform:admin',
    items: [
      { name: 'Overview', href: '/dashboard/platform-admin', icon: LayoutDashboard },
      { name: 'Tenant Management', href: '/dashboard/platform-admin/tenants', icon: Building2 },
      { name: 'Cross-Tenant Search', href: '/dashboard/platform-admin/search', icon: Search },
      { name: 'Audit Activity', href: '/dashboard/platform-admin/audit', icon: Activity },
      { name: 'System Configuration', href: '/dashboard/platform-admin/system', icon: Settings },
    ],
  },
  {
    id: 'admin',
    label: 'Administration',
    icon: Database,
    href: '/dashboard/admin',
    permission: 'system.manage',
    items: [
      { name: 'Overview', href: '/dashboard/admin', icon: BarChart3, permission: 'system.manage' },
      { name: 'Role Management', href: '/dashboard/admin/roles', icon: Shield, permission: 'system.manage' },
      { name: 'System Settings', href: '/dashboard/admin/system', icon: Settings, permission: 'system.manage' },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    href: '/dashboard/settings',
    // No permission required for Settings section - Profile is accessible to all users
    items: [
      { name: 'Profile', href: '/dashboard/settings/profile', icon: User },
      { name: 'Organization', href: '/dashboard/settings/organization', icon: Users, permission: 'settings.read' },
      { name: 'Billing', href: '/dashboard/settings/billing', icon: CreditCard, permission: 'billing.read' },
      { name: 'Notifications', href: '/dashboard/settings/notifications', icon: Mail, permission: 'settings.read' },
      { name: 'Integrations', href: '/dashboard/settings/integrations', icon: Package, permission: 'settings.read' },
    ],
  },
];

// Helper function to check if section should be visible
function checkSectionVisibility(
  section: NavSection,
  hasPermission: (permission: string) => boolean,
  hasAnyPermission: (permissions: string[]) => boolean
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
    return section.items.some(item => {
      if (!item.permission) return true;
      return hasPermission(item.permission);
    });
  }

  // If no permission requirement and no items, show by default
  return true;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [user, setUser] = useState<Record<string, unknown> | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const pathname = usePathname();
  const { hasPermission, hasAnyPermission } = useRBAC();
  const { branding } = useBranding();

  // Type helper for user data
  const userData = user as { id?: string; username?: string; email?: string; full_name?: string; roles?: string[] } | null;

  // Filter sections based on permissions
  const visibleSections = useMemo(
    () => sections.filter(section => checkSectionVisibility(section, hasPermission, hasAnyPermission)),
    [hasPermission, hasAnyPermission]
  );

  // Toggle section expansion
  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
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

    visibleSections.forEach(section => {
      const hasActiveItem = section.items?.some(item =>
        pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
      );

      if (hasActiveItem) {
        activeSections.add(section.id);
      }
    });

    if (activeSections.size === 0) {
      return;
    }

    setExpandedSections(prev => {
      const next = new Set(prev);
      let changed = false;

      activeSections.forEach(sectionId => {
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
    try {
      logger.debug('Dashboard: Fetching current user');
      const response = await apiClient.get('/api/v1/auth/me');

      if (response.data) {
        const userData = response.data as Record<string, unknown> & { id?: string };
        logger.info('Dashboard: User fetched successfully', { userId: userData.id });
        setUser(userData);
      } else {
        logger.warn('Dashboard: Failed to fetch user, redirecting to login', { response: response });
        // Token expired or invalid - redirect to login
        window.location.href = '/login';
      }
    } catch (error) {
      logger.error('Dashboard: Error fetching user', error instanceof Error ? error : new Error(String(error)));
      // On error, redirect to login
      window.location.href = '/login';
    }
  };

  const handleLogout = async () => {
    try {
      await apiClient.post('/api/v1/auth/logout');
      window.location.href = '/login';
    } catch (error) {
      logger.error('Logout error', error instanceof Error ? error : new Error(String(error)));
      // Still redirect even if logout fails
      window.location.href = '/login';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SkipLink />
      {/* Top Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border" aria-label="Main navigation">
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
              {(branding.logo.light || branding.logo.dark) ? (
                <picture>
                  {branding.logo.dark ? (
                    <source srcSet={branding.logo.dark} media="(prefers-color-scheme: dark)" />
                  ) : null}
                  <img
                    src={branding.logo.light || branding.logo.dark || ''}
                    alt={`${branding.productName} logo`}
                    className="h-6 w-auto"
                  />
                </picture>
              ) : (
                <div className="text-xl font-semibold text-foreground">{branding.productName}</div>
              )}
            </div>
          </div>

          {/* Right side - Tenant selector, Theme toggle and User menu */}
          <div className="flex items-center gap-4">
            <TenantSelector />
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
                <span className="hidden sm:block">{userData?.username || 'User'}</span>
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-md bg-popover shadow-lg ring-1 ring-border">
                  <div className="py-1">
                    <div className="px-4 py-2 text-sm text-muted-foreground">
                      <div className="font-semibold text-foreground">{userData?.full_name || userData?.username}</div>
                      <div className="text-xs">{userData?.email}</div>
                      <div className="text-xs mt-1">Role: {userData?.roles?.join(', ') || 'User'}</div>
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
      <div className={`fixed inset-y-0 left-0 z-40 w-64 bg-card border-r border-border pt-16 transform transition-transform duration-300 ease-in-out lg:translate-x-0 flex flex-col ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
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
              const isSectionActive = pathname === section.href ||
                (section.href !== '/dashboard' && pathname.startsWith(section.href));
              const hasActiveChild = section.items?.some(item =>
                pathname === item.href ||
                (item.href !== '/dashboard' && pathname.startsWith(item.href))
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
                            ? 'bg-primary/10 text-primary'
                            : hasActiveChild
                            ? 'text-foreground'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
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
                          <ChevronRight className={`h-4 w-4 transform transition-transform ${
                            isExpanded ? 'rotate-90' : ''
                          }`} />
                        </button>
                      )}
                    </div>

                    {/* Section items */}
                    {section.items && isExpanded && (
                      <ul className="mt-1 ml-4 border-l border-border space-y-1">
                        {section.items.map((item) => {
                          const isItemActive = pathname === item.href ||
                            (item.href !== '/dashboard' && pathname.startsWith(item.href));

                          // If item has permission requirement, wrap with Can component
                          if (item.permission) {
                            return (
                              <Can key={item.href} I={item.permission}>
                                <li>
                                  <Link
                                    href={item.href}
                                    className={`flex items-center gap-3 rounded-lg px-3 py-1.5 ml-2 text-sm transition-colors ${
                                      isItemActive
                                        ? 'bg-primary/10 text-primary'
                                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
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
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
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
        <main id="main-content" className="min-h-screen p-4 sm:p-6 lg:p-8 bg-background" aria-label="Main content">
          {children}
        </main>
      </div>

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
