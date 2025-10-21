/**
 * SubscriberDetailModal Component
 *
 * Comprehensive modal for viewing and managing subscriber details
 */

"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  User,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Activity,
  Wifi,
  DollarSign,
  Package,
  X,
  Edit,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Ban,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import type { Subscriber, SubscriberStatus, ConnectionType } from "@/hooks/useSubscribers";
import { useSubscriberServices } from "@/hooks/useSubscribers";

interface SubscriberDetailModalProps {
  subscriber: Subscriber | null;
  open: boolean;
  onClose: () => void;
  onUpdate?: () => void;
  onSuspend?: (subscriber: Subscriber) => void;
  onActivate?: (subscriber: Subscriber) => void;
  onTerminate?: (subscriber: Subscriber) => void;
}

const getStatusColor = (status: SubscriberStatus): string => {
  const colors: Record<SubscriberStatus, string> = {
    active: "bg-green-100 text-green-800 border-green-200",
    suspended: "bg-yellow-100 text-yellow-800 border-yellow-200",
    pending: "bg-blue-100 text-blue-800 border-blue-200",
    inactive: "bg-gray-100 text-gray-800 border-gray-200",
    terminated: "bg-red-100 text-red-800 border-red-200",
  };
  return colors[status] || "bg-gray-100 text-gray-800 border-gray-200";
};

const getConnectionTypeColor = (type: ConnectionType): string => {
  const colors: Record<ConnectionType, string> = {
    ftth: "bg-purple-100 text-purple-800",
    fttb: "bg-blue-100 text-blue-800",
    wireless: "bg-cyan-100 text-cyan-800",
    hybrid: "bg-orange-100 text-orange-800",
  };
  return colors[type] || "bg-gray-100 text-gray-800";
};

