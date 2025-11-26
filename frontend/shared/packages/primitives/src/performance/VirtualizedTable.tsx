"use client";

import React, { forwardRef, useImperativeHandle, useMemo, useRef } from "react";

import { VirtualizedDataTable, type VirtualizedDataTableProps } from "./VirtualizedDataTable";

export interface VirtualizedTableProps<T = Record<string, unknown>>
  extends Omit<VirtualizedDataTableProps<T>, "forwardedScrollRef"> {}

export interface VirtualizedTableRef {
  scrollTo: (index: number) => void;
  scrollToTop: () => void;
  scrollToBottom: () => void;
}

export const VirtualizedTable = forwardRef<VirtualizedTableRef, VirtualizedTableProps<any>>(
  ({ rowHeight = 48, ...props }, ref) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(
      ref,
      () => ({
        scrollTo: (index: number) => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = index * rowHeight;
          }
        },
        scrollToTop: () => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = 0;
          }
        },
        scrollToBottom: () => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }
        },
      }),
      [rowHeight],
    );

    return <VirtualizedDataTable {...props} rowHeight={rowHeight} forwardedScrollRef={scrollRef} />;
  },
);

VirtualizedTable.displayName = "VirtualizedTable";

export default VirtualizedTable;
