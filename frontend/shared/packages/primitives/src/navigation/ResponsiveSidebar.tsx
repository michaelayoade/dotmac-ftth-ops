"use client";

import { clsx } from "clsx";
import { ChevronLeft, ChevronRight, Menu, X } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";

import { LayoutComposers, when } from "../patterns/composition";
import { useFocusTrap } from "../utils/accessibility";

interface SidebarItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  children?: SidebarItem[];
}

interface ResponsiveSidebarProps {
  items: SidebarItem[];
  currentPath: string;
  onNavigate?: (href: string) => void;
  className?: string;
  title?: string;
  footer?: React.ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

interface SidebarItemProps {
  item: SidebarItem;
  depth: number;
  isMobile: boolean;
  hasChildren: boolean;
  isActive: boolean;
  isExpanded: boolean;
  isDesktopExpanded: boolean;
  onItemClick: (item: SidebarItem) => void;
  renderSidebarItem: (item: SidebarItem, depth: number, isMobile: boolean) => React.ReactElement;
}

// Composition-based sidebar item renderers
const SidebarItemComposers = {
  button: (item: SidebarItem, props: SidebarItemProps) => (
    <button
      type="button"
      onClick={() => props.onItemClick(item)}
      className={clsx(
        "group flex w-full items-center rounded-md px-3 py-2 font-medium text-sm transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
        {
          "bg-blue-50 text-blue-700": props.isActive && !props.isMobile,
          "bg-blue-600 text-white": props.isActive && props.isMobile,
          "text-gray-700 hover:bg-gray-100 hover:text-gray-900": !props.isActive,
          "pl-6": props.depth > 0 && (props.isMobile || props.isDesktopExpanded),
          "justify-center": !props.isMobile && !props.isDesktopExpanded,
        },
      )}
      aria-current={props.isActive ? "page" : undefined}
      aria-expanded={props.hasChildren ? props.isExpanded : undefined}
    />
  ),

  icon: (item: SidebarItem, props: SidebarItemProps) => (
    <item.icon
      className={clsx("h-5 w-5 flex-shrink-0", {
        "text-blue-500": props.isActive && !props.isMobile,
        "text-white": props.isActive && props.isMobile,
        "text-gray-400 group-hover:text-gray-500": !props.isActive,
        "mr-3": props.isMobile || props.isDesktopExpanded,
      })}
    />
  ),

  label: (item: SidebarItem) => <span className="flex-1 text-left">{item.label}</span>,

  badge: (item: SidebarItem, props: SidebarItemProps) =>
    item.badge ? (
      <span
        className={clsx(
          "ml-2 inline-flex items-center justify-center rounded-full px-2 py-1 font-bold text-xs",
          {
            "bg-blue-100 text-blue-600": props.isActive && !props.isMobile,
            "bg-white bg-opacity-20 text-white": props.isActive && props.isMobile,
            "bg-red-100 text-red-600": !props.isActive,
          },
        )}
      >
        {item.badge}
      </span>
    ) : null,

  chevron: (_item: SidebarItem, props: SidebarItemProps) =>
    props.hasChildren ? (
      <ChevronRight
        className={clsx("ml-2 h-4 w-4 transition-transform", props.isExpanded && "rotate-90")}
      />
    ) : null,

  children: (item: SidebarItem, props: SidebarItemProps) =>
    props.hasChildren && props.isExpanded && (props.isMobile || props.isDesktopExpanded) ? (
      <ul className="mt-1 space-y-1">
        {item.children?.map((child) =>
          props.renderSidebarItem(child, props.depth + 1, props.isMobile),
        )}
      </ul>
    ) : null,
};

function SidebarItem(props: SidebarItemProps) {
  const { item } = props;
  const showContent = props.isMobile || props.isDesktopExpanded;

  // Use composition to orchestrate the button content
  const buttonContent = LayoutComposers.inline("2")(
    () => SidebarItemComposers.icon(item, props),
    when(
      showContent,
      LayoutComposers.inline("2")(
        () => SidebarItemComposers.label(item),
        () => SidebarItemComposers.badge(item, props),
        () => SidebarItemComposers.chevron(item, props),
      ),
    ),
  );

  return (
    <li>
      <button
        type="button"
        onClick={() => props.onItemClick(item)}
        className={clsx(
          "group flex w-full items-center rounded-md px-3 py-2 font-medium text-sm transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
          {
            "bg-blue-50 text-blue-700": props.isActive && !props.isMobile,
            "bg-blue-600 text-white": props.isActive && props.isMobile,
            "text-gray-700 hover:bg-gray-100 hover:text-gray-900": !props.isActive,
            "pl-6": props.depth > 0 && (props.isMobile || props.isDesktopExpanded),
            "justify-center": !props.isMobile && !props.isDesktopExpanded,
          },
        )}
        aria-current={props.isActive ? "page" : undefined}
        aria-expanded={props.hasChildren ? props.isExpanded : undefined}
      >
        {buttonContent(_props)}
      </button>

      {SidebarItemComposers.children(item, props)}
    </li>
  );
}

// Sidebar composition helpers
const SidebarHelpers = {
  setupKeyboardHandlers: (isMobileOpen: boolean, setIsMobileOpen: (open: boolean) => void) => {
    useEffect(() => {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === "Escape" && isMobileOpen) {
          setIsMobileOpen(false);
        }
      };
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }, [isMobileOpen, setIsMobileOpen]);
  },

  setupScrollPrevention: (isMobileOpen: boolean) => {
    useEffect(() => {
      if (isMobileOpen) {
        document.body.style.overflow = "hidden";
        return () => {
          document.body.style.overflow = "";
        };
      }
    }, [isMobileOpen]);
  },

  createItemClickHandler:
    (
      setExpandedItems: React.Dispatch<React.SetStateAction<Set<string>>>,
      onNavigate?: (href: string) => void,
      setIsMobileOpen?: (open: boolean) => void,
    ) =>
    (item: SidebarItem) => {
      if (item.children?.length) {
        setExpandedItems((prev) => {
          const newSet = new Set(prev);
          if (newSet.has(item.id)) {
            newSet.delete(item.id);
          } else {
            newSet.add(item.id);
          }
          return newSet;
        });
      } else {
        onNavigate?.(item.href);
        setIsMobileOpen?.(false);
      }
    },

  createItemRenderer: (
    isItemActive: (href: string) => boolean,
    isItemExpanded: (id: string) => boolean,
    isDesktopExpanded: boolean,
    handleItemClick: (item: SidebarItem) => void,
  ) => {
    const renderSidebarItem = useCallback(
      (item: SidebarItem, depth = 0, isMobile = false) => {
        const hasChildren = item.children && item.children.length > 0;
        const isActive = isItemActive(item.href);
        const isExpanded = isItemExpanded(item.id);

        return (
          <SidebarItem
            key={item.id}
            item={item}
            depth={depth}
            isMobile={isMobile}
            hasChildren={hasChildren}
            isActive={isActive}
            isExpanded={isExpanded}
            isDesktopExpanded={isDesktopExpanded}
            onItemClick={handleItemClick}
            renderSidebarItem={renderSidebarItem}
          />
        );
      },
      [isItemActive, isItemExpanded, isDesktopExpanded, handleItemClick],
    );
    return renderSidebarItem;
  },
};

