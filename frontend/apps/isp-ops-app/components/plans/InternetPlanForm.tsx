"use client";

/**
 * Internet Service Plan Form Component
 *
 * Comprehensive form for creating and editing ISP internet service plans
 * with full FUP, data cap, and traffic shaping configuration.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@dotmac/ui";
import { Card } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import {
  Save,
  X,
  ChevronDown,
  ChevronUp,
  Zap,
  Shield,
  Clock,
  DollarSign,
  Settings,
  AlertCircle,
  Info,
  CheckCircle,
} from "lucide-react";
import type {
  InternetServicePlan,
  InternetServicePlanCreate,
  PlanType,
  PlanStatus,
  SpeedUnit,
  DataUnit,
  ThrottlePolicy,
  BillingCycle,
} from "../../types/internet-plans";

interface InternetPlanFormProps {
  plan?: InternetServicePlan; // If editing
  onSubmit: (data: InternetServicePlanCreate) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function InternetPlanForm({
  plan,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: InternetPlanFormProps) {
  const router = useRouter();
  const isEditing = !!plan;

  // Expanded sections state
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    speed: true,
    dataCap: false,
    fup: false,
    timeRestrictions: false,
    qos: false,
    pricing: true,
    technical: false,
    additional: false,
  });

  // Form state
  const [formData, setFormData] = useState<InternetServicePlanCreate>({
    // Basic info
    plan_code: plan?.plan_code || "",
    name: plan?.name || "",
    description: plan?.description || "",
    plan_type: plan?.plan_type || ("residential" as PlanType),
    status: plan?.status || ("draft" as PlanStatus),

    // Speed configuration
    download_speed: plan?.download_speed || 100,
    upload_speed: plan?.upload_speed || 50,
    speed_unit: plan?.speed_unit || ("mbps" as SpeedUnit),
    burst_download_speed: plan?.burst_download_speed || null,
    burst_upload_speed: plan?.burst_upload_speed || null,
    burst_duration_seconds: plan?.burst_duration_seconds || null,

    // Data cap
    has_data_cap: plan?.has_data_cap || false,
    data_cap_amount: plan?.data_cap_amount || null,
    data_cap_unit: plan?.data_cap_unit || ("GB" as DataUnit),
    throttle_policy: plan?.throttle_policy || ("no_throttle" as ThrottlePolicy),
    throttled_download_speed: plan?.throttled_download_speed || null,
    throttled_upload_speed: plan?.throttled_upload_speed || null,
    overage_price_per_unit: plan?.overage_price_per_unit || null,
    overage_unit: plan?.overage_unit || ("GB" as DataUnit),

    // FUP
    has_fup: plan?.has_fup || false,
    fup_threshold: plan?.fup_threshold || null,
    fup_threshold_unit: plan?.fup_threshold_unit || ("GB" as DataUnit),
    fup_throttle_speed: plan?.fup_throttle_speed || null,

    // Time restrictions
    has_time_restrictions: plan?.has_time_restrictions || false,
    unrestricted_start_time: plan?.unrestricted_start_time || null,
    unrestricted_end_time: plan?.unrestricted_end_time || null,
    unrestricted_data_unlimited: plan?.unrestricted_data_unlimited || false,
    unrestricted_speed_multiplier: plan?.unrestricted_speed_multiplier || null,

    // QoS
    qos_priority: plan?.qos_priority || 50,
    traffic_shaping_enabled: plan?.traffic_shaping_enabled || false,

    // Pricing
    monthly_price: plan?.monthly_price || 0,
    setup_fee: plan?.setup_fee || 0,
    currency: plan?.currency || "USD",
    billing_cycle: plan?.billing_cycle || ("monthly" as BillingCycle),

    // Availability
    is_public: plan?.is_public || true,
    is_promotional: plan?.is_promotional || false,
    promotion_start_date: plan?.promotion_start_date || null,
    promotion_end_date: plan?.promotion_end_date || null,

    // Contract
    minimum_contract_months: plan?.minimum_contract_months || 0,
    early_termination_fee: plan?.early_termination_fee || 0,

    // Technical
    contention_ratio: plan?.contention_ratio || null,
    ipv4_included: plan?.ipv4_included !== undefined ? plan.ipv4_included : true,
    ipv6_included: plan?.ipv6_included !== undefined ? plan.ipv6_included : true,
    static_ip_included: plan?.static_ip_included || false,
    static_ip_count: plan?.static_ip_count || 0,

    // Additional
    router_included: plan?.router_included || false,
    installation_included: plan?.installation_included || false,
    technical_support_level: plan?.technical_support_level || null,

    // Metadata
    tags: plan?.tags || {},
    features: plan?.features || [],
    restrictions: plan?.restrictions || [],
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const updateField = <K extends keyof InternetServicePlanCreate>(
    field: K,
    value: InternetServicePlanCreate[K],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Form Actions - Top */}
      <div className="flex items-center justify-between sticky top-0 z-10 bg-white p-4 border-b shadow-sm">
        <div>
          <h2 className="text-2xl font-bold">{isEditing ? "Edit Plan" : "Create New Plan"}</h2>
          <p className="text-sm text-muted-foreground">
            {isEditing ? `Editing: ${plan.name}` : "Configure your internet service plan"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            <Save className="mr-2 h-4 w-4" />
            {isSubmitting ? "Saving..." : isEditing ? "Save Changes" : "Create Plan"}
          </Button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* SECTION: Basic Information */}
      {/* ============================================================ */}
      <Card className="p-6">
        <button
          type="button"
          onClick={() => toggleSection("basic")}
          className="w-full flex items-center justify-between mb-4"
        >
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Info className="h-5 w-5" />
            Basic Information
          </h3>
          {expandedSections.basic ? (
            <ChevronUp className="h-5 w-5" />
          ) : (
            <ChevronDown className="h-5 w-5" />
          )}
        </button>

        {expandedSections.basic && (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Plan Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.plan_code}
                onChange={(e) => updateField("plan_code", e.target.value)}
                placeholder="e.g., HOME-100"
                className="w-full border rounded-md px-3 py-2"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">Unique identifier for the plan</p>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Plan Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="e.g., Home 100Mbps"
                className="w-full border rounded-md px-3 py-2"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-medium mb-2 block">Description</label>
              <textarea
                value={formData.description || ""}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder="Plan description and key features..."
                className="w-full border rounded-md px-3 py-2"
                rows={3}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Plan Type</label>
              <select
                value={formData.plan_type}
                onChange={(e) => updateField("plan_type", e.target.value as PlanType)}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="residential">Residential</option>
                <option value="business">Business</option>
                <option value="enterprise">Enterprise</option>
                <option value="promotional">Promotional</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <select
                value={formData.status}
                onChange={(e) => updateField("status", e.target.value as PlanStatus)}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>
        )}
      </Card>

      {/* ============================================================ */}
      {/* SECTION: Speed Configuration */}
      {/* ============================================================ */}
      <Card className="p-6">
        <button
          type="button"
          onClick={() => toggleSection("speed")}
          className="w-full flex items-center justify-between mb-4"
        >
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-500" />
            Speed Configuration
          </h3>
          {expandedSections.speed ? (
            <ChevronUp className="h-5 w-5" />
          ) : (
            <ChevronDown className="h-5 w-5" />
          )}
        </button>

        {expandedSections.speed && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Download Speed <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.download_speed}
                  onChange={(e) => updateField("download_speed", Number(e.target.value))}
                  className="w-full border rounded-md px-3 py-2"
                  min="0"
                  step="any"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Upload Speed <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.upload_speed}
                  onChange={(e) => updateField("upload_speed", Number(e.target.value))}
                  className="w-full border rounded-md px-3 py-2"
                  min="0"
                  step="any"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Speed Unit</label>
                <select
                  value={formData.speed_unit}
                  onChange={(e) => updateField("speed_unit", e.target.value as SpeedUnit)}
                  className="w-full border rounded-md px-3 py-2"
                >
                  <option value="kbps">Kbps</option>
                  <option value="mbps">Mbps</option>
                  <option value="gbps">Gbps</option>
                </select>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold mb-3 text-sm">Burst Speeds (Optional)</h4>
              <p className="text-xs text-muted-foreground mb-3">
                Temporarily boost speed for better user experience on short transfers
              </p>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="text-sm font-medium mb-2 block">Burst Download</label>
                  <input
                    type="number"
                    value={formData.burst_download_speed || ""}
                    onChange={(e) =>
                      updateField(
                        "burst_download_speed",
                        e.target.value ? Number(e.target.value) : null,
                      )
                    }
                    className="w-full border rounded-md px-3 py-2"
                    min="0"
                    step="any"
                    placeholder="Optional"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Burst Upload</label>
                  <input
                    type="number"
                    value={formData.burst_upload_speed || ""}
                    onChange={(e) =>
                      updateField(
                        "burst_upload_speed",
                        e.target.value ? Number(e.target.value) : null,
                      )
                    }
                    className="w-full border rounded-md px-3 py-2"
                    min="0"
                    step="any"
                    placeholder="Optional"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Burst Duration (seconds)</label>
                  <input
                    type="number"
                    value={formData.burst_duration_seconds || ""}
                    onChange={(e) =>
                      updateField(
                        "burst_duration_seconds",
                        e.target.value ? Number(e.target.value) : null,
                      )
                    }
                    className="w-full border rounded-md px-3 py-2"
                    min="0"
                    placeholder="e.g., 30"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* ============================================================ */}
      {/* SECTION: Data Cap & Throttling */}
      {/* ============================================================ */}
      <Card className="p-6 border-purple-200">
        <button
          type="button"
          onClick={() => toggleSection("dataCap")}
          className="w-full flex items-center justify-between mb-4"
        >
          <h3 className="text-lg font-bold flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-purple-500" />
            Data Cap & Throttling
            {formData.has_data_cap && <Badge variant="secondary">Enabled</Badge>}
          </h3>
          {expandedSections.dataCap ? (
            <ChevronUp className="h-5 w-5" />
          ) : (
            <ChevronDown className="h-5 w-5" />
          )}
        </button>

        {expandedSections.dataCap && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-purple-50 border border-purple-200 rounded">
              <input
                type="checkbox"
                id="has_data_cap"
                checked={formData.has_data_cap}
                onChange={(e) => updateField("has_data_cap", e.target.checked)}
                className="h-4 w-4"
              />
              <label htmlFor="has_data_cap" className="text-sm font-medium cursor-pointer">
                Enable Data Cap
              </label>
            </div>

            {formData.has_data_cap && (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Data Cap Amount</label>
                    <input
                      type="number"
                      value={formData.data_cap_amount || ""}
                      onChange={(e) =>
                        updateField(
                          "data_cap_amount",
                          e.target.value ? Number(e.target.value) : null,
                        )
                      }
                      className="w-full border rounded-md px-3 py-2"
                      min="0"
                      placeholder="e.g., 500"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Data Cap Unit</label>
                    <select
                      value={formData.data_cap_unit || "GB"}
                      onChange={(e) => updateField("data_cap_unit", e.target.value as DataUnit)}
                      className="w-full border rounded-md px-3 py-2"
                    >
                      <option value="MB">MB</option>
                      <option value="GB">GB</option>
                      <option value="TB">TB</option>
                      <option value="unlimited">Unlimited</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Throttle Policy</label>
                  <select
                    value={formData.throttle_policy}
                    onChange={(e) =>
                      updateField("throttle_policy", e.target.value as ThrottlePolicy)
                    }
                    className="w-full border rounded-md px-3 py-2"
                  >
                    <option value="no_throttle">No Throttle (informational only)</option>
                    <option value="throttle">Throttle (reduce speed)</option>
                    <option value="block">Block (stop traffic)</option>
                    <option value="overage_charge">Overage Charge (bill extra)</option>
                  </select>
                </div>

                {formData.throttle_policy === "throttle" && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Throttled Download Speed
                      </label>
                      <input
                        type="number"
                        value={formData.throttled_download_speed || ""}
                        onChange={(e) =>
                          updateField(
                            "throttled_download_speed",
                            e.target.value ? Number(e.target.value) : null,
                          )
                        }
                        className="w-full border rounded-md px-3 py-2"
                        min="0"
                        step="any"
                        placeholder="e.g., 10"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Throttled Upload Speed
                      </label>
                      <input
                        type="number"
                        value={formData.throttled_upload_speed || ""}
                        onChange={(e) =>
                          updateField(
                            "throttled_upload_speed",
                            e.target.value ? Number(e.target.value) : null,
                          )
                        }
                        className="w-full border rounded-md px-3 py-2"
                        min="0"
                        step="any"
                        placeholder="e.g., 5"
                      />
                    </div>
                  </div>
                )}

                {formData.throttle_policy === "overage_charge" && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Overage Price (per unit)
                      </label>
                      <input
                        type="number"
                        value={formData.overage_price_per_unit || ""}
                        onChange={(e) =>
                          updateField(
                            "overage_price_per_unit",
                            e.target.value ? Number(e.target.value) : null,
                          )
                        }
                        className="w-full border rounded-md px-3 py-2"
                        min="0"
                        step="0.01"
                        placeholder="e.g., 5.00"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">Overage Unit</label>
                      <select
                        value={formData.overage_unit || "GB"}
                        onChange={(e) => updateField("overage_unit", e.target.value as DataUnit)}
                        className="w-full border rounded-md px-3 py-2"
                      >
                        <option value="MB">per MB</option>
                        <option value="GB">per GB</option>
                        <option value="TB">per TB</option>
                      </select>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Card>

      {/* ============================================================ */}
      {/* SECTION: Fair Usage Policy (FUP) */}
      {/* ============================================================ */}
      <Card className="p-6 border-blue-200">
        <button
          type="button"
          onClick={() => toggleSection("fup")}
          className="w-full flex items-center justify-between mb-4"
        >
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-500" />
            Fair Usage Policy (FUP)
            {formData.has_fup && <Badge variant="secondary">Enabled</Badge>}
          </h3>
          {expandedSections.fup ? (
            <ChevronUp className="h-5 w-5" />
          ) : (
            <ChevronDown className="h-5 w-5" />
          )}
        </button>

        {expandedSections.fup && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded">
              <input
                type="checkbox"
                id="has_fup"
                checked={formData.has_fup}
                onChange={(e) => updateField("has_fup", e.target.checked)}
                className="h-4 w-4"
              />
              <label htmlFor="has_fup" className="text-sm font-medium cursor-pointer">
                Enable Fair Usage Policy (FUP)
              </label>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm">
              <p className="font-semibold mb-1">What is FUP?</p>
              <p className="text-muted-foreground">
                FUP automatically throttles user speeds after they exceed a data threshold. Unlike
                data caps, FUP doesn’t stop service – it just reduces speed to maintain network
                quality for all users.
              </p>
            </div>

            {formData.has_fup && (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium mb-2 block">FUP Threshold</label>
                    <input
                      type="number"
                      value={formData.fup_threshold || ""}
                      onChange={(e) =>
                        updateField("fup_threshold", e.target.value ? Number(e.target.value) : null)
                      }
                      className="w-full border rounded-md px-3 py-2"
                      min="0"
                      placeholder="e.g., 500"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Data limit before throttling kicks in
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">FUP Threshold Unit</label>
                    <select
                      value={formData.fup_threshold_unit || "GB"}
                      onChange={(e) =>
                        updateField("fup_threshold_unit", e.target.value as DataUnit)
                      }
                      className="w-full border rounded-md px-3 py-2"
                    >
                      <option value="MB">MB</option>
                      <option value="GB">GB</option>
                      <option value="TB">TB</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">FUP Throttle Speed</label>
                  <input
                    type="number"
                    value={formData.fup_throttle_speed || ""}
                    onChange={(e) =>
                      updateField(
                        "fup_throttle_speed",
                        e.target.value ? Number(e.target.value) : null,
                      )
                    }
                    className="w-full border rounded-md px-3 py-2"
                    min="0"
                    step="any"
                    placeholder="e.g., 10"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Speed after FUP threshold (in {formData.speed_unit})
                  </p>
                </div>

                {/* FUP Preview */}
                {formData.fup_threshold && formData.fup_throttle_speed && (
                  <div className="p-4 bg-gradient-to-r from-green-50 to-orange-50 border border-blue-200 rounded">
                    <p className="text-sm font-semibold mb-2">FUP Preview:</p>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="px-2 py-1 bg-green-500 text-white rounded">
                        {formData.download_speed} {formData.speed_unit}
                      </span>
                      <span>
                        → After {formData.fup_threshold} {formData.fup_threshold_unit} →
                      </span>
                      <span className="px-2 py-1 bg-orange-500 text-white rounded">
                        {formData.fup_throttle_speed} {formData.speed_unit}
                      </span>
                      <span className="ml-2 text-red-600 font-bold">
                        (
                        {(
                          ((Number(formData.download_speed) - Number(formData.fup_throttle_speed)) /
                            Number(formData.download_speed)) *
                          100
                        ).toFixed(0)}
                        % reduction)
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Card>

      {/* ============================================================ */}
      {/* SECTION: Time-Based Restrictions */}
      {/* ============================================================ */}
      <Card className="p-6 border-indigo-200">
        <button
          type="button"
          onClick={() => toggleSection("timeRestrictions")}
          className="w-full flex items-center justify-between mb-4"
        >
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Clock className="h-5 w-5 text-indigo-500" />
            Time-Based Restrictions
            {formData.has_time_restrictions && <Badge variant="secondary">Enabled</Badge>}
          </h3>
          {expandedSections.timeRestrictions ? (
            <ChevronUp className="h-5 w-5" />
          ) : (
            <ChevronDown className="h-5 w-5" />
          )}
        </button>

        {expandedSections.timeRestrictions && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-indigo-50 border border-indigo-200 rounded">
              <input
                type="checkbox"
                id="has_time_restrictions"
                checked={formData.has_time_restrictions}
                onChange={(e) => updateField("has_time_restrictions", e.target.checked)}
                className="h-4 w-4"
              />
              <label htmlFor="has_time_restrictions" className="text-sm font-medium cursor-pointer">
                Enable Time-Based Restrictions (e.g., “Unlimited Nights”)
              </label>
            </div>

            {formData.has_time_restrictions && (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Unrestricted Start Time
                    </label>
                    <input
                      type="time"
                      value={formData.unrestricted_start_time || ""}
                      onChange={(e) =>
                        updateField("unrestricted_start_time", e.target.value || null)
                      }
                      className="w-full border rounded-md px-3 py-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">e.g., 23:00 (11 PM)</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Unrestricted End Time</label>
                    <input
                      type="time"
                      value={formData.unrestricted_end_time || ""}
                      onChange={(e) => updateField("unrestricted_end_time", e.target.value || null)}
                      className="w-full border rounded-md px-3 py-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">e.g., 07:00 (7 AM)</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="unrestricted_data_unlimited"
                      checked={formData.unrestricted_data_unlimited}
                      onChange={(e) => updateField("unrestricted_data_unlimited", e.target.checked)}
                      className="h-4 w-4"
                    />
                    <label htmlFor="unrestricted_data_unlimited" className="text-sm cursor-pointer">
                      Unlimited data during unrestricted hours (doesn’t count toward FUP/data cap)
                    </label>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Speed Multiplier (Optional)
                    </label>
                    <input
                      type="number"
                      value={formData.unrestricted_speed_multiplier || ""}
                      onChange={(e) =>
                        updateField(
                          "unrestricted_speed_multiplier",
                          e.target.value ? Number(e.target.value) : null,
                        )
                      }
                      className="w-full border rounded-md px-3 py-2"
                      min="1"
                      step="0.1"
                      placeholder="e.g., 2.0"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Boost speed during unrestricted hours (2.0 = 2x speed)
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </Card>

      {/* ============================================================ */}
      {/* SECTION: QoS & Traffic Shaping */}
      {/* ============================================================ */}
      <Card className="p-6">
        <button
          type="button"
          onClick={() => toggleSection("qos")}
          className="w-full flex items-center justify-between mb-4"
        >
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Settings className="h-5 w-5" />
            QoS & Traffic Shaping
          </h3>
          {expandedSections.qos ? (
            <ChevronUp className="h-5 w-5" />
          ) : (
            <ChevronDown className="h-5 w-5" />
          )}
        </button>

        {expandedSections.qos && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">QoS Priority (0-100)</label>
              <input
                type="range"
                value={formData.qos_priority}
                onChange={(e) => updateField("qos_priority", Number(e.target.value))}
                className="w-full"
                min="0"
                max="100"
                step="10"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>Low (0)</span>
                <span className="font-bold text-lg">{formData.qos_priority ?? 0}</span>
                <span>High (100)</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {(formData.qos_priority ?? 0) >= 80 && "Critical priority - guaranteed bandwidth"}
                {(formData.qos_priority ?? 0) >= 50 &&
                  (formData.qos_priority ?? 0) < 80 &&
                  "High priority - minimal throttling"}
                {(formData.qos_priority ?? 0) >= 30 &&
                  (formData.qos_priority ?? 0) < 50 &&
                  "Medium priority - standard service"}
                {(formData.qos_priority ?? 0) < 30 && "Low priority - best effort service"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="traffic_shaping_enabled"
                checked={formData.traffic_shaping_enabled}
                onChange={(e) => updateField("traffic_shaping_enabled", e.target.checked)}
                className="h-4 w-4"
              />
              <label htmlFor="traffic_shaping_enabled" className="text-sm cursor-pointer">
                Enable Traffic Shaping
              </label>
            </div>
          </div>
        )}
      </Card>

      {/* ============================================================ */}
      {/* SECTION: Pricing */}
      {/* ============================================================ */}
      <Card className="p-6 border-green-200">
        <button
          type="button"
          onClick={() => toggleSection("pricing")}
          className="w-full flex items-center justify-between mb-4"
        >
          <h3 className="text-lg font-bold flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-500" />
            Pricing & Contract
          </h3>
          {expandedSections.pricing ? (
            <ChevronUp className="h-5 w-5" />
          ) : (
            <ChevronDown className="h-5 w-5" />
          )}
        </button>

        {expandedSections.pricing && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Monthly Price <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.monthly_price}
                  onChange={(e) => updateField("monthly_price", Number(e.target.value))}
                  className="w-full border rounded-md px-3 py-2"
                  min="0"
                  step="0.01"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Setup Fee</label>
                <input
                  type="number"
                  value={formData.setup_fee}
                  onChange={(e) => updateField("setup_fee", Number(e.target.value))}
                  className="w-full border rounded-md px-3 py-2"
                  min="0"
                  step="0.01"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Currency</label>
                <input
                  type="text"
                  value={formData.currency}
                  onChange={(e) => updateField("currency", e.target.value)}
                  className="w-full border rounded-md px-3 py-2"
                  placeholder="USD"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium mb-2 block">Billing Cycle</label>
                <select
                  value={formData.billing_cycle}
                  onChange={(e) => updateField("billing_cycle", e.target.value as BillingCycle)}
                  className="w-full border rounded-md px-3 py-2"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annual">Annual</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Minimum Contract (months)</label>
                <input
                  type="number"
                  value={formData.minimum_contract_months}
                  onChange={(e) => updateField("minimum_contract_months", Number(e.target.value))}
                  className="w-full border rounded-md px-3 py-2"
                  min="0"
                  placeholder="0 = no contract"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Early Termination Fee</label>
              <input
                type="number"
                value={formData.early_termination_fee}
                onChange={(e) => updateField("early_termination_fee", Number(e.target.value))}
                className="w-full border rounded-md px-3 py-2"
                min="0"
                step="0.01"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_promotional"
                checked={formData.is_promotional}
                onChange={(e) => updateField("is_promotional", e.target.checked)}
                className="h-4 w-4"
              />
              <label htmlFor="is_promotional" className="text-sm cursor-pointer">
                This is a promotional plan
              </label>
            </div>

            {formData.is_promotional && (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium mb-2 block">Promotion Start Date</label>
                  <input
                    type="date"
                    value={formData.promotion_start_date || ""}
                    onChange={(e) => updateField("promotion_start_date", e.target.value || null)}
                    className="w-full border rounded-md px-3 py-2"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Promotion End Date</label>
                  <input
                    type="date"
                    value={formData.promotion_end_date || ""}
                    onChange={(e) => updateField("promotion_end_date", e.target.value || null)}
                    className="w-full border rounded-md px-3 py-2"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ============================================================ */}
      {/* SECTION: Technical Specifications */}
      {/* ============================================================ */}
      <Card className="p-6">
        <button
          type="button"
          onClick={() => toggleSection("technical")}
          className="w-full flex items-center justify-between mb-4"
        >
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Technical Specifications
          </h3>
          {expandedSections.technical ? (
            <ChevronUp className="h-5 w-5" />
          ) : (
            <ChevronDown className="h-5 w-5" />
          )}
        </button>

        {expandedSections.technical && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Contention Ratio</label>
              <select
                value={formData.contention_ratio || ""}
                onChange={(e) => updateField("contention_ratio", e.target.value || null)}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="">No contention</option>
                <option value="1:1">1:1 (Dedicated - No sharing)</option>
                <option value="1:10">1:10 (Low contention)</option>
                <option value="1:20">1:20 (Standard residential)</option>
                <option value="1:50">1:50 (High contention)</option>
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                How many users share the same bandwidth pool
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ipv4_included"
                  checked={formData.ipv4_included}
                  onChange={(e) => updateField("ipv4_included", e.target.checked)}
                  className="h-4 w-4"
                />
                <label htmlFor="ipv4_included" className="text-sm cursor-pointer">
                  IPv4 Included
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ipv6_included"
                  checked={formData.ipv6_included}
                  onChange={(e) => updateField("ipv6_included", e.target.checked)}
                  className="h-4 w-4"
                />
                <label htmlFor="ipv6_included" className="text-sm cursor-pointer">
                  IPv6 Included
                </label>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="static_ip_included"
                  checked={formData.static_ip_included}
                  onChange={(e) => updateField("static_ip_included", e.target.checked)}
                  className="h-4 w-4"
                />
                <label htmlFor="static_ip_included" className="text-sm cursor-pointer">
                  Static IP Included
                </label>
              </div>

              {formData.static_ip_included && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Static IP Count</label>
                  <input
                    type="number"
                    value={formData.static_ip_count}
                    onChange={(e) => updateField("static_ip_count", Number(e.target.value))}
                    className="w-full border rounded-md px-3 py-2"
                    min="0"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* ============================================================ */}
      {/* SECTION: Additional Services */}
      {/* ============================================================ */}
      <Card className="p-6">
        <button
          type="button"
          onClick={() => toggleSection("additional")}
          className="w-full flex items-center justify-between mb-4"
        >
          <h3 className="text-lg font-bold">Additional Services & Options</h3>
          {expandedSections.additional ? (
            <ChevronUp className="h-5 w-5" />
          ) : (
            <ChevronDown className="h-5 w-5" />
          )}
        </button>

        {expandedSections.additional && (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="router_included"
                  checked={formData.router_included}
                  onChange={(e) => updateField("router_included", e.target.checked)}
                  className="h-4 w-4"
                />
                <label htmlFor="router_included" className="text-sm cursor-pointer">
                  Router Included
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="installation_included"
                  checked={formData.installation_included}
                  onChange={(e) => updateField("installation_included", e.target.checked)}
                  className="h-4 w-4"
                />
                <label htmlFor="installation_included" className="text-sm cursor-pointer">
                  Installation Included
                </label>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Technical Support Level</label>
              <select
                value={formData.technical_support_level || ""}
                onChange={(e) => updateField("technical_support_level", e.target.value || null)}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="">None</option>
                <option value="basic">Basic (Business hours)</option>
                <option value="standard">Standard (Extended hours)</option>
                <option value="premium">Premium (24/7)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_public"
                checked={formData.is_public}
                onChange={(e) => updateField("is_public", e.target.checked)}
                className="h-4 w-4"
              />
              <label htmlFor="is_public" className="text-sm cursor-pointer">
                Make this plan publicly visible
              </label>
            </div>
          </div>
        )}
      </Card>

      {/* Form Actions - Bottom */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded border sticky bottom-0">
        <div className="text-sm text-muted-foreground">
          {isEditing ? "Save changes to update the plan" : "Create plan to save configuration"}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            <Save className="mr-2 h-4 w-4" />
            {isSubmitting ? "Saving..." : isEditing ? "Save Changes" : "Create Plan"}
          </Button>
          {!isEditing && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                // Navigate to validation page after creation
                alert("Plan will be created first, then you can validate it");
              }}
              disabled={isSubmitting}
            >
              Create & Validate
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
