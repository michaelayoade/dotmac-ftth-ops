"use client";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, MessageSquare, FileText, LifeBuoy } from "lucide-react";

export default function TenantSupportPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Support & Resources</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Access help articles, raise support tickets, and view recent status updates for the DotMac
          platform.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <SupportCard
          title="Raise a ticket"
          description="Reach the DotMac support team with prioritized response SLAs."
          icon={LifeBuoy}
          action={
            <Button asChild>
              <Link href="/support">Open support portal</Link>
            </Button>
          }
        />
        <SupportCard
          title="Contact success"
          description="Schedule a call with your customer success manager."
          icon={Mail}
          action={
            <Button asChild variant="outline">
              <Link href="mailto:success@dotmac.io">Email success team</Link>
            </Button>
          }
        />
        <SupportCard
          title="Knowledge base"
          description="Guides and troubleshooting playbooks curated for tenant admins."
          icon={FileText}
          action={
            <Button asChild variant="secondary">
              <Link href="https://docs.dotmac.io" target="_blank">
                View documentation
              </Link>
            </Button>
          }
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            Recent incident updates
          </CardTitle>
          <CardDescription>
            Subscribe to proactive notifications for platform maintenance and incident response.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            • <span className="font-medium text-foreground">May 18</span> – Billing engine scaling
            event resolved within 8 minutes.
          </p>
          <p>
            • <span className="font-medium text-foreground">May 11</span> – Planned infrastructure
            maintenance completed with no downtime.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

interface SupportCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  action: React.ReactNode;
}

function SupportCard({ title, description, icon: Icon, action }: SupportCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{action}</CardContent>
    </Card>
  );
}