export function ResponsiveSidebar({
  items,
  currentPath,
  onNavigate,
  className = "",
  title = "Navigation",
  footer,
  collapsible = true,
  defaultCollapsed = false,
}: ResponsiveSidebarProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [isHovered, setIsHovered] = useState(false);

  // Focus trap for mobile drawer
  const focusTrapRef = useFocusTrap(isMobileOpen);

  // Setup handlers using composition
  SidebarHelpers.setupKeyboardHandlers(isMobileOpen, setIsMobileOpen);
  SidebarHelpers.setupScrollPrevention(isMobileOpen);

  const isDesktopExpanded = !isCollapsed || isHovered;
  const isItemActive = (href: string) => currentPath === href;
  const isItemExpanded = (id: string) => expandedItems.has(id);

  const handleItemClick = SidebarHelpers.createItemClickHandler(
    setExpandedItems,
    onNavigate,
    setIsMobileOpen,
  );

  const renderSidebarItem = SidebarHelpers.createItemRenderer(
    isItemActive,
    isItemExpanded,
    isDesktopExpanded,
    handleItemClick,
  );

  // Compose sidebar components using composition patterns
  const _SidebarComponents = {
    mobileButton: () => (
      <button
        type="button"
        onClick={() => setIsMobileOpen(true)}
        className="rounded-md p-2 text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 md:hidden"
        aria-label="Open sidebar"
        aria-expanded={isMobileOpen}
      >
        <Menu className="h-6 w-6" />
      </button>
    ),

    overlay: () =>
      when(
        () => isMobileOpen,
        () => (
          <div
            className="fixed inset-0 z-40 bg-black bg-opacity-50 md:hidden"
            onClick={() => setIsMobileOpen(false)}
            role="button"
            aria-hidden="true"
          />
        ),
      )(_props),

    mobileDrawer: () => {
      const mobileLayout = LayoutComposers.stack("0")(
        () => (
          <div className="flex items-center justify-between border-gray-200 border-b p-4">
            <h2 className="font-semibold text-gray-900 text-lg">{title}</h2>
            <button
              type="button"
              onClick={() => setIsMobileOpen(false)}
              className="rounded-md p-2 text-gray-400 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Close sidebar"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        ),
        () => (
          <nav className="flex-1 overflow-y-auto p-4">
            <ul className="space-y-1">{items.map((item) => renderSidebarItem(item, 0, true))}</ul>
          </nav>
        ),
        when(
          () => !!footer,
          () => <div className="border-gray-200 border-t p-4">{footer}</div>,
        ),
      );

      return (
        <div
          ref={focusTrapRef}
          className={clsx(
            "fixed inset-y-0 left-0 z-50 w-80 max-w-full transform bg-white shadow-xl transition-transform duration-300 ease-in-out md:hidden",
            isMobileOpen ? "translate-x-0" : "-translate-x-full",
          )}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation sidebar"
        >
          {mobileLayout(_props)}
        </div>
      );
    },

    desktopSidebar: () => {
      const desktopLayout = LayoutComposers.stack("0")(
        () => (
          <div
            className={clsx(
              "flex items-center border-gray-200 border-b p-4",
              !isDesktopExpanded && "justify-center",
            )}
          >
            {isDesktopExpanded ? (
              <h2 className="font-semibold text-gray-400 text-sm uppercase tracking-wider">
                {title}
              </h2>
            ) : null}
            {collapsible && isDesktopExpanded ? (
              <button
                type="button"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="ml-auto rounded p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        ),
        () => (
          <nav className="flex-1 overflow-y-auto p-4">
            <ul className={clsx("space-y-1", !isDesktopExpanded && "space-y-2")}>
              {items.map((item) => renderSidebarItem(item, 0, false))}
            </ul>
          </nav>
        ),
        when(
          () => !!footer,
          () => (
            <div className={clsx("border-gray-200 border-t p-4", !isDesktopExpanded && "px-2")}>
              {footer}
            </div>
          ),
        ),
      );

      return (
        <aside
          className={clsx(
            "hidden border-gray-200 border-r bg-white shadow-sm transition-all duration-200 md:flex md:flex-col",
            isDesktopExpanded ? "w-64" : "w-16",
            className,
          )}
          onMouseEnter={() => collapsible && setIsHovered(true)}
          onMouseLeave={() => collapsible && setIsHovered(false)}
        >
          {desktopLayout(_props)}
          {collapsible && isCollapsed && !isHovered ? (
            <button
              type="button"
              onClick={() => setIsCollapsed(false)}
              className="-right-3 absolute top-20 rounded-full border border-gray-200 bg-white p-1.5 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Expand sidebar"
            >
              <ChevronRight className="h-3 w-3 text-gray-600" />
            </button>
          ) : null}
        </aside>
      );
    },
  };

  const _mainLayout = LayoutComposers.stack("0")(
    SidebarComponents.mobileButton,
    SidebarComponents.overlay,
    SidebarComponents.mobileDrawer,
    SidebarComponents.desktopSidebar,
  );

  return mainLayout(props);
}
