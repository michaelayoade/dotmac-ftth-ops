/**
 * Unstyled, composable Layout primitives (Dashboard, Grid, Stack, Container)
 */

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";
import type React from "react";
import { forwardRef } from "react";

// Container variants
const containerVariants = cva("", {
  variants: {
    size: {
      xs: "",
      sm: "",
      md: "",
      lg: "",
      xl: "",
      "2xl": "",
      full: "",
    },
    padding: {
      none: "",
      sm: "",
      md: "",
      lg: "",
      xl: "",
    },
  },
  defaultVariants: {
    size: "lg",
    padding: "md",
  },
});

// Grid variants
const gridVariants = cva("", {
  variants: {
    cols: {
      1: "",
      2: "",
      3: "",
      4: "",
      5: "",
      6: "",
      7: "",
      8: "",
      9: "",
      10: "",
      11: "",
      12: "",
    },
    gap: {
      none: "",
      xs: "",
      sm: "",
      md: "",
      lg: "",
      xl: "",
    },
    responsive: {
      true: "",
      false: "",
    },
  },
  defaultVariants: {
    cols: 1,
    gap: "md",
    responsive: false,
  },
});

// Stack variants
const stackVariants = cva("", {
  variants: {
    direction: {
      row: "",
      column: "",
      "row-reverse": "",
      "column-reverse": "",
    },
    gap: {
      none: "",
      xs: "",
      sm: "",
      md: "",
      lg: "",
      xl: "",
    },
    align: {
      start: "",
      center: "",
      end: "",
      stretch: "",
      baseline: "",
    },
    justify: {
      start: "",
      center: "",
      end: "",
      between: "",
      around: "",
      evenly: "",
    },
    wrap: {
      nowrap: "",
      wrap: "",
      "wrap-reverse": "",
    },
  },
  defaultVariants: {
    direction: "column",
    gap: "md",
    align: "stretch",
    justify: "start",
    wrap: "nowrap",
  },
});

// Dashboard variants
const dashboardVariants = cva("", {
  variants: {
    layout: {
      sidebar: "",
      "sidebar-right": "",
      topbar: "",
      "sidebar-topbar": "",
      fullwidth: "",
    },
    sidebarWidth: {
      sm: "",
      md: "",
      lg: "",
      xl: "",
    },
    responsive: {
      true: "",
      false: "",
    },
  },
  defaultVariants: {
    layout: "sidebar",
    sidebarWidth: "md",
    responsive: true,
  },
});

// Container Component
export interface ContainerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof containerVariants> {
  asChild?: boolean;
  fluid?: boolean;
  centerContent?: boolean;
}

