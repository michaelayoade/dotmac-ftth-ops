/**
 * Utility functions for primitives
 */

import * as React from "react";

export * from "./accessibility";
export * from "./ssr";
export * from "./validation";

// Add missing exports that styled-components expects
export const isBrowser = typeof window !== "undefined";
export const isServer = !isBrowser;

export function useIsHydrated() {
  const [isHydrated, setIsHydrated] = React.useState(false);

  React.useEffect(() => {
    setIsHydrated(true);
  }, []);

  return isHydrated;
}

export function useClientEffect(effect: React.EffectCallback, deps?: React.DependencyList) {
  const isHydrated = useIsHydrated();

  React.useEffect(() => {
    if (isHydrated) {
      return effect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated, ...(deps || []), effect]);
}

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = React.useState<T>(() => {
    if (!isBrowser) {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (_error) {
      // Silently handle localStorage errors
      return initialValue;
    }
  });

  const setValue = React.useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);

        if (isBrowser) {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }
      } catch (_error) {
        // Silently handle localStorage errors
      }
    },
    [key, storedValue],
  );

  return [storedValue, setValue] as const;
}

export function useSessionStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = React.useState<T>(() => {
    if (!isBrowser) {
      return initialValue;
    }

    try {
      const item = window.sessionStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (_error) {
      // Silently handle sessionStorage errors
      return initialValue;
    }
  });

  const setValue = React.useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);

        if (isBrowser) {
          window.sessionStorage.setItem(key, JSON.stringify(valueToStore));
        }
      } catch (_error) {
        // Silently handle sessionStorage errors
      }
    },
    [key, storedValue],
  );

  return [storedValue, setValue] as const;
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(() => {
    if (!isBrowser) {
      return false;
    }
    return window.matchMedia(query).matches;
  });

  React.useEffect(() => {
    if (!isBrowser) {
      return;
    }

    const mediaQuery = window.matchMedia(query);
    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

export function useUserPreferences() {
  const [theme, setTheme] = useLocalStorage("theme", "light");
  const [language, setLanguage] = useLocalStorage("language", "en");
  const prefersReducedMotion = usePrefersReducedMotion();

  return {
    theme,
    setTheme,
    language,
    setLanguage,
    prefersReducedMotion,
  };
}

export function useKeyboardNavigation() {
  const [focusedIndex, setFocusedIndex] = React.useState(-1);

  const handleKeyDown = React.useCallback((event: KeyboardEvent, items: HTMLElement[]) => {
    switch (event.key) {
      case KEYS.ARROW_DOWN:
        event.preventDefault();
        setFocusedIndex((prev) => Math.min(prev + 1, items.length - 1));
        break;
      case KEYS.ARROW_UP:
        event.preventDefault();
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case KEYS.HOME:
        event.preventDefault();
        setFocusedIndex(0);
        break;
      case KEYS.END:
        event.preventDefault();
        setFocusedIndex(items.length - 1);
        break;
    }
  }, []);

  return { focusedIndex, handleKeyDown, setFocusedIndex };
}

export function useFocusTrap(isActive: boolean = true) {
  const containerRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    if (!isActive || !containerRef.current) {
      return;
    }

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTabKey = (event: KeyboardEvent) => {
      if (event.key !== KEYS.TAB) {
        return;
      }

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    container.addEventListener("keydown", handleTabKey);
    firstElement?.focus();

    return () => container.removeEventListener("keydown", handleTabKey);
  }, [isActive]);

  return containerRef;
}

export function useScreenReaderAnnouncement() {
  const [announcement, setAnnouncement] = React.useState("");

  const announce = React.useCallback(
    (message: string, _priority: "polite" | "assertive" = "polite") => {
      setAnnouncement(message);

      // Clear announcement after a short delay to allow for re-announcements
      setTimeout(() => setAnnouncement(""), 1000);
    },
    [],
  );

  return { announcement, announce };
}

export function useAriaExpanded() {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const toggle = React.useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const collapse = React.useCallback(() => {
    setIsExpanded(false);
  }, []);

  const expand = React.useCallback(() => {
    setIsExpanded(true);
  }, []);

  return {
    isExpanded,
    "aria-expanded": isExpanded,
    toggle,
    collapse,
    expand,
  };
}

export function useAriaSelection() {
  const [selectedItems, setSelectedItems] = React.useState<Set<string>>(new Set());

  const select = React.useCallback((id: string) => {
    setSelectedItems((prev) => new Set([...prev, id]));
  }, []);

  const deselect = React.useCallback((id: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const toggle = React.useCallback((id: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clear = React.useCallback(() => {
    setSelectedItems(new Set());
  }, []);

  const isSelected = React.useCallback(
    (id: string) => {
      return selectedItems.has(id);
    },
    [selectedItems],
  );

  return {
    selectedItems,
    select,
    deselect,
    toggle,
    clear,
    isSelected,
  };
}

// Use React.useId if available (React 18+), otherwise fallback
export const useId =
  React.useId ||
  (() => {
    const [id] = React.useState(() => `id-${Math.random().toString(36).substr(2, 9)}`);
    return id;
  });

export const KEYS = {
  ENTER: "Enter",
  SPACE: " ",
  TAB: "Tab",
  ESCAPE: "Escape",
  ARROW_UP: "ArrowUp",
  ARROW_DOWN: "ArrowDown",
  ARROW_LEFT: "ArrowLeft",
  ARROW_RIGHT: "ArrowRight",
  HOME: "Home",
  END: "End",
  PAGE_UP: "PageUp",
  PAGE_DOWN: "PageDown",
} as const;

export const ARIA_ROLES = {
  BUTTON: "button",
  LINK: "link",
  MENUITEM: "menuitem",
  OPTION: "option",
  TAB: "tab",
  TABPANEL: "tabpanel",
  DIALOG: "dialog",
  ALERTDIALOG: "alertdialog",
  TOOLTIP: "tooltip",
  COMBOBOX: "combobox",
  LISTBOX: "listbox",
  TREE: "tree",
  TREEITEM: "treeitem",
  GRID: "grid",
  GRIDCELL: "gridcell",
  TABLE: "table",
  ROW: "row",
  COLUMNHEADER: "columnheader",
  ROWHEADER: "rowheader",
} as const;
