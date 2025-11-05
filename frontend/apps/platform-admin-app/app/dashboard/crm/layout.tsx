"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type PropsWithChildren, useMemo } from "react";
import {
  Handshake,
  LayoutDashboard,
  Users,
  FileText,
  Compass,
  type LucideIcon,
} from "lucide-react";

import { RouteGuard } from "@/components/auth/PermissionGuard";
import { Card, CardContent } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard/crm",
    label: "Overview",
    description: "Pipeline health, KPIs, and quick actions",
    icon: LayoutDashboard,
  },
  {
    href: "/dashboard/crm/leads",
    label: "Leads",
    description: "Capture, qualify, and assign prospective customers",
    icon: Users,
  },
  {
    href: "/dashboard/crm/quotes",
    label: "Quotes",
    description: "Proposals, pricing, and acceptance tracking",
    icon: FileText,
  },
  {
    href: "/dashboard/crm/site-surveys",
    label: "Site Surveys",
    description: "Schedule field visits and track serviceability",
    icon: Compass,
  },
];

export default function CRMLayout({ children }: PropsWithChildren) {
  return (
    <RouteGuard permission="customers.read">
      <CRMLayoutContent>{children}</CRMLayoutContent>
    </RouteGuard>
  );
}

function CRMLayoutContent({ children }: PropsWithChildren) {
  const pathname = usePathname();

  const activeHref = useMemo(() => {
    if (!pathname) {
      return "/dashboard/crm";
    }

    const match = NAV_ITEMS.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    );

    return match?.href ?? "/dashboard/crm";
  }, [pathname]);

  return (
    <div className="container mx-auto space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3 text-2xl font-semibold">
            <Handshake className="h-7 w-7 text-primary" aria-hidden="true" />
            <span>Customer Relationship Management</span>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Guide prospects through the FTTH sales pipeline — manage leads, generate quotes, and
            verify serviceability to convert opportunities into paying subscribers.
          </p>
        </div>
        <Badge variant="outline" className="self-start">
          BSS Journey • Lead → Customer
        </Badge>
      </header>

      <Card>
        <CardContent className="p-0">
          <nav
            className="flex flex-col divide-y divide-border md:grid md:grid-cols-4 md:divide-y-0"
            aria-label="CRM navigation"
          >
            {NAV_ITEMS.map((item) => {
              const isActive = activeHref === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-1 flex-col gap-2 p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-accent hover:text-foreground",
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                    <span className="font-medium">{item.label}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </Link>
              );
            })}
          </nav>
        </CardContent>
      </Card>

      <section>{children}</section>
    </div>
  );
}
