/**
 * Accessibility Hooks
 *
 * React hooks for implementing accessible UI patterns
 */

import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * useKeyboardNavigation
 *
 * Handle keyboard navigation for lists, menus, and grids
 *
 * @example
 * ```tsx
 * const { activeIndex, handleKeyDown } = useKeyboardNavigation({
 *   itemCount: items.length,
 *   onSelect: (index) => selectItem(items[index]),
 * });
 * ```
 */
export function useKeyboardNavigation(options: {
  itemCount: number;
  onSelect?: (index: number) => void;
  orientation?: 'vertical' | 'horizontal' | 'grid';
  loop?: boolean;
  gridColumns?: number;
}) {
  const {
    itemCount,
    onSelect,
    orientation = 'vertical',
    loop = true,
    gridColumns = 1,
  } = options;

  const [activeIndex, setActiveIndex] = useState(0);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      let newIndex = activeIndex;

      switch (event.key) {
        case 'ArrowDown':
          if (orientation === 'vertical' || orientation === 'grid') {
            event.preventDefault();
            newIndex =
              orientation === 'grid'
                ? activeIndex + gridColumns
                : activeIndex + 1;
          }
          break;

        case 'ArrowUp':
          if (orientation === 'vertical' || orientation === 'grid') {
            event.preventDefault();
            newIndex =
              orientation === 'grid'
                ? activeIndex - gridColumns
                : activeIndex - 1;
          }
          break;

        case 'ArrowRight':
          if (orientation === 'horizontal' || orientation === 'grid') {
            event.preventDefault();
            newIndex = activeIndex + 1;
          }
          break;

        case 'ArrowLeft':
          if (orientation === 'horizontal' || orientation === 'grid') {
            event.preventDefault();
            newIndex = activeIndex - 1;
          }
          break;

        case 'Home':
          event.preventDefault();
          newIndex = 0;
          break;

        case 'End':
          event.preventDefault();
          newIndex = itemCount - 1;
          break;

        case 'Enter':
        case ' ':
          event.preventDefault();
          onSelect?.(activeIndex);
          return;

        default:
          return;
      }

      // Handle looping or clamping
      if (loop) {
        newIndex = ((newIndex % itemCount) + itemCount) % itemCount;
      } else {
        newIndex = Math.max(0, Math.min(itemCount - 1, newIndex));
      }

      setActiveIndex(newIndex);
    },
    [activeIndex, itemCount, onSelect, orientation, loop, gridColumns]
  );

  return {
    activeIndex,
    setActiveIndex,
    handleKeyDown,
  };
}

/**
 * useFocusTrap
 *
 * Trap focus within a container (e.g., modal, dialog)
 *
 * @example
 * ```tsx
 * const modalRef = useFocusTrap<HTMLDivElement>(isOpen);
 *
 * return (
 *   <div ref={modalRef} role="dialog">
 *     <button>First focusable</button>
 *     <button>Last focusable</button>
 *   </div>
 * );
 * ```
 */
export function useFocusTrap<T extends HTMLElement>(
  isActive: boolean = true,
  options?: {
    initialFocus?: boolean;
    returnFocus?: boolean;
  }
) {
  const containerRef = useRef<T>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;

    // Store previously focused element
    if (options?.returnFocus !== false) {
      previouslyFocusedElement.current = document.activeElement as HTMLElement;
    }

    // Get all focusable elements
    const getFocusableElements = () => {
      const selector =
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
      return Array.from(
        container.querySelectorAll<HTMLElement>(selector)
      ).filter((el) => {
        return (
          el.offsetParent !== null &&
          !el.hasAttribute('disabled') &&
          !el.getAttribute('aria-hidden')
        );
      });
    };

    // Focus first element initially
    if (options?.initialFocus !== false) {
      const focusableElements = getFocusableElements();
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      }
    }

    // Handle tab key
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      container.removeEventListener('keydown', handleKeyDown);

      // Return focus to previously focused element
      if (options?.returnFocus !== false && previouslyFocusedElement.current) {
        previouslyFocusedElement.current.focus();
      }
    };
  }, [isActive, options?.initialFocus, options?.returnFocus]);

  return containerRef;
}

/**
 * useReducedMotion
 *
 * Detect if user prefers reduced motion
 *
 * @example
 * ```tsx
 * const prefersReducedMotion = useReducedMotion();
 *
 * return (
 *   <motion.div
 *     animate={{ opacity: 1 }}
 *     transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
 *   />
 * );
 * ```
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
}

/**
 * useAriaLive
 *
 * Announce dynamic content changes to screen readers
 *
 * @example
 * ```tsx
 * const announce = useAriaLive();
 *
 * const handleSave = async () => {
 *   await saveData();
 *   announce('Changes saved successfully', 'polite');
 * };
 * ```
 */
export function useAriaLive() {
  const liveRegionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Create hidden live region if it doesn't exist
    if (!liveRegionRef.current) {
      const liveRegion = document.createElement('div');
      liveRegion.setAttribute('role', 'status');
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.className = 'sr-only';
      liveRegion.style.cssText =
        'position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border-width: 0;';
      document.body.appendChild(liveRegion);
      liveRegionRef.current = liveRegion;
    }

    return () => {
      if (liveRegionRef.current) {
        document.body.removeChild(liveRegionRef.current);
        liveRegionRef.current = null;
      }
    };
  }, []);

  const announce = useCallback(
    (message: string, priority: 'polite' | 'assertive' = 'polite') => {
      if (liveRegionRef.current) {
        liveRegionRef.current.setAttribute('aria-live', priority);
        liveRegionRef.current.textContent = message;

        // Clear after announcement
        setTimeout(() => {
          if (liveRegionRef.current) {
            liveRegionRef.current.textContent = '';
          }
        }, 1000);
      }
    },
    []
  );

  return announce;
}

/**
 * useMediaQuery
 *
 * Track media query matches (useful for responsive accessibility)
 *
 * @example
 * ```tsx
 * const isMobile = useMediaQuery('(max-width: 768px)');
 * const prefersHighContrast = useMediaQuery('(prefers-contrast: high)');
 * ```
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [query]);

  return matches;
}

/**
 * useEscapeKey
 *
 * Handle Escape key press (useful for closing modals, dropdowns)
 *
 * @example
 * ```tsx
 * useEscapeKey(() => setIsOpen(false), isOpen);
 * ```
 */
export function useEscapeKey(
  onEscape: () => void,
  isActive: boolean = true
) {
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onEscape();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onEscape, isActive]);
}

/**
 * useId
 *
 * Generate unique IDs for accessibility attributes
 * (Polyfill for React 18's useId)
 *
 * @example
 * ```tsx
 * const id = useId();
 *
 * return (
 *   <>
 *     <label htmlFor={id}>Email</label>
 *     <input id={id} type="email" />
 *   </>
 * );
 * ```
 */
let idCounter = 0;

export function useId(prefix: string = 'id'): string {
  const [id] = useState(() => `${prefix}-${++idCounter}`);
  return id;
}

/**
 * useAnnouncer
 *
 * Hook for announcing route changes to screen readers
 *
 * @example
 * ```tsx
 * const announce = useAnnouncer();
 *
 * useEffect(() => {
 *   announce(`Navigated to ${pageTitle}`);
 * }, [pathname]);
 * ```
 */
export function useAnnouncer() {
  const announce = useAriaLive();

  return useCallback(
    (message: string) => {
      // Small delay to ensure screen reader picks it up
      setTimeout(() => {
        announce(message, 'assertive');
      }, 100);
    },
    [announce]
  );
}
