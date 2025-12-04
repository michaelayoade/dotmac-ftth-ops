/**
 * CustomerEditModal Component Tests (App Wrapper)
 *
 * Thin wrapper test - validates prop forwarding and logging integration
 */

import React from "react";
import { renderQuick, screen } from "@dotmac/testing";
import { CustomerEditModal } from "../CustomerEditModal";

// Mock the shared component
const mockSharedModal = jest.fn();
jest.mock("@dotmac/features/customers", () => ({
  CustomerEditModal: (...args: any[]) => mockSharedModal(...args),
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));
const { logger: mockLogger } = jest.requireMock("@/lib/logger") as {
  logger: { info: jest.Mock; error: jest.Mock; warn: jest.Mock; debug: jest.Mock };
};

describe("CustomerEditModal (App Wrapper)", () => {
  const mockCustomer = {
    id: "cust-123",
    name: "John Doe",
    email: "john@example.com",
    phone: "+1234567890",
    address: "123 Main St",
    status: "active" as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementation
    mockSharedModal.mockImplementation(
      ({ customer, onClose, onCustomerUpdated, updateCustomer, loading }) => (
        <div data-testid="shared-modal">
          <div data-testid="has-customer">{customer ? "yes" : "no"}</div>
          <div data-testid="has-close">{onClose ? "yes" : "no"}</div>
          <div data-testid="has-updated">{onCustomerUpdated ? "yes" : "no"}</div>
          <div data-testid="has-update-fn">{updateCustomer ? "yes" : "no"}</div>
          <div data-testid="loading">{loading ? "yes" : "no"}</div>
          <button onClick={onClose}>Close</button>
          <button onClick={() => onCustomerUpdated?.(customer)}>Save</button>
        </div>
      ),
    );
  });

  it("forwards customer prop to shared component", () => {
    renderQuick(
      <CustomerEditModal
        customer={mockCustomer}
        onClose={jest.fn()}
        onCustomerUpdated={jest.fn()}
      />,
    );

    expect(screen.getByTestId("has-customer")).toHaveTextContent("yes");
  });

  it("forwards onClose prop to shared component", () => {
    const onClose = jest.fn();

    renderQuick(
      <CustomerEditModal customer={mockCustomer} onClose={onClose} onCustomerUpdated={jest.fn()} />,
    );

    expect(screen.getByTestId("has-close")).toHaveTextContent("yes");

    // Verify it's callable
    screen.getByText("Close").click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("wraps onCustomerUpdated with logging", () => {
    const onCustomerUpdated = jest.fn();

    renderQuick(
      <CustomerEditModal
        customer={mockCustomer}
        onClose={jest.fn()}
        onCustomerUpdated={onCustomerUpdated}
      />,
    );

    expect(screen.getByTestId("has-updated")).toHaveTextContent("yes");

    // Trigger the save
    screen.getByText("Save").click();

    // Verify logger was called
    expect(mockLogger.info).toHaveBeenCalledWith("Customer updated successfully", {
      customerId: "cust-123",
    });

    // Verify original callback was called
    expect(onCustomerUpdated).toHaveBeenCalledWith(mockCustomer);
  });

  it("forwards updateCustomer prop to shared component", () => {
    const updateCustomer = jest.fn();

    renderQuick(
      <CustomerEditModal
        customer={mockCustomer}
        onClose={jest.fn()}
        onCustomerUpdated={jest.fn()}
        updateCustomer={updateCustomer}
      />,
    );

    expect(screen.getByTestId("has-update-fn")).toHaveTextContent("yes");

    // Verify the correct function is passed
    expect(mockSharedModal).toHaveBeenCalledWith(
      expect.objectContaining({
        updateCustomer,
      }),
      expect.anything(),
    );
  });

  it("forwards loading prop to shared component", () => {
    renderQuick(
      <CustomerEditModal
        customer={mockCustomer}
        onClose={jest.fn()}
        onCustomerUpdated={jest.fn()}
        loading={true}
      />,
    );

    expect(screen.getByTestId("loading")).toHaveTextContent("yes");
  });

  it("handles missing customer prop", () => {
    renderQuick(
      <CustomerEditModal customer={null} onClose={jest.fn()} onCustomerUpdated={jest.fn()} />,
    );

    expect(screen.getByTestId("has-customer")).toHaveTextContent("no");
    expect(screen.getByTestId("shared-modal")).toBeInTheDocument();
  });

  it("handles missing optional props gracefully", () => {
    renderQuick(
      <CustomerEditModal
        customer={mockCustomer}
        onClose={jest.fn()}
        onCustomerUpdated={jest.fn()}
      />,
    );

    // Component should render fine without updateCustomer and loading
    expect(screen.getByTestId("shared-modal")).toBeInTheDocument();
  });

  it("passes all props to shared component correctly", () => {
    const onClose = jest.fn();
    const onCustomerUpdated = jest.fn();
    const updateCustomer = jest.fn();

    renderQuick(
      <CustomerEditModal
        customer={mockCustomer}
        onClose={onClose}
        onCustomerUpdated={onCustomerUpdated}
        updateCustomer={updateCustomer}
        loading={false}
      />,
    );

    expect(mockSharedModal).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: mockCustomer,
        onClose,
        updateCustomer,
        loading: false,
      }),
      expect.anything(),
    );
  });

  it("logs with correct customer ID when customer is updated", () => {
    const updatedCustomer = {
      ...mockCustomer,
      id: "cust-456",
      name: "Jane Smith",
    };

    mockSharedModal.mockImplementation(({ onCustomerUpdated }) => (
      <button onClick={() => onCustomerUpdated?.(updatedCustomer)}>Save</button>
    ));

    renderQuick(
      <CustomerEditModal
        customer={mockCustomer}
        onClose={jest.fn()}
        onCustomerUpdated={jest.fn()}
      />,
    );

    screen.getByText("Save").click();

    expect(mockLogger.info).toHaveBeenCalledWith("Customer updated successfully", {
      customerId: "cust-456",
    });
  });
});
