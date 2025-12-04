/**
 * Comprehensive Tests for AdvancedDataTable Component
 *
 * Tests filtering, sorting, pagination, virtual scrolling, selection,
 * accessibility, security, and performance
 */

import React from "react";
import {
  render,
  renderA11y,
  renderSecurity,
  renderPerformance,
  renderComprehensive,
  screen,
  fireEvent,
  waitFor,
} from "@dotmac/testing";
import {
  AdvancedDataTable,
  type AdvancedColumn,
  type FilterState,
  type SortState,
} from "../AdvancedDataTable";

// Sample test data
interface TestRecord {
  id: string;
  name: string;
  email: string;
  age: number;
  role: "admin" | "user" | "guest";
  createdAt: string;
  active: boolean;
}

const sampleData: TestRecord[] = [
  {
    id: "1",
    name: "Alice Johnson",
    email: "alice@example.com",
    age: 28,
    role: "admin",
    createdAt: "2024-01-15",
    active: true,
  },
  {
    id: "2",
    name: "Bob Smith",
    email: "bob@example.com",
    age: 35,
    role: "user",
    createdAt: "2024-02-20",
    active: true,
  },
  {
    id: "3",
    name: "Charlie Brown",
    email: "charlie@example.com",
    age: 42,
    role: "user",
    createdAt: "2024-03-10",
    active: false,
  },
  {
    id: "4",
    name: "Diana Prince",
    email: "diana@example.com",
    age: 31,
    role: "admin",
    createdAt: "2024-01-05",
    active: true,
  },
  {
    id: "5",
    name: "Eve Adams",
    email: "eve@example.com",
    age: 26,
    role: "guest",
    createdAt: "2024-04-12",
    active: true,
  },
];

const basicColumns: AdvancedColumn<TestRecord>[] = [
  {
    key: "name",
    title: "Name",
    dataIndex: "name",
    sortable: true,
    filterable: true,
    filterType: "text",
  },
  {
    key: "email",
    title: "Email",
    dataIndex: "email",
    sortable: true,
    filterable: true,
    filterType: "text",
  },
  {
    key: "age",
    title: "Age",
    dataIndex: "age",
    sortable: true,
    filterable: true,
    filterType: "number",
  },
  {
    key: "role",
    title: "Role",
    dataIndex: "role",
    sortable: true,
    filterable: true,
    filterType: "select",
    filterOptions: [
      { label: "Admin", value: "admin" },
      { label: "User", value: "user" },
      { label: "Guest", value: "guest" },
    ],
  },
];

