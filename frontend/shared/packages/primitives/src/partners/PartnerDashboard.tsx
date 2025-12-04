/**
 * Partner Management Dashboard
 * Configurable commission structures - no hardcoded rates
 */

import React, { useState, useEffect } from "react";
import {
  Users,
  TrendingUp,
  DollarSign,
  Settings,
  Plus,
  Filter,
  Search,
  MoreVertical,
} from "lucide-react";

import { Card } from "../layout/Card";
import { Button } from "../forms/Button";
import { Input } from "../forms/Input";
import { UniversalTable } from "../data-display/Table";
import { StatusIndicators } from "../indicators/StatusIndicators";
import { UniversalKPISection } from "../dashboard/UniversalKPISection";

interface Partner {
  id: string;
  company_name: string;
  partner_code: string;
  contact_name: string;
  contact_email: string;
  territory: string;
  tier: "bronze" | "silver" | "gold" | "platinum";
  status: "active" | "inactive" | "suspended" | "pending";
  commission_config_id?: string;
  total_revenue: number;
  customers_count: number;
  created_at: string;
}

interface CommissionConfig {
  id: string;
  name: string;
  commission_structure: string;
  rate_config: any;
  is_active: boolean;
  is_default: boolean;
}

interface PartnerDashboardProps {
  apiEndpoint?: string;
  onPartnerSelect?: (partner: Partner) => void;
  showCommissionConfig?: boolean;
}

