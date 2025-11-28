"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import {
  ArrowLeft,
  Download,
  Upload,
  CheckCircle,
  AlertTriangle,
  Clock,
  FileCode,
  Play,
} from "lucide-react";
import { useApiConfig } from "@/hooks/useApiConfig";
import { useToast } from "@dotmac/ui";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import Link from "next/link";
import { useParams } from "next/navigation";

interface FirmwareVersion {
  version: string;
  releaseDate: string;
  size: number;
  changelog: string[];
  compatible: boolean;
}

interface UpgradeJob {
  id: string;
  status: "pending" | "downloading" | "installing" | "completed" | "failed";
  progress: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

function FirmwarePageContent() {
  const params = useParams();
  const deviceId = params["deviceId"] as string;
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { apiBaseUrl } = useApiConfig();

  const { data: device } = useQuery({
    queryKey: ["device", deviceId],
    queryFn: async () => {
      const response = await fetch(`${apiBaseUrl}/api/isp/v1/admin/genieacs/devices/${deviceId}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch device");
      return response.json();
    },
  });

  const { data: availableVersions = [] } = useQuery<FirmwareVersion[]>({
    queryKey: ["firmware-versions", device?.summary?.model],
    queryFn: async () => {
      const response = await fetch(
        `${apiBaseUrl}/api/isp/v1/admin/genieacs/firmware/versions?model=${device?.summary?.model}`,
        { credentials: "include" },
      );
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!device?.summary?.model,
  });

  const { data: upgradeJob } = useQuery<UpgradeJob | null>({
    queryKey: ["firmware-upgrade", deviceId],
    queryFn: async () => {
      const response = await fetch(
        `${apiBaseUrl}/api/isp/v1/admin/genieacs/devices/${deviceId}/firmware/status`,
        { credentials: "include" },
      );
      if (!response.ok) return null;
      return response.json();
    },
    refetchInterval: 5000,
  });

  const upgradeMutation = useMutation({
    mutationFn: async (version: string) => {
      const response = await fetch(
        `${apiBaseUrl}/api/isp/v1/admin/genieacs/devices/${deviceId}/firmware/upgrade`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version }),
        },
      );
      if (!response.ok) throw new Error("Failed to initiate upgrade");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["firmware-upgrade", deviceId] });
      toast({ title: "Firmware upgrade initiated" });
    },
    onError: () => {
      toast({ title: "Upgrade failed", variant: "destructive" });
    },
  });

  const formatSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: { icon: Clock, color: "bg-gray-100 text-gray-800" },
      downloading: { icon: Download, color: "bg-blue-100 text-blue-800" },
      installing: { icon: Upload, color: "bg-purple-100 text-purple-800" },
      completed: { icon: CheckCircle, color: "bg-green-100 text-green-800" },
      failed: { icon: AlertTriangle, color: "bg-red-100 text-red-800" },
    };
    const { icon: Icon, color } = badges[status as keyof typeof badges] || badges.pending;
    return (
      <Badge className={color}>
        <Icon className="h-3 w-3 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/dashboard/devices/${deviceId}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Firmware Management</h1>
            <p className="text-sm text-muted-foreground">
              Update device firmware for {device?.summary?.serialNumber}
            </p>
          </div>
        </div>
      </div>

      {/* Current Version */}
      <Card>
        <CardHeader>
          <CardTitle>Current Firmware</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">{device?.summary?.softwareVersion || "Unknown"}</p>
              <p className="text-sm text-muted-foreground">
                Model: {device?.summary?.model || "Unknown"}
              </p>
            </div>
            <FileCode className="h-12 w-12 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      {/* Active Upgrade */}
      {upgradeJob && upgradeJob.status !== "completed" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Upgrade in Progress</CardTitle>
              {getStatusBadge(upgradeJob.status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm">{upgradeJob.status}</span>
                <span className="text-sm font-medium">{upgradeJob.progress}%</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-primary rounded-full h-2 transition-all"
                  style={{ width: `${upgradeJob.progress}%` }}
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Started: {new Date(upgradeJob.startedAt).toLocaleString()}
            </p>
            {upgradeJob.error && <p className="text-sm text-destructive">{upgradeJob.error}</p>}
          </CardContent>
        </Card>
      )}

      {/* Available Versions */}
      <Card>
        <CardHeader>
          <CardTitle>Available Firmware Versions</CardTitle>
          <CardDescription>Select a version to upgrade to</CardDescription>
        </CardHeader>
        <CardContent>
          {availableVersions.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No firmware versions available for this model
            </p>
          ) : (
            <div className="space-y-3">
              {availableVersions.map((version) => (
                <div
                  key={version.version}
                  className={`p-4 rounded-lg border ${
                    selectedVersion === version.version ? "border-primary bg-accent" : ""
                  } ${!version.compatible ? "opacity-60" : "cursor-pointer"}`}
                  onClick={() => version.compatible && setSelectedVersion(version.version)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">Version {version.version}</p>
                        {version.version === device?.summary?.softwareVersion && (
                          <Badge variant="secondary">Current</Badge>
                        )}
                        {!version.compatible && <Badge variant="destructive">Incompatible</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Released: {new Date(version.releaseDate).toLocaleDateString()} •{" "}
                        {formatSize(version.size)}
                      </p>
                    </div>
                    {version.compatible && selectedVersion === version.version && (
                      <Button
                        size="sm"
                        onClick={() => upgradeMutation.mutate(version.version)}
                        disabled={upgradeMutation.isPending || !!upgradeJob}
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Upgrade
                      </Button>
                    )}
                  </div>
                  {version.changelog.length > 0 && (
                    <div className="mt-3 text-sm">
                      <p className="text-muted-foreground mb-1">Changelog:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {version.changelog.map((change, i) => (
                          <li key={i} className="text-muted-foreground">
                            {change}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function FirmwarePage() {
  return (
    <RouteGuard permission="devices.firmware">
      <FirmwarePageContent />
    </RouteGuard>
  );
}
