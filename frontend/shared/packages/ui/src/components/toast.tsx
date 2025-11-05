"use client";

import { useState, useEffect } from "react";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

let toastQueue: Toast[] = [];
let setToasts: ((toasts: Toast[]) => void) | null = null;

const addToast = (toast: Omit<Toast, "id">) => {
  const id = Math.random().toString(36).substr(2, 9);
  const newToast = { ...toast, id };

  toastQueue = [...toastQueue, newToast];
  if (setToasts) {
    setToasts([...toastQueue]);
  }

  // Auto remove after duration
  setTimeout(() => {
    removeToast(id);
  }, toast.duration || 5000);
};

const removeToast = (id: string) => {
  toastQueue = toastQueue.filter((toast) => toast.id !== id);
  if (setToasts) {
    setToasts([...toastQueue]);
  }
};

export const toast = {
  success: (message: string, duration?: number) => addToast({ type: "success", message, duration }),
  error: (message: string, duration?: number) => addToast({ type: "error", message, duration }),
  info: (message: string, duration?: number) => addToast({ type: "info", message, duration }),
  warning: (message: string, duration?: number) => addToast({ type: "warning", message, duration }),
};

const getToastIcon = (type: ToastType) => {
  switch (type) {
    case "success":
      return <CheckCircle className="h-5 w-5 text-green-400" />;
    case "error":
      return <AlertCircle className="h-5 w-5 text-red-400" />;
    case "warning":
      return <AlertTriangle className="h-5 w-5 text-yellow-400" />;
    case "info":
      return <Info className="h-5 w-5 text-blue-400" />;
  }
};

const getToastStyles = (type: ToastType) => {
  switch (type) {
    case "success":
      return "bg-green-900/90 border-green-500/50 text-green-100";
    case "error":
      return "bg-red-900/90 border-red-500/50 text-red-100";
    case "warning":
      return "bg-yellow-900/90 border-yellow-500/50 text-yellow-100";
    case "info":
      return "bg-blue-900/90 border-blue-500/50 text-blue-100";
  }
};

export function ToastContainer() {
  const [toasts, setToastsState] = useState<Toast[]>([]);

  useEffect(() => {
    setToasts = setToastsState;
    setToastsState([...toastQueue]);

    return () => {
      setToasts = null;
    };
  }, []);

  return (
    <div className="fixed top-4 right-4 z-[60] space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 p-4 rounded-lg border backdrop-blur-sm min-w-[300px] max-w-[500px] animate-in slide-in-from-right-full ${getToastStyles(toast.type)}`}
        >
          {getToastIcon(toast.type)}
          <p className="flex-1 text-sm font-medium">{toast.message}</p>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-current/70 hover:text-current transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
