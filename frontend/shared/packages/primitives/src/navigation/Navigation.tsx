/**
 * Unstyled, composable Navigation primitives
 */
"use client";

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";
import { ChevronRight } from "lucide-react";
import React, { createContext, forwardRef, useContext } from "react";

// Navigation variants
const navigationVariants = cva("", {
  variants: {
    variant: {
      default: "",
      bordered: "",
      filled: "",
      minimal: "",
    },
    orientation: {
      horizontal: "",
      vertical: "",
    },
    size: {
      sm: "",
      md: "",
      lg: "",
    },
  },
  defaultVariants: {
    variant: "default",
    orientation: "horizontal",
    size: "md",
  },
});

// Sidebar variants
const sidebarVariants = cva("", {
  variants: {
    variant: {
      default: "",
      floating: "",
      bordered: "",
    },
    size: {
      sm: "",
      md: "",
      lg: "",
      xl: "",
    },
    position: {
      left: "",
      right: "",
    },
    behavior: {
      push: "",
      overlay: "",
      squeeze: "",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "md",
    position: "left",
    behavior: "push",
  },
});

// Navigation Context
interface NavigationContextValue {
  activeItem?: string;
  onNavigate?: (key: string, href?: string) => void;
  collapsed?: boolean;
}

const NavigationContext = createContext<NavigationContextValue>({});

const useNavigation = () => useContext(NavigationContext);

// Navigation Base Component
export interface NavigationProps extends React.HTMLAttributes<HTMLElement> {
  asChild?: boolean;
  variant?: "default" | "bordered" | "filled" | "minimal";
  orientation?: "horizontal" | "vertical";
  size?: "sm" | "md" | "lg";
}

export const Navigation = forwardRef<HTMLElement, NavigationProps>(
  (
    {
      className,
      variant = "default",
      orientation = "horizontal",
      size = "md",
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "nav";

    return (
      <Comp
        ref={ref}
        className={clsx(
          navigationVariants({ variant, orientation, size }),
          "navigation",
          className,
        )}
        {...props}
      />
    );
  },
);

// Navigation Provider
export interface NavigationProviderProps {
  children: React.ReactNode;
  activeItem?: string;
  onNavigate?: (key: string, href?: string) => void;
  collapsed?: boolean;
}

export function NavigationProvider({
  children,
  activeItem,
  onNavigate,
  collapsed = false,
}: NavigationProviderProps) {
  const contextValue: NavigationContextValue = {
    ...(activeItem !== undefined ? { activeItem } : {}),
    ...(onNavigate ? { onNavigate } : {}),
    collapsed,
  };

  return <NavigationContext.Provider value={contextValue}>{children}</NavigationContext.Provider>;
}

// Navbar Component
export interface NavbarProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof navigationVariants> {
  asChild?: boolean;
  brand?: React.ReactNode;
  actions?: React.ReactNode;
}

export const Navbar = forwardRef<HTMLElement, NavbarProps>(
  ({ className, variant, size, brand, actions, children, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "nav";

    return (
      <Comp
        ref={ref}
        className={clsx(navigationVariants({ variant, size }), "navbar", className)}
        {...props}
      >
        <div className="navbar-container">
          {brand ? <div className="navbar-brand">{brand}</div> : null}

          <div className="navbar-content">{children}</div>

          {actions ? <div className="navbar-actions">{actions}</div> : null}
        </div>
      </Comp>
    );
  },
);

// Navigation Menu
export interface NavigationMenuProps extends React.HTMLAttributes<HTMLUListElement> {
  asChild?: boolean;
  orientation?: "horizontal" | "vertical";
}

export const NavigationMenu = forwardRef<HTMLUListElement, NavigationMenuProps>(
  ({ className, orientation = "horizontal", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "ul";

    return (
      <Comp
        ref={ref}
        className={clsx("navigation-menu", `orientation-${orientation}`, className)}
        {...props}
      />
    );
  },
);

// Navigation Item
export interface NavigationItemProps extends React.HTMLAttributes<HTMLLIElement> {
  asChild?: boolean;
  active?: boolean;
  disabled?: boolean;
  href?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  itemKey?: string;
}

export const NavigationItem = forwardRef<HTMLLIElement, NavigationItemProps>(
  (
    {
      className,
      active,
      disabled,
      href,
      icon,
      badge,
      itemKey,
      children,
      onClick,
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const { activeItem, onNavigate } = useNavigation();
    const isActive = active || (itemKey && activeItem === itemKey);
    const Comp = asChild ? Slot : "li";

    const handleClick = (e: React.MouseEvent<HTMLLIElement>) => {
      if (disabled) {
        e.preventDefault();
        return;
      }

      if (itemKey) {
        onNavigate?.(itemKey, href);
      }

      onClick?.(e);
    };

    return (
      <Comp
        ref={ref}
        className={clsx(
          "navigation-item",
          {
            active: isActive,
            disabled,
          },
          className,
        )}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            handleClick(e as unknown as React.MouseEvent<HTMLLIElement>);
          }
        }}
        {...props}
      >
        <div className="navigation-item-content">
          {icon ? <span className="navigation-item-icon">{icon}</span> : null}
          <span className="navigation-item-text">{children}</span>
          {badge ? <span className="navigation-item-badge">{badge}</span> : null}
        </div>
      </Comp>
    );
  },
);

// Navigation Link
export interface NavigationLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  asChild?: boolean;
  active?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  itemKey?: string;
}

export const NavigationLink = forwardRef<HTMLAnchorElement, NavigationLinkProps>(
  (
    {
      className,
      active,
      disabled,
      icon,
      badge,
      itemKey,
      children,
      onClick,
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const { activeItem, onNavigate } = useNavigation();
    const isActive = active || (itemKey && activeItem === itemKey);
    const Comp = asChild ? Slot : "a";

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (disabled) {
        e.preventDefault();
        return;
      }

      if (itemKey) {
        onNavigate?.(itemKey, props.href);
      }

      onClick?.(e);
    };

    return (
      <Comp
        ref={ref}
        className={clsx(
          "navigation-link",
          {
            active: isActive,
            disabled,
          },
          className,
        )}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            handleClick(e as unknown as React.MouseEvent<HTMLAnchorElement>);
          }
        }}
        aria-current={isActive ? "page" : undefined}
        aria-disabled={disabled ? "true" : undefined}
        {...props}
      >
        <div className="navigation-link-content">
          {icon ? <span className="navigation-link-icon">{icon}</span> : null}
          <span className="navigation-link-text">{children}</span>
          {badge ? <span className="navigation-link-badge">{badge}</span> : null}
        </div>
      </Comp>
    );
  },
);

