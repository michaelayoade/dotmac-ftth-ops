/**
 * LiveRegion Component
 *
 * ARIA live region for announcing dynamic content changes
 */

"use client";

import { useEffect, useRef } from "react";

interface LiveRegionProps {
  /** Message to announce */
  message: string;
  /** Priority level */
  priority?: "polite" | "assertive" | "off";
  /** Whether to clear message after announcement */
  autoClear?: boolean;
  /** Delay before clearing (ms) */
  clearDelay?: number;
}

/**
 * LiveRegion - Announce dynamic content to screen readers
 *
 * @example
 * ```tsx
 * const [message, setMessage] = useState('');
 *
 * const handleSave = async () => {
 *   await saveData();
 *   setMessage('Changes saved successfully');
 * };
 *
 * return (
 *   <>
 *     <button onClick={handleSave}>Save</button>
 *     <LiveRegion message={message} />
 *   </>
 * );
 * ```
 */
export function LiveRegion({
  message,
  priority = "polite",
  autoClear = true,
  clearDelay = 1000,
}: LiveRegionProps): JSX.Element | null {
  const regionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!message || !regionRef.current) return;

    // Update the live region
    regionRef.current.textContent = message;

    // Clear after delay
    if (autoClear) {
      const timer = setTimeout(() => {
        if (regionRef.current) {
          regionRef.current.textContent = "";
        }
      }, clearDelay);

      return () => clearTimeout(timer);
    }

    return undefined;
  }, [message, autoClear, clearDelay]);

  return (
    <div
      ref={regionRef}
      role="status"
      aria-live={priority}
      aria-atomic="true"
      className="sr-only"
    />
  );
}

/**
 * StatusAnnouncer - Higher-level component for status announcements
 *
 * @example
 * ```tsx
 * const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
 *
 * return (
 *   <>
 *     <button onClick={handleAction}>Perform Action</button>
 *     <StatusAnnouncer
 *       status={status}
 *       messages={{
 *         loading: 'Loading...',
 *         success: 'Action completed successfully',
 *         error: 'Action failed',
 *       }}
 *     />
 *   </>
 * );
 * ```
 */
export function StatusAnnouncer<T extends string>({
  status,
  messages,
  priority = "polite",
}: {
  status: T;
  messages: Partial<Record<T, string>>;
  priority?: "polite" | "assertive";
}) {
  const message = messages[status] || "";

  return <LiveRegion message={message} priority={priority} />;
}
