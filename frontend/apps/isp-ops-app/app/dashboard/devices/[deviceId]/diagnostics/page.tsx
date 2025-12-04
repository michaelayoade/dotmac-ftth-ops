"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import {
  ArrowLeft,
  Activity,
  Wifi,
  Globe,
  Zap,
  Download,
  Upload,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Play,
} from "lucide-react";
import { useApiConfig } from "@/hooks/useApiConfig";
import { useToast } from "@dotmac/ui";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import Link from "next/link";
import { useParams } from "next/navigation";

interface DiagnosticResult {
  success: boolean;
  timestamp: string;
  duration: number;
  data: any;
  error?: string;
}

function DiagnosticsPageContent() {
  const params = useParams();
  const deviceId = params["deviceId"] as string;

  const [pingHost, setPingHost] = useState("8.8.8.8");
  const [pingCount, setPingCount] = useState("4");
  const [tracerouteHost, setTracerouteHost] = useState("8.8.8.8");
  const [dnsHost, setDnsHost] = useState("google.com");
  const [speedTestDuration, setSpeedTestDuration] = useState("10");

  const [pingResult, setPingResult] = useState<DiagnosticResult | null>(null);
  const [tracerouteResult, setTracerouteResult] = useState<DiagnosticResult | null>(null);
  const [dnsResult, setDnsResult] = useState<DiagnosticResult | null>(null);
  const [speedTestResult, setSpeedTestResult] = useState<DiagnosticResult | null>(null);

  const { toast } = useToast();
  const { apiBaseUrl } = useApiConfig();

  // Ping test
  const pingMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `${apiBaseUrl}/api/isp/v1/admin/genieacs/devices/${deviceId}/diagnostics/ping`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ host: pingHost, count: parseInt(pingCount) }),
        },
      );
      if (!response.ok) throw new Error("Ping test failed");
      return response.json();
    },
    onSuccess: (data) => {
      setPingResult(data);
      toast({ title: "Ping test completed" });
    },
    onError: () => {
      toast({ title: "Ping test failed", variant: "destructive" });
    },
  });

  // Traceroute test
  const tracerouteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `${apiBaseUrl}/api/isp/v1/admin/genieacs/devices/${deviceId}/diagnostics/traceroute`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ host: tracerouteHost }),
        },
      );
      if (!response.ok) throw new Error("Traceroute failed");
      return response.json();
    },
    onSuccess: (data) => {
      setTracerouteResult(data);
      toast({ title: "Traceroute completed" });
    },
    onError: () => {
      toast({ title: "Traceroute failed", variant: "destructive" });
    },
  });

  // DNS lookup test
  const dnsLookupMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `${apiBaseUrl}/api/isp/v1/admin/genieacs/devices/${deviceId}/diagnostics/dns`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ host: dnsHost }),
        },
      );
      if (!response.ok) throw new Error("DNS lookup failed");
      return response.json();
    },
    onSuccess: (data) => {
      setDnsResult(data);
      toast({ title: "DNS lookup completed" });
    },
    onError: () => {
      toast({ title: "DNS lookup failed", variant: "destructive" });
    },
  });

  // Speed test
  const speedTestMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `${apiBaseUrl}/api/isp/v1/admin/genieacs/devices/${deviceId}/diagnostics/speedtest`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ duration: parseInt(speedTestDuration) }),
        },
      );
      if (!response.ok) throw new Error("Speed test failed");
      return response.json();
    },
    onSuccess: (data) => {
      setSpeedTestResult(data);
      toast({ title: "Speed test completed" });
    },
    onError: () => {
      toast({ title: "Speed test failed", variant: "destructive" });
    },
  });

  const formatSpeed = (bps: number) => {
    if (bps >= 1000000000) return `${(bps / 1000000000).toFixed(2)} Gbps`;
    if (bps >= 1000000) return `${(bps / 1000000).toFixed(2)} Mbps`;
    if (bps >= 1000) return `${(bps / 1000).toFixed(2)} Kbps`;
    return `${bps} bps`;
  };

  const renderResultStatus = (result: DiagnosticResult | null, isPending: boolean) => {
    if (isPending) {
      return (
        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950/20 dark:text-blue-400">
          <Activity className="h-3 w-3 mr-1 animate-spin" />
          Running...
        </Badge>
      );
    }
    if (!result) {
      return <Badge variant="secondary">Not Run</Badge>;
    }
    if (result.success) {
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-950/20 dark:text-green-400">
          <CheckCircle className="h-3 w-3 mr-1" />
          Success
        </Badge>
      );
    }
    return (
      <Badge className="bg-red-100 text-red-800 dark:bg-red-950/20 dark:text-red-400">
        <XCircle className="h-3 w-3 mr-1" />
        Failed
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/dashboard/devices/${deviceId}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Device Diagnostics</h1>
            <p className="text-sm text-muted-foreground">
              Run network diagnostics and connectivity tests
            </p>
          </div>
        </div>
      </div>

      {/* Info Alert */}
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-blue-900 dark:text-blue-100">
                These diagnostics are executed directly on the device. Results may take several
                seconds to complete depending on network conditions.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Diagnostic Tests */}
      <Tabs defaultValue="ping" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="ping">Ping</TabsTrigger>
          <TabsTrigger value="traceroute">Traceroute</TabsTrigger>
          <TabsTrigger value="dns">DNS Lookup</TabsTrigger>
          <TabsTrigger value="speedtest">Speed Test</TabsTrigger>
        </TabsList>

        {/* Ping Test */}
        <TabsContent value="ping" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Wifi className="h-5 w-5" />
                    Ping Test
                  </CardTitle>
                  <CardDescription>Test ICMP connectivity to a host</CardDescription>
                </div>
                {renderResultStatus(pingResult, pingMutation.isPending)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Target Host</label>
                  <Input
                    value={pingHost}
                    onChange={(e) => setPingHost(e.target.value)}
                    placeholder="IP address or hostname"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Packet Count</label>
                  <Input
                    type="number"
                    value={pingCount}
                    onChange={(e) => setPingCount(e.target.value)}
                    min="1"
                    max="100"
                  />
                </div>
              </div>

              <Button
                onClick={() => pingMutation.mutate()}
                disabled={pingMutation.isPending}
                className="w-full"
              >
                <Play className="h-4 w-4 mr-2" />
                Run Ping Test
              </Button>

              {pingResult && (
                <div className="space-y-3 p-4 rounded-lg bg-muted">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Packets Sent</p>
                      <p className="text-lg font-medium">{pingResult.data?.sent || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Packets Received</p>
                      <p className="text-lg font-medium">{pingResult.data?.received || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Packet Loss</p>
                      <p className="text-lg font-medium">{pingResult.data?.loss || 0}%</p>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Min RTT</p>
                      <p className="text-lg font-medium">{pingResult.data?.min || 0}ms</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Avg RTT</p>
                      <p className="text-lg font-medium">{pingResult.data?.avg || 0}ms</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Max RTT</p>
                      <p className="text-lg font-medium">{pingResult.data?.max || 0}ms</p>
                    </div>
                  </div>
                  {pingResult.data?.output && (
                    <div className="mt-3">
                      <p className="text-sm text-muted-foreground mb-2">Raw Output:</p>
                      <pre className="text-xs bg-background p-3 rounded border overflow-auto max-h-40">
                        {pingResult.data.output}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Traceroute Test */}
        <TabsContent value="traceroute" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Traceroute
                  </CardTitle>
                  <CardDescription>Trace the network path to a destination</CardDescription>
                </div>
                {renderResultStatus(tracerouteResult, tracerouteMutation.isPending)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Target Host</label>
                <Input
                  value={tracerouteHost}
                  onChange={(e) => setTracerouteHost(e.target.value)}
                  placeholder="IP address or hostname"
                />
              </div>

              <Button
                onClick={() => tracerouteMutation.mutate()}
                disabled={tracerouteMutation.isPending}
                className="w-full"
              >
                <Play className="h-4 w-4 mr-2" />
                Run Traceroute
              </Button>

              {tracerouteResult && (
                <div className="space-y-3 p-4 rounded-lg bg-muted">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      Hops: {tracerouteResult.data?.hops?.length || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Duration: {tracerouteResult.duration}ms
                    </p>
                  </div>
                  {tracerouteResult.data?.hops && (
                    <div className="space-y-2">
                      {tracerouteResult.data.hops.map((hop: any, index: number) => (
                        <div
                          key={index}
                          className="flex items-center gap-3 p-2 rounded bg-background"
                        >
                          <Badge variant="outline" className="w-8 justify-center">
                            {hop.number}
                          </Badge>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{hop.host || "*"}</p>
                            {hop.ip && <p className="text-xs text-muted-foreground">{hop.ip}</p>}
                          </div>
                          <p className="text-sm">{hop.rtt || "-"}ms</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* DNS Lookup */}
        <TabsContent value="dns" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    DNS Lookup
                  </CardTitle>
                  <CardDescription>Resolve a hostname to IP addresses</CardDescription>
                </div>
                {renderResultStatus(dnsResult, dnsLookupMutation.isPending)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Hostname</label>
                <Input
                  value={dnsHost}
                  onChange={(e) => setDnsHost(e.target.value)}
                  placeholder="example.com"
                />
              </div>

              <Button
                onClick={() => dnsLookupMutation.mutate()}
                disabled={dnsLookupMutation.isPending}
                className="w-full"
              >
                <Play className="h-4 w-4 mr-2" />
                Run DNS Lookup
              </Button>

              {dnsResult && (
                <div className="space-y-3 p-4 rounded-lg bg-muted">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Query: {dnsResult.data?.query}</p>
                    <p className="text-sm text-muted-foreground">
                      Duration: {dnsResult.duration}ms
                    </p>
                  </div>
                  {dnsResult.data?.addresses && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Resolved Addresses:</p>
                      {dnsResult.data.addresses.map((addr: string, index: number) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 p-2 rounded bg-background"
                        >
                          <Badge variant="outline">IPv{addr.includes(":") ? "6" : "4"}</Badge>
                          <p className="font-mono text-sm">{addr}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Speed Test */}
        <TabsContent value="speedtest" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Speed Test
                  </CardTitle>
                  <CardDescription>Measure download and upload speeds</CardDescription>
                </div>
                {renderResultStatus(speedTestResult, speedTestMutation.isPending)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Test Duration (seconds)</label>
                <Input
                  type="number"
                  value={speedTestDuration}
                  onChange={(e) => setSpeedTestDuration(e.target.value)}
                  min="5"
                  max="60"
                />
              </div>

              <Button
                onClick={() => speedTestMutation.mutate()}
                disabled={speedTestMutation.isPending}
                className="w-full"
              >
                <Play className="h-4 w-4 mr-2" />
                Run Speed Test
              </Button>

              {speedTestResult && (
                <div className="space-y-4 p-4 rounded-lg bg-muted">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Download className="h-4 w-4 text-green-600" />
                          Download Speed
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold">
                          {formatSpeed(speedTestResult.data?.download || 0)}
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Upload className="h-4 w-4 text-blue-600" />
                          Upload Speed
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold">
                          {formatSpeed(speedTestResult.data?.upload || 0)}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Latency</p>
                      <p className="font-medium">{speedTestResult.data?.latency || 0}ms</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Jitter</p>
                      <p className="font-medium">{speedTestResult.data?.jitter || 0}ms</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Test Duration</p>
                      <p className="font-medium">{(speedTestResult.duration / 1000).toFixed(1)}s</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Test History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Tests
          </CardTitle>
          <CardDescription>History of diagnostic tests run on this device</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[pingResult, tracerouteResult, dnsResult, speedTestResult]
              .filter(Boolean)
              .map((result, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    {result?.success ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {result === pingResult
                          ? "Ping Test"
                          : result === tracerouteResult
                            ? "Traceroute"
                            : result === dnsResult
                              ? "DNS Lookup"
                              : "Speed Test"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(result!.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{result!.duration}ms</p>
                </div>
              ))}
            {![pingResult, tracerouteResult, dnsResult, speedTestResult].some(Boolean) && (
              <p className="text-center py-8 text-muted-foreground">
                No diagnostic tests have been run yet
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function DiagnosticsPage() {
  return (
    <RouteGuard permission="devices.diagnostics">
      <DiagnosticsPageContent />
    </RouteGuard>
  );
}
