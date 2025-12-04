/**
 * SubscriberDetailModal Component Tests (App Wrapper)
 *
 * Thin wrapper test - validates prop forwarding and hook injection
 */

import React from "react";
import { renderQuick, screen } from "@dotmac/testing";
import { SubscriberDetailModal } from "../SubscriberDetailModal";

// Mock the shared component
const mockSharedModal = jest.fn();
jest.mock("@dotmac/features/subscribers", () => ({
  SubscriberDetailModal: (...args: any[]) => mockSharedModal(...args),
}));

// Mock the hook
jest.mock("@/hooks/useSubscribers", () => ({
  useSubscriberServices: jest.fn(),
}));
const { useSubscriberServices: mockUseSubscriberServices } = jest.requireMock(
  "@/hooks/useSubscribers",
) as { useSubscriberServices: jest.Mock };

describe("SubscriberDetailModal (App Wrapper)", () => {
  const mockSubscriber = {
    id: "sub-123",
    username: "john.doe",
    email: "john@example.com",
    status: "active" as const,
    ipv4_address: "192.168.1.100",
    ipv6_address: "2001:db8::1",
  };

  const mockServices = [
    { id: "svc-1", name: "Internet Service", status: "active" },
    { id: "svc-2", name: "VoIP Service", status: "active" },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Default hook mock
    mockUseSubscriberServices.mockReturnValue({
      data: mockServices,
      isLoading: false,
      refetch: jest.fn(),
    });

    // Default shared component mock
    mockSharedModal.mockImplementation(
      ({
        subscriber,
        open,
        onClose,
        onUpdate,
        onSuspend,
        onActivate,
        onTerminate,
        services,
        servicesLoading,
        onRefreshServices,
      }) => (
        <div data-testid="shared-modal">
          <div data-testid="has-subscriber">{subscriber ? "yes" : "no"}</div>
          <div data-testid="open">{open ? "yes" : "no"}</div>
          <div data-testid="has-close">{onClose ? "yes" : "no"}</div>
          <div data-testid="has-update">{onUpdate ? "yes" : "no"}</div>
          <div data-testid="has-suspend">{onSuspend ? "yes" : "no"}</div>
          <div data-testid="has-activate">{onActivate ? "yes" : "no"}</div>
          <div data-testid="has-terminate">{onTerminate ? "yes" : "no"}</div>
          <div data-testid="services-count">{services?.length || 0}</div>
          <div data-testid="services-loading">{servicesLoading ? "yes" : "no"}</div>
          <div data-testid="has-refresh">{onRefreshServices ? "yes" : "no"}</div>
          <button onClick={onClose}>Close</button>
          <button onClick={() => onSuspend?.(subscriber!)}>Suspend</button>
          <button onClick={() => onActivate?.(subscriber!)}>Activate</button>
          <button onClick={() => onTerminate?.(subscriber!)}>Terminate</button>
          <button onClick={onRefreshServices}>Refresh</button>
        </div>
      ),
    );
  });

  it("forwards subscriber prop to shared component", () => {
    renderQuick(
      <SubscriberDetailModal subscriber={mockSubscriber} open={true} onClose={jest.fn()} />,
    );

    expect(screen.getByTestId("has-subscriber")).toHaveTextContent("yes");
  });

  it("forwards open prop to shared component", () => {
    renderQuick(
      <SubscriberDetailModal subscriber={mockSubscriber} open={true} onClose={jest.fn()} />,
    );

    expect(screen.getByTestId("open")).toHaveTextContent("yes");
  });

  it("forwards onClose prop to shared component", () => {
    const onClose = jest.fn();

    renderQuick(
      <SubscriberDetailModal subscriber={mockSubscriber} open={true} onClose={onClose} />,
    );

    expect(screen.getByTestId("has-close")).toHaveTextContent("yes");

    // Verify it's callable
    screen.getByText("Close").click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("forwards onUpdate prop to shared component", () => {
    const onUpdate = jest.fn();

    renderQuick(
      <SubscriberDetailModal
        subscriber={mockSubscriber}
        open={true}
        onClose={jest.fn()}
        onUpdate={onUpdate}
      />,
    );

    expect(screen.getByTestId("has-update")).toHaveTextContent("yes");
  });

  it("forwards onSuspend prop to shared component", () => {
    const onSuspend = jest.fn();

    renderQuick(
      <SubscriberDetailModal
        subscriber={mockSubscriber}
        open={true}
        onClose={jest.fn()}
        onSuspend={onSuspend}
      />,
    );

    expect(screen.getByTestId("has-suspend")).toHaveTextContent("yes");

    // Verify it's callable
    screen.getByText("Suspend").click();
    expect(onSuspend).toHaveBeenCalledWith(mockSubscriber);
  });

  it("forwards onActivate prop to shared component", () => {
    const onActivate = jest.fn();

    renderQuick(
      <SubscriberDetailModal
        subscriber={mockSubscriber}
        open={true}
        onClose={jest.fn()}
        onActivate={onActivate}
      />,
    );

    expect(screen.getByTestId("has-activate")).toHaveTextContent("yes");

    // Verify it's callable
    screen.getByText("Activate").click();
    expect(onActivate).toHaveBeenCalledWith(mockSubscriber);
  });

  it("forwards onTerminate prop to shared component", () => {
    const onTerminate = jest.fn();

    renderQuick(
      <SubscriberDetailModal
        subscriber={mockSubscriber}
        open={true}
        onClose={jest.fn()}
        onTerminate={onTerminate}
      />,
    );

    expect(screen.getByTestId("has-terminate")).toHaveTextContent("yes");

    // Verify it's callable
    screen.getByText("Terminate").click();
    expect(onTerminate).toHaveBeenCalledWith(mockSubscriber);
  });

  it("injects services from useSubscriberServices hook", () => {
    renderQuick(
      <SubscriberDetailModal subscriber={mockSubscriber} open={true} onClose={jest.fn()} />,
    );

    expect(screen.getByTestId("services-count")).toHaveTextContent("2");

    // Verify hook was called with correct subscriber ID
    expect(mockUseSubscriberServices).toHaveBeenCalledWith("sub-123");
  });

  it("injects servicesLoading state from hook", () => {
    mockUseSubscriberServices.mockReturnValue({
      data: [],
      isLoading: true,
      refetch: jest.fn(),
    });

    renderQuick(
      <SubscriberDetailModal subscriber={mockSubscriber} open={true} onClose={jest.fn()} />,
    );

    expect(screen.getByTestId("services-loading")).toHaveTextContent("yes");
  });

  it("injects refetch function as onRefreshServices", () => {
    const mockRefetch = jest.fn();
    mockUseSubscriberServices.mockReturnValue({
      data: mockServices,
      isLoading: false,
      refetch: mockRefetch,
    });

    renderQuick(
      <SubscriberDetailModal subscriber={mockSubscriber} open={true} onClose={jest.fn()} />,
    );

    expect(screen.getByTestId("has-refresh")).toHaveTextContent("yes");

    // Verify it's callable
    screen.getByText("Refresh").click();
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("handles null subscriber gracefully", () => {
    renderQuick(<SubscriberDetailModal subscriber={null} open={true} onClose={jest.fn()} />);

    expect(screen.getByTestId("has-subscriber")).toHaveTextContent("no");
    expect(screen.getByTestId("shared-modal")).toBeInTheDocument();

    // Hook should be called with null
    expect(mockUseSubscriberServices).toHaveBeenCalledWith(null);
  });

  it("provides empty services array when hook returns undefined", () => {
    mockUseSubscriberServices.mockReturnValue({
      data: undefined,
      isLoading: false,
      refetch: jest.fn(),
    });

    renderQuick(
      <SubscriberDetailModal subscriber={mockSubscriber} open={true} onClose={jest.fn()} />,
    );

    expect(screen.getByTestId("services-count")).toHaveTextContent("0");
  });

  it("handles missing optional props gracefully", () => {
    renderQuick(
      <SubscriberDetailModal subscriber={mockSubscriber} open={true} onClose={jest.fn()} />,
    );

    // Component should render fine without onUpdate, onSuspend, onActivate, onTerminate
    expect(screen.getByTestId("shared-modal")).toBeInTheDocument();
    expect(screen.getByTestId("has-update")).toHaveTextContent("no");
    expect(screen.getByTestId("has-suspend")).toHaveTextContent("no");
    expect(screen.getByTestId("has-activate")).toHaveTextContent("no");
    expect(screen.getByTestId("has-terminate")).toHaveTextContent("no");
  });

  it("passes all props and injections to shared component correctly", () => {
    const onClose = jest.fn();
    const onUpdate = jest.fn();
    const onSuspend = jest.fn();
    const onActivate = jest.fn();
    const onTerminate = jest.fn();

    const mockRefetch = jest.fn();
    mockUseSubscriberServices.mockReturnValue({
      data: mockServices,
      isLoading: false,
      refetch: mockRefetch,
    });

    renderQuick(
      <SubscriberDetailModal
        subscriber={mockSubscriber}
        open={true}
        onClose={onClose}
        onUpdate={onUpdate}
        onSuspend={onSuspend}
        onActivate={onActivate}
        onTerminate={onTerminate}
      />,
    );

    expect(mockSharedModal).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriber: mockSubscriber,
        open: true,
        onClose,
        onUpdate,
        onSuspend,
        onActivate,
        onTerminate,
        services: mockServices,
        servicesLoading: false,
        onRefreshServices: mockRefetch,
      }),
      expect.anything(),
    );
  });

  it("updates when subscriber ID changes", () => {
    const { rerender } = renderQuick(
      <SubscriberDetailModal subscriber={mockSubscriber} open={true} onClose={jest.fn()} />,
    );

    expect(mockUseSubscriberServices).toHaveBeenCalledWith("sub-123");

    const newSubscriber = { ...mockSubscriber, id: "sub-456" };
    rerender(<SubscriberDetailModal subscriber={newSubscriber} open={true} onClose={jest.fn()} />);

    expect(mockUseSubscriberServices).toHaveBeenCalledWith("sub-456");
  });

  it("handles subscriber changing from null to valid", () => {
    const { rerender } = renderQuick(
      <SubscriberDetailModal subscriber={null} open={true} onClose={jest.fn()} />,
    );

    expect(mockUseSubscriberServices).toHaveBeenCalledWith(null);

    rerender(<SubscriberDetailModal subscriber={mockSubscriber} open={true} onClose={jest.fn()} />);

    expect(mockUseSubscriberServices).toHaveBeenCalledWith("sub-123");
  });
});
