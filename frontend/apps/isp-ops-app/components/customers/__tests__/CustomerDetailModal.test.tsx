/**
 * CustomerDetailModal Component Tests (App Wrapper)
 *
 * Thin wrapper test - validates prop forwarding and hook/component injection
 */

import React from "react";
import { renderQuick, screen } from "@dotmac/testing";
import { CustomerDetailModal } from "../CustomerDetailModal";

// Mock the shared component
const mockSharedModal = jest.fn();
jest.mock("@dotmac/features/customers", () => ({
  CustomerDetailModal: (...args: any[]) => mockSharedModal(...args),
}));

// Mock the hook
const mockGetCustomer = jest.fn();
jest.mock("@/hooks/useCustomers", () => ({
  useCustomer: () => ({
    getCustomer: mockGetCustomer,
  }),
}));

// Mock child components
jest.mock("../CustomerActivities", () => ({
  CustomerActivities: () => <div data-testid="activities">Activities</div>,
}));

jest.mock("../CustomerNotes", () => ({
  CustomerNotes: () => <div data-testid="notes">Notes</div>,
}));

jest.mock("../CustomerSubscriptions", () => ({
  CustomerSubscriptions: () => <div data-testid="subscriptions">Subscriptions</div>,
}));

jest.mock("../CustomerNetwork", () => ({
  CustomerNetwork: () => <div data-testid="network">Network</div>,
}));

jest.mock("../CustomerDevices", () => ({
  CustomerDevices: () => <div data-testid="devices">Devices</div>,
}));

jest.mock("../CustomerTickets", () => ({
  CustomerTickets: () => <div data-testid="tickets">Tickets</div>,
}));

jest.mock("../CustomerBilling", () => ({
  CustomerBilling: () => <div data-testid="billing">Billing</div>,
}));

