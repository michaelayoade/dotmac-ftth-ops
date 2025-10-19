"use client";

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

import { useState } from "react";
import { Save, Loader2, AlertCircle, Settings as SettingsIcon, Clock } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  useSettingsCategories,
  useCategorySettings,
  useUpdateCategorySettings,
  formatLastUpdated,
  maskSensitiveValue,
  type SettingsCategory,
  type SettingField,
} from "@/hooks/useSettings";

export default function AdminSettingsPage() {
  const [selectedCategory, setSelectedCategory] = useState<SettingsCategory>("jwt");
  const [formData, setFormData] = useState<Record<string, any>>({});

  // Fetch all categories
  const {
    data: categoriesData,
    isLoading: isLoadingCategories,
    error: categoriesError,
  } = useSettingsCategories();
  const categories = categoriesData ?? [];

  // Fetch selected category settings
  const {
    data: categorySettings,
    isLoading: isLoadingSettings,
    error: settingsError,
  } = useCategorySettings(selectedCategory, false);

  // Update mutation
  const updateSettings = useUpdateCategorySettings();

  // Initialize form data when category settings load
  const handleCategoryChange = (category: SettingsCategory) => {
    setSelectedCategory(category);
    setFormData({});
  };

  // Update form data when settings load
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
      return; // No changes to save
    }

    await updateSettings.mutateAsync({
      category: selectedCategory,
      data: {
        updates: formData,
        validate_only: false,
        reason: "Manual update via admin settings UI",
      },
    });

    // Reset form data after successful save
    setFormData({});
  };

  const renderField = (field: SettingField) => {
    const value = getFieldValue(field);

    // Boolean fields - render as Switch
    if (field.type === "bool" || field.type === "boolean") {
      return (
        <div key={field.name} className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3">
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              {field.name}
              {field.required && <span className="text-destructive ml-1">*</span>}
              {field.sensitive && <Badge variant="outline" className="ml-2 text-xs">Sensitive</Badge>}
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
            {field.sensitive && <Badge variant="outline" className="ml-2 text-xs">Sensitive</Badge>}
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

    // Long text fields - render as Textarea
    if (field.type === "text" || (field.description && field.description.length > 100)) {
      return (
        <div key={field.name} className="space-y-2">
          <Label htmlFor={field.name} className="text-sm font-semibold text-foreground">
            {field.name}
            {field.required && <span className="text-destructive ml-1">*</span>}
            {field.sensitive && <Badge variant="outline" className="ml-2 text-xs">Sensitive</Badge>}
          </Label>
          <Textarea
            id={field.name}
            rows={4}
            value={field.sensitive ? maskSensitiveValue(value, true) : (value ?? "")}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            placeholder={field.default !== null ? String(field.default) : undefined}
            readOnly={field.sensitive && !value} // Read-only if sensitive and showing masked value
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
          {field.sensitive && <Badge variant="outline" className="ml-2 text-xs">Sensitive</Badge>}
        </Label>
        <Input
          id={field.name}
          type={field.sensitive ? "password" : "text"}
          value={field.sensitive ? maskSensitiveValue(value, true) : (value ?? "")}
          onChange={(e) => handleFieldChange(field.name, e.target.value)}
          placeholder={field.default !== null ? String(field.default) : undefined}
        />
        {field.description && (
          <p className="text-xs text-muted-foreground">{field.description}</p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6" data-testid="settings">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Platform controls</p>
        <h1 className="text-3xl font-semibold text-foreground">System configuration</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Manage platform-wide configuration settings including database, authentication, caching, storage, and more.
        </p>
      </header>

      {/* Error State */}
      {(categoriesError || settingsError) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load settings: {categoriesError?.message || settingsError?.message}. Please check your connection and try again.
          </AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {isLoadingCategories && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">Loading categories...</span>
        </div>
      )}

      {/* Settings Tabs */}
      {!isLoadingCategories && categories.length > 0 && (
        <Tabs value={selectedCategory} onValueChange={(value) => handleCategoryChange(value as SettingsCategory)}>
          <TabsList className="w-full flex-wrap h-auto">
            {categories.map((cat) => (
              <TabsTrigger key={cat.category} value={cat.category} className="flex items-center gap-2">
                <SettingsIcon className="h-3 w-3" />
                {cat.display_name}
                {cat.has_sensitive_fields && (
                  <Badge variant="secondary" className="ml-1 text-xs">Sensitive</Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {categories.map((cat) => (
            <TabsContent key={cat.category} value={cat.category}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                    <SettingsIcon className="h-5 w-5 text-primary" />
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
                  {/* Loading Settings */}
                  {isLoadingSettings && (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <span className="ml-2 text-sm text-muted-foreground">Loading settings...</span>
                    </div>
                  )}

                  {/* Render Settings Fields */}
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

                          {/* Warnings */}
                          {cat.restart_required && Object.keys(formData).length > 0 && (
                            <Alert>
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription>
                                Changes to this category may require a service restart to take effect.
                              </AlertDescription>
                            </Alert>
                          )}

                          {/* Save Button */}
                          <div className="flex gap-2 pt-4">
                            <Button
                              className="gap-2"
                              onClick={handleSave}
                              disabled={updateSettings.isPending || Object.keys(formData).length === 0}
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

      {/* Empty State */}
      {!isLoadingCategories && categories.length === 0 && !categoriesError && (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">
              No settings categories available.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
