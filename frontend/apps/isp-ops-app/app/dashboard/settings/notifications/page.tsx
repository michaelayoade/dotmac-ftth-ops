"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Switch } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Separator } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import {
  Mail,
  MessageSquare,
  Smartphone,
  Monitor,
  AlertCircle,
  TrendingUp,
  ShieldAlert,
  CreditCard,
  Users,
  Calendar,
  Save,
  RotateCcw,
} from "lucide-react";
import { useToast } from "@dotmac/ui";
import { logger } from "@/lib/logger";
import { apiClient } from "@/lib/api/client";
import { handleApiError } from "@/lib/error-handler";

// Migrated from sonner to useToast hook
// Note: toast options have changed:
// - sonner: toast.success('msg') -> useToast: toast({ title: 'Success', description: 'msg' })
// - sonner: toast.error('msg') -> useToast: toast({ title: 'Error', description: 'msg', variant: 'destructive' })
// - For complex options, refer to useToast documentation

// Notification categories with descriptions
const notificationCategories = [
  {
    id: "security",
    name: "Security Alerts",
    description: "Login attempts, password changes, 2FA updates",
    icon: ShieldAlert,
    color: "text-red-600 dark:text-red-400",
  },
  {
    id: "billing",
    name: "Billing & Payments",
    description: "Invoices, payment confirmations, subscription changes",
    icon: CreditCard,
    color: "text-green-600 dark:text-green-400",
  },
  {
    id: "updates",
    name: "Product Updates",
    description: "New features, improvements, maintenance notices",
    icon: TrendingUp,
    color: "text-blue-600 dark:text-blue-400",
  },
  {
    id: "marketing",
    name: "Marketing",
    description: "Promotions, newsletters, tips and tricks",
    icon: Mail,
    color: "text-purple-600 dark:text-purple-400",
  },
  {
    id: "team",
    name: "Team Activity",
    description: "Member invites, role changes, collaborations",
    icon: Users,
    color: "text-yellow-600 dark:text-yellow-400",
  },
  {
    id: "system",
    name: "System Notifications",
    description: "Errors, warnings, system status updates",
    icon: AlertCircle,
    color: "text-muted-foreground",
  },
];

type ChannelKey = "email" | "push" | "inApp" | "sms" | "slack";

type ChannelCategories = Record<string, boolean>;

interface BaseChannelPreferences {
  enabled: boolean;
  categories: ChannelCategories;
}

interface EmailPreferences extends BaseChannelPreferences {
  digest: "immediate" | "hourly" | "daily" | "weekly";
}

interface PushPreferences extends BaseChannelPreferences {
  sound: boolean;
  vibrate: boolean;
}

interface InAppPreferences extends BaseChannelPreferences {
  showBadge: boolean;
}

interface SmsPreferences extends BaseChannelPreferences {
  onlyUrgent: boolean;
}

interface SlackPreferences extends BaseChannelPreferences {
  channel: string;
}

interface QuietHoursPreferences {
  enabled: boolean;
  start: string;
  end: string;
  timezone: string;
  allowUrgent: boolean;
}

interface NotificationPreferences {
  pauseAll: boolean;
  email: EmailPreferences;
  push: PushPreferences;
  inApp: InAppPreferences;
  sms: SmsPreferences;
  slack: SlackPreferences;
  quietHours: QuietHoursPreferences;
}

const createCategoryMap = (): ChannelCategories =>
  notificationCategories.reduce((acc, category) => {
    acc[category.id] = false;
    return acc;
  }, {} as ChannelCategories);

const createDefaultPreferences = (): NotificationPreferences => ({
  pauseAll: false,
  email: {
    enabled: false,
    digest: "daily",
    categories: createCategoryMap(),
  },
  push: {
    enabled: false,
    sound: true,
    vibrate: true,
    categories: createCategoryMap(),
  },
  inApp: {
    enabled: true,
    showBadge: true,
    categories: createCategoryMap(),
  },
  sms: {
    enabled: false,
    onlyUrgent: true,
    categories: createCategoryMap(),
  },
  slack: {
    enabled: false,
    channel: "#notifications",
    categories: createCategoryMap(),
  },
  quietHours: {
    enabled: false,
    start: "22:00",
    end: "08:00",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    allowUrgent: true,
  },
});

