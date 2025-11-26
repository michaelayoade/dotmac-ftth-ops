/**
 * SubscriberDetailModal Component - Shared
 *
 * Comprehensive modal for viewing and managing subscriber details.
 * Parent components provide data via props/callbacks.
 */

"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Separator } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { ScrollArea } from "@dotmac/ui";
import { format } from "date-fns";
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
import { useState, useEffect } from "react";

export type SubscriberStatus = "active" | "suspended" | "pending" | "inactive" | "terminated";
export type ConnectionType = "ftth" | "fttb" | "wireless" | "hybrid";

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

export interface SubscriberDetailModalProps<TSubscriber = any, TService = any> {
  subscriber: TSubscriber | null;
  open: boolean;
  onClose: () => void;
  onUpdate?: () => void;
  onSuspend?: (subscriber: TSubscriber) => void;
  onActivate?: (subscriber: TSubscriber) => void;
  onTerminate?: (subscriber: TSubscriber) => void;

  // Services data
  services?: TService[];
  servicesLoading?: boolean;
  onRefreshServices?: () => void;
}

export function SubscriberDetailModal<TSubscriber = any, TService = any>({
  subscriber,
  open,
  onClose,
  onUpdate,
  onSuspend,
  onActivate,
  onTerminate,
  services = [],
  servicesLoading = false,
  onRefreshServices,
}: SubscriberDetailModalProps<TSubscriber, TService>) {
  const [activeTab, setActiveTab] = useState("details");

  useEffect(() => {
    if (open && subscriber && onRefreshServices) {
      onRefreshServices();
    }
  }, [open, subscriber, onRefreshServices]);

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
    const sub = subscriber as any;
    a.download = `subscriber-${sub.subscriber_id || sub.id}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!subscriber) return null;

  // Cast subscriber to access properties (since it's generic)
  const sub = subscriber as any;

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
                    {sub.first_name} {sub.last_name}
                  </DialogTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="font-mono text-xs">
                      {sub.subscriber_id}
                    </Badge>
                    <Badge className={getStatusColor(sub.status)}>{sub.status.toUpperCase()}</Badge>
                    <Badge className={getConnectionTypeColor(sub.connection_type)}>
                      {sub.connection_type.toUpperCase()}
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
          {sub.status === "active" && onSuspend && (
            <Button size="sm" variant="outline" onClick={() => onSuspend(subscriber)}>
              <Ban className="h-4 w-4 mr-2" />
              Suspend
            </Button>
          )}
          {(sub.status === "suspended" || sub.status === "pending") && onActivate && (
            <Button size="sm" variant="outline" onClick={() => onActivate(subscriber)}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Activate
            </Button>
          )}
          {sub.status !== "terminated" && onTerminate && (
            <Button size="sm" variant="outline" onClick={() => onTerminate(subscriber)}>
              <XCircle className="h-4 w-4 mr-2" />
              Terminate
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              onRefreshServices?.();
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
                          {sub.first_name} {sub.last_name}
                        </p>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Email</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm">{sub.email}</p>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Primary Phone</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm">{sub.phone}</p>
                      </div>
                    </div>
                    {sub.secondary_phone && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Secondary Phone</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm">{sub.secondary_phone}</p>
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
                      <p>{sub.service_address}</p>
                      <p>
                        {sub.service_city}, {sub.service_state} {sub.service_postal_code}
                      </p>
                      <p>{sub.service_country}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Installation Details */}
              {sub.installation_date && (
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
                            {format(new Date(sub.installation_date), "PPP")}
                          </p>
                        </div>
                      </div>
                      {sub.installation_technician && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Technician</Label>
                          <p className="text-sm mt-1">{sub.installation_technician}</p>
                        </div>
                      )}
                      {sub.installation_status && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Status</Label>
                          <p className="text-sm mt-1">{sub.installation_status}</p>
                        </div>
                      )}
                    </div>
                    {sub.installation_notes && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Notes</Label>
                        <p className="text-sm mt-1 text-muted-foreground">
                          {sub.installation_notes}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Additional Notes */}
              {sub.notes && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{sub.notes}</p>
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
                services.map((service) => {
                  const svc = service as any;
                  return (
                    <Card key={svc.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-base">{svc.service_name}</CardTitle>
                            <CardDescription>{svc.service_type}</CardDescription>
                          </div>
                          <Badge variant={svc.status === "active" ? "default" : "secondary"}>
                            {svc.status.toUpperCase()}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          {svc.bandwidth_mbps && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Bandwidth</Label>
                              <p className="text-sm mt-1">{svc.bandwidth_mbps} Mbps</p>
                            </div>
                          )}
                          <div>
                            <Label className="text-xs text-muted-foreground">Monthly Fee</Label>
                            <p className="text-sm mt-1">${svc.monthly_fee.toFixed(2)}</p>
                          </div>
                          {svc.activation_date && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Activated</Label>
                              <p className="text-sm mt-1">
                                {format(new Date(svc.activation_date), "PP")}
                              </p>
                            </div>
                          )}
                          {svc.static_ip && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Static IP</Label>
                              <Badge variant="outline" className="mt-1">
                                Enabled
                              </Badge>
                            </div>
                          )}
                        </div>
                        {svc.ipv4_addresses && svc.ipv4_addresses.length > 0 && (
                          <div>
                            <Label className="text-xs text-muted-foreground">IPv4 Addresses</Label>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {svc.ipv4_addresses.map((ip: string, idx: number) => (
                                <Badge key={idx} variant="outline" className="font-mono text-xs">
                                  {ip}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
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
                    {sub.ont_serial_number && (
                      <div>
                        <Label className="text-xs text-muted-foreground">ONT Serial Number</Label>
                        <p className="text-sm font-mono mt-1">{sub.ont_serial_number}</p>
                      </div>
                    )}
                    {sub.ont_mac_address && (
                      <div>
                        <Label className="text-xs text-muted-foreground">ONT MAC Address</Label>
                        <p className="text-sm font-mono mt-1">{sub.ont_mac_address}</p>
                      </div>
                    )}
                    {sub.router_serial_number && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Router Serial</Label>
                        <p className="text-sm font-mono mt-1">{sub.router_serial_number}</p>
                      </div>
                    )}
                    {sub.vlan_id && (
                      <div>
                        <Label className="text-xs text-muted-foreground">VLAN ID</Label>
                        <p className="text-sm font-mono mt-1">{sub.vlan_id}</p>
                      </div>
                    )}
                    {sub.ipv4_address && (
                      <div>
                        <Label className="text-xs text-muted-foreground">IPv4 Address</Label>
                        <p className="text-sm font-mono mt-1">{sub.ipv4_address}</p>
                      </div>
                    )}
                    {sub.ipv6_address && (
                      <div>
                        <Label className="text-xs text-muted-foreground">IPv6 Address</Label>
                        <p className="text-sm font-mono mt-1 break-all">{sub.ipv6_address}</p>
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
                    {sub.signal_strength !== undefined && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Signal Strength</Label>
                        <p className="text-sm mt-1">{sub.signal_strength} dBm</p>
                      </div>
                    )}
                    {sub.uptime_percentage !== undefined && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Uptime</Label>
                        <p className="text-sm mt-1">{sub.uptime_percentage.toFixed(2)}%</p>
                      </div>
                    )}
                    {sub.last_online && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Last Online</Label>
                        <p className="text-sm mt-1">{format(new Date(sub.last_online), "PPp")}</p>
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
                    {sub.subscription_start_date && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Start Date</Label>
                        <p className="text-sm mt-1">
                          {format(new Date(sub.subscription_start_date), "PP")}
                        </p>
                      </div>
                    )}
                    {sub.subscription_end_date && (
                      <div>
                        <Label className="text-xs text-muted-foreground">End Date</Label>
                        <p className="text-sm mt-1">
                          {format(new Date(sub.subscription_end_date), "PP")}
                        </p>
                      </div>
                    )}
                    {sub.billing_cycle && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Billing Cycle</Label>
                        <p className="text-sm mt-1">{sub.billing_cycle}</p>
                      </div>
                    )}
                    {sub.payment_method && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Payment Method</Label>
                        <p className="text-sm mt-1">{sub.payment_method}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Service Plan */}
              {sub.service_plan && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Service Plan</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Plan Name</Label>
                        <p className="text-sm mt-1 font-medium">{sub.service_plan}</p>
                      </div>
                      {sub.bandwidth_mbps && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Bandwidth</Label>
                          <p className="text-sm mt-1">{sub.bandwidth_mbps} Mbps</p>
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
