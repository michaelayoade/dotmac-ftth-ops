import { ColumnDef } from "@tanstack/react-table";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import type { ConfirmDialogOptions } from "../confirm-dialog-provider";
import {
  EnhancedDataTable,
  type EnhancedDataTableProps,
  type QuickFilter,
} from "../EnhancedDataTable";

const confirmDialogSpy = jest.fn<Promise<boolean>, [ConfirmDialogOptions]>();

jest.mock("../confirm-dialog-provider", () => ({
  __esModule: true,
  useConfirmDialog: () => confirmDialogSpy,
}));

type TestRow = {
  id: string;
  name: string;
  status: "active" | "inactive";
  amount: number;
};

const rows: TestRow[] = [
  { id: "1", name: "Item 1", status: "active", amount: 100 },
  { id: "2", name: "Item 2", status: "inactive", amount: 200 },
  { id: "3", name: "Item 3", status: "active", amount: 300 },
];

const columns: ColumnDef<TestRow>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "status", header: "Status" },
  { accessorKey: "amount", header: "Amount" },
];

type TableProps = EnhancedDataTableProps<TestRow, unknown>;

const defaultProps: TableProps = {
  data: rows,
  columns,
};

const renderTable = (props?: Partial<TableProps>) =>
  render(<EnhancedDataTable {...defaultProps} {...props} />);

const mockedCreateObjectURL = URL.createObjectURL as unknown as jest.MockedFunction<
  (value: Blob | MediaSource) => string
>;

beforeEach(() => {
  confirmDialogSpy.mockReset();
  confirmDialogSpy.mockResolvedValue(true);
  mockedCreateObjectURL.mockReset();
});

describe("EnhancedDataTable", () => {
  it("renders provided rows and pagination summary", () => {
    renderTable();

    expect(screen.getByText("Item 1")).toBeInTheDocument();
    expect(screen.getByText("Item 3")).toBeInTheDocument();
    expect(screen.getByText("3 total row(s)")).toBeInTheDocument();
  });

  it("renders search input when search key is provided and filters rows", async () => {
    const user = userEvent.setup();

    renderTable({ searchable: true, searchKey: "name" });

    const searchInput = screen.getByPlaceholderText("Search...");
    await user.type(searchInput, "Item 2");

    await waitFor(() => {
      expect(screen.getByText("Item 2")).toBeInTheDocument();
    });
    expect(screen.queryByText("Item 1")).not.toBeInTheDocument();
    expect(screen.queryByText("Item 3")).not.toBeInTheDocument();
  });

  it("applies quick filters and can clear them", async () => {
    const user = userEvent.setup();
    const quickFilters: QuickFilter<TestRow>[] = [
      {
        label: "Active",
        defaultActive: true,
        filter: (row) => row.status === "active",
      },
      {
        label: "High value",
        filter: (row) => row.amount >= 200,
      },
    ];

    renderTable({ quickFilters });

    expect(screen.queryByText("Item 2")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByText("Item 2")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "High value" }));
    expect(screen.getByText("Clear filters")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("Item 1")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Item 2")).toBeInTheDocument();
    expect(screen.getByText("Item 3")).toBeInTheDocument();
  });

  it("filters rows through the filter panel", async () => {
    const user = userEvent.setup();

    renderTable({
      filterable: true,
      filters: [
        {
          column: "status",
          label: "Status",
          type: "select",
          options: [
            { label: "Active", value: "active" },
            { label: "Inactive", value: "inactive" },
          ],
        },
      ],
    });

    await user.click(screen.getByRole("button", { name: /Toggle filters/i }));
    const statusLabel = screen
      .getAllByText("Status")
      .find((element) => element.tagName.toLowerCase() === "label");
    expect(statusLabel).toBeTruthy();
    const filterContainer = statusLabel!.parentElement as HTMLElement;
    const select = within(filterContainer).getByRole("combobox");

    await user.selectOptions(select, "inactive");
    await waitFor(() => {
      expect(screen.getByText("Item 2")).toBeInTheDocument();
    });
    expect(screen.queryByText("Item 1")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() => {
      expect(screen.getByText("Item 1")).toBeInTheDocument();
    });
    expect(select).toHaveValue("");
  });

  it("runs bulk actions after confirmation and resets selection", async () => {
    const user = userEvent.setup();
    const bulkAction = jest.fn();

    renderTable({
      selectable: true,
      bulkActions: [
        {
          label: "Archive",
          action: bulkAction,
          confirmMessage: "Archive selected rows?",
        },
      ],
    });

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[1]);
    expect(screen.getByText("1 of 3 row(s) selected")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Actions/ }));
    await user.click(await screen.findByText("Archive"));

    expect(confirmDialogSpy).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Archive selected rows?" }),
    );
    await waitFor(() => {
      expect(bulkAction).toHaveBeenCalledWith([rows[0]]);
    });
    expect(screen.getByText("3 total row(s)")).toBeInTheDocument();
  });

  it("disables export when there are no rows", () => {
    renderTable({ exportable: true, data: [] });

    expect(screen.getByRole("button", { name: /Export/i })).toBeDisabled();
  });

  it("exports selected rows to CSV", async () => {
    const user = userEvent.setup();
    let exportedBlob: Blob | null = null;
    mockedCreateObjectURL.mockImplementation((blob: Blob | MediaSource) => {
      exportedBlob = blob as Blob;
      return "blob:test";
    });

    renderTable({ exportable: true, selectable: true });

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[1]);

    await user.click(screen.getByRole("button", { name: /Export/i }));

    expect(mockedCreateObjectURL).toHaveBeenCalled();
    expect(exportedBlob).not.toBeNull();
    const csv = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => resolve(reader.result as string);
      reader.readAsText(exportedBlob as Blob);
    });
    expect(csv).toContain("name,status,amount");
    expect(csv).toContain("Item 1,active,100");
    expect(csv).not.toContain("Item 2,inactive,200");
  });

  it("updates pagination when page size changes", async () => {
    const user = userEvent.setup();
    const manyRows: TestRow[] = Array.from({ length: 25 }, (_, index) => ({
      id: String(index + 1),
      name: `Item ${index + 1}`,
      status: index % 2 === 0 ? "active" : "inactive",
      amount: 50 * (index + 1),
    }));

    renderTable({
      data: manyRows,
      defaultPageSize: 5,
      pageSizeOptions: [5, 10, 20],
    });

    expect(screen.getByText("Item 5")).toBeInTheDocument();
    expect(screen.queryByText("Item 6")).not.toBeInTheDocument();
    expect(screen.getByText("Page 1 of 5")).toBeInTheDocument();

    const select = screen.getByLabelText("Select page size");
    await user.selectOptions(select, "20");

    await waitFor(() => {
      expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    });
    expect(screen.getByText("Item 20")).toBeInTheDocument();
    expect(screen.queryByText("Item 21")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Go to next page/i }));
    await waitFor(() => {
      expect(screen.getByText("Item 21")).toBeInTheDocument();
    });
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
  });

  it("calls onRowClick for row clicks but ignores button interactions inside rows", async () => {
    const user = userEvent.setup();
    const onRowClick = jest.fn();
    const actionableColumns: ColumnDef<TestRow>[] = [
      ...columns,
      {
        id: "actions",
        header: "Action",
        cell: () => <button type="button">Row Action</button>,
      },
    ];

    render(
      <EnhancedDataTable {...defaultProps} columns={actionableColumns} onRowClick={onRowClick} />,
    );

    await user.click(screen.getByText("Item 1"));
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);

    const actionButtons = screen.getAllByRole("button", { name: "Row Action" });
    await user.click(actionButtons[0]);
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });
});
