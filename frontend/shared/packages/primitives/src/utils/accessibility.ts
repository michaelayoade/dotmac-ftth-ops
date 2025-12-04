/**
 * Accessibility utilities for keyboard navigation and ARIA support
 */

import React from "react";

import { isBrowser } from "./ssr";

/**
 * ARIA live region priorities
 */
export type AriaLive = "off" | "polite" | "assertive";

/**
 * Common keyboard key codes
 */
export const KEYS = {
  ENTER: "Enter",
  SPACE: " ",
  ESCAPE: "Escape",
  ARROW_UP: "ArrowUp",
  ARROW_DOWN: "ArrowDown",
  ARROW_LEFT: "ArrowLeft",
  ARROW_RIGHT: "ArrowRight",
  HOME: "Home",
  END: "End",
  PAGE_UP: "PageUp",
  PAGE_DOWN: "PageDown",
  TAB: "Tab",
} as const;

/**
 * Hook for managing keyboard navigation in lists/menus
 * @param items - Array of items to navigate through
 * @param options - Configuration options
 * @returns Navigation state and handlers
 */
export function useKeyboardNavigation<T>(
  items: T[],
  options: {
    loop?: boolean;
    orientation?: "horizontal" | "vertical";
    onSelect?: (item: T, index: number) => void;
    initialIndex?: number;
  } = {
    // Implementation pending
  },
) {
  const { loop = true, orientation = "vertical", onSelect, initialIndex = -1 } = options;
  const [focusedIndex, setFocusedIndex] = React.useState(initialIndex);

  const navigate = React.useCallback(
    (direction: "next" | "previous" | "first" | "last") => {
      setFocusedIndex((prevIndex) => {
        let newIndex = prevIndex;

        switch (direction) {
          case "next":
            newIndex = prevIndex + 1;
            if (newIndex >= items.length) {
              newIndex = loop ? 0 : items.length - 1;
            }
            break;
          case "previous":
            newIndex = prevIndex - 1;
            if (newIndex < 0) {
              newIndex = loop ? items.length - 1 : 0;
            }
            break;
          case "first":
            newIndex = 0;
            break;
          case "last":
            newIndex = items.length - 1;
            break;
        }

        return newIndex;
      });
    },
    [items.length, loop],
  );

  // Navigation key handlers composition
  const NavigationHandlers = {
    getNavigationKeys: (orientation: "horizontal" | "vertical") => ({
      next: orientation === "vertical" ? KEYS.ARROW_DOWN : KEYS.ARROW_RIGHT,
      prev: orientation === "vertical" ? KEYS.ARROW_UP : KEYS.ARROW_LEFT,
    }),

    handleNavigationKey: (
      key: string,
      orientation: "horizontal" | "vertical",
      navigate: (direction: "next" | "previous" | "first" | "last") => void,
      event: React.KeyboardEvent,
    ) => {
      const keys = NavigationHandlers.getNavigationKeys(orientation);

      const handlers = {
        [keys.next]: () => navigate("next"),
        [keys.prev]: () => navigate("previous"),
        [KEYS.HOME]: () => navigate("first"),
        [KEYS.END]: () => navigate("last"),
      };

      if (handlers[key]) {
        event.preventDefault();
        handlers[key]();
        return true;
      }
      return false;
    },

    handleSelectionKey: (
      key: string,
      focusedIndex: number,
      items: unknown[],
      onSelect?: (item: unknown, index: number) => void,
      event?: React.KeyboardEvent,
    ) => {
      if (key === KEYS.ENTER || key === KEYS.SPACE) {
        event?.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < items.length) {
          onSelect?.(items[focusedIndex], focusedIndex);
        }
        return true;
      }
      return false;
    },
  };

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      const { key } = event;

      // Try navigation keys first
      if (NavigationHandlers.handleNavigationKey(key, orientation, navigate, event)) {
        return;
      }

      // Then try selection keys
      NavigationHandlers.handleSelectionKey(
        key,
        focusedIndex,
        items,
        onSelect ? (item, index) => onSelect(item as T, index) : undefined,
        event,
      );
    },
    [
      orientation,
      navigate,
      focusedIndex,
      items,
      onSelect,
      NavigationHandlers.handleNavigationKey, // Then try selection keys
      NavigationHandlers.handleSelectionKey,
    ],
  );

  return {
    focusedIndex,
    setFocusedIndex,
    handleKeyDown,
    navigate,
  };
}

/**
 * Hook for managing focus trapping within a container (e.g., modals)
 * @param isActive - Whether focus trapping is active
 * @returns ref to attach to the container element
 */
// Focus trap utilities composition
const FocusTrapHelpers = {
  getFocusableElements: (container: HTMLElement): NodeListOf<HTMLElement> =>
    container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),

  getFirstAndLastElements: (elements: NodeListOf<HTMLElement>) => ({
    first: elements[0] as HTMLElement,
    last: elements[elements.length - 1] as HTMLElement,
  }),

  createTabHandler: (firstElement: HTMLElement, lastElement: HTMLElement) => (e: KeyboardEvent) => {
    if (e.key !== KEYS.TAB) {
      return;
    }

    const isShiftTab = e.shiftKey;
    const isAtFirst = document.activeElement === firstElement;
    const isAtLast = document.activeElement === lastElement;

    if (isShiftTab && isAtFirst) {
      e.preventDefault();
      lastElement?.focus();
    } else if (!isShiftTab && isAtLast) {
      e.preventDefault();
      firstElement?.focus();
    }
  },

  setupFocusTrap: (container: HTMLElement) => {
    const focusableElements = FocusTrapHelpers.getFocusableElements(container);
    const { first, last } = FocusTrapHelpers.getFirstAndLastElements(focusableElements);

    // Focus first element when trap becomes active
    first?.focus();

    const handleTabKey = FocusTrapHelpers.createTabHandler(first, last);
    document.addEventListener("keydown", handleTabKey);

    return () => document.removeEventListener("keydown", handleTabKey);
  },
};

