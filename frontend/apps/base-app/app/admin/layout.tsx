"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { Shield, Users, Settings, LayoutDashboard, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type AdminLayoutProps = {
  children: ReactNode;
};

type NavItem = {
  label: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const NAV_ITEMS: NavItem[] = [
  {
    label: "Overview",
    description: "Audit summaries and recently escalated events",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    label: "Users",
    description: "Manage administrators and platform access",
    href: "/admin/users",
    icon: Users,
  },
  {
    label: "Settings",
    description: "Security controls and platform policies",
    href: "/admin/settings",
    icon: Settings,
  },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background/95">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-primary">Platform Admin Console</p>
              <p className="text-xs text-muted-foreground">
                Secure controls for tenant, user and compliance operations
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
            <Button variant="outline" size="sm" data-testid="logout-button">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10 lg:flex-row">
        <aside className="w-full lg:w-72">
          <nav className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Administrative areas
            </p>
            <Separator className="bg-border/80" />
            <div className="space-y-2">
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${
                      isActive
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-transparent text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground"
                    }`}
                    data-testid={
                      item.href === "/admin/users"
                        ? "users-link"
                        : item.href === "/admin/settings"
                          ? "settings-link"
                          : undefined
                    }
                  >
                    <item.icon className="mt-0.5 h-5 w-5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </nav>
        </aside>

        <main className="flex-1">
          <div className="space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
