/**
 * GenieACSDashboard Component Tests
 *
 * Tests CPE management dashboard with tabbed interface
 */

import React from "react";
import { renderQuick, screen, fireEvent } from "@dotmac/testing";
import { GenieACSDashboard } from "../GenieACSDashboard";

// Mock child components
jest.mock("../BulkOperationsDashboard", () => ({
  BulkOperationsDashboard: () => <div data-testid="bulk-operations">Bulk Operations Content</div>,
}));

jest.mock("../FirmwareManagement", () => ({
  FirmwareManagement: () => <div data-testid="firmware">Firmware Management Content</div>,
}));

jest.mock("../CPEConfigTemplates", () => ({
  CPEConfigTemplates: () => <div data-testid="templates">Config Templates Content</div>,
}));

jest.mock("../DeviceManagement", () => ({
  DeviceManagement: () => <div data-testid="devices">Device Management Content</div>,
}));

// Mock UI components
jest.mock("@dotmac/ui", () => ({
  Tabs: ({ children, value, onValueChange }: any) => (
    <div data-testid="tabs" data-value={value}>
      {typeof children === "function" ? children({ value }) : children}
    </div>
  ),
  TabsContent: ({ children, value }: any) => (
    <div data-testid={`tab-content-${value}`} data-value={value}>
      {children}
    </div>
  ),
  TabsList: ({ children, className }: any) => (
    <div data-testid="tabs-list" className={className}>
      {children}
    </div>
  ),
  TabsTrigger: ({ children, value, onClick }: any) => (
    <button data-testid={`tab-trigger-${value}`} data-value={value} onClick={onClick}>
      {children}
    </button>
  ),
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: any) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children, className }: any) => (
    <div data-testid="card-title" className={className}>
      {children}
    </div>
  ),
  CardDescription: ({ children }: any) => <div data-testid="card-description">{children}</div>,
  CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
}));

// Mock lucide icons
jest.mock("lucide-react", () => ({
  Server: ({ className }: any) => (
    <div data-testid="icon-server" className={className}>
      Server
    </div>
  ),
  Settings: ({ className }: any) => (
    <div data-testid="icon-settings" className={className}>
      Settings
    </div>
  ),
  Calendar: ({ className }: any) => (
    <div data-testid="icon-calendar" className={className}>
      Calendar
    </div>
  ),
  FileText: ({ className }: any) => (
    <div data-testid="icon-file-text" className={className}>
      FileText
    </div>
  ),
  Activity: ({ className }: any) => (
    <div data-testid="icon-activity" className={className}>
      Activity
    </div>
  ),
  BarChart3: ({ className }: any) => (
    <div data-testid="icon-bar-chart" className={className}>
      BarChart3
    </div>
  ),
}));

