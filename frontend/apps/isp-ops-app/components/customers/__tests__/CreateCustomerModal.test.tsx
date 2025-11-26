/**
 * CreateCustomerModal Component Tests (App Wrapper)
 *
 * Thin wrapper test - validates prop forwarding and logging integration
 */

import React from "react";
import { renderQuick, screen } from "@dotmac/testing";
import { CreateCustomerModal } from "../CreateCustomerModal";

// Mock the shared component
const mockSharedModal = jest.fn();
jest.mock("@dotmac/features/customers", () => ({
  CreateCustomerModal: (...args: any[]) => mockSharedModal(...args),
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

describe("CreateCustomerModal (App Wrapper)", () => {
  const mockCustomer = {
    id: "cust-123",
    name: "John Doe",
    email: "john@example.com",
    phone: "+1234567890",
    address: "123 Main St",
    status: "active" as const,
  };

  const mockCreateCustomer = jest.fn();
  const mockUpdateCustomer = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementation
    mockSharedModal.mockImplementation(
      ({
        onClose,
        onCustomerCreated,
        editingCustomer,
        createCustomer,
        updateCustomer,
        loading,
      }) => (
        <div data-testid="shared-modal">
          <div data-testid="has-close">{onClose ? "yes" : "no"}</div>
          <div data-testid="has-created">{onCustomerCreated ? "yes" : "no"}</div>
          <div data-testid="has-editing">{editingCustomer ? "yes" : "no"}</div>
          <div data-testid="has-create-fn">{createCustomer ? "yes" : "no"}</div>
          <div data-testid="has-update-fn">{updateCustomer ? "yes" : "no"}</div>
          <div data-testid="loading">{loading ? "yes" : "no"}</div>
          <button onClick={onClose}>Close</button>
          <button onClick={() => onCustomerCreated?.(mockCustomer)}>Save</button>
        </div>
      ),
    );
  });

  it("forwards onClose prop to shared component", () => {
    const onClose = jest.fn();

    renderQuick(
      <CreateCustomerModal
        onClose={onClose}
        onCustomerCreated={jest.fn()}
        createCustomer={mockCreateCustomer}
        updateCustomer={mockUpdateCustomer}
      />,
    );

    expect(screen.getByTestId("has-close")).toHaveTextContent("yes");

    // Verify it's callable
    screen.getByText("Close").click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("wraps onCustomerCreated with logging", () => {
    const onCustomerCreated = jest.fn();

    renderQuick(
      <CreateCustomerModal
        onClose={jest.fn()}
        onCustomerCreated={onCustomerCreated}
        createCustomer={mockCreateCustomer}
        updateCustomer={mockUpdateCustomer}
      />,
    );

    expect(screen.getByTestId("has-created")).toHaveTextContent("yes");

    // Trigger the save
    screen.getByText("Save").click();

    // Verify logger was called
    expect(mockLogger.info).toHaveBeenCalledWith("Customer saved successfully", {
      customerId: "cust-123",
    });

    // Verify original callback was called
    expect(onCustomerCreated).toHaveBeenCalledWith(mockCustomer);
  });

  it("forwards editingCustomer prop to shared component", () => {
    renderQuick(
      <CreateCustomerModal
        onClose={jest.fn()}
        onCustomerCreated={jest.fn()}
        editingCustomer={mockCustomer}
        createCustomer={mockCreateCustomer}
        updateCustomer={mockUpdateCustomer}
      />,
    );

    expect(screen.getByTestId("has-editing")).toHaveTextContent("yes");
  });

  it("forwards createCustomer prop to shared component", () => {
    renderQuick(
      <CreateCustomerModal
        onClose={jest.fn()}
        onCustomerCreated={jest.fn()}
        createCustomer={mockCreateCustomer}
        updateCustomer={mockUpdateCustomer}
      />,
    );

    expect(screen.getByTestId("has-create-fn")).toHaveTextContent("yes");

    // Verify the correct function is passed
    expect(mockSharedModal).toHaveBeenCalledWith(
      expect.objectContaining({
        createCustomer: mockCreateCustomer,
      }),
      expect.anything(),
    );
  });

  it("forwards updateCustomer prop to shared component", () => {
    renderQuick(
      <CreateCustomerModal
        onClose={jest.fn()}
        onCustomerCreated={jest.fn()}
        createCustomer={mockCreateCustomer}
        updateCustomer={mockUpdateCustomer}
      />,
    );

    expect(screen.getByTestId("has-update-fn")).toHaveTextContent("yes");

    // Verify the correct function is passed
    expect(mockSharedModal).toHaveBeenCalledWith(
      expect.objectContaining({
        updateCustomer: mockUpdateCustomer,
      }),
      expect.anything(),
    );
  });

  it("forwards loading prop to shared component", () => {
    renderQuick(
      <CreateCustomerModal
        onClose={jest.fn()}
        onCustomerCreated={jest.fn()}
        createCustomer={mockCreateCustomer}
        updateCustomer={mockUpdateCustomer}
        loading={true}
      />,
    );

    expect(screen.getByTestId("loading")).toHaveTextContent("yes");
  });

  it("handles missing editingCustomer prop (create mode)", () => {
    renderQuick(
      <CreateCustomerModal
        onClose={jest.fn()}
        onCustomerCreated={jest.fn()}
        createCustomer={mockCreateCustomer}
        updateCustomer={mockUpdateCustomer}
      />,
    );

    expect(screen.getByTestId("has-editing")).toHaveTextContent("no");
    expect(screen.getByTestId("shared-modal")).toBeInTheDocument();
  });

  it("handles missing loading prop gracefully", () => {
    renderQuick(
      <CreateCustomerModal
        onClose={jest.fn()}
        onCustomerCreated={jest.fn()}
        createCustomer={mockCreateCustomer}
        updateCustomer={mockUpdateCustomer}
      />,
    );

    // Component should render fine without loading
    expect(screen.getByTestId("shared-modal")).toBeInTheDocument();
  });

  it("passes all props to shared component correctly", () => {
    const onClose = jest.fn();
    const onCustomerCreated = jest.fn();

    renderQuick(
      <CreateCustomerModal
        onClose={onClose}
        onCustomerCreated={onCustomerCreated}
        editingCustomer={mockCustomer}
        createCustomer={mockCreateCustomer}
        updateCustomer={mockUpdateCustomer}
        loading={false}
      />,
    );

    expect(mockSharedModal).toHaveBeenCalledWith(
      expect.objectContaining({
        onClose,
        editingCustomer: mockCustomer,
        createCustomer: mockCreateCustomer,
        updateCustomer: mockUpdateCustomer,
        loading: false,
      }),
      expect.anything(),
    );
  });

  it("logs with correct customer ID when customer is created", () => {
    const newCustomer = {
      id: "cust-new-789",
      name: "Jane Smith",
      email: "jane@example.com",
      phone: "+9876543210",
      address: "456 Oak Ave",
      status: "active" as const,
    };

    mockSharedModal.mockImplementation(({ onCustomerCreated }) => (
      <button onClick={() => onCustomerCreated?.(newCustomer)}>Save</button>
    ));

    renderQuick(
      <CreateCustomerModal
        onClose={jest.fn()}
        onCustomerCreated={jest.fn()}
        createCustomer={mockCreateCustomer}
        updateCustomer={mockUpdateCustomer}
      />,
    );

    screen.getByText("Save").click();

    expect(mockLogger.info).toHaveBeenCalledWith("Customer saved successfully", {
      customerId: "cust-new-789",
    });
  });

  it("logs correctly for both create and edit scenarios", () => {
    const onCustomerCreated = jest.fn();

    // First render in create mode
    const { rerender } = renderQuick(
      <CreateCustomerModal
        onClose={jest.fn()}
        onCustomerCreated={onCustomerCreated}
        createCustomer={mockCreateCustomer}
        updateCustomer={mockUpdateCustomer}
      />,
    );

    screen.getByText("Save").click();
    expect(mockLogger.info).toHaveBeenCalledWith("Customer saved successfully", {
      customerId: "cust-123",
    });

    mockLogger.info.mockClear();

    // Re-render in edit mode
    rerender(
      <CreateCustomerModal
        onClose={jest.fn()}
        onCustomerCreated={onCustomerCreated}
        editingCustomer={mockCustomer}
        createCustomer={mockCreateCustomer}
        updateCustomer={mockUpdateCustomer}
      />,
    );

    screen.getByText("Save").click();
    expect(mockLogger.info).toHaveBeenCalledWith("Customer saved successfully", {
      customerId: "cust-123",
    });
  });
});
