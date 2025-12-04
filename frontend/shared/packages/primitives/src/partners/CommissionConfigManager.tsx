/**
 * Commission Configuration Manager
 * Allows admins to create and manage flexible commission structures
 */

import React, { useState, useEffect } from "react";
import {
  Plus,
  Edit,
  Trash2,
  Star,
  Copy,
  Calendar,
  DollarSign,
  Percent,
  TrendingUp,
  Settings,
} from "lucide-react";

import { Card } from "../layout/Card";
import { Button } from "../forms/Button";
import { Input } from "../forms/Input";
import {
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalFooter,
} from "../layout/Modal";
import { UniversalTable } from "../data-display/Table";
import { StatusIndicators } from "../indicators/StatusIndicators";

interface CommissionConfig {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  is_default: boolean;
  reseller_type?: string;
  reseller_tier?: string;
  territory?: string;
  commission_structure: "flat_rate" | "percentage" | "tiered" | "performance_based" | "hybrid";
  rate_config: any;
  effective_from: string;
  effective_until?: string;
  calculate_on: "revenue" | "signup" | "both";
  payment_frequency: "monthly" | "quarterly" | "annual";
  minimum_payout: number;
  settings: any;
  created_at: string;
  updated_at: string;
}

interface CommissionConfigManagerProps {
  apiEndpoint?: string;
  onConfigChange?: (config: CommissionConfig) => void;
}

const extractDatePart = (isoString: string): string => {
  const [datePart] = isoString.split("T");
  return datePart ?? isoString;
};

