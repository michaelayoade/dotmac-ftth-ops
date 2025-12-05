/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import React from "react";

import { FeatureProvider, useFeatures } from "../components/FeatureProvider";

// Test component that uses the feature context
const FeatureConsumer = () => {
  const features = useFeatures();
  return (
    <div>
      <span data-testid="notifications">{features.notifications ? "on" : "off"}</span>
      <span data-testid="realtime">{features.realtime ? "on" : "off"}</span>
      <span data-testid="analytics">{features.analytics ? "on" : "off"}</span>
      <span data-testid="offline">{features.offline ? "on" : "off"}</span>
    </div>
  );
};

describe("FeatureProvider", () => {
  it("renders children correctly", () => {
    render(
      <FeatureProvider>
        <div data-testid="child">Hello</div>
      </FeatureProvider>
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("provides default empty feature flags", () => {
    render(
      <FeatureProvider>
        <FeatureConsumer />
      </FeatureProvider>
    );

    // All features default to undefined/falsy
    expect(screen.getByTestId("notifications")).toHaveTextContent("off");
    expect(screen.getByTestId("realtime")).toHaveTextContent("off");
    expect(screen.getByTestId("analytics")).toHaveTextContent("off");
    expect(screen.getByTestId("offline")).toHaveTextContent("off");
  });

  it("provides custom feature flags", () => {
    render(
      <FeatureProvider features={{ notifications: true, realtime: true }}>
        <FeatureConsumer />
      </FeatureProvider>
    );

    expect(screen.getByTestId("notifications")).toHaveTextContent("on");
    expect(screen.getByTestId("realtime")).toHaveTextContent("on");
    expect(screen.getByTestId("analytics")).toHaveTextContent("off");
    expect(screen.getByTestId("offline")).toHaveTextContent("off");
  });

  it("provides all feature flags when all enabled", () => {
    render(
      <FeatureProvider
        features={{
          notifications: true,
          realtime: true,
          analytics: true,
          offline: true,
        }}
      >
        <FeatureConsumer />
      </FeatureProvider>
    );

    expect(screen.getByTestId("notifications")).toHaveTextContent("on");
    expect(screen.getByTestId("realtime")).toHaveTextContent("on");
    expect(screen.getByTestId("analytics")).toHaveTextContent("on");
    expect(screen.getByTestId("offline")).toHaveTextContent("on");
  });

  it("allows selective feature configuration", () => {
    render(
      <FeatureProvider features={{ analytics: true, offline: true }}>
        <FeatureConsumer />
      </FeatureProvider>
    );

    expect(screen.getByTestId("notifications")).toHaveTextContent("off");
    expect(screen.getByTestId("realtime")).toHaveTextContent("off");
    expect(screen.getByTestId("analytics")).toHaveTextContent("on");
    expect(screen.getByTestId("offline")).toHaveTextContent("on");
  });
});

describe("useFeatures hook", () => {
  it("returns empty object when no provider is present", () => {
    // Note: This tests default context value behavior
    const TestComponent = () => {
      const features = useFeatures();
      return <div data-testid="empty">{Object.keys(features).length === 0 ? "empty" : "has-values"}</div>;
    };

    render(<TestComponent />);
    expect(screen.getByTestId("empty")).toHaveTextContent("empty");
  });

  it("returns feature flags from nearest provider", () => {
    render(
      <FeatureProvider features={{ notifications: true }}>
        <FeatureProvider features={{ realtime: true }}>
          <FeatureConsumer />
        </FeatureProvider>
      </FeatureProvider>
    );

    // Inner provider wins, so only realtime should be on
    expect(screen.getByTestId("notifications")).toHaveTextContent("off");
    expect(screen.getByTestId("realtime")).toHaveTextContent("on");
  });
});
