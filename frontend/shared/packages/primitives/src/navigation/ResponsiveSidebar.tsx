"use client";

import { clsx } from "clsx";
import { ChevronLeft, ChevronRight, Menu, X } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useFocusTrap } from "../utils/accessibility";

interface SidebarItem {
  id: string;
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  badge?: string;
  children?: SidebarItem[];
}

interface ResponsiveSidebarProps {
  items: SidebarItem[];
  currentPath: string;
  onNavigate?: (href: string) => void;
  className?: string;
  title?: string;
  footer?: ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

interface RenderOptions {
  items: SidebarItem[];
  depth: number;
  currentPath: string;
  expandedItems: Set<string>;
  showContent: boolean;
  onToggle: (item: SidebarItem) => void;
  onNavigate?: (href: string) => void;
}

function renderSidebarItems(options: RenderOptions): ReactNode {
  const { items, depth, currentPath, expandedItems, showContent, onToggle, onNavigate } = options;

  return (
    <ul className={clsx("space-y-1", depth > 0 && "ml-2")}>
      {items.map((item) => {
        const isActive = currentPath === item.href;
        const hasChildren = (item.children?.length ?? 0) > 0;
        const isExpanded = hasChildren && expandedItems.has(item.id);
        const Icon = item.icon;

        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => {
                if (hasChildren) {
                  onToggle(item);
                } else {
                  onNavigate?.(item.href);
                }
              }}
              className={clsx(
                "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-700 hover:bg-gray-100 hover:text-gray-900",
                depth > 0 && "pl-5",
                !showContent && "justify-center",
              )}
              aria-current={isActive ? "page" : undefined}
              aria-expanded={hasChildren ? isExpanded : undefined}
            >
              <Icon
                className={clsx(
                  "h-5 w-5 flex-shrink-0",
                  isActive ? "text-blue-600" : "text-gray-400",
                )}
                aria-hidden="true"
              />
              {showContent ? (
                <>
                  <span className="flex-1">{item.label}</span>
                  {item.badge ? (
                    <span
                      className={clsx(
                        "rounded-full px-2 py-0.5 text-xs font-semibold",
                        isActive ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-600",
                      )}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                  {hasChildren ? (
                    <ChevronRight
                      className={clsx(
                        "h-4 w-4 text-gray-400 transition-transform",
                        isExpanded && "rotate-90",
                      )}
                      aria-hidden="true"
                    />
                  ) : null}
                </>
              ) : null}
            </button>

            {hasChildren && isExpanded
              ? renderSidebarItems({
                  items: item.children!,
                  depth: depth + 1,
                  currentPath,
                  expandedItems,
                  showContent,
                  onToggle,
                  ...(onNavigate ? { onNavigate } : {}),
                })
              : null}
          </li>
        );
      })}
    </ul>
  );
}

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
  const [isHovered, setIsHovered] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const focusTrapRef = useFocusTrap<HTMLDivElement>(isMobileOpen);

  const toggleItem = useCallback((item: SidebarItem) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.add(item.id);
      }
      return next;
    });
  }, []);

  const handleNavigate = useCallback(
    (href: string) => {
      onNavigate?.(href);
      setIsMobileOpen(false);
    },
    [onNavigate],
  );

  useEffect(() => {
    if (!isMobileOpen) {
      return;
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMobileOpen(false);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isMobileOpen]);

  useEffect(() => {
    if (!isMobileOpen) {
      return undefined;
    }
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isMobileOpen]);

  const showContent = collapsible ? !isCollapsed || isHovered : true;

  const navigationTree = useMemo(
    () =>
      renderSidebarItems({
        items,
        depth: 0,
        currentPath,
        expandedItems,
        showContent,
        onToggle: toggleItem,
        onNavigate: handleNavigate,
      }),
    [items, currentPath, expandedItems, showContent, toggleItem, handleNavigate],
  );

  return (
    <>
      {/* Mobile trigger */}
      <button
        type="button"
        onClick={() => setIsMobileOpen(true)}
        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 md:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
        <span>Menu</span>
      </button>

      {/* Mobile overlay */}
      {isMobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          role="presentation"
          onClick={() => setIsMobileOpen(false)}
        />
      ) : null}

      {/* Mobile drawer */}
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
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button
            type="button"
            onClick={() => setIsMobileOpen(false)}
            className="rounded-md p-2 text-gray-400 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <X className="h-5 w-5" aria-hidden="true" />
            <span className="sr-only">Close navigation</span>
          </button>
        </div>

        <nav className="flex h-full flex-col overflow-y-auto p-4" aria-label="Mobile navigation">
          {navigationTree}
          {footer ? <div className="border-t border-gray-200 pt-4">{footer}</div> : null}
        </nav>
      </div>

      {/* Desktop sidebar */}
      <aside
        className={clsx(
          "hidden h-full flex-col border-r border-gray-200 bg-white transition-all duration-200 md:flex",
          showContent ? "w-64" : "w-16",
          className,
        )}
        onMouseEnter={() => collapsible && setIsHovered(true)}
        onMouseLeave={() => collapsible && setIsHovered(false)}
      >
        <div
          className={clsx(
            "flex items-center border-b border-gray-200 px-4 py-3",
            !showContent && "justify-center",
          )}
        >
          {showContent ? (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                {title}
              </h2>
            </div>
          ) : null}
          {collapsible && (
            <button
              type="button"
              onClick={() => setIsCollapsed((prev) => !prev)}
              className={clsx(
                "ml-auto rounded-md p-1 text-gray-400 transition-colors hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                !showContent && "mx-auto",
              )}
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {showContent ? (
                <ChevronLeft className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          )}
        </div>

        <nav
          className={clsx("flex-1 overflow-y-auto p-4", !showContent && "px-2")}
          aria-label="Desktop navigation"
        >
          {navigationTree}
        </nav>

        {footer ? (
          <div className={clsx("border-t border-gray-200 p-4", !showContent && "px-2")}>
            {footer}
          </div>
        ) : null}
      </aside>
    </>
  );
}
