/**
 * MetricCardEnhanced Component Tests
 *
 * Tests enhanced metric card with animations, trends, and states
 */

import { render, screen } from "@testing-library/react";
import { TrendingUp, DollarSign } from "lucide-react";
import React from "react";

import { MetricCardEnhanced } from "../metric-card-enhanced";

type AnimatedCardProps = React.HTMLAttributes<HTMLDivElement> & {
  disabled?: boolean;
};

type AnimatedCounterProps = {
  value: number | string;
  prefix?: React.ReactNode;
  className?: string;
};

type FadeInWhenVisibleProps = {
  children: React.ReactNode;
};

// Mock @dotmac/primitives
jest.mock("@dotmac/primitives", () => ({
  AnimatedCard: ({ children, className, disabled, ...props }: AnimatedCardProps) => (
    <div className={className} data-disabled={disabled} {...props}>
      {children}
    </div>
  ),
  AnimatedCounter: ({ value, prefix, className }: AnimatedCounterProps) => (
    <div className={className} data-testid="animated-counter">
      {prefix}
      {value}
    </div>
  ),
  FadeInWhenVisible: ({ children }: FadeInWhenVisibleProps) => <div>{children}</div>,
}));

describe("MetricCardEnhanced", () => {
  describe("Basic Rendering", () => {
    it("renders metric card", () => {
      render(<MetricCardEnhanced title="Total Revenue" value={12500} icon={DollarSign} />);

      expect(screen.getByText("Total Revenue")).toBeInTheDocument();
    });

    it("displays title", () => {
      render(<MetricCardEnhanced title="Active Users" value={350} icon={TrendingUp} />);

      expect(screen.getByText("Active Users")).toBeInTheDocument();
    });

    it("displays numeric value", () => {
      render(<MetricCardEnhanced title="Revenue" value={1000} icon={DollarSign} />);

      const counter = screen.getByTestId("animated-counter");
      expect(counter).toHaveTextContent("1000");
    });

    it("displays string value", () => {
      render(<MetricCardEnhanced title="Status" value="Active" icon={TrendingUp} />);

      expect(screen.getByText("Active")).toBeInTheDocument();
    });

    it("displays subtitle when provided", () => {
      render(
        <MetricCardEnhanced
          title="Revenue"
          value={1000}
          subtitle="Total this month"
          icon={DollarSign}
        />,
      );

      expect(screen.getByText("Total this month")).toBeInTheDocument();
    });
  });

  describe("Currency Formatting", () => {
    it("formats value as currency when currency prop is true", () => {
      render(<MetricCardEnhanced title="Revenue" value={12500.75} currency icon={DollarSign} />);

      // AnimatedCounter shows $ prefix with raw number (no comma formatting)
      const counter = screen.getByTestId("animated-counter");
      expect(counter).toHaveTextContent("$12500.75");
    });

    it("displays currency without decimals for whole numbers", () => {
      render(<MetricCardEnhanced title="Revenue" value={1000} currency icon={DollarSign} />);

      // AnimatedCounter shows $ prefix with raw number (no comma formatting)
      const counter = screen.getByTestId("animated-counter");
      expect(counter).toHaveTextContent("$1000");
    });

    it("does not format as currency when currency prop is false", () => {
      render(<MetricCardEnhanced title="Count" value={1000} icon={TrendingUp} />);

      const counter = screen.getByTestId("animated-counter");
      expect(counter).toHaveTextContent("1000");
      expect(counter).not.toHaveTextContent("$");
    });

    it("adds $ prefix to animated counter when currency is true", () => {
      render(<MetricCardEnhanced title="Revenue" value={1000} currency icon={DollarSign} />);

      const counter = screen.getByTestId("animated-counter");
      expect(counter).toHaveTextContent("$1000");
    });
  });

  describe("Trend Indicator", () => {
    it("displays positive trend", () => {
      render(
        <MetricCardEnhanced
          title="Revenue"
          value={1000}
          trend={{ value: 15, isPositive: true }}
          icon={DollarSign}
        />,
      );

      expect(screen.getByText("15% from last month")).toBeInTheDocument();
    });

    it("displays negative trend", () => {
      render(
        <MetricCardEnhanced
          title="Revenue"
          value={1000}
          trend={{ value: 10, isPositive: false }}
          icon={DollarSign}
        />,
      );

      expect(screen.getByText("10% from last month")).toBeInTheDocument();
    });

    it("applies positive trend color class", () => {
      render(
        <MetricCardEnhanced
          title="Revenue"
          value={1000}
          trend={{ value: 15, isPositive: true }}
          icon={DollarSign}
        />,
      );

      const trendText = screen.getByText("15% from last month");
      expect(trendText).toHaveClass("text-green-400");
    });

    it("applies negative trend color class", () => {
      render(
        <MetricCardEnhanced
          title="Revenue"
          value={1000}
          trend={{ value: 10, isPositive: false }}
          icon={DollarSign}
        />,
      );

      const trendText = screen.getByText("10% from last month");
      expect(trendText).toHaveClass("text-red-400");
    });

    it("displays trend with negative value as absolute", () => {
      render(
        <MetricCardEnhanced
          title="Revenue"
          value={1000}
          trend={{ value: -15, isPositive: false }}
          icon={DollarSign}
        />,
      );

      expect(screen.getByText("15% from last month")).toBeInTheDocument();
    });

    it("does not display trend when not provided", () => {
      render(<MetricCardEnhanced title="Revenue" value={1000} icon={DollarSign} />);

      expect(screen.queryByText(/from last month/)).not.toBeInTheDocument();
    });
  });

  describe("Loading State", () => {
    it("displays loading skeleton when loading is true", () => {
      const { container } = render(
        <MetricCardEnhanced title="Revenue" value={1000} loading icon={DollarSign} />,
      );

      const skeletons = container.querySelectorAll(".animate-pulse");
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("does not display value when loading", () => {
      render(<MetricCardEnhanced title="Revenue" value={1000} loading icon={DollarSign} />);

      expect(screen.queryByTestId("animated-counter")).not.toBeInTheDocument();
    });

    it("does not display subtitle when loading", () => {
      render(
        <MetricCardEnhanced
          title="Revenue"
          value={1000}
          subtitle="Total this month"
          loading
          icon={DollarSign}
        />,
      );

      expect(screen.queryByText("Total this month")).not.toBeInTheDocument();
    });

    it("does not display trend when loading", () => {
      render(
        <MetricCardEnhanced
          title="Revenue"
          value={1000}
          trend={{ value: 15, isPositive: true }}
          loading
          icon={DollarSign}
        />,
      );

      expect(screen.queryByText(/from last month/)).not.toBeInTheDocument();
    });

    it("disables AnimatedCard when loading", () => {
      const { container } = render(
        <MetricCardEnhanced title="Revenue" value={1000} loading icon={DollarSign} />,
      );

      const card = container.querySelector("[data-disabled='true']");
      expect(card).toBeInTheDocument();
    });
  });

  describe("Error State", () => {
    it("displays error message when error is provided", () => {
      render(
        <MetricCardEnhanced title="Revenue" value={1000} error="Network error" icon={DollarSign} />,
      );

      expect(screen.getByText("Failed to load")).toBeInTheDocument();
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });

    it("does not display value when error is present", () => {
      render(
        <MetricCardEnhanced title="Revenue" value={1000} error="Network error" icon={DollarSign} />,
      );

      expect(screen.queryByTestId("animated-counter")).not.toBeInTheDocument();
    });

    it("applies error border class", () => {
      const { container } = render(
        <MetricCardEnhanced title="Revenue" value={1000} error="Network error" icon={DollarSign} />,
      );

      const card = container.querySelector(".border-red-200");
      expect(card).toBeInTheDocument();
    });

    it("disables AnimatedCard when error is present", () => {
      const { container } = render(
        <MetricCardEnhanced title="Revenue" value={1000} error="Network error" icon={DollarSign} />,
      );

      const card = container.querySelector("[data-disabled='true']");
      expect(card).toBeInTheDocument();
    });
  });

  describe("Empty State", () => {
    it("displays empty state message when value is 0", () => {
      render(
        <MetricCardEnhanced
          title="Revenue"
          value={0}
          emptyStateMessage="No revenue this month"
          icon={DollarSign}
        />,
      );

      expect(screen.getByText("No revenue this month")).toBeInTheDocument();
    });

    it("displays empty state message when value is string '0'", () => {
      render(
        <MetricCardEnhanced
          title="Revenue"
          value="0"
          emptyStateMessage="No revenue this month"
          icon={DollarSign}
        />,
      );

      expect(screen.getByText("No revenue this month")).toBeInTheDocument();
    });

    it("does not display subtitle when empty state is shown", () => {
      render(
        <MetricCardEnhanced
          title="Revenue"
          value={0}
          subtitle="Total this month"
          emptyStateMessage="No revenue"
          icon={DollarSign}
        />,
      );

      expect(screen.queryByText("Total this month")).not.toBeInTheDocument();
      expect(screen.getByText("No revenue")).toBeInTheDocument();
    });

    it("does not display trend when empty state is shown", () => {
      render(
        <MetricCardEnhanced
          title="Revenue"
          value={0}
          trend={{ value: 15, isPositive: true }}
          emptyStateMessage="No revenue"
          icon={DollarSign}
        />,
      );

      expect(screen.queryByText(/from last month/)).not.toBeInTheDocument();
    });

    it("does not show empty state when loading", () => {
      render(
        <MetricCardEnhanced
          title="Revenue"
          value={0}
          emptyStateMessage="No revenue"
          loading
          icon={DollarSign}
        />,
      );

      expect(screen.queryByText("No revenue")).not.toBeInTheDocument();
    });

    it("does not show empty state when error is present", () => {
      render(
        <MetricCardEnhanced
          title="Revenue"
          value={0}
          emptyStateMessage="No revenue"
          error="Network error"
          icon={DollarSign}
        />,
      );

      expect(screen.queryByText("No revenue")).not.toBeInTheDocument();
    });
  });

  describe("Link Wrapper", () => {
    it("renders as link when href is provided", () => {
      render(<MetricCardEnhanced title="Revenue" value={1000} href="/revenue" icon={DollarSign} />);

      const link = screen.getByRole("link");
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/revenue");
    });

    it("does not render as link when href is not provided", () => {
      render(<MetricCardEnhanced title="Revenue" value={1000} icon={DollarSign} />);

      expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });

    it("does not render as link when loading", () => {
      render(
        <MetricCardEnhanced
          title="Revenue"
          value={1000}
          href="/revenue"
          loading
          icon={DollarSign}
        />,
      );

      expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });

    it("does not render as link when error is present", () => {
      render(
        <MetricCardEnhanced
          title="Revenue"
          value={1000}
          href="/revenue"
          error="Network error"
          icon={DollarSign}
        />,
      );

      expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });
  });

  describe("Custom ClassName", () => {
    it("supports custom className", () => {
      const { container } = render(
        <MetricCardEnhanced
          title="Revenue"
          value={1000}
          className="custom-metric-card"
          icon={DollarSign}
        />,
      );

      const card = container.querySelector(".custom-metric-card");
      expect(card).toBeInTheDocument();
    });

    it("merges custom className with base classes", () => {
      const { container } = render(
        <MetricCardEnhanced
          title="Revenue"
          value={1000}
          className="custom-metric-card"
          icon={DollarSign}
        />,
      );

      const card = container.querySelector(".custom-metric-card");
      expect(card).toHaveClass("custom-metric-card", "rounded-lg", "border", "p-6");
    });
  });

  describe("Animated Counter", () => {
    it("uses animated counter for numeric values", () => {
      render(<MetricCardEnhanced title="Revenue" value={1000} icon={DollarSign} />);

      expect(screen.getByTestId("animated-counter")).toBeInTheDocument();
    });

    it("does not use animated counter for string values", () => {
      render(<MetricCardEnhanced title="Status" value="Active" icon={TrendingUp} />);

      expect(screen.queryByTestId("animated-counter")).not.toBeInTheDocument();
    });

    it("does not use animated counter when loading", () => {
      render(<MetricCardEnhanced title="Revenue" value={1000} loading icon={DollarSign} />);

      expect(screen.queryByTestId("animated-counter")).not.toBeInTheDocument();
    });

    it("does not use animated counter when error is present", () => {
      render(
        <MetricCardEnhanced title="Revenue" value={1000} error="Network error" icon={DollarSign} />,
      );

      expect(screen.queryByTestId("animated-counter")).not.toBeInTheDocument();
    });
  });

  describe("Value Parsing", () => {
    it("parses string value with formatting characters", () => {
      render(<MetricCardEnhanced title="Revenue" value="$1,234.56" icon={DollarSign} />);

      expect(screen.getByText("$1,234.56")).toBeInTheDocument();
    });

    it("handles negative values", () => {
      render(<MetricCardEnhanced title="Revenue" value={-500} icon={DollarSign} />);

      const counter = screen.getByTestId("animated-counter");
      expect(counter).toHaveTextContent("-500");
    });

    it("handles decimal values", () => {
      render(<MetricCardEnhanced title="Revenue" value={123.45} icon={DollarSign} />);

      const counter = screen.getByTestId("animated-counter");
      expect(counter).toHaveTextContent("123.45");
    });

    it("handles zero value", () => {
      render(<MetricCardEnhanced title="Revenue" value={0} icon={DollarSign} />);

      const counter = screen.getByTestId("animated-counter");
      expect(counter).toHaveTextContent("0");
    });
  });

  describe("Real-World Usage Patterns", () => {
    it("renders revenue card with trend", () => {
      render(
        <MetricCardEnhanced
          title="Total Revenue"
          value={125000}
          subtitle="Last 30 days"
          currency
          trend={{ value: 12, isPositive: true }}
          icon={DollarSign}
        />,
      );

      expect(screen.getByText("Total Revenue")).toBeInTheDocument();
      // AnimatedCounter shows raw value without comma formatting
      const counter = screen.getByTestId("animated-counter");
      expect(counter).toHaveTextContent("$125000");
      expect(screen.getByText("Last 30 days")).toBeInTheDocument();
      expect(screen.getByText("12% from last month")).toBeInTheDocument();
    });

    it("renders user count card", () => {
      render(
        <MetricCardEnhanced
          title="Active Users"
          value={350}
          subtitle="Online now"
          icon={TrendingUp}
        />,
      );

      expect(screen.getByText("Active Users")).toBeInTheDocument();
      expect(screen.getByText("Online now")).toBeInTheDocument();
    });

    it("renders clickable revenue card", () => {
      render(
        <MetricCardEnhanced
          title="Total Revenue"
          value={125000}
          currency
          href="/analytics/revenue"
          icon={DollarSign}
        />,
      );

      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("href", "/analytics/revenue");
    });

    it("renders loading revenue card", () => {
      render(<MetricCardEnhanced title="Total Revenue" value={0} loading icon={DollarSign} />);

      expect(screen.getByText("Total Revenue")).toBeInTheDocument();
      const { container } = render(
        <MetricCardEnhanced title="Total Revenue" value={0} loading icon={DollarSign} />,
      );
      const skeletons = container.querySelectorAll(".animate-pulse");
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("renders error state card", () => {
      render(
        <MetricCardEnhanced
          title="Total Revenue"
          value={0}
          error="Failed to fetch data from API"
          icon={DollarSign}
        />,
      );

      expect(screen.getByText("Failed to load")).toBeInTheDocument();
      expect(screen.getByText("Failed to fetch data from API")).toBeInTheDocument();
    });

    it("renders empty state card", () => {
      render(
        <MetricCardEnhanced
          title="New Signups"
          value={0}
          emptyStateMessage="No new signups this month"
          icon={TrendingUp}
        />,
      );

      expect(screen.getByText("No new signups this month")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("handles very large numbers", () => {
      render(<MetricCardEnhanced title="Revenue" value={999999999} currency icon={DollarSign} />);

      // AnimatedCounter shows raw value without comma formatting
      const counter = screen.getByTestId("animated-counter");
      expect(counter).toHaveTextContent("$999999999");
    });

    it("handles very small decimal numbers", () => {
      render(<MetricCardEnhanced title="Revenue" value={0.01} currency icon={DollarSign} />);

      expect(screen.getByText("$0.01")).toBeInTheDocument();
    });

    it("handles trend value of 0", () => {
      render(
        <MetricCardEnhanced
          title="Revenue"
          value={1000}
          trend={{ value: 0, isPositive: true }}
          icon={DollarSign}
        />,
      );

      expect(screen.getByText("0% from last month")).toBeInTheDocument();
    });

    it("handles empty string value", () => {
      render(<MetricCardEnhanced title="Status" value="" icon={TrendingUp} />);

      expect(screen.getByText("Status")).toBeInTheDocument();
    });
  });
});
