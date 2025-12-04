/**
 * Audit Integration Wrapper
 * DRY component for easy audit integration into any frontend app
 * Provides standardized audit setup with minimal configuration
 */

import React from "react";
import { AuditProvider } from "./AuditProvider";
import { useAuditInterceptor } from "../hooks/useAuditInterceptor";

interface AuditWrapperContentProps {
  children: React.ReactNode;
  interceptorConfig?: Parameters<typeof useAuditInterceptor>[0];
}

function AuditWrapperContent({ children, interceptorConfig }: AuditWrapperContentProps) {
  // Setup automatic audit interception
  useAuditInterceptor(interceptorConfig);
  return <>{children}</>;
}

interface AuditIntegrationWrapperProps {
  children: React.ReactNode;
  serviceName: string;

  // Audit provider options
  enabled?: boolean;
  batchSize?: number;
  batchTimeout?: number;
  enableLocalStorage?: boolean;
  enableConsoleLogging?: boolean;

  // Interceptor options
  interceptFetch?: boolean;
  interceptClicks?: boolean;
  interceptForms?: boolean;
  interceptNavigation?: boolean;
  excludeUrls?: RegExp[];
  excludeElements?: string[];
}

export function AuditIntegrationWrapper({
  children,
  serviceName,
  enabled = true,
  batchSize = 10,
  batchTimeout = 5000,
  enableLocalStorage = true,
  enableConsoleLogging = process.env["NODE_ENV"] === "development",
  interceptFetch = true,
  interceptClicks = true,
  interceptForms = true,
  interceptNavigation = true,
  excludeUrls = [/\/audit\//, /\/health/, /\/metrics/, /\/_next\//, /\/api\/auth\//],
  excludeElements = [".no-audit", "[data-no-audit]", ".audit-ignore"],
}: AuditIntegrationWrapperProps) {
  if (!enabled) {
    return <>{children}</>;
  }

  const interceptorConfig = {
    interceptFetch,
    interceptClicks,
    interceptForms,
    interceptNavigation,
    excludeUrls,
    excludeElements,
  };

  return (
    <AuditProvider
      serviceName={serviceName}
      enabled={enabled}
      batchSize={batchSize}
      batchTimeout={batchTimeout}
      enableLocalStorage={enableLocalStorage}
      enableConsoleLogging={enableConsoleLogging}
    >
      <AuditWrapperContent interceptorConfig={interceptorConfig}>{children}</AuditWrapperContent>
    </AuditProvider>
  );
}

// Preset configurations for different app types
export const AuditPresets = {
  customerPortal: {
    serviceName: "customer-portal",
    batchSize: 15,
    batchTimeout: 3000,
    excludeElements: [".no-audit", "[data-no-audit]", ".customer-pii"],
  },

  adminPortal: {
    serviceName: "admin-portal",
    batchSize: 5,
    batchTimeout: 2000,
    interceptClicks: true,
    interceptForms: true,
  },

  technicianApp: {
    serviceName: "technician-mobile",
    batchSize: 20,
    batchTimeout: 10000, // Longer timeout for mobile/offline scenarios
    enableLocalStorage: true,
  },

  resellerPortal: {
    serviceName: "reseller-portal",
    batchSize: 8,
    batchTimeout: 4000,
    excludeUrls: [/\/audit\//, /\/partner\//, /\/commission\//],
  },

  managementPortal: {
    serviceName: "management-portal",
    batchSize: 5,
    batchTimeout: 1000, // Fastest for management actions
    interceptNavigation: true,
    interceptForms: true,
  },
};

// Convenience components for each app type
export const CustomerPortalAudit = ({ children }: { children: React.ReactNode }) => (
  <AuditIntegrationWrapper {...AuditPresets.customerPortal}>{children}</AuditIntegrationWrapper>
);

export const AdminPortalAudit = ({ children }: { children: React.ReactNode }) => (
  <AuditIntegrationWrapper {...AuditPresets.adminPortal}>{children}</AuditIntegrationWrapper>
);

export const TechnicianAppAudit = ({ children }: { children: React.ReactNode }) => (
  <AuditIntegrationWrapper {...AuditPresets.technicianApp}>{children}</AuditIntegrationWrapper>
);

export const ResellerPortalAudit = ({ children }: { children: React.ReactNode }) => (
  <AuditIntegrationWrapper {...AuditPresets.resellerPortal}>{children}</AuditIntegrationWrapper>
);

export const ManagementPortalAudit = ({ children }: { children: React.ReactNode }) => (
  <AuditIntegrationWrapper {...AuditPresets.managementPortal}>{children}</AuditIntegrationWrapper>
);
