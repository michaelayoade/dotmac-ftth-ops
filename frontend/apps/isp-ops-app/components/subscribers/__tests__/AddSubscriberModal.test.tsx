/**
 * AddSubscriberModal Component Tests (App Wrapper)
 *
 * Thin wrapper test - validates prop forwarding to shared component
 */

import React from "react";
import { renderQuick, screen } from "@dotmac/testing";
import { AddSubscriberModal } from "../AddSubscriberModal";

// Mock the shared component
const mockSharedModal = jest.fn();
jest.mock("@dotmac/features/subscribers", () => ({
  AddSubscriberModal: (...args: any[]) => mockSharedModal(...args),
}));

// Mock the hook
jest.mock("@/hooks/useSubscribers", () => ({
  useSubscriberOperations: jest.fn(),
}));
const { useSubscriberOperations: mockUseSubscriberOperations } = jest.requireMock(
  "@/hooks/useSubscribers",
) as { useSubscriberOperations: jest.Mock };

describe("AddSubscriberModal (App Wrapper)", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementation
    mockSharedModal.mockImplementation(({ open, onClose, onSuccess, useSubscriberOperations }) => (
      <div data-testid="shared-modal">
        <div data-testid="open-state">{open ? "open" : "closed"}</div>
        <div data-testid="has-close">{onClose ? "yes" : "no"}</div>
        <div data-testid="has-success">{onSuccess ? "yes" : "no"}</div>
        <div data-testid="has-operations">{useSubscriberOperations ? "yes" : "no"}</div>
        <button onClick={onClose}>Close</button>
        <button onClick={() => onSuccess?.("sub-123")}>Success</button>
      </div>
    ));
  });

  it("forwards open prop to shared component", () => {
    renderQuick(<AddSubscriberModal open={true} onClose={jest.fn()} />);

    expect(screen.getByTestId("open-state")).toHaveTextContent("open");
  });

  it("forwards onClose prop to shared component", () => {
    const onClose = jest.fn();

    renderQuick(<AddSubscriberModal open={true} onClose={onClose} />);

    expect(screen.getByTestId("has-close")).toHaveTextContent("yes");

    // Verify it's callable
    screen.getByText("Close").click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("forwards onSuccess prop to shared component", () => {
    const onSuccess = jest.fn();

    renderQuick(<AddSubscriberModal open={true} onClose={jest.fn()} onSuccess={onSuccess} />);

    expect(screen.getByTestId("has-success")).toHaveTextContent("yes");

    // Verify it's callable
    screen.getByText("Success").click();
    expect(onSuccess).toHaveBeenCalledWith("sub-123");
  });

  it("forwards useSubscriberOperations hook to shared component", () => {
    renderQuick(<AddSubscriberModal open={true} onClose={jest.fn()} />);

    expect(screen.getByTestId("has-operations")).toHaveTextContent("yes");

    // Verify the correct hook is passed
    expect(mockSharedModal).toHaveBeenCalledWith(
      expect.objectContaining({
        useSubscriberOperations: mockUseSubscriberOperations,
      }),
      expect.anything(),
    );
  });

  it("handles missing onSuccess gracefully", () => {
    renderQuick(<AddSubscriberModal open={true} onClose={jest.fn()} />);

    // onSuccess is optional, so component should render fine
    expect(screen.getByTestId("shared-modal")).toBeInTheDocument();
  });

  it("renders shared modal when open is true", () => {
    renderQuick(<AddSubscriberModal open={true} onClose={jest.fn()} />);

    expect(screen.getByTestId("shared-modal")).toBeInTheDocument();
    expect(screen.getByTestId("open-state")).toHaveTextContent("open");
  });

  it("renders shared modal when open is false", () => {
    renderQuick(<AddSubscriberModal open={false} onClose={jest.fn()} />);

    expect(screen.getByTestId("shared-modal")).toBeInTheDocument();
    expect(screen.getByTestId("open-state")).toHaveTextContent("closed");
  });

  it("passes all props to shared component correctly", () => {
    const onClose = jest.fn();
    const onSuccess = jest.fn();

    renderQuick(<AddSubscriberModal open={true} onClose={onClose} onSuccess={onSuccess} />);

    expect(mockSharedModal).toHaveBeenCalledWith(
      {
        open: true,
        onClose,
        onSuccess,
        useSubscriberOperations: mockUseSubscriberOperations,
      },
      expect.anything(),
    );
  });
});
