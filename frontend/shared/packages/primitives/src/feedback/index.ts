// Export all from Feedback except useToast which conflicts with NotificationSystem
export {
  Alert,
  AlertDescription,
  AlertTitle,
  Feedback,
  FeedbackActions,
  FeedbackDescription,
  FeedbackTitle,
  Loading,
  LoadingSkeleton,
  Progress,
  Toast,
  ToastAction,
  ToastClose,
  ToastContent,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "./Feedback";

// Export all from NotificationSystem including its version of useToast
export * from "./NotificationSystem";

// Explicitly export NotificationProvider for clarity
export { NotificationProvider } from "./NotificationSystem";

// Check if Modal exists in layout and create alias
export { Modal as ConfirmationModal } from "../layout";

// Additional aliases for backward compatibility
export { Sidebar as Drawer } from "../navigation";
export { Modal as FormModal } from "../layout";
export { Modal as ModalClose } from "../layout";
export { Modal as ModalOverlay } from "../layout";
export { Modal as ModalPortal } from "../layout";
export { Modal as ModalProvider } from "../layout";

// Export client-side hooks from separate file
export { useModal, useModalContext } from "./hooks";
