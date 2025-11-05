"use client";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import { Skeleton } from "@dotmac/ui";
import { Network, Router, Database, Cog, Settings } from "lucide-react";
import { useAllOSSConfigurations, useOSSConfigStatistics } from "@/hooks/useOSSConfig";
import { OSSConfigurationCard } from "./components/OSSConfigurationCard";
import { OSSStatusOverview } from "./components/OSSStatusOverview";
import type { OSSService } from "@/lib/services/oss-config-service";

const OSS_SERVICES: Array<{ service: OSSService; icon: any }> = [
  { service: "voltha", icon: Network },
  { service: "genieacs", icon: Router },
  { service: "netbox", icon: Database },
  { service: "ansible", icon: Cog },
];

export default function OSSConfigurationPage() {
  const [activeTab, setActiveTab] = useState<OSSService | "overview">("overview");
  const { data: configurations, isLoading } = useAllOSSConfigurations();
  const { statistics, isLoading: isLoadingStats } = useOSSConfigStatistics();

  if (isLoading || isLoadingStats) {
    return (
      <div className="space-y-6 p-6">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-8 w-8" />
          OSS Integration Configuration
        </h1>
        <p className="text-muted-foreground mt-2">
          Configure tenant-specific settings for Operations Support Systems (OSS) integrations
        </p>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as OSSService | "overview")}
      >
        <TabsList className="grid w-full grid-cols-5 lg:w-[800px]">
          <TabsTrigger value="overview" className="gap-2">
            <Settings className="h-4 w-4" />
            Overview
          </TabsTrigger>
          {OSS_SERVICES.map(({ service, icon: Icon }) => (
            <TabsTrigger key={service} value={service} className="gap-2">
              <Icon className="h-4 w-4" />
              {service.toUpperCase()}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <OSSStatusOverview configurations={configurations || []} statistics={statistics} />
        </TabsContent>

        {/* Individual Service Tabs */}
        {OSS_SERVICES.map(({ service }) => (
          <TabsContent key={service} value={service} className="space-y-6">
            <OSSConfigurationCard service={service} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
