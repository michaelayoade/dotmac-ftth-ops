"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Separator,
} from "@dotmac/ui";
import { AlertCircle, Edit, Network, Shield, Wifi } from "lucide-react";
import { useState } from "react";
import { NetworkProfileEditDialog } from "./NetworkProfileEditDialog";

export interface NetworkProfile {
  id: string;
  subscriberId: string;
  tenantId: string;

  // Option 82 / Circuit Binding
  circuitId?: string | null;
  remoteId?: string | null;
  option82Policy: "enforce" | "log" | "ignore";

  // VLAN Configuration
  serviceVlan?: number | null;
  innerVlan?: number | null;
  vlanPool?: string | null;
  qinqEnabled: boolean;

  // IP Addressing
  staticIpv4?: string | null;
  staticIpv6?: string | null;
  delegatedIpv6Prefix?: string | null;
  ipv6PdSize?: number | null;
  ipv6AssignmentMode: "none" | "slaac" | "stateful" | "pd" | "dual_stack";

  // Metadata
  metadata?: Record<string, unknown> | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

interface NetworkProfileCardProps {
  profile: NetworkProfile | null;
  subscriberId: string;
  onUpdate?: () => void;
  isLoading?: boolean;
}

export function NetworkProfileCard({
  profile,
  subscriberId,
  onUpdate,
  isLoading = false,
}: NetworkProfileCardProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const hasVlanConfig = !!profile?.serviceVlan;
  const hasStaticIps = !!profile?.staticIpv4 || !!profile?.staticIpv6;
  const hasOption82 = !!profile?.circuitId || !!profile?.remoteId;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            Network Profile
          </CardTitle>
          <CardDescription>Loading network configuration...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="h-4 w-full bg-muted animate-pulse rounded" />
            <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
            <div className="h-4 w-1/2 bg-muted animate-pulse rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!profile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            Network Profile
          </CardTitle>
          <CardDescription>No network profile configured for this subscriber</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setIsEditDialogOpen(true)} variant="outline" className="w-full">
            <Network className="mr-2 h-4 w-4" />
            Configure Network Profile
          </Button>
        </CardContent>

        <NetworkProfileEditDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          subscriberId={subscriberId}
          profile={null}
          onSuccess={() => {
            onUpdate?.();
            setIsEditDialogOpen(false);
          }}
        />
      </Card>
    );
  }

  const getOption82PolicyBadge = (policy: string) => {
    const variants: Record<
      string,
      { variant: "default" | "destructive" | "secondary"; icon?: typeof Shield }
    > = {
      enforce: { variant: "destructive", icon: Shield },
      log: { variant: "secondary", icon: AlertCircle },
      ignore: { variant: "default", icon: AlertCircle },
    };
    const config = variants[policy] ?? variants["ignore"];
    const Icon = config?.["icon"] ?? AlertCircle;
    const variant = config?.["variant"] ?? "default";

    return (
      <Badge variant={variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {policy.toUpperCase()}
      </Badge>
    );
  };

  const getIPv6ModeBadge = (mode: string) => {
    if (mode === "none") return null;
    return (
      <Badge variant="outline" className="gap-1">
        <Wifi className="h-3 w-3" />
        {mode.toUpperCase().replace("_", " ")}
      </Badge>
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5" />
                Network Profile
              </CardTitle>
              <CardDescription>Subscriber network configuration and policies</CardDescription>
            </div>
            <Button onClick={() => setIsEditDialogOpen(true)} variant="outline" size="sm">
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* VLAN Configuration */}
          {hasVlanConfig && (
            <>
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Wifi className="h-4 w-4" />
                  VLAN Configuration
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {profile.serviceVlan && (
                    <div>
                      <p className="text-muted-foreground">Service VLAN</p>
                      <p className="font-mono">{profile.serviceVlan}</p>
                    </div>
                  )}
                  {profile.innerVlan && (
                    <div>
                      <p className="text-muted-foreground">Inner VLAN</p>
                      <p className="font-mono">{profile.innerVlan}</p>
                    </div>
                  )}
                  {profile.vlanPool && (
                    <div>
                      <p className="text-muted-foreground">VLAN Pool</p>
                      <p className="font-mono">{profile.vlanPool}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-muted-foreground">QinQ</p>
                    <Badge variant={profile.qinqEnabled ? "default" : "secondary"}>
                      {profile.qinqEnabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* IP Addressing */}
          {hasStaticIps && (
            <>
              <div>
                <h4 className="text-sm font-semibold mb-2">IP Addressing</h4>
                <div className="space-y-3 text-sm">
                  {profile.staticIpv4 && (
                    <div>
                      <p className="text-muted-foreground">Static IPv4</p>
                      <p className="font-mono">{profile.staticIpv4}</p>
                    </div>
                  )}
                  {profile.staticIpv6 && (
                    <div>
                      <p className="text-muted-foreground">Static IPv6</p>
                      <p className="font-mono break-all">{profile.staticIpv6}</p>
                    </div>
                  )}
                  {profile.delegatedIpv6Prefix && (
                    <div>
                      <p className="text-muted-foreground">IPv6 Prefix Delegation</p>
                      <p className="font-mono">
                        {profile.delegatedIpv6Prefix}
                        {profile.ipv6PdSize && ` (/${profile.ipv6PdSize})`}
                      </p>
                    </div>
                  )}
                  {profile.ipv6AssignmentMode !== "none" && (
                    <div>
                      <p className="text-muted-foreground">IPv6 Mode</p>
                      {getIPv6ModeBadge(profile.ipv6AssignmentMode)}
                    </div>
                  )}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Option 82 Configuration */}
          {hasOption82 && (
            <>
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  DHCP Option 82 Binding
                </h4>
                <div className="space-y-3 text-sm">
                  {profile.circuitId && (
                    <div>
                      <p className="text-muted-foreground">Circuit ID</p>
                      <p className="font-mono">{profile.circuitId}</p>
                    </div>
                  )}
                  {profile.remoteId && (
                    <div>
                      <p className="text-muted-foreground">Remote ID</p>
                      <p className="font-mono">{profile.remoteId}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-muted-foreground">Enforcement Policy</p>
                    {getOption82PolicyBadge(profile.option82Policy)}
                  </div>
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Summary when no specific config */}
          {!hasVlanConfig && !hasStaticIps && !hasOption82 && (
            <div className="text-center text-muted-foreground py-4">
              <p>Basic network profile configured</p>
              <p className="text-xs mt-1">Click Edit to add more configuration</p>
            </div>
          )}

          {/* Timestamps */}
          {profile.updatedAt && (
            <div className="text-xs text-muted-foreground pt-2 border-t">
              Last updated: {new Date(profile.updatedAt).toLocaleString()}
            </div>
          )}
        </CardContent>
      </Card>

      <NetworkProfileEditDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        subscriberId={subscriberId}
        profile={profile}
        onSuccess={() => {
          onUpdate?.();
          setIsEditDialogOpen(false);
        }}
      />
    </>
  );
}
