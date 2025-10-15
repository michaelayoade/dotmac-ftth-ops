/**
 * EnhancedDataTable - Production-ready table with advanced features
 *
 * Features:
 * - Search & filtering (from base DataTable)
 * - Bulk actions with selection
 * - Export to CSV/Excel
 * - Advanced filter bar
 * - Custom toolbar actions
 * - Loading & error states
 *
 * Usage:
 * ```tsx
 * <EnhancedDataTable
 *   data={invoices}
 *   columns={invoiceColumns}
 *   searchColumn="invoice_number"
 *   bulkActions={[
 *     { label: 'Send', icon: Send, action: sendInvoices },
 *     { label: 'Void', icon: X, action: voidInvoices, variant: 'destructive' }
 *   ]}
 *   exportable
 *   exportFilename="invoices"
 * />
 * ```
 */

"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  Row,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Download,
  FileText,
  Filter,
  MoreHorizontal,
  Trash2,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

export interface BulkAction<TData> {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  action: (selectedRows: TData[]) => void | Promise<void>;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  disabled?: (selectedRows: TData[]) => boolean;
  confirmMessage?: string;
}

export interface FilterConfig {
  column: string;
  label: string;
  type: "text" | "select" | "date" | "number";
  options?: { label: string; value: string }[];
}

export interface EnhancedDataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];

  // Search
  searchable?: boolean;
  searchPlaceholder?: string;
  searchColumn?: string;

  // Pagination
  paginated?: boolean;
  pageSizeOptions?: number[];
  defaultPageSize?: number;

  // Selection & Bulk Actions
  selectable?: boolean;
  bulkActions?: BulkAction<TData>[];

  // Filtering
  filterable?: boolean;
  filters?: FilterConfig[];

  // Export
  exportable?: boolean;
  exportFilename?: string;
  exportColumns?: (keyof TData)[];

  // Additional features
  columnVisibility?: boolean;
  emptyMessage?: string;
  className?: string;
  isLoading?: boolean;
  onRowClick?: (row: TData) => void;

  // Toolbar actions
  toolbarActions?: React.ReactNode;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Export table data to CSV
 */
function exportToCSV<TData>(
  data: TData[],
  columns: (keyof TData)[],
  filename: string
): void {
  if (data.length === 0) return;

  // Create CSV header
  const header = columns.join(",");

  // Create CSV rows
  const rows = data.map((row) =>
    columns
      .map((col) => {
        const value = row[col];
        // Handle values that might contain commas
        const stringValue = String(value ?? "");
        return stringValue.includes(",") ? `"${stringValue}"` : stringValue;
      })
      .join(",")
  );

  // Combine and create blob
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });

  // Download
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Get selection column for checkbox
 */
function getSelectionColumn<TData>(): ColumnDef<TData> {
  return {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
        className="translate-y-[2px]"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        className="translate-y-[2px]"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  };
}

// ============================================================================
// Component
// ============================================================================

