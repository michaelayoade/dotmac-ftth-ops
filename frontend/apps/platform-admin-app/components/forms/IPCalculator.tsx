"use client";

/**
 * IP Calculator Component
 *
 * Interactive calculator for IP subnet calculations
 */

import React, { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import {
  parseCIDR,
  getIPv4Network,
  getIPv4Broadcast,
  getIPv4UsableHosts,
  cidrToSubnetMask,
  subnetMaskToCIDR,
  IPFamily,
  isValidIPv4CIDR,
  isPrivateIPv4,
  extractIPFromCIDR,
} from "@/lib/utils/ip-address";
import { cn } from "@/lib/utils";

export function IPCalculator() {
  const [cidr, setCidr] = useState("192.168.1.0/24");
  const [subnetMask, setSubnetMask] = useState("255.255.255.0");

  const parsed = useMemo(() => parseCIDR(cidr), [cidr]);
  const isValidCIDR = isValidIPv4CIDR(cidr);

  const calculations = useMemo(() => {
    if (!parsed || parsed.family !== IPFamily.IPv4) return null;

    const network = getIPv4Network(cidr);
    const broadcast = getIPv4Broadcast(cidr);
    const usableHosts = getIPv4UsableHosts(parsed.cidr);
    const mask = cidrToSubnetMask(parsed.cidr);
    const ip = extractIPFromCIDR(cidr);
    const isPrivate = isPrivateIPv4(ip);

    const firstUsable = network
      ? network.split(".").slice(0, 3).join(".") +
        "." +
        (parseInt(network.split(".")[3] ?? "0") + 1)
      : null;

    const lastUsable = broadcast
      ? broadcast.split(".").slice(0, 3).join(".") +
        "." +
        (parseInt(broadcast.split(".")[3] ?? "255") - 1)
      : null;

    // Calculate wildcard mask
    const wildcard = mask
      ?.split(".")
      .map((octet) => 255 - parseInt(octet))
      .join(".");

    // Binary representation
    const binaryIP = ip
      .split(".")
      .map((octet) => parseInt(octet).toString(2).padStart(8, "0"))
      .join(".");

    const binaryMask = mask
      ?.split(".")
      .map((octet) => parseInt(octet).toString(2).padStart(8, "0"))
      .join(".");

    return {
      network,
      broadcast,
      usableHosts,
      mask,
      firstUsable,
      lastUsable,
      wildcard,
      isPrivate,
      binaryIP,
      binaryMask,
      totalHosts: Math.pow(2, 32 - parsed.cidr),
    };
  }, [cidr, parsed]);

  const handleSubnetMaskChange = (value: string) => {
    setSubnetMask(value);
    const prefix = subnetMaskToCIDR(value);
    if (prefix !== null && parsed) {
      setCidr(`${parsed.address}/${prefix}`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>IP Subnet Calculator</CardTitle>
        <CardDescription>
          Calculate network details from CIDR notation or subnet mask
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs defaultValue="cidr">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="cidr">CIDR Notation</TabsTrigger>
            <TabsTrigger value="mask">Subnet Mask</TabsTrigger>
          </TabsList>

          <TabsContent value="cidr" className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="cidr">CIDR Notation</Label>
                {isValidCIDR && calculations?.isPrivate !== undefined && (
                  <Badge variant={calculations.isPrivate ? "secondary" : "default"}>
                    {calculations.isPrivate ? "Private" : "Public"}
                  </Badge>
                )}
              </div>
              <Input
                id="cidr"
                type="text"
                value={cidr}
                onChange={(e) => setCidr(e.target.value)}
                placeholder="192.168.1.0/24"
                className={cn(!isValidCIDR && cidr && "border-red-500")}
              />
              {!isValidCIDR && cidr && (
                <p className="text-sm text-red-500">Invalid CIDR notation</p>
              )}
            </div>

            {calculations && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <InfoField label="Network Address" value={calculations.network} />
                  <InfoField label="Broadcast Address" value={calculations.broadcast} />
                  <InfoField label="Subnet Mask" value={calculations.mask} />
                  <InfoField label="Wildcard Mask" value={calculations.wildcard} />
                  <InfoField label="First Usable IP" value={calculations.firstUsable} />
                  <InfoField label="Last Usable IP" value={calculations.lastUsable} />
                  <InfoField
                    label="Usable Hosts"
                    value={calculations.usableHosts.toLocaleString()}
                  />
                  <InfoField
                    label="Total Addresses"
                    value={calculations.totalHosts.toLocaleString()}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Binary Representation</Label>
                  <div className="bg-muted p-3 rounded-md font-mono text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">IP:</span>
                      <span>{calculations.binaryIP}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Mask:</span>
                      <span>{calculations.binaryMask}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="mask" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mask">Subnet Mask</Label>
              <Input
                id="mask"
                type="text"
                value={subnetMask}
                onChange={(e) => handleSubnetMaskChange(e.target.value)}
                placeholder="255.255.255.0"
              />
              {parsed && (
                <p className="text-sm text-muted-foreground">CIDR Prefix: /{parsed.cidr}</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

interface InfoFieldProps {
  label: string;
  value: string | null | undefined;
}

function InfoField({ label, value }: InfoFieldProps) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-mono text-sm font-medium">{value || "N/A"}</p>
    </div>
  );
}
