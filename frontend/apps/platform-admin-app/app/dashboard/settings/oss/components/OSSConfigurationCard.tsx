"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Switch } from "@dotmac/ui";
import { Skeleton } from "@dotmac/ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@dotmac/ui";
import {
  CheckCircle2,
  XCircle,
  Settings,
  Save,
  RotateCcw,
  TestTube,
  AlertCircle,
  Eye,
  EyeOff,
  Info,
} from "lucide-react";
import {
  useOSSConfiguration,
  useOSSConfigStatus,
  useUpdateOSSConfiguration,
  useResetOSSConfiguration,
  useTestOSSConnection,
} from "@/hooks/useOSSConfig";
import {
  OSS_SERVICE_INFO,
  type OSSService,
  type OSSServiceConfigUpdate,
} from "@/lib/services/oss-config-service";

interface OSSConfigurationCardProps {
  service: OSSService;
}

export function OSSConfigurationCard({ service }: OSSConfigurationCardProps) {
  const { data: config, isLoading } = useOSSConfiguration(service);
  const { hasOverrides, overriddenFields, validateUpdate, isConfigured } =
    useOSSConfigStatus(service);
  const updateConfig = useUpdateOSSConfiguration();
  const resetConfig = useResetOSSConfiguration();
  const testConnection = useTestOSSConnection();

  const [isEditing, setIsEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showApiToken, setShowApiToken] = useState(false);
  const [formData, setFormData] = useState<OSSServiceConfigUpdate>({});
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const serviceInfo = OSS_SERVICE_INFO[service];

  // Initialize form data when entering edit mode
  const handleStartEdit = () => {
    if (config) {
      setFormData({
        url: config.config.url || "",
        username: config.config.username || null,
        password: config.config.password || null,
        api_token: config.config.api_token || null,
        verify_ssl: config.config.verify_ssl,
        timeout_seconds: config.config.timeout_seconds,
        max_retries: config.config.max_retries,
      });
    }
    setIsEditing(true);
    setValidationErrors([]);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setFormData({});
    setValidationErrors([]);
  };

  const handleSave = async () => {
    // Validate updates
    const validation = validateUpdate(formData);
    if (!validation.valid) {
      setValidationErrors(validation.errors);
      return;
    }

    // Filter out unchanged fields
    const updates: OSSServiceConfigUpdate = {};
    Object.entries(formData).forEach(([key, value]) => {
      if (value !== undefined && value !== config?.config[key as keyof typeof config.config]) {
        updates[key as keyof OSSServiceConfigUpdate] = value as any;
      }
    });

    if (Object.keys(updates).length === 0) {
      setIsEditing(false);
      return;
    }

    updateConfig.mutate(
      { service, updates },
      {
        onSuccess: () => {
          setIsEditing(false);
          setFormData({});
          setValidationErrors([]);
        },
      },
    );
  };

  const handleReset = () => {
    resetConfig.mutate(service, {
      onSuccess: () => {
        setIsEditing(false);
        setFormData({});
      },
    });
  };

  const handleTestConnection = () => {
    testConnection.mutate(service);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!config) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <XCircle className="h-12 w-12 text-destructive mb-4" />
          <h3 className="text-lg font-semibold mb-2">Configuration Not Available</h3>
          <p className="text-sm text-muted-foreground">
            Unable to load configuration for {serviceInfo.name}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {serviceInfo.name} Configuration
                {isConfigured ? (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Active
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="h-3 w-3" />
                    Not Configured
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>{serviceInfo.description}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {!isEditing ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTestConnection}
                    disabled={!isConfigured || testConnection.isPending}
                  >
                    <TestTube className="h-4 w-4 mr-2" />
                    Test
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleStartEdit}>
                    <Settings className="h-4 w-4 mr-2" />
                    Configure
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelEdit}
                    disabled={updateConfig.isPending}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={updateConfig.isPending}>
                    <Save className="h-4 w-4 mr-2" />
                    {updateConfig.isPending ? "Saving..." : "Save"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Configuration Display */}
          {!isEditing && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Service URL</Label>
                <p className="font-mono text-sm mt-1">
                  {config.config.url || <span className="text-muted-foreground">Not set</span>}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">SSL Verification</Label>
                  <p className="text-sm mt-1">
                    {config.config.verify_ssl ? "Enabled" : "Disabled"}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Timeout</Label>
                  <p className="text-sm mt-1">{config.config.timeout_seconds}s</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Max Retries</Label>
                  <p className="text-sm mt-1">{config.config.max_retries}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Authentication</Label>
                  <p className="text-sm mt-1">
                    {config.config.api_token
                      ? "API Token"
                      : config.config.username
                        ? "Username/Password"
                        : "None"}
                  </p>
                </div>
              </div>

              {hasOverrides && (
                <div className="pt-3 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Info className="h-3 w-3" />
                        Tenant Overrides
                      </Label>
                      <p className="text-sm mt-1">
                        {overriddenFields.length} field
                        {overriddenFields.length !== 1 ? "s" : ""} customized:{" "}
                        {overriddenFields.join(", ")}
                      </p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" disabled={resetConfig.isPending}>
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Reset to Defaults
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Reset to Default Configuration?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove all tenant-specific overrides and restore the default
                            settings for {serviceInfo.name}. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleReset}>
                            Reset Configuration
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Edit Form */}
          {isEditing && (
            <div className="space-y-4">
              {/* Validation Errors */}
              {validationErrors.length > 0 && (
                <Card className="border-destructive">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-destructive">Validation Errors</p>
                        <ul className="text-sm text-muted-foreground list-disc list-inside mt-1">
                          {validationErrors.map((error, index) => (
                            <li key={index}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* URL Field */}
              <div className="space-y-2">
                <Label htmlFor="url">
                  Service URL <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="url"
                  type="url"
                  placeholder="https://..."
                  value={formData.url || ""}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                />
              </div>

              {/* Authentication Section */}
              <div className="space-y-4 p-4 border rounded-lg">
                <h4 className="text-sm font-medium">Authentication</h4>

                <div className="space-y-2">
                  <Label htmlFor="username">Username (Optional)</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="admin"
                    value={formData.username || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        username: e.target.value || null,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password (Optional)</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={formData.password || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          password: e.target.value || null,
                        })
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="api_token">API Token (Optional)</Label>
                  <div className="relative">
                    <Input
                      id="api_token"
                      type={showApiToken ? "text" : "password"}
                      placeholder="token_..."
                      value={formData.api_token || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          api_token: e.target.value || null,
                        })
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowApiToken(!showApiToken)}
                    >
                      {showApiToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Connection Settings */}
              <div className="space-y-4 p-4 border rounded-lg">
                <h4 className="text-sm font-medium">Connection Settings</h4>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="verify_ssl">Verify SSL Certificate</Label>
                    <p className="text-xs text-muted-foreground">
                      Enable SSL certificate verification
                    </p>
                  </div>
                  <Switch
                    id="verify_ssl"
                    checked={formData.verify_ssl ?? config.config.verify_ssl}
                    onCheckedChange={(checked) => setFormData({ ...formData, verify_ssl: checked })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timeout">Timeout (seconds)</Label>
                  <Input
                    id="timeout"
                    type="number"
                    min="1"
                    step="1"
                    value={formData.timeout_seconds ?? config.config.timeout_seconds}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        timeout_seconds: parseFloat(e.target.value),
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_retries">Max Retries</Label>
                  <Input
                    id="max_retries"
                    type="number"
                    min="0"
                    step="1"
                    value={formData.max_retries ?? config.config.max_retries}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        max_retries: parseInt(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
