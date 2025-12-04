"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as React from "react";

import { cn } from "../lib/utils";

const TooltipProvider = ({
  children,
  delayDuration = 0,
  skipDelayDuration = 0,
  disableHoverableContent = true,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) => {
  React.useEffect(() => {
    const sanitizeTooltipNodes = (root: ParentNode) => {
      const potentialNodes = root.querySelectorAll<HTMLElement>('[role="tooltip"]');
      potentialNodes.forEach((tooltipNode) => {
        const inlineStyle = tooltipNode.getAttribute("style") ?? "";
        if (inlineStyle.includes("clip: rect")) {
          tooltipNode.textContent = "";
          tooltipNode.setAttribute("aria-hidden", "true");
          tooltipNode.setAttribute("data-aria-hidden", "true");
        }
      });
    };

    sanitizeTooltipNodes(document.body);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            if (node.getAttribute("role") === "tooltip") {
              const inlineStyle = node.getAttribute("style") ?? "";
              if (inlineStyle.includes("clip: rect")) {
                node.textContent = "";
                node.setAttribute("aria-hidden", "true");
                node.setAttribute("data-aria-hidden", "true");
              }
            } else {
              sanitizeTooltipNodes(node);
            }
          }
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <TooltipPrimitive.Provider
      delayDuration={delayDuration}
      skipDelayDuration={skipDelayDuration}
      disableHoverableContent={disableHoverableContent}
      {...props}
    >
      {children}
    </TooltipPrimitive.Provider>
  );
};

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => {
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

  React.useEffect(() => {
    const node = contentRef.current;
    if (!node) {
      return;
    }

    const syncTooltipNode = () => {
      const hiddenTooltip = node.querySelector('[role="tooltip"]');
      if (hiddenTooltip && hiddenTooltip !== node) {
        const hiddenId = hiddenTooltip.getAttribute("id");
        if (hiddenId) {
          node.setAttribute("id", hiddenId);
        }
      }

      const potentialHiddenNodes = document.querySelectorAll('[role="tooltip"]');
      potentialHiddenNodes.forEach((tooltipNode) => {
        if (tooltipNode === node) {
          return;
        }

        const inlineStyle = tooltipNode.getAttribute("style") ?? "";
        if (inlineStyle.includes("clip: rect")) {
          tooltipNode.textContent = "";
          tooltipNode.setAttribute("aria-hidden", "true");
          tooltipNode.setAttribute("data-aria-hidden", "true");
        }
      });

      node.setAttribute("role", "tooltip");
    };

    const observer = new MutationObserver(syncTooltipNode);
    observer.observe(node, { childList: true });
    syncTooltipNode();

    return () => observer.disconnect();
  }, [props.children]);

  return (
    <TooltipPrimitive.Content
      ref={setRefs}
      sideOffset={sideOffset}
      className={cn(
        "z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className,
      )}
      {...props}
    />
  );
});
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