describe("CustomerDetailModal (App Wrapper)", () => {
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
      ({
        customer,
        onClose,
        onEdit,
        onDelete,
        getCustomer,
        CustomerActivities,
        CustomerNotes,
        CustomerSubscriptions,
        CustomerNetwork,
        CustomerDevices,
        CustomerTickets,
        CustomerBilling,
      }) => (
        <div data-testid="shared-modal">
          <div data-testid="has-customer">{customer ? "yes" : "no"}</div>
          <div data-testid="has-close">{onClose ? "yes" : "no"}</div>
          <div data-testid="has-edit">{onEdit ? "yes" : "no"}</div>
          <div data-testid="has-delete">{onDelete ? "yes" : "no"}</div>
          <div data-testid="has-get-customer">{getCustomer ? "yes" : "no"}</div>
          <div data-testid="has-activities">{CustomerActivities ? "yes" : "no"}</div>
          <div data-testid="has-notes">{CustomerNotes ? "yes" : "no"}</div>
          <div data-testid="has-subscriptions">{CustomerSubscriptions ? "yes" : "no"}</div>
          <div data-testid="has-network">{CustomerNetwork ? "yes" : "no"}</div>
          <div data-testid="has-devices">{CustomerDevices ? "yes" : "no"}</div>
          <div data-testid="has-tickets">{CustomerTickets ? "yes" : "no"}</div>
          <div data-testid="has-billing">{CustomerBilling ? "yes" : "no"}</div>
          <button onClick={onClose}>Close</button>
          <button onClick={() => onEdit?.(customer)}>Edit</button>
          <button onClick={() => onDelete?.(customer)}>Delete</button>
        </div>
      ),
    );
  });

  it("forwards customer prop to shared component", () => {
    renderQuick(
      <CustomerDetailModal
        customer={mockCustomer}
        onClose={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    expect(screen.getByTestId("has-customer")).toHaveTextContent("yes");
  });

  it("forwards onClose prop to shared component", () => {
    const onClose = jest.fn();

    renderQuick(
      <CustomerDetailModal
        customer={mockCustomer}
        onClose={onClose}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    expect(screen.getByTestId("has-close")).toHaveTextContent("yes");

    // Verify it's callable
    screen.getByText("Close").click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("forwards onEdit prop to shared component", () => {
    const onEdit = jest.fn();

    renderQuick(
      <CustomerDetailModal
        customer={mockCustomer}
        onClose={jest.fn()}
        onEdit={onEdit}
        onDelete={jest.fn()}
      />,
    );

    expect(screen.getByTestId("has-edit")).toHaveTextContent("yes");

    // Verify it's callable
    screen.getByText("Edit").click();
    expect(onEdit).toHaveBeenCalledWith(mockCustomer);
  });

  it("forwards onDelete prop to shared component", () => {
    const onDelete = jest.fn();

    renderQuick(
      <CustomerDetailModal
        customer={mockCustomer}
        onClose={jest.fn()}
        onEdit={jest.fn()}
        onDelete={onDelete}
      />,
    );

    expect(screen.getByTestId("has-delete")).toHaveTextContent("yes");

    // Verify it's callable
    screen.getByText("Delete").click();
    expect(onDelete).toHaveBeenCalledWith(mockCustomer);
  });

  it("injects getCustomer hook to shared component", () => {
    renderQuick(
      <CustomerDetailModal
        customer={mockCustomer}
        onClose={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    expect(screen.getByTestId("has-get-customer")).toHaveTextContent("yes");

    // Verify the correct hook is passed
    expect(mockSharedModal).toHaveBeenCalledWith(
      expect.objectContaining({
        getCustomer: mockGetCustomer,
      }),
      expect.anything(),
    );
  });

  it("injects CustomerActivities component", () => {
    renderQuick(
      <CustomerDetailModal
        customer={mockCustomer}
        onClose={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    expect(screen.getByTestId("has-activities")).toHaveTextContent("yes");
  });

  it("injects CustomerNotes component", () => {
    renderQuick(
      <CustomerDetailModal
        customer={mockCustomer}
        onClose={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    expect(screen.getByTestId("has-notes")).toHaveTextContent("yes");
  });

  it("injects CustomerSubscriptions component", () => {
    renderQuick(
      <CustomerDetailModal
        customer={mockCustomer}
        onClose={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    expect(screen.getByTestId("has-subscriptions")).toHaveTextContent("yes");
  });

  it("injects CustomerNetwork component", () => {
    renderQuick(
      <CustomerDetailModal
        customer={mockCustomer}
        onClose={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    expect(screen.getByTestId("has-network")).toHaveTextContent("yes");
  });

  it("injects CustomerDevices component", () => {
    renderQuick(
      <CustomerDetailModal
        customer={mockCustomer}
        onClose={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    expect(screen.getByTestId("has-devices")).toHaveTextContent("yes");
  });

  it("injects CustomerTickets component", () => {
    renderQuick(
      <CustomerDetailModal
        customer={mockCustomer}
        onClose={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    expect(screen.getByTestId("has-tickets")).toHaveTextContent("yes");
  });

  it("injects CustomerBilling component", () => {
    renderQuick(
      <CustomerDetailModal
        customer={mockCustomer}
        onClose={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    expect(screen.getByTestId("has-billing")).toHaveTextContent("yes");
  });

  it("passes all props and injections to shared component correctly", () => {
    const onClose = jest.fn();
    const onEdit = jest.fn();
    const onDelete = jest.fn();

    renderQuick(
      <CustomerDetailModal
        customer={mockCustomer}
        onClose={onClose}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    );

    expect(mockSharedModal).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: mockCustomer,
        onClose,
        onEdit,
        onDelete,
        getCustomer: mockGetCustomer,
      }),
      expect.anything(),
    );

    // Verify all child components are injected
    const call = mockSharedModal.mock.calls[0][0];
    expect(call.CustomerActivities).toBeDefined();
    expect(call.CustomerNotes).toBeDefined();
    expect(call.CustomerSubscriptions).toBeDefined();
    expect(call.CustomerNetwork).toBeDefined();
    expect(call.CustomerDevices).toBeDefined();
    expect(call.CustomerTickets).toBeDefined();
    expect(call.CustomerBilling).toBeDefined();
  });
});