// Sidebar Component
export interface SidebarProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof sidebarVariants> {
  asChild?: boolean;
  collapsed?: boolean;
  collapsible?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

export const Sidebar = forwardRef<HTMLElement, SidebarProps>(
  (
    {
      className,
      variant,
      size,
      position,
      behavior,
      collapsed = false,
      collapsible = false,
      onCollapsedChange,
      header,
      footer,
      children,
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "aside";

    const handleToggle = () => {
      if (collapsible) {
        onCollapsedChange?.(!collapsed);
      }
    };

    return (
      <NavigationProvider collapsed={collapsed}>
        <Comp
          ref={ref}
          className={clsx(
            sidebarVariants({ variant, size, position, behavior }),
            "sidebar",
            {
              collapsed,
              collapsible,
            },
            className,
          )}
          {...props}
        >
          {header ? (
            <div className="sidebar-header">
              {header}
              {collapsible ? (
                <button
                  type="button"
                  className="sidebar-toggle"
                  onClick={handleToggle}
                  onKeyDown={(e) => e.key === "Enter" && handleToggle}
                  aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                  <span className="toggle-icon">{collapsed ? "→" : "←"}</span>
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="sidebar-content">{children}</div>

          {footer ? <div className="sidebar-footer">{footer}</div> : null}
        </Comp>
      </NavigationProvider>
    );
  },
);

// Breadcrumb Component
export interface BreadcrumbProps extends React.HTMLAttributes<HTMLElement> {
  asChild?: boolean;
  separator?: React.ReactNode;
  maxItems?: number;
  itemsBeforeCollapse?: number;
  itemsAfterCollapse?: number;
}

export const Breadcrumb = forwardRef<HTMLElement, BreadcrumbProps>(
  (
    {
      className,
      separator = <ChevronRight className="breadcrumb-separator" />,
      maxItems,
      itemsBeforeCollapse = 1,
      itemsAfterCollapse = 1,
      children,
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "nav";
    const items = React.Children.toArray(children);

    let displayItems = items;
    let _hasCollapsedItems = false;

    if (maxItems && items.length > maxItems) {
      _hasCollapsedItems = true;
      const beforeItems = items.slice(0, itemsBeforeCollapse);
      const afterItems = items.slice(-itemsAfterCollapse);
      displayItems = [...beforeItems, <BreadcrumbEllipsis key="ellipsis" />, ...afterItems];
    }

    return (
      <Comp ref={ref} className={clsx("breadcrumb", className)} aria-label="Breadcrumb" {...props}>
        <ol className="breadcrumb-list">
          {displayItems.map((item, index) => (
            <React.Fragment key={`item-${index}`}>
              {item}
              {index < displayItems.length - 1 && (
                <li className="breadcrumb-separator-item" aria-hidden="true">
                  {separator}
                </li>
              )}
            </React.Fragment>
          ))}
        </ol>
      </Comp>
    );
  },
);

// Breadcrumb Item
export interface BreadcrumbItemProps extends React.HTMLAttributes<HTMLLIElement> {
  asChild?: boolean;
  current?: boolean;
}

export const BreadcrumbItem = forwardRef<HTMLLIElement, BreadcrumbItemProps>(
  ({ className, current = false, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "li";

    return (
      <Comp
        ref={ref}
        className={clsx(
          "breadcrumb-item",
          {
            current,
          },
          className,
        )}
        aria-current={current ? "page" : undefined}
        {...props}
      />
    );
  },
);

// Breadcrumb Link
export interface BreadcrumbLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  asChild?: boolean;
}

export const BreadcrumbLink = forwardRef<HTMLAnchorElement, BreadcrumbLinkProps>(
  ({ className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "a";

    return <Comp ref={ref} className={clsx("breadcrumb-link", className)} {...props} />;
  },
);

// Breadcrumb Page (current page, no link)
export interface BreadcrumbPageProps extends React.HTMLAttributes<HTMLSpanElement> {
  asChild?: boolean;
}

export const BreadcrumbPage = forwardRef<HTMLSpanElement, BreadcrumbPageProps>(
  ({ className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "span";

    return (
      <Comp
        ref={ref}
        className={clsx("breadcrumb-page", className)}
        role="link"
        aria-disabled="true"
        aria-current="page"
        {...props}
      />
    );
  },
);

// Breadcrumb Ellipsis
export interface BreadcrumbEllipsisProps extends React.HTMLAttributes<HTMLSpanElement> {
  asChild?: boolean;
}

export const BreadcrumbEllipsis = forwardRef<HTMLSpanElement, BreadcrumbEllipsisProps>(
  ({ className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "span";

    return (
      <BreadcrumbItem>
        <Comp
          ref={ref}
          className={clsx("breadcrumb-ellipsis", className)}
          role="presentation"
          aria-hidden="true"
          {...props}
        >
          …
        </Comp>
      </BreadcrumbItem>
    );
  },
);

// Tab Navigation
export interface TabNavigationProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
  variant?: "default" | "pills" | "underline" | "cards";
  size?: "sm" | "md" | "lg";
  value?: string;
  onValueChange?: (value: string) => void;
}

export const TabNavigation = forwardRef<HTMLDivElement, TabNavigationProps>(
  (
    {
      className,
      variant = "default",
      size = "md",
      value,
      onValueChange,
      children,
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "div";

    return (
      <NavigationProvider
        {...(value !== undefined ? { activeItem: value } : {})}
        {...(onValueChange ? { onNavigate: onValueChange } : {})}
      >
        <Comp
          ref={ref}
          className={clsx("tab-navigation", `variant-${variant}`, `size-${size}`, className)}
          role="tablist"
          {...props}
        >
          {children}
        </Comp>
      </NavigationProvider>
    );
  },
);

// Tab Item
export interface TabItemProps extends React.HTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  value: string;
  disabled?: boolean;
}

export const TabItem = forwardRef<HTMLButtonElement, TabItemProps>(
  ({ className, value, disabled = false, onClick, asChild = false, ...props }, ref) => {
    const { activeItem, onNavigate } = useNavigation();
    const isActive = activeItem === value;
    const Comp = asChild ? Slot : "button";

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!disabled) {
        onNavigate?.(value);
      }
      onClick?.(e);
    };

    return (
      <Comp
        ref={ref}
        className={clsx(
          "tab-item",
          {
            active: isActive,
            disabled,
          },
          className,
        )}
        role="tab"
        aria-selected={isActive}
        aria-disabled={disabled}
        tabIndex={isActive ? 0 : -1}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            handleClick(e as unknown as React.MouseEvent<HTMLButtonElement>);
          }
        }}
        {...props}
      />
    );
  },
);

// Set display names
Navigation.displayName = "Navigation";
Navbar.displayName = "Navbar";
NavigationMenu.displayName = "NavigationMenu";
NavigationItem.displayName = "NavigationItem";
NavigationLink.displayName = "NavigationLink";
Sidebar.displayName = "Sidebar";
Breadcrumb.displayName = "Breadcrumb";
BreadcrumbItem.displayName = "BreadcrumbItem";
BreadcrumbLink.displayName = "BreadcrumbLink";
BreadcrumbPage.displayName = "BreadcrumbPage";
BreadcrumbEllipsis.displayName = "BreadcrumbEllipsis";
TabNavigation.displayName = "TabNavigation";
TabItem.displayName = "TabItem";

export { useNavigation };
