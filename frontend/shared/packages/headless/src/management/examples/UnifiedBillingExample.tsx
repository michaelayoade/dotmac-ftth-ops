/**
 * Unified Billing Example - Demonstrates DRY management operations usage
 * Can be used in Admin, Management-Admin, and Reseller portals
 */

import React, { useEffect, useState } from "react";
import {
  useManagement,
  useManagementBilling,
  useManagementAnalytics,
  useManagementEntity,
  EntityType,
} from "../";

interface UnifiedBillingExampleProps {
  customerId?: string;
  showAnalytics?: boolean;
  showBulkOperations?: boolean;
}

export function UnifiedBillingExample({
  customerId,
  showAnalytics = true,
  showBulkOperations = false,
}: UnifiedBillingExampleProps) {
  const { portalType, features, isInitialized } = useManagement();
  const [selectedCustomerId, setSelectedCustomerId] = useState(customerId);

  // Customer entity operations
  const customerEntity = useManagementEntity(EntityType.CUSTOMER);

  // Billing operations for specific customer
  const billingOps = useManagementBilling(selectedCustomerId || "");

  // Analytics operations
  const analytics = useManagementAnalytics();

  // Load customers on mount
  useEffect(() => {
    if (isInitialized) {
      customerEntity.list({ limit: 10, status: ["active"] });
    }
  }, [isInitialized]);

  // Load billing data when customer is selected
  useEffect(() => {
    if (selectedCustomerId && isInitialized) {
      billingOps.getBillingData({
        start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        end_date: new Date().toISOString().split("T")[0],
      });
    }
  }, [selectedCustomerId, isInitialized]);

  // Load analytics if enabled
  useEffect(() => {
    if (showAnalytics && features.enableAdvancedAnalytics && isInitialized) {
      analytics.getDashboardStats("30d");
    }
  }, [showAnalytics, features.enableAdvancedAnalytics, isInitialized]);

  if (!isInitialized) {
    return <div className="p-4">Initializing management system...</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Unified Billing Operations</h1>
        <p className="text-sm text-gray-600">
          Portal: {portalType} | Features:{" "}
          {Object.entries(features)
            .filter(([_, enabled]) => enabled)
            .map(([feature, _]) => feature)
            .join(", ")}
        </p>
      </div>

      {/* Customer Selection */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h2 className="text-lg font-semibold mb-3">Customer Selection</h2>
        {customerEntity.isLoading() ? (
          <div className="text-gray-500">Loading customers...</div>
        ) : customerEntity.hasError() ? (
          <div className="text-red-500">Error: {customerEntity.getError()?.message}</div>
        ) : (
          <select
            value={selectedCustomerId || ""}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded"
          >
            <option value="">Select a customer...</option>
            {/* This would be populated by the actual customer list */}
            <option value="cust_001">Customer 001 - John Doe</option>
            <option value="cust_002">Customer 002 - Jane Smith</option>
            <option value="cust_003">Customer 003 - Acme Corp</option>
          </select>
        )}
      </div>

      {/* Billing Operations */}
      {selectedCustomerId && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <h2 className="text-lg font-semibold mb-3">Billing Operations</h2>

          {billingOps.isLoading("billingData") ? (
            <div className="text-gray-500">Loading billing data...</div>
          ) : billingOps.hasError("billingData") ? (
            <div className="text-red-500">Error: {billingOps.getError("billingData")?.message}</div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3 bg-white rounded border">
                  <div className="text-sm text-gray-600">Outstanding Balance</div>
                  <div className="text-xl font-bold text-red-600">$1,234.56</div>
                </div>
                <div className="p-3 bg-white rounded border">
                  <div className="text-sm text-gray-600">This Month</div>
                  <div className="text-xl font-bold text-green-600">$567.89</div>
                </div>
                <div className="p-3 bg-white rounded border">
                  <div className="text-sm text-gray-600">Total Paid</div>
                  <div className="text-xl font-bold text-blue-600">$12,345.67</div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => billingOps.generateInvoice([{ id: "svc_1", amount: 99.99 }])}
                  disabled={billingOps.isLoading("generateInvoice")}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  Generate Invoice
                </button>

                <button
                  onClick={() => billingOps.processPayment(100.0, { method: "credit_card" })}
                  disabled={billingOps.isLoading("processPayment")}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  Process Payment
                </button>

                <button
                  onClick={() => billingOps.getInvoices({ status: ["pending", "overdue"] })}
                  disabled={billingOps.isLoading("getInvoices")}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                >
                  View Invoices
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Analytics Section - Only shown if enabled */}
      {showAnalytics && features.enableAdvancedAnalytics && (
        <div className="mb-6 p-4 bg-green-50 rounded-lg">
          <h2 className="text-lg font-semibold mb-3">Analytics Dashboard</h2>

          {analytics.isLoading("dashboardStats") ? (
            <div className="text-gray-500">Loading analytics...</div>
          ) : analytics.hasError("dashboardStats") ? (
            <div className="text-red-500">
              Error: {analytics.getError("dashboardStats")?.message}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-3 bg-white rounded border">
                <div className="text-sm text-gray-600">Total Revenue</div>
                <div className="text-xl font-bold text-green-600">$45,678.90</div>
              </div>
              <div className="p-3 bg-white rounded border">
                <div className="text-sm text-gray-600">Active Customers</div>
                <div className="text-xl font-bold text-blue-600">1,234</div>
              </div>
              <div className="p-3 bg-white rounded border">
                <div className="text-sm text-gray-600">Conversion Rate</div>
                <div className="text-xl font-bold text-purple-600">12.3%</div>
              </div>
              <div className="p-3 bg-white rounded border">
                <div className="text-sm text-gray-600">Churn Rate</div>
                <div className="text-xl font-bold text-red-600">2.1%</div>
              </div>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => analytics.generateReport("financial", { period: "30d" })}
              disabled={analytics.isLoading("generateReport")}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              Generate Report
            </button>

            <button
              onClick={() => analytics.getUsageMetrics("30d")}
              disabled={analytics.isLoading("getUsageMetrics")}
              className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-50"
            >
              Usage Metrics
            </button>
          </div>
        </div>
      )}

      {/* Bulk Operations - Only shown if enabled */}
      {showBulkOperations && features.enableBatchOperations && (
        <div className="p-4 bg-orange-50 rounded-lg">
          <h2 className="text-lg font-semibold mb-3">Bulk Operations</h2>
          <p className="text-sm text-gray-600 mb-3">
            Available for Management Admin portal with batch operations enabled
          </p>

          <div className="flex gap-2">
            <button className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700">
              Bulk Invoice Generation
            </button>
            <button className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
              Bulk Payment Processing
            </button>
            <button className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700">
              Bulk Customer Import
            </button>
          </div>
        </div>
      )}

      {/* Portal-specific Information */}
      <div className="mt-6 p-4 bg-gray-100 rounded-lg">
        <h2 className="text-lg font-semibold mb-3">Portal Configuration</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <strong>Portal Type:</strong> {portalType}
          </div>
          <div>
            <strong>Real-time Sync:</strong> {features.enableRealTimeSync ? "Enabled" : "Disabled"}
          </div>
          <div>
            <strong>Advanced Analytics:</strong>{" "}
            {features.enableAdvancedAnalytics ? "Enabled" : "Disabled"}
          </div>
          <div>
            <strong>Batch Operations:</strong>{" "}
            {features.enableBatchOperations ? "Enabled" : "Disabled"}
          </div>
          <div>
            <strong>Audit Logging:</strong> {features.enableAuditLogging ? "Enabled" : "Disabled"}
          </div>
        </div>
      </div>
    </div>
  );
}
