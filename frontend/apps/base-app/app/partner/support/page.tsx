"use client";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LifeBuoy, Mail, Calendar, FileText } from "lucide-react";

export default function PartnerSupportPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Partner Support</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Engage DotMac’s partner success team for deal support, escalations, and enablement.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <SupportCard
          title="Raise a partner request"
          description="Get technical or commercial assistance from our partner desk."
          icon={LifeBuoy}
          action={
            <Button asChild>
              <Link href="/support?channel=partner">Open partner ticket</Link>
            </Button>
          }
        />
        <SupportCard
          title="Contact partner success"
          description="Collaborate on go-to-market motions and shared pipelines."
          icon={Mail}
          action={
            <Button asChild variant="outline">
              <Link href="mailto:partners@dotmac.io">Email partner success</Link>
            </Button>
          }
        />
        <SupportCard
          title="Schedule enablement"
          description="Book workshops, certifications, and technical deep dives."
          icon={Calendar}
          action={
            <Button asChild variant="secondary">
              <Link href="https://calendly.com/dotmac-partner">Book a session</Link>
            </Button>
          }
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Partner updates
          </CardTitle>
          <CardDescription>
            Highlights and program announcements from the DotMac partner team.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• May 10 – New co-selling incentives for enterprise deals.</p>
          <p>• April 28 – Updated integration certification track is now live.</p>
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
          <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{action}</CardContent>
    </Card>
  );
}
