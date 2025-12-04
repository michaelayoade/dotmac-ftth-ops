"use client";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import { Building2, Receipt, CheckSquare } from "lucide-react";
import { BankAccountsTab } from "./components/BankAccountsTab";
import { ManualPaymentsTab } from "./components/ManualPaymentsTab";
import { ReconciliationTab } from "./components/ReconciliationTab";

export default function BankingPage() {
  const [activeTab, setActiveTab] = useState("accounts");

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Banking & Payments</h1>
        <p className="text-muted-foreground mt-2">
          Manage bank accounts, record manual payments, and reconcile transactions
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 lg:w-[600px]">
          <TabsTrigger value="accounts" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Bank Accounts
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Manual Payments
          </TabsTrigger>
          <TabsTrigger value="reconciliation" className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4" />
            Reconciliation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="mt-6">
          <BankAccountsTab />
        </TabsContent>

        <TabsContent value="payments" className="mt-6">
          <ManualPaymentsTab />
        </TabsContent>

        <TabsContent value="reconciliation" className="mt-6">
          <ReconciliationTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
