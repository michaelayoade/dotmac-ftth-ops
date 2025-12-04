/**
 * Utility Hooks for DotMac Components
 */

import { useEffect, useRef, useState, useCallback } from "react";

// useId hook implementation
export function useId(prefix = "id"): string {
  const id = useRef<string>();
  if (!id.current) {
    id.current = `${prefix}-${Math.random().toString(36).substring(2, 9)}`;
  }
  return id.current;
}

// useIsHydrated hook
export function useIsHydrated(): boolean {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  return isHydrated;
}

// useClientEffect hook
export function useClientEffect(effect: () => void | (() => void), deps?: React.DependencyList) {
  const isHydrated = useIsHydrated();

  useEffect(() => {
    if (isHydrated) {
      return effect();
    }
  }, [isHydrated, ...(deps || [])]);
}

// useMediaQuery hook
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);
    mediaQuery.addEventListener("change", handler);

    return () => mediaQuery.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

// useLocalStorage hook
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      if (typeof window !== "undefined") {
        const item = window.localStorage.getItem(key);
        return item ? JSON.parse(item) : initialValue;
      }
      return initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T) => {
      try {
        setStoredValue(value);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(key, JSON.stringify(value));
        }
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key],
  );

  return [storedValue, setValue];
}

// useSessionStorage hook
export function useSessionStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      if (typeof window !== "undefined") {
        const item = window.sessionStorage.getItem(key);
        return item ? JSON.parse(item) : initialValue;
      }
      return initialValue;
    } catch (error) {
      console.warn(`Error reading sessionStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T) => {
      try {
        setStoredValue(value);
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(key, JSON.stringify(value));
        }
      } catch (error) {
        console.warn(`Error setting sessionStorage key "${key}":`, error);
      }
    },
    [key],
  );

  return [storedValue, setValue];
}

// usePrefersReducedMotion hook
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

// useUserPreferences hook
export function useUserPreferences() {
  const [theme, setTheme] = useLocalStorage("theme", "light");
  const [fontSize, setFontSize] = useLocalStorage("fontSize", "medium");
  const [language, setLanguage] = useLocalStorage("language", "en");
  const prefersReducedMotion = usePrefersReducedMotion();

  return {
    theme,
    setTheme,
    fontSize,
    setFontSize,
    language,
    setLanguage,
    prefersReducedMotion,
  };
}

// useFocusTrap hook
export function useFocusTrap(enabled: boolean = true) {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const firstFocusable = focusableElements[0] as HTMLElement;
    const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable.focus();
        }
      }
    };

    container.addEventListener("keydown", handleTabKey);
    firstFocusable?.focus();

    return () => {
      container.removeEventListener("keydown", handleTabKey);
    };
  }, [enabled]);

  return containerRef;
}

// useKeyboardNavigation hook
export function useKeyboardNavigation(items: string[], onSelect: (item: string) => void) {
  const [activeIndex, setActiveIndex] = useState(0);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (items.length === 0) {
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((prev) => (prev + 1) % items.length);
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((prev) => (prev - 1 + items.length) % items.length);
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          {
            const item = items[activeIndex];
            if (item !== undefined) {
              onSelect(item);
            }
          }
          break;
        case "Escape":
          e.preventDefault();
          setActiveIndex(0);
          break;
      }
    },
    [items, activeIndex, onSelect],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return { activeIndex, setActiveIndex };
}

// useScreenReaderAnnouncement hook
export function useScreenReaderAnnouncement() {
  const announce = useCallback((message: string, priority: "polite" | "assertive" = "polite") => {
    const announcement = document.createElement("div");
    announcement.setAttribute("aria-live", priority);
    announcement.setAttribute("aria-atomic", "true");
    announcement.className = "sr-only";
    announcement.textContent = message;

    document.body.appendChild(announcement);

    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }, []);

  return announce;
}

// useAriaExpanded hook
export function useAriaExpanded(initialExpanded = false) {
  const [expanded, setExpanded] = useState(initialExpanded);

  const toggle = useCallback(() => setExpanded((prev) => !prev), []);
  const expand = useCallback(() => setExpanded(true), []);
  const collapse = useCallback(() => setExpanded(false), []);

  return {
    expanded,
    setExpanded,
    toggle,
    expand,
    collapse,
    "aria-expanded": expanded,
  };
}

// useAriaSelection hook
export function useAriaSelection<T>(items: T[], multiSelect = false) {
  const [selectedItems, setSelectedItems] = useState<T[]>([]);

  const select = useCallback(
    (item: T) => {
      setSelectedItems((prev) => {
        if (multiSelect) {
          return prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item];
        } else {
          return [item];
        }
      });
    },
    [multiSelect],
  );

  const deselect = useCallback((item: T) => {
    setSelectedItems((prev) => prev.filter((i) => i !== item));
  }, []);

  const clear = useCallback(() => {
    setSelectedItems([]);
  }, []);

  const isSelected = useCallback(
    (item: T) => {
      return selectedItems.includes(item);
    },
    [selectedItems],
  );

  return {
    selectedItems,
    select,
    deselect,
    clear,
    isSelected,
  };
}
