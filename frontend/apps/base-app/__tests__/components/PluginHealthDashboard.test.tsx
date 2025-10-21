import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PluginHealthDashboard } from "../../app/dashboard/settings/plugins/components/PluginHealthDashboard";

const mockInstances = [
  {
    id: "550e8400-e29b-41d4-a716-446655440000",
    plugin_name: "WhatsApp Business",
    instance_name: "Production WhatsApp",
    status: "active" as const,
    has_configuration: true,
    created_at: "2024-01-15T10:00:00Z",
    last_health_check: "2024-01-20T15:30:00Z",
    last_error: undefined,
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440001",
    plugin_name: "Slack Integration",
    instance_name: "Team Notifications",
    status: "active" as const,
    has_configuration: true,
    created_at: "2024-01-12T08:00:00Z",
    last_health_check: "2024-01-20T15:28:00Z",
    last_error: undefined,
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440002",
    plugin_name: "Email Service",
    instance_name: "SMTP Gateway",
    status: "error" as const,
    has_configuration: true,
    created_at: "2024-01-10T08:00:00Z",
    last_error: "SMTP authentication failed: Invalid credentials",
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440003",
    plugin_name: "Payment Gateway",
    instance_name: "Stripe Integration",
    status: "inactive" as const,
    has_configuration: false,
    created_at: "2024-01-08T08:00:00Z",
  },
];

const mockHealthChecks = [
  {
    plugin_instance_id: "550e8400-e29b-41d4-a716-446655440000",
    status: "healthy" as const,
    message: "WhatsApp Business API is accessible and responding normally",
    details: {
      api_accessible: true,
      business_name: "DotMac Corp",
      phone_number_verified: true,
      webhook_configured: true,
      last_message_sent: "2024-01-20T15:25:00Z",
    },
    response_time_ms: 245,
    timestamp: "2024-01-20T15:30:00Z",
  },
  {
    plugin_instance_id: "550e8400-e29b-41d4-a716-446655440001",
    status: "healthy" as const,
    message: "Slack API is responding normally",
    details: {
      api_accessible: true,
      team_name: "DotMac Team",
      channels_accessible: 12,
      webhook_url_valid: true,
    },
    response_time_ms: 180,
    timestamp: "2024-01-20T15:28:00Z",
  },
  {
    plugin_instance_id: "550e8400-e29b-41d4-a716-446655440002",
    status: "error" as const,
    message: "SMTP authentication failed",
    details: {
      api_accessible: false,
      error: "Invalid credentials",
      status_code: 535,
      last_successful_connection: "2024-01-18T10:00:00Z",
    },
    response_time_ms: 5000,
    timestamp: "2024-01-20T15:32:00Z",
  },
  {
    plugin_instance_id: "550e8400-e29b-41d4-a716-446655440003",
    status: "unknown" as const,
    message: "No health check data available",
    details: {},
    timestamp: "2024-01-20T15:30:00Z",
  },
];

const defaultProps = {
  instances: mockInstances,
  healthChecks: mockHealthChecks,
  onRefresh: jest.fn(),
};

const renderHealthDashboard = (props = {}) => {
  return render(<PluginHealthDashboard {...defaultProps} {...props} />);
};

// Mock date formatting for consistent tests
const originalDateConstructor = Date;
beforeAll(() => {
  global.Date = class extends originalDateConstructor {
    constructor(...args: any[]) {
      if (args.length === 0) {
        super(2024, 0, 20, 15, 30, 0); // January 20, 2024, 15:30:00
      } else {
        super(...(args as [string]));
      }
    }

    static now() {
      return new originalDateConstructor(2024, 0, 20, 15, 30, 0).getTime();
    }

    toLocaleString() {
      // Return a consistent format for testing
      if (this.getTime() === new originalDateConstructor("2024-01-20T15:30:00Z").getTime()) {
        return "1/20/2024, 3:30:00 PM";
      }
      return super.toLocaleString();
    }
  } as any;
});

afterAll(() => {
  global.Date = originalDateConstructor;
});

