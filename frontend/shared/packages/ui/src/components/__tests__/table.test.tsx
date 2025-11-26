/**
 * Table Component Tests
 *
 * Tests shadcn/ui Table composition components
 */

import { render, screen } from "@testing-library/react";
import React from "react";

import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from "../table";

describe("Table Components", () => {
  describe("Table", () => {
    it("renders table element", () => {
      render(<Table />);

      expect(screen.getByRole("table")).toBeInTheDocument();
    });

    it("wraps table in scrollable container", () => {
      const { container } = render(<Table />);

      const wrapper = container.querySelector(".relative.w-full.overflow-auto");
      expect(wrapper).toBeInTheDocument();
    });

    it("applies base styles", () => {
      render(<Table data-testid="table" />);

      const table = screen.getByTestId("table");
      expect(table).toHaveClass("w-full", "caption-bottom", "text-sm");
    });

    it("supports custom className", () => {
      render(<Table className="custom-table" data-testid="table" />);

      const table = screen.getByTestId("table");
      expect(table).toHaveClass("custom-table");
    });

    it("renders children", () => {
      render(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell>Content</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      expect(screen.getByText("Content")).toBeInTheDocument();
    });
  });

  describe("TableHeader", () => {
    it("renders thead element", () => {
      const { container } = render(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Header</TableHead>
            </TableRow>
          </TableHeader>
        </Table>,
      );

      const thead = container.querySelector("thead");
      expect(thead).toBeInTheDocument();
    });

    it("applies border bottom", () => {
      render(
        <Table>
          <TableHeader data-testid="header">
            <TableRow>
              <TableHead>Header</TableHead>
            </TableRow>
          </TableHeader>
        </Table>,
      );

      const thead = screen.getByTestId("header");
      expect(thead).toHaveClass("border-b", "border-border");
    });

    it("supports custom className", () => {
      render(
        <Table>
          <TableHeader className="custom-header" data-testid="header">
            <TableRow>
              <TableHead>Header</TableHead>
            </TableRow>
          </TableHeader>
        </Table>,
      );

      const thead = screen.getByTestId("header");
      expect(thead).toHaveClass("custom-header");
    });
  });

  describe("TableBody", () => {
    it("renders tbody element", () => {
      const { container } = render(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell>Body</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      const tbody = container.querySelector("tbody");
      expect(tbody).toBeInTheDocument();
    });

    it("supports custom className", () => {
      render(
        <Table>
          <TableBody className="custom-body" data-testid="body">
            <TableRow>
              <TableCell>Body</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      const tbody = screen.getByTestId("body");
      expect(tbody).toHaveClass("custom-body");
    });

    it("renders multiple rows", () => {
      render(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell>Row 1</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Row 2</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Row 3</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      expect(screen.getByText("Row 1")).toBeInTheDocument();
      expect(screen.getByText("Row 2")).toBeInTheDocument();
      expect(screen.getByText("Row 3")).toBeInTheDocument();
    });
  });

  describe("TableFooter", () => {
    it("renders tfoot element", () => {
      const { container } = render(
        <Table>
          <TableFooter>
            <TableRow>
              <TableCell>Footer</TableCell>
            </TableRow>
          </TableFooter>
        </Table>,
      );

      const tfoot = container.querySelector("tfoot");
      expect(tfoot).toBeInTheDocument();
    });

    it("applies border top", () => {
      render(
        <Table>
          <TableFooter data-testid="footer">
            <TableRow>
              <TableCell>Footer</TableCell>
            </TableRow>
          </TableFooter>
        </Table>,
      );

      const tfoot = screen.getByTestId("footer");
      expect(tfoot).toHaveClass("border-t", "border-border");
    });

    it("supports custom className", () => {
      render(
        <Table>
          <TableFooter className="custom-footer" data-testid="footer">
            <TableRow>
              <TableCell>Footer</TableCell>
            </TableRow>
          </TableFooter>
        </Table>,
      );

      const tfoot = screen.getByTestId("footer");
      expect(tfoot).toHaveClass("custom-footer");
    });
  });

  describe("TableRow", () => {
    it("renders tr element", () => {
      const { container } = render(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell>Cell</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      const tr = container.querySelector("tr");
      expect(tr).toBeInTheDocument();
    });

    it("applies border and hover styles", () => {
      render(
        <Table>
          <TableBody>
            <TableRow data-testid="row">
              <TableCell>Cell</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      const row = screen.getByTestId("row");
      expect(row).toHaveClass("border-b", "transition-colors", "hover:bg-muted/50");
    });

    it("supports custom className", () => {
      render(
        <Table>
          <TableBody>
            <TableRow className="custom-row" data-testid="row">
              <TableCell>Cell</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      const row = screen.getByTestId("row");
      expect(row).toHaveClass("custom-row");
    });

    it("renders multiple cells", () => {
      render(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell>Cell 1</TableCell>
              <TableCell>Cell 2</TableCell>
              <TableCell>Cell 3</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      expect(screen.getByText("Cell 1")).toBeInTheDocument();
      expect(screen.getByText("Cell 2")).toBeInTheDocument();
      expect(screen.getByText("Cell 3")).toBeInTheDocument();
    });
  });

  describe("TableHead", () => {
    it("renders th element", () => {
      const { container } = render(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Column</TableHead>
            </TableRow>
          </TableHeader>
        </Table>,
      );

      const th = container.querySelector("th");
      expect(th).toBeInTheDocument();
    });

    it("applies header styles", () => {
      render(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead data-testid="head">Column</TableHead>
            </TableRow>
          </TableHeader>
        </Table>,
      );

      const head = screen.getByTestId("head");
      expect(head).toHaveClass("h-12", "px-4", "text-left", "align-middle", "font-medium");
    });

    it("supports custom className", () => {
      render(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="custom-head" data-testid="head">
                Column
              </TableHead>
            </TableRow>
          </TableHeader>
        </Table>,
      );

      const head = screen.getByTestId("head");
      expect(head).toHaveClass("custom-head");
    });

    it("renders column headings", () => {
      render(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
            </TableRow>
          </TableHeader>
        </Table>,
      );

      expect(screen.getByText("Name")).toBeInTheDocument();
      expect(screen.getByText("Email")).toBeInTheDocument();
      expect(screen.getByText("Role")).toBeInTheDocument();
    });
  });

  describe("TableCell", () => {
    it("renders td element", () => {
      const { container } = render(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell>Data</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      const td = container.querySelector("td");
      expect(td).toBeInTheDocument();
    });

    it("applies cell styles", () => {
      render(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell data-testid="cell">Data</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      const cell = screen.getByTestId("cell");
      expect(cell).toHaveClass("p-4", "align-middle");
    });

    it("supports custom className", () => {
      render(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell className="custom-cell" data-testid="cell">
                Data
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      const cell = screen.getByTestId("cell");
      expect(cell).toHaveClass("custom-cell");
    });

    it("renders cell content", () => {
      render(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell>John Doe</TableCell>
              <TableCell>john@example.com</TableCell>
              <TableCell>Admin</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("john@example.com")).toBeInTheDocument();
      expect(screen.getByText("Admin")).toBeInTheDocument();
    });
  });

  describe("TableCaption", () => {
    it("renders caption element", () => {
      const { container } = render(
        <Table>
          <TableCaption>A list of users</TableCaption>
          <TableBody>
            <TableRow>
              <TableCell>Data</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      const caption = container.querySelector("caption");
      expect(caption).toBeInTheDocument();
    });

    it("applies caption styles", () => {
      render(
        <Table>
          <TableCaption data-testid="caption">A list of users</TableCaption>
        </Table>,
      );

      const caption = screen.getByTestId("caption");
      expect(caption).toHaveClass("mt-4", "text-sm", "text-muted-foreground");
    });

    it("supports custom className", () => {
      render(
        <Table>
          <TableCaption className="custom-caption" data-testid="caption">
            A list of users
          </TableCaption>
        </Table>,
      );

      const caption = screen.getByTestId("caption");
      expect(caption).toHaveClass("custom-caption");
    });

    it("renders caption text", () => {
      render(
        <Table>
          <TableCaption>User Directory (100 users)</TableCaption>
        </Table>,
      );

      expect(screen.getByText("User Directory (100 users)")).toBeInTheDocument();
    });
  });

  describe("Ref Forwarding", () => {
    it("forwards ref to Table", () => {
      const ref = React.createRef<HTMLTableElement>();

      render(<Table ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLTableElement);
    });

    it("forwards ref to TableHeader", () => {
      const ref = React.createRef<HTMLTableSectionElement>();

      render(
        <Table>
          <TableHeader ref={ref}>
            <TableRow>
              <TableHead>Header</TableHead>
            </TableRow>
          </TableHeader>
        </Table>,
      );

      expect(ref.current).toBeInstanceOf(HTMLTableSectionElement);
    });

    it("forwards ref to TableBody", () => {
      const ref = React.createRef<HTMLTableSectionElement>();

      render(
        <Table>
          <TableBody ref={ref}>
            <TableRow>
              <TableCell>Body</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      expect(ref.current).toBeInstanceOf(HTMLTableSectionElement);
    });

    it("forwards ref to TableFooter", () => {
      const ref = React.createRef<HTMLTableSectionElement>();

      render(
        <Table>
          <TableFooter ref={ref}>
            <TableRow>
              <TableCell>Footer</TableCell>
            </TableRow>
          </TableFooter>
        </Table>,
      );

      expect(ref.current).toBeInstanceOf(HTMLTableSectionElement);
    });

    it("forwards ref to TableRow", () => {
      const ref = React.createRef<HTMLTableRowElement>();

      render(
        <Table>
          <TableBody>
            <TableRow ref={ref}>
              <TableCell>Cell</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      expect(ref.current).toBeInstanceOf(HTMLTableRowElement);
    });

    it("forwards ref to TableHead", () => {
      const ref = React.createRef<HTMLTableCellElement>();

      render(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead ref={ref}>Header</TableHead>
            </TableRow>
          </TableHeader>
        </Table>,
      );

      expect(ref.current).toBeInstanceOf(HTMLTableCellElement);
    });

    it("forwards ref to TableCell", () => {
      const ref = React.createRef<HTMLTableCellElement>();

      render(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell ref={ref}>Cell</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      expect(ref.current).toBeInstanceOf(HTMLTableCellElement);
    });

    it("forwards ref to TableCaption", () => {
      const ref = React.createRef<HTMLTableCaptionElement>();

      render(
        <Table>
          <TableCaption ref={ref}>Caption</TableCaption>
        </Table>,
      );

      expect(ref.current).toBeInstanceOf(HTMLTableCaptionElement);
    });
  });

  describe("Display Names", () => {
    it("Table has correct display name", () => {
      expect(Table.displayName).toBe("Table");
    });

    it("TableHeader has correct display name", () => {
      expect(TableHeader.displayName).toBe("TableHeader");
    });

    it("TableBody has correct display name", () => {
      expect(TableBody.displayName).toBe("TableBody");
    });

    it("TableFooter has correct display name", () => {
      expect(TableFooter.displayName).toBe("TableFooter");
    });

    it("TableRow has correct display name", () => {
      expect(TableRow.displayName).toBe("TableRow");
    });

    it("TableHead has correct display name", () => {
      expect(TableHead.displayName).toBe("TableHead");
    });

    it("TableCell has correct display name", () => {
      expect(TableCell.displayName).toBe("TableCell");
    });

    it("TableCaption has correct display name", () => {
      expect(TableCaption.displayName).toBe("TableCaption");
    });
  });

  describe("Real-World Usage Patterns", () => {
    it("renders user list table", () => {
      render(
        <Table>
          <TableCaption>User Directory</TableCaption>
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
        </Table>,
      );

      expect(screen.getByText("User Directory")).toBeInTheDocument();
      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    });

    it("renders product catalog table", () => {
      render(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Stock</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Widget</TableCell>
              <TableCell>$19.99</TableCell>
              <TableCell>100</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Gadget</TableCell>
              <TableCell>$29.99</TableCell>
              <TableCell>50</TableCell>
            </TableRow>
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2}>Total Items</TableCell>
              <TableCell>150</TableCell>
            </TableRow>
          </TableFooter>
        </Table>,
      );

      expect(screen.getByText("Widget")).toBeInTheDocument();
      expect(screen.getByText("$19.99")).toBeInTheDocument();
      expect(screen.getByText("Total Items")).toBeInTheDocument();
    });

    it("renders invoice table", () => {
      render(
        <Table>
          <TableCaption>Invoice #12345</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Service A</TableCell>
              <TableCell>2</TableCell>
              <TableCell>$50.00</TableCell>
              <TableCell>$100.00</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Service B</TableCell>
              <TableCell>1</TableCell>
              <TableCell>$75.00</TableCell>
              <TableCell>$75.00</TableCell>
            </TableRow>
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3}>Grand Total</TableCell>
              <TableCell>$175.00</TableCell>
            </TableRow>
          </TableFooter>
        </Table>,
      );

      expect(screen.getByText("Invoice #12345")).toBeInTheDocument();
      expect(screen.getByText("Service A")).toBeInTheDocument();
      expect(screen.getByText("Grand Total")).toBeInTheDocument();
      expect(screen.getByText("$175.00")).toBeInTheDocument();
    });

    it("renders data comparison table", () => {
      render(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Feature</TableHead>
              <TableHead>Free</TableHead>
              <TableHead>Pro</TableHead>
              <TableHead>Enterprise</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Users</TableCell>
              <TableCell>5</TableCell>
              <TableCell>25</TableCell>
              <TableCell>Unlimited</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Storage</TableCell>
              <TableCell>1 GB</TableCell>
              <TableCell>100 GB</TableCell>
              <TableCell>Unlimited</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      expect(screen.getByText("Free")).toBeInTheDocument();
      expect(screen.getByText("Pro")).toBeInTheDocument();
      expect(screen.getByText("Enterprise")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("table has proper role", () => {
      render(<Table />);

      expect(screen.getByRole("table")).toBeInTheDocument();
    });

    it("uses semantic table elements", () => {
      const { container } = render(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Header</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Cell</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      expect(container.querySelector("thead")).toBeInTheDocument();
      expect(container.querySelector("tbody")).toBeInTheDocument();
      expect(container.querySelector("th")).toBeInTheDocument();
      expect(container.querySelector("td")).toBeInTheDocument();
    });

    it("caption provides table description", () => {
      render(
        <Table>
          <TableCaption>Employee Roster</TableCaption>
        </Table>,
      );

      expect(screen.getByText("Employee Roster")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("handles empty table", () => {
      render(<Table />);

      expect(screen.getByRole("table")).toBeInTheDocument();
    });

    it("handles table with only header", () => {
      render(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Column</TableHead>
            </TableRow>
          </TableHeader>
        </Table>,
      );

      expect(screen.getByText("Column")).toBeInTheDocument();
    });

    it("handles table with only body", () => {
      render(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell>Data</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      expect(screen.getByText("Data")).toBeInTheDocument();
    });

    it("handles large number of rows", () => {
      render(
        <Table>
          <TableBody>
            {Array.from({ length: 100 }, (_, i) => (
              <TableRow key={i}>
                <TableCell>Row {i + 1}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>,
      );

      expect(screen.getByText("Row 1")).toBeInTheDocument();
      expect(screen.getByText("Row 100")).toBeInTheDocument();
    });
  });
});
