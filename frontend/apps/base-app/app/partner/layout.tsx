"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PropsWithChildren, useMemo } from "react";
import { Handshake, Users, CreditCard, Layers, LifeBuoy } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { RouteGuard } from "@/components/auth/PermissionGuard";

interface NavItem {
  href: string;
  label: string;
  description?: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/partner", label: "Overview", icon: Handshake },
  { href: "/partner/tenants", label: "Managed tenants", icon: Users },
  { href: "/partner/billing", label: "Partner billing", icon: CreditCard },
  { href: "/partner/resources", label: "Enablement", icon: Layers },
  { href: "/partner/support", label: "Support", icon: LifeBuoy },
];

export default function PartnerPortalLayout({ children }: PropsWithChildren) {
  const pathname = usePathname();

  const activeHref = useMemo(() => {
    if (!pathname) return "/partner";
    const match = NAV_ITEMS.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    );
    return match?.href ?? "/partner";
  }, [pathname]);

  return (
    <RouteGuard permission={["partners.read", "platform:partners:read"]}>
      <div className="min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <Handshake className="h-6 w-6 text-primary" aria-hidden />
              <div className="flex flex-col">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  Partner Portal
                </span>
                <span className="text-sm font-semibold text-foreground">
                  Manage go-to-market relationships
                </span>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 pb-12 pt-6 md:flex-row">
          <nav className="w-full md:w-60">
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
