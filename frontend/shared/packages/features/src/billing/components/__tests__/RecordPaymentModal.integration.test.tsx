/**
 * Integration tests for RecordPaymentModal component
 * Tests payment recording workflow with form validation
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { createMockInvoice } from "../../../test/factories/billing";
import { createBillingDependencies } from "../../../test/mocks/dependencies";
import { RecordPaymentModal } from "../RecordPaymentModal";

// Mock UI components
vi.mock("@dotmac/ui", async () => {
  const actual = await vi.importActual("@dotmac/ui");
  const { simpleSelectMocks } = await import("@dotmac/testing-utils/react/simpleSelectMocks");
  return {
    ...actual,
    ...simpleSelectMocks,
    Dialog: ({ children, open }: any) => (open ? <div>{children}</div> : null),
    DialogContent: ({ children }: any) => <div>{children}</div>,
    DialogHeader: ({ children }: any) => <div>{children}</div>,
    DialogTitle: ({ children }: any) => <h2>{children}</h2>,
    DialogDescription: ({ children }: any) => <p>{children}</p>,
    Button: ({ children, onClick, disabled, type }: any) => (
      <button onClick={onClick} disabled={disabled} type={type}>
        {children}
      </button>
    ),
    Input: ({ value, onChange, placeholder, type, ...props }: any) => (
      <input value={value} onChange={onChange} placeholder={placeholder} type={type} {...props} />
    ),
    Label: ({ children, htmlFor }: any) => <label htmlFor={htmlFor}>{children}</label>,
    Textarea: ({ value, onChange, placeholder }: any) => (
      <textarea value={value} onChange={onChange} placeholder={placeholder} />
    ),
    Badge: ({ children }: any) => <span>{children}</span>,
  };
});

describe("RecordPaymentModal Integration Tests", () => {
  let deps: ReturnType<typeof createBillingDependencies>;
  let user: ReturnType<typeof userEvent.setup>;
  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;

  beforeEach(() => {
    deps = createBillingDependencies();
    user = userEvent.setup();
  });

  describe("Modal Display", () => {
    it("should render when open", () => {
      // Arrange
      const invoice = createMockInvoice();

      // Act
      render(
        <RecordPaymentModal
          isOpen={true}
          onClose={vi.fn()}
          invoices={[invoice]}
          apiClient={deps.apiClient}
          useToast={deps.useToast}
          logger={deps.logger}
          useConfirmDialog={deps.useConfirmDialog}
          formatCurrency={formatCurrency}
        />,
      );

      // Assert
      expect(screen.getByRole("heading", { name: /record payment/i })).toBeInTheDocument();
    });

    it("should not render when closed", () => {
      // Arrange
      const invoice = createMockInvoice();

      // Act
      render(
        <RecordPaymentModal
          isOpen={false}
          onClose={vi.fn()}
          invoices={[invoice]}
          apiClient={deps.apiClient}
          useToast={deps.useToast}
          logger={deps.logger}
          useConfirmDialog={deps.useConfirmDialog}
          formatCurrency={formatCurrency}
        />,
      );

      // Assert
      expect(screen.queryByRole("heading", { name: /record payment/i })).not.toBeInTheDocument();
    });

    it("should display invoice information", () => {
      // Arrange
      const invoice = createMockInvoice({
        invoice_number: "INV-12345",
        amount_due: 150.0,
      });

      // Act
      render(
        <RecordPaymentModal
          isOpen={true}
          onClose={vi.fn()}
          invoices={[invoice]}
          apiClient={deps.apiClient}
          useToast={deps.useToast}
          logger={deps.logger}
          useConfirmDialog={deps.useConfirmDialog}
          formatCurrency={formatCurrency}
        />,
      );

      // Assert (multiple elements may have invoice number, just check at least one exists)
      expect(screen.getAllByText(/INV-12345/)[0]).toBeInTheDocument();
    });
  });

  describe("Form Validation", () => {
    it("should require payment amount", async () => {
      // Arrange
      const invoice = createMockInvoice();
      const onClose = vi.fn();

      render(
        <RecordPaymentModal
          isOpen={true}
          onClose={onClose}
          invoices={[invoice]}
          apiClient={deps.apiClient}
          useToast={deps.useToast}
          logger={deps.logger}
          useConfirmDialog={deps.useConfirmDialog}
          formatCurrency={formatCurrency}
        />,
      );

      // Act - clear the pre-filled amount and try to submit
      const amountInput = screen.getByLabelText(/payment amount/i);
      await user.clear(amountInput);

      const submitButton = screen.getByRole("button", { name: /record payment/i });
      await user.click(submitButton);

      // Assert - modal should not close (validation failed)
      expect(onClose).not.toHaveBeenCalled();
    });

    it("should accept valid payment amount", async () => {
      // Arrange
      const invoice = createMockInvoice({ amount_due: 150.0 });
      deps.apiClient.post.mockResolvedValue({ data: { success: true } });
      const onSuccess = vi.fn();

      render(
        <RecordPaymentModal
          isOpen={true}
          onClose={vi.fn()}
          invoices={[invoice]}
          onSuccess={onSuccess}
          apiClient={deps.apiClient}
          useToast={deps.useToast}
          logger={deps.logger}
          useConfirmDialog={deps.useConfirmDialog}
          formatCurrency={formatCurrency}
        />,
      );

      // Act - clear pre-filled amount and enter valid amount
      const amountInput = screen.getByLabelText(/payment amount/i);
      await user.clear(amountInput);
      await user.type(amountInput, "150.00");

      // Select payment method (simplified - actual component might have dropdown)
      const methodSelect = screen.getByRole("combobox");
      if (methodSelect) {
        await user.selectOptions(methodSelect, "card");
      }

      // Submit form
      const submitButton = screen.getByRole("button", { name: /record payment/i });
      await user.click(submitButton);

      // Assert - API should be called
      await waitFor(() => {
        expect(deps.apiClient.post).toHaveBeenCalled();
      });
    });
  });

  describe("Payment Methods", () => {
    it("should allow selecting different payment methods", async () => {
      // Arrange
      const invoice = createMockInvoice();

      render(
        <RecordPaymentModal
          isOpen={true}
          onClose={vi.fn()}
          invoices={[invoice]}
          apiClient={deps.apiClient}
          useToast={deps.useToast}
          logger={deps.logger}
          useConfirmDialog={deps.useConfirmDialog}
          formatCurrency={formatCurrency}
        />,
      );

      // Act - select payment method
      const methodSelect = screen.getByRole("combobox");
      if (methodSelect) {
        await user.selectOptions(methodSelect, "bank_transfer");

        // Assert
        expect(methodSelect).toHaveValue("bank_transfer");
      }
    });
  });

  describe("Payment Submission", () => {
    it("should submit payment successfully", async () => {
      // Arrange
      const invoice = createMockInvoice({ amount_due: 150.0 });
      deps.apiClient.post.mockResolvedValue({ data: { success: true } });
      const onSuccess = vi.fn();
      const onClose = vi.fn();

      render(
        <RecordPaymentModal
          isOpen={true}
          onClose={onClose}
          invoices={[invoice]}
          onSuccess={onSuccess}
          apiClient={deps.apiClient}
          useToast={deps.useToast}
          logger={deps.logger}
          useConfirmDialog={deps.useConfirmDialog}
          formatCurrency={formatCurrency}
        />,
      );

      // Act - clear pre-filled amount and fill form
      const amountInput = screen.getByLabelText(/payment amount/i);
      await user.clear(amountInput);
      await user.type(amountInput, "150.00");

      const submitButton = screen.getByRole("button", { name: /record payment/i });
      await user.click(submitButton);

      // Assert - verify API call
      await waitFor(() => {
        expect(deps.apiClient.post).toHaveBeenCalledWith(
          "/billing/payments",
          expect.objectContaining({
            amount: expect.any(Number),
          }),
        );
      });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
      });
    });

    it("should handle payment submission errors", async () => {
      // Arrange
      const invoice = createMockInvoice({ amount_due: 150.0 });
      const error = new Error("Payment failed");
      deps.apiClient.post.mockRejectedValue(error);
      const onSuccess = vi.fn();
      const onClose = vi.fn();

      render(
        <RecordPaymentModal
          isOpen={true}
          onClose={onClose}
          invoices={[invoice]}
          onSuccess={onSuccess}
          apiClient={deps.apiClient}
          useToast={deps.useToast}
          logger={deps.logger}
          useConfirmDialog={deps.useConfirmDialog}
          formatCurrency={formatCurrency}
        />,
      );

      // Act - clear pre-filled amount and fill form
      const amountInput = screen.getByLabelText(/payment amount/i);
      await user.clear(amountInput);
      await user.type(amountInput, "150.00");

      const submitButton = screen.getByRole("button", { name: /record payment/i });
      await user.click(submitButton);

      // Assert - error should be logged
      await waitFor(() => {
        expect(deps.logger.error).toHaveBeenCalledWith(
          expect.stringContaining("payment"),
          error,
          expect.any(Object),
        );
        expect(onSuccess).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();
      });
    });
  });

  describe("Multiple Invoices", () => {
    it("should handle payment allocation across multiple invoices", () => {
      // Arrange
      const invoices = [
        createMockInvoice({ invoice_id: "inv_1", invoice_number: "INV-TEST1", amount_due: 100 }),
        createMockInvoice({ invoice_id: "inv_2", invoice_number: "INV-TEST2", amount_due: 50 }),
      ];

      // Act
      render(
        <RecordPaymentModal
          isOpen={true}
          onClose={vi.fn()}
          invoices={invoices}
          apiClient={deps.apiClient}
          useToast={deps.useToast}
          logger={deps.logger}
          useConfirmDialog={deps.useConfirmDialog}
          formatCurrency={formatCurrency}
        />,
      );

      // Assert - should show both invoices (multiple elements may match, get first)
      expect(screen.getAllByText(/INV-TEST1/)[0]).toBeInTheDocument();
      expect(screen.getAllByText(/INV-TEST2/)[0]).toBeInTheDocument();
    });
  });

  describe("Form Reset", () => {
    it("should reset form when closed", async () => {
      // Arrange
      const invoice = createMockInvoice();
      const onClose = vi.fn();
      const { rerender } = render(
        <RecordPaymentModal
          isOpen={true}
          onClose={onClose}
          invoices={[invoice]}
          apiClient={deps.apiClient}
          useToast={deps.useToast}
          logger={deps.logger}
          useConfirmDialog={deps.useConfirmDialog}
          formatCurrency={formatCurrency}
        />,
      );

      // Act - enter some data
      const amountInput = screen.getByLabelText(/payment amount/i);
      await user.type(amountInput, "100.00");

      // Close and reopen
      rerender(
        <RecordPaymentModal
          isOpen={false}
          onClose={onClose}
          invoices={[invoice]}
          apiClient={deps.apiClient}
          useToast={deps.useToast}
          logger={deps.logger}
          useConfirmDialog={deps.useConfirmDialog}
          formatCurrency={formatCurrency}
        />,
      );

      rerender(
        <RecordPaymentModal
          isOpen={true}
          onClose={onClose}
          invoices={[invoice]}
          apiClient={deps.apiClient}
          useToast={deps.useToast}
          logger={deps.logger}
          useConfirmDialog={deps.useConfirmDialog}
          formatCurrency={formatCurrency}
        />,
      );

      // Assert - amount field should reset to default invoice total
      await waitFor(() => {
        const amountAfterReset = screen.getByLabelText(/payment amount/i) as HTMLInputElement;
        expect(parseFloat(amountAfterReset.value)).toBeCloseTo(invoice.amount_due, 2);
      });
    });
  });
});
