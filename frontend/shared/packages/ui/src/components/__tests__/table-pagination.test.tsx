/**
 * Table Pagination Component Tests
 *
 * Tests TablePagination component and usePagination hook
 * Supports both client-side and server-side pagination
 */

import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import { TablePagination, usePagination } from "../table-pagination";

describe("TablePagination", () => {
  const defaultProps = {
    pageIndex: 0,
    pageCount: 5,
    pageSize: 10,
    onPageChange: jest.fn(),
    onPageSizeChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Basic Rendering", () => {
    it("renders pagination controls", () => {
      render(<TablePagination {...defaultProps} />);

      expect(screen.getByText("Rows per page")).toBeInTheDocument();
      expect(screen.getAllByText(/Page 1 of 5/)).toHaveLength(2);
      expect(screen.getByLabelText("Go to previous page")).toBeInTheDocument();
      expect(screen.getByLabelText("Go to next page")).toBeInTheDocument();
    });

    it("renders page size selector", () => {
      render(<TablePagination {...defaultProps} />);

      const select = screen.getByLabelText("Select page size");
      expect(select).toBeInTheDocument();
      expect(select).toHaveValue("10");
    });

    it("renders default page size options", () => {
      render(<TablePagination {...defaultProps} />);

      const select = screen.getByLabelText("Select page size");
      const options = Array.from(select.querySelectorAll("option")).map((opt) => opt.value);

      expect(options).toEqual(["10", "20", "30", "50", "100"]);
    });

    it("renders custom page size options", () => {
      render(<TablePagination {...defaultProps} pageSizeOptions={[5, 15, 25]} />);

      const select = screen.getByLabelText("Select page size");
      const options = Array.from(select.querySelectorAll("option")).map((opt) => opt.value);

      expect(options).toEqual(["5", "15", "25"]);
    });

    it("displays current page number", () => {
      render(<TablePagination {...defaultProps} pageIndex={2} />);

      expect(screen.getAllByText(/Page 3 of 5/)).toHaveLength(2);
    });
  });

  describe("Page Navigation", () => {
    it("calls onPageChange when next button clicked", async () => {
      const user = userEvent.setup();
      const onPageChange = jest.fn();

      render(<TablePagination {...defaultProps} onPageChange={onPageChange} />);

      await user.click(screen.getByLabelText("Go to next page"));

      expect(onPageChange).toHaveBeenCalledWith(1);
    });

    it("calls onPageChange when previous button clicked", async () => {
      const user = userEvent.setup();
      const onPageChange = jest.fn();

      render(<TablePagination {...defaultProps} pageIndex={2} onPageChange={onPageChange} />);

      await user.click(screen.getByLabelText("Go to previous page"));

      expect(onPageChange).toHaveBeenCalledWith(1);
    });

    it("disables previous button on first page", () => {
      render(<TablePagination {...defaultProps} pageIndex={0} />);

      const previousButton = screen.getByLabelText("Go to previous page");
      expect(previousButton).toBeDisabled();
    });

    it("disables next button on last page", () => {
      render(<TablePagination {...defaultProps} pageIndex={4} pageCount={5} />);

      const nextButton = screen.getByLabelText("Go to next page");
      expect(nextButton).toBeDisabled();
    });

    it("enables previous button when not on first page", () => {
      render(<TablePagination {...defaultProps} pageIndex={1} />);

      const previousButton = screen.getByLabelText("Go to previous page");
      expect(previousButton).not.toBeDisabled();
    });

    it("enables next button when not on last page", () => {
      render(<TablePagination {...defaultProps} pageIndex={0} pageCount={5} />);

      const nextButton = screen.getByLabelText("Go to next page");
      expect(nextButton).not.toBeDisabled();
    });
  });

  describe("Server-Side Pagination", () => {
    it("uses canNextPage for next button state", () => {
      render(<TablePagination {...defaultProps} canNextPage={false} />);

      const nextButton = screen.getByLabelText("Go to next page");
      expect(nextButton).toBeDisabled();
    });

    it("uses canPreviousPage for previous button state", () => {
      render(<TablePagination {...defaultProps} pageIndex={1} canPreviousPage={false} />);

      const previousButton = screen.getByLabelText("Go to previous page");
      expect(previousButton).toBeDisabled();
    });

    it("prefers canNextPage over calculated state", () => {
      render(<TablePagination {...defaultProps} pageIndex={4} pageCount={5} canNextPage={true} />);

      const nextButton = screen.getByLabelText("Go to next page");
      expect(nextButton).not.toBeDisabled();
    });
  });

  describe("Page Size Changes", () => {
    it("calls onPageSizeChange when page size changed", async () => {
      const user = userEvent.setup();
      const onPageSizeChange = jest.fn();

      render(<TablePagination {...defaultProps} onPageSizeChange={onPageSizeChange} />);

      const select = screen.getByLabelText("Select page size");
      await user.selectOptions(select, "20");

      expect(onPageSizeChange).toHaveBeenCalledWith(20);
    });

    it("displays current page size", () => {
      render(<TablePagination {...defaultProps} pageSize={50} />);

      const select = screen.getByLabelText("Select page size");
      expect(select).toHaveValue("50");
    });
  });

  describe("Item Count Display", () => {
    it("displays item range when totalItems provided", () => {
      render(<TablePagination {...defaultProps} totalItems={100} />);

      expect(screen.getByText("Showing 1 to 10 of 100 results")).toBeInTheDocument();
    });

    it("calculates correct item range for middle page", () => {
      render(<TablePagination {...defaultProps} pageIndex={2} pageSize={10} totalItems={100} />);

      expect(screen.getByText("Showing 21 to 30 of 100 results")).toBeInTheDocument();
    });

    it("handles last page with fewer items", () => {
      render(<TablePagination {...defaultProps} pageIndex={4} pageSize={10} totalItems={45} />);

      expect(screen.getByText("Showing 41 to 45 of 45 results")).toBeInTheDocument();
    });

    it("displays page number when totalItems not provided", () => {
      render(<TablePagination {...defaultProps} />);

      expect(screen.getAllByText(/Page 1 of 5/)).toHaveLength(2);
    });
  });

  describe("Selection Count", () => {
    it("does not show selection count by default", () => {
      render(<TablePagination {...defaultProps} />);

      expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
    });

    it("shows selection count when provided", () => {
      render(
        <TablePagination {...defaultProps} selectedCount={5} filteredCount={50} totalItems={100} />,
      );

      expect(screen.getByText("5 of 50 row(s) selected")).toBeInTheDocument();
    });

    it("uses totalItems when filteredCount not provided", () => {
      render(<TablePagination {...defaultProps} selectedCount={3} totalItems={50} />);

      expect(screen.getByText("3 of 50 row(s) selected")).toBeInTheDocument();
    });

    it("hides selection count when selectedCount is 0", () => {
      render(<TablePagination {...defaultProps} selectedCount={0} totalItems={50} />);

      expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
      expect(screen.getByText(/Showing/)).toBeInTheDocument();
    });
  });

  describe("Styling", () => {
    it("applies custom className", () => {
      const { container } = render(
        <TablePagination {...defaultProps} className="custom-pagination" />,
      );

      const pagination = container.firstChild;
      expect(pagination).toHaveClass("custom-pagination");
    });

    it("has flex layout", () => {
      const { container } = render(<TablePagination {...defaultProps} />);

      const pagination = container.firstChild;
      expect(pagination).toHaveClass("flex", "items-center", "justify-between");
    });
  });

  describe("Accessibility", () => {
    it("page size select has aria-label", () => {
      render(<TablePagination {...defaultProps} />);

      expect(screen.getByLabelText("Select page size")).toBeInTheDocument();
    });

    it("previous button has aria-label", () => {
      render(<TablePagination {...defaultProps} />);

      expect(screen.getByLabelText("Go to previous page")).toBeInTheDocument();
    });

    it("next button has aria-label", () => {
      render(<TablePagination {...defaultProps} />);

      expect(screen.getByLabelText("Go to next page")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("handles single page", () => {
      render(<TablePagination {...defaultProps} pageCount={1} />);

      expect(screen.getByLabelText("Go to previous page")).toBeDisabled();
      expect(screen.getByLabelText("Go to next page")).toBeDisabled();
    });

    it("handles zero total items", () => {
      render(<TablePagination {...defaultProps} totalItems={0} pageCount={1} />);

      expect(screen.getByText("Showing 1 to 0 of 0 results")).toBeInTheDocument();
    });

    it("handles large page numbers", () => {
      render(<TablePagination {...defaultProps} pageIndex={99} pageCount={100} />);

      expect(screen.getAllByText(/Page 100 of 100/)).toHaveLength(2);
    });
  });
});

describe("usePagination", () => {
  describe("Initial State", () => {
    it("initializes with default page size", () => {
      const { result } = renderHook(() => usePagination());

      expect(result.current.pageIndex).toBe(0);
      expect(result.current.pageSize).toBe(10);
      expect(result.current.offset).toBe(0);
      expect(result.current.limit).toBe(10);
    });

    it("initializes with custom page size", () => {
      const { result } = renderHook(() => usePagination(25));

      expect(result.current.pageSize).toBe(25);
      expect(result.current.limit).toBe(25);
    });
  });

  describe("Page Change", () => {
    it("changes page index", () => {
      const { result } = renderHook(() => usePagination());

      act(() => {
        result.current.onPageChange(2);
      });

      expect(result.current.pageIndex).toBe(2);
    });

    it("calculates correct offset", () => {
      const { result } = renderHook(() => usePagination(10));

      act(() => {
        result.current.onPageChange(3);
      });

      expect(result.current.offset).toBe(30);
    });
  });

  describe("Page Size Change", () => {
    it("changes page size", () => {
      const { result } = renderHook(() => usePagination());

      act(() => {
        result.current.onPageSizeChange(20);
      });

      expect(result.current.pageSize).toBe(20);
      expect(result.current.limit).toBe(20);
    });

    it("resets to first page when page size changes", () => {
      const { result } = renderHook(() => usePagination());

      act(() => {
        result.current.onPageChange(3);
      });

      expect(result.current.pageIndex).toBe(3);

      act(() => {
        result.current.onPageSizeChange(20);
      });

      expect(result.current.pageIndex).toBe(0);
    });
  });

  describe("Reset Pagination", () => {
    it("resets to first page", () => {
      const { result } = renderHook(() => usePagination());

      act(() => {
        result.current.onPageChange(5);
      });

      expect(result.current.pageIndex).toBe(5);

      act(() => {
        result.current.resetPagination();
      });

      expect(result.current.pageIndex).toBe(0);
    });

    it("does not reset page size", () => {
      const { result } = renderHook(() => usePagination(25));

      act(() => {
        result.current.onPageChange(5);
        result.current.resetPagination();
      });

      expect(result.current.pageSize).toBe(25);
    });
  });

  describe("Offset Calculation", () => {
    it("calculates offset for first page", () => {
      const { result } = renderHook(() => usePagination(10));

      expect(result.current.offset).toBe(0);
    });

    it("calculates offset for subsequent pages", () => {
      const { result } = renderHook(() => usePagination(10));

      act(() => {
        result.current.onPageChange(1);
      });

      expect(result.current.offset).toBe(10);

      act(() => {
        result.current.onPageChange(2);
      });

      expect(result.current.offset).toBe(20);
    });

    it("recalculates offset when page size changes", () => {
      const { result } = renderHook(() => usePagination(10));

      act(() => {
        result.current.onPageChange(2);
      });

      expect(result.current.offset).toBe(20);

      act(() => {
        result.current.onPageSizeChange(25);
      });

      // After page size change, resets to page 0
      expect(result.current.offset).toBe(0);
    });
  });

  describe("Real-World Usage", () => {
    it("handles typical pagination flow", () => {
      const { result } = renderHook(() => usePagination(10));

      // Start at page 0
      expect(result.current.pageIndex).toBe(0);
      expect(result.current.offset).toBe(0);
      expect(result.current.limit).toBe(10);

      // Navigate to page 2
      act(() => {
        result.current.onPageChange(2);
      });

      expect(result.current.pageIndex).toBe(2);
      expect(result.current.offset).toBe(20);

      // Change page size
      act(() => {
        result.current.onPageSizeChange(50);
      });

      expect(result.current.pageIndex).toBe(0);
      expect(result.current.pageSize).toBe(50);
      expect(result.current.offset).toBe(0);
    });

    it("integrates with TablePagination component", () => {
      const Wrapper = () => {
        const pagination = usePagination(10);

        return (
          <TablePagination
            pageIndex={pagination.pageIndex}
            pageSize={pagination.pageSize}
            pageCount={10}
            onPageChange={pagination.onPageChange}
            onPageSizeChange={pagination.onPageSizeChange}
            totalItems={100}
          />
        );
      };

      render(<Wrapper />);

      expect(screen.getByText("Showing 1 to 10 of 100 results")).toBeInTheDocument();
    });
  });
});
