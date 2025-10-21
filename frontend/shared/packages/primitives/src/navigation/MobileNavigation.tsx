"use client";

import { clsx } from "clsx";
import { ChevronDown, ChevronRight, Menu, X } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";

import { LayoutComposers, when } from "../patterns/composition";

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
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

  // Focus trap for drawer
  const focusTrapRef = useFocusTrap(isOpen && variant === "drawer");

  // Close drawer on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  // Prevent scroll when drawer is open
  useEffect(() => {
    if (isOpen && variant === "drawer") {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isOpen, variant]);

  const handleItemClick = (item: NavItem) => {
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
      if (variant === "drawer") {
        setIsOpen(false);
      }
    }
  };

  const isItemActive = (href: string) => currentPath === href;
  const isItemExpanded = (id: string) => expandedItems.has(id);

  // Navigation item rendering composition
  const NavItemRenderers = {
    icon: ({
      Icon,
      isActive,
    }: {
      Icon?: React.ComponentType<{ className?: string }>;
      isActive: boolean;
    }) =>
      Icon ? (
        <Icon
          className={clsx(
            "mr-3 h-5 w-5 flex-shrink-0",
            isActive ? "text-blue-500" : "text-gray-400",
          )}
        />
      ) : null,

    label: ({ label }: { label: string }) => <span className="flex-1">{label}</span>,

    badge: ({ badge, isActive }: { badge?: string; isActive: boolean }) =>
      badge ? (
        <span
          className={clsx(
            "ml-2 inline-flex items-center justify-center rounded-full px-2 py-1 font-bold text-xs",
            isActive ? "bg-blue-100 text-blue-600" : "bg-red-100 text-red-600",
          )}
        >
          {badge}
        </span>
      ) : null,

    chevron: ({ hasChildren, isExpanded }: { hasChildren: boolean; isExpanded: boolean }) =>
      hasChildren ? (
        <ChevronRight
          className={clsx("ml-2 h-4 w-4 transition-transform", isExpanded && "rotate-90")}
        />
      ) : null,

    children: ({ item, depth }: { item: NavItem; depth: number }) =>
      item.children?.length ? (
        <ul className="bg-gray-50" role="group">
          {item.children.map((child) => renderNavItem(child, depth + 1))}
        </ul>
      ) : null,
  };

  const renderNavItem = (item: NavItem, depth = 0) => {
    const hasChildren = item.children?.length > 0;
    const isActive = isItemActive(item.href);
    const isExpanded = isItemExpanded(item.id);
    const Icon = item.icon;

    // Compose the button content
    const buttonContent = LayoutComposers.inline("0")(
      ({ Icon: IconComp, isActive: active }) =>
        NavItemRenderers.icon({ Icon: IconComp, isActive: active }),
      ({ label }) => NavItemRenderers.label({ label }),
      ({ badge, isActive: active }) => NavItemRenderers.badge({ badge, isActive: active }),
      ({ hasChildren: hasChild, isExpanded: expanded }) =>
        NavItemRenderers.chevron({
          hasChildren: hasChild,
          isExpanded: expanded,
        }),
    );

    const itemLayout = LayoutComposers.stack("0")(
      () => (
        <button
          type="button"
          onClick={() => handleItemClick(item)}
          className={clsx(
            "flex w-full items-center px-4 py-3 text-left font-medium text-sm transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset",
            {
              "border-blue-700 border-r-2 bg-blue-50 text-blue-700": isActive,
              "text-gray-700 hover:bg-gray-100 hover:text-gray-900": !isActive,
              "pl-8": depth > 0,
            },
          )}
          aria-current={isActive ? "page" : undefined}
          aria-expanded={hasChildren ? isExpanded : undefined}
        >
          {buttonContent({
            Icon,
            isActive,
            label: item.label,
            badge: item.badge,
            hasChildren,
            isExpanded,
          })}
        </button>
      ),
      when(
        () => hasChildren && isExpanded,
        ({ item: navItem, depth: itemDepth }) =>
          NavItemRenderers.children({ item: navItem, depth: itemDepth }),
      ),
    );

    return (
      <li key={item.id} className={clsx("nav-item", `depth-${depth}`)}>
        {itemLayout({ item, depth })}
      </li>
    );
  };

  if (variant === "tabs") {
    return (
      <nav
        role="navigation"
        className={clsx("mobile-nav-tabs", className)}
        aria-label="Main navigation"
      >
        <div className="scrollbar-hide flex overflow-x-auto">
          {items.map((item, _index) => {
            const isActive = isItemActive(item.href);
            const Icon = item.icon;

            // Compose tab button content
            const tabContent = LayoutComposers.inline("2")(
              ({ Icon: IconComp, isActive: active }) =>
                IconComp ? (
                  <IconComp
                    className={clsx(
                      "h-4 w-4 flex-shrink-0",
                      active ? "text-blue-500" : "text-gray-400",
                    )}
                  />
                ) : null,
              ({ label }) => <span>{label}</span>,
              ({ badge, isActive: active }) => NavItemRenderers.badge({ badge, isActive: active }),
            );

            return (
              <button
                type="button"
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={clsx(
                  "flex min-w-max items-center whitespace-nowrap border-b-2 px-4 py-3 font-medium text-sm transition-colors",
                  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                  isActive
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {tabContent({
                  Icon,
                  isActive,
                  label: item.label,
                  badge: item.badge,
                })}
              </button>
            );
          })}
        </div>
      </nav>
    );
  }

  return (
    <>
      {/* Mobile menu trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={clsx(
          "rounded-md p-2 text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 md:hidden",
          className,
        )}
        aria-label="Open navigation menu"
        aria-expanded={isOpen}
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Overlay */}
      {isOpen && showOverlay ? (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 md:hidden"
          onClick={() => setIsOpen(false)}
          role="button"
          tabIndex={0}
          aria-hidden="true"
        />
      ) : null}

      {/* Mobile drawer */}
      <div
        ref={focusTrapRef}
        className={clsx(
          "fixed inset-y-0 left-0 z-50 w-80 max-w-full transform bg-white shadow-xl transition-transform duration-300 ease-in-out md:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-gray-200 border-b p-4">
          <h2 className="font-semibold text-gray-900 text-lg">Navigation</h2>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="rounded-md p-2 text-gray-400 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Close navigation menu"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Navigation items */}
        <nav role="navigation" className="flex-1 overflow-y-auto">
          <ul className="py-2">{items.map((item) => renderNavItem(item))}</ul>
        </nav>

        {/* Footer */}
        <div className="border-gray-200 border-t p-4">
          <div className="text-center text-gray-500 text-xs">Tap outside to close</div>
        </div>
      </div>
    </>
  );
}

// Enhanced tab navigation with better mobile UX
export function EnhancedTabNavigation({
  items,
  currentPath,
  onNavigate,
  className = "",
}: Omit<MobileNavigationProps, "variant">) {
  const [showAll, setShowAll] = useState(false);
  const visibleItems = showAll ? items : items.slice(0, 4);
  const hiddenItems = items.slice(4);

  return (
    <nav
      role="navigation"
      className={clsx("enhanced-tab-nav", className)}
      aria-label="Main navigation"
    >
      <div className="flex items-center">
        {/* Visible tabs */}
        <div className="scrollbar-hide flex overflow-x-auto">
          {visibleItems.map((item) => {
            const isActive = currentPath === item.href;
            const Icon = item.icon;

            return (
              <button
                type="button"
                key={item.id}
                onClick={() => onNavigate?.(item.href)}
                className={clsx(
                  "flex min-w-max items-center whitespace-nowrap border-b-2 px-3 py-2 font-medium text-sm transition-colors",
                  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                  isActive
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {Icon ? (
                  <Icon
                    className={clsx(
                      "mr-1.5 h-4 w-4 flex-shrink-0",
                      isActive ? "text-blue-500" : "text-gray-400",
                    )}
                  />
                ) : null}
                <span className="text-xs sm:text-sm">{item.label}</span>
                {item.badge ? (
                  <span
                    className={clsx(
                      "ml-1.5 inline-flex items-center justify-center rounded-full px-1.5 py-0.5 font-bold text-xs",
                      isActive ? "bg-blue-100 text-blue-600" : "bg-red-100 text-red-600",
                    )}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* More menu */}
        {hiddenItems.length > 0 && (
          <div className="relative ml-2">
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className={clsx(
                "flex items-center border-transparent border-b-2 px-2 py-2 font-medium text-gray-600 text-sm hover:text-gray-900",
                "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
              )}
              aria-expanded={showAll}
              aria-label="More navigation options"
            >
              <span className="sr-only">More</span>
              <ChevronDown
                className={clsx("h-4 w-4 transition-transform", showAll && "rotate-180")}
              />
            </button>

            {showAll ? (
              <div className="absolute top-full right-0 z-10 mt-1 w-48 rounded-md border border-gray-200 bg-white shadow-lg">
                <div className="py-1">
                  {hiddenItems.map((item) => {
                    const isActive = currentPath === item.href;
                    const Icon = item.icon;

                    return (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => {
                          onNavigate?.(item.href);
                          setShowAll(false);
                        }}
                        className={clsx(
                          "flex w-full items-center px-4 py-2 text-left text-sm hover:bg-gray-100",
                          "focus:bg-gray-100 focus:outline-none",
                          isActive && "bg-blue-50 text-blue-700",
                        )}
                      >
                        {Icon ? <Icon className="mr-3 h-4 w-4" /> : null}
                        <span>{item.label}</span>
                        {item.badge ? (
                          <span className="ml-auto rounded-full bg-red-100 px-2 py-1 font-bold text-red-600 text-xs">
                            {item.badge}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </nav>
  );
}
