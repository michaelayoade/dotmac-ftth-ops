"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTenantAuth } from "@/lib/auth/TenantAuthContext";
import { Button } from "@dotmac/primitives";
import {
  LayoutDashboard,
  CreditCard,
  Gauge,
  Plug,
  Users,
  LifeBuoy,
  Shield,
  Settings,
  LogOut,
  Building2,
  Loader2,
} from "lucide-react";

const navigation = [
  { name: "Overview", href: "/portal", icon: LayoutDashboard },
  { name: "Billing & Plans", href: "/portal/billing", icon: CreditCard },
  { name: "Usage & Limits", href: "/portal/usage", icon: Gauge },
  { name: "Licenses", href: "/portal/licenses", icon: Shield },
  { name: "Users & Access", href: "/portal/users", icon: Users },
  { name: "Integrations", href: "/portal/integrations", icon: Plug },
  { name: "Support", href: "/portal/support", icon: LifeBuoy },
  { name: "Settings", href: "/portal/settings", icon: Settings },
];

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, logout, isLoading } = useTenantAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Building2 className="h-8 w-8 text-primary" />
              <div className="flex flex-col">
                <span className="font-semibold text-lg">Tenant Portal</span>
                <span className="text-xs text-muted-foreground">
                  {user?.tenant_name}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">{user?.email}</span>
              <Button variant="ghost" size="sm" onClick={logout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Sidebar Navigation */}
          <nav className="w-64 shrink-0">
            <ul className="space-y-1">
              {navigation.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/portal" && pathname.startsWith(item.href));
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-foreground"
                      }`}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Main Content */}
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
