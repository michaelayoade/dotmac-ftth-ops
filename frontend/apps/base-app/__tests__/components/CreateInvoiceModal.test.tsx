/**
 * @jest-environment jsdom
 */

import userEvent from "@testing-library/user-event";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { CreateInvoiceModal } from "@/components/billing/CreateInvoiceModal";

jest.mock("@/hooks/useCustomersGraphQL", () => ({
  useCustomerListGraphQL: jest.fn(),
  useCustomerMetricsGraphQL: jest.fn().mockReturnValue({
    metrics: null,
    isLoading: false,
    error: undefined,
    refetch: jest.fn(),
  }),
}));

jest.mock("@/lib/api/client", () => ({
  apiClient: {
    post: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

const mockedUseCustomerListGraphQL = jest.requireMock("@/hooks/useCustomersGraphQL")
  .useCustomerListGraphQL as jest.Mock;

const mockedApiClient = jest.requireMock("@/lib/api/client").apiClient as {
  post: jest.Mock;
  delete: jest.Mock;
};

beforeAll(() => {
  Object.defineProperty(window.HTMLElement.prototype, "hasPointerCapture", {
    configurable: true,
    value: () => false,
  });
  Object.defineProperty(window.HTMLElement.prototype, "setPointerCapture", {
    configurable: true,
    value: () => {},
  });
  Object.defineProperty(window.HTMLElement.prototype, "releasePointerCapture", {
    configurable: true,
    value: () => {},
  });
  Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: () => {},
  });
});

const sampleCustomers = [
  {
    id: "cust-001",
    customerNumber: "SUB-001",
    firstName: "Jane",
    lastName: "Doe",
    middleName: null,
    displayName: "Jane Doe",
    companyName: "Acme Fiber",
    status: "ACTIVE",
    customerType: "BUSINESS",
    tier: "STANDARD",
    email: "jane.doe@example.com",
    phone: "+15551234567",
    mobile: "+15557654321",
    website: "https://example.com",
    addressLine1: "100 Main Street",
    addressLine2: "Suite 200",
    city: "Metropolis",
    stateProvince: "CA",
    postalCode: "94016",
    country: "USA",
    taxId: "TAX-123",
    lifetimeValue: 1200,
    totalPurchases: 12,
    averageOrderValue: 100,
    lastPurchaseDate: "2024-12-01T00:00:00.000Z",
    firstPurchaseDate: "2022-06-15T00:00:00.000Z",
    lastContactDate: "2024-12-10T00:00:00.000Z",
    createdAt: "2022-06-01T00:00:00.000Z",
    updatedAt: "2024-12-10T00:00:00.000Z",
    activities: [],
    notes: [],
  },
];

describe("CreateInvoiceModal", () => {
  beforeEach(() => {
    mockedUseCustomerListGraphQL.mockReturnValue({
      customers: sampleCustomers,
      total: sampleCustomers.length,
      hasNextPage: false,
      limit: 100,
      offset: 0,
      isLoading: false,
      error: undefined,
      refetch: jest.fn(),
    });
    mockedApiClient.post.mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("pre-fills billing details when selecting a customer", async () => {
    render(
      <CreateInvoiceModal
        isOpen
        onClose={() => {}}
        tenantId="tenant-123"
        onSuccess={() => {}}
      />,
    );

    const trigger = screen.getByRole("combobox", { name: /Customer \*/i });
    const nativeSelect = trigger.parentElement?.querySelector("select");
    if (!nativeSelect) {
      throw new Error("Native select element not found");
    }
    fireEvent.change(nativeSelect, { target: { value: "cust-001" } });
    fireEvent.blur(nativeSelect);

    expect(screen.getByLabelText(/Billing Email/i)).toHaveValue("jane.doe@example.com");
    expect(screen.getByPlaceholderText("Address line 1")).toHaveValue("100 Main Street");
    expect(screen.getByPlaceholderText("City")).toHaveValue("Metropolis");
  });

  it("submits payload to create invoice and triggers refresh", async () => {
    const handleClose = jest.fn();
    const handleSuccess = jest.fn();

    render(
      <CreateInvoiceModal
        isOpen
        onClose={handleClose}
        tenantId="tenant-123"
        onSuccess={handleSuccess}
      />,
    );

    const trigger = screen.getByRole("combobox", { name: /Customer \*/i });
    const nativeSelect = trigger.parentElement?.querySelector("select");
    if (!nativeSelect) {
      throw new Error("Native select element not found");
    }
    fireEvent.change(nativeSelect, { target: { value: "cust-001" } });
    fireEvent.blur(nativeSelect);

    const user = userEvent.setup();

    await user.clear(screen.getByLabelText("Description"));
    await user.type(screen.getByLabelText("Description"), "Fiber Internet Service");
    await user.clear(screen.getByLabelText("Quantity"));
    await user.type(screen.getByLabelText("Quantity"), "2");
    await user.clear(screen.getByLabelText("Unit Price"));
    await user.type(screen.getByLabelText("Unit Price"), "150");

    await user.clear(screen.getByLabelText(/Due Date/i));
    await user.type(screen.getByLabelText(/Due Date/i), "2025-01-15");

    await user.type(screen.getByLabelText(/Notes/i), "Install at enterprise site.");

    await user.click(screen.getByRole("button", { name: /Create Invoice/i }));

    await waitFor(() => {
      expect(mockedApiClient.post).toHaveBeenCalled();
    });

    const [url, payload, config] = mockedApiClient.post.mock.calls[0];

    expect(url).toBe("/billing/invoices");
    expect(config).toEqual({ headers: { "X-Tenant-ID": "tenant-123" } });
    expect(payload).toMatchObject({
      customer_id: "cust-001",
      billing_email: "jane.doe@example.com",
      currency: "USD",
      notes: "Install at enterprise site.",
    });
    expect(payload.line_items).toEqual([
      {
        description: "Fiber Internet Service",
        quantity: 2,
        unit_price: 150,
      },
    ]);

    expect(handleSuccess).toHaveBeenCalled();
    expect(handleClose).toHaveBeenCalled();
  });
});
