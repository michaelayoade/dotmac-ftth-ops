declare module "react-window" {
  import type * as React from "react";

  export type ListOnScrollProps = {
    scrollDirection: "forward" | "backward";
    scrollOffset: number;
    scrollUpdateWasRequested: boolean;
  };

  export interface FixedSizeListProps<ItemData = unknown> {
    height: number;
    width: number;
    itemCount: number;
    itemSize: number;
    overscanCount?: number;
    itemData?: ItemData;
    onScroll?: (props: ListOnScrollProps) => void;
    onItemsRendered?: (props: { visibleStartIndex: number; visibleStopIndex: number }) => void;
    children: (props: {
      index: number;
      style: React.CSSProperties;
      data: ItemData;
    }) => React.ReactElement | null;
  }

  export type FixedSizeList<ItemData = unknown> = React.Component<FixedSizeListProps<ItemData>>;

  export const FixedSizeList: {
    new <ItemData = unknown>(props: FixedSizeListProps<ItemData>): FixedSizeList<ItemData>;
  };
}
