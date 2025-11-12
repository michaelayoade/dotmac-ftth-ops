"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@dotmac/ui";
import { Upload, FileDown, HelpCircle } from "lucide-react";
import { ImportJobsList } from "@/components/data-import/ImportJobsList";
import { FileUploadDialog } from "@/components/data-import/FileUploadDialog";
import { ImportJobDetailModal } from "@/components/data-import/ImportJobDetailModal";
import type { ImportJob, ImportJobStatus, ImportJobType } from "@/hooks/useDataImport";

export default function DataImportPage() {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<ImportJob | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ImportJobStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<ImportJobType | "all">("all");

  const handleViewDetails = (job: ImportJob) => {
    setSelectedJob(job);
    setDetailModalOpen(true);
  };

  const downloadTemplate = (type: ImportJobType) => {
    // Template generation logic
    const templates: Record<ImportJobType, string> = {
      customers: `first_name,last_name,email,phone,company,customer_type,billing_address,billing_city,billing_state,billing_zip,billing_country
John,Doe,john.doe@example.com,+1234567890,Acme Corp,business,"123 Main St","San Francisco",CA,94105,US
Jane,Smith,jane.smith@example.com,+0987654321,Tech Inc,business,"456 Oak Ave","New York",NY,10001,US`,
      invoices: `customer_id,invoice_number,amount,currency,status,due_date,issue_date,description
123e4567-e89b-12d3-a456-426614174000,INV-2025-001,1000.00,USD,pending,2025-02-15,2025-01-15,Monthly service
987fcdeb-51a2-43d1-b234-567890abcdef,INV-2025-002,2500.00,USD,pending,2025-02-20,2025-01-20,Annual license`,
      subscriptions: `customer_id,plan_id,status,billing_cycle,quantity,start_date
123e4567-e89b-12d3-a456-426614174000,plan_basic_monthly,active,monthly,1,2025-01-01`,
      payments: `customer_id,amount,currency,payment_method,status,payment_date,transaction_id
123e4567-e89b-12d3-a456-426614174000,99.99,USD,card,completed,2025-01-15,txn_abc123`,
      products: `name,description,price,currency,category
Product A,Description for Product A,99.99,USD,software`,
      mixed: `type,data
customer,"{'first_name': 'John', 'last_name': 'Doe'}"`,
    };

    const csvContent = templates[type];
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${type}_import_template.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      {/* Page Header */}
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Data Import</h2>
          <p className="text-muted-foreground">
            Import data from CSV or JSON files to bulk create records
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => {}}>
            <HelpCircle className="mr-2 h-4 w-4" />
            Documentation
          </Button>
          <Button onClick={() => setUploadDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Upload File
          </Button>
        </div>
      </div>

      <Tabs defaultValue="jobs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="jobs">Import Jobs</TabsTrigger>
          <TabsTrigger value="templates">Download Templates</TabsTrigger>
        </TabsList>

        {/* Jobs Tab */}
        <TabsContent value="jobs" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
              <CardDescription>Filter import jobs by status or type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select
                    value={statusFilter}
                    onValueChange={(value) => setStatusFilter(value as ImportJobStatus | "all")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="validating">Validating</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="partially_completed">Partially Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Type</label>
                  <Select
                    value={typeFilter}
                    onValueChange={(value) => setTypeFilter(value as ImportJobType | "all")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="customers">Customers</SelectItem>
                      <SelectItem value="invoices">Invoices</SelectItem>
                      <SelectItem value="subscriptions">Subscriptions</SelectItem>
                      <SelectItem value="payments">Payments</SelectItem>
                      <SelectItem value="products">Products</SelectItem>
                      <SelectItem value="mixed">Mixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Jobs List */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Import Jobs</CardTitle>
              <CardDescription>
                View and manage your data import jobs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ImportJobsList onViewDetails={handleViewDetails} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Customer Import</CardTitle>
                <CardDescription>
                  Template for importing customer records
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Includes: name, email, phone, address, company info
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => downloadTemplate("customers")}
                >
                  <FileDown className="mr-2 h-4 w-4" />
                  Download CSV Template
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Invoice Import</CardTitle>
                <CardDescription>
                  Template for importing invoice records
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Includes: customer_id, amount, currency, dates
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => downloadTemplate("invoices")}
                >
                  <FileDown className="mr-2 h-4 w-4" />
                  Download CSV Template
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Subscription Import</CardTitle>
                <CardDescription>
                  Template for importing subscriptions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Includes: customer_id, plan_id, status, dates
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => downloadTemplate("subscriptions")}
                  disabled
                >
                  <FileDown className="mr-2 h-4 w-4" />
                  Coming Soon
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment Import</CardTitle>
                <CardDescription>
                  Template for importing payment records
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Includes: customer_id, amount, method, transaction_id
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => downloadTemplate("payments")}
                  disabled
                >
                  <FileDown className="mr-2 h-4 w-4" />
                  Coming Soon
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Product Import</CardTitle>
                <CardDescription>
                  Template for importing product catalog
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Includes: name, description, price, category
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => downloadTemplate("products")}
                  disabled
                >
                  <FileDown className="mr-2 h-4 w-4" />
                  Coming Soon
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Import Guidelines</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold mb-2">File Format</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Supported formats: CSV, JSON</li>
                  <li>Maximum file size: 50MB</li>
                  <li>UTF-8 encoding recommended</li>
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Best Practices</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Use the provided templates to ensure correct format</li>
                  <li>Test with a small sample first using dry run mode</li>
                  <li>For large files (&gt;1000 records), enable async processing</li>
                  <li>Review failed records and fix data before re-importing</li>
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Data Validation</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>All required fields must be provided</li>
                  <li>Email addresses must be valid format</li>
                  <li>Phone numbers should include country code</li>
                  <li>Dates must be in ISO 8601 format (YYYY-MM-DD)</li>
                  <li>Currency codes must be 3-letter ISO codes</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <FileUploadDialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen} />

      <ImportJobDetailModal
        jobId={selectedJob?.id || null}
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
      />
    </div>
  );
}