export const PartnerDashboard: React.FC<PartnerDashboardProps> = ({
  apiEndpoint = "/api/isp/v1/admin/partners",
  onPartnerSelect,
  showCommissionConfig = true,
}) => {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [commissionConfigs, setCommissionConfigs] = useState<CommissionConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Load partners and commission configs
  useEffect(() => {
    loadPartners();
    if (showCommissionConfig) {
      loadCommissionConfigs();
    }
  }, []);

  const loadPartners = async () => {
    try {
      setLoading(true);
      const response = await fetch(apiEndpoint);
      const data = await response.json();
      setPartners(data.items || data);
    } catch (error) {
      console.error("Failed to load partners:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadCommissionConfigs = async () => {
    try {
      const response = await fetch("/api/isp/v1/admin/commission-config");
      const configs = await response.json();
      setCommissionConfigs(configs);
    } catch (error) {
      console.error("Failed to load commission configs:", error);
    }
  };

  // Filter partners
  const filteredPartners = partners.filter((partner) => {
    const matchesSearch =
      partner.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      partner.contact_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      partner.partner_code.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || partner.status === statusFilter;
    const matchesTier = tierFilter === "all" || partner.tier === tierFilter;

    return matchesSearch && matchesStatus && matchesTier;
  });

  // Calculate KPIs
  const kpis = [
    {
      id: "total-partners",
      title: "Total Partners",
      value: partners.length,
      trend: { direction: "up" as const, percentage: 12, label: "+12%" },
      icon: (props: { className?: string }) => <Users {...props} />,
    },
    {
      id: "active-partners",
      title: "Active Partners",
      value: partners.filter((p) => p.status === "active").length,
      trend: { direction: "up" as const, percentage: 8, label: "+8%" },
      icon: (props: { className?: string }) => <TrendingUp {...props} />,
    },
    {
      id: "total-revenue",
      title: "Total Revenue",
      value: `$${partners.reduce((sum, p) => sum + p.total_revenue, 0).toLocaleString()}`,
      trend: { direction: "up" as const, percentage: 15, label: "+15%" },
      icon: (props: { className?: string }) => <DollarSign {...props} />,
    },
    {
      id: "avg-revenue",
      title: "Avg Revenue per Partner",
      value:
        partners.length > 0
          ? `$${Math.round(partners.reduce((sum, p) => sum + p.total_revenue, 0) / partners.length).toLocaleString()}`
          : "$0",
      trend: { direction: "up" as const, percentage: 5, label: "+5%" },
      icon: (props: { className?: string }) => <TrendingUp {...props} />,
    },
  ];

  const tableColumns = [
    {
      key: "company_name",
      title: "Company",
      render: (_value: unknown, partner: Partner) => (
        <div>
          <div className="font-medium">{partner.company_name}</div>
          <div className="text-sm text-gray-500">{partner.partner_code}</div>
        </div>
      ),
    },
    {
      key: "contact_name",
      title: "Contact",
      render: (_value: unknown, partner: Partner) => (
        <div>
          <div className="font-medium">{partner.contact_name}</div>
          <div className="text-sm text-gray-500">{partner.contact_email}</div>
        </div>
      ),
    },
    {
      key: "territory",
      title: "Territory",
    },
    {
      key: "tier",
      title: "Tier",
      render: (_value: unknown, partner: Partner) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${getTierColor(partner.tier)}`}
        >
          {partner.tier.charAt(0).toUpperCase() + partner.tier.slice(1)}
        </span>
      ),
    },
    {
      key: "status",
      title: "Status",
      render: (_value: unknown, partner: Partner) => {
        const variant =
          partner.status === "inactive"
            ? "suspended"
            : partner.status === "pending"
              ? "pending"
              : "active";
        return <StatusIndicators status={variant} size="sm" showLabel />;
      },
    },
    {
      key: "total_revenue",
      title: "Revenue",
      render: (_value: unknown, partner: Partner) => `$${partner.total_revenue.toLocaleString()}`,
    },
    {
      key: "customers_count",
      title: "Customers",
    },
    {
      key: "actions",
      title: "",
      render: (_value: unknown, partner: Partner) => (
        <Button variant="ghost" size="sm" onClick={() => onPartnerSelect?.(partner)}>
          <MoreVertical className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  const getTierColor = (tier: string) => {
    const colors = {
      bronze: "bg-amber-100 text-amber-800",
      silver: "bg-gray-100 text-gray-800",
      gold: "bg-yellow-100 text-yellow-800",
      platinum: "bg-purple-100 text-purple-800",
    };
    return colors[tier as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <UniversalKPISection kpis={kpis} />

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Partners Table */}
        <div className="lg:col-span-3">
          <Card className="p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
              <h2 className="text-lg font-semibold mb-4 sm:mb-0">Partners</h2>
              <div className="flex flex-col sm:flex-row gap-2">
                {showCommissionConfig && (
                  <Button variant="outline" size="sm" onClick={() => setShowConfigModal(true)}>
                    <Settings className="h-4 w-4 mr-2" />
                    Commission Config
                  </Button>
                )}
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    /* Handle create partner */
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Partner
                </Button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search partners..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
                <option value="pending">Pending</option>
              </select>

              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Tiers</option>
                <option value="bronze">Bronze</option>
                <option value="silver">Silver</option>
                <option value="gold">Gold</option>
                <option value="platinum">Platinum</option>
              </select>
            </div>

            <UniversalTable
              columns={tableColumns}
              data={filteredPartners}
              loading={loading}
              emptyText="No partners found"
            />
          </Card>
        </div>

        {/* Commission Summary */}
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Commission Overview</h3>
            <div className="space-y-4">
              <div>
                <div className="text-sm text-gray-500">Active Configs</div>
                <div className="text-2xl font-bold">
                  {commissionConfigs.filter((c) => c.is_active).length}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Default Config</div>
                <div className="text-sm font-medium">
                  {commissionConfigs.find((c) => c.is_default)?.name || "Not set"}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Partners Using Custom</div>
                <div className="text-lg font-semibold">
                  {partners.filter((p) => p.commission_config_id).length}
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <Button variant="outline" size="sm" className="w-full justify-start">
                Export Partner Data
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start">
                Bulk Update Tiers
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start">
                Commission Report
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PartnerDashboard;
