"use client";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import { TrendingUp, Wallet, Receipt } from "lucide-react";
import { RevenueMetricsTab } from "./components/RevenueMetricsTab";
import { CommissionsTab } from "./components/CommissionsTab";
import { PayoutsTab } from "./components/PayoutsTab";

export default function PartnerRevenuePage() {
  const [activeTab, setActiveTab] = useState("metrics");

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Partner Revenue</h1>
        <p className="text-muted-foreground mt-2">
          Track commissions, view payouts, and analyze your revenue performance
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 lg:w-[600px]">
          <TabsTrigger value="metrics" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Revenue Metrics
          </TabsTrigger>
          <TabsTrigger value="commissions" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Commissions
          </TabsTrigger>
          <TabsTrigger value="payouts" className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Payouts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="mt-6">
          <RevenueMetricsTab />
        </TabsContent>

        <TabsContent value="commissions" className="mt-6">
          <CommissionsTab />
        </TabsContent>

        <TabsContent value="payouts" className="mt-6">
          <PayoutsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
