/**
 * Data Table Composition Components
 *
 * Breaks down the complex AdvancedDataTable into composable parts
 */

import React, { useCallback, useRef } from "react";

// Composition interfaces
export interface DataTableState {
  filters: Record<string, unknown>;
  sorting: Array<{ id: string; desc: boolean }>;
  grouping: string[];
  selection: string[];
  pagination: { page: number; size: number };
}

export interface DataTableActions {
  setFilters: (filters: Record<string, unknown>) => void;
  setSorting: (sorting: Array<{ id: string; desc: boolean }>) => void;
  setGrouping: (grouping: string[]) => void;
  setSelection: (selection: string[]) => void;
  setPagination: (pagination: { page: number; size: number }) => void;
}

// Filter composition
export const useDataTableFilters = (
  initialFilters: Record<string, unknown> = {
    // Implementation pending
  },
) => {
  const [filters, setFilters] = React.useState(initialFilters);
  const initialRef = useRef(initialFilters);

  const handleFilterChange = useCallback((key: string, value: unknown) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(initialRef.current);
  }, []);

  return { filters, setFilters, handleFilterChange, clearFilters };
};

// Selection composition
export const useDataTableSelection = (multiSelect = true) => {
  const [selection, setSelection] = React.useState<string[]>([]);

  const handleSelect = useCallback(
    (id: string) => {
      setSelection((prev) => {
        if (multiSelect) {
          return prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
        }
        return prev.includes(id) ? [] : [id];
      });
    },
    [multiSelect],
  );

  const selectAll = useCallback((ids: string[]) => {
    setSelection(ids);
  }, []);

  const clearSelection = useCallback(() => {
    setSelection([]);
  }, []);

  return { selection, setSelection, handleSelect, selectAll, clearSelection };
};

// Sorting composition
export const useDataTableSorting = (initialSorting: Array<{ id: string; desc: boolean }> = []) => {
  const [sorting, setSorting] = React.useState(initialSorting);

  const handleSort = useCallback((columnId: string) => {
    setSorting((prev) => {
      const existing = prev.find((sort) => sort.id === columnId);
      if (existing) {
        return existing.desc
          ? prev.filter((sort) => sort.id !== columnId)
          : prev.map((sort) => (sort.id === columnId ? { ...sort, desc: true } : sort));
      }
      return [...prev, { id: columnId, desc: false }];
    });
  }, []);

  return { sorting, setSorting, handleSort };
};

// Pagination composition
export const useDataTablePagination = (initialPage = 0, initialSize = 10) => {
  const [pagination, setPagination] = React.useState({
    page: initialPage,
    size: initialSize,
  });

  const nextPage = useCallback(() => {
    setPagination((prev) => ({ ...prev, page: prev.page + 1 }));
  }, []);

  const prevPage = useCallback(() => {
    setPagination((prev) => ({
      ...prev,
      page: Math.max(0, prev.page - 1),
    }));
  }, []);

  const goToPage = useCallback((page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  }, []);

  const setPageSize = useCallback((size: number) => {
    setPagination((prev) => ({ ...prev, size, page: 0 }));
  }, []);

  return {
    pagination,
    setPagination,
    nextPage,
    prevPage,
    goToPage,
    setPageSize,
  };
};

// Main composition hook
export const useDataTableComposition = (options: {
  initialFilters?: Record<string, unknown>;
  initialSorting?: Array<{ id: string; desc: boolean }>;
  initialPage?: number;
  initialPageSize?: number;
  multiSelect?: boolean;
}) => {
  const filters = useDataTableFilters(options.initialFilters);
  const selection = useDataTableSelection(options.multiSelect);
  const sorting = useDataTableSorting(options.initialSorting);
  const pagination = useDataTablePagination(options.initialPage, options.initialPageSize);

  return {
    filters,
    selection,
    sorting,
    pagination,
  };
};
