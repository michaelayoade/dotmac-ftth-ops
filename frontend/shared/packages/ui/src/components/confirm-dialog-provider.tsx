"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

import { ConfirmDialog, type ConfirmDialogVariant } from "./confirm-dialog";

export interface ConfirmDialogOptions {
  title?: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmDialogVariant;
  isLoading?: boolean;
}

interface ConfirmDialogContextValue {
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
}

const ConfirmDialogContext = createContext<ConfirmDialogContextValue | undefined>(undefined);

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmDialogOptions | null>(null);
  const resolverRef = useRef<(value: boolean) => void>();
  const closingRef = useRef(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const triggerAriaHidden = useRef<string | null>(null);

  const confirm = useCallback((opts: ConfirmDialogOptions) => {
    return new Promise<boolean>((resolve) => {
      if (typeof document !== "undefined") {
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLElement) {
          triggerRef.current = activeElement;
          triggerAriaHidden.current = activeElement.getAttribute("aria-hidden");
          activeElement.setAttribute("aria-hidden", "true");
        } else {
          triggerRef.current = null;
          triggerAriaHidden.current = null;
        }
      }

      resolverRef.current = resolve;
      closingRef.current = false;
      setOptions(opts);
      setOpen(true);
    });
  }, []);

  const restoreTrigger = useCallback(() => {
    if (triggerRef.current) {
      if (triggerAriaHidden.current === null) {
        triggerRef.current.removeAttribute("aria-hidden");
      } else {
        triggerRef.current.setAttribute("aria-hidden", triggerAriaHidden.current);
      }

      triggerRef.current = null;
      triggerAriaHidden.current = null;
    }
  }, []);

  const closeDialog = useCallback(
    (result: boolean) => {
      closingRef.current = true;
      resolverRef.current?.(result);
      resolverRef.current = undefined;
      setOpen(false);
      setOptions(null);
      restoreTrigger();
    },
    [restoreTrigger],
  );

  const handleConfirm = useCallback(() => {
    closeDialog(true);
  }, [closeDialog]);

  const handleCancel = useCallback(() => {
    closeDialog(false);
  }, [closeDialog]);

  const handleDialogOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setOpen(true);
        return;
      }

      if (closingRef.current) {
        closingRef.current = false;
        return;
      }

      closeDialog(false);
    },
    [closeDialog],
  );

  const value = useMemo(
    () => ({
      confirm,
    }),
    [confirm],
  );

  return (
    <ConfirmDialogContext.Provider value={value}>
      <div
        aria-hidden={open ? "true" : undefined}
        data-aria-hidden={open ? "true" : undefined}
        style={open ? { pointerEvents: "none" } : { display: "contents" }}
      >
        {children}
      </div>
      <ConfirmDialog
        open={open}
        onOpenChange={handleDialogOpenChange}
        title={options?.title ?? "Confirm action"}
        description={options?.description ?? "Are you sure you want to continue?"}
        confirmText={options?.confirmText ?? "Confirm"}
        cancelText={options?.cancelText ?? "Cancel"}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        variant={options?.variant ?? "default"}
        isLoading={options?.isLoading ?? false}
      />
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirmDialog() {
  const context = useContext(ConfirmDialogContext);
  if (!context) {
    throw new Error("useConfirmDialog must be used within a ConfirmDialogProvider");
  }
  return context.confirm;
}
