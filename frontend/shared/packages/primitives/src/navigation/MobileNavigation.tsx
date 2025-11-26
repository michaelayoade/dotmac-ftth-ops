"use client";

import { clsx } from "clsx";
import { ChevronDown, ChevronRight, Menu, X } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useFocusTrap } from "../utils/accessibility";

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon?: ComponentType<{ className?: string }>;
  badge?: string;
  children?: NavItem[];
}

interface MobileNavigationProps {
  items: NavItem[];
  currentPath: string;
  onNavigate?: (href: string) => void;
  className?: string;
  variant?: "drawer" | "tabs" | "accordion";
  showOverlay?: boolean;
}

interface RenderOptions {
  depth: number;
  currentPath: string;
  expandedItems: Set<string>;
  onToggle: (item: NavItem) => void;
  onNavigate?: (href: string) => void;
}

function renderNavTree(items: NavItem[], options: RenderOptions): ReactNode {
  const { depth, currentPath, expandedItems, onToggle, onNavigate } = options;

  return (
    <ul className={clsx(depth > 0 && "ml-4")}>
      {items.map((item) => {
        const isActive = currentPath === item.href;
        const hasChildren = (item.children?.length ?? 0) > 0;
        const isExpanded = hasChildren && expandedItems.has(item.id);
        const Icon = item.icon;

        return (
          <li key={item.id} className={clsx("py-0.5", depth > 0 && "ml-2")}>
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
                "flex w-full items-center gap-3 rounded-md px-4 py-2 text-left text-sm font-medium transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-700 hover:bg-gray-100 hover:text-gray-900",
                depth > 0 && "pl-6",
              )}
              aria-current={isActive ? "page" : undefined}
              aria-expanded={hasChildren ? isExpanded : undefined}
            >
              {Icon ? (
                <Icon
                  className={clsx(
                    "h-5 w-5 flex-shrink-0",
                    isActive ? "text-blue-600" : "text-gray-400",
                  )}
                  aria-hidden="true"
                />
              ) : null}
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
            </button>

            {hasChildren && isExpanded
              ? renderNavTree(item.children!, {
                  ...options,
                  depth: depth + 1,
                })
              : null}
          </li>
        );
      })}
    </ul>
  );
}

export { TabsNavigation as EnhancedTabNavigation };

function TabsNavigation({
  items,
  currentPath,
  onNavigate,
  className,
}: Omit<MobileNavigationProps, "variant" | "showOverlay">) {
  const [showMore, setShowMore] = useState(false);
  const primaryItems = items.slice(0, 4);
  const overflowItems = items.slice(4);

  const renderButton = (item: NavItem) => {
    const isActive = currentPath === item.href;
    const Icon = item.icon;

    return (
      <button
        type="button"
        key={item.id}
        onClick={() => onNavigate?.(item.href)}
        className={clsx(
          "flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "border-blue-500 text-blue-600"
            : "border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900",
        )}
        aria-current={isActive ? "page" : undefined}
      >
        {Icon ? (
          <Icon
            className={clsx("h-4 w-4 flex-shrink-0", isActive ? "text-blue-500" : "text-gray-400")}
          />
        ) : null}
        <span>{item.label}</span>
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
      </button>
    );
  };

  return (
    <nav role="navigation" className={clsx("mobile-nav-tabs", className)} aria-label="Navigation">
      <div className="flex items-center">
        <div className="scrollbar-hide flex overflow-x-auto">{primaryItems.map(renderButton)}</div>
        {overflowItems.length > 0 && (
          <div className="relative ml-2">
            <button
              type="button"
              onClick={() => setShowMore((prev) => !prev)}
              className="flex items-center rounded-md px-2 py-2 text-sm text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-expanded={showMore}
              aria-label="More navigation"
            >
              <ChevronDown
                className={clsx("h-4 w-4 transition-transform", showMore && "rotate-180")}
              />
              <span className="sr-only">More navigation</span>
            </button>

            {showMore && (
              <div className="absolute right-0 top-full z-20 mt-2 w-48 rounded-md border border-gray-200 bg-white shadow-lg">
                <div className="py-2">
                  {overflowItems.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => {
                        onNavigate?.(item.href);
                        setShowMore(false);
                      }}
                      className={clsx(
                        "flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none",
                        currentPath === item.href && "bg-blue-50 text-blue-700",
                      )}
                    >
                      {item.icon ? <item.icon className="h-4 w-4 text-gray-400" /> : null}
                      <span>{item.label}</span>
                      {item.badge ? (
                        <span className="ml-auto rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">
                          {item.badge}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}

export function MobileNavigation({
  items,
  currentPath,
  onNavigate,
  className = "",
  variant = "drawer",
  showOverlay = true,
}: MobileNavigationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const focusTrapRef = useFocusTrap<HTMLDivElement>(isOpen && variant === "drawer");

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  useEffect(() => {
    if (isOpen && variant === "drawer") {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
    return undefined;
  }, [isOpen, variant]);

  const toggleItem = useCallback((item: NavItem) => {
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

  const closeDrawer = useCallback(() => setIsOpen(false), []);

  const navigationContent = useMemo(
    () =>
      renderNavTree(items, {
        depth: 0,
        currentPath,
        expandedItems,
        onToggle: (item) => {
          toggleItem(item);
        },
        onNavigate: (href) => {
          onNavigate?.(href);
          if (variant === "drawer") {
            closeDrawer();
          }
        },
      }),
    [items, currentPath, expandedItems, toggleItem, onNavigate, variant, closeDrawer],
  );

  if (variant === "tabs") {
    return (
      <TabsNavigation
        items={items}
        currentPath={currentPath}
        {...(onNavigate ? { onNavigate } : {})}
        className={className}
      />
    );
  }

  if (variant === "accordion") {
    return (
      <nav
        role="navigation"
        className={clsx("mobile-nav-accordion", className)}
        aria-label="Navigation"
      >
        {navigationContent}
      </nav>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={clsx(
          "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 md:hidden",
          className,
        )}
        aria-expanded={isOpen}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
        <span>Menu</span>
      </button>

      {showOverlay && isOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          role="presentation"
          onClick={closeDrawer}
        />
      ) : null}

      <div
        ref={focusTrapRef}
        className={clsx(
          "fixed inset-y-0 left-0 z-50 w-72 transform bg-white shadow-lg transition-transform duration-300 md:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation drawer"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <span className="text-sm font-semibold text-gray-700">Navigation</span>
          <button
            type="button"
            onClick={closeDrawer}
            className="rounded-md p-2 text-gray-400 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <X className="h-5 w-5" aria-hidden="true" />
            <span className="sr-only">Close navigation</span>
          </button>
        </div>

        <nav className="h-full overflow-y-auto p-4" aria-label="Navigation">
          {navigationContent}
        </nav>
      </div>
    </>
  );
}
