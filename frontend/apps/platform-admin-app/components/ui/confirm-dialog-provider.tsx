"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { ConfirmDialog, type ConfirmDialogVariant } from "@/components/ui/confirm-dialog";

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

  const confirm = useCallback((opts: ConfirmDialogOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setOptions(opts);
      setOpen(true);
    });
  }, []);

  const handleConfirm = useCallback(async () => {
    resolverRef.current?.(true);
    resolverRef.current = undefined;
    setOpen(false);
    setOptions(null);
  }, []);

  const handleCancel = useCallback(() => {
    resolverRef.current?.(false);
    resolverRef.current = undefined;
    setOpen(false);
    setOptions(null);
  }, []);

  const value = useMemo(
    () => ({
      confirm,
    }),
    [confirm],
  );

  return (
    <ConfirmDialogContext.Provider value={value}>
      {children}
      <ConfirmDialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            handleCancel();
          } else {
            setOpen(true);
          }
        }}
        title={options?.title ?? "Confirm action"}
        description={options?.description ?? "Are you sure you want to continue?"}
        confirmText={options?.confirmText ?? "Confirm"}
        cancelText={options?.cancelText ?? "Cancel"}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        variant={options?.variant ?? "default"}
        isLoading={options?.isLoading}
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
