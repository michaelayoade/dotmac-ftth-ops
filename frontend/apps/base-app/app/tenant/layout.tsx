"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PropsWithChildren, useMemo } from "react";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  GaugeCircle,
  Plug,
  LifeBuoy,
  BarChart,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TenantBadge } from "@/components/tenant-selector";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { RouteGuard } from "@/components/auth/PermissionGuard";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  description?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/tenant", label: "Overview", icon: LayoutDashboard },
  { href: "/tenant/customers", label: "Customers", icon: Users },
  { href: "/tenant/billing", label: "Billing & Plans", icon: CreditCard },
  { href: "/tenant/users", label: "Users & Access", icon: GaugeCircle },
  { href: "/tenant/usage", label: "Usage & Limits", icon: BarChart },
  { href: "/tenant/integrations", label: "Integrations", icon: Plug },
  { href: "/tenant/support", label: "Support", icon: LifeBuoy },
];

export default function TenantPortalLayout({ children }: PropsWithChildren) {
  const pathname = usePathname();

  const activeHref = useMemo(() => {
    if (!pathname) return "/tenant";
    const match = NAV_ITEMS.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    );
    return match?.href ?? "/tenant";
  }, [pathname]);

  return (
    <RouteGuard permission={["tenants:read", "platform:tenants:read"]}>
      <div className="min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <Building2 className="h-8 w-8 text-primary" />
              <div className="flex flex-col">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  Tenant Portal
                </span>
                <TenantBadge />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
            </div>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 pb-12 pt-6 md:flex-row">
          <nav className="w-full md:w-64">
            <ul className="flex flex-row gap-2 overflow-x-auto md:flex-col md:gap-1">
              {NAV_ITEMS.map((item) => {
                const isActive = item.href === activeHref;
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-sm transition-colors",
                        "hover:border-border hover:bg-accent hover:text-foreground",
                        isActive && "border-primary/40 bg-primary/5 text-primary",
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <main className="flex-1">{children}</main>
        </div>
      </div>
    </RouteGuard>
  );
}