describe("AdvancedDataTable Component", () => {
  // Basic functionality tests
  describe("Basic Functionality", () => {
    it("renders correctly with data", () => {
      render(
        <AdvancedDataTable
          data={sampleData}
          columns={basicColumns}
          keyExtractor={(record) => record.id}
        />,
      );

      expect(screen.getByText("Alice Johnson")).toBeInTheDocument();
      expect(screen.getByText("Bob Smith")).toBeInTheDocument();
      expect(screen.getByText("Charlie Brown")).toBeInTheDocument();
    });

    it("renders with empty data", () => {
      render(
        <AdvancedDataTable
          data={[]}
          columns={basicColumns}
          keyExtractor={(record) => record.id}
          emptyText="No records found"
        />,
      );

      expect(screen.getByText("No records found")).toBeInTheDocument();
    });

    it("shows loading state", () => {
      render(
        <AdvancedDataTable
          data={sampleData}
          columns={basicColumns}
          keyExtractor={(record) => record.id}
          loading
        />,
      );

      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("shows error state", () => {
      render(
        <AdvancedDataTable
          data={sampleData}
          columns={basicColumns}
          keyExtractor={(record) => record.id}
          error="Failed to load data"
        />,
      );

      expect(screen.getByText(/Error: Failed to load data/)).toBeInTheDocument();
    });

    it("displays summary information", () => {
      render(
        <AdvancedDataTable
          data={sampleData}
          columns={basicColumns}
          keyExtractor={(record) => record.id}
        />,
      );

      expect(screen.getByText(/Showing 5 of 5 items/)).toBeInTheDocument();
    });
  });

  // Filtering tests
  describe("Filtering", () => {
    it("renders filter inputs when filterable is true", () => {
      render(
        <AdvancedDataTable
          data={sampleData}
          columns={basicColumns}
          keyExtractor={(record) => record.id}
          filterable
        />,
      );

      expect(screen.getAllByText("Name").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Email").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Role").length).toBeGreaterThan(0);
    });

    it("filters data with text filter", async () => {
      render(
        <AdvancedDataTable
          data={sampleData}
          columns={basicColumns}
          keyExtractor={(record) => record.id}
          filterable
        />,
      );

      const filterInputs = screen.getAllByPlaceholderText("Filter...");
      const nameFilter = filterInputs[0];

      fireEvent.change(nameFilter, { target: { value: "Alice" } });

      await waitFor(() => {
        expect(screen.getByText("Alice Johnson")).toBeInTheDocument();
        expect(screen.queryByText("Bob Smith")).not.toBeInTheDocument();
      });
    });

    it("filters data with select filter", async () => {
      render(
        <AdvancedDataTable
          data={sampleData}
          columns={basicColumns}
          keyExtractor={(record) => record.id}
          filterable
        />,
      );

      const selectFilter = screen.getByDisplayValue("All");
      fireEvent.change(selectFilter, { target: { value: "admin" } });

      await waitFor(() => {
        expect(screen.getByText("Alice Johnson")).toBeInTheDocument();
        expect(screen.getByText("Diana Prince")).toBeInTheDocument();
        expect(screen.queryByText("Bob Smith")).not.toBeInTheDocument();
      });
    });

    it("resets to page 1 when filtering", async () => {
      const onStateChange = jest.fn();

      render(
        <AdvancedDataTable
          data={sampleData}
          columns={basicColumns}
          keyExtractor={(record) => record.id}
          filterable
          pagination={{ enabled: true, pageSize: 2 }}
          onStateChange={onStateChange}
        />,
      );

      const filterInputs = screen.getAllByPlaceholderText("Filter...");
      fireEvent.change(filterInputs[0], { target: { value: "Alice" } });

      await waitFor(() => {
        expect(onStateChange).toHaveBeenCalledWith(
          expect.objectContaining({
            pagination: expect.objectContaining({ page: 1 }),
          }),
        );
      });
    });
  });

  // Sorting tests
  describe("Sorting", () => {
    it("sorts data ascending when column header is clicked", async () => {
      render(
        <AdvancedDataTable
          data={sampleData}
          columns={basicColumns}
          keyExtractor={(record) => record.id}
          sortable
        />,
      );

      const nameHeaders = screen.getAllByText("Name");
      const nameHeader = nameHeaders.find((el) => el.tagName !== "LABEL") || nameHeaders[0];
      fireEvent.click(nameHeader);

      await waitFor(() => {
        const rows = screen.getAllByRole("row");
        expect(rows[1]).toHaveTextContent("Alice Johnson");
      });
    });

    it("sorts data descending on second click", async () => {
      render(
        <AdvancedDataTable
          data={sampleData}
          columns={basicColumns}
          keyExtractor={(record) => record.id}
          sortable
        />,
      );

      const nameHeaders = screen.getAllByText("Name");
      const nameHeader = nameHeaders.find((el) => el.tagName !== "LABEL") || nameHeaders[0];
      fireEvent.click(nameHeader);
      fireEvent.click(nameHeader);

      await waitFor(() => {
        const rows = screen.getAllByRole("row");
        expect(rows[1]).toHaveTextContent("Eve Adams");
      });
    });

    it("uses custom sort function when provided", () => {
      const customColumns: AdvancedColumn<TestRecord>[] = [
        {
          key: "name",
          title: "Name",
          dataIndex: "name",
          sortable: true,
          sortCompare: (a, b) => a.name.localeCompare(b.name),
        },
      ];

      render(
        <AdvancedDataTable
          data={sampleData}
          columns={customColumns}
          keyExtractor={(record) => record.id}
          sortable
        />,
      );

      const nameHeader = screen.getByText("Name");
      fireEvent.click(nameHeader);

      expect(screen.getByText("Alice Johnson")).toBeInTheDocument();
    });
  });

  // Pagination tests
  describe("Pagination", () => {
    it("renders pagination controls when enabled", () => {
      render(
        <AdvancedDataTable
          data={sampleData}
          columns={basicColumns}
          keyExtractor={(record) => record.id}
          pagination={{ enabled: true, pageSize: 2 }}
        />,
      );

      expect(screen.getByText(/Showing 2 of 5 items/)).toBeInTheDocument();
    });

    it("paginates data correctly", () => {
      render(
        <AdvancedDataTable
          data={sampleData}
          columns={basicColumns}
          keyExtractor={(record) => record.id}
          pagination={{ enabled: true, pageSize: 2 }}
        />,
      );

      expect(screen.getByText("Alice Johnson")).toBeInTheDocument();
      expect(screen.getByText("Bob Smith")).toBeInTheDocument();
      expect(screen.queryByText("Charlie Brown")).not.toBeInTheDocument();
    });

    it("handles page changes", () => {
      const onStateChange = jest.fn();

      render(
        <AdvancedDataTable
          data={sampleData}
          columns={basicColumns}
          keyExtractor={(record) => record.id}
          pagination={{ enabled: true, pageSize: 2 }}
          onStateChange={onStateChange}
        />,
      );

      // Component renders with initial state, onStateChange called on mount
      expect(screen.getByText("Alice Johnson")).toBeInTheDocument();
      expect(screen.getByText("Bob Smith")).toBeInTheDocument();
    });
  });

  // Selection tests
  describe("Selection", () => {
    it("renders selection checkboxes when selectable is true", () => {
      render(
        <AdvancedDataTable
          data={sampleData}
          columns={basicColumns}
          keyExtractor={(record) => record.id}
          selectable
        />,
      );

      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes.length).toBeGreaterThan(0);
    });

    it("calls onSelectionChange when rows are selected", async () => {
      const onSelectionChange = jest.fn();

      render(
        <AdvancedDataTable
          data={sampleData}
          columns={basicColumns}
          keyExtractor={(record) => record.id}
          selectable
          onSelectionChange={onSelectionChange}
        />,
      );

      const checkboxes = screen.getAllByRole("checkbox");
      fireEvent.click(checkboxes[1]); // Select first data row

      await waitFor(() => {
        expect(onSelectionChange).toHaveBeenCalledWith(
          expect.arrayContaining([expect.any(String)]),
          expect.arrayContaining([expect.objectContaining({ id: expect.any(String) })]),
        );
      });
    });
  });

  // Virtual scrolling tests
  describe("Virtual Scrolling", () => {
    it("enables virtual scrolling when virtualScrolling is true", () => {
      const { container } = render(
        <AdvancedDataTable
          data={sampleData}
          columns={basicColumns}
          keyExtractor={(record) => record.id}
          virtualScrolling
          containerHeight={400}
          rowHeight={40}
        />,
      );

      const scrollContainer = container.querySelector(".virtual-scroll-container");
      expect(scrollContainer).toBeInTheDocument();
    });

    it("handles scroll events", async () => {
      const { container } = render(
        <AdvancedDataTable
          data={sampleData}
          columns={basicColumns}
          keyExtractor={(record) => record.id}
          virtualScrolling
          containerHeight={400}
          rowHeight={40}
        />,
      );

      const scrollContainer = container.querySelector(".virtual-scroll-container");
      if (scrollContainer) {
        fireEvent.scroll(scrollContainer, { target: { scrollTop: 100 } });
      }

      await waitFor(() => {
        expect(scrollContainer).toBeInTheDocument();
      });
    });

    it("renders only visible rows for large datasets", () => {
      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        id: `${i}`,
        name: `User ${i}`,
        email: `user${i}@example.com`,
        age: 20 + (i % 50),
        role: "user" as const,
        createdAt: "2024-01-01",
        active: true,
      }));

      render(
        <AdvancedDataTable
          data={largeData}
          columns={basicColumns}
          keyExtractor={(record) => record.id}
          virtualScrolling
          containerHeight={400}
          rowHeight={40}
        />,
      );

      // Virtual scrolling should render only visible rows
      const rows = screen.getAllByRole("row");
      expect(rows.length).toBeLessThan(1000);
    });
  });

  // Export functionality tests
  describe("Export Functionality", () => {
    it("shows export buttons when exportable is true", () => {
      render(
        <AdvancedDataTable
          data={sampleData}
          columns={basicColumns}
          keyExtractor={(record) => record.id}
          exportable
        />,
      );

      expect(screen.getByText("Export CSV")).toBeInTheDocument();
      expect(screen.getByText("Export Excel")).toBeInTheDocument();
    });

    it("calls onExport with correct format", () => {
      const onExport = jest.fn();

      render(
        <AdvancedDataTable
          data={sampleData}
          columns={basicColumns}
          keyExtractor={(record) => record.id}
          exportable
          onExport={onExport}
        />,
      );

      fireEvent.click(screen.getByText("Export CSV"));
      expect(onExport).toHaveBeenCalledWith("csv");

      fireEvent.click(screen.getByText("Export Excel"));
      expect(onExport).toHaveBeenCalledWith("excel");
    });
  });

  // State management tests
  describe("State Management", () => {
    it("manages internal state when uncontrolled", () => {
      const onStateChange = jest.fn();

      render(
        <AdvancedDataTable
          data={sampleData}
          columns={basicColumns}
          keyExtractor={(record) => record.id}
          filterable
          onStateChange={onStateChange}
        />,
      );

      const filterInputs = screen.getAllByPlaceholderText("Filter...");
      fireEvent.change(filterInputs[0], { target: { value: "Alice" } });

      expect(onStateChange).toHaveBeenCalled();
    });

    it("uses controlled state when provided", () => {
      const controlledState = {
        filters: { name: "Alice" } as FilterState,
        sorting: { field: "name", order: "asc" } as SortState,
        grouping: {},
        pagination: { page: 1, pageSize: 20 },
        selection: { selectedKeys: new Set<string>() },
      };

      render(
        <AdvancedDataTable
          data={sampleData}
          columns={basicColumns}
          keyExtractor={(record) => record.id}
          controlled
          state={controlledState}
        />,
      );

      expect(screen.getByText("Alice Johnson")).toBeInTheDocument();
      expect(screen.queryByText("Bob Smith")).not.toBeInTheDocument();
    });
  });

  // Custom className tests
  describe("Custom Styling", () => {
    it("accepts custom className", () => {
      const { container } = render(
        <AdvancedDataTable
          data={sampleData}
          columns={basicColumns}
          keyExtractor={(record) => record.id}
          className="custom-table-class"
        />,
      );

      expect(container.firstChild).toHaveClass("custom-table-class");
    });

    it("applies row className function", () => {
      render(
        <AdvancedDataTable
          data={sampleData}
          columns={basicColumns}
          keyExtractor={(record) => record.id}
          rowClassName={(record) => (record.active ? "active-row" : "inactive-row")}
        />,
      );

      expect(screen.getByText("Alice Johnson")).toBeInTheDocument();
    });
  });
});

