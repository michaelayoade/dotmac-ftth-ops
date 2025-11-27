"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import { Plus, Edit, Trash2, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import {
  useCommissionRules,
  useCreateCommissionRule,
  useUpdateCommissionRule,
  useDeleteCommissionRule,
  type CommissionModel,
  type CommissionRule,
  type CreateCommissionRuleInput,
  type UpdateCommissionRuleInput,
} from "@/hooks/useCommissionRules";
import { usePartners } from "@/hooks/usePartners";

interface CommissionRulesManagementProps {
  partnerId?: string;
}

export function CommissionRulesManagement({ partnerId }: CommissionRulesManagementProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<CommissionRule | null>(null);
  const [selectedPartnerId, setSelectedPartnerId] = useState(partnerId || "");
  const [formData, setFormData] = useState<Partial<CreateCommissionRuleInput>>({
    commission_type: "revenue_share",
    is_active: true,
    priority: 1,
  });

  // Fetch partners for dropdown
  const { data: partnersData } = usePartners(undefined, 1, 100);

  // Fetch commission rules
  const commissionRuleFilters = {
    page: 1,
    page_size: 100,
    ...(partnerId && { partner_id: partnerId }),
  };

  const { data: rulesData, isLoading, error } = useCommissionRules(commissionRuleFilters);

  // Mutations
  const createMutation = useCreateCommissionRule();
  const updateMutation = useUpdateCommissionRule();
  const deleteMutation = useDeleteCommissionRule();

  const handleCreateRule = () => {
    setEditingRule(null);
    setFormData(
      (prev) =>
        ({
          ...prev,
          commission_type: "revenue_share",
          is_active: true,
          priority: 1,
          effective_from: new Date().toISOString().split("T")[0],
        }) as Partial<CreateCommissionRuleInput>,
    );
    setIsDialogOpen(true);
  };

  const handleEditRule = (rule: CommissionRule) => {
    setEditingRule(rule);
    setFormData(
      (prev) =>
        ({
          ...prev,
          rule_name: rule.rule_name,
          description: rule.description,
          commission_type: rule.commission_type,
          commission_rate: rule.commission_rate,
          flat_fee_amount: rule.flat_fee_amount,
          tier_config: rule.tier_config,
          applies_to_products: rule.applies_to_products,
          applies_to_customers: rule.applies_to_customers,
          effective_from: rule.effective_from.split("T")[0],
          effective_to: rule.effective_to?.split("T")[0],
          is_active: rule.is_active,
          priority: rule.priority,
        }) as Partial<CreateCommissionRuleInput>,
    );
    setSelectedPartnerId(rule.partner_id);
    setIsDialogOpen(true);
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (confirm("Are you sure you want to delete this commission rule?")) {
      try {
        await deleteMutation.mutateAsync(ruleId);
      } catch (error) {
        alert(`Failed to delete rule: ${error}`);
      }
    }
  };

  const handleSaveRule = async () => {
    try {
      // Validate required fields
      if (!formData.rule_name || !selectedPartnerId || !formData.effective_from) {
        alert("Please fill in all required fields");
        return;
      }

      // Validate commission model configuration
      if (formData.commission_type === "revenue_share" && !formData.commission_rate) {
        alert("Revenue share model requires a commission rate");
        return;
      }
      if (formData.commission_type === "flat_fee" && !formData.flat_fee_amount) {
        alert("Flat fee model requires a flat fee amount");
        return;
      }
      if (
        formData.commission_type === "hybrid" &&
        (!formData.commission_rate || !formData.flat_fee_amount)
      ) {
        alert("Hybrid model requires both commission rate and flat fee amount");
        return;
      }

      if (editingRule) {
        // Update existing rule
        await updateMutation.mutateAsync({
          ruleId: editingRule.id,
          data: formData as UpdateCommissionRuleInput,
        });
      } else {
        // Create new rule
        await createMutation.mutateAsync({
          partner_id: selectedPartnerId,
          ...formData,
        } as CreateCommissionRuleInput);
      }

      setIsDialogOpen(false);
      setFormData({
        commission_type: "revenue_share",
        is_active: true,
        priority: 1,
      });
    } catch (error: any) {
      alert(`Failed to save rule: ${error.message || error}`);
    }
  };

  const getModelBadge = (model: CommissionModel) => {
    const variants: Record<CommissionModel, { label: string; className: string }> = {
      revenue_share: { label: "Revenue Share", className: "bg-blue-500/10 text-blue-500" },
      flat_fee: { label: "Flat Fee", className: "bg-green-500/10 text-green-500" },
      tiered: { label: "Tiered", className: "bg-purple-500/10 text-purple-500" },
      hybrid: { label: "Hybrid", className: "bg-orange-500/10 text-orange-500" },
    };

    const { label, className } = variants[model];
    return <Badge className={className}>{label}</Badge>;
  };

  const rules = rulesData?.rules || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Commission Rules</CardTitle>
              <CardDescription>
                Configure commission calculation rules for different products and customers
              </CardDescription>
            </div>
            <Button onClick={handleCreateRule} disabled={!partnerId && !partnersData}>
              <Plus className="h-4 w-4 mr-2" />
              Create Rule
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Error State */}
      {error && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Error Loading Rules
            </CardTitle>
            <CardDescription className="text-destructive/80">
              {error.message || "Failed to load commission rules"}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Rules Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active Rules</CardTitle>
          <CardDescription>
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading rules...
              </span>
            ) : (
              <>
                {rules.length} rule{rules.length !== 1 ? "s" : ""} configured
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p>Loading commission rules...</p>
            </div>
          ) : rules.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No commission rules configured</p>
              <Button className="mt-4" onClick={handleCreateRule}>
                <Plus className="h-4 w-4 mr-2" />
                Create your first rule
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rule Name</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Rate/Amount</TableHead>
                    <TableHead>Effective Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell className="font-medium">{rule.rule_name}</TableCell>
                      <TableCell>{getModelBadge(rule.commission_type)}</TableCell>
                      <TableCell>
                        {rule.commission_type === "revenue_share" && (
                          <span>{(rule.commission_rate! * 100).toFixed(1)}%</span>
                        )}
                        {rule.commission_type === "flat_fee" && (
                          <span>${rule.flat_fee_amount?.toFixed(2)}</span>
                        )}
                        {rule.commission_type === "tiered" && <span>Tiered rates</span>}
                        {rule.commission_type === "hybrid" && (
                          <span>
                            {(rule.commission_rate! * 100).toFixed(1)}% + $
                            {rule.flat_fee_amount?.toFixed(2)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{new Date(rule.effective_from).toLocaleDateString()}</div>
                        {rule.effective_to && (
                          <div className="text-muted-foreground">
                            to {new Date(rule.effective_to).toLocaleDateString()}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {rule.is_active ? (
                          <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                            <CheckCircle2 className="h-3 w-3" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell>{rule.priority}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleEditRule(rule)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteRule(rule.id)}
                            disabled={deleteMutation.isPending}
                          >
                            {deleteMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4 text-destructive" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rule Form Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? "Edit Commission Rule" : "Create Commission Rule"}
            </DialogTitle>
            <DialogDescription>
              Configure how commissions are calculated for this rule
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Partner Selection (only for create) */}
            {!editingRule && !partnerId && (
              <div className="space-y-2">
                <Label htmlFor="partner">
                  Partner <span className="text-destructive">*</span>
                </Label>
                <Select value={selectedPartnerId} onValueChange={setSelectedPartnerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a partner" />
                  </SelectTrigger>
                  <SelectContent>
                    {partnersData?.partners.map((partner) => (
                      <SelectItem key={partner.id} value={partner.id}>
                        {partner.company_name} ({partner.partner_number})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Rule Name */}
            <div className="space-y-2">
              <Label htmlFor="rule_name">
                Rule Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="rule_name"
                placeholder="e.g., Standard Revenue Share"
                value={formData.rule_name || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, rule_name: e.target.value }))}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Optional description"
                value={formData.description || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>

            {/* Commission Model */}
            <div className="space-y-2">
              <Label htmlFor="commission_type">
                Commission Model <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.commission_type ?? "revenue_share"}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, commission_type: value as CommissionModel }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="revenue_share">Revenue Share (Percentage)</SelectItem>
                  <SelectItem value="flat_fee">Flat Fee</SelectItem>
                  <SelectItem value="tiered">Tiered (Volume-based)</SelectItem>
                  <SelectItem value="hybrid">Hybrid (Percentage + Flat)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Commission Rate & Flat Fee */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="commission_rate">
                  Commission Rate (%)
                  {(formData.commission_type === "revenue_share" ||
                    formData.commission_type === "hybrid") && (
                    <span className="text-destructive"> *</span>
                  )}
                </Label>
                <Input
                  id="commission_rate"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  placeholder="10.0"
                  value={formData.commission_rate ? formData.commission_rate * 100 : ""}
                  onChange={(e) =>
                    setFormData(
                      (prev) =>
                        ({
                          ...prev,
                          commission_rate: e.target.value
                            ? parseFloat(e.target.value) / 100
                            : undefined,
                        }) as Partial<CreateCommissionRuleInput>,
                    )
                  }
                  disabled={formData.commission_type === "flat_fee"}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="flat_fee_amount">
                  Flat Fee Amount ($)
                  {(formData.commission_type === "flat_fee" ||
                    formData.commission_type === "hybrid") && (
                    <span className="text-destructive"> *</span>
                  )}
                </Label>
                <Input
                  id="flat_fee_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="50.00"
                  value={formData.flat_fee_amount || ""}
                  onChange={(e) =>
                    setFormData(
                      (prev) =>
                        ({
                          ...prev,
                          flat_fee_amount: e.target.value ? parseFloat(e.target.value) : undefined,
                        }) as Partial<CreateCommissionRuleInput>,
                    )
                  }
                  disabled={formData.commission_type === "revenue_share"}
                />
              </div>
            </div>

            {/* Effective Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="effective_from">
                  Effective From <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="effective_from"
                  type="date"
                  value={formData.effective_from || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, effective_from: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="effective_to">Effective To (Optional)</Label>
                <Input
                  id="effective_to"
                  type="date"
                  value={formData.effective_to || ""}
                  onChange={(e) =>
                    setFormData(
                      (prev) =>
                        ({
                          ...prev,
                          effective_to: e.target.value || undefined,
                        }) as Partial<CreateCommissionRuleInput>,
                    )
                  }
                />
              </div>
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Input
                id="priority"
                type="number"
                min="1"
                placeholder="1"
                value={formData.priority || 1}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, priority: parseInt(e.target.value) || 1 }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Lower numbers have higher priority when multiple rules apply
              </p>
            </div>

            {/* Active Status */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active !== false}
                onChange={(e) => setFormData((prev) => ({ ...prev, is_active: e.target.checked }))}
                className="rounded border-gray-300"
              />
              <Label htmlFor="is_active" className="cursor-pointer">
                Active
              </Label>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveRule}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editingRule ? "Update Rule" : "Create Rule"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