export function useFocusTrap<TElement extends HTMLElement = HTMLElement>(isActive: boolean) {
  const containerRef = React.useRef<TElement>(null);

  React.useEffect(() => {
    if (!isActive || !isBrowser || !containerRef.current) {
      return;
    }

    return FocusTrapHelpers.setupFocusTrap(containerRef.current);
  }, [isActive]);

  return containerRef;
}

/**
 * Hook for announcing content to screen readers
 * @param message - Message to announce
 * @param priority - ARIA live priority
 */
export function useScreenReaderAnnouncement() {
  const [announcement, setAnnouncement] = React.useState("");
  const [priority, setPriority] = React.useState<AriaLive>("polite");

  const announce = React.useCallback((message: string, livePriority: AriaLive = "polite") => {
    setAnnouncement(message);
    setPriority(livePriority);
  }, []);

  // Create live region element
  const liveRegionProps = {
    "aria-live": priority,
    "aria-atomic": true,
    style: {
      position: "absolute" as const,
      left: "-10000px",
      width: "1px",
      height: "1px",
      overflow: "hidden",
    },
  };

  return { announce, announcement, liveRegionProps };
}

/**
 * Hook for managing ARIA expanded state (for collapsible content)
 * @param initialExpanded - Initial expanded state
 * @returns [expanded, toggle, setExpanded] tuple and ARIA props
 */
export function useAriaExpanded(initialExpanded = false) {
  const [expanded, setExpanded] = React.useState(initialExpanded);
  const [triggerId] = React.useState(() => `trigger-${Math.random().toString(36).substr(2, 9)}`);
  const [contentId] = React.useState(() => `content-${Math.random().toString(36).substr(2, 9)}`);

  const toggle = React.useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const triggerProps = {
    "aria-expanded": expanded,
    "aria-controls": contentId,
    id: triggerId,
  };

  const contentProps = {
    "aria-labelledby": triggerId,
    id: contentId,
    hidden: !expanded,
  };

  return {
    expanded,
    setExpanded,
    toggle,
    triggerProps,
    contentProps,
  };
}

/**
 * Hook for managing ARIA selected state (for selectable items)
 * @param options - Configuration options
 * @returns Selection state and handlers
 */
export function useAriaSelection<T>(
  options: {
    items: T[];
    multiple?: boolean;
    onSelectionChange?: (selected: T[]) => void;
  } = {
    items: [],
  },
) {
  const { items, multiple = false, onSelectionChange } = options;
  const [selectedItems, setSelectedItems] = React.useState<T[]>([]);

  const toggleSelection = React.useCallback(
    (item: T) => {
      setSelectedItems((prev) => {
        let newSelection: T[];

        if (multiple) {
          const isSelected = prev.includes(item);
          newSelection = isSelected ? prev.filter((i) => i !== item) : [...prev, item];
        } else {
          newSelection = prev.includes(item) ? [] : [item];
        }

        onSelectionChange?.(newSelection);
        return newSelection;
      });
    },
    [multiple, onSelectionChange],
  );

  const isSelected = React.useCallback(
    (item: T) => {
      return selectedItems.includes(item);
    },
    [selectedItems],
  );

  const clearSelection = React.useCallback(() => {
    setSelectedItems([]);
    onSelectionChange?.([]);
  }, []);

  return {
    selectedItems,
    toggleSelection,
    isSelected,
    clearSelection,
  };
}

/**
 * Generate unique IDs for accessibility relationships
 * @param prefix - Optional prefix for the ID
 * @returns Unique ID string
 */
export function useId(prefix = "id"): string {
  const [id] = React.useState(() => `${prefix}-${Math.random().toString(36).substr(2, 9)}`);
  return id;
}

/**
 * Hook for detecting if user prefers reduced motion
 * @returns boolean indicating reduced motion preference
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);

  React.useEffect(() => {
    if (!isBrowser) {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", listener);

    return () => mediaQuery.removeEventListener("change", listener);
  }, []);

  return prefersReducedMotion;
}

/**
 * Common ARIA role types
 */
export const ARIA_ROLES = {
  BUTTON: "button",
  MENU: "menu",
  MENUITEM: "menuitem",
  MENUBAR: "menubar",
  TAB: "tab",
  TABLIST: "tablist",
  TABPANEL: "tabpanel",
  DIALOG: "dialog",
  ALERTDIALOG: "alertdialog",
  TOOLTIP: "tooltip",
  COMBOBOX: "combobox",
  LISTBOX: "listbox",
  OPTION: "option",
  GRID: "grid",
  GRIDCELL: "gridcell",
  COLUMNHEADER: "columnheader",
  ROWHEADER: "rowheader",
  REGION: "region",
  BANNER: "banner",
  MAIN: "main",
  NAVIGATION: "navigation",
  COMPLEMENTARY: "complementary",
  CONTENTINFO: "contentinfo",
  SEARCH: "search",
  FORM: "form",
  ARTICLE: "article",
  SECTION: "section",
  LIST: "list",
  LISTITEM: "listitem",
  SEPARATOR: "separator",
  IMG: "img",
  PRESENTATION: "presentation",
  NONE: "none",
} as const;
