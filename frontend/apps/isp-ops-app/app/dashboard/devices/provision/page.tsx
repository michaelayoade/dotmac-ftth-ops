"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import {
  ArrowLeft,
  Upload,
  PlusCircle,
  Download,
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  Trash2,
  Play,
} from "lucide-react";
import { useApiConfig } from "@/hooks/useApiConfig";
import { useToast } from "@dotmac/ui";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import Link from "next/link";

interface DeviceProvisionRequest {
  serialNumber: string;
  productClass: string;
  oui: string;
  presetName?: string;
}

interface BulkProvisionJob {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  totalDevices: number;
  processedDevices: number;
  successCount: number;
  failureCount: number;
  startedAt: string;
  completedAt?: string;
  errors?: Array<{ serialNumber: string; error: string }>;
}

interface Preset {
  id: string;
  name: string;
  description: string;
  deviceCount: number;
}

function ProvisionPageContent() {
  const [activeTab, setActiveTab] = useState<"single" | "bulk">("single");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<string[][]>([]);

  // Single device form
  const [serialNumber, setSerialNumber] = useState("");
  const [productClass, setProductClass] = useState("");
  const [oui, setOui] = useState("");
  const [singlePreset, setSinglePreset] = useState("");
  const [bulkPreset, setBulkPreset] = useState("");

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { apiBaseUrl } = useApiConfig();

  // Fetch presets
  const { data: presets = [] } = useQuery<Preset[]>({
    queryKey: ["device-presets"],
    queryFn: async () => {
      const response = await fetch(`${apiBaseUrl}/api/isp/v1/admin/genieacs/presets`, {
        credentials: "include",
      });
      if (!response.ok) return [];
      return response.json();
    },
  });

  // Fetch active bulk jobs
  const { data: bulkJobs = [] } = useQuery<BulkProvisionJob[]>({
    queryKey: ["bulk-provision-jobs"],
    queryFn: async () => {
      const response = await fetch(`${apiBaseUrl}/api/isp/v1/admin/genieacs/provision/bulk/jobs`, {
        credentials: "include",
      });
      if (!response.ok) return [];
      return response.json();
    },
    refetchInterval: 5000,
  });

  // Single device provision
  const provisionMutation = useMutation({
    mutationFn: async (device: DeviceProvisionRequest) => {
      const response = await fetch(`${apiBaseUrl}/api/isp/v1/admin/genieacs/provision`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(device),
      });
      if (!response.ok) throw new Error("Failed to provision device");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["genieacs-devices"] });
      setSerialNumber("");
      setProductClass("");
      setOui("");
      setSinglePreset("");
      toast({ title: "Device provisioned successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Provisioning failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Bulk provision
  const bulkProvisionMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      if (bulkPreset) {
        formData.append("presetName", bulkPreset);
      }

      const response = await fetch(`${apiBaseUrl}/api/isp/v1/admin/genieacs/provision/bulk`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!response.ok) throw new Error("Failed to start bulk provisioning");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bulk-provision-jobs"] });
      setCsvFile(null);
      setCsvPreview([]);
      setBulkPreset("");
      toast({ title: "Bulk provisioning started" });
    },
    onError: (error: Error) => {
      toast({
        title: "Bulk provisioning failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSingleProvision = () => {
    if (!serialNumber || !productClass || !oui) {
      toast({
        title: "Missing required fields",
        description: "Serial number, product class, and OUI are required",
        variant: "destructive",
      });
      return;
    }

    const payload: DeviceProvisionRequest = {
      serialNumber,
      productClass,
      oui,
      ...(singlePreset ? { presetName: singlePreset } : {}),
    };
    provisionMutation.mutate(payload);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);

    // Read and preview CSV
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const rows = text
        .split("\n")
        .filter((row) => row.trim())
        .map((row) => row.split(",").map((cell) => cell.trim()));

      setCsvPreview(rows.slice(0, 6)); // Show first 5 rows + header
    };
    reader.readAsText(file);
  };

  const handleBulkProvision = () => {
    if (!csvFile) {
      toast({
        title: "No file selected",
        description: "Please upload a CSV file",
        variant: "destructive",
      });
      return;
    }

    bulkProvisionMutation.mutate(csvFile);
  };

  const downloadTemplate = () => {
    const template =
      "serial_number,product_class,oui\nEXAMPLE123,Device,00D09E\nEXAMPLE456,Router,AABBCC";
    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "provision-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const getJobStatusBadge = (status: string) => {
    const badges = {
      pending: { icon: Clock, color: "bg-gray-100 text-gray-800" },
      processing: { icon: Upload, color: "bg-blue-100 text-blue-800" },
      completed: { icon: CheckCircle, color: "bg-green-100 text-green-800" },
      failed: { icon: AlertCircle, color: "bg-red-100 text-red-800" },
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/devices">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Device Provisioning</h1>
            <p className="text-sm text-muted-foreground">Add new devices individually or in bulk</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "single" | "bulk")}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="single">Single Device</TabsTrigger>
          <TabsTrigger value="bulk">Bulk Upload</TabsTrigger>
        </TabsList>

        {/* Single Device Tab */}
        <TabsContent value="single" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Provision Single Device</CardTitle>
              <CardDescription>
                Enter device information to provision a new TR-069 device
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="serialNumber">Serial Number *</Label>
                  <Input
                    id="serialNumber"
                    placeholder="e.g., ABC123456789"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="productClass">Product Class *</Label>
                  <Input
                    id="productClass"
                    placeholder="e.g., Device, Router"
                    value={productClass}
                    onChange={(e) => setProductClass(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="oui">OUI (Organizationally Unique Identifier) *</Label>
                  <Input
                    id="oui"
                    placeholder="e.g., 00D09E"
                    value={oui}
                    onChange={(e) => setOui(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="preset">Configuration Preset (Optional)</Label>
                  <select
                    id="preset"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    value={singlePreset}
                    onChange={(e) => setSinglePreset(e.target.value)}
                  >
                    <option value="">No preset</option>
                    {presets.map((preset) => (
                      <option key={preset.id} value={preset.name}>
                        {preset.name} - {preset.description}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSerialNumber("");
                    setProductClass("");
                    setOui("");
                    setSinglePreset("");
                  }}
                >
                  Clear
                </Button>
                <Button onClick={handleSingleProvision} disabled={provisionMutation.isPending}>
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Provision Device
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Device Information
                  </p>
                  <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                    <li>Serial Number: Unique identifier from device label</li>
                    <li>Product Class: Device type (e.g., ONT, Router, Gateway)</li>
                    <li>OUI: First 6 hex digits of MAC address</li>
                    <li>Preset: Pre-configured settings to apply to device</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bulk Upload Tab */}
        <TabsContent value="bulk" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Bulk Provisioning</CardTitle>
              <CardDescription>
                Upload a CSV file to provision multiple devices at once
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>CSV File</Label>
                <div className="flex gap-2">
                  <Input type="file" accept=".csv" onChange={handleFileUpload} className="flex-1" />
                  <Button variant="outline" onClick={downloadTemplate}>
                    <Download className="h-4 w-4 mr-2" />
                    Download Template
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  CSV format: serial_number, product_class, oui
                </p>
              </div>

              {csvPreview.length > 0 && csvPreview[0] && (
                <div className="space-y-2">
                  <Label>File Preview (First 5 rows)</Label>
                  <div className="border rounded-md overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          {csvPreview[0].map((header, i) => (
                            <th key={i} className="px-4 py-2 text-left font-medium">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreview.slice(1).map((row, i) => (
                          <tr key={i} className="border-t">
                            {row.map((cell, j) => (
                              <td key={j} className="px-4 py-2">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Total rows in file: {csvPreview.length - 1} devices
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="bulkPreset">Apply Preset to All Devices (Optional)</Label>
                <select
                  id="bulkPreset"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  value={bulkPreset}
                  onChange={(e) => setBulkPreset(e.target.value)}
                >
                  <option value="">No preset</option>
                  {presets.map((preset) => (
                    <option key={preset.id} value={preset.name}>
                      {preset.name} - {preset.description}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setCsvFile(null);
                    setCsvPreview([]);
                    setBulkPreset("");
                  }}
                  disabled={!csvFile}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear
                </Button>
                <Button
                  onClick={handleBulkProvision}
                  disabled={!csvFile || bulkProvisionMutation.isPending}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Bulk Provisioning
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Active Jobs */}
          {bulkJobs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Bulk Provisioning Jobs</CardTitle>
                <CardDescription>Track progress of bulk operations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {bulkJobs.map((job) => (
                    <div key={job.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Job #{job.id.slice(0, 8)}</span>
                        </div>
                        {getJobStatusBadge(job.status)}
                      </div>

                      {/* Progress */}
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>
                            Progress: {job.processedDevices} / {job.totalDevices} devices
                          </span>
                          <span className="font-medium">
                            {Math.round((job.processedDevices / job.totalDevices) * 100)}%
                          </span>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-2">
                          <div
                            className="bg-primary rounded-full h-2 transition-all"
                            style={{
                              width: `${(job.processedDevices / job.totalDevices) * 100}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3 text-green-600" />
                          <span>Success: {job.successCount}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <AlertCircle className="h-3 w-3 text-red-600" />
                          <span>Failed: {job.failureCount}</span>
                        </div>
                      </div>

                      {/* Timestamps */}
                      <div className="text-xs text-muted-foreground">
                        Started: {new Date(job.startedAt).toLocaleString()}
                        {job.completedAt && (
                          <> • Completed: {new Date(job.completedAt).toLocaleString()}</>
                        )}
                      </div>

                      {/* Errors */}
                      {job.errors && job.errors.length > 0 && (
                        <div className="mt-2 p-2 bg-destructive/10 rounded text-xs">
                          <p className="font-medium mb-1">Errors:</p>
                          <ul className="space-y-1">
                            {job.errors.slice(0, 3).map((err, i) => (
                              <li key={i}>
                                {err.serialNumber}: {err.error}
                              </li>
                            ))}
                            {job.errors.length > 3 && <li>...and {job.errors.length - 3} more</li>}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function ProvisionPage() {
  return (
    <RouteGuard permission="devices.write">
      <ProvisionPageContent />
    </RouteGuard>
  );
}
