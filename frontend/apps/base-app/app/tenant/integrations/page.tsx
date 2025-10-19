"use client";

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

import Link from "next/link";
import { Package, Webhook, ToggleLeft, Settings2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const integrations = [
  {
    name: "Webhooks",
    description: "Deliver real-time events to your downstream systems.",
    href: "/dashboard/webhooks",
    status: "Configured",
    icon: Webhook,
  },
  {
    name: "Feature flags",
    description: "Toggle beta features and gradual rollouts.",
    href: "/dashboard/infrastructure/feature-flags",
    status: "Active",
    icon: ToggleLeft,
  },
  {
    name: "Partner apps",
    description: "Manage third-party connections installed via the marketplace.",
    href: "/dashboard/settings/integrations",
    status: "2 connected",
    icon: Package,
  },
];

export default function TenantIntegrationsPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Connect DotMac with the rest of your stack, manage webhooks, and control feature availability.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {integrations.map((integration) => {
          const Icon = integration.icon;
          return (
            <Card key={integration.name}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3 text-base">
                  <span className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                    {integration.name}
                  </span>
                  <Badge variant="outline">{integration.status}</Badge>
                </CardTitle>
                <CardDescription>{integration.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="secondary" className="w-full justify-between">
                  <Link href={integration.href}>
                    Manage
                    <Settings2 className="h-4 w-4" aria-hidden />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Coming soon: Integration catalog</CardTitle>
          <CardDescription>
            Install partner apps, configure API credentials, and set up sandbox environments directly inside the portal.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
