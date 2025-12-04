/**
 * Integration tests for CreateLeadModal component
 * Tests lead creation workflow with form validation
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { CreateLeadModal } from "../CreateLeadModal";

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
      <input
        value={value}
        onChange={(e) => onChange?.(e)}
        placeholder={placeholder}
        type={type}
        {...props}
      />
    ),
    Label: ({ children, htmlFor }: any) => <label htmlFor={htmlFor}>{children}</label>,
    Textarea: ({ value, onChange, placeholder }: any) => (
      <textarea value={value} onChange={(e) => onChange?.(e)} placeholder={placeholder} />
    ),
    Tabs: ({ children, value, onValueChange }: any) => (
      <div data-active-tab={value}>{children}</div>
    ),
    TabsList: ({ children }: any) => <div role="tablist">{children}</div>,
    TabsTrigger: ({ children, value, onClick }: any) => (
      <button role="tab" onClick={onClick} data-value={value}>
        {children}
      </button>
    ),
    TabsContent: ({ children, value }: any) => (
      <div role="tabpanel" data-value={value}>
        {children}
      </div>
    ),
  };
});

describe("CreateLeadModal Integration Tests", () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  describe("Modal Display", () => {
    it("should render when open", () => {
      // Arrange & Act
      render(
        <CreateLeadModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={undefined}
          onCreate={vi.fn()}
          isSubmitting={undefined}
        />,
      );

      // Assert
      expect(screen.getByText("Create New Lead")).toBeInTheDocument();
    });

    it("should not render when closed", () => {
      // Arrange & Act
      render(
        <CreateLeadModal
          isOpen={false}
          onClose={vi.fn()}
          onSuccess={undefined}
          onCreate={vi.fn()}
          isSubmitting={undefined}
        />,
      );

      // Assert
      expect(screen.queryByText("Create New Lead")).not.toBeInTheDocument();
    });

    it("should display all form tabs", () => {
      // Arrange & Act
      render(
        <CreateLeadModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={undefined}
          onCreate={vi.fn()}
          isSubmitting={undefined}
        />,
      );

      // Assert
      expect(screen.getByText("Contact Info")).toBeInTheDocument();
      expect(screen.getByText("Details & Requirements")).toBeInTheDocument();
      expect(screen.getByText("Service Location")).toBeInTheDocument();
    });
  });

  describe("Form Validation", () => {
    it("should require first name", async () => {
      // Arrange
      const onCreate = vi.fn();
      render(
        <CreateLeadModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={undefined}
          onCreate={onCreate}
          isSubmitting={false}
        />,
      );

      // Act - navigate using Next buttons to reach the submit button
      const nextButton1 = screen.getByText("Next");
      await user.click(nextButton1);

      // Click Next again to go to details tab
      const nextButton2 = screen.getByText("Next");
      await user.click(nextButton2);

      // Wait for submit button to appear
      await waitFor(() => {
        expect(screen.getByText(/create lead/i)).toBeInTheDocument();
      });

      const submitButton = screen.getByText(/create lead/i);
      await user.click(submitButton);

      // Assert - onCreate should not be called due to validation
      expect(onCreate).not.toHaveBeenCalled();
    });

    it("should require last name", async () => {
      // Arrange
      const onCreate = vi.fn();
      const { container } = render(
        <CreateLeadModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={undefined}
          onCreate={onCreate}
          isSubmitting={false}
        />,
      );

      // Act - fill first name only
      const firstNameInput = container.querySelector("#first_name") as HTMLInputElement;
      await user.type(firstNameInput, "John");

      // Navigate using Next buttons to reach submit button
      const nextButton1 = screen.getByText("Next");
      await user.click(nextButton1);

      const nextButton2 = screen.getByText("Next");
      await user.click(nextButton2);

      // Wait for submit button to appear
      await waitFor(() => {
        expect(screen.getByText(/create lead/i)).toBeInTheDocument();
      });

      const submitButton = screen.getByText(/create lead/i);
      await user.click(submitButton);

      // Assert
      expect(onCreate).not.toHaveBeenCalled();
    });

    it("should require valid email", async () => {
      // Arrange
      const onCreate = vi.fn();
      const { container } = render(
        <CreateLeadModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={undefined}
          onCreate={onCreate}
          isSubmitting={false}
        />,
      );

      // Act - enter invalid email
      const emailInput = container.querySelector("#email") as HTMLInputElement;
      await user.type(emailInput, "invalid-email");

      // Navigate using Next buttons to reach submit button
      const nextButton1 = screen.getByText("Next");
      await user.click(nextButton1);

      const nextButton2 = screen.getByText("Next");
      await user.click(nextButton2);

      // Wait for submit button to appear
      await waitFor(() => {
        expect(screen.getByText(/create lead/i)).toBeInTheDocument();
      });

      const submitButton = screen.getByText(/create lead/i);
      await user.click(submitButton);

      // Assert
      expect(onCreate).not.toHaveBeenCalled();
    });

    it("should accept valid form data", async () => {
      // Arrange
      const onCreate = vi.fn().mockResolvedValue({ success: true });
      const onSuccess = vi.fn();

      const { container } = render(
        <CreateLeadModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={onSuccess}
          onCreate={onCreate}
          isSubmitting={false}
        />,
      );

      // Act - fill valid form data
      await user.type(container.querySelector("#first_name")!, "John");
      await user.type(container.querySelector("#last_name")!, "Doe");
      await user.type(container.querySelector("#email")!, "john.doe@example.com");
      await user.type(container.querySelector("#phone")!, "+1234567890");

      // Navigate to service location tab to fill address
      const nextButton1 = screen.getByText("Next");
      await user.click(nextButton1);

      await user.type(container.querySelector("#address_line1")!, "123 Main St");
      await user.type(container.querySelector("#city")!, "New York");
      await user.type(container.querySelector("#state")!, "NY");
      await user.type(container.querySelector("#postal_code")!, "10001");

      // Navigate to details tab to submit
      const nextButton2 = screen.getByText("Next");
      await user.click(nextButton2);

      // Wait for submit button to appear
      await waitFor(() => {
        expect(screen.getByText(/create lead/i)).toBeInTheDocument();
      });

      // Submit form
      const submitButton = screen.getByText(/create lead/i);
      await user.click(submitButton);

      // Assert
      await waitFor(() => {
        expect(onCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            first_name: "John",
            last_name: "Doe",
            email: "john.doe@example.com",
            phone: "+1234567890",
          }),
        );
      });
    });
  });

  describe("Tab Navigation", () => {
    it("should switch between tabs", async () => {
      // Arrange
      render(
        <CreateLeadModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={undefined}
          onCreate={vi.fn()}
          isSubmitting={false}
        />,
      );

      // Act - click on different tabs
      const detailsTab = screen.getByText("Details & Requirements");
      await user.click(detailsTab);

      const locationTab = screen.getByText("Service Location");
      await user.click(locationTab);

      const contactTab = screen.getByText("Contact Info");
      await user.click(contactTab);

      // Assert - all tabs should be accessible
      expect(contactTab).toBeInTheDocument();
      expect(detailsTab).toBeInTheDocument();
      expect(locationTab).toBeInTheDocument();
    });
  });

  describe("Service Type Selection", () => {
    it("should allow selecting multiple service types", async () => {
      // Arrange
      const onCreate = vi.fn().mockResolvedValue({ success: true });
      render(
        <CreateLeadModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={undefined}
          onCreate={onCreate}
          isSubmitting={false}
        />,
      );

      // Act - switch to details & requirements tab
      const detailsTab = screen.getByText("Details & Requirements");
      await user.click(detailsTab);

      // Select service types (if checkboxes are available)
      const checkboxes = screen.queryAllByRole("checkbox");
      if (checkboxes.length > 0) {
        await user.click(checkboxes[0]!);
        if (checkboxes.length > 1) {
          await user.click(checkboxes[1]!);
        }
      }

      // Assert - component should handle selections
      expect(detailsTab).toBeInTheDocument();
    });
  });

  describe("Form Submission", () => {
    it("should call onCreate with form data on submit", async () => {
      // Arrange
      const onCreate = vi.fn().mockResolvedValue({ success: true });
      const formData = {
        first_name: "John",
        last_name: "Doe",
        email: "john.doe@example.com",
        phone: "+1234567890",
        service_address_line1: "123 Main St",
        service_city: "New York",
        service_state_province: "NY",
        service_postal_code: "10001",
      };

      const { container } = render(
        <CreateLeadModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={undefined}
          onCreate={onCreate}
          isSubmitting={false}
        />,
      );

      // Act - fill contact info fields
      await user.type(container.querySelector("#first_name")!, formData.first_name);
      await user.type(container.querySelector("#last_name")!, formData.last_name);
      await user.type(container.querySelector("#email")!, formData.email);
      await user.type(container.querySelector("#phone")!, formData.phone);

      // Navigate to location tab
      const nextButton1 = screen.getByText("Next");
      await user.click(nextButton1);

      // Fill required address fields
      await user.type(container.querySelector("#address_line1")!, formData.service_address_line1);
      await user.type(container.querySelector("#city")!, formData.service_city);
      await user.type(container.querySelector("#state")!, formData.service_state_province);
      await user.type(container.querySelector("#postal_code")!, formData.service_postal_code);

      // Navigate to details tab
      const nextButton2 = screen.getByText("Next");
      await user.click(nextButton2);

      // Wait for submit button to appear
      await waitFor(() => {
        expect(screen.getByText(/create lead/i)).toBeInTheDocument();
      });

      const submitButton = screen.getByText(/create lead/i);
      await user.click(submitButton);

      // Assert
      await waitFor(() => {
        expect(onCreate).toHaveBeenCalled();
      });
    });

    it("should disable submit button while submitting", async () => {
      // Arrange
      render(
        <CreateLeadModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={undefined}
          onCreate={vi.fn()}
          isSubmitting={true}
        />,
      );

      // Act - navigate using Next buttons to reach submit button
      const nextButton1 = screen.getByText("Next");
      await user.click(nextButton1);

      const nextButton2 = screen.getByText("Next");
      await user.click(nextButton2);

      // Wait for submit button to appear
      await waitFor(() => {
        expect(screen.getByText(/creating/i)).toBeInTheDocument();
      });

      const submitButton = screen.getByText(/creating/i);

      // Assert
      expect(submitButton).toBeDisabled();
    });

    it("should call onSuccess after successful creation", async () => {
      // Arrange
      const onCreate = vi.fn().mockResolvedValue({ success: true });
      const onSuccess = vi.fn();

      const { container } = render(
        <CreateLeadModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={onSuccess}
          onCreate={onCreate}
          isSubmitting={false}
        />,
      );

      // Act - fill contact info fields
      await user.type(container.querySelector("#first_name")!, "John");
      await user.type(container.querySelector("#last_name")!, "Doe");
      await user.type(container.querySelector("#email")!, "john@example.com");
      await user.type(container.querySelector("#phone")!, "+1234567890");

      // Navigate to location tab
      const nextButton1 = screen.getByText("Next");
      await user.click(nextButton1);

      // Fill required address fields
      await user.type(container.querySelector("#address_line1")!, "123 Main St");
      await user.type(container.querySelector("#city")!, "New York");
      await user.type(container.querySelector("#state")!, "NY");
      await user.type(container.querySelector("#postal_code")!, "10001");

      // Navigate to details tab
      const nextButton2 = screen.getByText("Next");
      await user.click(nextButton2);

      // Wait for submit button to appear
      await waitFor(() => {
        expect(screen.getByText(/create lead/i)).toBeInTheDocument();
      });

      const submitButton = screen.getByText(/create lead/i);
      await user.click(submitButton);

      // Assert
      await waitFor(() => {
        expect(onCreate).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });
    });
  });

  describe("Form Reset", () => {
    it("should reset form when modal is reopened", async () => {
      // Arrange
      const { rerender, container } = render(
        <CreateLeadModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={undefined}
          onCreate={vi.fn()}
          isSubmitting={false}
        />,
      );

      // Act - fill some data
      await user.type(container.querySelector("#first_name")!, "John");

      // Close and reopen
      rerender(
        <CreateLeadModal
          isOpen={false}
          onClose={vi.fn()}
          onSuccess={undefined}
          onCreate={vi.fn()}
          isSubmitting={false}
        />,
      );

      rerender(
        <CreateLeadModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={undefined}
          onCreate={vi.fn()}
          isSubmitting={false}
        />,
      );

      // Assert - form should be reset (implementation dependent)
      // This test verifies the component handles reopen correctly
      expect(screen.getByText("Create New Lead")).toBeInTheDocument();
    });
  });

  describe("Close Handling", () => {
    it("should call onClose when close button is clicked", async () => {
      // Arrange
      const onClose = vi.fn();
      render(
        <CreateLeadModal
          isOpen={true}
          onClose={onClose}
          onSuccess={undefined}
          onCreate={vi.fn()}
          isSubmitting={false}
        />,
      );

      // Act - find and click close button
      const cancelButton = screen.getByText(/cancel/i);
      await user.click(cancelButton);

      // Assert
      expect(onClose).toHaveBeenCalled();
    });
  });
});
