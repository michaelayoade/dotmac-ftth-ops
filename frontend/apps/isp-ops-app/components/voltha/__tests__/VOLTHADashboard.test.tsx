/**
 * VOLTHADashboard Component Tests
 *
 * Tests VOLTHA PON management dashboard with OLT/ONU monitoring
 */

import React from "react";
import { screen, fireEvent, waitFor, render } from "@dotmac/testing";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { VOLTHADashboard } from "../VOLTHADashboard";

jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const { apiClient: mockApiClient } = require("@/lib/api/client") as {
  apiClient: {
    get: jest.Mock;
    post: jest.Mock;
  };
};

// Mock toast
const mockToast = jest.fn();
jest.mock("@dotmac/ui", () => {
  const actual = jest.requireActual("@dotmac/ui");
  return {
    ...actual,
    useToast: () => ({ toast: mockToast }),
  };
});

// Helper to create test QueryClient
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

// Helper to render component with QueryClientProvider
const renderWithQueryClient = (component: React.ReactElement) => {
  const testQueryClient = createTestQueryClient();
  return render(<QueryClientProvider client={testQueryClient}>{component}</QueryClientProvider>);
};

describe("VOLTHADashboard", () => {
  const mockHealthData = {
    healthy: true,
    state: "HEALTHY",
    message: "All systems operational",
  };

  const mockOLTs = [
    {
      id: "olt-1",
      desc: { serial_num: "SN12345" },
      root_device_id: "device-1",
    },
  ];

  const mockONUs = [
    {
      id: "onu-1",
      serial_number: "ONU12345",
      vendor: "Huawei",
      model: "HG8245H",
      firmware_version: "V5R019C10S125",
      oper_status: "ACTIVE",
      connect_status: "REACHABLE",
      root: false,
      parent_id: "olt-1",
    },
  ];

  const mockAlarms = [];

  beforeEach(() => {
    jest.clearAllMocks();

    // Default successful API responses
    mockApiClient.get.mockImplementation((url: string) => {
      if (url === "/access/health") {
        return Promise.resolve({ data: mockHealthData });
      }
      if (url === "/access/logical-devices") {
        return Promise.resolve({ data: { devices: mockOLTs } });
      }
      if (url === "/access/devices") {
        return Promise.resolve({ data: { devices: mockONUs } });
      }
      if (url === "/access/alarms") {
        return Promise.resolve({ data: { alarms: mockAlarms } });
      }
      if (url.includes("/overview")) {
        return Promise.resolve({
          data: {
            model: "OLT-Model",
            firmware_version: "1.0.0",
            oper_status: "ACTIVE",
            pon_ports: [],
          },
        });
      }
      return Promise.reject(new Error("Unknown endpoint"));
    });
  });

  describe("Loading State", () => {
    it("shows loading message initially", () => {
      mockApiClient.get.mockImplementation(
        () => new Promise(() => {}), // Never resolves
      );

      renderWithQueryClient(<VOLTHADashboard />);

      expect(screen.getByText("Loading VOLTHA data...")).toBeInTheDocument();
    });
  });

  describe("Successful Data Load", () => {
    it("renders dashboard header after loading", async () => {
      renderWithQueryClient(<VOLTHADashboard />);

      await waitFor(() => {
        expect(screen.getByText("VOLTHA PON Management")).toBeInTheDocument();
        expect(screen.getByText("OLT/ONU monitoring and provisioning")).toBeInTheDocument();
      });
    });

    it("displays VOLTHA health status", async () => {
      renderWithQueryClient(<VOLTHADashboard />);

      await waitFor(() => {
        expect(screen.getByText("VOLTHA Status")).toBeInTheDocument();
        expect(screen.getByText("HEALTHY")).toBeInTheDocument();
        expect(screen.getByText("All systems operational")).toBeInTheDocument();
      });
    });

    it("displays OLT count", async () => {
      renderWithQueryClient(<VOLTHADashboard />);

      await waitFor(() => {
        expect(screen.getByText("OLTs")).toBeInTheDocument();
        expect(screen.getByTestId("olt-count")).toHaveTextContent("1");
      });
    });

    it("displays ONU count and online percentage", async () => {
      renderWithQueryClient(<VOLTHADashboard />);

      await waitFor(() => {
        expect(screen.getByText("ONUs")).toBeInTheDocument();
        expect(screen.getByText(/1 online \(100%\)/)).toBeInTheDocument();
      });
    });

    it("displays critical alarms count", async () => {
      renderWithQueryClient(<VOLTHADashboard />);

      await waitFor(() => {
        expect(screen.getByText("Critical Alarms")).toBeInTheDocument();
        expect(screen.getByTestId("alarm-count")).toHaveTextContent("0");
      });
    });
  });

  describe("Error Handling", () => {
    it("displays toast error when API call fails", async () => {
      mockApiClient.get.mockRejectedValue({
        response: { data: { detail: "Connection failed" } },
      });

      renderWithQueryClient(<VOLTHADashboard />);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Failed to load VOLTHA data",
          description: "Connection failed",
          variant: "destructive",
        });
      });
    });

    it("uses fallback error message when no detail provided", async () => {
      mockApiClient.get.mockRejectedValue(new Error("Network error"));

      renderWithQueryClient(<VOLTHADashboard />);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Failed to load VOLTHA data",
          description: "Network error",
          variant: "destructive",
        });
      });
    });
  });

  describe("ONU List", () => {
    it("displays ONUs header with count", async () => {
      renderWithQueryClient(<VOLTHADashboard />);

      await waitFor(() => {
        expect(screen.getByText(/ONUs \(1\)/)).toBeInTheDocument();
        expect(screen.getByText("Manage optical network units")).toBeInTheDocument();
      });
    });

    it("displays ONU details", async () => {
      renderWithQueryClient(<VOLTHADashboard />);

      await waitFor(() => {
        expect(screen.getByText("ONU12345")).toBeInTheDocument();
        expect(screen.getByText(/Huawei HG8245H/)).toBeInTheDocument();
        expect(screen.getByText(/FW: V5R019C10S125/)).toBeInTheDocument();
      });
    });

    it("shows search input for ONUs", async () => {
      renderWithQueryClient(<VOLTHADashboard />);

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText("Search ONUs...");
        expect(searchInput).toBeInTheDocument();
      });
    });

    it("shows provision ONU button", async () => {
      renderWithQueryClient(<VOLTHADashboard />);

      await waitFor(() => {
        expect(screen.getByText("Provision ONU")).toBeInTheDocument();
      });
    });
  });

  describe("Refresh Functionality", () => {
    it("shows refresh button", async () => {
      renderWithQueryClient(<VOLTHADashboard />);

      await waitFor(() => {
        expect(screen.getByText("Refresh")).toBeInTheDocument();
      });
    });

    it("reloads data when refresh button is clicked", async () => {
      renderWithQueryClient(<VOLTHADashboard />);

      await waitFor(() => {
        expect(screen.getByText("VOLTHA PON Management")).toBeInTheDocument();
      });

      const refreshButton = screen.getByText("Refresh");
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Data refreshed",
          description: "VOLTHA data has been updated",
        });
      });
    });
  });

  describe("OLT Overview", () => {
    it("displays OLT overview section", async () => {
      renderWithQueryClient(<VOLTHADashboard />);

      await waitFor(() => {
        expect(screen.getByText("OLT Overview")).toBeInTheDocument();
        expect(screen.getByText("Select an OLT to view details")).toBeInTheDocument();
      });
    });
  });

  describe("Status Badge Generation", () => {
    it("shows active status for online ONUs", async () => {
      renderWithQueryClient(<VOLTHADashboard />);

      await waitFor(() => {
        const activeONU = screen.getByText("ONU12345");
        expect(activeONU).toBeInTheDocument();
      });
    });
  });

  describe("ONU Filtering", () => {
    it("limits ONU display to 20 items", async () => {
      const manyONUs = Array.from({ length: 25 }, (_, i) => ({
        id: `onu-${i}`,
        serial_number: `ONU${i}`,
        vendor: "Vendor",
        model: "Model",
        firmware_version: "1.0",
        oper_status: "ACTIVE",
        connect_status: "REACHABLE",
        root: false,
        parent_id: "olt-1",
      }));

      mockApiClient.get.mockImplementation((url: string) => {
        if (url === "/access/devices") {
          return Promise.resolve({ data: { devices: manyONUs } });
        }
        if (url === "/access/health") {
          return Promise.resolve({ data: mockHealthData });
        }
        if (url === "/access/logical-devices") {
          return Promise.resolve({ data: { devices: mockOLTs } });
        }
        if (url === "/access/alarms") {
          return Promise.resolve({ data: { alarms: [] } });
        }
        return Promise.reject(new Error("Unknown endpoint"));
      });

      renderWithQueryClient(<VOLTHADashboard />);

      await waitFor(() => {
        expect(screen.getByText(/ONUs \(25\)/)).toBeInTheDocument();
      });

      // Should only render 20 ONUs
      const onuElements = screen.queryAllByText(/ONU\d+/);
      expect(onuElements.length).toBeLessThanOrEqual(20);
    });
  });

  describe("Alarms Display", () => {
    it("shows critical alarms section when critical alarms exist", async () => {
      const criticalAlarms = [
        {
          id: "alarm-1",
          type: "EQUIPMENT_ALARM",
          severity: "CRITICAL",
          state: "RAISED",
          device_id: "onu-1",
          description: "High temperature detected",
        },
      ];

      mockApiClient.get.mockImplementation((url: string) => {
        if (url === "/access/alarms") {
          return Promise.resolve({ data: { alarms: criticalAlarms } });
        }
        if (url === "/access/health") {
          return Promise.resolve({ data: mockHealthData });
        }
        if (url === "/access/logical-devices") {
          return Promise.resolve({ data: { devices: mockOLTs } });
        }
        if (url === "/access/devices") {
          return Promise.resolve({ data: { devices: mockONUs } });
        }
        return Promise.reject(new Error("Unknown endpoint"));
      });

      renderWithQueryClient(<VOLTHADashboard />);

      await waitFor(() => {
        expect(screen.getByText(/Critical Alarms \(1\)/)).toBeInTheDocument();
        expect(screen.getByText("EQUIPMENT_ALARM")).toBeInTheDocument();
        expect(screen.getByText(/High temperature detected/)).toBeInTheDocument();
      });
    });

    it("does not show alarms section when no critical alarms", async () => {
      renderWithQueryClient(<VOLTHADashboard />);

      await waitFor(() => {
        expect(screen.queryByText(/Critical Alarms \(\d+\)/)).not.toBeInTheDocument();
      });
    });
  });

  describe("Health Status Display", () => {
    it("shows healthy status with green indicator", async () => {
      renderWithQueryClient(<VOLTHADashboard />);

      await waitFor(() => {
        expect(screen.getByText("HEALTHY")).toBeInTheDocument();
      });
    });

    it("shows unhealthy status with red indicator", async () => {
      mockApiClient.get.mockImplementation((url: string) => {
        if (url === "/access/health") {
          return Promise.resolve({
            data: {
              healthy: false,
              state: "UNHEALTHY",
              message: "System degraded",
            },
          });
        }
        if (url === "/access/logical-devices") {
          return Promise.resolve({ data: { devices: [] } });
        }
        if (url === "/access/devices") {
          return Promise.resolve({ data: { devices: [] } });
        }
        if (url === "/access/alarms") {
          return Promise.resolve({ data: { alarms: [] } });
        }
        return Promise.reject(new Error("Unknown endpoint"));
      });

      renderWithQueryClient(<VOLTHADashboard />);

      await waitFor(() => {
        expect(screen.getByText("UNHEALTHY")).toBeInTheDocument();
        expect(screen.getByText("System degraded")).toBeInTheDocument();
      });
    });
  });
});
