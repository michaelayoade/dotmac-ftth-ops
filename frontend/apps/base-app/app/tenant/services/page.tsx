"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Plus,
  Search,
  RefreshCw,
  CheckCircle,
  Clock,
  PlayCircle,
  PauseCircle,
  StopCircle,
  Edit,
  Trash2,
  Heart,
  MoreVertical,
  Users,
  Server,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useServiceStatistics,
  useServiceInstances,
  useSuspendService,
  useResumeService,
  useProvisionService,
  useActivateService,
  useTerminateService,
  useModifyService,
  useHealthCheckService,
} from "@/hooks/useServiceLifecycle";
import type { ServiceInstanceSummary, ServiceStatusValue } from "@/types";
import { useToast } from "@/components/ui/use-toast";
import { logger } from "@/lib/logger";
import { Loader2 } from "lucide-react";

function ServiceStatisticsCards() {
  const { data: statistics, isLoading } = useServiceStatistics();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-slate-700 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-slate-700 rounded w-3/4"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!statistics) return null;

  const stats = [
    {
      label: "Total Services",
      value: statistics.total_services,
      icon: Server,
      color: "text-blue-400",
      bgColor: "bg-blue-500/20",
    },
    {
      label: "Active Services",
      value: statistics.active_count,
      icon: CheckCircle,
      color: "text-green-400",
      bgColor: "bg-green-500/20",
    },
    {
      label: "Provisioning",
      value: statistics.provisioning_count,
      icon: Clock,
      color: "text-yellow-400",
      bgColor: "bg-yellow-500/20",
    },
    {
      label: "Suspended",
      value: statistics.suspended_count,
      icon: AlertTriangle,
      color: "text-orange-400",
      bgColor: "bg-orange-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label} className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400 mb-1">{stat.label}</p>
                  <p className="text-3xl font-bold text-white">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function ServiceStatusBadge({
  status,
}: {
  status: ServiceStatusValue | "provisioning" | "active";
}) {
  const statusConfig: Record<
    string,
    {
      label: string;
      variant: "default" | "secondary" | "destructive" | "outline";
      icon: any;
    }
  > = {
    provisioning: {
      label: "Provisioning",
      variant: "secondary",
      icon: Clock,
    },
    active: {
      label: "Active",
      variant: "default",
      icon: CheckCircle,
    },
    suspended: {
      label: "Suspended",
      variant: "outline",
      icon: PauseCircle,
    },
    terminated: {
      label: "Terminated",
      variant: "destructive",
      icon: StopCircle,
    },
  };

  const normalizedStatus = status as keyof typeof statusConfig;
  const configRecord = (statusConfig[normalizedStatus] ?? statusConfig.provisioning)!;
  const Icon = configRecord.icon;

  return (
    <Badge variant={configRecord.variant} className="flex items-center gap-1">
      <Icon className="h-3 w-3" />
      {configRecord.label}
    </Badge>
  );
}

interface ServiceActionsMenuProps {
  service: ServiceInstanceSummary;
  onAction: (action: string, service: ServiceInstanceSummary) => void;
}

function ServiceActionsMenu({ service, onAction }: ServiceActionsMenuProps) {
  const canActivate = service.status === "provisioning";
  const canSuspend = service.status === "active";
  const canResume = service.status === "suspended";
  const canTerminate = service.status !== "terminated";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => onAction("view", service)}>
          <Activity className="h-4 w-4 mr-2" />
          View Details
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction("health-check", service)}>
          <Heart className="h-4 w-4 mr-2" />
          Health Check
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {canActivate && (
          <DropdownMenuItem onClick={() => onAction("activate", service)}>
            <PlayCircle className="h-4 w-4 mr-2" />
            Activate Service
          </DropdownMenuItem>
        )}
        {canSuspend && (
          <DropdownMenuItem onClick={() => onAction("suspend", service)}>
            <PauseCircle className="h-4 w-4 mr-2" />
            Suspend Service
          </DropdownMenuItem>
        )}
        {canResume && (
          <DropdownMenuItem onClick={() => onAction("resume", service)}>
            <PlayCircle className="h-4 w-4 mr-2" />
            Resume Service
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => onAction("modify", service)}>
          <Edit className="h-4 w-4 mr-2" />
          Modify Service
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {canTerminate && (
          <DropdownMenuItem
            onClick={() => onAction("terminate", service)}
            className="text-red-400 focus:text-red-400"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Terminate Service
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function ServicesPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    ServiceStatusValue | "provisioning" | "active" | "all"
  >("all");
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>("all");
  const [showModifyModal, setShowModifyModal] = useState(false);
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [showTerminateDialog, setShowTerminateDialog] = useState(false);
  const [selectedService, setSelectedService] = useState<ServiceInstanceSummary | null>(null);
  const [provisionForm, setProvisionForm] = useState({
    customerId: "",
    serviceType: "internet",
    configuration: "",
  });
  const [modifyForm, setModifyForm] = useState({
    configuration: "",
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // API Hooks
  const {
    data: services,
    isLoading,
    refetch,
  } = useServiceInstances({
    status: statusFilter === "all" ? undefined : statusFilter,
    serviceType: serviceTypeFilter === "all" ? undefined : serviceTypeFilter,
    limit: 100,
    offset: 0,
  });

  const suspendMutation = useSuspendService();
  const resumeMutation = useResumeService();
  const activateMutation = useActivateService();
  const terminateMutation = useTerminateService();
  const modifyMutation = useModifyService();
  const healthCheckMutation = useHealthCheckService();
  const provisionMutation = useProvisionService();

  // Filter services by search query
  const filteredServices = useMemo(() => {
    if (!services) return [];

    return services.filter((service) => {
      const matchesSearch =
        searchQuery === "" ||
        service.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        service.customer_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        service.service_type.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesSearch;
    });
  }, [services, searchQuery]);

  // Get unique service types for filter
  const serviceTypes = useMemo(() => {
    if (!services) return [];
    return Array.from(new Set(services.map((s) => s.service_type)));
  }, [services]);

  const handleAction = async (action: string, service: ServiceInstanceSummary) => {
    try {
      switch (action) {
        case "activate":
          await activateMutation.mutateAsync({
            serviceId: service.id,
          });
          logger.info("Service activated", { serviceId: service.id });
          toast({
            title: "Service Activated",
            description: `Service ${service.id} has been activated successfully.`,
          });
          await refetch();
          break;

        case "suspend":
          await suspendMutation.mutateAsync({
            serviceId: service.id,
            payload: { reason: "Manual suspension via UI" },
          });
          logger.info("Service suspended", { serviceId: service.id });
          toast({
            title: "Service Suspended",
            description: `Service ${service.id} has been suspended.`,
          });
          await refetch();
          break;

        case "resume":
          await resumeMutation.mutateAsync({
            serviceId: service.id,
          });
          logger.info("Service resumed", { serviceId: service.id });
          toast({
            title: "Service Resumed",
            description: `Service ${service.id} has been resumed.`,
          });
          await refetch();
          break;

        case "terminate":
          // Open terminate confirmation dialog
          setSelectedService(service);
          setShowTerminateDialog(true);
          break;

        case "health-check":
          await healthCheckMutation.mutateAsync({
            serviceId: service.id,
          });
          logger.info("Health check completed", { serviceId: service.id });
          toast({
            title: "Health Check Completed",
            description: `Health check for service ${service.id} completed successfully.`,
          });
          break;

        case "view":
          // Navigate to service detail page
          router.push(`/tenant/services/${service.id}`);
          break;

        case "modify":
          // Open modify modal
          setSelectedService(service);
          setModifyForm({
            configuration: "",
            notes: "",
          });
          setShowModifyModal(true);
          break;

        default:
          break;
      }
    } catch (error) {
      logger.error("Service action failed", error, { action, serviceId: service.id });
      toast({
        title: "Operation Failed",
        description: error instanceof Error ? error.message : "An error occurred.",
        variant: "destructive",
      });
    }
  };

  const handleProvisionNew = () => {
    // Reset form and open provision service modal
    setProvisionForm({
      customerId: "",
      serviceType: "internet",
      configuration: "",
    });
    setShowProvisionModal(true);
  };

  const handleProvisionService = async () => {
    if (!provisionForm.customerId.trim()) {
      toast({
        title: "Validation Error",
        description: "Customer ID is required",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await provisionMutation.mutateAsync({
        payload: {
          customer_id: provisionForm.customerId,
          service_type: provisionForm.serviceType,
          configuration: provisionForm.configuration
            ? JSON.parse(provisionForm.configuration)
            : {},
        },
      });
      logger.info("Service provisioned", {
        customerId: provisionForm.customerId,
        serviceType: provisionForm.serviceType,
      });
      toast({
        title: "Service Provisioned",
        description: "Service has been provisioned successfully and is now activating.",
      });
      setShowProvisionModal(false);
      await refetch();
    } catch (error) {
      logger.error("Failed to provision service", error);
      toast({
        title: "Provisioning Failed",
        description: error instanceof Error ? error.message : "Failed to provision service.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleModifyService = async () => {
    if (!selectedService) return;

    setIsSubmitting(true);
    try {
      await modifyMutation.mutateAsync({
        serviceId: selectedService.id,
        payload: {
          configuration: modifyForm.configuration
            ? JSON.parse(modifyForm.configuration)
            : undefined,
          notes: modifyForm.notes || undefined,
        },
      });
      logger.info("Service modified", { serviceId: selectedService.id });
      toast({
        title: "Service Modified",
        description: `Service ${selectedService.id} has been modified successfully.`,
      });
      setShowModifyModal(false);
      setSelectedService(null);
      await refetch();
    } catch (error) {
      logger.error("Failed to modify service", error);
      toast({
        title: "Modification Failed",
        description: error instanceof Error ? error.message : "Failed to modify service.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmTerminate = async () => {
    if (!selectedService) return;

    setIsSubmitting(true);
    try {
      await terminateMutation.mutateAsync({
        serviceId: selectedService.id,
        payload: { reason: "Manual termination via UI" },
      });
      logger.info("Service terminated", { serviceId: selectedService.id });
      toast({
        title: "Service Terminated",
        description: `Service ${selectedService.id} has been terminated.`,
        variant: "destructive",
      });
      setShowTerminateDialog(false);
      setSelectedService(null);
      await refetch();
    } catch (error) {
      logger.error("Failed to terminate service", error);
      toast({
        title: "Termination Failed",
        description: error instanceof Error ? error.message : "Failed to terminate service.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Service Lifecycle Management</h1>
          <p className="text-slate-400 mt-1">Manage and monitor your service instances</p>
        </div>
        <Button onClick={handleProvisionNew} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          Provision Service
        </Button>
      </div>

      {/* Statistics Cards */}
      <ServiceStatisticsCards />

      {/* Filters and Search */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Service Instances</CardTitle>
          <CardDescription>View and manage all service instances</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-900 border-slate-700 text-white"
              />
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
              <SelectTrigger className="w-full md:w-48 bg-slate-900 border-slate-700 text-white">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="provisioning">Provisioning</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="terminated">Terminated</SelectItem>
              </SelectContent>
            </Select>

            {/* Service Type Filter */}
            <Select value={serviceTypeFilter} onValueChange={setServiceTypeFilter}>
              <SelectTrigger className="w-full md:w-48 bg-slate-900 border-slate-700 text-white">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {serviceTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Refresh Button */}
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={isLoading}
              className="border-slate-700"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {/* Service List */}
          <ScrollArea className="h-[600px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <RefreshCw className="h-8 w-8 animate-spin text-blue-400 mx-auto mb-2" />
                  <p className="text-slate-400">Loading services...</p>
                </div>
              </div>
            ) : filteredServices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Server className="h-12 w-12 text-slate-600 mb-4" />
                <p className="text-slate-400 text-lg mb-2">No services found</p>
                <p className="text-slate-500 text-sm">
                  {searchQuery || statusFilter !== "all" || serviceTypeFilter !== "all"
                    ? "Try adjusting your filters"
                    : "Provision your first service to get started"}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredServices.map((service) => (
                  <Card
                    key={service.id}
                    className="bg-slate-900 border-slate-700 hover:border-slate-600 transition-colors"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-white font-medium font-mono text-sm">
                              {service.id}
                            </h3>
                            <ServiceStatusBadge status={service.status} />
                            <Badge variant="outline" className="text-xs">
                              {service.service_type}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                            {service.customer_id && (
                              <div className="flex items-center text-slate-400">
                                <Users className="h-3 w-3 mr-2" />
                                <span className="font-mono text-xs">{service.customer_id}</span>
                              </div>
                            )}
                            {service.created_at && (
                              <div className="flex items-center text-slate-400">
                                <Clock className="h-3 w-3 mr-2" />
                                Created: {new Date(service.created_at).toLocaleDateString()}
                              </div>
                            )}
                            {service.activated_at && (
                              <div className="flex items-center text-slate-400">
                                <CheckCircle className="h-3 w-3 mr-2" />
                                Activated: {new Date(service.activated_at).toLocaleDateString()}
                              </div>
                            )}
                          </div>

                          {false && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {([] as Array<[string, unknown]>).map(([key, value]) => (
                                <Badge
                                  key={key}
                                  variant="secondary"
                                  className="text-xs bg-slate-800"
                                >
                                  {key}: {String(value)}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        <ServiceActionsMenu service={service} onAction={handleAction} />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Provision Service Modal */}
      <Dialog open={showProvisionModal} onOpenChange={setShowProvisionModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Provision New Service</DialogTitle>
            <DialogDescription>
              Create a new service instance for a customer
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="customerId">Customer ID *</Label>
              <Input
                id="customerId"
                value={provisionForm.customerId}
                onChange={(e) =>
                  setProvisionForm({ ...provisionForm, customerId: e.target.value })
                }
                placeholder="Enter customer ID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="serviceType">Service Type *</Label>
              <Select
                value={provisionForm.serviceType}
                onValueChange={(value) =>
                  setProvisionForm({ ...provisionForm, serviceType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internet">Internet</SelectItem>
                  <SelectItem value="voip">VoIP</SelectItem>
                  <SelectItem value="iptv">IPTV</SelectItem>
                  <SelectItem value="bundle">Bundle</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="configuration">
                Configuration (JSON, optional)
              </Label>
              <Textarea
                id="configuration"
                value={provisionForm.configuration}
                onChange={(e) =>
                  setProvisionForm({ ...provisionForm, configuration: e.target.value })
                }
                placeholder='{"bandwidth": "100mbps", "plan": "premium"}'
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowProvisionModal(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleProvisionService} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Provisioning...
                </>
              ) : (
                "Provision Service"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modify Service Modal */}
      <Dialog open={showModifyModal} onOpenChange={setShowModifyModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modify Service</DialogTitle>
            <DialogDescription>
              Update service configuration for {selectedService?.id}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="modifyConfiguration">
                Configuration (JSON, optional)
              </Label>
              <Textarea
                id="modifyConfiguration"
                value={modifyForm.configuration}
                onChange={(e) =>
                  setModifyForm({ ...modifyForm, configuration: e.target.value })
                }
                placeholder='{"bandwidth": "200mbps"}'
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="modifyNotes">Notes (optional)</Label>
              <Textarea
                id="modifyNotes"
                value={modifyForm.notes}
                onChange={(e) =>
                  setModifyForm({ ...modifyForm, notes: e.target.value })
                }
                placeholder="Add notes about this modification"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowModifyModal(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleModifyService} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Modifying...
                </>
              ) : (
                "Modify Service"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Terminate Confirmation Dialog */}
      <AlertDialog open={showTerminateDialog} onOpenChange={setShowTerminateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Terminate Service?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to terminate service{" "}
              <span className="font-mono font-semibold">{selectedService?.id}</span>?
              This action cannot be undone and will permanently deactivate the service.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmTerminate}
              disabled={isSubmitting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Terminating...
                </>
              ) : (
                "Terminate Service"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
