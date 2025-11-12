/**
 * Comprehensive Analytics Service
 * Integrates with multiple analytics providers and tracks user behavior
 */

export interface AnalyticsUser {
  id?: string;
  email?: string;
  name?: string;
  tenantId?: string;
  role?: string;
  properties?: Record<string, any>;
}

export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, any>;
  timestamp?: Date;
  userId?: string;
  anonymousId?: string;
  context?: AnalyticsContext;
}

export interface AnalyticsContext {
  page?: {
    path: string;
    url: string;
    title: string;
    referrer?: string;
  };
  userAgent?: string;
  ip?: string;
  location?: {
    country?: string;
    region?: string;
    city?: string;
  };
  device?: {
    type: "mobile" | "desktop" | "tablet";
    os?: string;
    browser?: string;
  };
  tenant?: {
    id: string;
    name?: string;
    plan?: string;
  };
}

export interface AnalyticsConfig {
  enabled: boolean;
  debug: boolean;
  anonymizeIp: boolean;
  respectDoNotTrack: boolean;
  sampling: {
    events: number; // 0-1
    pageViews: number; // 0-1
    errors: number; // 0-1
  };
  providers: {
    googleAnalytics?: {
      measurementId: string;
      customDimensions?: Record<string, string>;
    };
    mixpanel?: {
      token: string;
      apiSecret?: string;
    };
    amplitude?: {
      apiKey: string;
      serverUrl?: string;
    };
    hotjar?: {
      hjid: number;
      hjsv: number;
    };
    custom?: {
      endpoint: string;
      headers?: Record<string, string>;
    };
  };
  privacy: {
    enableCookieConsent: boolean;
    consentCategories: string[];
    defaultConsent: "granted" | "denied";
  };
}

export interface AnalyticsPageView {
  path: string;
  url: string;
  title: string;
  referrer?: string;
  properties?: Record<string, any>;
}

class AnalyticsService {
  private config: AnalyticsConfig;
  private user: AnalyticsUser | null = null;
  private isInitialized = false;
  private consentStatus: Record<string, boolean> = {};
  private eventQueue: AnalyticsEvent[] = [];
  private isOnline = true;

  constructor(config: Partial<AnalyticsConfig> = {}) {
    this.config = {
      enabled: true,
      debug: process.env["NODE_ENV"] === "development",
      anonymizeIp: true,
      respectDoNotTrack: true,
      sampling: {
        events: 1.0,
        pageViews: 1.0,
        errors: 1.0,
      },
      providers: {},
      privacy: {
        enableCookieConsent: true,
        consentCategories: ["analytics", "marketing", "functional"],
        defaultConsent: "denied",
      },
      ...config,
    };

    this.setupOfflineHandling();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized || !this.config.enabled || typeof window === "undefined") {
      return;
    }

    // Check Do Not Track
    if (this.config.respectDoNotTrack && navigator.doNotTrack === "1") {
      console.log("Analytics disabled due to Do Not Track");
      return;
    }

    await this.initializeProviders();
    this.setupPageTracking();
    this.setupErrorTracking();

