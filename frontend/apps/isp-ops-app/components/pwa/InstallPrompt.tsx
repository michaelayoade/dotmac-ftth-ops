"use client";

/**
 * PWA Install Prompt Component
 * Prompts users to install the app as a PWA
 */

import { useState, useEffect } from "react";
import { Card, CardContent } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { X, Download, Smartphone } from "lucide-react";
import { setupInstallPrompt, showInstallPrompt, canShowInstallPrompt } from "@/lib/pwa";

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
      <Card className="shadow-2xl border-2 border-blue-500">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Smartphone className="h-6 w-6 text-blue-600" />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base mb-1">Install dotmac Ops</h3>
              <p className="text-sm text-gray-600 mb-3">
                Install our app for faster access, offline support, and notifications.
              </p>

              <div className="flex gap-2">
                <Button size="sm" onClick={handleInstall} className="flex-1">
                  <Download className="mr-2 h-4 w-4" />
                  Install
                </Button>
                <Button size="sm" variant="outline" onClick={handleDismiss}>
                  Later
                </Button>
              </div>
            </div>

            <button
              onClick={handleDismiss}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
              <div className="flex flex-col items-center text-center">
                <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center mb-1">
                  ✓
                </div>
                <span>Offline Mode</span>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center mb-1">
                  ⚡
                </div>
                <span>Fast Access</span>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center mb-1">
                  🔔
                </div>
                <span>Notifications</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
