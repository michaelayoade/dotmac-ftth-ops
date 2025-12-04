/**
 * Toast Components Tests
 *
 * Testing ToastProvider, useToast hook, auto-dismiss, types (success/error/warning/info),
 * addToast/removeToast/clearToasts, and toast positioning
 */

import React from "react";
import {
  render,
  renderA11y,
  renderWithTimers,
  renderComprehensive,
  screen,
  fireEvent,
  waitFor,
  act,
} from "../../testing";
import {
  ToastProvider,
  useToast,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastAction,
  ToastClose,
  ToastContent,
} from "../Toast";

describe("Toast Components", () => {
  describe("ToastProvider", () => {
    it("renders children", () => {
      render(
        <ToastProvider>
          <div data-testid="child">Content</div>
        </ToastProvider>,
      );

      expect(screen.getByTestId("child")).toBeInTheDocument();
    });

    it("throws error when useToast is used outside provider", () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const TestComponent = () => {
        useToast();
        return <div>Test</div>;
      };

      expect(() => render(<TestComponent />)).toThrow(
        "useToast must be used within a ToastProvider",
      );

      consoleSpy.mockRestore();
    });
  });

  describe("useToast Hook", () => {
    it("provides toasts array", () => {
      const TestComponent = () => {
        const { toasts } = useToast();
        return <div data-testid="toast-count">{toasts.length}</div>;
      };

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>,
      );

      expect(screen.getByTestId("toast-count")).toHaveTextContent("0");
    });

    it("provides addToast function", () => {
      const TestComponent = () => {
        const { addToast, toasts } = useToast();

        return (
          <div>
            <button onClick={() => addToast({ title: "Test Toast" })}>Add Toast</button>
            <div data-testid="toast-count">{toasts.length}</div>
          </div>
        );
      };

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>,
      );

      fireEvent.click(screen.getByText("Add Toast"));

      expect(screen.getByTestId("toast-count")).toHaveTextContent("1");
      expect(screen.getByText("Test Toast")).toBeInTheDocument();
    });

    it("generates unique ID for each toast", () => {
      const TestComponent = () => {
        const { addToast } = useToast();
        const [ids, setIds] = React.useState<string[]>([]);

        const handleAdd = () => {
          const id = addToast({ title: "Toast" });
          setIds((prev) => [...prev, id]);
        };

        return (
          <div>
            <button onClick={handleAdd}>Add</button>
            <div data-testid="unique">{ids.length === new Set(ids).size ? "yes" : "no"}</div>
          </div>
        );
      };

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>,
      );

      fireEvent.click(screen.getByText("Add"));
      fireEvent.click(screen.getByText("Add"));
      fireEvent.click(screen.getByText("Add"));

      expect(screen.getByTestId("unique")).toHaveTextContent("yes");
    });
  });

  describe("Auto-Dismiss Behavior", () => {
    it("auto-removes toast after default duration (5000ms)", () => {
      const TestComponent = () => {
        const { addToast } = useToast();

        return <button onClick={() => addToast({ title: "Auto Dismiss" })}>Add Toast</button>;
      };

      const { advanceTimers, cleanup } = renderWithTimers(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>,
      );

      fireEvent.click(screen.getByText("Add Toast"));

      expect(screen.getByText("Auto Dismiss")).toBeInTheDocument();

      act(() => {
        advanceTimers(5000);
      });

      expect(screen.queryByText("Auto Dismiss")).not.toBeInTheDocument();

      cleanup();
    });

    it("auto-removes toast after custom duration", () => {
      const TestComponent = () => {
        const { addToast } = useToast();

        return (
          <button onClick={() => addToast({ title: "Custom Duration", duration: 3000 })}>
            Add Toast
          </button>
        );
      };

      const { advanceTimers, cleanup } = renderWithTimers(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>,
      );

      fireEvent.click(screen.getByText("Add Toast"));

      expect(screen.getByText("Custom Duration")).toBeInTheDocument();

      act(() => {
        advanceTimers(3000);
      });

      expect(screen.queryByText("Custom Duration")).not.toBeInTheDocument();

      cleanup();
    });

    it("does not auto-remove when duration is 0", () => {
      const TestComponent = () => {
        const { addToast } = useToast();

        return (
          <button onClick={() => addToast({ title: "Permanent", duration: 0 })}>Add Toast</button>
        );
      };

      const { advanceTimers, cleanup } = renderWithTimers(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>,
      );

      fireEvent.click(screen.getByText("Add Toast"));

      expect(screen.getByText("Permanent")).toBeInTheDocument();

      act(() => {
        advanceTimers(10000);
      });

      // Should still be visible
      expect(screen.getByText("Permanent")).toBeInTheDocument();

      cleanup();
    });
  });

  describe("Manual Toast Management", () => {
    it("removes toast when removeToast is called", () => {
      const TestComponent = () => {
        const { addToast, removeToast } = useToast();
        const [toastId, setToastId] = React.useState<string | null>(null);

        const handleAdd = () => {
          const id = addToast({ title: "Removable", duration: 0 });
          setToastId(id);
        };

        const handleRemove = () => {
          if (toastId) removeToast(toastId);
        };

        return (
          <div>
            <button onClick={handleAdd}>Add</button>
            <button onClick={handleRemove}>Remove</button>
          </div>
        );
      };

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>,
      );

      fireEvent.click(screen.getByText("Add"));
      expect(screen.getByText("Removable")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Remove"));
      expect(screen.queryByText("Removable")).not.toBeInTheDocument();
    });

    it("clears all toasts when clearToasts is called", () => {
      const TestComponent = () => {
        const { addToast, clearToasts } = useToast();

        return (
          <div>
            <button
              onClick={() => {
                addToast({ title: "Toast 1", duration: 0 });
                addToast({ title: "Toast 2", duration: 0 });
                addToast({ title: "Toast 3", duration: 0 });
              }}
            >
              Add Multiple
            </button>
            <button onClick={clearToasts}>Clear All</button>
          </div>
        );
      };

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>,
      );

      fireEvent.click(screen.getByText("Add Multiple"));

      expect(screen.getByText("Toast 1")).toBeInTheDocument();
      expect(screen.getByText("Toast 2")).toBeInTheDocument();
      expect(screen.getByText("Toast 3")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Clear All"));

      expect(screen.queryByText("Toast 1")).not.toBeInTheDocument();
      expect(screen.queryByText("Toast 2")).not.toBeInTheDocument();
      expect(screen.queryByText("Toast 3")).not.toBeInTheDocument();
    });
  });

  describe("Toast Types", () => {
    it("renders default type toast", () => {
      render(
        <ToastProvider>
          <TestToastAdder type="default" />
        </ToastProvider>,
      );

      fireEvent.click(screen.getByText("Add Toast"));

      const toast = screen.getByRole("status");
      expect(toast).toHaveClass("bg-white", "text-gray-900");
    });

    it("renders success type toast", () => {
      render(
        <ToastProvider>
          <TestToastAdder type="success" />
        </ToastProvider>,
      );

      fireEvent.click(screen.getByText("Add Toast"));

      const toast = screen.getByRole("status");
      expect(toast).toHaveClass("bg-green-50", "text-green-900");
    });

    it("renders error type toast", () => {
      render(
        <ToastProvider>
          <TestToastAdder type="error" />
        </ToastProvider>,
      );

      fireEvent.click(screen.getByText("Add Toast"));

      const toast = screen.getByRole("status");
      expect(toast).toHaveClass("bg-red-50", "text-red-900");
    });

    it("renders warning type toast", () => {
      render(
        <ToastProvider>
          <TestToastAdder type="warning" />
        </ToastProvider>,
      );

      fireEvent.click(screen.getByText("Add Toast"));

      const toast = screen.getByRole("status");
      expect(toast).toHaveClass("bg-yellow-50", "text-yellow-900");
    });

    it("renders info type toast", () => {
      render(
        <ToastProvider>
          <TestToastAdder type="info" />
        </ToastProvider>,
      );

      fireEvent.click(screen.getByText("Add Toast"));

      const toast = screen.getByRole("status");
      expect(toast).toHaveClass("bg-blue-50", "text-blue-900");
    });
  });

  describe("Toast Content", () => {
    it("renders toast with title only", () => {
      const TestComponent = () => {
        const { addToast } = useToast();

        return <button onClick={() => addToast({ title: "Title Only" })}>Add Toast</button>;
      };

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>,
      );

      fireEvent.click(screen.getByText("Add Toast"));

      expect(screen.getByText("Title Only")).toBeInTheDocument();
    });

    it("renders toast with title and description", () => {
      const TestComponent = () => {
        const { addToast } = useToast();

        return (
          <button
            onClick={() =>
              addToast({
                title: "Success",
                description: "Your changes have been saved",
              })
            }
          >
            Add Toast
          </button>
        );
      };

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>,
      );

      fireEvent.click(screen.getByText("Add Toast"));

      expect(screen.getByText("Success")).toBeInTheDocument();
      expect(screen.getByText("Your changes have been saved")).toBeInTheDocument();
    });

    it("renders toast with custom action", () => {
      const TestComponent = () => {
        const { addToast } = useToast();

        return (
          <button
            onClick={() =>
              addToast({
                title: "File deleted",
                action: <button>Undo</button>,
              })
            }
          >
            Add Toast
          </button>
        );
      };

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>,
      );

      fireEvent.click(screen.getByText("Add Toast"));

      expect(screen.getByText("File deleted")).toBeInTheDocument();
      expect(screen.getByText("Undo")).toBeInTheDocument();
    });
  });

  describe("Toast Close Button", () => {
    it("renders close button", () => {
      const TestComponent = () => {
        const { addToast } = useToast();

        return (
          <button onClick={() => addToast({ title: "Closable", duration: 0 })}>Add Toast</button>
        );
      };

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>,
      );

      fireEvent.click(screen.getByText("Add Toast"));

      expect(screen.getByLabelText("Close")).toBeInTheDocument();
    });

    it("removes toast when close button is clicked", () => {
      const TestComponent = () => {
        const { addToast } = useToast();

        return (
          <button onClick={() => addToast({ title: "Closable", duration: 0 })}>Add Toast</button>
        );
      };

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>,
      );

      fireEvent.click(screen.getByText("Add Toast"));
      expect(screen.getByText("Closable")).toBeInTheDocument();

      fireEvent.click(screen.getByLabelText("Close"));
      expect(screen.queryByText("Closable")).not.toBeInTheDocument();
    });
  });

  describe("Toast Positioning", () => {
    it("renders toast viewport with correct positioning classes", () => {
      render(
        <ToastProvider>
          <div>Content</div>
        </ToastProvider>,
      );

      const viewport = document.querySelector(".fixed");
      expect(viewport).toHaveClass("top-0", "z-[100]");
    });

    it("stacks multiple toasts", () => {
      const TestComponent = () => {
        const { addToast } = useToast();

        return (
          <button
            onClick={() => {
              addToast({ title: "Toast 1", duration: 0 });
              addToast({ title: "Toast 2", duration: 0 });
              addToast({ title: "Toast 3", duration: 0 });
            }}
          >
            Add Multiple
          </button>
        );
      };

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>,
      );

      fireEvent.click(screen.getByText("Add Multiple"));

      expect(screen.getByText("Toast 1")).toBeInTheDocument();
      expect(screen.getByText("Toast 2")).toBeInTheDocument();
      expect(screen.getByText("Toast 3")).toBeInTheDocument();
    });
  });

  describe("Toast Component", () => {
    it("renders with default type", () => {
      const { container } = render(<Toast>Content</Toast>);

      const toast = container.firstChild;
      expect(toast).toHaveClass("bg-white", "text-gray-900");
    });

    it("forwards ref", () => {
      const ref = React.createRef<HTMLDivElement>();

      render(<Toast ref={ref}>Content</Toast>);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });

    it("applies custom className", () => {
      const { container } = render(<Toast className="custom-toast">Content</Toast>);

      expect(container.firstChild).toHaveClass("custom-toast");
    });
  });

  describe("ToastTitle Component", () => {
    it("renders toast title", () => {
      render(<ToastTitle>Title</ToastTitle>);

      expect(screen.getByText("Title")).toBeInTheDocument();
    });

    it("has semibold font", () => {
      const { container } = render(<ToastTitle>Title</ToastTitle>);

      expect(container.firstChild).toHaveClass("font-semibold");
    });
  });

  describe("ToastDescription Component", () => {
    it("renders toast description", () => {
      render(<ToastDescription>Description text</ToastDescription>);

      expect(screen.getByText("Description text")).toBeInTheDocument();
    });

    it("has reduced opacity", () => {
      const { container } = render(<ToastDescription>Description</ToastDescription>);

      expect(container.firstChild).toHaveClass("opacity-90");
    });
  });

  describe("Accessibility", () => {
    it("passes accessibility validation", async () => {
      await renderA11y(
        <ToastProvider>
          <TestToastAdder type="success" />
        </ToastProvider>,
      );

      fireEvent.click(screen.getByText("Add Toast"));
    });

    it("close button has sr-only text", () => {
      render(<ToastClose />);

      expect(screen.getByText("Close")).toHaveClass("sr-only");
    });
  });

  describe("Comprehensive Testing", () => {
    it("passes all comprehensive tests", async () => {
      const { result, metrics } = await renderComprehensive(
        <ToastProvider>
          <TestToastAdder type="success" />
        </ToastProvider>,
      );

      fireEvent.click(screen.getByText("Add Toast"));

      await expect(result.container).toBeAccessible();
      expect(result.container).toHaveNoSecurityViolations();
      expect(metrics).toBePerformant();
      expect(result.container).toHaveValidMarkup();
    });

    it("handles complete toast lifecycle", () => {
      const TestLifecycleAdder = () => {
        const { addToast } = useToast();
        return (
          <button onClick={() => addToast({ title: "Test Toast", type: "success" })}>
            Add Toast
          </button>
        );
      };

      const { advanceTimers, cleanup } = renderWithTimers(
        <ToastProvider>
          <TestLifecycleAdder />
        </ToastProvider>,
      );

      // Add toast with default duration (5000ms)
      fireEvent.click(screen.getByText("Add Toast"));
      expect(screen.getByText("Test Toast")).toBeInTheDocument();

      // Wait for auto-dismiss
      act(() => {
        advanceTimers(5000);
      });

      expect(screen.queryByText("Test Toast")).not.toBeInTheDocument();

      cleanup();
    });
  });
});

// Helper component for testing
function TestToastAdder({ type }: { type?: "default" | "success" | "error" | "warning" | "info" }) {
  const { addToast } = useToast();

  return (
    <button onClick={() => addToast({ title: "Test Toast", type, duration: 0 })}>Add Toast</button>
  );
}
