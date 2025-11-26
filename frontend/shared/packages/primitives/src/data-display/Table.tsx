/**
 * Unstyled, composable Table primitive
 */

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";
import React, { forwardRef } from "react";

// Table variants for different use cases
const tableVariants = cva("", {
  variants: {
    size: {
      sm: "",
      md: "",
      lg: "",
    },
    variant: {
      default: "",
      bordered: "",
      striped: "",
      hover: "",
    },
    density: {
      compact: "",
      comfortable: "",
      spacious: "",
    },
  },
  defaultVariants: {
    size: "md",
    variant: "default",
    density: "comfortable",
  },
});

export interface TableProps
  extends React.TableHTMLAttributes<HTMLTableElement>,
    VariantProps<typeof tableVariants> {
  asChild?: boolean;
}

export interface Column<T = any> {
  key: string;
  title: string;
  dataIndex?: keyof T;
  render?: (value: unknown, record: T, index: number) => React.ReactNode;
  sortable?: boolean;
  width?: string | number;
  align?: "left" | "center" | "right";
  fixed?: "left" | "right";
  hidden?: boolean;
}

export interface TableData<T = any> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  pagination?: {
    current: number;
    pageSize: number;
    total: number;
    showSizeChanger?: boolean;
    showQuickJumper?: boolean;
    onChange?: (page: number, pageSize: number) => void;
  };
  sorting?: {
    field?: string;
    order?: "asc" | "desc";
    onChange?: (field: string, order: "asc" | "desc") => void;
  };
  selection?: {
    selectedKeys: string[];
    onChange?: (selectedKeys: string[]) => void;
    getRowKey?: (record: T) => string;
  };
  expandable?: {
    expandedKeys: string[];
    onExpand?: (expanded: boolean, record: T) => void;
    expandedRowRender?: (record: T) => React.ReactNode;
  };
}

const Table = forwardRef<HTMLTableElement, TableProps>(
  ({ className, size, variant, density, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "table";

    return (
      <Comp
        ref={ref}
        className={clsx(tableVariants({ size, variant, density }), className)}
        {...props}
      />
    );
  },
);

const TableHeader = forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => <thead ref={ref} className={clsx("", className)} {...props} />);

const TableBody = forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => <tbody ref={ref} className={clsx("", className)} {...props} />);

const TableFooter = forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => <tfoot ref={ref} className={clsx("", className)} {...props} />);

const TableRow = forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement> & {
    selected?: boolean;
    expandable?: boolean;
    expanded?: boolean;
  }
>(({ className, selected, expandable, expanded, ...props }, ref) => (
  <tr
    ref={ref}
    className={clsx(
      "",
      {
        selected,
        expandable,
        expanded,
      },
      className,
    )}
    {...props}
  />
));

const TableHead = forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement> & {
    sortable?: boolean;
    sorted?: "asc" | "desc" | false;
    onSort?: () => void;
  }
>(({ className, sortable, sorted, onSort, children, ...props }, ref) => (
  <th
    ref={ref}
    className={clsx(
      "",
      {
        sortable,
        "sorted-asc": sorted === "asc",
        "sorted-desc": sorted === "desc",
      },
      className,
    )}
    onClick={sortable ? onSort : undefined}
    onKeyDown={(e) => (e.key === "Enter" && sortable ? onSort : undefined)}
    {...props}
  >
    <div className="table-head-content">
      {children}
      {sortable ? (
        <span className="sort-indicator">
          {sorted === "asc" && "↑"}
          {sorted === "desc" && "↓"}
          {!sorted && "↕"}
        </span>
      ) : null}
    </div>
  </th>
));

const TableCell = forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement> & {
    align?: "left" | "center" | "right";
  }
>(({ className, align = "left", ...props }, ref) => (
  <td
    ref={ref}
    className={clsx(
      "",
      {
        "text-left": align === "left",
        "text-center": align === "center",
        "text-right": align === "right",
      },
      className,
    )}
    {...props}
  />
));

const TableCaption = forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption ref={ref} className={clsx("", className)} {...props} />
));

// Data Table component that uses the primitives
export interface DataTableProps<T = any> extends TableProps, TableData<T> {
  emptyText?: string;
  loadingText?: string;
}

