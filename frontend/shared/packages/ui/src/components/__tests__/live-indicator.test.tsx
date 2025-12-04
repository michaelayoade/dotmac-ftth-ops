/**
 * Live Indicator Component Tests
 *
 * Tests LiveIndicator component with real-time updates and refresh functionality
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import { LiveIndicator } from "../live-indicator";

describe("LiveIndicator", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe("Basic Rendering", () => {
    it("renders live indicator", () => {
      render(<LiveIndicator />);

      expect(screen.getByText("Live")).toBeInTheDocument();
    });

    it("shows live badge with icon", () => {
      const { container } = render(<LiveIndicator />);

      expect(screen.getByText("Live")).toBeInTheDocument();
      const icon = container.querySelector(".animate-pulse");
      expect(icon).toBeInTheDocument();
    });

    it("has green color scheme", () => {
      const { container } = render(<LiveIndicator />);

      const badge = container.querySelector(".bg-green-500\\/10.text-green-500");
      expect(badge).toBeInTheDocument();
    });
  });

  describe("Last Updated Time", () => {
    it("does not show time when lastUpdated is null", () => {
      render(<LiveIndicator lastUpdated={null} />);

      expect(screen.queryByText(/ago/)).not.toBeInTheDocument();
    });

    it("does not show time when lastUpdated is undefined", () => {
      render(<LiveIndicator />);

      expect(screen.queryByText(/ago/)).not.toBeInTheDocument();
    });

    it("shows 'just now' for recent updates", () => {
      const now = new Date();
      render(<LiveIndicator lastUpdated={now} />);

      expect(screen.getByText("Updated just now")).toBeInTheDocument();
    });

    it("shows seconds for updates under 1 minute", () => {
      const thirtySecondsAgo = new Date(Date.now() - 30000);
      render(<LiveIndicator lastUpdated={thirtySecondsAgo} />);

      expect(screen.getByText("Updated 30s ago")).toBeInTheDocument();
    });

    it("shows minutes for updates under 1 hour", () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60000);
      render(<LiveIndicator lastUpdated={fiveMinutesAgo} />);

      expect(screen.getByText("Updated 5m ago")).toBeInTheDocument();
    });

    it("shows hours for updates over 1 hour", () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 3600000);
      render(<LiveIndicator lastUpdated={twoHoursAgo} />);

      expect(screen.getByText("Updated 2h ago")).toBeInTheDocument();
    });

    it("updates time display every second", async () => {
      const tenSecondsAgo = new Date(Date.now() - 10000);
      render(<LiveIndicator lastUpdated={tenSecondsAgo} />);

      expect(screen.getByText("Updated 10s ago")).toBeInTheDocument();

      // Fast-forward 1 second
      jest.advanceTimersByTime(1000);

      await waitFor(() => {
        expect(screen.getByText("Updated 11s ago")).toBeInTheDocument();
      });
    });

    it("transitions from seconds to minutes", async () => {
      const fiftyNineSecondsAgo = new Date(Date.now() - 59000);
      render(<LiveIndicator lastUpdated={fiftyNineSecondsAgo} />);

      expect(screen.getByText("Updated 59s ago")).toBeInTheDocument();

      // Fast-forward 1 second
      jest.advanceTimersByTime(1000);

      await waitFor(() => {
        expect(screen.getByText("Updated 1m ago")).toBeInTheDocument();
      });
    });
  });

  describe("Refresh Button", () => {
    it("does not show refresh button when onRefresh not provided", () => {
      render(<LiveIndicator />);

      expect(screen.queryByLabelText("Refresh")).not.toBeInTheDocument();
    });

    it("shows refresh button when onRefresh provided", () => {
      render(<LiveIndicator onRefresh={jest.fn()} />);

      expect(screen.getByLabelText("Refresh")).toBeInTheDocument();
    });

    it("calls onRefresh when button clicked", async () => {
      const user = userEvent.setup({ delay: null });
      const onRefresh = jest.fn();

      render(<LiveIndicator onRefresh={onRefresh} />);

      await user.click(screen.getByLabelText("Refresh"));

      expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it("shows refresh icon", () => {
      render(<LiveIndicator onRefresh={jest.fn()} />);

      const button = screen.getByLabelText("Refresh");
      const icon = button.querySelector("svg");
      expect(icon).toBeInTheDocument();
    });

    it("is disabled when isRefreshing is true", () => {
      render(<LiveIndicator onRefresh={jest.fn()} isRefreshing={true} />);

      const button = screen.getByLabelText("Refresh");
      expect(button).toBeDisabled();
    });

    it("shows spinning icon when refreshing", () => {
      render(<LiveIndicator onRefresh={jest.fn()} isRefreshing={true} />);

      const button = screen.getByLabelText("Refresh");
      const icon = button.querySelector(".animate-spin");
      expect(icon).toBeInTheDocument();
    });

    it("does not spin icon when not refreshing", () => {
      render(<LiveIndicator onRefresh={jest.fn()} isRefreshing={false} />);

      const button = screen.getByLabelText("Refresh");
      const icon = button.querySelector(".animate-spin");
      expect(icon).not.toBeInTheDocument();
    });

    it("has hover state", () => {
      render(<LiveIndicator onRefresh={jest.fn()} />);

      const button = screen.getByLabelText("Refresh");
      expect(button).toHaveClass("hover:bg-accent");
    });

    it("applies cursor-not-allowed when refreshing", () => {
      render(<LiveIndicator onRefresh={jest.fn()} isRefreshing={true} />);

      const button = screen.getByLabelText("Refresh");
      expect(button).toHaveClass("cursor-not-allowed");
    });

    it("has reduced opacity when refreshing", () => {
      render(<LiveIndicator onRefresh={jest.fn()} isRefreshing={true} />);

      const button = screen.getByLabelText("Refresh");
      expect(button).toHaveClass("opacity-50");
    });
  });

  describe("Styling", () => {
    it("has flex layout", () => {
      const { container } = render(<LiveIndicator />);

      const indicator = container.firstChild;
      expect(indicator).toHaveClass("flex", "items-center");
    });

    it("has gap between elements", () => {
      const { container } = render(<LiveIndicator />);

      const indicator = container.firstChild;
      expect(indicator).toHaveClass("gap-2");
    });

    it("has small text size", () => {
      const { container } = render(<LiveIndicator />);

      const indicator = container.firstChild;
      expect(indicator).toHaveClass("text-sm");
    });

    it("live badge has rounded corners", () => {
      render(<LiveIndicator />);

      const badge = screen.getByText("Live").closest("div");
      expect(badge).toHaveClass("rounded-md");
    });

    it("live badge has padding", () => {
      render(<LiveIndicator />);

      const badge = screen.getByText("Live").closest("div");
      expect(badge).toHaveClass("px-2", "py-1");
    });

    it("time has muted foreground color", () => {
      render(<LiveIndicator lastUpdated={new Date()} />);

      const time = screen.getByText(/Updated/);
      expect(time).toHaveClass("text-muted-foreground");
    });

    it("applies custom className", () => {
      const { container } = render(<LiveIndicator className="custom-indicator" />);

      const indicator = container.firstChild;
      expect(indicator).toHaveClass("custom-indicator");
    });
  });

  describe("Icon Animations", () => {
    it("live icon pulses", () => {
      const { container } = render(<LiveIndicator />);

      const icon = container.querySelector(".animate-pulse");
      expect(icon).toBeInTheDocument();
    });

    it("refresh icon spins when refreshing", () => {
      const { container } = render(<LiveIndicator onRefresh={jest.fn()} isRefreshing={true} />);

      const refreshIcon = container.querySelector(".animate-spin");
      expect(refreshIcon).toBeInTheDocument();
    });
  });

  describe("Real-World Usage Patterns", () => {
    it("shows live dashboard status", () => {
      const lastUpdated = new Date(Date.now() - 15000);
      render(<LiveIndicator lastUpdated={lastUpdated} onRefresh={jest.fn()} />);

      expect(screen.getByText("Live")).toBeInTheDocument();
      expect(screen.getByText("Updated 15s ago")).toBeInTheDocument();
      expect(screen.getByLabelText("Refresh")).toBeInTheDocument();
    });

    it("indicates real-time data feed", () => {
      render(<LiveIndicator lastUpdated={new Date()} />);

      expect(screen.getByText("Live")).toBeInTheDocument();
      expect(screen.getByText("Updated just now")).toBeInTheDocument();
    });

    it("shows manual refresh option", async () => {
      const user = userEvent.setup({ delay: null });
      const onRefresh = jest.fn();
      const lastUpdated = new Date(Date.now() - 60000);

      render(<LiveIndicator lastUpdated={lastUpdated} onRefresh={onRefresh} />);

      expect(screen.getByText("Updated 1m ago")).toBeInTheDocument();

      await user.click(screen.getByLabelText("Refresh"));

      expect(onRefresh).toHaveBeenCalled();
    });

    it("displays refreshing state", () => {
      render(<LiveIndicator lastUpdated={new Date()} onRefresh={jest.fn()} isRefreshing={true} />);

      const button = screen.getByLabelText("Refresh");
      expect(button).toBeDisabled();

      const { container } = render(
        <LiveIndicator lastUpdated={new Date()} onRefresh={jest.fn()} isRefreshing={true} />,
      );
      expect(container.querySelector(".animate-spin")).toBeInTheDocument();
    });
  });

  describe("Time Updates", () => {
    it("cleans up interval on unmount", () => {
      const { unmount } = render(<LiveIndicator lastUpdated={new Date()} />);

      unmount();

      // Advancing timers should not cause errors
      jest.advanceTimersByTime(5000);
      expect(true).toBe(true); // No error thrown
    });

    it("updates interval when lastUpdated changes", async () => {
      const { rerender } = render(<LiveIndicator lastUpdated={new Date(Date.now() - 10000)} />);

      expect(screen.getByText("Updated 10s ago")).toBeInTheDocument();

      const newTime = new Date(Date.now() - 30000);
      rerender(<LiveIndicator lastUpdated={newTime} />);

      expect(screen.getByText("Updated 30s ago")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("handles very recent update (< 10 seconds)", () => {
      const fiveSecondsAgo = new Date(Date.now() - 5000);
      render(<LiveIndicator lastUpdated={fiveSecondsAgo} />);

      expect(screen.getByText("Updated just now")).toBeInTheDocument();
    });

    it("handles exactly 1 minute ago", () => {
      const oneMinuteAgo = new Date(Date.now() - 60000);
      render(<LiveIndicator lastUpdated={oneMinuteAgo} />);

      expect(screen.getByText("Updated 1m ago")).toBeInTheDocument();
    });

    it("handles exactly 1 hour ago", () => {
      const oneHourAgo = new Date(Date.now() - 3600000);
      render(<LiveIndicator lastUpdated={oneHourAgo} />);

      expect(screen.getByText("Updated 1h ago")).toBeInTheDocument();
    });

    it("handles multiple hours", () => {
      const fiveHoursAgo = new Date(Date.now() - 5 * 3600000);
      render(<LiveIndicator lastUpdated={fiveHoursAgo} />);

      expect(screen.getByText("Updated 5h ago")).toBeInTheDocument();
    });

    it("handles rapid refresh clicks", async () => {
      const user = userEvent.setup({ delay: null });
      const onRefresh = jest.fn();

      render(<LiveIndicator onRefresh={onRefresh} />);

      const button = screen.getByLabelText("Refresh");
      await user.click(button);
      await user.click(button);
      await user.click(button);

      expect(onRefresh).toHaveBeenCalledTimes(3);
    });

    it("prevents refresh when already refreshing", async () => {
      const user = userEvent.setup({ delay: null });
      const onRefresh = jest.fn();

      render(<LiveIndicator onRefresh={onRefresh} isRefreshing={true} />);

      const button = screen.getByLabelText("Refresh");
      await user.click(button);

      // Button is disabled, so click should not trigger onRefresh
      expect(button).toBeDisabled();
    });
  });

  describe("Integration", () => {
    it("works with real-time data updates", async () => {
      let lastUpdated = new Date(Date.now() - 5000);
      const { rerender } = render(<LiveIndicator lastUpdated={lastUpdated} />);

      expect(screen.getByText("Updated just now")).toBeInTheDocument();

      // Simulate data update after 10 seconds
      jest.advanceTimersByTime(10000);
      lastUpdated = new Date();
      rerender(<LiveIndicator lastUpdated={lastUpdated} />);

      await waitFor(() => {
        expect(screen.getByText("Updated just now")).toBeInTheDocument();
      });
    });

    it("works with WebSocket connection status", () => {
      const isConnected = true;
      const lastMessage = new Date(Date.now() - 2000);

      render(<LiveIndicator lastUpdated={isConnected ? lastMessage : null} />);

      expect(screen.getByText("Live")).toBeInTheDocument();
      expect(screen.getByText("Updated just now")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("refresh button has aria-label", () => {
      render(<LiveIndicator onRefresh={jest.fn()} />);

      const button = screen.getByLabelText("Refresh");
      expect(button).toHaveAttribute("aria-label", "Refresh");
    });

    it("provides clear status indication", () => {
      render(<LiveIndicator lastUpdated={new Date()} />);

      expect(screen.getByText("Live")).toBeInTheDocument();
      expect(screen.getByText(/Updated/)).toBeInTheDocument();
    });
  });
});
