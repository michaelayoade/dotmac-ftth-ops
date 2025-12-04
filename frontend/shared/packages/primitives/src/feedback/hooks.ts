/**
 * Client-side hooks for feedback components
 */
"use client";

import { useState } from "react";

// Simple modal hooks for compatibility
export const useModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen(!isOpen),
  };
};

export const useModalContext = useModal;
