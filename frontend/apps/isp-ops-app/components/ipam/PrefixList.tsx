"use client";

/**
 * Prefix List Component
 *
 * Displays and manages IP prefixes (IPv4 and IPv6)
 */

import React, { useState } from "react";
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
import { Prefix } from "@/types/netbox";
import { detectIPFamily, IPFamily, getIPv4UsableHosts, parseCIDR } from "@/lib/utils/ip-address";
import { MoreHorizontal, Plus, Search } from "lucide-react";

export interface PrefixListProps {
  prefixes: Prefix[];
  onCreatePrefix?: () => void;
  onEditPrefix?: (prefix: Prefix) => void;
  onDeletePrefix?: (prefixId: number) => void;
  onAllocateIP?: (prefixId: number) => void;
  isLoading?: boolean;
}

export function PrefixList({
  prefixes,
  onCreatePrefix,
  onEditPrefix,
  onDeletePrefix,
  onAllocateIP,
  isLoading = false,
}: PrefixListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [familyFilter, setFamilyFilter] = useState<"all" | "ipv4" | "ipv6">("all");

  const filteredPrefixes = prefixes.filter((prefix) => {
    const matchesSearch =
      prefix.prefix.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prefix.description?.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (familyFilter === "all") return true;

    const family = detectIPFamily(prefix.prefix.split("/")[0] ?? "");
    if (familyFilter === "ipv4") return family === IPFamily.IPv4;
    if (familyFilter === "ipv6") return family === IPFamily.IPv6;

    return true;
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>IP Prefixes</CardTitle>
            <CardDescription>Manage IPv4 and IPv6 prefixes</CardDescription>
          </div>
          {onCreatePrefix && (
            <Button onClick={onCreatePrefix}>
              <Plus className="mr-2 h-4 w-4" />
              Add Prefix
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search prefixes..."
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
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prefix</TableHead>
                <TableHead>Family</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Loading prefixes...
                  </TableCell>
                </TableRow>
              ) : filteredPrefixes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No prefixes found
                  </TableCell>
                </TableRow>
              ) : (
                filteredPrefixes.map((prefix) => (
                  <PrefixRow
                    key={prefix.id}
                    prefix={prefix}
                    {...(onEditPrefix ? { onEdit: onEditPrefix } : {})}
                    {...(onDeletePrefix ? { onDelete: onDeletePrefix } : {})}
                    {...(onAllocateIP ? { onAllocateIP } : {})}
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

interface PrefixRowProps {
  prefix: Prefix;
  onEdit?: (prefix: Prefix) => void;
  onDelete?: (prefixId: number) => void;
  onAllocateIP?: (prefixId: number) => void;
}

function PrefixRow({ prefix, onEdit, onDelete, onAllocateIP }: PrefixRowProps) {
  const parsed = parseCIDR(prefix.prefix);
  const family = parsed?.family;

  const usableHosts = family === IPFamily.IPv4 && parsed ? getIPv4UsableHosts(parsed.cidr) : null;

  return (
    <TableRow>
      <TableCell>
        <span className="font-mono font-medium">{prefix.prefix}</span>
      </TableCell>
      <TableCell>
        <Badge variant={family === IPFamily.IPv4 ? "default" : "secondary"}>
          {family === IPFamily.IPv4 ? "IPv4" : "IPv6"}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge
          variant={
            prefix.status.value === "active"
              ? "default"
              : prefix.status.value === "reserved"
                ? "secondary"
                : "outline"
          }
        >
          {prefix.status.label}
        </Badge>
      </TableCell>
      <TableCell>
        {prefix.role ? (
          <Badge variant="outline">{prefix.role.name}</Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell>
        {usableHosts !== null ? (
          <span className="text-sm">{usableHosts.toLocaleString()} hosts</span>
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        )}
      </TableCell>
      <TableCell className="max-w-[200px] truncate">
        {prefix.description || <span className="text-muted-foreground">-</span>}
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
            {onAllocateIP && (
              <>
                <DropdownMenuItem onClick={() => onAllocateIP(prefix.id)}>
                  Allocate IP
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            {onEdit && <DropdownMenuItem onClick={() => onEdit(prefix)}>Edit</DropdownMenuItem>}
            {onDelete && (
              <DropdownMenuItem onClick={() => onDelete(prefix.id)} className="text-red-600">
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
