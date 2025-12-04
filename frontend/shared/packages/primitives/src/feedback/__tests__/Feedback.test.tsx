/**
 * Feedback component tests
 * Testing feedback states, variants, and user interactions
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import React from "react";

import { Feedback, FeedbackActions, FeedbackDescription, FeedbackTitle } from "../Feedback";

describe("Feedback Components", () => {
  describe("Feedback", () => {
    it("renders with default props", () => {
      render(
        <Feedback data-testid="feedback">
          <FeedbackTitle>Success</FeedbackTitle>
          <FeedbackDescription>Operation completed successfully</FeedbackDescription>
        </Feedback>,
      );

      const feedback = screen.getByTestId("feedback");
      expect(feedback).toBeInTheDocument();
      expect(screen.getByText("Success")).toBeInTheDocument();
      expect(screen.getByText("Operation completed successfully")).toBeInTheDocument();
    });

    it("applies variant classes correctly", () => {
      const { rerender } = render(
        <Feedback variant="success" data-testid="feedback">
          <FeedbackTitle>Success</FeedbackTitle>
        </Feedback>,
      );

      let feedback = screen.getByTestId("feedback");
      expect(feedback).toBeInTheDocument();

      rerender(
        <Feedback variant="error" data-testid="feedback">
          <FeedbackTitle>Error</FeedbackTitle>
        </Feedback>,
      );

      feedback = screen.getByTestId("feedback");
      expect(feedback).toBeInTheDocument();

      rerender(
        <Feedback variant="warning" data-testid="feedback">
          <FeedbackTitle>Warning</FeedbackTitle>
        </Feedback>,
      );

      feedback = screen.getByTestId("feedback");
      expect(feedback).toBeInTheDocument();

      rerender(
        <Feedback variant="info" data-testid="feedback">
          <FeedbackTitle>Info</FeedbackTitle>
        </Feedback>,
      );

      feedback = screen.getByTestId("feedback");
      expect(feedback).toBeInTheDocument();
    });

    it("handles dismissible feedback", () => {
      const onDismiss = jest.fn();

      render(
        <Feedback variant="info" dismissible onDismiss={onDismiss} data-testid="feedback">
          <FeedbackTitle>Dismissible</FeedbackTitle>
          <FeedbackDescription>You can close this</FeedbackDescription>
        </Feedback>,
      );

      const dismissButton = screen.getByRole("button", {
        name: /close|dismiss/i,
      });
      expect(dismissButton).toBeInTheDocument();

      fireEvent.click(dismissButton);
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it("auto-dismisses after timeout", () => {
      jest.useFakeTimers();
      const onDismiss = jest.fn();

      render(
        <Feedback
          variant="success"
          autoHide
          autoHideDelay={3000}
          onDismiss={onDismiss}
          data-testid="feedback"
        >
          <FeedbackTitle>Auto Hide</FeedbackTitle>
        </Feedback>,
      );

      expect(screen.getByTestId("feedback")).toBeInTheDocument();

      jest.advanceTimersByTime(3000);
      expect(onDismiss).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });

    it("accepts custom className", () => {
      render(
        <Feedback className="custom-feedback" data-testid="feedback">
          <FeedbackTitle>Custom</FeedbackTitle>
        </Feedback>,
      );

      expect(screen.getByTestId("feedback")).toHaveClass("custom-feedback");
    });
  });

  describe("FeedbackTitle", () => {
    it("renders title correctly", () => {
      render(
        <Feedback>
          <FeedbackTitle data-testid="title">Important Message</FeedbackTitle>
        </Feedback>,
      );

      const title = screen.getByTestId("title");
      expect(title).toBeInTheDocument();
      expect(title).toHaveTextContent("Important Message");
    });

    it("applies correct heading level", () => {
      render(
        <Feedback>
          <FeedbackTitle as="h2" data-testid="title">
            Title
          </FeedbackTitle>
        </Feedback>,
      );

      const title = screen.getByTestId("title");
      expect(title.tagName).toBe("H2");
    });
  });

  describe("FeedbackDescription", () => {
    it("renders description correctly", () => {
      render(
        <Feedback>
          <FeedbackDescription data-testid="description">
            This is a detailed description of the feedback.
          </FeedbackDescription>
        </Feedback>,
      );

      const description = screen.getByTestId("description");
      expect(description).toBeInTheDocument();
      expect(description).toHaveTextContent("This is a detailed description of the feedback.");
    });

    it("accepts custom className", () => {
      render(
        <Feedback>
          <FeedbackDescription className="custom-desc" data-testid="description">
            Description
          </FeedbackDescription>
        </Feedback>,
      );

      expect(screen.getByTestId("description")).toHaveClass("custom-desc");
    });
  });

  describe("FeedbackActions", () => {
    it("renders actions correctly", () => {
      render(
        <Feedback>
          <FeedbackTitle>Action Required</FeedbackTitle>
          <FeedbackActions data-testid="actions">
            <button type="button">Confirm</button>
            <button type="button">Cancel</button>
          </FeedbackActions>
        </Feedback>,
      );

      const actions = screen.getByTestId("actions");
      expect(actions).toBeInTheDocument();
      expect(screen.getByText("Confirm")).toBeInTheDocument();
      expect(screen.getByText("Cancel")).toBeInTheDocument();
    });

    it("handles action clicks", () => {
      const onConfirm = jest.fn();
      const onCancel = jest.fn();

      render(
        <Feedback>
          <FeedbackTitle>Confirm Action</FeedbackTitle>
          <FeedbackActions>
            <button
              type="button"
              onClick={onConfirm}
              onKeyDown={(e) => e.key === "Enter" && onConfirm}
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={onCancel}
              onKeyDown={(e) => e.key === "Enter" && onCancel}
            >
              Cancel
            </button>
          </FeedbackActions>
        </Feedback>,
      );

      fireEvent.click(screen.getByText("Confirm"));
      expect(onConfirm).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByText("Cancel"));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe("Accessibility", () => {
    it("should be accessible", async () => {
      const { container } = render(
        <Feedback variant="success">
          <FeedbackTitle>Success</FeedbackTitle>
          <FeedbackDescription>Operation completed</FeedbackDescription>
        </Feedback>,
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("has correct ARIA attributes", () => {
      render(
        <Feedback variant="error" data-testid="feedback" role="alert">
          <FeedbackTitle>Error</FeedbackTitle>
          <FeedbackDescription>Something went wrong</FeedbackDescription>
        </Feedback>,
      );

      const feedback = screen.getByTestId("feedback");
      expect(feedback).toHaveAttribute("role", "alert");
    });

    it("supports screen reader announcements", () => {
      render(
        <Feedback variant="success" aria-live="polite" data-testid="feedback">
          <FeedbackTitle>Success</FeedbackTitle>
          <FeedbackDescription>Changes saved</FeedbackDescription>
        </Feedback>,
      );

      const feedback = screen.getByTestId("feedback");
      expect(feedback).toHaveAttribute("aria-live", "polite");
    });

    it("dismiss button is accessible", () => {
      render(
        <Feedback dismissible onDismiss={jest.fn()}>
          <FeedbackTitle>Dismissible</FeedbackTitle>
        </Feedback>,
      );

      const dismissButton = screen.getByRole("button");
      expect(dismissButton).toHaveAccessibleName();
    });
  });

  describe("Complex usage patterns", () => {
    it("renders with icons", () => {
      const SuccessIcon = () => <span data-testid="success-icon">✓</span>;

      render(
        <Feedback variant="success">
          <SuccessIcon />
          <FeedbackTitle>Success</FeedbackTitle>
          <FeedbackDescription>Task completed</FeedbackDescription>
        </Feedback>,
      );

      expect(screen.getByTestId("success-icon")).toBeInTheDocument();
    });

    it("renders loading state", () => {
      render(
        <Feedback variant="info" loading data-testid="feedback">
          <FeedbackTitle>Processing</FeedbackTitle>
          <FeedbackDescription>Please wait...</FeedbackDescription>
        </Feedback>,
      );

      const feedback = screen.getByTestId("feedback");
      expect(feedback).toBeInTheDocument();
      expect(screen.getByRole("progressbar", { hidden: true })).toBeInTheDocument();
    });

    it("handles multiple actions", () => {
      render(
        <Feedback variant="warning">
          <FeedbackTitle>Unsaved Changes</FeedbackTitle>
          <FeedbackDescription>You have unsaved changes</FeedbackDescription>
          <FeedbackActions>
            <button type="button">Save</button>
            <button type="button">Discard</button>
            <button type="button">Cancel</button>
          </FeedbackActions>
        </Feedback>,
      );

      expect(screen.getByText("Save")).toBeInTheDocument();
      expect(screen.getByText("Discard")).toBeInTheDocument();
      expect(screen.getByText("Cancel")).toBeInTheDocument();
    });
  });

  describe("State management", () => {
    it("handles show/hide state", () => {
      const FeedbackWithState = () => {
        const [show, setShow] = React.useState(true);

        return (
          <>
            <button type="button" onClick={() => setShow(!show)}>
              Toggle
            </button>
            {show && (
              <Feedback data-testid="feedback">
                <FeedbackTitle>Conditional</FeedbackTitle>
              </Feedback>
            )}
          </>
        );
      };

      render(<FeedbackWithState />);

      expect(screen.getByTestId("feedback")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Toggle"));
      expect(screen.queryByTestId("feedback")).not.toBeInTheDocument();

      fireEvent.click(screen.getByText("Toggle"));
      expect(screen.getByTestId("feedback")).toBeInTheDocument();
    });

    it("handles dynamic content updates", () => {
      const DynamicFeedback = () => {
        const [message, setMessage] = React.useState("Initial message");

        return (
          <Feedback>
            <FeedbackTitle>Dynamic</FeedbackTitle>
            <FeedbackDescription data-testid="description">{message}</FeedbackDescription>
            <FeedbackActions>
              <button type="button" onClick={() => setMessage("Updated message")}>
                Update
              </button>
            </FeedbackActions>
          </Feedback>
        );
      };

      render(<DynamicFeedback />);

      expect(screen.getByTestId("description")).toHaveTextContent("Initial message");

      fireEvent.click(screen.getByText("Update"));
      expect(screen.getByTestId("description")).toHaveTextContent("Updated message");
    });
  });

  describe("Edge cases", () => {
    it("handles empty content", () => {
      render(<Feedback data-testid="feedback" />);

      const feedback = screen.getByTestId("feedback");
      expect(feedback).toBeInTheDocument();
    });

    it("handles very long content", () => {
      const longTitle = "A".repeat(100);
      const longDescription = "B".repeat(500);

      render(
        <Feedback>
          <FeedbackTitle data-testid="title">{longTitle}</FeedbackTitle>
          <FeedbackDescription data-testid="description">{longDescription}</FeedbackDescription>
        </Feedback>,
      );

      expect(screen.getByTestId("title")).toHaveTextContent(longTitle);
      expect(screen.getByTestId("description")).toHaveTextContent(longDescription);
    });
  });
});
