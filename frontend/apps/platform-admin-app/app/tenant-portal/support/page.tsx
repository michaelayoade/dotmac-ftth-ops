"use client";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Mail, MessageSquare, FileText, LifeBuoy } from "lucide-react";
import { useBranding } from "@/hooks/useBranding";

export default function TenantSupportPage() {
  const { branding } = useBranding();
  const productName = branding.productName || "DotMac Platform";
  const successEmail = branding.successEmail || branding.supportEmail || "support@example.com";
  const docsUrl = branding.docsUrl || "https://docs.example.com";
  const supportPortalUrl = branding.supportPortalUrl || "/support";
  const docsLinkProps =
    docsUrl.startsWith("http") && !docsUrl.startsWith("/")
      ? { target: "_blank", rel: "noreferrer" }
      : {};

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Support & Resources</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Access help articles, raise support tickets, and view recent status updates for the{" "}
          {productName} platform.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <SupportCard
          title="Raise a ticket"
          description={`Reach the ${productName} support team with prioritized response SLAs.`}
          icon={LifeBuoy}
          action={
            <Button asChild>
              <Link href={supportPortalUrl}>Open support portal</Link>
            </Button>
          }
        />
        <SupportCard
          title="Contact success"
          description="Schedule a call with your customer success manager."
          icon={Mail}
          action={
            <Button asChild variant="outline">
              <Link href={`mailto:${successEmail}`}>Email success team</Link>
            </Button>
          }
        />
        <SupportCard
          title="Knowledge base"
          description="Guides and troubleshooting playbooks curated for tenant admins."
          icon={FileText}
          action={
            <Button asChild variant="secondary">
              <Link href={docsUrl} {...docsLinkProps}>
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