export function SubscriberDetailModal({
  subscriber,
  open,
  onClose,
  onUpdate,
  onSuspend,
  onActivate,
  onTerminate,
}: SubscriberDetailModalProps) {
  const [activeTab, setActiveTab] = useState("details");
  const {
    services,
    isLoading: servicesLoading,
    refetch: refetchServices,
  } = useSubscriberServices(subscriber?.id || null);

  useEffect(() => {
    if (open && subscriber) {
      refetchServices();
    }
  }, [open, subscriber, refetchServices]);

  const handleExport = () => {
    if (!subscriber) return;

    const data = {
      subscriber,
      services,
      exported_at: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `subscriber-${subscriber.subscriber_id}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!subscriber) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-semibold">
                    {subscriber.first_name} {subscriber.last_name}
                  </DialogTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="font-mono text-xs">
                      {subscriber.subscriber_id}
                    </Badge>
                    <Badge className={getStatusColor(subscriber.status)}>
                      {subscriber.status.toUpperCase()}
                    </Badge>
                    <Badge className={getConnectionTypeColor(subscriber.connection_type)}>
                      {subscriber.connection_type.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <Separator />

        {/* Quick Actions */}
        <div className="flex gap-2 py-2">
          {subscriber.status === "active" && onSuspend && (
            <Button size="sm" variant="outline" onClick={() => onSuspend(subscriber)}>
              <Ban className="h-4 w-4 mr-2" />
              Suspend
            </Button>
          )}
          {(subscriber.status === "suspended" || subscriber.status === "pending") && onActivate && (
            <Button size="sm" variant="outline" onClick={() => onActivate(subscriber)}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Activate
            </Button>
          )}
          {subscriber.status !== "terminated" && onTerminate && (
            <Button size="sm" variant="outline" onClick={() => onTerminate(subscriber)}>
              <XCircle className="h-4 w-4 mr-2" />
              Terminate
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              refetchServices();
              onUpdate?.();
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <Separator />

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="services">
              Services
              {services.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {services.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="network">Network</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4">
            {/* Details Tab */}
            <TabsContent value="details" className="space-y-4 mt-0">
              {/* Contact Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Full Name</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-medium">
                          {subscriber.first_name} {subscriber.last_name}
                        </p>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Email</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm">{subscriber.email}</p>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Primary Phone</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm">{subscriber.phone}</p>
                      </div>
                    </div>
                    {subscriber.secondary_phone && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Secondary Phone</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm">{subscriber.secondary_phone}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Service Address */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Service Address</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="text-sm">
                      <p>{subscriber.service_address}</p>
                      <p>
                        {subscriber.service_city}, {subscriber.service_state}{" "}
                        {subscriber.service_postal_code}
                      </p>
                      <p>{subscriber.service_country}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Installation Details */}
              {subscriber.installation_date && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Installation Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Installation Date</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm">
                            {format(new Date(subscriber.installation_date), "PPP")}
                          </p>
                        </div>
                      </div>
                      {subscriber.installation_technician && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Technician</Label>
                          <p className="text-sm mt-1">{subscriber.installation_technician}</p>
                        </div>
                      )}
                      {subscriber.installation_status && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Status</Label>
                          <p className="text-sm mt-1">{subscriber.installation_status}</p>
                        </div>
                      )}
                    </div>
                    {subscriber.installation_notes && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Notes</Label>
                        <p className="text-sm mt-1 text-muted-foreground">
                          {subscriber.installation_notes}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Additional Notes */}
              {subscriber.notes && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{subscriber.notes}</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Services Tab */}
            <TabsContent value="services" className="space-y-4 mt-0">
              {servicesLoading ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Loading services...</p>
                  </CardContent>
                </Card>
              ) : services.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No services configured</p>
                  </CardContent>
                </Card>
              ) : (
                services.map((service) => (
                  <Card key={service.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base">{service.service_name}</CardTitle>
                          <CardDescription>{service.service_type}</CardDescription>
                        </div>
                        <Badge variant={service.status === "active" ? "default" : "secondary"}>
                          {service.status.toUpperCase()}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        {service.bandwidth_mbps && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Bandwidth</Label>
                            <p className="text-sm mt-1">{service.bandwidth_mbps} Mbps</p>
                          </div>
                        )}
                        <div>
                          <Label className="text-xs text-muted-foreground">Monthly Fee</Label>
                          <p className="text-sm mt-1">${service.monthly_fee.toFixed(2)}</p>
                        </div>
                        {service.activation_date && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Activated</Label>
                            <p className="text-sm mt-1">
                              {format(new Date(service.activation_date), "PP")}
                            </p>
                          </div>
                        )}
                        {service.static_ip && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Static IP</Label>
                            <Badge variant="outline" className="mt-1">
                              Enabled
                            </Badge>
                          </div>
                        )}
                      </div>
                      {service.ipv4_addresses && service.ipv4_addresses.length > 0 && (
                        <div>
                          <Label className="text-xs text-muted-foreground">IPv4 Addresses</Label>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {service.ipv4_addresses.map((ip, idx) => (
                              <Badge key={idx} variant="outline" className="font-mono text-xs">
                                {ip}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            {/* Network Tab */}
            <TabsContent value="network" className="space-y-4 mt-0">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Network Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    {subscriber.ont_serial_number && (
                      <div>
                        <Label className="text-xs text-muted-foreground">ONT Serial Number</Label>
                        <p className="text-sm font-mono mt-1">{subscriber.ont_serial_number}</p>
                      </div>
                    )}
                    {subscriber.ont_mac_address && (
                      <div>
                        <Label className="text-xs text-muted-foreground">ONT MAC Address</Label>
                        <p className="text-sm font-mono mt-1">{subscriber.ont_mac_address}</p>
                      </div>
                    )}
                    {subscriber.router_serial_number && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Router Serial</Label>
                        <p className="text-sm font-mono mt-1">{subscriber.router_serial_number}</p>
                      </div>
                    )}
                    {subscriber.vlan_id && (
                      <div>
                        <Label className="text-xs text-muted-foreground">VLAN ID</Label>
                        <p className="text-sm font-mono mt-1">{subscriber.vlan_id}</p>
                      </div>
                    )}
                    {subscriber.ipv4_address && (
                      <div>
                        <Label className="text-xs text-muted-foreground">IPv4 Address</Label>
                        <p className="text-sm font-mono mt-1">{subscriber.ipv4_address}</p>
                      </div>
                    )}
                    {subscriber.ipv6_address && (
                      <div>
                        <Label className="text-xs text-muted-foreground">IPv6 Address</Label>
                        <p className="text-sm font-mono mt-1 break-all">
                          {subscriber.ipv6_address}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Service Quality */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Service Quality</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    {subscriber.signal_strength !== undefined && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Signal Strength</Label>
                        <p className="text-sm mt-1">{subscriber.signal_strength} dBm</p>
                      </div>
                    )}
                    {subscriber.uptime_percentage !== undefined && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Uptime</Label>
                        <p className="text-sm mt-1">{subscriber.uptime_percentage.toFixed(2)}%</p>
                      </div>
                    )}
                    {subscriber.last_online && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Last Online</Label>
                        <p className="text-sm mt-1">
                          {format(new Date(subscriber.last_online), "PPp")}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Billing Tab */}
            <TabsContent value="billing" className="space-y-4 mt-0">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Subscription Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    {subscriber.subscription_start_date && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Start Date</Label>
                        <p className="text-sm mt-1">
                          {format(new Date(subscriber.subscription_start_date), "PP")}
                        </p>
                      </div>
                    )}
                    {subscriber.subscription_end_date && (
                      <div>
                        <Label className="text-xs text-muted-foreground">End Date</Label>
                        <p className="text-sm mt-1">
                          {format(new Date(subscriber.subscription_end_date), "PP")}
                        </p>
                      </div>
                    )}
                    {subscriber.billing_cycle && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Billing Cycle</Label>
                        <p className="text-sm mt-1">{subscriber.billing_cycle}</p>
                      </div>
                    )}
                    {subscriber.payment_method && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Payment Method</Label>
                        <p className="text-sm mt-1">{subscriber.payment_method}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Service Plan */}
              {subscriber.service_plan && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Service Plan</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Plan Name</Label>
                        <p className="text-sm mt-1 font-medium">{subscriber.service_plan}</p>
                      </div>
                      {subscriber.bandwidth_mbps && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Bandwidth</Label>
                          <p className="text-sm mt-1">{subscriber.bandwidth_mbps} Mbps</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
