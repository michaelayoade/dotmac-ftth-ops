/**
 * FocusGuard Component
 *
 * Guard elements to trap focus within a container
 */

'use client';

interface FocusGuardProps {
  /** Callback when guard receives focus */
  onFocus: () => void;
}

/**
 * FocusGuard - Invisible element that redirects focus
 *
 * Used internally by FocusTrap to create focus boundaries
 *
 * @internal
 */
export function FocusGuard({ onFocus }: FocusGuardProps) {
  return (
    <div
      tabIndex={0}
      onFocus={onFocus}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '1px',
        height: 0,
        padding: 0,
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        borderWidth: 0,
      }}
      aria-hidden="true"
    />
  );
}
