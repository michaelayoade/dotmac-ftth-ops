"use client";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { User, Mail, Phone, Lock, Bell, Globe, Loader2 } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useUpdateProfile, useChangePassword } from "@/hooks/useProfile";
import { userService, type NotificationPreferences } from "@/lib/services/user-service";
import type { User as AuthUser } from "@/lib/api/services/auth.service";

function splitName(fullName: string) {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return { first_name: undefined, last_name: undefined };
  }
  const parts = trimmed.split(/\s+/);
  const first_name = parts[0];
  const last_name = parts.length > 1 ? parts.slice(1).join(" ") : undefined;
  return { first_name, last_name };
}

function computeDisplayName(currentUser: AuthUser | null): string {
  if (!currentUser) {
    return "";
  }
  if (currentUser.first_name && currentUser.last_name) {
    return `${currentUser.first_name} ${currentUser.last_name}`;
  }
  const fallback = (currentUser as any)?.full_name as string | undefined;
  return fallback ?? currentUser.username ?? currentUser.email ?? "";
}

export default function ProfilePage() {
  const { toast } = useToast();
  const { user, refreshUser } = useAuth();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notifyBilling, setNotifyBilling] = useState(true);
  const [notifySecurity, setNotifySecurity] = useState(true);
  const [notifyProduct, setNotifyProduct] = useState(false);
  const [interfaceLanguage, setInterfaceLanguage] = useState("en-US");
  const [timezone, setTimezone] = useState("America/Chicago");
  const [profileSavedMessage, setProfileSavedMessage] = useState<string | null>(null);
  const [notificationsMessage, setNotificationsMessage] = useState<string | null>(null);

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    current: "",
    next: "",
    confirm: "",
  });

  const notificationMutation = useMutation({
    mutationFn: async (preferences: Partial<NotificationPreferences>) =>
      userService.updateNotificationPreferences(preferences),
  });

  const settingsMutation = useMutation({
    mutationFn: async (data: Parameters<typeof userService.updateSettings>[0]) =>
      userService.updateSettings(data),
  });

  useEffect(() => {
    if (!user) {
      return;
    }
    const displayName = computeDisplayName(user);
    setFullName(displayName);
    setEmail(user.email ?? "");
    setInterfaceLanguage((user as any)?.language ?? "en-US");
  }, [user]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const prefs = await userService.getNotificationPreferences();
        if (!mounted || !prefs) {
          return;
        }
        setNotifyBilling(Boolean(prefs.email_notifications));
        setNotifySecurity(Boolean(prefs.security_alerts));
        setNotifyProduct(Boolean(prefs.product_updates));
      } catch {
        // ignore missing preferences
      }
    })();

    (async () => {
      try {
        const settings = await userService.getSettings();
        if (!mounted || !settings) {
          return;
        }
        const prefs = settings.preferences ?? {};
        const language = (prefs.language as string) || (settings as any).language;
        const tz = (prefs.timezone as string) || (prefs.tz as string);
        if (language) {
          setInterfaceLanguage(language);
        }
        if (tz) {
          setTimezone(tz);
        }
      } catch {
        // ignore missing settings
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const handleResetProfile = () => {
    if (!user) {
      return;
    }
    const displayName = computeDisplayName(user);
    setFullName(displayName);
    setEmail(user.email ?? "");
    setPhone("");
    setProfileSavedMessage(null);
  };

  const handleSaveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      return;
    }

    setSavingProfile(true);
    setProfileSavedMessage(null);

    try {
      const { first_name, last_name } = splitName(fullName);
      await updateProfile.mutateAsync({
        first_name,
        last_name,
        email,
        phone,
        language: interfaceLanguage,
        timezone,
      });
      await refreshUser();
      setProfileSavedMessage("Profile updated successfully.");
      toast({
        title: "Profile updated",
        description: "Your contact information has been saved.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update profile.";
      toast({
        title: "Unable to update profile",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordChange = async () => {
    if (passwordForm.next !== passwordForm.confirm) {
      toast({
        title: "Passwords do not match",
        description: "Confirm your new password before saving.",
        variant: "destructive",
      });
      return;
    }

    setSavingPassword(true);
    try {
      await changePassword.mutateAsync({
        current_password: passwordForm.current,
        new_password: passwordForm.next,
      });
      toast({
        title: "Password changed",
        description: "Use your new password next time you sign in.",
      });
      setPasswordForm({ current: "", next: "", confirm: "" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to change password.";
      toast({
        title: "Unable to change password",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSaveNotifications = async () => {
    setSavingNotifications(true);
    setNotificationsMessage(null);
    try {
      await notificationMutation.mutateAsync({
        email_notifications: notifyBilling,
        security_alerts: notifySecurity,
        product_updates: notifyProduct,
        sms_notifications: notifyBilling,
      });
      setNotificationsMessage("Notification preferences updated.");
      toast({
        title: "Notifications updated",
        description: "Your preferences are now saved.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update notifications.";
      toast({
        title: "Unable to update notifications",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSavingNotifications(false);
    }
  };

  const handleUpdatePreferences = async () => {
    setSavingPreferences(true);
    try {
      await settingsMutation.mutateAsync({
        preferences: {
          language: interfaceLanguage,
          timezone,
        },
      });
      toast({
        title: "Preferences saved",
        description: "Language and timezone have been updated.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update preferences.";
      toast({
        title: "Unable to update preferences",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSavingPreferences(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-background/80 px-6 py-12">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to dashboard
          </Link>
          <h1 className="text-3xl font-semibold text-foreground">Profile & account preferences</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Keep your contact details current, manage notification delivery and update your password
            to maintain a secure account.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <User className="h-5 w-5 text-muted-foreground" />
                  Personal details
                </CardTitle>
                <CardDescription>
                  These details appear on invoices and administrative activity logs.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="grid gap-4 md:grid-cols-2"
                  onSubmit={handleSaveProfile}
                  data-testid="profile-form"
                >
                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="name">Full name</Label>
                    <Input
                      id="name"
                      name="full_name"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      Email address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      name="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      autoComplete="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      Phone number
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      name="phone"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      autoComplete="tel"
                    />
                  </div>
                  <div className="md:col-span-2 flex flex-wrap justify-end gap-3">
                    <Button type="button" variant="outline" onClick={handleResetProfile}>
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      data-testid="profile-save-button"
                      disabled={savingProfile}
                    >
                      {savingProfile ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving…
                        </>
                      ) : (
                        "Save changes"
                      )}
                    </Button>
                  </div>
                  {profileSavedMessage && (
                    <div
                      className="md:col-span-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
                      data-testid="success-message"
                    >
                      {profileSavedMessage}
                    </div>
                  )}
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                  Password & security
                </CardTitle>
                <CardDescription>
                  Update your password and check the status of multi-factor authentication.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current password</Label>
                  <Input
                    id="current-password"
                    type="password"
                    name="current_password"
                    value={passwordForm.current}
                    onChange={(event) =>
                      setPasswordForm((prev) => ({
                        ...prev,
                        current: event.target.value,
                      }))
                    }
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    name="new_password"
                    value={passwordForm.next}
                    onChange={(event) =>
                      setPasswordForm((prev) => ({
                        ...prev,
                        next: event.target.value,
                      }))
                    }
                    placeholder="Create a strong password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm new password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    name="confirm_password"
                    value={passwordForm.confirm}
                    onChange={(event) =>
                      setPasswordForm((prev) => ({
                        ...prev,
                        confirm: event.target.value,
                      }))
                    }
                    placeholder="Repeat new password"
                  />
                </div>
                <div className="md:col-span-2 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setPasswordForm({ current: "", next: "", confirm: "" })}
                  >
                    Reset fields
                  </Button>
                  <Button
                    type="button"
                    onClick={handlePasswordChange}
                    disabled={savingPassword}
                    data-testid="update-password-button"
                  >
                    {savingPassword ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating…
                      </>
                    ) : (
                      "Update password"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                  Notifications
                </CardTitle>
                <CardDescription>Choose which updates arrive in your inbox.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Billing activity</p>
                    <p className="text-xs text-muted-foreground">
                      Invoices, payment receipts and refund notices.
                    </p>
                  </div>
                  <Switch
                    checked={notifyBilling}
                    onCheckedChange={setNotifyBilling}
                    aria-label="Toggle billing notifications"
                  />
                </div>
                <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Security alerts</p>
                    <p className="text-xs text-muted-foreground">
                      Unusual sign-in attempts or MFA resets.
                    </p>
                  </div>
                  <Switch
                    checked={notifySecurity}
                    onCheckedChange={setNotifySecurity}
                    aria-label="Toggle security notifications"
                  />
                </div>
                <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Product updates</p>
                    <p className="text-xs text-muted-foreground">
                      New features, release notes and roadmap previews.
                    </p>
                  </div>
                  <Switch
                    checked={notifyProduct}
                    onCheckedChange={setNotifyProduct}
                    aria-label="Toggle product notifications"
                  />
                </div>
                <Button
                  type="button"
                  className="w-full"
                  onClick={handleSaveNotifications}
                  disabled={savingNotifications}
                  data-testid="notifications-save-button"
                >
                  {savingNotifications ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save notification settings"
                  )}
                </Button>
                {notificationsMessage && (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                    {notificationsMessage}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <Globe className="h-5 w-5 text-muted-foreground" />
                  Locale preferences
                </CardTitle>
                <CardDescription>Tailor your experience for language and timezone.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="language">Language</Label>
                  <select
                    id="language"
                    value={interfaceLanguage}
                    onChange={(event) => setInterfaceLanguage(event.target.value)}
                    className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none"
                  >
                    <option value="en-US">English (United States)</option>
                    <option value="en-GB">English (United Kingdom)</option>
                    <option value="fr-FR">Français</option>
                    <option value="es-ES">Español</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <select
                    id="timezone"
                    value={timezone}
                    onChange={(event) => setTimezone(event.target.value)}
                    className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none"
                  >
                    <option value="UTC">UTC</option>
                    <option value="America/Chicago">America/Chicago</option>
                    <option value="America/New_York">America/New_York</option>
                    <option value="Europe/London">Europe/London</option>
                    <option value="Asia/Tokyo">Asia/Tokyo</option>
                  </select>
                </div>
                <Button
                  type="button"
                  className="w-full"
                  onClick={handleUpdatePreferences}
                  disabled={savingPreferences}
                  data-testid="preferences-save-button"
                >
                  {savingPreferences ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Update preferences"
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