export const CommissionConfigManager: React.FC<CommissionConfigManagerProps> = ({
  apiEndpoint = "/api/isp/v1/admin/commission-config",
  onConfigChange,
}) => {
  const [configs, setConfigs] = useState<CommissionConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<CommissionConfig | null>(null);
  const [formData, setFormData] = useState<Partial<CommissionConfig>>({});

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const response = await fetch(apiEndpoint);
      const data = await response.json();
      setConfigs(data);
    } catch (error) {
      console.error("Failed to load commission configs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingConfig(null);
    const initialData: Partial<CommissionConfig> = {
      name: "",
      description: "",
      is_active: true,
      is_default: false,
      commission_structure: "percentage",
      rate_config: { percentage: "10.0" },
      effective_from: extractDatePart(new Date().toISOString()),
      calculate_on: "revenue",
      payment_frequency: "monthly",
      minimum_payout: 50.0,
      settings: {},
    };
    setFormData(initialData);
    setShowModal(true);
  };

  const handleEdit = (config: CommissionConfig) => {
    setEditingConfig(config);
    const editableData: Partial<CommissionConfig> = {
      ...config,
      effective_from: extractDatePart(config.effective_from),
      effective_until: config.effective_until ? extractDatePart(config.effective_until) : "",
    };
    setFormData(editableData);
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      const method = editingConfig ? "PUT" : "POST";
      const url = editingConfig ? `${apiEndpoint}/${editingConfig.id}` : apiEndpoint;

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const saved = await response.json();
        onConfigChange?.(saved);
        setShowModal(false);
        loadConfigs();
      }
    } catch (error) {
      console.error("Failed to save commission config:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this commission configuration?")) return;

    try {
      const response = await fetch(`${apiEndpoint}/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        loadConfigs();
      }
    } catch (error) {
      console.error("Failed to delete commission config:", error);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      const response = await fetch(`${apiEndpoint}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_default: true }),
      });

      if (response.ok) {
        loadConfigs();
      }
    } catch (error) {
      console.error("Failed to set default config:", error);
    }
  };

  const renderRateConfig = (structure: string, rateConfig: any) => {
    switch (structure) {
      case "flat_rate":
        return `$${rateConfig.amount || 0}`;
      case "percentage":
        return `${rateConfig.percentage || 0}%`;
      case "tiered":
        return `${rateConfig.tiers?.length || 0} tiers`;
      case "performance_based":
        return `Base: ${rateConfig.base_rate || 0}%`;
      case "hybrid":
        return "Custom structure";
      default:
        return "Not configured";
    }
  };

  const renderStructureIcon = (structure: string) => {
    const icons = {
      flat_rate: <DollarSign className="h-4 w-4" />,
      percentage: <Percent className="h-4 w-4" />,
      tiered: <TrendingUp className="h-4 w-4" />,
      performance_based: <TrendingUp className="h-4 w-4" />,
      hybrid: <Settings className="h-4 w-4" />,
    };
    return icons[structure as keyof typeof icons] || <DollarSign className="h-4 w-4" />;
  };

  const tableColumns = [
    {
      key: "name",
      title: "Configuration",
      render: (_value: unknown, config: CommissionConfig) => (
        <div className="flex items-center space-x-2">
          {config.is_default && <Star className="h-4 w-4 text-yellow-500 fill-current" />}
          <div>
            <div className="font-medium">{config.name}</div>
            {config.description && (
              <div className="text-sm text-gray-500">{config.description}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "commission_structure",
      title: "Structure",
      render: (_value: unknown, config: CommissionConfig) => (
        <div className="flex items-center space-x-2">
          {renderStructureIcon(config.commission_structure)}
          <span className="capitalize">{config.commission_structure.replace("_", " ")}</span>
        </div>
      ),
    },
    {
      key: "rate_config",
      title: "Rate",
      render: (_value: unknown, config: CommissionConfig) =>
        renderRateConfig(config.commission_structure, config.rate_config),
    },
    {
      key: "filters",
      title: "Applies To",
      render: (_value: unknown, config: CommissionConfig) => (
        <div className="text-sm">
          {config.reseller_type && <div>Type: {config.reseller_type.replace("_", " ")}</div>}
          {config.reseller_tier && <div>Tier: {config.reseller_tier}</div>}
          {config.territory && <div>Territory: {config.territory}</div>}
          {!config.reseller_type && !config.reseller_tier && !config.territory && (
            <span className="text-gray-500">All partners</span>
          )}
        </div>
      ),
    },
    {
      key: "payment_frequency",
      title: "Frequency",
      render: (_value: unknown, config: CommissionConfig) => (
        <span className="capitalize">{config.payment_frequency}</span>
      ),
    },
    {
      key: "is_active",
      title: "Status",
      render: (_value: unknown, config: CommissionConfig) => {
        const variant = config.is_active ? "active" : "suspended";
        return <StatusIndicators status={variant} size="sm" showLabel />;
      },
    },
    {
      key: "actions",
      title: "Actions",
      render: (_value: unknown, config: CommissionConfig) => (
        <div className="flex items-center space-x-1">
          <Button variant="ghost" size="sm" onClick={() => handleEdit(config)}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleSetDefault(config.id)}
            disabled={config.is_default}
          >
            <Star className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(config.id)}
            disabled={config.is_default}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <Card className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-lg font-semibold">Commission Configuration</h2>
            <p className="text-sm text-gray-500">
              Manage flexible commission structures for different partner types
            </p>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            New Configuration
          </Button>
        </div>

        <UniversalTable
          columns={tableColumns}
          data={configs}
          loading={loading}
          emptyText="No commission configurations found"
        />
      </Card>

      {/* Configuration Modal */}
      <Modal open={showModal} onOpenChange={setShowModal}>
        <ModalBackdrop />
        <ModalContent size="lg" aria-label="Commission configuration modal">
          <ModalHeader>
            <ModalTitle>
              {editingConfig ? "Edit Commission Configuration" : "New Commission Configuration"}
            </ModalTitle>
          </ModalHeader>
          <ModalBody>
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <Input
                    value={formData.name || ""}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Standard Partner Commission"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Commission Structure *
                  </label>
                  <select
                    value={formData.commission_structure || "percentage"}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        commission_structure: e.target.value as any,
                        rate_config: e.target.value === "percentage" ? { percentage: "10.0" } : {},
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="flat_rate">Flat Rate</option>
                    <option value="percentage">Percentage</option>
                    <option value="tiered">Tiered</option>
                    <option value="performance_based">Performance Based</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Description of this commission structure..."
                />
              </div>

              {/* Rate Configuration */}
              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-3">Rate Configuration</h3>

                {formData.commission_structure === "percentage" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Commission Percentage *
                    </label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={formData.rate_config?.percentage || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            rate_config: { percentage: e.target.value },
                          })
                        }
                        placeholder="10.5"
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                        <span className="text-gray-500">%</span>
                      </div>
                    </div>
                  </div>
                )}

                {formData.commission_structure === "flat_rate" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fixed Amount *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                        <span className="text-gray-500">$</span>
                      </div>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.rate_config?.amount || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            rate_config: { amount: e.target.value },
                          })
                        }
                        className="pl-8"
                        placeholder="100.00"
                      />
                    </div>
                  </div>
                )}

                {formData.commission_structure === "tiered" && (
                  <div>
                    <p className="text-sm text-gray-600 mb-2">
                      Tiered structure will be configured through advanced settings
                    </p>
                    <Button variant="outline" size="sm">
                      Configure Tiers
                    </Button>
                  </div>
                )}
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reseller Type
                  </label>
                  <select
                    value={formData.reseller_type || ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFormData((prev) => {
                        if (!value) {
                          const { reseller_type: _omit, ...rest } = prev;
                          return rest;
                        }
                        return { ...prev, reseller_type: value };
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Types</option>
                    <option value="authorized_dealer">Authorized Dealer</option>
                    <option value="value_added_reseller">Value Added Reseller</option>
                    <option value="system_integrator">System Integrator</option>
                    <option value="distributor">Distributor</option>
                    <option value="referral_partner">Referral Partner</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reseller Tier
                  </label>
                  <select
                    value={formData.reseller_tier || ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFormData((prev) => {
                        if (!value) {
                          const { reseller_tier: _omit, ...rest } = prev;
                          return rest;
                        }
                        return { ...prev, reseller_tier: value };
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Tiers</option>
                    <option value="bronze">Bronze</option>
                    <option value="silver">Silver</option>
                    <option value="gold">Gold</option>
                    <option value="platinum">Platinum</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Territory</label>
                  <Input
                    value={formData.territory || ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFormData((prev) => {
                        if (!value) {
                          const { territory: _omit, ...rest } = prev;
                          return rest;
                        }
                        return { ...prev, territory: value };
                      });
                    }}
                    placeholder="e.g., North America"
                  />
                </div>
              </div>

              {/* Settings */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Frequency
                  </label>
                  <select
                    value={formData.payment_frequency || "monthly"}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        payment_frequency: e.target.value as any,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Minimum Payout
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                      <span className="text-gray-500">$</span>
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.minimum_payout || 50}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          minimum_payout: parseFloat(e.target.value),
                        })
                      }
                      className="pl-8"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Calculate On
                  </label>
                  <select
                    value={formData.calculate_on || "revenue"}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        calculate_on: e.target.value as any,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="revenue">Revenue</option>
                    <option value="signup">Signup</option>
                    <option value="both">Both</option>
                  </select>
                </div>
              </div>

              {/* Effective Period */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Effective From *
                  </label>
                  <Input
                    type="date"
                    value={formData.effective_from || ""}
                    onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Effective Until
                  </label>
                  <Input
                    type="date"
                    value={formData.effective_until || ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFormData((prev) => {
                        if (!value) {
                          const { effective_until: _omit, ...rest } = prev;
                          return rest;
                        }
                        return { ...prev, effective_until: value };
                      });
                    }}
                  />
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center space-x-6">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_active || false}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm">Active</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_default || false}
                    onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm">Set as Default</span>
                </label>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>
                {editingConfig ? "Update" : "Create"} Configuration
              </Button>
            </div>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default CommissionConfigManager;
