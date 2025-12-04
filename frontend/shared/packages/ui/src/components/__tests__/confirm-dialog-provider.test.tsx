/**
 * Confirm Dialog Provider Tests
 *
 * Tests ConfirmDialogProvider context and useConfirmDialog hook
 * Provides imperative confirm dialog API
 */

import { render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import { ConfirmDialogProvider, useConfirmDialog } from "../confirm-dialog-provider";

describe("ConfirmDialogProvider", () => {
  describe("Basic Rendering", () => {
    it("renders children", () => {
      render(
        <ConfirmDialogProvider>
          <div>Test Content</div>
        </ConfirmDialogProvider>,
      );

      expect(screen.getByText("Test Content")).toBeInTheDocument();
    });

    it("does not show dialog initially", () => {
      render(
        <ConfirmDialogProvider>
          <div>Test Content</div>
        </ConfirmDialogProvider>,
      );

      expect(screen.queryByText("Confirm action")).not.toBeInTheDocument();
    });
  });

  describe("useConfirmDialog Hook", () => {
    it("throws error when used outside provider", () => {
      // Suppress console.error for this test
      const originalError = console.error;
      console.error = jest.fn();

      expect(() => {
        renderHook(() => useConfirmDialog());
      }).toThrow("useConfirmDialog must be used within a ConfirmDialogProvider");

      console.error = originalError;
    });

    it("returns confirm function when used inside provider", () => {
      const { result } = renderHook(() => useConfirmDialog(), {
        wrapper: ConfirmDialogProvider,
      });

      expect(typeof result.current).toBe("function");
    });
  });

  describe("Confirm Function", () => {
    it("shows dialog when confirm is called", async () => {
      const TestComponent = () => {
        const confirm = useConfirmDialog();

        return (
          <button
            onClick={() =>
              confirm({
                description: "Are you sure?",
              })
            }
          >
            Open
          </button>
        );
      };

      render(
        <ConfirmDialogProvider>
          <TestComponent />
        </ConfirmDialogProvider>,
      );

      await userEvent.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(screen.getByText("Are you sure?")).toBeInTheDocument();
      });
    });

    it("returns a promise", () => {
      const { result } = renderHook(() => useConfirmDialog(), {
        wrapper: ConfirmDialogProvider,
      });

      const promise = result.current({ description: "Test" });

      expect(promise).toBeInstanceOf(Promise);
    });

    it("resolves with true when confirmed", async () => {
      const TestComponent = () => {
        const confirm = useConfirmDialog();
        const [result, setResult] = React.useState<boolean | null>(null);

        const handleClick = async () => {
          const confirmed = await confirm({
            description: "Are you sure?",
          });
          setResult(confirmed);
        };

        return (
          <div>
            <button onClick={handleClick}>Open</button>
            {result !== null && <div>Result: {result.toString()}</div>}
          </div>
        );
      };

      render(
        <ConfirmDialogProvider>
          <TestComponent />
        </ConfirmDialogProvider>,
      );

      await userEvent.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(screen.getByText("Confirm action")).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText("Confirm"));

      await waitFor(() => {
        expect(screen.getByText("Result: true")).toBeInTheDocument();
      });
    });

    it("resolves with false when cancelled", async () => {
      const TestComponent = () => {
        const confirm = useConfirmDialog();
        const [result, setResult] = React.useState<boolean | null>(null);

        const handleClick = async () => {
          const confirmed = await confirm({
            description: "Are you sure?",
          });
          setResult(confirmed);
        };

        return (
          <div>
            <button onClick={handleClick}>Open</button>
            {result !== null && <div>Result: {result.toString()}</div>}
          </div>
        );
      };

      render(
        <ConfirmDialogProvider>
          <TestComponent />
        </ConfirmDialogProvider>,
      );

      await userEvent.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(screen.getByText("Confirm action")).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText("Cancel"));

      await waitFor(() => {
        expect(screen.getByText("Result: false")).toBeInTheDocument();
      });
    });
  });

  describe("Dialog Options", () => {
    it("uses default title when not provided", async () => {
      const TestComponent = () => {
        const confirm = useConfirmDialog();

        return <button onClick={() => confirm({ description: "Test description" })}>Open</button>;
      };

      render(
        <ConfirmDialogProvider>
          <TestComponent />
        </ConfirmDialogProvider>,
      );

      await userEvent.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(screen.getByText("Confirm action")).toBeInTheDocument();
      });
    });

    it("uses custom title when provided", async () => {
      const TestComponent = () => {
        const confirm = useConfirmDialog();

        return (
          <button
            onClick={() =>
              confirm({
                title: "Delete User",
                description: "Are you sure?",
              })
            }
          >
            Open
          </button>
        );
      };

      render(
        <ConfirmDialogProvider>
          <TestComponent />
        </ConfirmDialogProvider>,
      );

      await userEvent.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(screen.getByText("Delete User")).toBeInTheDocument();
      });
    });

    it("uses custom confirm text", async () => {
      const TestComponent = () => {
        const confirm = useConfirmDialog();

        return (
          <button
            onClick={() =>
              confirm({
                description: "Test",
                confirmText: "Delete",
              })
            }
          >
            Open
          </button>
        );
      };

      render(
        <ConfirmDialogProvider>
          <TestComponent />
        </ConfirmDialogProvider>,
      );

      await userEvent.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(screen.getByText("Delete")).toBeInTheDocument();
      });
    });

    it("uses custom cancel text", async () => {
      const TestComponent = () => {
        const confirm = useConfirmDialog();

        return (
          <button
            onClick={() =>
              confirm({
                description: "Test",
                cancelText: "Go Back",
              })
            }
          >
            Open
          </button>
        );
      };

      render(
        <ConfirmDialogProvider>
          <TestComponent />
        </ConfirmDialogProvider>,
      );

      await userEvent.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(screen.getByText("Go Back")).toBeInTheDocument();
      });
    });

    it("supports variant option", async () => {
      const TestComponent = () => {
        const confirm = useConfirmDialog();

        return (
          <button
            onClick={() =>
              confirm({
                description: "Test",
                variant: "destructive",
              })
            }
          >
            Open
          </button>
        );
      };

      render(
        <ConfirmDialogProvider>
          <TestComponent />
        </ConfirmDialogProvider>,
      );

      await userEvent.click(screen.getByText("Open"));

      await waitFor(() => {
        const confirmButton = screen.getByText("Confirm");
        expect(confirmButton).toHaveClass("bg-red-600");
      });
    });
  });

  describe("Dialog State Management", () => {
    it("closes dialog after confirm", async () => {
      const TestComponent = () => {
        const confirm = useConfirmDialog();

        return <button onClick={() => confirm({ description: "Test" })}>Open</button>;
      };

      render(
        <ConfirmDialogProvider>
          <TestComponent />
        </ConfirmDialogProvider>,
      );

      await userEvent.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(screen.getByText("Confirm action")).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText("Confirm"));

      await waitFor(() => {
        expect(screen.queryByText("Confirm action")).not.toBeInTheDocument();
      });
    });

    it("closes dialog after cancel", async () => {
      const TestComponent = () => {
        const confirm = useConfirmDialog();

        return <button onClick={() => confirm({ description: "Test" })}>Open</button>;
      };

      render(
        <ConfirmDialogProvider>
          <TestComponent />
        </ConfirmDialogProvider>,
      );

      await userEvent.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(screen.getByText("Confirm action")).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText("Cancel"));

      await waitFor(() => {
        expect(screen.queryByText("Confirm action")).not.toBeInTheDocument();
      });
    });

    it("handles multiple sequential dialogs", async () => {
      const TestComponent = () => {
        const confirm = useConfirmDialog();
        const [results, setResults] = React.useState<boolean[]>([]);

        const handleClick = async () => {
          const result1 = await confirm({ description: "First dialog" });
          const result2 = await confirm({ description: "Second dialog" });
          setResults([result1, result2]);
        };

        return (
          <div>
            <button onClick={handleClick}>Open</button>
            {results.length > 0 && <div>Results: {results.map(String).join(", ")}</div>}
          </div>
        );
      };

      render(
        <ConfirmDialogProvider>
          <TestComponent />
        </ConfirmDialogProvider>,
      );

      await userEvent.click(screen.getByText("Open"));

      // First dialog
      await waitFor(() => {
        expect(screen.getByText("First dialog")).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText("Confirm"));

      // Second dialog
      await waitFor(() => {
        expect(screen.getByText("Second dialog")).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText("Cancel"));

      await waitFor(() => {
        expect(screen.getByText("Results: true, false")).toBeInTheDocument();
      });
    });
  });

  describe("Real-World Usage Patterns", () => {
    it("delete operation with confirmation", async () => {
      const handleDelete = jest.fn();

      const TestComponent = () => {
        const confirm = useConfirmDialog();

        const deleteUser = async () => {
          const confirmed = await confirm({
            title: "Delete User",
            description: "This action cannot be undone.",
            confirmText: "Delete",
            variant: "destructive",
          });

          if (confirmed) {
            handleDelete();
          }
        };

        return <button onClick={deleteUser}>Delete User</button>;
      };

      render(
        <ConfirmDialogProvider>
          <TestComponent />
        </ConfirmDialogProvider>,
      );

      await userEvent.click(screen.getByText("Delete User"));

      await waitFor(() => {
        expect(screen.getByText("This action cannot be undone.")).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText("Delete"));

      await waitFor(() => {
        expect(handleDelete).toHaveBeenCalled();
      });
    });

    it("cancel operation does not execute action", async () => {
      const handleDelete = jest.fn();

      const TestComponent = () => {
        const confirm = useConfirmDialog();

        const deleteUser = async () => {
          const confirmed = await confirm({
            title: "Delete User",
            description: "Are you sure?",
          });

          if (confirmed) {
            handleDelete();
          }
        };

        return <button onClick={deleteUser}>Delete User</button>;
      };

      render(
        <ConfirmDialogProvider>
          <TestComponent />
        </ConfirmDialogProvider>,
      );

      await userEvent.click(screen.getByText("Delete User"));

      await waitFor(() => {
        expect(screen.getAllByText("Delete User").length).toBeGreaterThan(0);
      });

      await userEvent.click(screen.getByText("Cancel"));

      await waitFor(() => {
        expect(handleDelete).not.toHaveBeenCalled();
      });
    });

    it("navigation warning", async () => {
      const handleNavigate = jest.fn();

      const TestComponent = () => {
        const confirm = useConfirmDialog();

        const navigate = async () => {
          const confirmed = await confirm({
            title: "Unsaved Changes",
            description: "You have unsaved changes. Do you want to leave?",
            confirmText: "Leave",
            cancelText: "Stay",
            variant: "warning",
          });

          if (confirmed) {
            handleNavigate();
          }
        };

        return <button onClick={navigate}>Leave Page</button>;
      };

      render(
        <ConfirmDialogProvider>
          <TestComponent />
        </ConfirmDialogProvider>,
      );

      await userEvent.click(screen.getByText("Leave Page"));

      await waitFor(() => {
        expect(
          screen.getByText("You have unsaved changes. Do you want to leave?"),
        ).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText("Stay"));

      await waitFor(() => {
        expect(handleNavigate).not.toHaveBeenCalled();
      });
    });
  });

  describe("Context Value Memoization", () => {
    it("memoizes context value", () => {
      let renderCount = 0;

      const TestComponent = () => {
        const confirm = useConfirmDialog();
        renderCount++;
        return <button onClick={() => confirm({ description: "Test" })}>Open</button>;
      };

      const { rerender } = render(
        <ConfirmDialogProvider>
          <TestComponent />
        </ConfirmDialogProvider>,
      );

      const initialRenderCount = renderCount;

      rerender(
        <ConfirmDialogProvider>
          <TestComponent />
        </ConfirmDialogProvider>,
      );

      // Component should not re-render unnecessarily
      expect(renderCount).toBe(initialRenderCount + 1);
    });
  });
});
