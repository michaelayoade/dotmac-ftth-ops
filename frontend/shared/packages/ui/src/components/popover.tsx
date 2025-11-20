/**
 * Popover Component
 *
 * A floating content container that appears on top of the page content.
 * Built on Radix UI Popover primitive.
 */

import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as React from "react";

import { cn } from "../lib/utils";

type PopoverContextValue = {
  focusFirstRef: React.MutableRefObject<(() => void) | null>;
};

const PopoverContext = React.createContext<PopoverContextValue | null>(null);

const Popover = ({ children, ...props }: React.ComponentProps<typeof PopoverPrimitive.Root>) => {
  const focusFirstRef = React.useRef<(() => void) | null>(null);
  const contextValue = React.useMemo(() => ({ focusFirstRef }), [focusFirstRef]);
  return (
    <PopoverContext.Provider value={contextValue}>
      <PopoverPrimitive.Root {...props}>{children}</PopoverPrimitive.Root>
    </PopoverContext.Provider>
  );
};

const PopoverTrigger = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Trigger>
>(({ onKeyDown, ...props }, ref) => {
  const context = React.useContext(PopoverContext);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    onKeyDown?.(event);
    if (event.key === "Tab" && !event.shiftKey && context?.focusFirstRef.current) {
      event.preventDefault();
      context.focusFirstRef.current();
    }
  };

  return <PopoverPrimitive.Trigger ref={ref} onKeyDown={handleKeyDown} {...props} />;
});
PopoverTrigger.displayName = PopoverPrimitive.Trigger.displayName;
const PopoverAnchor = PopoverPrimitive.Anchor;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, onOpenAutoFocus, ...props }, ref) => {
  const context = React.useContext(PopoverContext);
  const contentRef = React.useRef<HTMLDivElement | null>(null);

  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      contentRef.current = node;
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }
    },
    [ref],
  );

  const focusFirst = React.useCallback(() => {
    const focusable = contentRef.current?.querySelector<HTMLElement>(
      'input, button, textarea, select, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();
  }, []);

  React.useEffect(() => {
    if (context) {
      context.focusFirstRef.current = focusFirst;
    }
  }, [context, focusFirst]);

  const handleOpenAutoFocus = React.useCallback(
    (event: Event) => {
      event.preventDefault();
      onOpenAutoFocus?.(event);
    },
    [onOpenAutoFocus],
  );

  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={setRefs}
        align={align}
        sideOffset={sideOffset}
        onOpenAutoFocus={handleOpenAutoFocus}
        className={cn(
          "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
});
PopoverContent.displayName = "Content";

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };
