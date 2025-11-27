import React, { useState, Fragment } from "react";
import { motion } from "framer-motion";
import { Bell, ChevronDown, HelpCircle, LogOut, Settings, User, Menu, X } from "lucide-react";
import { OptimizedImage } from "../ui/OptimizedImage";

interface PortalBranding {
  logo?: string;
  companyName: string;
  primaryColor: string;
  secondaryColor?: string;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
}

interface HeaderAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  badge?: number;
  variant?: "default" | "ghost" | "outline";
}

interface UniversalHeaderProps {
  variant: "admin" | "customer" | "reseller" | "technician" | "management";
  user?: UserProfile;
  branding?: PortalBranding;
  tenant?: {
    id: string;
    name: string;
  };
  actions?: HeaderAction[];
  onLogout: () => void;
  onMenuToggle?: () => void;
  showMobileMenu?: boolean;
  className?: string;
}

const variantStyles = {
  admin: {
    container: "bg-slate-900 border-slate-700",
    text: "text-slate-100",
    accent: "text-blue-400",
    hover: "hover:bg-slate-800",
  },
  customer: {
    container: "bg-white border-gray-200 shadow-sm",
    text: "text-gray-900",
    accent: "text-blue-600",
    hover: "hover:bg-gray-50",
  },
  reseller: {
    container: "bg-gradient-to-r from-purple-600 to-blue-600 border-transparent",
    text: "text-white",
    accent: "text-purple-200",
    hover: "hover:bg-white/10",
  },
  technician: {
    container: "bg-green-700 border-green-600",
    text: "text-white",
    accent: "text-green-200",
    hover: "hover:bg-green-600",
  },
  management: {
    container: "bg-gray-900 border-gray-700",
    text: "text-white",
    accent: "text-orange-400",
    hover: "hover:bg-gray-800",
  },
};

const defaultActions: Record<string, HeaderAction[]> = {
  admin: [
    {
      id: "notifications",
      label: "Notifications",
      icon: (props) => <Bell {...props} />,
      onClick: () => {},
      badge: 3,
    },
    {
      id: "settings",
      label: "Settings",
      icon: (props) => <Settings {...props} />,
      onClick: () => {},
    },
  ],
  customer: [
    { id: "help", label: "Help", icon: (props) => <HelpCircle {...props} />, onClick: () => {} },
    {
      id: "notifications",
      label: "Notifications",
      icon: (props) => <Bell {...props} />,
      onClick: () => {},
      badge: 2,
    },
  ],
  reseller: [
    {
      id: "notifications",
      label: "Notifications",
      icon: (props) => <Bell {...props} />,
      onClick: () => {},
      badge: 5,
    },
    {
      id: "settings",
      label: "Settings",
      icon: (props) => <Settings {...props} />,
      onClick: () => {},
    },
  ],
  technician: [
    { id: "help", label: "Help", icon: (props) => <HelpCircle {...props} />, onClick: () => {} },
    {
      id: "notifications",
      label: "Notifications",
      icon: (props) => <Bell {...props} />,
      onClick: () => {},
      badge: 1,
    },
  ],
  management: [
    {
      id: "notifications",
      label: "Notifications",
      icon: (props) => <Bell {...props} />,
      onClick: () => {},
      badge: 7,
    },
    {
      id: "settings",
      label: "Settings",
      icon: (props) => <Settings {...props} />,
      onClick: () => {},
    },
  ],
};

const portalTitles = {
  admin: "Admin Portal",
  customer: "Customer Portal",
  reseller: "Reseller Portal",
  technician: "Technician App",
  management: "Management Console",
};

