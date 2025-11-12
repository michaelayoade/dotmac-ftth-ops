"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { useToast } from "@dotmac/ui";
import {
  Settings,
  Database,
  Trash2,
  CheckCircle2,
  Edit,
  Save,
  Loader2,
  AlertCircle,
  Clock,
} from "lucide-react";
import { Alert, AlertDescription } from "@dotmac/ui";
import { platformAdminService, type SystemConfig } from "@/lib/services/platform-admin-service";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import { Separator } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Switch } from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import {
  useSettingsCategories,
  useCategorySettings,
  useUpdateCategorySettings,
  formatLastUpdated,
  maskSensitiveValue,
  SETTINGS_CATEGORY_VALUES,
  type SettingsCategory as SettingsCategoryType,
  type SettingField,
} from "@/hooks/useSettings";

const isValidSettingsCategory = (value: string): value is SettingsCategoryType =>
  SETTINGS_CATEGORY_VALUES.includes(value as SettingsCategoryType);

export function SystemConfiguration() {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [initializedFromQuery, setInitializedFromQuery] = useState(false);

  // Settings management state
  const [activeTab, setActiveTab] = useState<"overview" | "settings">("overview");
  const [selectedCategory, setSelectedCategory] = useState<SettingsCategoryType>("jwt");
  const [formData, setFormData] = useState<Record<string, any>>({});

  // Fetch categories and settings
  const { data: categoriesData, isLoading: isLoadingCategories } = useSettingsCategories();
  const categories = categoriesData ?? [];

  const { data: categorySettings, isLoading: isLoadingSettings } = useCategorySettings(
    selectedCategory,
    false,
  );

  const updateSettings = useUpdateCategorySettings();

  const fetchSystemConfig = useCallback(async () => {
    try {
      const data = await platformAdminService.getSystemConfig();
      setConfig(data);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load system configuration";
      toast({
        title: "Unable to load config",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchSystemConfig();
  }, [fetchSystemConfig]);

  useEffect(() => {
    if (initializedFromQuery) {
      return;
    }

    const tabParam = searchParams?.get("tab");
    if (tabParam === "overview" || tabParam === "settings") {
      setActiveTab(tabParam);
    }

    const categoryParam = searchParams?.get("category");
    if (categoryParam && isValidSettingsCategory(categoryParam)) {
      setSelectedCategory(categoryParam);
    }

    setInitializedFromQuery(true);
  }, [initializedFromQuery, searchParams]);

  const handleClearCache = useCallback(
    async (cacheType: string = "all") => {
      try {
        const result = await platformAdminService.clearCache(cacheType);
        toast({
          title: "Cache cleared",
          description:
            typeof result.cache_type === "string"
              ? `${result.cache_type} cache cleared successfully`
              : "Cache cleared successfully",
        });
        void fetchSystemConfig();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to clear cache";
        toast({ title: "Error", description: message, variant: "destructive" });
      }
    },
    [fetchSystemConfig, toast],
  );

  const updateQueryParams = useCallback(
    (tab: "overview" | "settings", category?: SettingsCategoryType) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("tab", tab);
      if (category) {
        params.set("category", category);
      } else {
        params.delete("category");
      }
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  // Settings management handlers
  const handleCategoryChange = useCallback(
    (category: SettingsCategoryType) => {
      setSelectedCategory(category);
      setFormData({});
      updateQueryParams("settings", category);
    },
    [updateQueryParams],
  );

  const handleTabChange = useCallback(
    (tab: "overview" | "settings") => {
      setActiveTab(tab);
      updateQueryParams(tab, tab === "settings" ? selectedCategory : undefined);
    },
    [selectedCategory, updateQueryParams],
  );

  const getFieldValue = (field: SettingField): any => {
    if (formData[field.name] !== undefined) {
      return formData[field.name];
    }
    return field.value;
  };

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleSave = async () => {
    if (Object.keys(formData).length === 0) {
      return;
    }

    await updateSettings.mutateAsync({
      category: selectedCategory,
      data: {
        updates: formData,
        validate_only: false,
        reason: "Updated via platform admin settings",
      },
    });

    setFormData({});
  };

  const renderField = (field: SettingField) => {
    const value = getFieldValue(field);

    // Boolean fields
    if (field.type === "bool" || field.type === "boolean") {
      return (
        <div
          key={field.name}
          className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3"
        >
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              {field.name}
              {field.required && <span className="text-destructive ml-1">*</span>}
              {field.sensitive && (
                <Badge variant="outline" className="ml-2 text-xs">
                  Sensitive
                </Badge>
              )}
            </p>
            {field.description && (
              <p className="text-xs text-muted-foreground mt-1">{field.description}</p>
            )}
          </div>
          <Switch
            checked={Boolean(value)}
            onCheckedChange={(checked) => handleFieldChange(field.name, checked)}
            aria-label={`Toggle ${field.name}`}
          />
        </div>
      );
    }

    // Number fields
    if (field.type === "int" || field.type === "float" || field.type === "number") {
      return (
        <div key={field.name} className="space-y-2">
          <Label htmlFor={field.name} className="text-sm font-semibold text-foreground">
            {field.name}
            {field.required && <span className="text-destructive ml-1">*</span>}
            {field.sensitive && (
              <Badge variant="outline" className="ml-2 text-xs">
                Sensitive
              </Badge>
            )}
          </Label>
          <Input
            id={field.name}
            type="number"
            value={value ?? ""}
            onChange={(e) => handleFieldChange(field.name, parseFloat(e.target.value))}
            placeholder={field.default !== null ? String(field.default) : undefined}
          />
          {field.description && (
            <p className="text-xs text-muted-foreground">{field.description}</p>
          )}
        </div>
      );
    }

    // Long text fields
    if (field.type === "text" || (field.description && field.description.length > 100)) {
      return (
        <div key={field.name} className="space-y-2">
          <Label htmlFor={field.name} className="text-sm font-semibold text-foreground">
            {field.name}
            {field.required && <span className="text-destructive ml-1">*</span>}
            {field.sensitive && (
              <Badge variant="outline" className="ml-2 text-xs">
                Sensitive
              </Badge>
            )}
          </Label>
          <Textarea
            id={field.name}
            rows={4}
            value={field.sensitive ? maskSensitiveValue(value, true) : (value ?? "")}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            placeholder={field.default !== null ? String(field.default) : undefined}
            readOnly={field.sensitive && !value}
          />
          {field.description && (
            <p className="text-xs text-muted-foreground">{field.description}</p>
          )}
        </div>
      );
    }

    // Default: string input
    return (
      <div key={field.name} className="space-y-2">
        <Label htmlFor={field.name} className="text-sm font-semibold text-foreground">
          {field.name}
          {field.required && <span className="text-destructive ml-1">*</span>}
          {field.sensitive && (
            <Badge variant="outline" className="ml-2 text-xs">
              Sensitive
            </Badge>
          )}
        </Label>
        <Input
          id={field.name}
          type={field.sensitive ? "password" : "text"}
          value={field.sensitive ? maskSensitiveValue(value, true) : (value ?? "")}
          onChange={(e) => handleFieldChange(field.name, e.target.value)}
          placeholder={field.default !== null ? String(field.default) : undefined}
        />
        {field.description && <p className="text-xs text-muted-foreground">{field.description}</p>}
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>System Configuration</CardTitle>
          <CardDescription>Loading configuration...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!config) {
    return (
      <Alert>
        <AlertDescription>Failed to load system configuration</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs
        value={activeTab}
        onValueChange={(v) => handleTabChange(v as "overview" | "settings")}
      >
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            System Overview
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Edit className="h-4 w-4" />
            Settings Management
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4 mt-6">
          {/* Configuration Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                System Configuration
              </CardTitle>
              <CardDescription>
                View current platform configuration (non-sensitive values only)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Environment</p>
                  <Badge variant="outline" className="mt-1">
                    {config.environment.toUpperCase()}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Multi-Tenant Mode</p>
                  <div className="flex items-center gap-2 mt-1">
                    {config.multi_tenant_mode ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <div className="h-4 w-4" />
                    )}
                    <span className="text-sm">
                      {config.multi_tenant_mode ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Features Enabled</p>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(config.features_enabled).map(([feature, enabled]) => (
                    <div key={feature} className="flex items-center gap-2">
                      {enabled && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                      <span className="text-sm capitalize">{feature.replace(/_/g, " ")}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cache Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Cache Management
              </CardTitle>
              <CardDescription>
                Clear system caches for troubleshooting or after configuration changes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => handleClearCache("permissions")}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Permission Cache
                </Button>
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => handleClearCache("all")}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All Caches
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Platform Permissions */}
          <Card>
            <CardHeader>
              <CardTitle>Platform Permissions</CardTitle>
              <CardDescription>
                Available platform-level permissions for administrators
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-2">
                {[
                  {
                    key: "platform:admin",
                    desc: "Full platform administration",
                  },
                  { key: "platform:tenants:read", desc: "View all tenants" },
                  { key: "platform:tenants:write", desc: "Manage all tenants" },
                  { key: "platform:users:read", desc: "View all users" },
                  { key: "platform:users:write", desc: "Manage all users" },
                  { key: "platform:billing:read", desc: "View billing data" },
                  { key: "platform:analytics", desc: "Cross-tenant analytics" },
                  { key: "platform:audit", desc: "Access audit logs" },
                  { key: "platform:impersonate", desc: "Impersonate tenants" },
                ].map((perm) => (
                  <div key={perm.key} className="border rounded-lg p-3">
                    <p className="font-mono text-sm font-medium">{perm.key}</p>
                    <p className="text-xs text-muted-foreground mt-1">{perm.desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Management Tab */}
        <TabsContent value="settings" className="space-y-4 mt-6">
          {isLoadingCategories && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Loading categories...</span>
            </div>
          )}

          {!isLoadingCategories && categories.length > 0 && (
            <Tabs
              value={selectedCategory}
              onValueChange={(value) => handleCategoryChange(value as SettingsCategoryType)}
            >
              <TabsList className="w-full flex-wrap h-auto">
                {categories.map((cat) => (
                  <TabsTrigger
                    key={cat.category}
                    value={cat.category}
                    className="flex items-center gap-2"
                  >
                    <Settings className="h-3 w-3" />
                    {cat.display_name}
                    {cat.has_sensitive_fields && (
                      <Badge variant="secondary" className="ml-1 text-xs">
                        Sensitive
                      </Badge>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>

              {categories.map((cat) => (
                <TabsContent key={cat.category} value={cat.category}>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                        <Settings className="h-5 w-5 text-primary" />
                        {cat.display_name}
                      </CardTitle>
                      <CardDescription>
                        {cat.description}
                        {categorySettings?.last_updated && (
                          <span className="flex items-center gap-1 mt-2">
                            <Clock className="h-3 w-3" />
                            Last updated: {formatLastUpdated(categorySettings.last_updated)}
                            {categorySettings.updated_by && ` by ${categorySettings.updated_by}`}
                          </span>
                        )}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-6">
                      {isLoadingSettings && (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                          <span className="ml-2 text-sm text-muted-foreground">
                            Loading settings...
                          </span>
                        </div>
                      )}

                      {!isLoadingSettings && categorySettings && (
                        <>
                          {categorySettings.fields.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">
                              No configurable settings in this category.
                            </p>
                          ) : (
                            <>
                              <div className="space-y-4">
                                {categorySettings.fields.map(renderField)}
                              </div>

                              {cat.restart_required && Object.keys(formData).length > 0 && (
                                <Alert>
                                  <AlertCircle className="h-4 w-4" />
                                  <AlertDescription>
                                    Changes to this category may require a service restart to take
                                    effect.
                                  </AlertDescription>
                                </Alert>
                              )}

                              <div className="flex gap-2 pt-4">
                                <Button
                                  className="gap-2"
                                  onClick={handleSave}
                                  disabled={
                                    updateSettings.isPending || Object.keys(formData).length === 0
                                  }
                                >
                                  {updateSettings.isPending ? (
                                    <>
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                      Saving...
                                    </>
                                  ) : (
                                    <>
                                      <Save className="h-4 w-4" />
                                      Save {cat.display_name} settings
                                    </>
                                  )}
                                </Button>

                                {Object.keys(formData).length > 0 && (
                                  <Button
                                    variant="outline"
                                    onClick={() => setFormData({})}
                                    disabled={updateSettings.isPending}
                                  >
                                    Cancel
                                  </Button>
                                )}
                              </div>
                            </>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              ))}
            </Tabs>
          )}

          {!isLoadingCategories && categories.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center">
                <p className="text-sm text-muted-foreground">No settings categories available.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
