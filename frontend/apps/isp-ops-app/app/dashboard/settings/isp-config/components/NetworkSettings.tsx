/**
 * Network Provisioning Settings Component
 *
 * Configures network infrastructure defaults including VLAN ranges,
 * IP address pools, and CPE provisioning settings.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Network, AlertTriangle } from "lucide-react";

interface NetworkSettingsProps {
  settings: {
    vlan_range_start: number;
    vlan_range_end: number;
    ipv4_pool_prefix: string;
    ipv6_pool_prefix: string;
    ipv6_prefix_length: number;
    auto_assign_ip: boolean;
    require_static_ip: boolean;
    enable_ipv6: boolean;
    default_cpe_template: string | null;
    auto_provision_cpe: boolean;
    default_qos_policy: string | null;
  };
  onChange: (settings: any) => void;
}

export function NetworkSettings({ settings, onChange }: NetworkSettingsProps) {
  const updateSetting = (key: string, value: any) => {
    onChange({
      ...settings,
      [key]: value,
    });
  };

  // Calculate VLAN count
  const vlanCount = settings.vlan_range_end - settings.vlan_range_start + 1;

  // Validate IP prefix format
  const isValidIPv4Prefix = (prefix: string): boolean => {
    const regex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
    return regex.test(prefix);
  };

  const isValidIPv6Prefix = (prefix: string): boolean => {
    const regex = /^([0-9a-fA-F:]+)\/\d{1,3}$/;
    return regex.test(prefix);
  };

  return (
    <div className="space-y-6">
      <Alert>
        <Network className="h-4 w-4" />
        <AlertDescription>
          These settings define default network provisioning behavior. Changes affect{" "}
          <strong>new subscribers only</strong>.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>VLAN Configuration</CardTitle>
          <CardDescription>Define VLAN range for subscriber provisioning</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {/* VLAN Start */}
            <div className="space-y-2">
              <Label htmlFor="vlan_start">VLAN Range Start</Label>
              <Input
                id="vlan_start"
                type="number"
                min="1"
                max="4094"
                value={settings.vlan_range_start}
                onChange={(e) => updateSetting("vlan_range_start", parseInt(e.target.value))}
              />
              <p className="text-sm text-muted-foreground">Minimum VLAN ID (1-4094)</p>
            </div>

            {/* VLAN End */}
            <div className="space-y-2">
              <Label htmlFor="vlan_end">VLAN Range End</Label>
              <Input
                id="vlan_end"
                type="number"
                min="1"
                max="4094"
                value={settings.vlan_range_end}
                onChange={(e) => updateSetting("vlan_range_end", parseInt(e.target.value))}
              />
              <p className="text-sm text-muted-foreground">Maximum VLAN ID (1-4094)</p>
            </div>
          </div>

          {/* VLAN Count Display */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              VLAN Range: {settings.vlan_range_start} - {settings.vlan_range_end} (
              {vlanCount.toLocaleString()} VLANs available)
            </AlertDescription>
          </Alert>

          {/* Validation Warning */}
          {settings.vlan_range_start >= settings.vlan_range_end && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>VLAN range end must be greater than start</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>IPv4 Address Pool</CardTitle>
          <CardDescription>Configure IPv4 address pool for subscriber assignment</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="ipv4_pool">IPv4 Pool Prefix (CIDR)</Label>
            <Input
              id="ipv4_pool"
              value={settings.ipv4_pool_prefix}
              onChange={(e) => updateSetting("ipv4_pool_prefix", e.target.value)}
              placeholder="10.0.0.0/8"
            />
            <p className="text-sm text-muted-foreground">
              Address pool in CIDR notation (e.g., 10.50.0.0/16, 192.168.0.0/16)
            </p>
          </div>

          {!isValidIPv4Prefix(settings.ipv4_pool_prefix) && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Invalid IPv4 CIDR format. Expected format: 10.0.0.0/8
              </AlertDescription>
            </Alert>
          )}

          {isValidIPv4Prefix(settings.ipv4_pool_prefix) && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Pool: {settings.ipv4_pool_prefix} (~
                {Math.pow(
                  2,
                  32 - parseInt(settings.ipv4_pool_prefix.split("/")[1] || "24"),
                ).toLocaleString()}{" "}
                addresses)
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>IPv6 Address Pool</CardTitle>
          <CardDescription>Configure IPv6 address pool for subscriber assignment</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-0.5">
              <Label htmlFor="enable_ipv6">Enable IPv6</Label>
              <p className="text-sm text-muted-foreground">
                Enable IPv6 provisioning for new subscribers
              </p>
            </div>
            <Switch
              id="enable_ipv6"
              checked={settings.enable_ipv6}
              onCheckedChange={(checked) => updateSetting("enable_ipv6", checked)}
            />
          </div>

          {settings.enable_ipv6 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="ipv6_pool">IPv6 Pool Prefix (CIDR)</Label>
                <Input
                  id="ipv6_pool"
                  value={settings.ipv6_pool_prefix}
                  onChange={(e) => updateSetting("ipv6_pool_prefix", e.target.value)}
                  placeholder="2001:db8::/32"
                />
                <p className="text-sm text-muted-foreground">
                  Address pool in CIDR notation (e.g., 2001:db8:1234::/48)
                </p>
              </div>

              {!isValidIPv6Prefix(settings.ipv6_pool_prefix) && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Invalid IPv6 CIDR format. Expected format: 2001:db8::/32
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="ipv6_prefix_length">IPv6 Prefix Length (per subscriber)</Label>
                <Select
                  value={settings.ipv6_prefix_length.toString()}
                  onValueChange={(value) => updateSetting("ipv6_prefix_length", parseInt(value))}
                >
                  <SelectTrigger id="ipv6_prefix_length">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="48">/48 (281 trillion addresses)</SelectItem>
                    <SelectItem value="56">/56 (4.7 billion addresses)</SelectItem>
                    <SelectItem value="60">/60 (268 million addresses)</SelectItem>
                    <SelectItem value="64">/64 (18 quintillion addresses) - Recommended</SelectItem>
                    <SelectItem value="80">/80 (281 trillion addresses)</SelectItem>
                    <SelectItem value="128">/128 (Single address)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Size of IPv6 prefix assigned to each subscriber
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>IP Assignment Policy</CardTitle>
          <CardDescription>Configure how IP addresses are assigned to subscribers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto_assign">Auto-assign IP Addresses</Label>
              <p className="text-sm text-muted-foreground">
                Automatically assign IPs from pool during provisioning
              </p>
            </div>
            <Switch
              id="auto_assign"
              checked={settings.auto_assign_ip}
              onCheckedChange={(checked) => updateSetting("auto_assign_ip", checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="require_static">Require Static IP</Label>
              <p className="text-sm text-muted-foreground">
                Require static IP assignment (disable DHCP)
              </p>
            </div>
            <Switch
              id="require_static"
              checked={settings.require_static_ip}
              onCheckedChange={(checked) => updateSetting("require_static_ip", checked)}
            />
          </div>

          {settings.require_static_ip && !settings.auto_assign_ip && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Static IP required but auto-assignment is disabled. Subscribers will need manual IP
                configuration.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>CPE Provisioning</CardTitle>
          <CardDescription>
            Configure Customer Premise Equipment (CPE) provisioning defaults
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto_provision_cpe">Auto-provision CPE</Label>
              <p className="text-sm text-muted-foreground">
                Automatically provision CPE on subscriber activation
              </p>
            </div>
            <Switch
              id="auto_provision_cpe"
              checked={settings.auto_provision_cpe}
              onCheckedChange={(checked) => updateSetting("auto_provision_cpe", checked)}
            />
          </div>

          {settings.auto_provision_cpe && (
            <div className="space-y-2">
              <Label htmlFor="cpe_template">Default CPE Template</Label>
              <Input
                id="cpe_template"
                value={settings.default_cpe_template || ""}
                onChange={(e) => updateSetting("default_cpe_template", e.target.value || null)}
                placeholder="Enter template ID or name"
              />
              <p className="text-sm text-muted-foreground">
                GenieACS/TR-069 configuration template for new CPE devices
              </p>
            </div>
          )}

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              CPE templates are managed in the GenieACS integration. This setting only applies when
              GenieACS is enabled.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>QoS Settings</CardTitle>
          <CardDescription>Configure default Quality of Service policies</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="qos_policy">Default QoS Policy</Label>
            <Input
              id="qos_policy"
              value={settings.default_qos_policy || ""}
              onChange={(e) => updateSetting("default_qos_policy", e.target.value || null)}
              placeholder="Enter QoS policy name"
            />
            <p className="text-sm text-muted-foreground">
              Default QoS policy applied to new subscribers (leave empty for none)
            </p>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              QoS policies must be configured on your network equipment (routers, switches). This
              setting only references the policy name.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
