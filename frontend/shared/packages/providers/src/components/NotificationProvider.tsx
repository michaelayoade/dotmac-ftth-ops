"use client";

import React from "react";

interface Props {
  children?: React.ReactNode;
  maxNotifications?: number;
  defaultDuration?: number;
  position?:
    | "top-right"
    | "top-left"
    | "bottom-right"
    | "bottom-left"
    | "top-center"
    | "bottom-center";
}

export function NotificationProvider({
  children,
  maxNotifications: _maxNotifications,
  defaultDuration: _defaultDuration,
  position: _position,
}: Props) {
  // Stub implementation - notification context would be provided here
  return <>{children}</>;
}