export const Container = forwardRef<HTMLDivElement, ContainerProps>(
  (
    { className, size, padding, fluid = false, centerContent = false, asChild = false, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : "div";

    return (
      <Comp
        ref={ref}
        className={clsx(
          containerVariants({ size: fluid ? "full" : size, padding }),
          "container",
          {
            "container-fluid": fluid,
            "container-center": centerContent,
          },
          className,
        )}
        {...props}
      />
    );
  },
);

// Grid Component
export interface GridProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof gridVariants> {
  asChild?: boolean;
  autoRows?: string;
  autoCols?: string;
  templateRows?: string;
  templateCols?: string;
}

export const Grid = forwardRef<HTMLDivElement, GridProps>(
  (
    {
      className,
      cols,
      gap,
      responsive,
      autoRows,
      autoCols,
      templateRows,
      templateCols,
      asChild = false,
      style,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "div";

    const gridStyle = {
      ...style,
      ...(autoRows && { gridAutoRows: autoRows }),
      ...(autoCols && { gridAutoColumns: autoCols }),
      ...(templateRows && { gridTemplateRows: templateRows }),
      ...(templateCols && { gridTemplateColumns: templateCols }),
    };

    return (
      <Comp
        ref={ref}
        className={clsx(gridVariants({ cols, gap, responsive }), "grid", className)}
        style={gridStyle}
        {...props}
      />
    );
  },
);

// Grid Item Component
export interface GridItemProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
  colSpan?: number;
  rowSpan?: number;
  colStart?: number;
  colEnd?: number;
  rowStart?: number;
  rowEnd?: number;
}

export const GridItem = forwardRef<HTMLDivElement, GridItemProps>(
  (
    {
      className,
      colSpan,
      rowSpan,
      colStart,
      colEnd,
      rowStart,
      rowEnd,
      asChild = false,
      style,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "div";

    const gridItemStyle = {
      ...style,
      ...(colSpan && { gridColumn: `span ${colSpan}` }),
      ...(rowSpan && { gridRow: `span ${rowSpan}` }),
      ...(colStart && { gridColumnStart: colStart }),
      ...(colEnd && { gridColumnEnd: colEnd }),
      ...(rowStart && { gridRowStart: rowStart }),
      ...(rowEnd && { gridRowEnd: rowEnd }),
    };

    return (
      <Comp ref={ref} className={clsx("grid-item", className)} style={gridItemStyle} {...props} />
    );
  },
);

// Stack Component (Flexbox)
export interface StackProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof stackVariants> {
  asChild?: boolean;
  grow?: boolean;
  shrink?: boolean;
}

export const Stack = forwardRef<HTMLDivElement, StackProps>(
  (
    {
      className,
      direction,
      gap,
      align,
      justify,
      wrap,
      grow = false,
      shrink = false,
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "div";

    return (
      <Comp
        ref={ref}
        className={clsx(
          stackVariants({ direction, gap, align, justify, wrap }),
          "stack",
          {
            "stack-grow": grow,
            "stack-shrink": shrink,
          },
          className,
        )}
        {...props}
      />
    );
  },
);

// HStack (Horizontal Stack)
export interface HStackProps extends Omit<StackProps, "direction"> {
  // Implementation pending
}

export const HStack = forwardRef<HTMLDivElement, HStackProps>((props, ref) => {
  return <Stack ref={ref} direction="row" {...props} />;
});

// VStack (Vertical Stack)
export interface VStackProps extends Omit<StackProps, "direction"> {
  // Implementation pending
}

export const VStack = forwardRef<HTMLDivElement, VStackProps>((props, ref) => {
  return <Stack ref={ref} direction="column" {...props} />;
});

// Dashboard Layout Component
export interface DashboardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof dashboardVariants> {
  asChild?: boolean;
  sidebar?: React.ReactNode;
  topbar?: React.ReactNode;
  footer?: React.ReactNode;
}

export const Dashboard = forwardRef<HTMLDivElement, DashboardProps>(
  (
    {
      className,
      layout,
      sidebarWidth,
      responsive,
      sidebar,
      topbar,
      footer,
      children,
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "div";

    return (
      <Comp
        ref={ref}
        className={clsx(
          dashboardVariants({ layout, sidebarWidth, responsive }),
          "dashboard",
          className,
        )}
        {...props}
      >
        {(layout === "sidebar" || layout === "sidebar-right" || layout === "sidebar-topbar") &&
        sidebar ? (
          <aside className="dashboard-sidebar">{sidebar}</aside>
        ) : null}

        <div className="dashboard-main">
          {(layout === "topbar" || layout === "sidebar-topbar") && topbar ? (
            <header className="dashboard-topbar">{topbar}</header>
          ) : null}

          <main className="dashboard-content">{children}</main>

          {footer ? <footer className="dashboard-footer">{footer}</footer> : null}
        </div>
      </Comp>
    );
  },
);

// Section Component
export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  asChild?: boolean;
  padding?: "none" | "sm" | "md" | "lg" | "xl";
  margin?: "none" | "sm" | "md" | "lg" | "xl";
}

export const Section = forwardRef<HTMLElement, SectionProps>(
  ({ className, padding = "md", margin = "none", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "section";

    return (
      <Comp
        ref={ref}
        className={clsx("section", `padding-${padding}`, `margin-${margin}`, className)}
        {...props}
      />
    );
  },
);

// Card Component
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
  variant?: "default" | "outlined" | "elevated" | "filled";
  padding?: "none" | "sm" | "md" | "lg" | "xl";
  interactive?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      variant = "default",
      padding = "md",
      interactive = false,
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "div";

    return (
      <Comp
        ref={ref}
        className={clsx(
          "card",
          `variant-${variant}`,
          `padding-${padding}`,
          {
            interactive,
          },
          className,
        )}
        {...props}
      />
    );
  },
);

// Card Header
export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "div";

    return <Comp ref={ref} className={clsx("card-header", className)} {...props} />;
  },
);

// Card Content
export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
}

export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "div";

    return <Comp ref={ref} className={clsx("card-content", className)} {...props} />;
  },
);

// Card Footer
export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
}

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "div";

    return <Comp ref={ref} className={clsx("card-footer", className)} {...props} />;
  },
);

// Divider Component
export interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
  orientation?: "horizontal" | "vertical";
  decorative?: boolean;
  label?: string;
}

export const Divider = forwardRef<HTMLDivElement, DividerProps>(
  (
    { className, orientation = "horizontal", decorative = false, label, asChild = false, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : "div";

    if (label) {
      return (
        <Comp
          ref={ref}
          className={clsx("divider", "divider-with-label", `orientation-${orientation}`, className)}
          role={decorative ? "presentation" : "separator"}
          aria-orientation={orientation}
          {...props}
        >
          <span className="divider-label">{label}</span>
        </Comp>
      );
    }

    return (
      <Comp
        ref={ref}
        className={clsx("divider", `orientation-${orientation}`, className)}
        role={decorative ? "presentation" : "separator"}
        aria-orientation={orientation}
        {...props}
      />
    );
  },
);

// Spacer Component
export interface SpacerProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  axis?: "horizontal" | "vertical" | "both";
}

