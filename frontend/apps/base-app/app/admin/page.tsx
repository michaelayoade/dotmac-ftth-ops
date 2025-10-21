"use client";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertOctagon, Users, ShieldCheck, Activity } from "lucide-react";

const RECENT_ACTIVITY = [
  {
    id: "ACT-1028",
    actor: "a.williams",
    action: "Enabled MFA enforcement",
    context: "Security settings",
    time: "2 minutes ago",
    status: "success",
  },
  {
    id: "ACT-1027",
    actor: "s.nguyen",
    action: "Invited user to platform admin",
    context: "User management",
    time: "15 minutes ago",
    status: "success",
  },
  {
    id: "ACT-1026",
    actor: "system",
    action: "Detected elevated error rate",
    context: "Billing service",
    time: "1 hour ago",
    status: "warning",
  },
];

export default function AdminOverviewPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Badge variant="outline" className="w-fit">
          Administrator overview
        </Badge>
        <h1 className="text-3xl font-semibold text-foreground">Operational control center</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Review compliance posture, recent privileged activity, and service health before diving
          into detailed user or configuration changes.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card className="border-primary/30 bg-primary/5 shadow-primary/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Privileged admins</CardTitle>
            <ShieldCheck className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">12</div>
            <p className="text-xs text-muted-foreground">
              MFA enforced for 100% of administrator accounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-foreground">
              Pending access requests
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">4</div>
            <p className="text-xs text-muted-foreground">
              Requests awaiting review in the last 24 hours
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Service alerts</CardTitle>
            <AlertOctagon className="h-4 w-4 text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">1</div>
            <p className="text-xs text-muted-foreground">
              Degraded response times detected on billing webhooks
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Activity className="h-5 w-5 text-muted-foreground" />
            Recent privileged activity
          </CardTitle>
          <CardDescription>
            Monitor the most recent changes made by administrators across the platform.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/60">
                <TableHead className="whitespace-nowrap text-xs uppercase tracking-wide text-muted-foreground">
                  Event ID
                </TableHead>
                <TableHead className="whitespace-nowrap text-xs uppercase tracking-wide text-muted-foreground">
                  Actor
                </TableHead>
                <TableHead className="whitespace-nowrap text-xs uppercase tracking-wide text-muted-foreground">
                  Action
                </TableHead>
                <TableHead className="whitespace-nowrap text-xs uppercase tracking-wide text-muted-foreground">
                  Context
                </TableHead>
                <TableHead className="whitespace-nowrap text-xs uppercase tracking-wide text-muted-foreground">
                  When
                </TableHead>
                <TableHead className="whitespace-nowrap text-xs uppercase tracking-wide text-muted-foreground">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {RECENT_ACTIVITY.map((activity) => (
                <TableRow key={activity.id} className="border-border/40">
                  <TableCell className="font-mono text-sm text-foreground">{activity.id}</TableCell>
                  <TableCell className="text-sm text-foreground">{activity.actor}</TableCell>
                  <TableCell className="text-sm text-foreground">{activity.action}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {activity.context}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{activity.time}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        activity.status === "warning"
                          ? "destructive"
                          : activity.status === "success"
                            ? "outline"
                            : "secondary"
                      }
                    >
                      {activity.status === "warning" ? "needs attention" : "completed"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
