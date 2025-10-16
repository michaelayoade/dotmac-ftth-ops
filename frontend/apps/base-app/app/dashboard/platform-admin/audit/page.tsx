'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, BarChart3 } from 'lucide-react';
import { AuditLogViewer } from '../components/AuditLogViewer';
import { AuditSummaryDashboard } from '../components/AuditSummaryDashboard';

export default function PlatformAdminAuditPage() {
  const [activeTab, setActiveTab] = useState('summary');

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="h-8 w-8" />
          Audit & Compliance
        </h1>
        <p className="text-muted-foreground mt-1">
          Monitor security activities and maintain compliance across your platform
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="summary" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Summary Dashboard
          </TabsTrigger>
          <TabsTrigger value="activities" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Activity Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-6">
          <AuditSummaryDashboard />
        </TabsContent>

        <TabsContent value="activities" className="mt-6">
          <AuditLogViewer />
        </TabsContent>
      </Tabs>
    </div>
  );
}
