"use client";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

import Link from "next/link";
import { Users, UserPlus, Shield } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTenant } from "@/lib/contexts/tenant-context";

export default function TenantUsersPage() {
  const { currentTenant } = useTenant();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Users & Access</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Invite teammates, manage roles, and review recent access changes for {currentTenant?.name}
          .
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Members & Invitations
            </CardTitle>
            <CardDescription>
              Add new collaborators, resend pending invites, and remove inactive users.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button asChild>
              <Link href="/dashboard/settings/organization">Manage organization members</Link>
            </Button>
            <Badge variant="outline" className="w-fit">
              Coming soon: inline invite workflows inside the portal.
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              Roles & Permissions
            </CardTitle>
            <CardDescription>
              Create custom roles and assign granular permissions across dashboard features.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button asChild variant="outline">
              <Link href="/dashboard/security-access/roles">View role catalog</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/dashboard/security-access/users">
                <UserPlus className="h-4 w-4 mr-2" />
                Manage team access
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