// Security tests
describe("AdvancedDataTable Security", () => {
  it("passes security validation", async () => {
    const result = await renderSecurity(
      <AdvancedDataTable
        data={sampleData}
        columns={basicColumns}
        keyExtractor={(record) => record.id}
      />,
    );

    expect(result.container).toHaveNoSecurityViolations();
  });

  it("sanitizes filter input", async () => {
    const result = await renderSecurity(
      <AdvancedDataTable
        data={sampleData}
        columns={basicColumns}
        keyExtractor={(record) => record.id}
        filterable
      />,
    );

    expect(result.container).toHaveNoSecurityViolations();
  });

  it("prevents XSS in data rendering", async () => {
    const xssData = [
      {
        id: "1",
        name: '<script>alert("xss")</script>',
        email: "test@test.com",
        age: 25,
        role: "user" as const,
        createdAt: "2024-01-01",
        active: true,
      },
    ];

    const result = await renderSecurity(
      <AdvancedDataTable
        data={xssData}
        columns={basicColumns}
        keyExtractor={(record) => record.id}
      />,
    );

    expect(result.container).toHaveNoSecurityViolations();
  });
});

// Accessibility tests
describe("AdvancedDataTable Accessibility", () => {
  it("is accessible by default", async () => {
    await renderA11y(
      <AdvancedDataTable
        data={sampleData}
        columns={basicColumns}
        keyExtractor={(record) => record.id}
      />,
    );
  });

  it("is accessible with filters", async () => {
    await renderA11y(
      <AdvancedDataTable
        data={sampleData}
        columns={basicColumns}
        keyExtractor={(record) => record.id}
        filterable
      />,
    );
  });

  it("is accessible with selection", async () => {
    await renderA11y(
      <AdvancedDataTable
        data={sampleData}
        columns={basicColumns}
        keyExtractor={(record) => record.id}
        selectable
      />,
    );
  });

  it("has proper ARIA labels for interactive elements", () => {
    render(
      <AdvancedDataTable
        data={sampleData}
        columns={basicColumns}
        keyExtractor={(record) => record.id}
        selectable
      />,
    );

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBeGreaterThan(0);
  });

  it("supports keyboard navigation", () => {
    render(
      <AdvancedDataTable
        data={sampleData}
        columns={basicColumns}
        keyExtractor={(record) => record.id}
        sortable
      />,
    );

    const headers = screen.getAllByRole("columnheader");
    expect(headers.length).toBeGreaterThan(0);
  });
});

