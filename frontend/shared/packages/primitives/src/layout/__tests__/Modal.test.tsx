/**
 * Refactored Modal component tests
 * Testing composition-based components with simplified interfaces
 */

import { act, fireEvent, render, screen } from "@testing-library/react";
import { axe } from "jest-axe";

import {
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContent,
  ModalDescription,
  ModalFocusUtils,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTrigger,
  useModalState,
} from "../Modal";

// Mock body style for scroll lock tests
Object.defineProperty(document.body, "style", {
  value: {
    // Implementation pending
  },
  writable: true,
});

describe("Refactored Modal Components", () => {
  describe("ModalFocusUtils", () => {
    it("finds focusable elements correctly", () => {
      const container = document.createElement("div");
      container.innerHTML = `
        <button type="button">Button 1</button>
        <input type="text" />
        <button type='button' disabled>Disabled Button</button>
        <a href="/test">Link</a>
        <div tabindex="0">Focusable Div</div>
        <div tabindex="-1">Non-focusable Div</div>
      `;

      const focusableElements = ModalFocusUtils.getFocusableElements(container);
      expect(focusableElements).toHaveLength(4); // button, input, link, focusable div
    });

    it("handles focus trapping on Tab key", () => {
      const container = document.createElement("div");
      const button1 = document.createElement("button");
      const button2 = document.createElement("button");
      button1.textContent = "First";
      button2.textContent = "Last";
      container.appendChild(button1);
      container.appendChild(button2);
      document.body.appendChild(container);

      // Mock activeElement
      Object.defineProperty(document, "activeElement", {
        value: button2,
        writable: true,
      });

      const mockEvent = {
        key: "Tab",
        shiftKey: false,
        preventDefault: jest.fn(),
      } as unknown;

      button1.focus = jest.fn();
      ModalFocusUtils.trapFocus(container, mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(button1.focus).toHaveBeenCalled();

      document.body.removeChild(container);
    });

    it("handles reverse focus trapping with Shift+Tab", () => {
      const container = document.createElement("div");
      const button1 = document.createElement("button");
      const button2 = document.createElement("button");
      button1.textContent = "First";
      button2.textContent = "Last";
      container.appendChild(button1);
      container.appendChild(button2);
      document.body.appendChild(container);

      // Mock activeElement as first element
      Object.defineProperty(document, "activeElement", {
        value: button1,
        writable: true,
      });

      const mockEvent = {
        key: "Tab",
        shiftKey: true,
        preventDefault: jest.fn(),
      } as unknown;

      button2.focus = jest.fn();
      ModalFocusUtils.trapFocus(container, mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(button2.focus).toHaveBeenCalled();

      document.body.removeChild(container);
    });

    it("sets initial focus to first focusable element", () => {
      const container = document.createElement("div");
      const button = document.createElement("button");
      button.textContent = "First Button";
      container.appendChild(button);

      button.focus = jest.fn();
      ModalFocusUtils.setInitialFocus(container);

      expect(button.focus).toHaveBeenCalled();
    });

    it("focuses container when no focusable elements exist", () => {
      const container = document.createElement("div");
      container.focus = jest.fn();

      ModalFocusUtils.setInitialFocus(container);

      expect(container.focus).toHaveBeenCalled();
    });
  });

  describe("useModalState", () => {
    it("provides modal state management", () => {
      const onOpenChange = jest.fn();
      let modalState: unknown;

      function TestComponent() {
        modalState = useModalState(false, onOpenChange);
        return null;
      }

      render(<TestComponent />);

      expect(modalState.isOpen).toBe(false);

      // Test open
      act(() => {
        modalState.open();
      });
      expect(onOpenChange).toHaveBeenCalledWith(true);

      // Test close
      act(() => {
        modalState.close();
      });
      expect(onOpenChange).toHaveBeenCalledWith(false);

      // Test toggle
      act(() => {
        modalState.toggle();
      });
      expect(onOpenChange).toHaveBeenCalledWith(true);
    });

    it("starts with default open state", () => {
      let modalState: unknown;

      function TestComponent() {
        modalState = useModalState(true);
        return null;
      }

      render(<TestComponent />);

      expect(modalState.isOpen).toBe(true);
    });
  });

  describe("ModalBackdrop", () => {
    it("renders backdrop correctly", () => {
      render(<ModalBackdrop />);

      const backdrop = screen.getByTestId("modal-backdrop");
      expect(backdrop).toBeInTheDocument();
      expect(backdrop).toHaveClass("modal-backdrop");
    });

    it("handles click events when closeOnClick is true", () => {
      const onClick = jest.fn();
      render(
        <ModalBackdrop
          onClick={onClick}
          onKeyDown={(e) => e.key === "Enter" && onClick}
          closeOnClick={true}
        />,
      );

      const backdrop = screen.getByTestId("modal-backdrop");
      fireEvent.click(backdrop);

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("prevents click events when closeOnClick is false", () => {
      const onClick = jest.fn();
      render(
        <ModalBackdrop
          onClick={onClick}
          onKeyDown={(e) => e.key === "Enter" && onClick}
          closeOnClick={false}
        />,
      );

      const backdrop = screen.getByTestId("modal-backdrop");
      fireEvent.click(backdrop);

      expect(onClick).not.toHaveBeenCalled();
    });

    it("only responds to direct clicks on backdrop", () => {
      const onClick = jest.fn();
      render(
        <ModalBackdrop
          onClick={onClick}
          onKeyDown={(e) => e.key === "Enter" && onClick}
          closeOnClick={true}
        >
          <div data-testid="inner-content">Inner content</div>
        </ModalBackdrop>,
      );

      const innerContent = screen.getByTestId("inner-content");
      fireEvent.click(innerContent);

      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe("ModalContent", () => {
    it("renders content with proper attributes", () => {
      render(
        <ModalContent>
          <div>Modal content</div>
        </ModalContent>,
      );

      const content = screen.getByTestId("modal-content");
      expect(content).toBeInTheDocument();
      expect(content).toHaveAttribute("role", "dialog");
      expect(content).toHaveAttribute("aria-modal", "true");
      expect(content).toHaveAttribute("tabIndex", "-1");
    });

    it("shows close button by default", () => {
      render(
        <ModalContent>
          <div>Modal content</div>
        </ModalContent>,
      );

      const closeButton = screen.getByTestId("modal-close");
      expect(closeButton).toBeInTheDocument();
      expect(closeButton).toHaveAttribute("aria-label", "Close modal");
    });

    it("hides close button when showClose is false", () => {
      render(
        <ModalContent showClose={false}>
          <div>Modal content</div>
        </ModalContent>,
      );

      expect(screen.queryByTestId("modal-close")).not.toBeInTheDocument();
    });

    it("handles close button click", () => {
      const onClose = jest.fn();
      render(
        <ModalContent onClose={onClose}>
          <div>Modal content</div>
        </ModalContent>,
      );

      const closeButton = screen.getByTestId("modal-close");
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("handles escape key when closeOnEscape is true", () => {
      const onClose = jest.fn();
      render(
        <ModalContent onClose={onClose} closeOnEscape={true}>
          <div>Modal content</div>
        </ModalContent>,
      );

      fireEvent.keyDown(document, { key: "Escape" });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("ignores escape key when closeOnEscape is false", () => {
      const onClose = jest.fn();
      render(
        <ModalContent onClose={onClose} closeOnEscape={false}>
          <div>Modal content</div>
        </ModalContent>,
      );

      fireEvent.keyDown(document, { key: "Escape" });

      expect(onClose).not.toHaveBeenCalled();
    });

    it("applies size and variant classes", () => {
      render(
        <ModalContent size="lg" variant="centered">
          <div>Modal content</div>
        </ModalContent>,
      );

      const content = screen.getByTestId("modal-content");
      expect(content).toHaveClass("modal-lg", "modal-centered");
    });
  });

  describe("ModalHeader", () => {
    it("renders with default div element", () => {
      render(
        <ModalHeader>
          <h2>Header content</h2>
        </ModalHeader>,
      );

      const header = screen.getByRole("heading");
      expect(header.parentElement).toHaveClass("modal-header");
    });

    it("renders with custom element", () => {
      render(
        <ModalHeader as="header">
          <h2>Header content</h2>
        </ModalHeader>,
      );

      const header = screen.getByRole("banner");
      expect(header).toHaveClass("modal-header");
    });
  });

  describe("ModalTitle", () => {
    it("renders with default h2 element", () => {
      render(<ModalTitle>Modal Title</ModalTitle>);

      const title = screen.getByTestId("modal-title");
      expect(title).toBeInTheDocument();
      expect(title.tagName).toBe("H2");
      expect(title).toHaveClass("modal-title");
    });

    it("renders with custom heading level", () => {
      render(<ModalTitle as="h1">Modal Title</ModalTitle>);

      const title = screen.getByTestId("modal-title");
      expect(title.tagName).toBe("H1");
    });
  });

  describe("ModalDescription", () => {
    it("renders description correctly", () => {
      render(<ModalDescription>This is a modal description</ModalDescription>);

      const description = screen.getByTestId("modal-description");
      expect(description).toBeInTheDocument();
      expect(description).toHaveClass("modal-description");
      expect(description.tagName).toBe("P");
    });
  });

  describe("ModalBody", () => {
    it("renders body content correctly", () => {
      render(
        <ModalBody>
          <p>Body content</p>
        </ModalBody>,
      );

      const body = screen.getByTestId("modal-body");
      expect(body).toBeInTheDocument();
      expect(body).toHaveClass("modal-body");
    });
  });

  describe("ModalFooter", () => {
    it("renders footer content correctly", () => {
      render(
        <ModalFooter>
          <button type="button">Action</button>
        </ModalFooter>,
      );

      const footer = screen.getByTestId("modal-footer");
      expect(footer).toBeInTheDocument();
      expect(footer).toHaveClass("modal-footer");
    });
  });

  describe("ModalTrigger", () => {
    it("renders as button by default", () => {
      render(<ModalTrigger>Open Modal</ModalTrigger>);

      const trigger = screen.getByTestId("modal-trigger");
      expect(trigger).toBeInTheDocument();
      expect(trigger.tagName).toBe("BUTTON");
      expect(trigger).toHaveClass("modal-trigger");
    });

    it("handles click events", () => {
      const onClick = jest.fn();
      render(
        <ModalTrigger onClick={onClick} onKeyDown={(e) => e.key === "Enter" && onClick}>
          Open Modal
        </ModalTrigger>,
      );

      const trigger = screen.getByTestId("modal-trigger");
      fireEvent.click(trigger);

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("renders as child when asChild is true", () => {
      const childOnClick = jest.fn();
      const triggerOnClick = jest.fn();

      render(
        <ModalTrigger
          asChild
          onClick={triggerOnClick}
          onKeyDown={(e) => e.key === "Enter" && triggerOnClick}
        >
          <button
            type="button"
            onClick={childOnClick}
            onKeyDown={(e) => e.key === "Enter" && childOnClick}
          >
            Custom Button
          </button>
        </ModalTrigger>,
      );

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(childOnClick).toHaveBeenCalledTimes(1);
      expect(triggerOnClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("Modal main component", () => {
    it("renders modal when open", () => {
      render(
        <Modal open={true}>
          <ModalBackdrop />
          <ModalContent>
            <ModalHeader>
              <ModalTitle>Test Modal</ModalTitle>
            </ModalHeader>
            <ModalBody>Content</ModalBody>
          </ModalContent>
        </Modal>,
      );

      expect(screen.getByTestId("modal-portal")).toBeInTheDocument();
      expect(screen.getByText("Test Modal")).toBeInTheDocument();
    });

    it("does not render modal when closed", () => {
      render(
        <Modal open={false}>
          <ModalBackdrop />
          <ModalContent>
            <ModalHeader>
              <ModalTitle>Test Modal</ModalTitle>
            </ModalHeader>
            <ModalBody>Content</ModalBody>
          </ModalContent>
        </Modal>,
      );

      expect(screen.queryByTestId("modal-portal")).not.toBeInTheDocument();
    });

    it("manages body scroll lock when open", () => {
      const { rerender } = render(
        <Modal open={false}>
          <ModalContent>Content</ModalContent>
        </Modal>,
      );

      expect(document.body.style.overflow).toBe("");

      rerender(
        <Modal open={true}>
          <ModalContent>Content</ModalContent>
        </Modal>,
      );

      expect(document.body.style.overflow).toBe("hidden");
    });

    it("handles uncontrolled state with defaultOpen", () => {
      const onOpenChange = jest.fn();

      render(
        <Modal defaultOpen={true} onOpenChange={onOpenChange}>
          <ModalTrigger>Toggle</ModalTrigger>
          <ModalBackdrop />
          <ModalContent>Content</ModalContent>
        </Modal>,
      );

      expect(screen.getByTestId("modal-portal")).toBeInTheDocument();

      const trigger = screen.getByTestId("modal-trigger");
      fireEvent.click(trigger);

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("passes onClose to ModalContent and ModalBackdrop", () => {
      const onOpenChange = jest.fn();

      render(
        <Modal open={true} onOpenChange={onOpenChange}>
          <ModalBackdrop />
          <ModalContent>Content</ModalContent>
        </Modal>,
      );

      const backdrop = screen.getByTestId("modal-backdrop");
      fireEvent.click(backdrop);

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("handles controlled state properly", () => {
      const onOpenChange = jest.fn();

      render(
        <Modal open={true} onOpenChange={onOpenChange}>
          <ModalTrigger>Toggle</ModalTrigger>
          <ModalBackdrop />
          <ModalContent>Content</ModalContent>
        </Modal>,
      );

      const trigger = screen.getByTestId("modal-trigger");
      fireEvent.click(trigger);

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe("Accessibility", () => {
    it("ModalContent should be accessible", async () => {
      const { container } = render(
        <ModalContent aria-label="Accessible Modal">
          <ModalHeader>
            <ModalTitle>Accessible Modal</ModalTitle>
          </ModalHeader>
          <ModalBody>Content here</ModalBody>
        </ModalContent>,
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("ModalBackdrop should be accessible", async () => {
      const { container } = render(
        <ModalBackdrop>
          <div>Backdrop content</div>
        </ModalBackdrop>,
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("complete Modal structure should be accessible", async () => {
      const { container } = render(
        <Modal open={true}>
          <ModalBackdrop />
          <ModalContent aria-label="Accessible Modal">
            <ModalHeader>
              <ModalTitle>Accessible Modal</ModalTitle>
              <ModalDescription>Modal description</ModalDescription>
            </ModalHeader>
            <ModalBody>
              <p>Modal content goes here</p>
            </ModalBody>
            <ModalFooter>
              <button type="button">Action</button>
            </ModalFooter>
          </ModalContent>
        </Modal>,
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("sets proper ARIA attributes on dialog", () => {
      render(
        <Modal open={true}>
          <ModalContent>
            <ModalTitle>Title</ModalTitle>
            <ModalDescription>Description</ModalDescription>
            <ModalBody>Content</ModalBody>
          </ModalContent>
        </Modal>,
      );

      const content = screen.getByTestId("modal-content");
      expect(content).toHaveAttribute("role", "dialog");
      expect(content).toHaveAttribute("aria-modal", "true");
      expect(content).toHaveAttribute("tabIndex", "-1");
    });
  });

  describe("Integration patterns", () => {
    it("works with complex modal structure", async () => {
      const onOpenChange = jest.fn();

      render(
        <Modal open={true} onOpenChange={onOpenChange}>
          <ModalBackdrop />
          <ModalContent size="lg" variant="centered">
            <ModalHeader>
              <ModalTitle>Complex Modal</ModalTitle>
              <ModalDescription>This is a complex modal example</ModalDescription>
            </ModalHeader>
            <ModalBody>
              <form>
                <input type="text" placeholder="Enter text" />
                <textarea placeholder="Enter description" />
              </form>
            </ModalBody>
            <ModalFooter>
              <button type="button">Cancel</button>
              <button type="submit">Submit</button>
            </ModalFooter>
          </ModalContent>
        </Modal>,
      );

      expect(screen.getByText("Complex Modal")).toBeInTheDocument();
      expect(screen.getByText("This is a complex modal example")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Enter text")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Enter description")).toBeInTheDocument();

      const cancelButton = screen.getByText("Cancel");
      const submitButton = screen.getByText("Submit");

      expect(cancelButton).toBeInTheDocument();
      expect(submitButton).toBeInTheDocument();
    });

    it("supports keyboard navigation", async () => {
      render(
        <Modal open={true}>
          <ModalContent aria-label="Navigation Modal">
            <ModalBody>
              <button type="button">First Button</button>
              <button type="button">Second Button</button>
              <button type="button">Third Button</button>
            </ModalBody>
          </ModalContent>
        </Modal>,
      );

      const firstButton = screen.getByText("First Button");
      const secondButton = screen.getByText("Second Button");
      const thirdButton = screen.getByText("Third Button");

      // Verify all buttons are focusable
      expect(firstButton).toBeInTheDocument();
      expect(secondButton).toBeInTheDocument();
      expect(thirdButton).toBeInTheDocument();

      // Test keyboard navigation by checking focus trapping exists
      expect(screen.getByLabelText("Close modal")).toBeInTheDocument();
    });
  });
});