const normalizePreferences = (
  data?: Partial<NotificationPreferences> | null,
): NotificationPreferences => {
  const defaults = createDefaultPreferences();
  return {
    pauseAll: data?.pauseAll ?? defaults.pauseAll,
    email: {
      ...defaults.email,
      ...(data?.email ?? {}),
      categories: {
        ...defaults.email.categories,
        ...(data?.email?.categories ?? {}),
      },
    },
    push: {
      ...defaults.push,
      ...(data?.push ?? {}),
      categories: {
        ...defaults.push.categories,
        ...(data?.push?.categories ?? {}),
      },
    },
    inApp: {
      ...defaults.inApp,
      ...(data?.inApp ?? {}),
      categories: {
        ...defaults.inApp.categories,
        ...(data?.inApp?.categories ?? {}),
      },
    },
    sms: {
      ...defaults.sms,
      ...(data?.sms ?? {}),
      categories: {
        ...defaults.sms.categories,
        ...(data?.sms?.categories ?? {}),
      },
    },
    slack: {
      ...defaults.slack,
      ...(data?.slack ?? {}),
      categories: {
        ...defaults.slack.categories,
        ...(data?.slack?.categories ?? {}),
      },
    },
    quietHours: {
      ...defaults.quietHours,
      ...(data?.quietHours ?? {}),
    },
  };
};

