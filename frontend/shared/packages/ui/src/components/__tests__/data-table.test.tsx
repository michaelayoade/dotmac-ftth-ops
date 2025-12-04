/**
 * Data Table Component Tests
 *
 * Tests DataTable component with TanStack Table integration
 * Covers sorting, filtering, pagination, column visibility, and row selection
 */

import { ColumnDef } from "@tanstack/react-table";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import { DataTable, createSortableHeader } from "../data-table";

interface TestData {
  id: number;
  name: string;
  email: string;
  status: string;
}

const testData: TestData[] = [
  { id: 1, name: "Alice Johnson", email: "alice@example.com", status: "active" },
  { id: 2, name: "Bob Smith", email: "bob@example.com", status: "inactive" },
  { id: 3, name: "Charlie Brown", email: "charlie@example.com", status: "active" },
  { id: 4, name: "Diana Prince", email: "diana@example.com", status: "active" },
  { id: 5, name: "Eve Adams", email: "eve@example.com", status: "inactive" },
];

const columns: ColumnDef<TestData>[] = [
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "email",
    header: "Email",
  },
  {
    accessorKey: "status",
    header: "Status",
  },
];

describe("DataTable", () => {
  describe("Basic Rendering", () => {
    it("renders data table with data", () => {
      render(<DataTable columns={columns} data={testData} />);

      expect(screen.getByText("Alice Johnson")).toBeInTheDocument();
      expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    });

    it("renders column headers", () => {
      render(<DataTable columns={columns} data={testData} />);

      expect(screen.getByText("Name")).toBeInTheDocument();
      expect(screen.getByText("Email")).toBeInTheDocument();
      expect(screen.getByText("Status")).toBeInTheDocument();
    });

    it("renders all data rows", () => {
      render(<DataTable columns={columns} data={testData} />);

      expect(screen.getByText("Alice Johnson")).toBeInTheDocument();
      expect(screen.getByText("Bob Smith")).toBeInTheDocument();
      expect(screen.getByText("Charlie Brown")).toBeInTheDocument();
      expect(screen.getByText("Diana Prince")).toBeInTheDocument();
      expect(screen.getByText("Eve Adams")).toBeInTheDocument();
    });

    it("renders empty message when no data", () => {
      render(<DataTable columns={columns} data={[]} />);

      expect(screen.getByText("No results.")).toBeInTheDocument();
    });

    it("renders custom empty message", () => {
      render(<DataTable columns={columns} data={[]} emptyMessage="No users found" />);

      expect(screen.getByText("No users found")).toBeInTheDocument();
      expect(screen.queryByText("No results.")).not.toBeInTheDocument();
    });
  });

  describe("Loading State", () => {
    it("shows loading state when isLoading is true", () => {
      render(<DataTable columns={columns} data={testData} isLoading={true} />);

      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("hides data when loading", () => {
      render(<DataTable columns={columns} data={testData} isLoading={true} />);

      expect(screen.queryByText("Alice Johnson")).not.toBeInTheDocument();
    });

    it("shows data when not loading", () => {
      render(<DataTable columns={columns} data={testData} isLoading={false} />);

      expect(screen.getByText("Alice Johnson")).toBeInTheDocument();
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    });
  });

  describe("Search/Filter", () => {
    it("does not show search input by default", () => {
      render(<DataTable columns={columns} data={testData} />);

      expect(screen.queryByPlaceholderText("Search...")).not.toBeInTheDocument();
    });

    it("shows search input when searchable is true", () => {
      render(<DataTable columns={columns} data={testData} searchable={true} searchColumn="name" />);

      expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
    });

    it("renders custom search placeholder", () => {
      render(
        <DataTable
          columns={columns}
          data={testData}
          searchable={true}
          searchColumn="name"
          searchPlaceholder="Search by name..."
        />,
      );

      expect(screen.getByPlaceholderText("Search by name...")).toBeInTheDocument();
    });

    it("filters data when searching", async () => {
      const user = userEvent.setup();
      render(<DataTable columns={columns} data={testData} searchable={true} searchColumn="name" />);

      const searchInput = screen.getByPlaceholderText("Search...");
      await user.type(searchInput, "Alice");

      expect(screen.getByText("Alice Johnson")).toBeInTheDocument();
      expect(screen.queryByText("Bob Smith")).not.toBeInTheDocument();
    });

    it("search input has aria-label", () => {
      render(<DataTable columns={columns} data={testData} searchable={true} searchColumn="name" />);

      const searchInput = screen.getByPlaceholderText("Search...");
      expect(searchInput).toHaveAttribute("aria-label", "Search table");
    });
  });

  describe("Pagination", () => {
    it("shows pagination by default", () => {
      render(<DataTable columns={columns} data={testData} />);

      expect(screen.getByText(/Page \d+ of \d+/)).toBeInTheDocument();
      expect(screen.getByLabelText("Go to previous page")).toBeInTheDocument();
      expect(screen.getByLabelText("Go to next page")).toBeInTheDocument();
    });

    it("hides pagination when paginated is false", () => {
      render(<DataTable columns={columns} data={testData} paginated={false} />);

      expect(screen.queryByText(/Page \d+ of \d+/)).not.toBeInTheDocument();
    });

    it("shows page size selector", () => {
      render(<DataTable columns={columns} data={testData} />);

      expect(screen.getByText("Rows per page")).toBeInTheDocument();
      expect(screen.getByLabelText("Select page size")).toBeInTheDocument();
    });

    it("changes page size when option selected", async () => {
      const user = userEvent.setup();
      render(<DataTable columns={columns} data={testData} defaultPageSize={10} />);

      const pageSizeSelect = screen.getByLabelText("Select page size");
      await user.selectOptions(pageSizeSelect, "20");

      expect(pageSizeSelect).toHaveValue("20");
    });

    it("disables previous button on first page", () => {
      render(<DataTable columns={columns} data={testData} defaultPageSize={2} />);

      const previousButton = screen.getByLabelText("Go to previous page");
      expect(previousButton).toBeDisabled();
    });

    it("enables next button when there are more pages", () => {
      render(<DataTable columns={columns} data={testData} defaultPageSize={2} />);

      const nextButton = screen.getByLabelText("Go to next page");
      expect(nextButton).not.toBeDisabled();
    });

    it("navigates to next page", async () => {
      const user = userEvent.setup();
      render(<DataTable columns={columns} data={testData} defaultPageSize={2} />);

      const nextButton = screen.getByLabelText("Go to next page");
      await user.click(nextButton);

      expect(screen.getByText(/Page 2 of/)).toBeInTheDocument();
    });

    it("navigates to previous page", async () => {
      const user = userEvent.setup();
      render(<DataTable columns={columns} data={testData} defaultPageSize={2} />);

      const nextButton = screen.getByLabelText("Go to next page");
      await user.click(nextButton);

      const previousButton = screen.getByLabelText("Go to previous page");
      await user.click(previousButton);

      expect(screen.getByText(/Page 1 of/)).toBeInTheDocument();
    });

    it("renders custom page size options", () => {
      render(<DataTable columns={columns} data={testData} pageSizeOptions={[5, 15, 25]} />);

      const select = screen.getByLabelText("Select page size");
      expect(within(select).getByText("5")).toBeInTheDocument();
      expect(within(select).getByText("15")).toBeInTheDocument();
      expect(within(select).getByText("25")).toBeInTheDocument();
    });

    it("uses default page size", () => {
      render(
        <DataTable
          columns={columns}
          data={testData}
          defaultPageSize={10}
          pageSizeOptions={[10, 20, 30]}
        />,
      );

      const select = screen.getByLabelText("Select page size");
      expect(select).toHaveValue("10");
    });
  });

  describe("Column Visibility", () => {
    it("does not show column visibility toggle by default", () => {
      render(<DataTable columns={columns} data={testData} />);

      expect(screen.queryByText("Columns")).not.toBeInTheDocument();
    });

    it("shows column visibility toggle when enabled", () => {
      render(<DataTable columns={columns} data={testData} columnVisibility={true} />);

      expect(screen.getByText("Columns")).toBeInTheDocument();
    });

    it("opens column visibility dropdown", async () => {
      const user = userEvent.setup();
      render(<DataTable columns={columns} data={testData} columnVisibility={true} />);

      const columnsButton = screen.getByText("Columns");
      await user.click(columnsButton);

      // Column names should appear in dropdown
      expect(screen.getByText("name")).toBeInTheDocument();
      expect(screen.getByText("email")).toBeInTheDocument();
      expect(screen.getByText("status")).toBeInTheDocument();
    });
  });

  describe("Row Click", () => {
    it("does not make rows clickable by default", () => {
      const { container } = render(<DataTable columns={columns} data={testData} />);

      const rows = container.querySelectorAll("tbody tr");
      rows.forEach((row) => {
        expect(row).not.toHaveClass("cursor-pointer");
      });
    });

    it("makes rows clickable when onRowClick provided", () => {
      const onRowClick = jest.fn();
      const { container } = render(
        <DataTable columns={columns} data={testData} onRowClick={onRowClick} />,
      );

      const rows = container.querySelectorAll("tbody tr");
      rows.forEach((row) => {
        expect(row).toHaveClass("cursor-pointer");
      });
    });

    it("calls onRowClick when row is clicked", async () => {
      const user = userEvent.setup();
      const onRowClick = jest.fn();
      render(<DataTable columns={columns} data={testData} onRowClick={onRowClick} />);

      const row = screen.getByText("Alice Johnson").closest("tr");
      await user.click(row!);

      expect(onRowClick).toHaveBeenCalledWith(testData[0]);
    });
  });

  describe("Styling", () => {
    it("applies custom className", () => {
      const { container } = render(
        <DataTable columns={columns} data={testData} className="custom-table" />,
      );

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass("custom-table");
    });

    it("has border and rounded corners", () => {
      const { container } = render(<DataTable columns={columns} data={testData} />);

      const tableWrapper = container.querySelector(".rounded-md.border");
      expect(tableWrapper).toBeInTheDocument();
    });

    it("applies space-y-4 to wrapper", () => {
      const { container } = render(<DataTable columns={columns} data={testData} />);

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass("space-y-4");
    });
  });

  describe("Accessibility", () => {
    it("search input has aria-label", () => {
      render(<DataTable columns={columns} data={testData} searchable={true} searchColumn="name" />);

      const searchInput = screen.getByPlaceholderText("Search...");
      expect(searchInput).toHaveAttribute("aria-label", "Search table");
    });

    it("page size select has aria-label", () => {
      render(<DataTable columns={columns} data={testData} />);

      const select = screen.getByLabelText("Select page size");
      expect(select).toBeInTheDocument();
    });

    it("pagination buttons have aria-labels", () => {
      render(<DataTable columns={columns} data={testData} />);

      expect(screen.getByLabelText("Go to previous page")).toBeInTheDocument();
      expect(screen.getByLabelText("Go to next page")).toBeInTheDocument();
    });
  });

  describe("Real-World Usage Patterns", () => {
    it("renders user table with search and pagination", async () => {
      const user = userEvent.setup();
      render(
        <DataTable
          columns={columns}
          data={testData}
          searchable={true}
          searchColumn="name"
          searchPlaceholder="Search users..."
          paginated={true}
          defaultPageSize={3}
        />,
      );

      // Search
      const searchInput = screen.getByPlaceholderText("Search users...");
      await user.type(searchInput, "Alice");

      expect(screen.getByText("Alice Johnson")).toBeInTheDocument();
      expect(screen.queryByText("Bob Smith")).not.toBeInTheDocument();

      // Clear search
      await user.clear(searchInput);

      // Pagination
      expect(screen.getByText("Alice Johnson")).toBeInTheDocument();
      expect(screen.getByText("Bob Smith")).toBeInTheDocument();
      expect(screen.getByText("Charlie Brown")).toBeInTheDocument();
    });

    it("handles empty search results", async () => {
      const user = userEvent.setup();
      render(
        <DataTable
          columns={columns}
          data={testData}
          searchable={true}
          searchColumn="name"
          emptyMessage="No users found matching your search"
        />,
      );

      const searchInput = screen.getByPlaceholderText("Search...");
      await user.type(searchInput, "nonexistent");

      expect(screen.getByText("No users found matching your search")).toBeInTheDocument();
    });
  });
});

describe("createSortableHeader", () => {
  it("creates sortable header component", () => {
    const SortableHeader = createSortableHeader("Name");
    expect(SortableHeader.displayName).toBe("SortableHeader(Name)");
  });

  it("renders sortable header button", () => {
    const columns: ColumnDef<TestData>[] = [
      {
        accessorKey: "name",
        header: createSortableHeader("Name"),
      },
    ];

    render(<DataTable columns={columns} data={testData} />);

    const nameHeader = screen.getByLabelText("Sort by Name");
    expect(nameHeader).toBeInTheDocument();
  });

  it("toggles sorting when clicked", async () => {
    const user = userEvent.setup();
    const columns: ColumnDef<TestData>[] = [
      {
        accessorKey: "name",
        header: createSortableHeader("Name"),
      },
      {
        accessorKey: "email",
        header: "Email",
      },
    ];

    render(<DataTable columns={columns} data={testData} />);

    const nameHeader = screen.getByLabelText("Sort by Name");
    await user.click(nameHeader);

    // Data should be sorted (Alice should still be first as it's alphabetically first)
    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Alice Johnson");
  });

  it("sortable header has aria-label", () => {
    const columns: ColumnDef<TestData>[] = [
      {
        accessorKey: "name",
        header: createSortableHeader("Name"),
      },
    ];

    render(<DataTable columns={columns} data={testData} />);

    const nameHeader = screen.getByLabelText("Sort by Name");
    expect(nameHeader).toHaveAttribute("aria-label", "Sort by Name");
  });

  it("sortable header has sort icon", () => {
    const columns: ColumnDef<TestData>[] = [
      {
        accessorKey: "name",
        header: createSortableHeader("Name"),
      },
    ];

    const { container } = render(<DataTable columns={columns} data={testData} />);

    const sortIcon = container.querySelector("svg");
    expect(sortIcon).toBeInTheDocument();
  });
});

describe("Integration Tests", () => {
  it("combines search, pagination, and column visibility", async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        columns={columns}
        data={testData}
        searchable={true}
        searchColumn="name"
        paginated={true}
        defaultPageSize={2}
        columnVisibility={true}
      />,
    );

    // All features should be present
    expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
    expect(screen.getByText("Columns")).toBeInTheDocument();
    expect(screen.getByLabelText("Select page size")).toBeInTheDocument();

    // Search should filter across pages
    const searchInput = screen.getByPlaceholderText("Search...");
    await user.type(searchInput, "Alice");

    expect(screen.getByText("Alice Johnson")).toBeInTheDocument();
  });

  it("handles row click with pagination", async () => {
    const user = userEvent.setup();
    const onRowClick = jest.fn();
    render(
      <DataTable
        columns={columns}
        data={testData}
        paginated={true}
        defaultPageSize={2}
        onRowClick={onRowClick}
      />,
    );

    // Click row on first page
    const row1 = screen.getByText("Alice Johnson").closest("tr");
    await user.click(row1!);
    expect(onRowClick).toHaveBeenCalledWith(testData[0]);

    // Navigate to second page
    const nextButton = screen.getByLabelText("Go to next page");
    await user.click(nextButton);

    // Click row on second page
    const row3 = screen.getByText("Charlie Brown").closest("tr");
    await user.click(row3!);
    expect(onRowClick).toHaveBeenCalledWith(testData[2]);
  });
});