    this.isInitialized = true;
    this.flushEventQueue();
  }

  private async initializeProviders(): Promise<void> {
    const { providers } = this.config;

    // Google Analytics 4
    if (providers.googleAnalytics) {
      await this.initializeGoogleAnalytics(providers.googleAnalytics);
    }

    // Mixpanel
    if (providers.mixpanel) {
      await this.initializeMixpanel(providers.mixpanel);
    }

    // Amplitude
    if (providers.amplitude) {
      await this.initializeAmplitude(providers.amplitude);
    }

    // Hotjar
    if (providers.hotjar) {
      await this.initializeHotjar(providers.hotjar);
    }
  }

  private async initializeGoogleAnalytics(
    config: NonNullable<AnalyticsConfig["providers"]["googleAnalytics"]>,
  ): Promise<void> {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${config.measurementId}`;
    document.head.appendChild(script);

    await new Promise((resolve) => {
      script.onload = resolve;
    });

    (window as any).dataLayer = (window as any).dataLayer || [];
    const gtag = ((window as any).gtag = (...args: any[]) => {
      (window as any).dataLayer.push(args);
    });

    gtag("js", new Date());
    gtag("config", config.measurementId, {
      anonymize_ip: this.config.anonymizeIp,
      cookie_flags: "SameSite=Strict;Secure",
      custom_map: config.customDimensions,
    });
  }

  private async initializeMixpanel(
    config: NonNullable<AnalyticsConfig["providers"]["mixpanel"]>,
  ): Promise<void> {
    const script = document.createElement("script");
    script.src = "https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js";
    document.head.appendChild(script);

    await new Promise((resolve) => {
      script.onload = resolve;
    });

    (window as any).mixpanel.init(config.token, {
      debug: this.config.debug,
      track_pageview: false, // We handle pageviews manually
      persistence: "localStorage",
    });
  }

  private async initializeAmplitude(
    config: NonNullable<AnalyticsConfig["providers"]["amplitude"]>,
  ): Promise<void> {
    const script = document.createElement("script");
    script.src = "https://cdn.amplitude.com/libs/amplitude-8.21.9-min.gz.js";
    document.head.appendChild(script);

    await new Promise((resolve) => {
      script.onload = resolve;
    });

    (window as any).amplitude.getInstance().init(config.apiKey, undefined, {
      serverUrl: config.serverUrl,
      includeUtm: true,
      includeReferrer: true,
    });
  }

  private async initializeHotjar(
    config: NonNullable<AnalyticsConfig["providers"]["hotjar"]>,
  ): Promise<void> {
    (function (h: any, o: any, t: any, j: any, a?: any, r?: any) {
      h.hj =
        h.hj ||
        function (...args: any[]) {
          (h.hj.q = h.hj.q || []).push(args);
        };
      h._hjSettings = { hjid: config.hjid, hjsv: config.hjsv };
      a = o.getElementsByTagName("head")[0];
      r = o.createElement("script");
      r.async = 1;
      r.src = t + h._hjSettings.hjid + j + h._hjSettings.hjsv;
      a.appendChild(r);
    })(window, document, "https://static.hotjar.com/c/hotjar-", ".js?sv=");
  }

  identify(user: AnalyticsUser): void {
    this.user = user;

    if (!this.shouldTrack()) return;

    const { providers } = this.config;

    // Google Analytics
    if (providers.googleAnalytics && (window as any).gtag) {
      (window as any).gtag("config", providers.googleAnalytics.measurementId, {
        user_id: user.id,
        custom_map: {
          tenant_id: user.tenantId,
          user_role: user.role,
        },
      });
    }

    // Mixpanel
    if (providers.mixpanel && (window as any).mixpanel) {
      (window as any).mixpanel.identify(user.id);
      (window as any).mixpanel.people.set({
        $email: user.email,
        $name: user.name,
        tenant_id: user.tenantId,
        role: user.role,
        ...user.properties,
      });
    }

    // Amplitude
    if (providers.amplitude && (window as any).amplitude) {
      (window as any).amplitude.getInstance().setUserId(user.id);
      (window as any).amplitude.getInstance().setUserProperties({
        email: user.email,
        name: user.name,
        tenant_id: user.tenantId,
        role: user.role,
        ...user.properties,
      });
    }

    this.debugLog("User identified:", user);
  }

  track(eventName: string, properties: Record<string, any> = {}): void {
    if (!this.shouldTrack("events")) return;

    const event: AnalyticsEvent = {
      name: eventName,
      properties: {
        ...properties,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        path: window.location.pathname,
      },
      timestamp: new Date(),
      userId: this.user?.id,
      context: this.getContext(),
    };

    if (!this.isInitialized) {
      this.eventQueue.push(event);
      return;
    }

    this.sendEvent(event);
  }

  page(pageData: Partial<AnalyticsPageView> = {}): void {
    if (!this.shouldTrack("pageViews")) return;

    const pageView: AnalyticsPageView = {
      path: window.location.pathname,
      url: window.location.href,
      title: document.title,
      referrer: document.referrer,
      ...pageData,
    };

    const { providers } = this.config;

    // Google Analytics
    if (providers.googleAnalytics && (window as any).gtag) {
      (window as any).gtag("config", providers.googleAnalytics.measurementId, {
        page_path: pageView.path,
        page_title: pageView.title,
      });
    }

    // Mixpanel
    if (providers.mixpanel && (window as any).mixpanel) {
      (window as any).mixpanel.track("Page View", {
        path: pageView.path,
        url: pageView.url,
        title: pageView.title,
        referrer: pageView.referrer,
        ...pageView.properties,
      });
    }

    // Amplitude
    if (providers.amplitude && (window as any).amplitude) {
      (window as any).amplitude.getInstance().logEvent("Page View", {
        path: pageView.path,
        url: pageView.url,
        title: pageView.title,
        referrer: pageView.referrer,
        ...pageView.properties,
      });
    }

    this.debugLog("Page view tracked:", pageView);
  }

  // ISP-specific tracking methods
  trackCustomerAction(
    action: string,
    customerId: string,
    properties: Record<string, any> = {},
  ): void {
    this.track(`customer_${action}`, {
      customer_id: customerId,
      category: "customer",
      ...properties,
    });
  }

  trackBillingEvent(event: string, properties: Record<string, any> = {}): void {
    this.track(`billing_${event}`, {
      category: "billing",
      value: properties.amount || 0,
      currency: properties.currency || "USD",
      ...properties,
    });
  }

  trackServiceUsage(serviceType: string, usage: number, unit: string = "GB"): void {
    this.track("service_usage", {
      category: "service",
      service_type: serviceType,
      usage,
      unit,
      tenant_id: this.user?.tenantId,
    });
  }

  trackSupportTicket(action: string, ticketId: string, properties: Record<string, any> = {}): void {
    this.track(`support_${action}`, {
      ticket_id: ticketId,
      category: "support",
      ...properties,
    });
  }

  trackNetworkEvent(event: string, deviceId?: string, properties: Record<string, any> = {}): void {
    this.track(`network_${event}`, {
      category: "network",
      device_id: deviceId,
      ...properties,
    });
  }

  // Conversion tracking
  trackConversion(conversionName: string, value?: number, currency: string = "USD"): void {
    const conversionData = {
      category: "conversion",
      value,
      currency,
    };

    this.track(`conversion_${conversionName}`, conversionData);

    // Google Analytics Enhanced Ecommerce
    if (this.config.providers.googleAnalytics && (window as any).gtag) {
      (window as any).gtag("event", "conversion", {
        send_to: this.config.providers.googleAnalytics.measurementId,
        value,
        currency,
      });
    }
  }

  // A/B Testing integration
  trackExperiment(experimentId: string, variantId: string): void {
    this.track("experiment_viewed", {
      experiment_id: experimentId,
      variant_id: variantId,
      category: "experiment",
    });

    // Set custom dimension for Google Analytics
    if (this.config.providers.googleAnalytics && (window as any).gtag) {
      (window as any).gtag("config", this.config.providers.googleAnalytics.measurementId, {
        experiment_id: experimentId,
        experiment_variant: variantId,
      });
    }
  }

  // Privacy and consent management
  setConsent(category: string, granted: boolean): void {
    this.consentStatus[category] = granted;

    // Update Google Analytics consent
    if (this.config.providers.googleAnalytics && (window as any).gtag) {
      (window as any).gtag("consent", "update", {
        analytics_storage: this.consentStatus.analytics ? "granted" : "denied",
        ad_storage: this.consentStatus.marketing ? "granted" : "denied",
        functionality_storage: this.consentStatus.functional ? "granted" : "denied",
      });
    }

    this.debugLog("Consent updated:", { category, granted });
  }

  private sendEvent(event: AnalyticsEvent): void {
    const { providers } = this.config;

    // Google Analytics
    if (providers.googleAnalytics && (window as any).gtag) {
      (window as any).gtag("event", event.name, event.properties);
    }

    // Mixpanel
    if (providers.mixpanel && (window as any).mixpanel) {
      (window as any).mixpanel.track(event.name, event.properties);
    }

    // Amplitude
    if (providers.amplitude && (window as any).amplitude) {
      (window as any).amplitude.getInstance().logEvent(event.name, event.properties);
    }

    // Custom endpoint
    if (providers.custom && this.isOnline) {
      fetch(providers.custom.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...providers.custom.headers,
        },
        body: JSON.stringify(event),
      }).catch((error) => {
        this.debugLog("Failed to send to custom endpoint:", error);
        // Store for retry when online
        this.eventQueue.push(event);
      });
    }

    this.debugLog("Event tracked:", event);
  }

  private getContext(): AnalyticsContext {
    const context: AnalyticsContext = {
      page: {
        path: window.location.pathname,
        url: window.location.href,
        title: document.title,
        referrer: document.referrer || undefined,
      },
      userAgent: navigator.userAgent,
      device: this.getDeviceInfo(),
    };

    if (this.user?.tenantId) {
      context.tenant = {
        id: this.user.tenantId,
        name: this.user.properties?.tenantName,
        plan: this.user.properties?.plan,
      };
    }

    return context;
  }

  private getDeviceInfo(): AnalyticsContext["device"] {
    const ua = navigator.userAgent;

    let deviceType: "mobile" | "desktop" | "tablet" = "desktop";
    if (/Mobi|Android/i.test(ua)) deviceType = "mobile";
    if (/Tablet|iPad/i.test(ua)) deviceType = "tablet";

    return {
      type: deviceType,
      os: this.extractOS(ua),
      browser: this.extractBrowser(ua),
    };
  }

  private extractOS(ua: string): string {
    if (ua.includes("Windows")) return "Windows";
    if (ua.includes("Mac")) return "macOS";
    if (ua.includes("X11") || ua.includes("Linux")) return "Linux";
    if (ua.includes("Android")) return "Android";
    if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
    return "Unknown";
  }

  private extractBrowser(ua: string): string {
    if (ua.includes("Chrome")) return "Chrome";
    if (ua.includes("Firefox")) return "Firefox";
    if (ua.includes("Safari")) return "Safari";
    if (ua.includes("Edge")) return "Edge";
    return "Unknown";
  }

  private shouldTrack(type?: "events" | "pageViews" | "errors"): boolean {
    if (!this.config.enabled) return false;

    if (type && Math.random() > this.config.sampling[type]) {
      return false;
    }

    // Check consent if required
    if (this.config.privacy.enableCookieConsent) {
      return this.consentStatus.analytics !== false;
    }

    return true;
  }

  private setupPageTracking(): void {
    // Track initial page load
    this.page();

    // Track SPA navigation
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      setTimeout(() => this.page(), 0);
    };

    history.replaceState = (...args) => {
      originalReplaceState.apply(history, args);
      setTimeout(() => this.page(), 0);
    };

    window.addEventListener("popstate", () => {
      setTimeout(() => this.page(), 0);
    });
  }

  private setupErrorTracking(): void {
    window.addEventListener("error", (event) => {
      if (this.shouldTrack("errors")) {
        this.track("javascript_error", {
          message: event.message,
          filename: event.filename,
          line: event.lineno,
          column: event.colno,
          stack: event.error?.stack,
          category: "error",
        });
      }
    });

    window.addEventListener("unhandledrejection", (event) => {
      if (this.shouldTrack("errors")) {
        this.track("unhandled_promise_rejection", {
          message: event.reason?.message || String(event.reason),
          stack: event.reason?.stack,
          category: "error",
        });
      }
    });
  }

  private setupOfflineHandling(): void {
    if (typeof window === "undefined") return;

    this.isOnline = navigator.onLine;

    window.addEventListener("online", () => {
      this.isOnline = true;
      this.flushEventQueue();
    });

    window.addEventListener("offline", () => {
      this.isOnline = false;
    });
  }

  private flushEventQueue(): void {
    if (!this.isInitialized || this.eventQueue.length === 0) return;

    const eventsToFlush = [...this.eventQueue];
    this.eventQueue = [];

    eventsToFlush.forEach((event) => {
      this.sendEvent(event);
    });
  }

  private debugLog(...args: any[]): void {
    if (this.config.debug) {
      console.log("[Analytics]", ...args);
    }
  }

  // Singleton pattern
  private static instance: AnalyticsService;

  static getInstance(config?: Partial<AnalyticsConfig>): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService(config);
    }
    return AnalyticsService.instance;
  }
}

export default AnalyticsService;

// Export singleton instance
export const analytics = AnalyticsService.getInstance();
