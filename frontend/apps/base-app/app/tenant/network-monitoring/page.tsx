import { Metadata } from "next";
import { NetworkMonitoringDashboard } from "@/components/network-monitoring/NetworkMonitoringDashboard";

export const metadata: Metadata = {
  title: "Network Monitoring | DOTMAC ISP Platform",
  description: "Real-time network device health and performance monitoring",
};

export default function NetworkMonitoringPage() {
  return (
    <div className="container mx-auto py-6">
      <NetworkMonitoringDashboard />
    </div>
  );
}