export default function UniversalHeader({
  variant,
  user,
  branding,
  tenant,
  actions,
  onLogout,
  onMenuToggle,
  showMobileMenu = false,
  className = "",
}: UniversalHeaderProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const styles = variantStyles[variant];
  const headerActions = actions ?? defaultActions[variant] ?? [];

  const toggleUserMenu = () => setShowUserMenu(!showUserMenu);

  const renderLogo = () => {
    if (branding?.logo) {
      return (
        <OptimizedImage src={branding.logo} alt={branding.companyName} className="h-8 w-auto" />
      );
    }

    const initials =
      branding?.companyName
        ?.split(" ")
        .map((word) => word.charAt(0))
        .join("")
        .substring(0, 2)
        .toUpperCase() || "DM";

    return (
      <div
        className="flex h-8 w-8 items-center justify-center rounded-lg font-bold text-sm text-white"
        style={{ backgroundColor: branding?.primaryColor || "#3B82F6" }}
      >
        {initials}
      </div>
    );
  };

  const renderUserAvatar = () => {
    if (user?.avatar) {
      return <OptimizedImage src={user.avatar} alt={user.name} className="h-8 w-8 rounded-full" />;
    }

    const initials =
      user?.name
        ?.split(" ")
        .map((word) => word.charAt(0))
        .join("")
        .substring(0, 2)
        .toUpperCase() || "U";

    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-600 font-medium text-sm text-white">
        {initials}
      </div>
    );
  };

  return (
    <motion.header
      className={`flex h-16 items-center justify-between border-b px-4 sm:px-6 ${styles.container} ${className}`}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Logo and Title Section */}
      <div className="flex items-center space-x-4">
        {/* Mobile Menu Toggle */}
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className={`rounded-lg p-2 transition-colors md:hidden ${styles.hover}`}
            aria-label="Toggle menu"
          >
            {showMobileMenu ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        )}

        {/* Logo and Company Name */}
        <div className="flex items-center space-x-3">
          {renderLogo()}
          <div>
            <h1 className={`font-semibold text-xl ${styles.text}`}>
              {branding?.companyName || portalTitles[variant]}
            </h1>
            {tenant && <div className={`text-xs ${styles.accent}`}>{tenant.name}</div>}
          </div>
        </div>
      </div>

      {/* Actions Section */}
      <div className="flex items-center space-x-2">
        {/* Header Actions */}
        {headerActions.map((action) => {
          const IconComponent = action.icon;
          return (
            <button
              key={action.id}
              onClick={action.onClick}
              className={`relative rounded-lg p-2 transition-colors ${styles.hover}`}
              aria-label={action.label}
              title={action.label}
            >
              <IconComponent className="h-5 w-5" />
              {action.badge && action.badge > 0 && (
                <motion.span
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-medium text-white"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                >
                  {action.badge > 99 ? "99+" : action.badge}
                </motion.span>
              )}
            </button>
          );
        })}

        {/* User Menu */}
        {user && (
          <div className="relative">
            <button
              onClick={toggleUserMenu}
              className={`flex items-center space-x-2 rounded-lg p-2 transition-colors ${styles.hover}`}
              aria-label="User menu"
            >
              {renderUserAvatar()}
              <div className={`hidden text-left text-sm sm:block ${styles.text}`}>
                <div className="font-medium">{user.name}</div>
                <div className={`text-xs ${styles.accent}`}>{user.role}</div>
              </div>
              <ChevronDown className="h-4 w-4" />
            </button>

            {/* User Dropdown Menu */}
            {showUserMenu && (
              <motion.div
                className="absolute right-0 z-50 mt-2 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={{ duration: 0.2 }}
                onBlur={() => setShowUserMenu(false)}
              >
                <div className="border-b border-gray-100 px-4 py-2">
                  <p className="font-medium text-gray-900 text-sm">{user.name}</p>
                  <p className="text-gray-500 text-xs">{user.email}</p>
                  <span className="mt-1 inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                    {user.role}
                  </span>
                </div>

                <button
                  className="flex w-full items-center px-4 py-2 text-left text-gray-700 text-sm transition-colors hover:bg-gray-100"
                  onClick={() => setShowUserMenu(false)}
                >
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </button>

                <button
                  className="flex w-full items-center px-4 py-2 text-left text-gray-700 text-sm transition-colors hover:bg-gray-100"
                  onClick={() => setShowUserMenu(false)}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </button>

                <div className="border-t border-gray-100">
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onLogout();
                    }}
                    className="flex w-full items-center px-4 py-2 text-left text-red-600 text-sm transition-colors hover:bg-red-50"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </motion.header>
  );
}
