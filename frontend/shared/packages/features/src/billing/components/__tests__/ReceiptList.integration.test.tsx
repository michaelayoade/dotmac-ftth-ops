/**
 * Integration tests for ReceiptList component
 * Tests receipt list display and interactions
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { createMockReceipt } from "../../../test/factories/billing";
import { createBillingDependencies } from "../../../test/mocks/dependencies";
import ReceiptList from "../ReceiptList";

// Mock UI components
vi.mock("@dotmac/ui", async () => {
  const actual = await vi.importActual("@dotmac/ui");
  const { simpleSelectMocks } = await import("@dotmac/testing-utils/react/simpleSelectMocks");
  return {
    ...actual,
    ...simpleSelectMocks,
    EnhancedDataTable: ({
      data,
      columns,
      loading,
      isLoading,
      error,
      errorMessage,
      onRowClick,
    }: any) => {
      if (loading || isLoading) return <div>Loading...</div>;
      if (error) return <div role="alert">Error: {errorMessage || error}</div>;
      if (!data || data.length === 0) return <div>No receipts found</div>;

      return (
        <table>
          <thead>
            <tr>
              {columns.map((col: any) => (
                <th key={col.id || col.accessorKey}>{col.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((receipt: any, idx: number) => (
              <tr
                key={receipt.receipt_id}
                onClick={() => onRowClick?.(receipt)}
                data-testid={`receipt-row-${idx}`}
              >
                <td>{receipt.receipt_number}</td>
                <td>{receipt.customer_email}</td>
                <td>${receipt.total_amount}</td>
                <td>{receipt.payment_method}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    },
  };
});

vi.mock("../PaymentStatusBadge", () => ({
  PaymentStatusBadge: ({ status }: any) => <span>{status}</span>,
}));

vi.mock("../../utils", () => ({
  formatCurrency: (amount: number) => `$${amount.toFixed(2)}`,
}));

describe("ReceiptList Integration Tests", () => {
  let deps: ReturnType<typeof createBillingDependencies>;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    deps = createBillingDependencies();
    user = userEvent.setup();
  });

  describe("Data Fetching", () => {
    it("should fetch and display receipts on mount", async () => {
      // Arrange
      const receipts = [
        createMockReceipt({ receipt_number: "RCPT-00001" }),
        createMockReceipt({ receipt_number: "RCPT-00002" }),
        createMockReceipt({ receipt_number: "RCPT-00003" }),
      ];
      deps.apiClient.get.mockResolvedValue({ data: { receipts } });

      // Act
      render(
        <ReceiptList
          tenantId="tenant_123"
          customerId={undefined}
          onReceiptSelect={undefined}
          apiClient={deps.apiClient}
          logger={deps.logger}
        />,
      );

      // Wait for data to load
      await waitFor(() => {
        expect(deps.apiClient.get).toHaveBeenCalled();
      });

      // Verify API was called
      expect(deps.apiClient.get).toHaveBeenCalled();

      // Verify receipts are displayed
      receipts.forEach((receipt) => {
        expect(screen.getByText(receipt.receipt_number)).toBeInTheDocument();
      });
    });

    it("should filter receipts by customer ID when provided", async () => {
      // Arrange
      const customerId = "cust_456";
      const receipts = [createMockReceipt({ customer_id: customerId })];
      deps.apiClient.get.mockResolvedValue({ data: { receipts } });

      // Act
      render(
        <ReceiptList
          tenantId="tenant_123"
          customerId={customerId}
          onReceiptSelect={undefined}
          apiClient={deps.apiClient}
          logger={deps.logger}
        />,
      );

      // Assert
      await waitFor(() => {
        expect(deps.apiClient.get).toHaveBeenCalledWith(expect.stringContaining(customerId));
      });
    });

    it("should handle API errors gracefully", async () => {
      // Arrange
      const errorMessage = "Failed to load receipts";
      deps.apiClient.get.mockRejectedValue(new Error(errorMessage));

      // Act
      render(
        <ReceiptList
          tenantId="tenant_123"
          customerId={undefined}
          onReceiptSelect={undefined}
          apiClient={deps.apiClient}
          logger={deps.logger}
        />,
      );

      // Assert - should log error (error UI not implemented yet)
      await waitFor(() => {
        expect(deps.logger.error).toHaveBeenCalled();
      });

      expect(deps.logger.error).toHaveBeenCalledWith(
        expect.stringContaining("receipts"),
        expect.any(Error),
        expect.any(Object),
      );
    });

    it("should display empty state when no receipts exist", async () => {
      // Arrange
      deps.apiClient.get.mockResolvedValue({ data: { receipts: [] } });

      // Act
      render(
        <ReceiptList
          tenantId="tenant_123"
          customerId={undefined}
          onReceiptSelect={undefined}
          apiClient={deps.apiClient}
          logger={deps.logger}
        />,
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText("No receipts found")).toBeInTheDocument();
      });
    });
  });

  describe("Receipt Selection", () => {
    it("should call onReceiptSelect when clicking a receipt row", async () => {
      // Arrange
      const receipt = createMockReceipt();
      deps.apiClient.get.mockResolvedValue({ data: { receipts: [receipt] } });
      const onReceiptSelect = vi.fn();

      // Act
      render(
        <ReceiptList
          tenantId="tenant_123"
          customerId={undefined}
          onReceiptSelect={onReceiptSelect}
          apiClient={deps.apiClient}
          logger={deps.logger}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText(receipt.receipt_number)).toBeInTheDocument();
      });

      const row = screen.getByTestId("receipt-row-0");
      await user.click(row);

      // Assert
      expect(onReceiptSelect).toHaveBeenCalledWith(receipt);
    });
  });

  describe("Payment Methods", () => {
    it("should display different payment methods correctly", async () => {
      // Arrange
      const receipts = [
        createMockReceipt({ payment_method: "card" }),
        createMockReceipt({ payment_method: "bank_transfer" }),
        createMockReceipt({ payment_method: "cash" }),
      ];
      deps.apiClient.get.mockResolvedValue({ data: { receipts } });

      // Act
      render(
        <ReceiptList
          tenantId="tenant_123"
          customerId={undefined}
          onReceiptSelect={undefined}
          apiClient={deps.apiClient}
          logger={deps.logger}
        />,
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText("card")).toBeInTheDocument();
        expect(screen.getByText("bank_transfer")).toBeInTheDocument();
        expect(screen.getByText("cash")).toBeInTheDocument();
      });
    });
  });

  describe("Receipt Amounts", () => {
    it("should display receipt amounts correctly", async () => {
      // Arrange
      const receipt = createMockReceipt({
        total_amount: 250.75,
      });
      deps.apiClient.get.mockResolvedValue({ data: { receipts: [receipt] } });

      // Act
      render(
        <ReceiptList
          tenantId="tenant_123"
          customerId={undefined}
          onReceiptSelect={undefined}
          apiClient={deps.apiClient}
          logger={deps.logger}
        />,
      );

      // Assert
      await waitFor(() => {
        expect(screen.getAllByText("$250.75")[0]).toBeInTheDocument();
      });
    });
  });

  describe("Loading States", () => {
    it("should show loading state while fetching data", async () => {
      // Arrange
      let resolvePromise: any;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      deps.apiClient.get.mockReturnValue(promise as any);

      // Act
      render(
        <ReceiptList
          tenantId="tenant_123"
          customerId={undefined}
          onReceiptSelect={undefined}
          apiClient={deps.apiClient}
          logger={deps.logger}
        />,
      );

      // Assert
      expect(screen.getByText("Loading receipts...")).toBeInTheDocument();

      // Cleanup
      resolvePromise({ data: { receipts: [] } });
      await waitFor(() => {
        expect(screen.queryByText("Loading receipts...")).not.toBeInTheDocument();
      });
    });
  });

  describe("Error Recovery", () => {
    it("should allow retry after error", async () => {
      // Arrange
      deps.apiClient.get
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({ data: { receipts: [createMockReceipt()] } });

      // Act
      const { rerender } = render(
        <ReceiptList
          tenantId="tenant_123"
          customerId={undefined}
          onReceiptSelect={undefined}
          apiClient={deps.apiClient}
          logger={deps.logger}
        />,
      );

      // Wait for error
      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });

      // Trigger refetch by changing props
      rerender(
        <ReceiptList
          tenantId="tenant_456"
          customerId={undefined}
          onReceiptSelect={undefined}
          apiClient={deps.apiClient}
          logger={deps.logger}
        />,
      );

      // Assert - should eventually show data
      await waitFor(() => {
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      });
    });
  });
});