describe("GenieACSDashboard", () => {
  describe("Initial Render", () => {
    it("renders dashboard header", () => {
      renderQuick(<GenieACSDashboard />);

      expect(screen.getByText("CPE Management")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Manage customer premises equipment, configurations, and firmware upgrades",
        ),
      ).toBeInTheDocument();
    });

    it("renders all tab triggers", () => {
      renderQuick(<GenieACSDashboard />);

      expect(screen.getByTestId("tab-trigger-devices")).toBeInTheDocument();
      expect(screen.getByTestId("tab-trigger-bulk-ops")).toBeInTheDocument();
      expect(screen.getByTestId("tab-trigger-firmware")).toBeInTheDocument();
      expect(screen.getByTestId("tab-trigger-templates")).toBeInTheDocument();
      expect(screen.getByTestId("tab-trigger-monitoring")).toBeInTheDocument();
    });

    it("shows devices tab as active by default", () => {
      renderQuick(<GenieACSDashboard />);

      const tabsContainer = screen.getByTestId("tabs");
      expect(tabsContainer).toHaveAttribute("data-value", "devices");
    });

    it("renders device management content by default", () => {
      renderQuick(<GenieACSDashboard />);

      expect(screen.getByTestId("devices")).toBeInTheDocument();
      expect(screen.getByText("Device Management Content")).toBeInTheDocument();
    });
  });

  describe("Tab Navigation", () => {
    it("displays Devices tab label with icon", () => {
      renderQuick(<GenieACSDashboard />);

      const devicesTab = screen.getByTestId("tab-trigger-devices");
      expect(devicesTab).toHaveTextContent("Devices");
      expect(devicesTab.querySelector('[data-testid="icon-server"]')).toBeInTheDocument();
    });

    it("displays Bulk Operations tab label with icon", () => {
      renderQuick(<GenieACSDashboard />);

      const bulkOpsTab = screen.getByTestId("tab-trigger-bulk-ops");
      expect(bulkOpsTab).toHaveTextContent("Bulk Operations");
      expect(bulkOpsTab.querySelector('[data-testid="icon-settings"]')).toBeInTheDocument();
    });

    it("displays Firmware tab label with icon", () => {
      renderQuick(<GenieACSDashboard />);

      const firmwareTab = screen.getByTestId("tab-trigger-firmware");
      expect(firmwareTab).toHaveTextContent("Firmware");
      expect(firmwareTab.querySelector('[data-testid="icon-calendar"]')).toBeInTheDocument();
    });

    it("displays Templates tab label with icon", () => {
      renderQuick(<GenieACSDashboard />);

      const templatesTab = screen.getByTestId("tab-trigger-templates");
      expect(templatesTab).toHaveTextContent("Templates");
      expect(templatesTab.querySelector('[data-testid="icon-file-text"]')).toBeInTheDocument();
    });

    it("displays Monitoring tab label with icon", () => {
      renderQuick(<GenieACSDashboard />);

      const monitoringTab = screen.getByTestId("tab-trigger-monitoring");
      expect(monitoringTab).toHaveTextContent("Monitoring");
      expect(monitoringTab.querySelector('[data-testid="icon-activity"]')).toBeInTheDocument();
    });
  });

  describe("Tab Content Rendering", () => {
    it("renders DeviceManagement component in devices tab", () => {
      renderQuick(<GenieACSDashboard />);

      expect(screen.getByTestId("tab-content-devices")).toBeInTheDocument();
      expect(screen.getByTestId("devices")).toBeInTheDocument();
    });

    it("renders BulkOperationsDashboard component in bulk-ops tab", () => {
      renderQuick(<GenieACSDashboard />);

      expect(screen.getByTestId("tab-content-bulk-ops")).toBeInTheDocument();
    });

    it("renders FirmwareManagement component in firmware tab", () => {
      renderQuick(<GenieACSDashboard />);

      expect(screen.getByTestId("tab-content-firmware")).toBeInTheDocument();
    });

    it("renders CPEConfigTemplates component in templates tab", () => {
      renderQuick(<GenieACSDashboard />);

      expect(screen.getByTestId("tab-content-templates")).toBeInTheDocument();
    });

    it("renders monitoring placeholder in monitoring tab", () => {
      renderQuick(<GenieACSDashboard />);

      const monitoringContent = screen.getByTestId("tab-content-monitoring");
      expect(monitoringContent).toBeInTheDocument();

      // Check for monitoring placeholder content
      const cardTitle = screen.getByText("CPE Monitoring & Analytics");
      expect(cardTitle).toBeInTheDocument();
    });
  });

  describe("Monitoring Tab Content", () => {
    it("displays monitoring placeholder with icon", () => {
      renderQuick(<GenieACSDashboard />);

      expect(screen.getByText("CPE Monitoring & Analytics")).toBeInTheDocument();
      expect(screen.getByTestId("icon-bar-chart")).toBeInTheDocument();
    });

    it("displays monitoring description", () => {
      renderQuick(<GenieACSDashboard />);

      expect(
        screen.getByText("Real-time monitoring and performance analytics for CPE devices"),
      ).toBeInTheDocument();
    });

    it("displays monitoring placeholder message", () => {
      renderQuick(<GenieACSDashboard />);

      expect(screen.getByText("Monitoring Dashboard")).toBeInTheDocument();
      expect(
        screen.getByText("Real-time CPE performance metrics and alerts will be displayed here"),
      ).toBeInTheDocument();
    });
  });

  describe("Component Structure", () => {
    it("renders with correct spacing classes", () => {
      const { container } = renderQuick(<GenieACSDashboard />);

      const mainDiv = container.querySelector(".space-y-6");
      expect(mainDiv).toBeInTheDocument();
      expect(mainDiv).toHaveClass("p-6");
    });

    it("renders tabs list with grid layout", () => {
      renderQuick(<GenieACSDashboard />);

      const tabsList = screen.getByTestId("tabs-list");
      expect(tabsList).toHaveClass("grid", "w-full", "grid-cols-5");
    });

    it("renders all tab content sections", () => {
      renderQuick(<GenieACSDashboard />);

      expect(screen.getByTestId("tab-content-devices")).toBeInTheDocument();
      expect(screen.getByTestId("tab-content-bulk-ops")).toBeInTheDocument();
      expect(screen.getByTestId("tab-content-firmware")).toBeInTheDocument();
      expect(screen.getByTestId("tab-content-templates")).toBeInTheDocument();
      expect(screen.getByTestId("tab-content-monitoring")).toBeInTheDocument();
    });
  });

  describe("State Management", () => {
    it("initializes with devices tab active", () => {
      renderQuick(<GenieACSDashboard />);

      const tabs = screen.getByTestId("tabs");
      expect(tabs).toHaveAttribute("data-value", "devices");
    });
  });
});
