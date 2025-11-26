/**
 * IP Address List Component
 *
 * Displays allocated IP addresses with filtering and management.
 * Shared between ISP Ops and Platform Admin applications.
 */

"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@dotmac/ui";
import { MoreHorizontal, Search, Copy, CheckCircle2 } from "lucide-react";
import React, { useState } from "react";

export interface IPAddress {
  id: number;
  address: string;
  status: {
    value: string;
    label: string;
  };
  dns_name?: string;
  description?: string;
  tenant?: {
    id: number;
    name: string;
  };
}

export enum IPFamily {
  IPv4 = "IPv4",
  IPv6 = "IPv6",
}

interface IPUtilities {
  detectIPFamily: (ip: string) => IPFamily;
  formatIPAddress: (address: string) => string;
}

interface DualStackBadgeComponent {
  (props: { ipv4?: string; ipv6?: string }): React.ReactElement;
}

export interface IPAddressListProps {
  addresses: IPAddress[];
  onEditAddress?: (address: IPAddress) => void;
  onDeleteAddress?: (addressId: number) => void;
  onCopyAddress?: (address: string) => void;
  isLoading?: boolean;
  showTenant?: boolean;
  ipUtilities: IPUtilities;
  DualStackBadge: DualStackBadgeComponent;
}

export function IPAddressList({
  addresses,
  onEditAddress,
  onDeleteAddress,
  onCopyAddress,
  isLoading = false,
  showTenant = false,
  ipUtilities,
  DualStackBadge,
}: IPAddressListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [familyFilter, setFamilyFilter] = useState<"all" | "ipv4" | "ipv6">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "reserved">("all");

  const filteredAddresses = addresses.filter((addr) => {
    const matchesSearch =
      addr.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      addr.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      addr.dns_name?.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    const family = ipUtilities.detectIPFamily(addr.address.split("/")[0] ?? "");
    if (familyFilter === "ipv4" && family !== IPFamily.IPv4) return false;
    if (familyFilter === "ipv6" && family !== IPFamily.IPv6) return false;

    if (statusFilter !== "all" && addr.status.value !== statusFilter) return false;

    return true;
  });

  // Group by DNS name for dual-stack display
  const groupedAddresses = groupByDNSName(filteredAddresses);

  return (
    <Card>
      <CardHeader>
        <CardTitle>IP Addresses</CardTitle>
        <CardDescription>{addresses.length} allocated IP addresses</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search IP addresses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={familyFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFamilyFilter("all")}
            >
              All
            </Button>
            <Button
              variant={familyFilter === "ipv4" ? "default" : "outline"}
              size="sm"
              onClick={() => setFamilyFilter("ipv4")}
            >
              IPv4
            </Button>
            <Button
              variant={familyFilter === "ipv6" ? "default" : "outline"}
              size="sm"
              onClick={() => setFamilyFilter("ipv6")}
            >
              IPv6
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              variant={statusFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("all")}
            >
              All Status
            </Button>
            <Button
              variant={statusFilter === "active" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("active")}
            >
              Active
            </Button>
            <Button
              variant={statusFilter === "reserved" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("reserved")}
            >
              Reserved
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>IP Address</TableHead>
                <TableHead>Family</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>DNS Name</TableHead>
                {showTenant && <TableHead>Tenant</TableHead>}
                <TableHead>Description</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={showTenant ? 7 : 6}
                    className="text-center text-muted-foreground"
                  >
                    Loading IP addresses...
                  </TableCell>
                </TableRow>
              ) : groupedAddresses.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={showTenant ? 7 : 6}
                    className="text-center text-muted-foreground"
                  >
                    No IP addresses found
                  </TableCell>
                </TableRow>
              ) : (
                groupedAddresses.map((group) => (
                  <AddressGroupRow
                    key={group.key}
                    group={group}
                    showTenant={showTenant}
                    {...(onEditAddress && { onEdit: onEditAddress })}
                    {...(onDeleteAddress && { onDelete: onDeleteAddress })}
                    {...(onCopyAddress && { onCopy: onCopyAddress })}
                    ipUtilities={ipUtilities}
                    DualStackBadge={DualStackBadge}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

interface AddressGroup {
  key: string;
  addresses: IPAddress[];
  isDualStack: boolean;
}

function groupByDNSName(addresses: IPAddress[]): AddressGroup[] {
  const groups = new Map<string, IPAddress[]>();

  addresses.forEach((addr) => {
    const key = addr.dns_name || `single-${addr.id}`;
    const existing = groups.get(key) || [];
    groups.set(key, [...existing, addr]);
  });

  return Array.from(groups.entries()).map(([key, addrs]) => ({
    key,
    addresses: addrs,
    isDualStack: addrs.length > 1,
  }));
}

interface AddressGroupRowProps {
  group: AddressGroup;
  showTenant: boolean;
  onEdit?: (address: IPAddress) => void;
  onDelete?: (addressId: number) => void;
  onCopy?: (address: string) => void;
  ipUtilities: IPUtilities;
  DualStackBadge: DualStackBadgeComponent;
}

function AddressGroupRow({
  group,
  showTenant,
  onEdit,
  onDelete,
  onCopy,
  ipUtilities,
  DualStackBadge,
}: AddressGroupRowProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (address: string) => {
    const ipOnly = address.split("/")[0] ?? "";
    navigator.clipboard.writeText(ipOnly);
    onCopy?.(ipOnly);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (group.isDualStack) {
    const ipv4 = group.addresses.find(
      (a) => ipUtilities.detectIPFamily(a.address.split("/")[0] ?? "") === IPFamily.IPv4,
    );
    const ipv6 = group.addresses.find(
      (a) => ipUtilities.detectIPFamily(a.address.split("/")[0] ?? "") === IPFamily.IPv6,
    );
    const primary = ipv4 || ipv6!;

    return (
      <TableRow>
        <TableCell>
          <div className="space-y-1">
            {ipv4 && (
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm">
                  {ipUtilities.formatIPAddress(ipv4.address)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(ipv4.address)}
                  className="h-6 px-2"
                >
                  {copied ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            )}
            {ipv6 && (
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm">
                  {ipUtilities.formatIPAddress(ipv6.address)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(ipv6.address)}
                  className="h-6 px-2"
                >
                  {copied ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            )}
          </div>
        </TableCell>
        <TableCell>
          <DualStackBadge
            {...(ipv4 && { ipv4: ipv4.address })}
            {...(ipv6 && { ipv6: ipv6.address })}
          />
        </TableCell>
        <TableCell>
          <Badge variant={primary.status.value === "active" ? "default" : "secondary"}>
            {primary.status.label}
          </Badge>
        </TableCell>
        <TableCell>
          {primary.dns_name ? (
            <span className="text-sm">{primary.dns_name}</span>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </TableCell>
        {showTenant && (
          <TableCell>
            {primary.tenant ? (
              <Badge variant="outline">{primary.tenant.name}</Badge>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </TableCell>
        )}
        <TableCell className="max-w-[200px] truncate">
          {primary.description || <span className="text-muted-foreground">-</span>}
        </TableCell>
        <TableCell>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              {onEdit && <DropdownMenuItem onClick={() => onEdit(primary)}>Edit</DropdownMenuItem>}
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  {ipv4 && (
                    <DropdownMenuItem onClick={() => onDelete(ipv4.id)} className="text-red-600">
                      Delete IPv4
                    </DropdownMenuItem>
                  )}
                  {ipv6 && (
                    <DropdownMenuItem onClick={() => onDelete(ipv6.id)} className="text-red-600">
                      Delete IPv6
                    </DropdownMenuItem>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
    );
  }

  // Single address
  const addr = group.addresses[0];
  if (!addr) return null;
  const family = ipUtilities.detectIPFamily(addr.address.split("/")[0] ?? "");

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="font-mono font-medium">{ipUtilities.formatIPAddress(addr.address)}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleCopy(addr.address)}
            className="h-6 px-2"
          >
            {copied ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={family === IPFamily.IPv4 ? "default" : "secondary"}>
          {family === IPFamily.IPv4 ? "IPv4" : "IPv6"}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant={addr.status.value === "active" ? "default" : "secondary"}>
          {addr.status.label}
        </Badge>
      </TableCell>
      <TableCell>
        {addr.dns_name ? (
          <span className="text-sm">{addr.dns_name}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      {showTenant && (
        <TableCell>
          {addr.tenant ? (
            <Badge variant="outline">{addr.tenant.name}</Badge>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </TableCell>
      )}
      <TableCell className="max-w-[200px] truncate">
        {addr.description || <span className="text-muted-foreground">-</span>}
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            {onEdit && <DropdownMenuItem onClick={() => onEdit(addr)}>Edit</DropdownMenuItem>}
            {onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onDelete(addr.id)} className="text-red-600">
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
