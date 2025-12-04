import React, { useState, useEffect } from "react";
import type { ComponentType, ReactNode } from "react";
import { motion } from "framer-motion";
import UniversalHeader from "./UniversalHeader";

interface NavigationItem {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  href: string;
  badge?: number;
  children?: NavigationItem[];
}

interface PortalBranding {
  logo?: string;
  companyName: string;
  primaryColor: string;
  secondaryColor?: string;
  favicon?: string;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
}

interface UniversalLayoutProps {
  variant: "admin" | "customer" | "reseller" | "technician" | "management";
  children: ReactNode;
  user?: UserProfile;
  branding?: PortalBranding;
  tenant?: {
    id: string;
    name: string;
  };
  navigation?: NavigationItem[];
  onLogout: () => void;
  className?: string;

  // Layout configuration
  layoutType?: "dashboard" | "sidebar" | "mobile" | "simple";
  showSidebar?: boolean;
  sidebarCollapsible?: boolean;
  mobileBreakpoint?: number;

  // Header configuration
  showHeader?: boolean;
  headerActions?: Array<{
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    onClick: () => void;
    badge?: number;
  }>;

  // Content configuration
  maxWidth?: "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "7xl";
  padding?: "none" | "sm" | "md" | "lg";

  // Security and protection
  requireAuth?: boolean;
  requiredRoles?: string[];
  requiredPermissions?: string[];
}

const variantStyles = {
  admin: {
    layout: "bg-slate-50",
    sidebar: "bg-slate-900 text-slate-100",
    content: "bg-white",
    border: "border-slate-200",
  },
  customer: {
    layout: "bg-gray-50",
    sidebar: "bg-white text-gray-900 border-r border-gray-200",
    content: "bg-white",
    border: "border-gray-200",
  },
  reseller: {
    layout: "bg-purple-50",
    sidebar: "bg-gradient-to-b from-purple-600 to-blue-600 text-white",
    content: "bg-white",
    border: "border-purple-200",
  },
  technician: {
    layout: "bg-green-50",
    sidebar: "bg-green-700 text-white",
    content: "bg-white",
    border: "border-green-200",
  },
  management: {
    layout: "bg-gray-50",
    sidebar: "bg-gray-900 text-white",
    content: "bg-white",
    border: "border-gray-200",
  },
};

const layoutTypes = {
  dashboard: {
    structure: "header-content",
    sidebar: false,
    responsive: true,
  },
  sidebar: {
    structure: "header-sidebar-content",
    sidebar: true,
    responsive: true,
  },
  mobile: {
    structure: "mobile-header-content",
    sidebar: false,
    responsive: false,
  },
  simple: {
    structure: "content-only",
    sidebar: false,
    responsive: false,
  },
};

const maxWidthClasses = {
  none: "",
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "7xl": "max-w-7xl",
};

const paddingClasses = {
  none: "",
  sm: "p-2 sm:p-4",
  md: "p-4 sm:p-6",
  lg: "p-6 sm:p-8",
};

