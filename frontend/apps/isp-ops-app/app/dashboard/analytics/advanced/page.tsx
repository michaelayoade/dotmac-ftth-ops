"use client";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import { AdvancedRevenueChart } from "@/components/analytics/AdvancedRevenueChart";
import { ChurnAnalysisChart } from "@/components/analytics/ChurnAnalysisChart";
import { CustomReportBuilder } from "@/components/analytics/CustomReportBuilder";
import { BarChart3, TrendingDown, FileText } from "lucide-react";

export default function AdvancedAnalyticsPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Advanced Analytics</h2>
          <p className="text-muted-foreground">
            In-depth analysis with customizable charts and reports
          </p>
        </div>
      </div>

      {/* Tabs for different analysis views */}
      <Tabs defaultValue="revenue" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="revenue" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Revenue
          </TabsTrigger>
          <TabsTrigger value="churn" className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4" />
            Churn
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="space-y-6">
          <AdvancedRevenueChart />
        </TabsContent>

        <TabsContent value="churn" className="space-y-6">
          <ChurnAnalysisChart />
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <CustomReportBuilder />
        </TabsContent>
      </Tabs>
    </div>
  );
}