export function EnhancedDataTable<TData, TValue>({
  columns,
  data,
  searchable = true,
  searchPlaceholder = "Search...",
  searchColumn,
  paginated = true,
  pageSizeOptions = [10, 20, 30, 50, 100],
  defaultPageSize = 10,
  selectable = false,
  bulkActions = [],
  filterable = false,
  filters = [],
  exportable = false,
  exportFilename = "data",
  exportColumns,
  columnVisibility = true,
  emptyMessage = "No results.",
  className,
  isLoading = false,
  onRowClick,
  toolbarActions,
}: EnhancedDataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibilityState, setColumnVisibilityState] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});
  const [showFilters, setShowFilters] = React.useState(false);

  // Add selection column if selectable
  const tableColumns = React.useMemo(() => {
    if (selectable) {
      return [getSelectionColumn<TData>(), ...columns];
    }
    return columns;
  }, [columns, selectable]);

  const table = useReactTable({
    data,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: paginated ? getPaginationRowModel() : undefined,
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibilityState,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility: columnVisibilityState,
      rowSelection,
    },
    initialState: {
      pagination: {
        pageSize: defaultPageSize,
      },
    },
  });

  // Get selected rows
  const selectedRows = React.useMemo(() => {
    return table.getFilteredSelectedRowModel().rows.map((row) => row.original);
  }, [table, rowSelection]);

  // Export handler
  const handleExport = React.useCallback(() => {
    const dataToExport = selectedRows.length > 0 ? selectedRows : data;
    const columnsToExport =
      exportColumns || (Object.keys(data[0] || {}) as (keyof TData)[]);
    exportToCSV(dataToExport, columnsToExport, exportFilename);
  }, [data, selectedRows, exportColumns, exportFilename]);

  // Bulk action handler
  const handleBulkAction = React.useCallback(
    async (action: BulkAction<TData>) => {
      if (action.confirmMessage) {
        if (!confirm(action.confirmMessage)) return;
      }

      await action.action(selectedRows);
      table.resetRowSelection();
    },
    [selectedRows, table]
  );

  return (
    <div className={cn("space-y-4", className)}>
      {/* Toolbar */}
      <div className="flex flex-col gap-4">
        {/* Top row: Search, Filters, Actions */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-1">
            {/* Search */}
            {searchable && searchColumn && (
              <Input
                placeholder={searchPlaceholder}
                value={(table.getColumn(searchColumn)?.getFilterValue() as string) ?? ""}
                onChange={(event) =>
                  table.getColumn(searchColumn)?.setFilterValue(event.target.value)
                }
                className="max-w-sm"
                aria-label="Search table"
              />
            )}

            {/* Filter toggle */}
            {filterable && filters.length > 0 && (
              <Button
                variant={showFilters ? "default" : "outline"}
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                aria-label="Toggle filters"
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </Button>
            )}
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-2">
            {/* Custom toolbar actions */}
            {toolbarActions}

            {/* Export */}
            {exportable && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={data.length === 0}
                aria-label="Export data"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            )}

            {/* Column visibility */}
            {columnVisibility && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Columns
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-card">
                  {table
                    .getAllColumns()
                    .filter((column) => column.getCanHide())
                    .map((column) => (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        className="capitalize"
                        checked={column.getIsVisible()}
                        onCheckedChange={(value) => column.toggleVisibility(!!value)}
                      >
                        {column.id}
                      </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Bulk actions */}
            {selectable && bulkActions.length > 0 && selectedRows.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Actions ({selectedRows.length})
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-card">
                  <DropdownMenuLabel>Bulk Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {bulkActions.map((action, index) => {
                    const Icon = action.icon;
                    const isDisabled = action.disabled?.(selectedRows) ?? false;

                    return (
                      <DropdownMenuItem
                        key={index}
                        onClick={() => handleBulkAction(action)}
                        disabled={isDisabled}
                        className={cn(
                          action.variant === "destructive" && "text-destructive focus:text-destructive"
                        )}
                      >
                        {Icon && <Icon className="h-4 w-4 mr-2" />}
                        {action.label}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Filter bar */}
        {filterable && showFilters && filters.length > 0 && (
          <div className="flex items-center gap-4 p-4 border border-border rounded-md bg-muted/50">
            {filters.map((filter) => (
              <div key={filter.column} className="flex flex-col gap-2">
                <label className="text-sm font-medium text-muted-foreground">
                  {filter.label}
                </label>
                {filter.type === "select" && filter.options ? (
                  <select
                    value={(table.getColumn(filter.column)?.getFilterValue() as string) ?? ""}
                    onChange={(e) =>
                      table.getColumn(filter.column)?.setFilterValue(e.target.value || undefined)
                    }
                    className="h-8 rounded-md border border-input bg-card px-3 text-sm"
                  >
                    <option value="">All</option>
                    {filter.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    type={filter.type}
                    value={(table.getColumn(filter.column)?.getFilterValue() as string) ?? ""}
                    onChange={(e) =>
                      table.getColumn(filter.column)?.setFilterValue(e.target.value || undefined)
                    }
                    className="h-8 w-40"
                  />
                )}
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => table.resetColumnFilters()}
              className="mt-6"
            >
              Clear filters
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border border-border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={tableColumns.length} className="h-24 text-center">
                  <div className="text-muted-foreground">Loading...</div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={cn(onRowClick && "cursor-pointer hover:bg-muted/50")}
                  onClick={(e) => {
                    // Don't trigger row click if clicking on checkbox or actions
                    if (
                      (e.target as HTMLElement).closest('[role="checkbox"]') ||
                      (e.target as HTMLElement).closest('button')
                    ) {
                      return;
                    }
                    onRowClick?.(row.original);
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={tableColumns.length} className="h-24 text-center">
                  <div className="text-muted-foreground">{emptyMessage}</div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {paginated && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {table.getFilteredSelectedRowModel().rows.length > 0 ? (
              <span>
                {table.getFilteredSelectedRowModel().rows.length} of{" "}
                {table.getFilteredRowModel().rows.length} row(s) selected
              </span>
            ) : (
              <span>
                {table.getFilteredRowModel().rows.length} total row(s)
              </span>
            )}
          </div>
          <div className="flex items-center space-x-6 lg:space-x-8">
            <div className="flex items-center space-x-2">
              <p className="text-sm font-medium text-foreground">Rows per page</p>
              <select
                value={table.getState().pagination.pageSize}
                onChange={(e) => table.setPageSize(Number(e.target.value))}
                className="h-8 w-[70px] rounded-md border border-input bg-card px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label="Select page size"
              >
                {pageSizeOptions.map((pageSize) => (
                  <option key={pageSize} value={pageSize}>
                    {pageSize}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex w-[100px] items-center justify-center text-sm font-medium text-foreground">
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                aria-label="Go to previous page"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                aria-label="Go to next page"
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Export utilities for external use
 */
export const DataTableUtils = {
  exportToCSV,
};