export function DataTable<T = any>({
  columns,
  data,
  loading,
  pagination,
  sorting,
  selection,
  expandable,
  emptyText = "No data",
  loadingText = "Loading...",
  className,
  ...tableProps
}: DataTableProps<T>) {
  const handleSort = (column: Column<T>) => {
    if (!column.sortable || !sorting?.onChange) {
      return;
    }

    const currentOrder = sorting.field === column.key ? sorting.order : undefined;
    const newOrder = currentOrder === "asc" ? "desc" : "asc";

    sorting.onChange(column.key, newOrder);
  };

  const handleSelectAll = (checked: boolean) => {
    if (!selection?.onChange || !selection.getRowKey) {
      return;
    }

    if (checked) {
      const allKeys = data
        .map((item) => selection.getRowKey?.(item))
        .filter((key): key is string => key !== undefined);
      selection.onChange(allKeys);
    } else {
      selection.onChange([]);
    }
  };

  const handleSelectRow = (record: T, checked: boolean) => {
    if (!selection?.onChange || !selection.getRowKey) {
      return;
    }

    const key = selection.getRowKey(record);
    const newSelectedKeys = checked
      ? [...selection.selectedKeys, key]
      : selection.selectedKeys.filter((k) => k !== key);

    selection.onChange(newSelectedKeys);
  };

  const isSelected = (record: T) => {
    if (!selection?.getRowKey) {
      return false;
    }
    return selection.selectedKeys.includes(selection.getRowKey(record));
  };

  const renderCell = (column: Column<T>, record: T, index: number) => {
    const value = column.dataIndex ? record[column.dataIndex] : record;
    return column.render ? column.render(value, record, index) : String(value);
  };

  if (loading) {
    return <div className="table-loading">{loadingText}</div>;
  }

  return (
    <div className="table-container">
      <Table className={className} {...tableProps}>
        <TableHeader>
          <TableRow>
            {selection ? (
              <TableHead>
                <input
                  type="checkbox"
                  checked={data.length > 0 && selection.selectedKeys.length === data.length}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  aria-label="Select all rows"
                />
              </TableHead>
            ) : null}
            {columns
              .filter((col) => !col.hidden)
              .map((column) => (
                <TableHead
                  key={column.key}
                  {...(column.sortable !== undefined ? { sortable: column.sortable } : {})}
                  {...(sorting?.field === column.key ? { sorted: sorting.order } : {})}
                  {...(column.sortable ? { onSort: () => handleSort(column) } : {})}
                  style={{ width: column.width }}
                >
                  {column.title}
                </TableHead>
              ))}
            {expandable ? <TableHead /> : null}
          </TableRow>
        </TableHeader>

        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length + (selection ? 1 : 0) + (expandable ? 1 : 0)}
                className="empty-cell"
              >
                {emptyText}
              </TableCell>
            </TableRow>
          ) : (
            data.map((record, _index) => {
              const rowKey = selection?.getRowKey?.(record) || String(_index);
              const selected = isSelected(record);

              return (
                <React.Fragment key={rowKey}>
                  <TableRow selected={selected}>
                    {selection ? (
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(e) => handleSelectRow(record, e.target.checked)}
                          aria-label={`Select row ${rowKey}`}
                        />
                      </TableCell>
                    ) : null}
                    {columns
                      .filter((col) => !col.hidden)
                      .map((column) => (
                        <TableCell
                          key={column.key}
                          {...(column.align ? { align: column.align } : {})}
                        >
                          {renderCell(column, record, _index)}
                        </TableCell>
                      ))}
                    {expandable ? (
                      <TableCell>
                        <button
                          type="button"
                          onClick={() =>
                            expandable.onExpand?.(!expandable.expandedKeys.includes(rowKey), record)
                          }
                        >
                          {expandable.expandedKeys.includes(rowKey) ? "−" : "+"}
                        </button>
                      </TableCell>
                    ) : null}
                  </TableRow>

                  {expandable?.expandedKeys.includes(rowKey) ? (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length + (selection ? 1 : 0) + 1}
                        className="expanded-content"
                      >
                        {expandable.expandedRowRender?.(record)}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </React.Fragment>
              );
            })
          )}
        </TableBody>
      </Table>

      {pagination ? (
        <div className="table-pagination">
          {/* Pagination controls would go here */}
          <span>
            Page {pagination.current} of {Math.ceil(pagination.total / pagination.pageSize)}
          </span>
        </div>
      ) : null}
    </div>
  );
}

Table.displayName = "Table";
TableHeader.displayName = "TableHeader";
TableBody.displayName = "TableBody";
TableFooter.displayName = "TableFooter";
TableRow.displayName = "TableRow";
TableHead.displayName = "TableHead";
TableCell.displayName = "TableCell";
TableCaption.displayName = "TableCaption";

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
  DataTable as UniversalTable,
};
