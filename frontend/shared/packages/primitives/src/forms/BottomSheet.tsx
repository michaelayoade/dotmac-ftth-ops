/**
 * BottomSheet - A modal that slides up from the bottom
 */

import { clsx } from "clsx";
import * as React from "react";

export interface BottomSheetProps {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export const BottomSheet = React.forwardRef<HTMLDivElement, BottomSheetProps>(
  ({ children, isOpen, onClose, className }, ref) => {
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

    const handleBackdropClick = () => {
      onClose();
    };

    const handleBackdropKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onClose();
      }
    };

    const handleContentClick = (event: React.MouseEvent<HTMLDivElement>) => {
      event.stopPropagation();
    };

    const handleContentKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      event.stopPropagation();
    };

    return (
      <div
        className={clsx("fixed inset-0 z-50 flex items-end bg-black/50", !isOpen && "hidden")}
        aria-modal="true"
        role="dialog"
        aria-label="Bottom sheet"
        aria-hidden={!isOpen}
        data-testid="bottom-sheet"
        onClick={handleBackdropClick}
        onKeyDown={handleBackdropKeyDown}
        tabIndex={isOpen ? 0 : -1}
      >
        <div
          ref={ref}
          role="document"
          className={clsx(
            "relative w-full max-h-[90vh] bg-white rounded-t-lg shadow-lg overflow-auto",
            isOpen && "animate-in slide-in-from-bottom duration-200",
            className,
          )}
          onClick={handleContentClick}
          onKeyDown={handleContentKeyDown}
        >
          {children}
        </div>
      </div>
    );
  },
);

BottomSheet.displayName = "BottomSheet";