export default function NotificationSettingsPage() {
  const { toast } = useToast();

  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchPreferences = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const response = await apiClient.get("/users/me/notification-preferences");
      setPreferences(normalizePreferences(response.data as NotificationPreferences));
      setHasChanges(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load notification preferences.";
      setLoadError(message);
      setPreferences(null);
    } finally {
      setLoading(false);
    }
  }, [setHasChanges, setLoadError, setLoading, setPreferences]);

  useEffect(() => {
    void fetchPreferences();
  }, [fetchPreferences]);

  const handleChannelToggle = (channel: ChannelKey, enabled: boolean) => {
    if (!preferences) return;
    setPreferences({
      ...preferences,
      [channel]: {
        ...preferences[channel],
        enabled,
      },
    });
    setHasChanges(true);
  };

  const handleCategoryToggle = (channel: ChannelKey, category: string, enabled: boolean) => {
    if (!preferences) return;
    const channelPrefs = preferences[channel];
    setPreferences({
      ...preferences,
      [channel]: {
        ...channelPrefs,
        categories: {
          ...channelPrefs.categories,
          [category]: enabled,
        },
      },
    });
    setHasChanges(true);
  };

  const handleQuietHoursToggle = (enabled: boolean) => {
    if (!preferences) return;
    setPreferences({
      ...preferences,
      quietHours: {
        ...preferences.quietHours,
        enabled,
      },
    });
    setHasChanges(true);
  };

  const handlePauseAllToggle = (enabled: boolean) => {
    if (!preferences) return;
    setPreferences({
      ...preferences,
      pauseAll: enabled,
    });
    setHasChanges(true);
  };

  const handleSavePreferences = async () => {
    if (!preferences) return;
    setIsLoading(true);
    try {
      await apiClient.put("/users/me/notification-preferences", preferences);
      const channelKeys = ["email", "push", "inApp", "sms", "slack"] as const;
      logger.info("Notification preferences saved", {
        channels: channelKeys.filter((k) => preferences[k]?.enabled === true),
      });
      setHasChanges(false);
      toast({
        title: "Success",
        description: "Notification preferences saved",
      });
    } catch (error) {
      logger.error("Failed to save notification preferences", error);
      handleApiError(error, {
        userMessage: "Failed to save notification preferences. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetDefaults = async () => {
    try {
      await apiClient.delete("/users/me/notification-preferences");
      logger.info("Notification preferences reset to defaults");
      await fetchPreferences();
      toast({ title: "Success", description: "Reset to default preferences" });
    } catch (error) {
      logger.error("Failed to reset notification preferences", error);
      handleApiError(error, {
        userMessage: "Failed to reset preferences. Please try again.",
      });
    }
  };

  const handleTestNotification = async (channel: ChannelKey) => {
    try {
      await apiClient.post("/notifications/test", { channel });
      logger.info("Test notification sent", { channel });
      toast({
        title: "Success",
        description: `Test ${channel} notification sent`,
      });
    } catch (error) {
      logger.error("Failed to send test notification", error, { channel });
      handleApiError(error, {
        userMessage: `Failed to send test ${channel} notification.`,
      });
    }
  };

  if (loading) {
    return (
      <main className="max-w-5xl mx-auto px-6 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Notification Settings</CardTitle>
            <CardDescription>Loading your current preferences…</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Please wait while we retrieve your notification configuration.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!preferences) {
    return (
      <main className="max-w-5xl mx-auto px-6 py-12">
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle>Notification Settings Unavailable</CardTitle>
            <CardDescription>
              {loadError || "We could not load your notification settings at this time."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Try again or contact support if the problem persists.
            </p>
            <Button variant="outline" onClick={() => fetchPreferences()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Notification Settings</h1>
          <p className="text-muted-foreground mt-2">
            Manage how and when you receive notifications
          </p>
        </div>
        {hasChanges && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleResetDefaults}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button onClick={handleSavePreferences} disabled={isLoading}>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </div>
        )}
      </div>

      {/* Quick Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Settings</CardTitle>
          <CardDescription>Quickly manage your notification preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Pause All Notifications</Label>
              <p className="text-sm text-muted-foreground">Temporarily disable all notifications</p>
            </div>
            <Switch checked={preferences.pauseAll} onCheckedChange={handlePauseAllToggle} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Quiet Hours</Label>
              <p className="text-sm text-muted-foreground">
                No notifications from {preferences.quietHours.start} to {preferences.quietHours.end}
              </p>
            </div>
            <Switch
              checked={preferences.quietHours.enabled}
              onCheckedChange={handleQuietHoursToggle}
            />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="channels" className="space-y-4">
        <TabsList>
          <TabsTrigger value="channels">Channels</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
        </TabsList>

        {/* Channels Tab */}
        <TabsContent value="channels" className="space-y-4">
          {/* Email Notifications */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <div>
                    <CardTitle className="text-base">Email Notifications</CardTitle>
                    <CardDescription>Receive notifications via email</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTestNotification("email")}
                  >
                    Test
                  </Button>
                  <Switch
                    checked={preferences.email.enabled}
                    onCheckedChange={(checked) => handleChannelToggle("email", checked)}
                  />
                </div>
              </div>
            </CardHeader>
            {preferences.email.enabled && (
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Email Digest</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        value="immediate"
                        id="immediate"
                        name="email-digest"
                        checked={preferences.email.digest === "immediate"}
                        onChange={() => {
                          setPreferences({
                            ...preferences,
                            email: {
                              ...preferences.email,
                              digest: "immediate",
                            },
                          });
                          setHasChanges(true);
                        }}
                        className="h-4 w-4 rounded-full border-gray-300"
                      />
                      <Label htmlFor="immediate" className="font-normal cursor-pointer">
                        Immediate
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        value="daily"
                        id="daily"
                        name="email-digest"
                        checked={preferences.email.digest === "daily"}
                        onChange={() => {
                          setPreferences({
                            ...preferences,
                            email: { ...preferences.email, digest: "daily" },
                          });
                          setHasChanges(true);
                        }}
                        className="h-4 w-4 rounded-full border-gray-300"
                      />
                      <Label htmlFor="daily" className="font-normal cursor-pointer">
                        Daily Digest
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        value="weekly"
                        id="weekly"
                        name="email-digest"
                        checked={preferences.email.digest === "weekly"}
                        onChange={() => {
                          setPreferences({
                            ...preferences,
                            email: { ...preferences.email, digest: "weekly" },
                          });
                          setHasChanges(true);
                        }}
                        className="h-4 w-4 rounded-full border-gray-300"
                      />
                      <Label htmlFor="weekly" className="font-normal cursor-pointer">
                        Weekly Summary
                      </Label>
                    </div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Push Notifications */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <Smartphone className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <div>
                    <CardTitle className="text-base">Push Notifications</CardTitle>
                    <CardDescription>Receive notifications on your devices</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTestNotification("push")}
                  >
                    Test
                  </Button>
                  <Switch
                    checked={preferences.push.enabled}
                    onCheckedChange={(checked) => handleChannelToggle("push", checked)}
                  />
                </div>
              </div>
            </CardHeader>
            {preferences.push.enabled && (
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Sound</Label>
                  <Switch
                    checked={preferences.push.sound}
                    onCheckedChange={(checked) => {
                      setPreferences({
                        ...preferences,
                        push: { ...preferences.push, sound: checked },
                      });
                      setHasChanges(true);
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Vibration</Label>
                  <Switch
                    checked={preferences.push.vibrate}
                    onCheckedChange={(checked) => {
                      setPreferences({
                        ...preferences,
                        push: { ...preferences.push, vibrate: checked },
                      });
                      setHasChanges(true);
                    }}
                  />
                </div>
              </CardContent>
            )}
          </Card>

          {/* In-App Notifications */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <Monitor className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  <div>
                    <CardTitle className="text-base">In-App Notifications</CardTitle>
                    <CardDescription>Show notifications within the application</CardDescription>
                  </div>
                </div>
                <Switch
                  checked={preferences.inApp.enabled}
                  onCheckedChange={(checked) => handleChannelToggle("inApp", checked)}
                />
              </div>
            </CardHeader>
            {preferences.inApp.enabled && (
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Show Badge Count</Label>
                  <Switch
                    checked={preferences.inApp.showBadge}
                    onCheckedChange={(checked) => {
                      setPreferences({
                        ...preferences,
                        inApp: { ...preferences.inApp, showBadge: checked },
                      });
                      setHasChanges(true);
                    }}
                  />
                </div>
              </CardContent>
            )}
          </Card>

          {/* SMS Notifications */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                  <div>
                    <CardTitle className="text-base">SMS Notifications</CardTitle>
                    <CardDescription>Receive text messages for urgent alerts</CardDescription>
                  </div>
                </div>
                <Switch
                  checked={preferences.sms.enabled}
                  onCheckedChange={(checked) => handleChannelToggle("sms", checked)}
                />
              </div>
            </CardHeader>
            {preferences.sms.enabled && (
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Only Urgent Notifications</Label>
                  <Switch
                    checked={preferences.sms.onlyUrgent}
                    onCheckedChange={(checked) => {
                      setPreferences({
                        ...preferences,
                        sms: { ...preferences.sms, onlyUrgent: checked },
                      });
                      setHasChanges(true);
                    }}
                  />
                </div>
              </CardContent>
            )}
          </Card>

          {/* Slack Integration */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-5 w-5 text-pink-600 dark:text-pink-400" />
                  <div>
                    <CardTitle className="text-base">Slack Integration</CardTitle>
                    <CardDescription>Send notifications to your Slack workspace</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {preferences.slack.enabled && (
                    <Badge variant="outline">{preferences.slack.channel}</Badge>
                  )}
                  <Switch
                    checked={preferences.slack.enabled}
                    onCheckedChange={(checked) => handleChannelToggle("slack", checked)}
                  />
                </div>
              </div>
            </CardHeader>
          </Card>
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Categories</CardTitle>
              <CardDescription>
                Choose which types of notifications you want to receive on each channel
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {notificationCategories.map((category) => {
                  const Icon = category.icon;
                  return (
                    <div key={category.id}>
                      <div className="flex items-start gap-3 mb-3">
                        <Icon className={`h-5 w-5 mt-0.5 ${category.color}`} />
                        <div className="flex-1">
                          <p className="font-medium">{category.name}</p>
                          <p className="text-sm text-muted-foreground">{category.description}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 ml-8">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={Boolean(
                              preferences.email.categories[
                                category.id as keyof typeof preferences.email.categories
                              ],
                            )}
                            onCheckedChange={(checked) =>
                              handleCategoryToggle("email", category.id, checked)
                            }
                            disabled={!preferences.email.enabled}
                          />
                          <Label className="text-sm">Email</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={Boolean(
                              preferences.push.categories[
                                category.id as keyof typeof preferences.push.categories
                              ],
                            )}
                            onCheckedChange={(checked) =>
                              handleCategoryToggle("push", category.id, checked)
                            }
                            disabled={!preferences.push.enabled}
                          />
                          <Label className="text-sm">Push</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={Boolean(
                              preferences.inApp.categories[
                                category.id as keyof typeof preferences.inApp.categories
                              ],
                            )}
                            onCheckedChange={(checked) =>
                              handleCategoryToggle("inApp", category.id, checked)
                            }
                            disabled={!preferences.inApp.enabled}
                          />
                          <Label className="text-sm">In-App</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={Boolean(
                              preferences.sms.categories[
                                category.id as keyof typeof preferences.sms.categories
                              ],
                            )}
                            onCheckedChange={(checked) =>
                              handleCategoryToggle("sms", category.id, checked)
                            }
                            disabled={!preferences.sms.enabled}
                          />
                          <Label className="text-sm">SMS</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={Boolean(
                              preferences.slack.categories[
                                category.id as keyof typeof preferences.slack.categories
                              ],
                            )}
                            onCheckedChange={(checked) =>
                              handleCategoryToggle("slack", category.id, checked)
                            }
                            disabled={!preferences.slack.enabled}
                          />
                          <Label className="text-sm">Slack</Label>
                        </div>
                      </div>
                      {category.id !== "system" && <Separator className="mt-6" />}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quiet Hours</CardTitle>
              <CardDescription>
                Set times when you don&apos;t want to receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Quiet Hours</Label>
                  <p className="text-sm text-muted-foreground">
                    Pause non-urgent notifications during set hours
                  </p>
                </div>
                <Switch
                  checked={preferences.quietHours.enabled}
                  onCheckedChange={handleQuietHoursToggle}
                />
              </div>

              {preferences.quietHours.enabled && (
                <>
                  <Separator />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="quiet-start">Start Time</Label>
                      <select
                        id="quiet-start"
                        value={preferences.quietHours.start}
                        onChange={(e) => {
                          setPreferences({
                            ...preferences,
                            quietHours: {
                              ...preferences.quietHours,
                              start: e.target.value,
                            },
                          });
                          setHasChanges(true);
                        }}
                        className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
                      >
                        <option value="20:00">8:00 PM</option>
                        <option value="21:00">9:00 PM</option>
                        <option value="22:00">10:00 PM</option>
                        <option value="23:00">11:00 PM</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="quiet-end">End Time</Label>
                      <select
                        id="quiet-end"
                        value={preferences.quietHours.end}
                        onChange={(e) => {
                          setPreferences({
                            ...preferences,
                            quietHours: {
                              ...preferences.quietHours,
                              end: e.target.value,
                            },
                          });
                          setHasChanges(true);
                        }}
                        className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
                      >
                        <option value="06:00">6:00 AM</option>
                        <option value="07:00">7:00 AM</option>
                        <option value="08:00">8:00 AM</option>
                        <option value="09:00">9:00 AM</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Allow Urgent Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive critical security and system alerts during quiet hours
                      </p>
                    </div>
                    <Switch
                      checked={preferences.quietHours.allowUrgent}
                      onCheckedChange={(checked) => {
                        setPreferences({
                          ...preferences,
                          quietHours: {
                            ...preferences.quietHours,
                            allowUrgent: checked,
                          },
                        });
                        setHasChanges(true);
                      }}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Weekly Schedule</CardTitle>
              <CardDescription>
                Customize notification preferences for specific days
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center text-muted-foreground py-8">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm">Weekly scheduling coming soon</p>
                <p className="text-xs mt-2">
                  Set different notification rules for weekdays and weekends
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