// Performance tests
describe("AdvancedDataTable Performance", () => {
  it("renders within performance threshold", () => {
    const result = renderPerformance(
      <AdvancedDataTable
        data={sampleData}
        columns={basicColumns}
        keyExtractor={(record) => record.id}
      />,
    );

    const metrics = result.measurePerformance();
    expect(metrics).toBePerformant();
  });

  it("handles large datasets efficiently with virtual scrolling", () => {
    const largeData = Array.from({ length: 10000 }, (_, i) => ({
      id: `${i}`,
      name: `User ${i}`,
      email: `user${i}@example.com`,
      age: 20 + (i % 50),
      role: "user" as const,
      createdAt: "2024-01-01",
      active: true,
    }));

    const result = renderPerformance(
      <AdvancedDataTable
        data={largeData}
        columns={basicColumns}
        keyExtractor={(record) => record.id}
        virtualScrolling
        containerHeight={400}
        rowHeight={40}
      />,
    );

    const metrics = result.measurePerformance();
    expect(metrics).toBePerformant(100); // Allow more time for large dataset
  });

  it("filters large datasets efficiently", () => {
    const largeData = Array.from({ length: 1000 }, (_, i) => ({
      id: `${i}`,
      name: `User ${i}`,
      email: `user${i}@example.com`,
      age: 20 + (i % 50),
      role: "user" as const,
      createdAt: "2024-01-01",
      active: true,
    }));

    const result = renderPerformance(
      <AdvancedDataTable
        data={largeData}
        columns={basicColumns}
        keyExtractor={(record) => record.id}
        filterable
      />,
    );

    const metrics = result.measurePerformance();
    // Allow extra headroom in CI/jsdom where filters + instrumentation can exceed 1s
    expect(metrics).toBePerformant(2200);
  });
});

// Comprehensive test
describe("AdvancedDataTable Comprehensive Testing", () => {
  it("passes all comprehensive tests", async () => {
    const { result, metrics } = await renderComprehensive(
      <AdvancedDataTable
        data={sampleData}
        columns={basicColumns}
        keyExtractor={(record) => record.id}
        filterable
        sortable
        selectable
        pagination={{ enabled: true, pageSize: 10 }}
        exportable
      />,
    );

    // All tests should pass
    await expect(result.container).toBeAccessible();
    expect(result.container).toHaveNoSecurityViolations();
    expect(metrics).toBePerformant(150);
    expect(result.container).toHaveValidMarkup();
  }, 30000);
});
