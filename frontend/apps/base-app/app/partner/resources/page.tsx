"use client";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DownloadCloud, Presentation, BookOpen } from "lucide-react";

const resources = [
  {
    title: "Go-to-market playbook",
    description: "Messaging, positioning, and sales enablement to accelerate co-selling.",
    href: "https://docs.dotmac.io/partner-gtm",
    icon: Presentation,
  },
  {
    title: "Technical integration guide",
    description: "API references, authentication patterns, and webhook event catalog.",
    href: "https://docs.dotmac.io/partner-api",
    icon: BookOpen,
  },
  {
    title: "Marketing toolkit",
    description: "Logos, co-branding guidance, and demand generation assets.",
    href: "https://docs.dotmac.io/partner-mktg",
    icon: DownloadCloud,
  },
];

export default function PartnerResourcesPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Partner Enablement</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Access the latest collateral, technical documentation, and sales resources to support
          tenant growth.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {resources.map((resource) => {
          const Icon = resource.icon;
          return (
            <Card key={resource.title}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                  {resource.title}
                </CardTitle>
                <CardDescription>{resource.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="secondary">
                  <Link href={resource.href} target="_blank" rel="noreferrer">
                    Open resource
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