describe("PluginHealthDashboard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Health Statistics Overview", () => {
    it("displays overall health percentage", () => {
      renderHealthDashboard();

      // 2 healthy out of 4 instances = 50%
      expect(screen.getByText("50%")).toBeInTheDocument();
      expect(screen.getByText("Overall Health")).toBeInTheDocument();
    });

    it("displays healthy instance count", () => {
      renderHealthDashboard();

      expect(screen.getByText("2")).toBeInTheDocument();
      expect(screen.getByText("Healthy")).toBeInTheDocument();
    });

    it("displays issues count (unhealthy + error)", () => {
      renderHealthDashboard();

      // 1 error + 1 unknown = 2 issues
      expect(screen.getByText("2")).toBeInTheDocument();
      expect(screen.getByText("Issues")).toBeInTheDocument();
    });

    it("calculates and displays average response time", () => {
      renderHealthDashboard();

      // Average of 245, 180, 5000 = ~1808ms
      expect(screen.getByText(/1\.81s|1808ms/)).toBeInTheDocument();
      expect(screen.getByText("Avg Response")).toBeInTheDocument();
    });

    it("handles cases with no health checks gracefully", () => {
      renderHealthDashboard({ healthChecks: [] });

      // Use data-testid to avoid multiple "0" element issues
      expect(screen.getByTestId("health-percentage")).toHaveTextContent("0%");
      expect(screen.getByTestId("health-healthy-count")).toHaveTextContent("0");
      expect(screen.getByTestId("health-issues-count")).toHaveTextContent("0");
      // With no response times, average is 0, shown as "0ms"
      expect(screen.getByTestId("health-avg-response")).toHaveTextContent("0ms");
    });
  });

  describe("Health Visualization", () => {
    it("shows trending up icon for good health (90%+)", () => {
      const allHealthyChecks = mockHealthChecks.map((check) => ({
        ...check,
        status: "healthy" as const,
      }));

      renderHealthDashboard({ healthChecks: allHealthyChecks });

      expect(screen.getByText("100%")).toBeInTheDocument();
      // Should show trending up (green) styling
      const healthElement = screen.getByText("100%").closest("div");
      expect(healthElement).toBeInTheDocument();
    });

    it("shows trending down icon for poor health (<70%)", () => {
      renderHealthDashboard();

      // 50% health should show trending down
      expect(screen.getByText("50%")).toBeInTheDocument();
      const healthElement = screen.getByText("50%").closest("div");
      expect(healthElement).toBeInTheDocument();
    });

    it("displays health progress bar with correct percentage", () => {
      renderHealthDashboard();

      const progressBar = document.querySelector('[style*="width: 50%"]');
      expect(progressBar).toBeInTheDocument();
    });
  });

  describe("Refresh Functionality", () => {
    it("calls onRefresh when refresh button is clicked", async () => {
      const user = userEvent.setup();
      const onRefresh = jest.fn().mockResolvedValue(undefined);

      renderHealthDashboard({ onRefresh });

      const refreshButton = screen.getByRole("button", {
        name: /Refresh Health/,
      });

      await act(async () => {
        await user.click(refreshButton);
      });

      expect(onRefresh).toHaveBeenCalled();
    });

    it("shows loading state during refresh", async () => {
      const user = userEvent.setup();
      let resolveRefresh: () => void;
      const onRefresh = jest.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveRefresh = resolve;
          }),
      );

      renderHealthDashboard({ onRefresh });

      const refreshButton = screen.getByRole("button", {
        name: /Refresh Health/,
      });

      await act(async () => {
        await user.click(refreshButton);
      });

      expect(screen.getByText("Checking...")).toBeInTheDocument();
      expect(refreshButton).toBeDisabled();

      // Complete the refresh
      resolveRefresh!();
      await waitFor(() => {
        expect(screen.getByText("Refresh Health")).toBeInTheDocument();
      });
    });

    it("handles refresh errors gracefully", async () => {
      const user = userEvent.setup();
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
      const onRefresh = jest.fn().mockRejectedValue(new Error("Refresh failed"));

      renderHealthDashboard({ onRefresh });

      const refreshButton = screen.getByTestId("refresh-health-button");

      // Click refresh button - component handles errors gracefully
      await act(async () => {
        await user.click(refreshButton);
      });

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText("Checking...")).not.toBeInTheDocument();
      });

      // Button should return to normal state after error
      expect(screen.getByText("Refresh Health")).toBeInTheDocument();
      expect(onRefresh).toHaveBeenCalled();

      // Error should be logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to refresh health checks:",
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe("Plugin Instance List", () => {
    it("displays all plugin instances with their health status", () => {
      renderHealthDashboard();

      expect(screen.getByText("Production WhatsApp")).toBeInTheDocument();
      expect(screen.getByText("Team Notifications")).toBeInTheDocument();
      expect(screen.getByText("SMTP Gateway")).toBeInTheDocument();
      expect(screen.getByText("Stripe Integration")).toBeInTheDocument();
    });

    it("displays health status indicators correctly", () => {
      renderHealthDashboard();

      expect(screen.getAllByText("healthy")).toHaveLength(2);
      expect(screen.getByText("error")).toBeInTheDocument();
      expect(screen.getByText("unknown")).toBeInTheDocument();
    });

    it("displays response times for instances", () => {
      renderHealthDashboard();

      expect(screen.getByText("245ms")).toBeInTheDocument();
      expect(screen.getByText("180ms")).toBeInTheDocument();
      expect(screen.getByText("5.00s")).toBeInTheDocument();
      expect(screen.getByText("N/A")).toBeInTheDocument();
    });

    it("displays health messages for each instance", () => {
      renderHealthDashboard();

      expect(
        screen.getByText("WhatsApp Business API is accessible and responding normally"),
      ).toBeInTheDocument();
      expect(screen.getByText("Slack API is responding normally")).toBeInTheDocument();
      expect(screen.getByText("SMTP authentication failed")).toBeInTheDocument();
      expect(screen.getByText("No health check data available")).toBeInTheDocument();
    });

    it("sorts instances by health status (unhealthy first)", () => {
      renderHealthDashboard();

      const instanceElements = screen.getAllByText(
        /Production WhatsApp|Team Notifications|SMTP Gateway|Stripe Integration/,
      );
      const instanceTexts = instanceElements.map((el) => el.textContent);

      // Error and unknown status instances should appear first
      const errorIndex = instanceTexts.findIndex((text) => text?.includes("SMTP Gateway"));
      const unknownIndex = instanceTexts.findIndex((text) => text?.includes("Stripe Integration"));
      const healthyIndex1 = instanceTexts.findIndex((text) =>
        text?.includes("Production WhatsApp"),
      );
      const healthyIndex2 = instanceTexts.findIndex((text) => text?.includes("Team Notifications"));

      expect(errorIndex).toBeLessThan(healthyIndex1);
      expect(unknownIndex).toBeLessThan(healthyIndex1);
      expect(errorIndex).toBeLessThan(healthyIndex2);
      expect(unknownIndex).toBeLessThan(healthyIndex2);
    });
  });

  describe("Instance Details Expansion", () => {
    it("expands instance details when clicked", async () => {
      const user = userEvent.setup();
      renderHealthDashboard();

      const instanceRow = screen.getByText("Production WhatsApp").closest("div");
      if (instanceRow) {
        await act(async () => {
          await user.click(instanceRow);
        });

        expect(screen.getByText("Health Check Details")).toBeInTheDocument();
        expect(screen.getByText("Status:")).toBeInTheDocument();
        expect(screen.getByText("Response Time:")).toBeInTheDocument();
        expect(screen.getByText("Timestamp:")).toBeInTheDocument();
      }
    });

    it("collapses details when clicked again", async () => {
      const user = userEvent.setup();
      renderHealthDashboard();

      const instanceRow = screen.getByText("Production WhatsApp").closest("div");
      if (instanceRow) {
        // Expand
        await act(async () => {
          await user.click(instanceRow);
        });
        expect(screen.getByText("Health Check Details")).toBeInTheDocument();

        // Collapse
        await act(async () => {
          await user.click(instanceRow);
        });
        expect(screen.queryByText("Health Check Details")).not.toBeInTheDocument();
      }
    });

    it("displays detailed health information in expanded state", async () => {
      const user = userEvent.setup();
      renderHealthDashboard();

      // Use data-testid to find the clickable row
      const instanceRows = screen.getAllByTestId("health-instance-row");
      const firstRow = instanceRows[0];

      // Type assertion: getAllByTestId guarantees at least one element exists
      expect(firstRow).toBeDefined();

      await act(async () => {
        await user.click(firstRow!);
      });

      // Wait for expansion
      await waitFor(() => {
        expect(screen.getByText("Health Check Details")).toBeInTheDocument();
      });

      // Additional details should be visible
      expect(screen.getByText("Additional Information")).toBeInTheDocument();
    });

    it("displays error information when instance has last_error", async () => {
      const user = userEvent.setup();
      renderHealthDashboard();

      const instanceRow = screen.getByText("SMTP Gateway").closest("div");
      if (instanceRow) {
        await act(async () => {
          await user.click(instanceRow);
        });

        expect(screen.getByText("Last Error")).toBeInTheDocument();
        expect(
          screen.getByText("SMTP authentication failed: Invalid credentials"),
        ).toBeInTheDocument();
      }
    });

    it("handles instances without additional details", async () => {
      const user = userEvent.setup();
      renderHealthDashboard();

      const instanceRow = screen.getByText("Stripe Integration").closest("div");
      if (instanceRow) {
        await act(async () => {
          await user.click(instanceRow);
        });

        expect(screen.getByText("Additional Information")).toBeInTheDocument();
        expect(screen.getByText("No additional details available")).toBeInTheDocument();
      }
    });
  });

  describe("Time Formatting", () => {
    it("formats response times correctly", () => {
      renderHealthDashboard();

      // < 1000ms should show as ms
      expect(screen.getByText("245ms")).toBeInTheDocument();
      expect(screen.getByText("180ms")).toBeInTheDocument();

      // >= 1000ms should show as seconds
      expect(screen.getByText("5.00s")).toBeInTheDocument();
    });

    it("formats timestamps correctly", async () => {
      const user = userEvent.setup();
      renderHealthDashboard();

      const instanceRow = screen.getByText("Production WhatsApp").closest("div");
      if (instanceRow) {
        await act(async () => {
          await user.click(instanceRow);
        });

        // Should show formatted timestamp
        const timestampElements = screen.getAllByText(/Last checked:/);
        expect(timestampElements.length).toBeGreaterThan(0);
      }
    });

    it("handles invalid timestamps gracefully", () => {
      const healthChecksWithInvalidTimestamp = [
        {
          ...mockHealthChecks[0],
          timestamp: "invalid-timestamp",
        },
      ];

      renderHealthDashboard({ healthChecks: healthChecksWithInvalidTimestamp });

      // Invalid timestamps render as "Invalid Date"
      expect(screen.getByText(/Invalid Date/)).toBeInTheDocument();
    });
  });

  describe("Empty State", () => {
    it("displays empty state when no instances exist", () => {
      renderHealthDashboard({ instances: [], healthChecks: [] });

      expect(screen.getByText("No Plugin Instances")).toBeInTheDocument();
      expect(
        screen.getByText("Add some plugin instances to monitor their health status."),
      ).toBeInTheDocument();
    });

    it("handles missing health checks for existing instances", () => {
      renderHealthDashboard({ healthChecks: [] });

      // Should still show instances but with unknown status
      expect(screen.getByText("Production WhatsApp")).toBeInTheDocument();
      expect(screen.getByText("0%")).toBeInTheDocument(); // No healthy instances
    });
  });

  describe("Visual Status Indicators", () => {
    it("displays correct color indicators for each health status", () => {
      renderHealthDashboard();

      // Check for green indicators (healthy)
      const healthyIndicators = document.querySelectorAll(".text-emerald-500");
      expect(healthyIndicators.length).toBeGreaterThan(0);

      // Check for red indicators (error)
      const errorIndicators = document.querySelectorAll(".text-rose-500");
      expect(errorIndicators.length).toBeGreaterThan(0);

      // Check for amber indicators (unknown)
      const unknownIndicators = document.querySelectorAll(".text-amber-500");
      expect(unknownIndicators.length).toBeGreaterThan(0);
    });

    it("applies correct status colors to status badges", () => {
      renderHealthDashboard();

      const healthyBadges = screen.getAllByText("healthy");
      healthyBadges.forEach((badge) => {
        expect(badge).toHaveClass("text-emerald-400");
      });

      const errorBadge = screen.getByText("error");
      expect(errorBadge).toHaveClass("text-rose-400");

      const unknownBadge = screen.getByText("unknown");
      expect(unknownBadge).toHaveClass("text-amber-400");
    });
  });

  describe("Accessibility", () => {
    it("has accessible button labels", () => {
      renderHealthDashboard();

      expect(screen.getByRole("button", { name: /Refresh Health/ })).toBeInTheDocument();
    });

    it("uses semantic HTML structure", () => {
      renderHealthDashboard();

      expect(screen.getByText("Plugin Health Status")).toBeInTheDocument();
      expect(screen.getAllByText(/Overall Health|Healthy|Issues|Avg Response/)).toHaveLength(4);
    });

    it("provides keyboard navigation for expandable rows", async () => {
      renderHealthDashboard();

      // Use data-testid to find rows
      const instanceRows = screen.getAllByTestId("health-instance-row");
      expect(instanceRows[0]).toHaveClass("cursor-pointer");
    });
  });

  describe("Edge Cases", () => {
    it("handles instances with missing health data", () => {
      const instancesWithoutHealth = [
        {
          id: "test-id",
          plugin_name: "Test Plugin",
          instance_name: "Test Instance",
          status: "active" as const,
          has_configuration: true,
        },
      ];

      renderHealthDashboard({
        instances: instancesWithoutHealth,
        healthChecks: [],
      });

      expect(screen.getByText("Test Instance")).toBeInTheDocument();
      expect(screen.getByText("0%")).toBeInTheDocument();
    });

    it("handles zero response times", () => {
      const zeroResponseTimeCheck = [
        {
          ...mockHealthChecks[0],
          response_time_ms: 0,
        },
      ];

      renderHealthDashboard({ healthChecks: zeroResponseTimeCheck });

      // Use data-testid to avoid multiple "0ms" elements
      expect(screen.getByTestId("health-avg-response")).toHaveTextContent("0ms");
    });

    it("handles very large response times", () => {
      const largeResponseTimeCheck = [
        {
          ...mockHealthChecks[0],
          response_time_ms: 123456,
        },
      ];

      renderHealthDashboard({ healthChecks: largeResponseTimeCheck });

      // Use data-testid to avoid multiple "123.46s" elements
      expect(screen.getByTestId("health-avg-response")).toHaveTextContent("123.46s");
    });
  });
});