export function UniversalLayout({
  variant,
  children,
  user,
  branding,
  tenant,
  navigation = [],
  onLogout,
  className = "",

  // Layout configuration
  layoutType = "sidebar",
  showSidebar = true,
  sidebarCollapsible = true,
  mobileBreakpoint = 768,

  // Header configuration
  showHeader = true,
  headerActions,

  // Content configuration
  maxWidth = "7xl",
  padding = "md",

  // Security (implementation would need auth context)
  requireAuth = true,
  requiredRoles = [],
  requiredPermissions = [],
}: UniversalLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const styles = variantStyles[variant];
  const layout = layoutTypes[layoutType];

  // Handle responsive behavior
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < mobileBreakpoint;
      setIsMobile(mobile);

      // Close sidebar on mobile when switching to mobile view
      if (mobile && sidebarOpen) {
        setSidebarOpen(false);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [sidebarOpen, mobileBreakpoint]);

  // Close mobile sidebar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isMobile && sidebarOpen) {
        const sidebar = document.getElementById("universal-sidebar");
        const target = event.target as Node;

        if (sidebar && !sidebar.contains(target)) {
          setSidebarOpen(false);
        }
      }
    };

    if (sidebarOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
    return undefined;
  }, [isMobile, sidebarOpen]);

  // Prevent scroll on body when mobile sidebar is open
  useEffect(() => {
    if (isMobile && sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isMobile, sidebarOpen]);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const toggleSidebarCollapse = () => setSidebarCollapsed(!sidebarCollapsed);

  const renderNavigation = () => {
    if (!navigation.length || !showSidebar) return null;

    return (
      <nav className="flex-1 px-2 py-4 space-y-1">
        {navigation.map((item) => {
          const IconComponent = item.icon;
          return (
            <a
              key={item.id}
              href={item.href}
              className={`
                group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors
                ${
                  variant === "admin" || variant === "management"
                    ? "text-slate-300 hover:bg-slate-700 hover:text-white"
                    : variant === "reseller" || variant === "technician"
                      ? "text-white/90 hover:bg-white/10 hover:text-white"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }
                ${sidebarCollapsed && !isMobile ? "justify-center" : ""}
              `}
            >
              <IconComponent
                className={`
                  flex-shrink-0 h-6 w-6
                  ${sidebarCollapsed && !isMobile ? "" : "mr-3"}
                `}
              />
              {(!sidebarCollapsed || isMobile) && (
                <>
                  {item.label}
                  {item.badge && item.badge > 0 && (
                    <span className="ml-auto inline-block py-0.5 px-2 text-xs rounded-full bg-red-100 text-red-600">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </>
              )}
            </a>
          );
        })}
      </nav>
    );
  };

  const renderSidebar = () => {
    if (!showSidebar || layoutType === "mobile" || layoutType === "simple") {
      return null;
    }

    const sidebarWidth = sidebarCollapsed && !isMobile ? "w-16" : "w-64";

    return (
      <>
        {/* Mobile backdrop overlay */}
        {isMobile && sidebarOpen && (
          <motion.div
            className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar */}
        <motion.div
          id="universal-sidebar"
          className={`
            ${isMobile ? "fixed inset-y-0 left-0 z-50" : "relative"}
            ${sidebarWidth} ${styles.sidebar}
            ${isMobile && !sidebarOpen ? "translate-x-full" : "translate-x-0"}
            flex flex-col transition-all duration-300
          `}
          initial={isMobile ? { x: "-100%" } : false}
          animate={isMobile ? { x: sidebarOpen ? 0 : "-100%" } : false}
          transition={{ duration: 0.3 }}
        >
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center space-x-3">
              {branding?.logo ? (
                <img src={branding.logo} alt={branding.companyName} className="h-8 w-auto" />
              ) : (
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg font-bold text-sm text-white"
                  style={{
                    backgroundColor: branding?.primaryColor || "#3B82F6",
                  }}
                >
                  {branding?.companyName
                    ?.split(" ")
                    .map((word) => word.charAt(0))
                    .join("")
                    .substring(0, 2)
                    .toUpperCase() || "DM"}
                </div>
              )}
              {(!sidebarCollapsed || isMobile) && (
                <div>
                  <h1 className="font-semibold text-lg">
                    {branding?.companyName ||
                      `${variant.charAt(0).toUpperCase() + variant.slice(1)} Portal`}
                  </h1>
                  {tenant && <div className="text-xs opacity-75">{tenant.name}</div>}
                </div>
              )}
            </div>

            {/* Collapse button for desktop */}
            {sidebarCollapsible && !isMobile && (
              <button
                onClick={toggleSidebarCollapse}
                className="rounded-lg p-1 hover:bg-white/10 transition-colors"
                aria-label="Toggle sidebar"
              >
                <motion.div
                  animate={{ rotate: sidebarCollapsed ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  ←
                </motion.div>
              </button>
            )}
          </div>

          {/* Navigation */}
          {renderNavigation()}

          {/* Sidebar Footer */}
          <div className="border-t border-current/10 p-4">
            {(!sidebarCollapsed || isMobile) && (
              <div className="text-xs opacity-75">
                <p>{variant.charAt(0).toUpperCase() + variant.slice(1)} Portal</p>
                <p className="mt-1">v1.0.0</p>
              </div>
            )}
          </div>
        </motion.div>
      </>
    );
  };

  const renderContent = () => {
    const contentPadding = paddingClasses[padding];
    const contentMaxWidth = maxWidthClasses[maxWidth];

    return (
      <main
        className={`
        flex-1 overflow-y-auto focus:outline-none ${styles.content}
        ${layoutType === "simple" ? "" : "min-h-0"}
      `}
      >
        <div className={`${contentPadding} ${contentMaxWidth && `${contentMaxWidth} mx-auto`}`}>
          {children}
        </div>
      </main>
    );
  };

  // Simple layout (content only)
  if (layoutType === "simple") {
    return (
      <div
        className={`universal-layout universal-layout--${variant} ${styles.layout} ${className}`}
      >
        {renderContent()}
      </div>
    );
  }

  // Dashboard layout (header + content)
  if (layoutType === "dashboard") {
    return (
      <div
        className={`universal-layout universal-layout--${variant} h-screen flex flex-col ${styles.layout} ${className}`}
      >
        {showHeader && (
          <UniversalHeader
            variant={variant}
            {...(user ? { user } : {})}
            {...(branding ? { branding } : {})}
            {...(tenant ? { tenant } : {})}
            {...(headerActions ? { actions: headerActions } : {})}
            onLogout={onLogout}
            {...(showSidebar ? { onMenuToggle: toggleSidebar } : {})}
            showMobileMenu={sidebarOpen}
          />
        )}
        {renderContent()}
      </div>
    );
  }

  // Mobile layout
  if (layoutType === "mobile") {
    return (
      <div
        className={`universal-layout universal-layout--${variant} h-screen flex flex-col ${styles.layout} ${className}`}
      >
        {showHeader && (
          <UniversalHeader
            variant={variant}
            {...(user ? { user } : {})}
            {...(branding ? { branding } : {})}
            {...(tenant ? { tenant } : {})}
            {...(headerActions ? { actions: headerActions } : {})}
            onLogout={onLogout}
            {...(showSidebar ? { onMenuToggle: toggleSidebar } : {})}
            showMobileMenu={sidebarOpen}
          />
        )}
        {renderContent()}
        {renderSidebar()}
      </div>
    );
  }

  // Default sidebar layout
  return (
    <div
      className={`universal-layout universal-layout--${variant} h-screen flex ${styles.layout} ${className}`}
    >
      {renderSidebar()}

      <div
        className={`
        flex flex-col flex-1 overflow-hidden transition-all duration-300
        ${isMobile ? "ml-0" : showSidebar ? (sidebarCollapsed ? "ml-16" : "ml-64") : "ml-0"}
      `}
      >
        {showHeader && (
          <UniversalHeader
            variant={variant}
            {...(user ? { user } : {})}
            {...(branding ? { branding } : {})}
            {...(tenant ? { tenant } : {})}
            {...(headerActions ? { actions: headerActions } : {})}
            onLogout={onLogout}
            {...(showSidebar ? { onMenuToggle: toggleSidebar } : {})}
            showMobileMenu={sidebarOpen}
          />
        )}
        {renderContent()}
      </div>
    </div>
  );
}

export default UniversalLayout;
