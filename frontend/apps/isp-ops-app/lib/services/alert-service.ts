/**
 * Alert Service
 *
 * Service for managing alerts and notifications in the UI.
 */

type AlertType = "success" | "error" | "warning" | "info";

export type AlertSeverity = "critical" | "warning" | "info" | "success";
export type AlertCategory = "security" | "billing" | "performance" | "system" | "compliance";

export interface Alert {
  id: string;
  type?: AlertType;
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  message: string;
  duration?: number;
  dismissible?: boolean;
  timestamp: Date;
  actionUrl?: string;
  actionText?: string;
}

export interface AlertStats {
  total: number;
  critical: number;
  warning: number;
  info: number;
  byCategory: {
    security: number;
    billing: number;
    performance: number;
    system: number;
    compliance: number;
  };
}

type AlertListener = (alerts: Alert[]) => void;

class AlertService {
  private listeners: AlertListener[] = [];
  private alertCounter = 0;
  private alerts: Alert[] = [];

  /**
   * Subscribe to alert events
   */
  subscribe(listener: AlertListener): () => void {
    this.listeners.push(listener);

    // Immediately send current alerts to new listener
    listener(this.alerts);

    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Emit alerts to all listeners
   */
  private emit(): void {
    this.listeners.forEach((listener) => listener(this.alerts));
  }

  /**
   * Dismiss an alert
   */
  dismissAlert(alertId: string): void {
    this.alerts = this.alerts.filter((alert) => alert.id !== alertId);
    this.emit();
  }

  /**
   * Refresh alerts from API
   */
  async refresh(): Promise<void> {
    // Placeholder - implement API call to fetch alerts
    this.emit();
  }

  /**
   * Get alerts by severity
   */
  getAlertsBySeverity(severity: AlertSeverity): Alert[] {
    return this.alerts.filter((alert) => alert.severity === severity);
  }

  /**
   * Get alerts by category
   */
  getAlertsByCategory(category: AlertCategory): Alert[] {
    return this.alerts.filter((alert) => alert.category === category);
  }

  /**
   * Get alert statistics
   */
  getAlertStats(): AlertStats {
    return {
      total: this.alerts.length,
      critical: this.alerts.filter((a) => a.severity === "critical").length,
      warning: this.alerts.filter((a) => a.severity === "warning").length,
      info: this.alerts.filter((a) => a.severity === "info").length,
      byCategory: {
        security: this.alerts.filter((a) => a.category === "security").length,
        billing: this.alerts.filter((a) => a.category === "billing").length,
        performance: this.alerts.filter((a) => a.category === "performance").length,
        system: this.alerts.filter((a) => a.category === "system").length,
        compliance: this.alerts.filter((a) => a.category === "compliance").length,
      },
    };
  }

  /**
   * Show success alert
   */
  success(message: string, title?: string, duration: number = 5000): string {
    const alert: Alert = {
      id: `alert-${++this.alertCounter}`,
      severity: "success",
      category: "system",
      title: title || "Success",
      message,
      duration,
      dismissible: true,
      timestamp: new Date(),
    };

    this.alerts.push(alert);
    this.emit();
    return alert.id;
  }

  /**
   * Show error alert
   */
  error(message: string, title?: string, duration: number = 0): string {
    const alert: Alert = {
      id: `alert-${++this.alertCounter}`,
      severity: "critical",
      category: "system",
      title: title || "Error",
      message,
      duration, // 0 = don't auto-dismiss
      dismissible: true,
      timestamp: new Date(),
    };

    this.alerts.push(alert);
    this.emit();
    return alert.id;
  }

  /**
   * Show warning alert
   */
  warning(message: string, title?: string, duration: number = 7000): string {
    const alert: Alert = {
      id: `alert-${++this.alertCounter}`,
      severity: "warning",
      category: "system",
      title: title || "Warning",
      message,
      duration,
      dismissible: true,
      timestamp: new Date(),
    };

    this.alerts.push(alert);
    this.emit();
    return alert.id;
  }

  /**
   * Show info alert
   */
  info(message: string, title?: string, duration: number = 5000): string {
    const alert: Alert = {
      id: `alert-${++this.alertCounter}`,
      severity: "info",
      category: "system",
      title: title || "Info",
      message,
      duration,
      dismissible: true,
      timestamp: new Date(),
    };

    this.alerts.push(alert);
    this.emit();
    return alert.id;
  }

  /**
   * Show custom alert
   */
  show(alert: Omit<Alert, "id">): string {
    const fullAlert: Alert = {
      ...alert,
      id: `alert-${++this.alertCounter}`,
      timestamp: alert.timestamp || new Date(),
    };

    this.alerts.push(fullAlert);
    this.emit();
    return fullAlert.id;
  }
}

// Export singleton instance
export const alertService = new AlertService();

export default alertService;
