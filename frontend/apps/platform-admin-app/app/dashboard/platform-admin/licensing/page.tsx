/**
 * Platform Admin - Licensing Management Page
 *
 * Manage feature modules, quotas, and service plans
 */

"use client";

import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@dotmac/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@dotmac/ui";
import {
  Package,
  BarChart3,
  FileText,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Copy,
  Search,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useLicensing } from "../../../../hooks/useLicensing";
import { ModuleCategory, PricingModel } from "../../../../types/licensing";

export default function PlatformAdminLicensingPage() {
  const { modules, modulesLoading, quotas, quotasLoading, plans, plansLoading } = useLicensing();

  const [searchQuery, setSearchQuery] = useState("");

  // Filter functions
  const filteredModules = modules.filter(
    (m) =>
      m.module_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.module_code.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredQuotas = quotas.filter(
    (q) =>
      q.quota_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.quota_code.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredPlans = plans.filter(
    (p) =>
      p.plan_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.plan_code.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Licensing Management</h1>
        <p className="text-muted-foreground">
          Manage feature modules, quotas, and service plans for the platform
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Feature Modules</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{modules.length}</div>
            <p className="text-xs text-muted-foreground">
              {modules.filter((m) => m.is_active).length} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quota Definitions</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{quotas.length}</div>
            <p className="text-xs text-muted-foreground">
              {quotas.filter((q) => q.is_metered).length} metered
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Service Plans</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{plans.length}</div>
            <p className="text-xs text-muted-foreground">
              {plans.filter((p) => p.is_public).length} public
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search modules, quotas, or plans..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="modules" className="space-y-4">
        <TabsList>
          <TabsTrigger value="modules">Feature Modules</TabsTrigger>
          <TabsTrigger value="quotas">Quotas</TabsTrigger>
          <TabsTrigger value="plans">Service Plans</TabsTrigger>
        </TabsList>

        {/* Feature Modules Tab */}
        <TabsContent value="modules" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-medium">Feature Modules</h3>
              <p className="text-sm text-muted-foreground">
                Reusable feature components for service plans
              </p>
            </div>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Module
            </Button>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Module</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Pricing</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {modulesLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      Loading modules...
                    </TableCell>
                  </TableRow>
                ) : filteredModules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No modules found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredModules.map((module) => (
                    <TableRow key={module.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{module.module_name}</p>
                          <p className="text-sm text-muted-foreground">{module.module_code}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{module.category}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          ${ (module.base_price ?? 0).toFixed(2) }
                          <span className="text-muted-foreground">
                            {" "}
                            ({module.pricing_model})
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {module.is_active ? (
                          <Badge className="bg-green-500">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <XCircle className="mr-1 h-3 w-3" />
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" aria-label="Open actions menu">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Copy className="mr-2 h-4 w-4" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Quotas Tab */}
        <TabsContent value="quotas" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-medium">Quota Definitions</h3>
              <p className="text-sm text-muted-foreground">Resource limits and usage tracking</p>
            </div>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Quota
            </Button>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quota</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Pricing</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotasLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      Loading quotas...
                    </TableCell>
                  </TableRow>
                ) : filteredQuotas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No quotas found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredQuotas.map((quota) => (
                    <TableRow key={quota.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{quota.quota_name}</p>
                          <p className="text-sm text-muted-foreground">{quota.quota_code}</p>
                        </div>
                      </TableCell>
                      <TableCell>{quota.unit_name}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {quota.overage_rate ? (
                            <>
                              ${quota.overage_rate.toFixed(4)}
                              <span className="text-muted-foreground"> per {quota.unit_name}</span>
                            </>
                          ) : (
                            <span className="text-muted-foreground">No overage</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {quota.is_metered ? (
                          <Badge>Metered ({quota.reset_period})</Badge>
                        ) : (
                          <Badge variant="outline">Lifetime</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" aria-label="Open actions menu">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Service Plans Tab */}
        <TabsContent value="plans" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-medium">Service Plans</h3>
              <p className="text-sm text-muted-foreground">
                Composed plans from modules and quotas
              </p>
            </div>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Plan
            </Button>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan</TableHead>
                  <TableHead>Pricing</TableHead>
                  <TableHead>Modules</TableHead>
                  <TableHead>Quotas</TableHead>
                  <TableHead>Visibility</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plansLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      Loading plans...
                    </TableCell>
                  </TableRow>
                ) : filteredPlans.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No plans found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPlans.map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{plan.plan_name}</p>
                          <p className="text-sm text-muted-foreground">{plan.plan_code}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          ${(plan.base_price_monthly ?? 0).toFixed(2)}/mo
                          {(plan.annual_discount_percent ?? 0) > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {(plan.annual_discount_percent ?? 0)}% annual discount
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {plan.modules?.filter((m) => m.included_by_default).length || 0} included
                      </TableCell>
                      <TableCell>{plan.quotas?.length || 0} limits</TableCell>
                      <TableCell>
                        {plan.is_public ? (
                          <Badge>Public</Badge>
                        ) : plan.is_custom ? (
                          <Badge variant="outline">Custom</Badge>
                        ) : (
                          <Badge variant="secondary">Private</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" aria-label="Open actions menu">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Copy className="mr-2 h-4 w-4" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
