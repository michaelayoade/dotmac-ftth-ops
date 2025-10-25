"use client";

import { Suspense } from "react";
import { CommunicationsDashboard } from "@/components/communications/CommunicationsDashboard";

export default function CommunicationsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">Loading communications...</div>}>
      <div className="p-6 space-y-6">
        <CommunicationsDashboard />
      </div>
    </Suspense>
  );
}
