"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, RefreshCw, Plus, AlertCircle } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  Badge,
  Alert,
  AlertTitle,
  AlertDescription,
} from "@dotmac/ui";
import { format } from "date-fns";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import {
  usageBillingService,
  UsageRecord,
  UsageStatistics,
  UsageType,
} from "@/lib/services/usage-billing-service";

const usageService = usageBillingService;

const usageTypeLabels: Record<UsageType, string> = {
  data_transfer: "Data Transfer",
  voice_minutes: "Voice Minutes",
  sms_count: "SMS",
  bandwidth_gb: "Bandwidth",
  overage_gb: "Overage",
  static_ip: "Static IP",
  equipment_rental: "Equipment Rental",
  installation_fee: "Installation",
  custom: "Custom",
};

const usageUnits: Record<UsageType, string> = {
  data_transfer: "GB",
  bandwidth_gb: "GB",
  overage_gb: "GB",
  voice_minutes: "minutes",
  sms_count: "messages",
  static_ip: "ip",
  equipment_rental: "unit",
  installation_fee: "job",
  custom: "unit",
};

type FormState = {
  subscription_id: string;
  customer_id: string;
  usage_type: UsageType;
  quantity: number;
  unit: string;
  unitPriceMajor: string;
  description: string;
};

const initialForm: FormState = {
  subscription_id: "",
  customer_id: "",
  usage_type: "data_transfer",
  quantity: 10,
  unit: "GB",
  unitPriceMajor: "1.5",
  description: "",
};

export default function UsageBillingPage() {
  const [records, setRecords] = useState<UsageRecord[]>([]);
  const [stats, setStats] = useState<UsageStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);

  const totalAmountMajor = useMemo(() => {
    return usageService.formatCurrency(
      Math.round((form.quantity || 0) * parseFloat(form.unitPriceMajor || "0") * 100),
    );
  }, [form.quantity, form.unitPriceMajor]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, usageStats] = await Promise.all([
        usageService.listUsageRecords({ limit: 50 }),
        usageService.getUsageStatistics(),
      ]);
      setRecords(list);
      setStats(usageStats);
    } catch (err: any) {
      setError(err?.message || "Failed to load usage billing data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleChange = (key: keyof FormState, value: string | number) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === "usage_type") {
      setForm((prevForm) => {
        const unit = usageUnits[value as UsageType] || prevForm.unit;
        return { ...prevForm, unit };
      });
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const unitPriceCents = Math.round(parseFloat(form.unitPriceMajor || "0") * 100);
      const record: any = {
        subscription_id: form.subscription_id || "default",
        usage_type: form.usage_type,
        quantity: Number(form.quantity),
        unit: form.unit,
        unit_price: unitPriceCents,
        total_amount: usageService.calculateTotalAmount(form.quantity, unitPriceCents),
        currency: "USD",
        period_start: new Date().toISOString(),
        period_end: new Date().toISOString(),
        source_system: "ops-portal",
      };
      if (form.customer_id) record.customer_id = form.customer_id;
      if (form.description) record.description = form.description;

      await usageService.createUsageRecord(record);
      await loadData();
      setForm(initialForm);
    } catch (err: any) {
      setError(err?.message || "Failed to record usage");
    } finally {
      setSubmitting(false);
    }
  };

  const renderStatCard = (label: string, value: string | number, muted?: boolean) => (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-semibold ${muted ? "text-muted-foreground" : ""}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <RouteGuard permission="billing.read">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
              <Activity className="h-6 w-6 text-blue-500" />
              Usage Billing
            </h1>
            <p className="text-muted-foreground">
              Track metered usage (bandwidth, data transfer, equipment) and push into invoices.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Billing usage error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
          {renderStatCard(
            "Total This Period",
            stats ? usageService.formatCurrency(stats.total_amount) : "—",
          )}
          {renderStatCard(
            "Pending Billing",
            stats ? usageService.formatCurrency(stats.pending_amount) : "—",
            !stats,
          )}
          {renderStatCard("Records", stats ? stats.total_records : loading ? "…" : 0, !stats)}
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Log Usage</CardTitle>
              <p className="text-sm text-muted-foreground">
                Capture metered usage that will roll into invoices or overage charges.
              </p>
            </div>
            <Button onClick={handleSubmit} disabled={submitting}>
              <Plus className="h-4 w-4 mr-2" />
              Record Usage
            </Button>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Usage Type</label>
              <Select
                value={form.usage_type}
                onValueChange={(val) => handleChange("usage_type", val as UsageType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(usageTypeLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Quantity</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.quantity}
                onChange={(e) => handleChange("quantity", Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Unit</label>
              <Input value={form.unit} onChange={(e) => handleChange("unit", e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Unit Price (major)</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.unitPriceMajor}
                onChange={(e) => handleChange("unitPriceMajor", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Subscription ID (optional)</label>
              <Input
                value={form.subscription_id}
                onChange={(e) => handleChange("subscription_id", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Customer ID (optional)</label>
              <Input
                value={form.customer_id}
                onChange={(e) => handleChange("customer_id", e.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-3">
              <label className="text-sm text-muted-foreground">Description (optional)</label>
              <Input
                value={form.description}
                onChange={(e) => handleChange("description", e.target.value)}
              />
            </div>
            <div className="md:col-span-3 text-sm text-muted-foreground">
              Estimated total:{" "}
              <span className="font-semibold text-foreground">{totalAmountMajor}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Usage Records</CardTitle>
            <Badge variant="secondary">{records.length} records</Badge>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Period End</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Loading usage records...
                    </TableCell>
                  </TableRow>
                )}
                {!loading && records.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No usage records yet.
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        {usageTypeLabels[record.usage_type] || record.usage_type}
                      </TableCell>
                      <TableCell>
                        {record.quantity} {record.unit}
                      </TableCell>
                      <TableCell>
                        {usageService.formatCurrency(record.total_amount, record.currency)}
                      </TableCell>
                      <TableCell className="capitalize">{record.billed_status}</TableCell>
                      <TableCell>
                        {record.period_end ? format(new Date(record.period_end), "PPpp") : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {record.source_system || "unknown"}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </RouteGuard>
  );
}
