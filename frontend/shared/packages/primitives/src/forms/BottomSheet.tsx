/**
 * BottomSheet - A modal that slides up from the bottom
 */

import * as React from "react";
import { clsx } from "clsx";

export interface BottomSheetProps {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export const BottomSheet = React.forwardRef<HTMLDivElement, BottomSheetProps>(
  ({ children, isOpen, onClose, className }, ref) => {
    const overlayRef = React.useRef<HTMLDivElement>(null);

    // Handle escape key
    React.useEffect(() => {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          onClose();
        }
      };

      if (isOpen) {
        document.addEventListener("keydown", handleEscape);
        // Prevent body scroll
        document.body.style.overflow = "hidden";
      }

      return () => {
        document.removeEventListener("keydown", handleEscape);
        document.body.style.overflow = "";
      };
    }, [isOpen, onClose]);

    // Handle backdrop click
    const handleBackdropClick = (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) {
        onClose();
      }
    };

    if (!isOpen) return null;

    return (
      <div
        ref={overlayRef}
        className="fixed inset-0 z-50 bg-black/50 flex items-end"
        onClick={handleBackdropClick}
        aria-modal="true"
        role="dialog"
      >
        <div
          ref={ref}
          className={clsx(
            "w-full max-h-[90vh] bg-white rounded-t-lg shadow-lg overflow-auto",
            "animate-in slide-in-from-bottom duration-200",
            className,
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    );
  },
);

BottomSheet.displayName = "BottomSheet";