export const Spacer = forwardRef<HTMLDivElement, SpacerProps>(
  ({ className, size = "md", axis = "vertical", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "div";

    return (
      <Comp
        ref={ref}
        className={clsx("spacer", `size-${size}`, `axis-${axis}`, className)}
        aria-hidden="true"
        {...props}
      />
    );
  },
);

// Center Component
export interface CenterProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
  axis?: "horizontal" | "vertical" | "both";
}

export const Center = forwardRef<HTMLDivElement, CenterProps>(
  ({ className, axis = "both", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "div";

    return <Comp ref={ref} className={clsx("center", `axis-${axis}`, className)} {...props} />;
  },
);

// Layout variants for semantic layout components
const layoutVariants = cva("", {
  variants: {
    variant: {
      default: "",
      "sidebar-left": "variant-sidebar-left",
      "sidebar-right": "variant-sidebar-right",
      "sidebar-both": "variant-sidebar-both",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

const layoutHeaderVariants = cva("", {
  variants: {
    height: {
      default: "",
      tall: "",
      compact: "",
    },
  },
  defaultVariants: {
    height: "default",
  },
});

const layoutContentVariants = cva("", {
  variants: {
    padding: {
      none: "",
      small: "",
      medium: "",
      large: "",
    },
  },
  defaultVariants: {
    padding: "medium",
  },
});

const layoutSidebarVariants = cva("", {
  variants: {
    position: {
      left: "position-left",
      right: "position-right",
    },
    width: {
      narrow: "width-narrow",
      default: "",
      wide: "width-wide",
    },
  },
  defaultVariants: {
    position: "left",
    width: "default",
  },
});

// Layout Component (semantic container)
export interface LayoutProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof layoutVariants> {
  asChild?: boolean;
  responsive?: boolean;
}

export const Layout = forwardRef<HTMLDivElement, LayoutProps>(
  ({ className, variant, responsive = false, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "div";

    return (
      <Comp
        ref={ref}
        className={clsx(
          layoutVariants({ variant }),
          "layout",
          {
            responsive,
          },
          className,
        )}
        {...props}
      />
    );
  },
);

// LayoutHeader Component
export interface LayoutHeaderProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof layoutHeaderVariants> {
  asChild?: boolean;
  sticky?: boolean;
}

export const LayoutHeader = forwardRef<HTMLElement, LayoutHeaderProps>(
  ({ className, height, sticky = false, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "header";

    return (
      <Comp
        ref={ref}
        className={clsx(
          layoutHeaderVariants({ height }),
          "layout-header",
          {
            sticky,
          },
          className,
        )}
        {...props}
      />
    );
  },
);

// LayoutContent Component
export interface LayoutContentProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof layoutContentVariants> {
  asChild?: boolean;
  scrollable?: boolean;
}

export const LayoutContent = forwardRef<HTMLElement, LayoutContentProps>(
  ({ className, padding, scrollable = false, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "main";

    return (
      <Comp
        ref={ref}
        className={clsx(
          layoutContentVariants({ padding }),
          "layout-content",
          {
            scrollable,
          },
          className,
        )}
        {...props}
      />
    );
  },
);

// LayoutSidebar Component
export interface LayoutSidebarProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof layoutSidebarVariants> {
  asChild?: boolean;
  collapsible?: boolean;
  collapsed?: boolean;
}

export const LayoutSidebar = forwardRef<HTMLElement, LayoutSidebarProps>(
  (
    {
      className,
      position,
      width,
      collapsible = false,
      collapsed = false,
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "aside";

    return (
      <Comp
        ref={ref}
        className={clsx(
          layoutSidebarVariants({ position, width }),
          "layout-sidebar",
          {
            collapsible,
            collapsed,
          },
          className,
        )}
        {...props}
      />
    );
  },
);

// LayoutFooter Component
export interface LayoutFooterProps extends React.HTMLAttributes<HTMLElement> {
  asChild?: boolean;
  sticky?: boolean;
}

export const LayoutFooter = forwardRef<HTMLElement, LayoutFooterProps>(
  ({ className, sticky = false, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "footer";

    return (
      <Comp
        ref={ref}
        className={clsx(
          "layout-footer",
          {
            sticky,
          },
          className,
        )}
        {...props}
      />
    );
  },
);

// Set display names
Container.displayName = "Container";
Grid.displayName = "Grid";
GridItem.displayName = "GridItem";
Stack.displayName = "Stack";
HStack.displayName = "HStack";
VStack.displayName = "VStack";
Dashboard.displayName = "Dashboard";
Section.displayName = "Section";
Card.displayName = "Card";
CardHeader.displayName = "CardHeader";
CardContent.displayName = "CardContent";
CardFooter.displayName = "CardFooter";
Divider.displayName = "Divider";
Spacer.displayName = "Spacer";
Center.displayName = "Center";
Layout.displayName = "Layout";
LayoutHeader.displayName = "LayoutHeader";
LayoutContent.displayName = "LayoutContent";
LayoutSidebar.displayName = "LayoutSidebar";
LayoutFooter.displayName = "LayoutFooter";
