"use client";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import { TrendingUp, Wallet, Receipt, Calculator, Settings } from "lucide-react";
import { RevenueMetricsTab } from "./components/RevenueMetricsTab";
import { CommissionsTab } from "./components/CommissionsTab";
import { PayoutsTab } from "./components/PayoutsTab";
import { CommissionSimulator } from "@/components/partners/CommissionSimulator";
import { CommissionRulesManagement } from "@/components/partners/CommissionRulesManagement";

export default function PartnerRevenuePage() {
  const [activeTab, setActiveTab] = useState("metrics");

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Partner Revenue</h1>
        <p className="text-muted-foreground mt-2">
          Track commissions, view payouts, configure rules, and analyze your revenue performance
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5 lg:w-full">
          <TabsTrigger value="metrics" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Revenue Metrics</span>
            <span className="sm:hidden">Metrics</span>
          </TabsTrigger>
          <TabsTrigger value="commissions" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            <span className="hidden sm:inline">Commissions</span>
            <span className="sm:hidden">Comm.</span>
          </TabsTrigger>
          <TabsTrigger value="payouts" className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Payouts
          </TabsTrigger>
          <TabsTrigger value="rules" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Rules
          </TabsTrigger>
          <TabsTrigger value="simulator" className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            <span className="hidden sm:inline">Simulator</span>
            <span className="sm:hidden">Calc</span>
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

        <TabsContent value="rules" className="mt-6">
          <CommissionRulesManagement />
        </TabsContent>

        <TabsContent value="simulator" className="mt-6">
          <CommissionSimulator />
        </TabsContent>
      </Tabs>
    </div>
  );
}
