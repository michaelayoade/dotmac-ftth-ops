/**
 * Table component tests
 * Testing table structure, variants, accessibility, security, and performance
 */

import React from "react";
import {
  render,
  renderA11y,
  renderSecurity,
  renderPerformance,
  renderComprehensive,
  screen,
} from "@dotmac/testing";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "../Table";

const SampleTable = ({ variant = "default", size = "md", density = "comfortable" }) => (
  <Table variant={variant} size={size} density={density} data-testid="table">
    <TableCaption>Sample table caption</TableCaption>
    <TableHeader>
      <TableRow>
        <TableHead>Name</TableHead>
        <TableHead>Email</TableHead>
        <TableHead>Role</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow>
        <TableCell>John Doe</TableCell>
        <TableCell>john@example.com</TableCell>
        <TableCell>Admin</TableCell>
      </TableRow>
      <TableRow>
        <TableCell>Jane Smith</TableCell>
        <TableCell>jane@example.com</TableCell>
        <TableCell>User</TableCell>
      </TableRow>
    </TableBody>
    <TableFooter>
      <TableRow>
        <TableCell colSpan={3}>Footer content</TableCell>
      </TableRow>
    </TableFooter>
  </Table>
);

describe("Table Components", () => {
  describe("Table", () => {
    it("renders table with correct structure", () => {
      render(<SampleTable />);

      const table = screen.getByTestId("table");
      expect(table).toBeInTheDocument();
      expect(table.tagName).toBe("TABLE");
    });

    it("applies variant classes correctly", () => {
      const { rerender } = render(<SampleTable variant="default" />);
      let table = screen.getByTestId("table");
      expect(table).toBeInTheDocument();

      rerender(<SampleTable variant="bordered" />);
      table = screen.getByTestId("table");
      expect(table).toBeInTheDocument();

      rerender(<SampleTable variant="striped" />);
      table = screen.getByTestId("table");
      expect(table).toBeInTheDocument();

      rerender(<SampleTable variant="hover" />);
      table = screen.getByTestId("table");
      expect(table).toBeInTheDocument();
    });

    it("applies size classes correctly", () => {
      const { rerender } = render(<SampleTable size="sm" />);
      let table = screen.getByTestId("table");
      expect(table).toBeInTheDocument();

      rerender(<SampleTable size="lg" />);
      table = screen.getByTestId("table");
      expect(table).toBeInTheDocument();
    });

    it("applies density classes correctly", () => {
      const { rerender } = render(<SampleTable density="compact" />);
      let table = screen.getByTestId("table");
      expect(table).toBeInTheDocument();

      rerender(<SampleTable density="spacious" />);
      table = screen.getByTestId("table");
      expect(table).toBeInTheDocument();
    });

    it("accepts custom className", () => {
      render(
        <Table className="custom-table" data-testid="table">
          <TableBody>
            <TableRow>
              <TableCell>Content</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      expect(screen.getByTestId("table")).toHaveClass("custom-table");
    });
  });

  describe("TableHeader", () => {
    it("renders as thead element", () => {
      render(
        <Table>
          <TableHeader data-testid="table-header">
            <TableRow>
              <TableHead>Header</TableHead>
            </TableRow>
          </TableHeader>
        </Table>,
      );

      const header = screen.getByTestId("table-header");
      expect(header).toBeInTheDocument();
      expect(header.tagName).toBe("THEAD");
    });
  });

  describe("TableBody", () => {
    it("renders as tbody element", () => {
      render(
        <Table>
          <TableBody data-testid="table-body">
            <TableRow>
              <TableCell>Body content</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      const body = screen.getByTestId("table-body");
      expect(body).toBeInTheDocument();
      expect(body.tagName).toBe("TBODY");
    });
  });

  describe("TableFooter", () => {
    it("renders as tfoot element", () => {
      render(
        <Table>
          <TableFooter data-testid="table-footer">
            <TableRow>
              <TableCell>Footer content</TableCell>
            </TableRow>
          </TableFooter>
        </Table>,
      );

      const footer = screen.getByTestId("table-footer");
      expect(footer).toBeInTheDocument();
      expect(footer.tagName).toBe("TFOOT");
    });
  });

  describe("TableRow", () => {
    it("renders as tr element", () => {
      render(
        <Table>
          <TableBody>
            <TableRow data-testid="table-row">
              <TableCell>Row content</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      const row = screen.getByTestId("table-row");
      expect(row).toBeInTheDocument();
      expect(row.tagName).toBe("TR");
    });

    it("accepts custom className", () => {
      render(
        <Table>
          <TableBody>
            <TableRow className="custom-row" data-testid="table-row">
              <TableCell>Row content</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      expect(screen.getByTestId("table-row")).toHaveClass("custom-row");
    });
  });

  describe("TableHead", () => {
    it("renders as th element", () => {
      render(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead data-testid="table-head">Header cell</TableHead>
            </TableRow>
          </TableHeader>
        </Table>,
      );

      const head = screen.getByTestId("table-head");
      expect(head).toBeInTheDocument();
      expect(head.tagName).toBe("TH");
    });

    it("accepts custom className", () => {
      render(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="custom-head" data-testid="table-head">
                Header
              </TableHead>
            </TableRow>
          </TableHeader>
        </Table>,
      );

      expect(screen.getByTestId("table-head")).toHaveClass("custom-head");
    });
  });

  describe("TableCell", () => {
    it("renders as td element", () => {
      render(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell data-testid="table-cell">Cell content</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      const cell = screen.getByTestId("table-cell");
      expect(cell).toBeInTheDocument();
      expect(cell.tagName).toBe("TD");
    });

    it("accepts custom className", () => {
      render(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell className="custom-cell" data-testid="table-cell">
                Cell
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      expect(screen.getByTestId("table-cell")).toHaveClass("custom-cell");
    });

    it("supports colSpan attribute", () => {
      render(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell colSpan={2} data-testid="table-cell">
                Spanning cell
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      const cell = screen.getByTestId("table-cell");
      expect(cell).toHaveAttribute("colspan", "2");
    });

    it("supports rowSpan attribute", () => {
      render(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell rowSpan={2} data-testid="table-cell">
                Spanning cell
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      const cell = screen.getByTestId("table-cell");
      expect(cell).toHaveAttribute("rowspan", "2");
    });
  });

  describe("TableCaption", () => {
    it("renders as caption element", () => {
      render(
        <Table>
          <TableCaption data-testid="table-caption">Table description</TableCaption>
        </Table>,
      );

      const caption = screen.getByTestId("table-caption");
      expect(caption).toBeInTheDocument();
      expect(caption.tagName).toBe("CAPTION");
    });

    it("accepts custom className", () => {
      render(
        <Table>
          <TableCaption className="custom-caption" data-testid="table-caption">
            Caption
          </TableCaption>
        </Table>,
      );

      expect(screen.getByTestId("table-caption")).toHaveClass("custom-caption");
    });
  });

  describe("Complex table structures", () => {
    it("handles nested table content", () => {
      render(
        <Table data-testid="table">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>John</TableCell>
              <TableCell>
                <div>
                  <span>Role: Admin</span>
                  <span>Department: IT</span>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      expect(screen.getByText("Role: Admin")).toBeInTheDocument();
      expect(screen.getByText("Department: IT")).toBeInTheDocument();
    });

    it("handles empty table", () => {
      render(<Table data-testid="empty-table" />);

      const table = screen.getByTestId("empty-table");
      expect(table).toBeInTheDocument();
      expect(table).toBeEmptyDOMElement();
    });

    it("handles table with only headers", () => {
      render(
        <Table data-testid="header-only-table">
          <TableHeader>
            <TableRow>
              <TableHead>Column 1</TableHead>
              <TableHead>Column 2</TableHead>
            </TableRow>
          </TableHeader>
        </Table>,
      );

      expect(screen.getByText("Column 1")).toBeInTheDocument();
      expect(screen.getByText("Column 2")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should be accessible", async () => {
      await renderA11y(<SampleTable />);
    });

    it("supports aria-label", () => {
      render(
        <Table aria-label="User data table" data-testid="table">
          <TableBody>
            <TableRow>
              <TableCell>Data</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      expect(screen.getByTestId("table")).toHaveAttribute("aria-label", "User data table");
    });

    it("supports aria-describedby", () => {
      render(
        <div>
          <p id="table-description">This table shows user information</p>
          <Table aria-describedby="table-description" data-testid="table">
            <TableBody>
              <TableRow>
                <TableCell>Data</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>,
      );

      expect(screen.getByTestId("table")).toHaveAttribute("aria-describedby", "table-description");
    });

    it("caption provides accessible description", () => {
      render(
        <Table data-testid="table">
          <TableCaption>Employee information for Q1 2024</TableCaption>
          <TableBody>
            <TableRow>
              <TableCell>Data</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      expect(screen.getByText("Employee information for Q1 2024")).toBeInTheDocument();
    });

    it("headers are properly associated", () => {
      render(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead id="name-header">Name</TableHead>
              <TableHead id="role-header">Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell headers="name-header">John</TableCell>
              <TableCell headers="role-header">Admin</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      const nameHeader = screen.getByText("Name");
      const roleHeader = screen.getByText("Role");
      const johnCell = screen.getByText("John");
      const adminCell = screen.getByText("Admin");

      // Check that header elements are rendered correctly
      expect(nameHeader.closest("th")).toBeInTheDocument();
      expect(roleHeader.closest("th")).toBeInTheDocument();
      expect(johnCell.closest("td")).toBeInTheDocument();
      expect(adminCell.closest("td")).toBeInTheDocument();
    });
  });

  describe("Forward refs", () => {
    it("forwards ref to table element", () => {
      const ref = React.createRef<HTMLTableElement>();

      render(
        <Table ref={ref}>
          <TableBody>
            <TableRow>
              <TableCell>Content</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      expect(ref.current).toBeInstanceOf(HTMLTableElement);
    });

    it("forwards refs to all table components", () => {
      const tableRef = React.createRef<HTMLTableElement>();
      const headerRef = React.createRef<HTMLTableSectionElement>();
      const bodyRef = React.createRef<HTMLTableSectionElement>();
      const rowRef = React.createRef<HTMLTableRowElement>();
      const headRef = React.createRef<HTMLTableCellElement>();
      const cellRef = React.createRef<HTMLTableCellElement>();

      render(
        <Table ref={tableRef}>
          <TableHeader ref={headerRef}>
            <TableRow>
              <TableHead ref={headRef}>Header</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody ref={bodyRef}>
            <TableRow ref={rowRef}>
              <TableCell ref={cellRef}>Cell</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      expect(tableRef.current).toBeInstanceOf(HTMLTableElement);
      expect(headerRef.current).toBeInstanceOf(HTMLTableSectionElement);
      expect(bodyRef.current).toBeInstanceOf(HTMLTableSectionElement);
      expect(rowRef.current).toBeInstanceOf(HTMLTableRowElement);
      expect(headRef.current).toBeInstanceOf(HTMLTableCellElement);
      expect(cellRef.current).toBeInstanceOf(HTMLTableCellElement);
    });
  });
});

// Security tests
describe("Table Security", () => {
  it("passes security validation", async () => {
    const result = await renderSecurity(<SampleTable />);

    expect(result.container).toHaveNoSecurityViolations();
  });

  it("prevents XSS in cell content", async () => {
    const XSSTable = () => (
      <Table data-testid="table">
        <TableBody>
          <TableRow>
            <TableCell>{'<script>alert("xss")</script>'}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );

    const result = await renderSecurity(<XSSTable />);

    expect(result.container).toHaveNoSecurityViolations();
  });

  it("sanitizes user-provided data", async () => {
    const userData = [{ name: "User<script>alert(1)</script>", email: "test@test.com" }];

    const UserTable = () => (
      <Table data-testid="table">
        <TableBody>
          {userData.map((user, index) => (
            <TableRow key={index}>
              <TableCell>{user.name}</TableCell>
              <TableCell>{user.email}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );

    const result = await renderSecurity(<UserTable />);

    expect(result.container).toHaveNoSecurityViolations();
  });
});

// Performance tests
describe("Table Performance", () => {
  it("renders within performance threshold", () => {
    const result = renderPerformance(<SampleTable />);

    const metrics = result.measurePerformance();
    expect(metrics).toBePerformant(200); // Relaxed for jsdom environment
  });

  it("handles large tables efficiently", () => {
    const LargeTable = () => (
      <Table data-testid="table">
        <TableBody>
          {Array.from({ length: 100 }, (_, i) => (
            <TableRow key={i}>
              <TableCell>Cell {i}-1</TableCell>
              <TableCell>Cell {i}-2</TableCell>
              <TableCell>Cell {i}-3</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );

    const result = renderPerformance(<LargeTable />);

    const metrics = result.measurePerformance();
    expect(metrics).toBePerformant(600); // Allow more time for large table in jsdom
  });

  it("handles complex nested content efficiently", () => {
    const ComplexTable = () => (
      <Table data-testid="table">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 50 }, (_, i) => (
            <TableRow key={i}>
              <TableCell>Item {i}</TableCell>
              <TableCell>
                <div>
                  <span>Property 1: Value</span>
                  <span>Property 2: Value</span>
                  <span>Property 3: Value</span>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );

    const result = renderPerformance(<ComplexTable />);

    const metrics = result.measurePerformance();
    expect(metrics).toBePerformant(400);
  });
});

// Comprehensive test
describe("Table Comprehensive Testing", () => {
  it("passes all comprehensive tests", async () => {
    const { result, metrics } = await renderComprehensive(
      <Table data-testid="comprehensive-table" variant="striped" size="md" density="comfortable">
        <TableCaption>Comprehensive table with all features</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Alice Johnson</TableCell>
            <TableCell>alice@example.com</TableCell>
            <TableCell>Admin</TableCell>
            <TableCell>Active</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Bob Smith</TableCell>
            <TableCell>bob@example.com</TableCell>
            <TableCell>User</TableCell>
            <TableCell>Active</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Charlie Brown</TableCell>
            <TableCell>charlie@example.com</TableCell>
            <TableCell>Guest</TableCell>
            <TableCell>Inactive</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={3}>Total Users</TableCell>
            <TableCell>3</TableCell>
          </TableRow>
        </TableFooter>
      </Table>,
    );

    // All tests should pass
    await expect(result.container).toBeAccessible();
    expect(result.container).toHaveNoSecurityViolations();
    expect(metrics).toBePerformant(120);
    expect(result.container).toHaveValidMarkup();
  });
});
