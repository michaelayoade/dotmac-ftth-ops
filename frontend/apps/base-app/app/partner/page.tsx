"use client";

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

import { PartnerManagementView } from "@/components/partners/PartnerManagementView";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Download, Library } from "lucide-react";

export default function PartnerPortalOverview() {
  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Welcome to the Partner Portal</CardTitle>
          <CardDescription>
            Track opportunities, manage the tenants you support, and access enablement resources in one place.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/partner/tenants">View managed tenants</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/partner/resources">
              <Library className="mr-2 h-4 w-4" /> Browse resources
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/partner/billing">
              <Download className="mr-2 h-4 w-4" /> Partner billing
            </Link>
          </Button>
        </CardContent>
      </Card>

      <PartnerManagementView />
    </div>
  );
}
