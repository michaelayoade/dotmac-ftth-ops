/**
 * Reusable ConfirmDialog component
 * Used for confirmation dialogs across the application
 * Supports different variants (default, destructive, warning)
 */

import { cn } from "../lib/utils";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./alert-dialog";

export type ConfirmDialogVariant = "default" | "destructive" | "warning";

interface ConfirmDialogProps {
  /**
   * Whether the dialog is open
   */
  open: boolean;

  /**
   * Callback when the open state changes
   */
  onOpenChange: (open: boolean) => void;

  /**
   * Dialog title
   */
  title: string;

  /**
   * Dialog description/message
   */
  description: string;

  /**
   * Text for the confirm button
   */
  confirmText?: string;

  /**
   * Text for the cancel button
   */
  cancelText?: string;

  /**
   * Callback when confirmed
   */
  onConfirm: () => void | Promise<void>;

  /**
   * Callback when cancelled
   */
  onCancel?: () => void;

  /**
   * Visual variant
   */
  variant?: ConfirmDialogVariant;

  /**
   * Whether the action is loading
   */
  isLoading?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  variant = "default",
  isLoading = false,
}: ConfirmDialogProps) {
  const handleConfirm = async () => {
    await onConfirm();
  };

  const handleCancel = () => {
    onCancel?.();
  };

  const buttonVariants = {
    default: "",
    destructive: "bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800",
    warning: "bg-yellow-600 hover:bg-yellow-700 dark:bg-yellow-700 dark:hover:bg-yellow-800",
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel} disabled={isLoading}>
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading}
            className={cn(buttonVariants[variant], isLoading && "opacity-50 cursor-not-allowed")}
          >
            {isLoading ? "Processing..." : confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
