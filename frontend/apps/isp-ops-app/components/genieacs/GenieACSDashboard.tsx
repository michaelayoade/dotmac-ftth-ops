"use client";

import { useState } from "react";
import { Server, Settings, Calendar, FileText, Activity, BarChart3 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@dotmac/ui";
import { BulkOperationsDashboard } from "./BulkOperationsDashboard";
import { FirmwareManagement } from "./FirmwareManagement";
import { CPEConfigTemplates } from "./CPEConfigTemplates";
import { DeviceManagement } from "./DeviceManagement";

export function GenieACSDashboard() {
  const [activeTab, setActiveTab] = useState<string>("devices");

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">CPE Management</h1>
        <p className="text-muted-foreground">
          Manage customer premises equipment, configurations, and firmware upgrades
        </p>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="devices">
            <Server className="w-4 h-4 mr-2" />
            Devices
          </TabsTrigger>
          <TabsTrigger value="bulk-ops">
            <Settings className="w-4 h-4 mr-2" />
            Bulk Operations
          </TabsTrigger>
          <TabsTrigger value="firmware">
            <Calendar className="w-4 h-4 mr-2" />
            Firmware
          </TabsTrigger>
          <TabsTrigger value="templates">
            <FileText className="w-4 h-4 mr-2" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="monitoring">
            <Activity className="w-4 h-4 mr-2" />
            Monitoring
          </TabsTrigger>
        </TabsList>

        {/* Devices Tab */}
        <TabsContent value="devices" className="space-y-4">
          <DeviceManagement />
        </TabsContent>

        {/* Bulk Operations Tab */}
        <TabsContent value="bulk-ops" className="space-y-4">
          <BulkOperationsDashboard />
        </TabsContent>

        {/* Firmware Management Tab */}
        <TabsContent value="firmware" className="space-y-4">
          <FirmwareManagement />
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <CPEConfigTemplates />
        </TabsContent>

        {/* Monitoring Tab */}
        <TabsContent value="monitoring" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                CPE Monitoring & Analytics
              </CardTitle>
              <CardDescription>
                Real-time monitoring and performance analytics for CPE devices
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Monitoring Dashboard</p>
                <p className="text-sm mt-2">
                  Real-time CPE performance metrics and alerts will be displayed here
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
