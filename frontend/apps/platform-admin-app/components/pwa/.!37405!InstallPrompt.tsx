"use client";

/**
 * PWA Install Prompt Component - Platform Admin
 * Prompts admins to install the app as a PWA
 */

import { useState, useEffect } from "react";
import { Card, CardContent } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { X, Download, Monitor } from "lucide-react";
import { setupInstallPrompt, showInstallPrompt } from "@/lib/pwa";

export default function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already dismissed
    const dismissed = localStorage.getItem("pwa-install-dismissed");
    if (dismissed) {
      setDismissed(true);
      return;
    }

    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      return;
    }

    // Setup install prompt listener
    setupInstallPrompt(() => {
      setShowPrompt(true);
    });
  }, []);

  const handleInstall = async () => {
    const accepted = await showInstallPrompt();

    if (accepted) {
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setDismissed(true);
    localStorage.setItem("pwa-install-dismissed", "true");
  };

  if (!showPrompt || dismissed) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:max-w-sm">
      <Card className="shadow-2xl border-2 border-primary">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
              <Monitor className="h-6 w-6 text-primary" />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base mb-1">
                Install Admin Panel
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                Install for quick access to platform administration.
              </p>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleInstall}
                  className="flex-1"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Install
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDismiss}
                >
                  Later
                </Button>
              </div>
            </div>

            <button
              onClick={handleDismiss}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-3 pt-3 border-t">
            <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
              <div className="flex flex-col items-center text-center">
                <div className="h-8 w-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-1">
