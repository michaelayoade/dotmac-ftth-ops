import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import UsageBillingPage from "@/app/dashboard/billing-revenue/usage/page";

// Mock auth guard to always render children
jest.mock("@/components/auth/PermissionGuard", () => ({
  RouteGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

var mockListUsageRecords: jest.Mock;
var mockGetUsageStatistics: jest.Mock;
var mockCreateUsageRecord: jest.Mock;

jest.mock("@/lib/services/usage-billing-service", () => {
  mockListUsageRecords = jest.fn();
  mockGetUsageStatistics = jest.fn();
  mockCreateUsageRecord = jest.fn();

  const Service = jest.fn().mockImplementation(() => ({
    listUsageRecords: mockListUsageRecords,
    getUsageStatistics: mockGetUsageStatistics,
    createUsageRecord: mockCreateUsageRecord,
    formatCurrency: (amount: number, currency: string = "USD") =>
      new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount / 100),
    calculateTotalAmount: (qty: number, unitPrice: number) => Math.round(qty * unitPrice),
  }));

  return {
    __esModule: true,
    default: Service,
  };
});

const mockRecord = {
  id: "usage-1",
  tenant_id: "tenant-1",
  subscription_id: "sub-123",
  customer_id: "cust-1",
  usage_type: "data_transfer",
  quantity: 120,
  unit: "GB",
  unit_price: 150,
  total_amount: 18000,
  currency: "USD",
  period_start: new Date().toISOString(),
  period_end: new Date().toISOString(),
  billed_status: "pending",
  source_system: "ops-portal",
};

describe("UsageBillingPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListUsageRecords.mockResolvedValue([mockRecord]);
    mockGetUsageStatistics.mockResolvedValue({
      total_records: 1,
      total_amount: 18000,
      pending_amount: 18000,
    });
    mockCreateUsageRecord.mockResolvedValue({ id: "new-usage" });
  });

  it("renders stats and recent usage records", async () => {
    render(<UsageBillingPage />);

    await waitFor(() => expect(mockListUsageRecords).toHaveBeenCalled());
    const amounts = await screen.findAllByText("$180.00");
    expect(amounts.length).toBeGreaterThan(0);
    expect(screen.getByText("Pending Billing")).toBeInTheDocument();
    expect(screen.getAllByText("Data Transfer").length).toBeGreaterThan(0);
    expect(screen.getByText(/120 GB/)).toBeInTheDocument();
  });

  it("submits a usage record with computed totals", async () => {
    render(<UsageBillingPage />);
    await waitFor(() => expect(mockListUsageRecords).toHaveBeenCalled());

    const numberInputs = screen.getAllByRole("spinbutton");
    fireEvent.change(numberInputs[0], { target: { value: "5" } }); // Quantity
    fireEvent.change(numberInputs[1], { target: { value: "2.5" } }); // Unit price (major)
    const textInputs = screen.getAllByRole("textbox");
    fireEvent.change(textInputs[1], { target: { value: "sub-999" } }); // Subscription ID
    fireEvent.change(textInputs[2], { target: { value: "cust-999" } }); // Customer ID

    fireEvent.click(screen.getByText("Record Usage"));

    await waitFor(() => expect(mockCreateUsageRecord).toHaveBeenCalled());
    const payload = mockCreateUsageRecord.mock.calls[0][0];
    expect(payload.subscription_id).toBe("sub-999");
    expect(payload.quantity).toBe(5);
    expect(payload.unit_price).toBe(250); // cents
    expect(payload.total_amount).toBe(5 * 250);
  });
});
