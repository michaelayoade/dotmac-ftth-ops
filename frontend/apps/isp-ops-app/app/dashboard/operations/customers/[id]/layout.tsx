"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@dotmac/ui";
import { User, Package, Network, Cpu, Receipt, Ticket, FileText, Activity } from "lucide-react";

const tabs = [
  { name: "Overview", href: "", icon: User },
  { name: "Profile", href: "/profile", icon: User },
  { name: "Subscriptions", href: "/subscriptions", icon: Package },
  { name: "Network", href: "/network", icon: Network },
  { name: "Devices", href: "/devices", icon: Cpu },
  { name: "Billing", href: "/billing", icon: Receipt },
  { name: "Tickets", href: "/tickets", icon: Ticket },
  { name: "Documents", href: "/documents", icon: FileText },
  { name: "Activity", href: "/activity", icon: Activity },
];

export default function CustomerDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const pathname = usePathname();
  const basePath = `/dashboard/operations/customers/${params["id"]}`;

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b bg-background sticky top-0 z-10">
        <nav className="flex space-x-6 overflow-x-auto px-6">
          {tabs.map((tab) => {
            const href = `${basePath}${tab.href}`;
            const isActive = pathname === href;
            const Icon = tab.icon;

            return (
              <Link
                key={tab.name}
                href={href}
                className={cn(
                  "flex items-center gap-2 border-b-2 px-1 py-4 text-sm font-medium transition-colors whitespace-nowrap",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {children}
    </div>
  );
}
