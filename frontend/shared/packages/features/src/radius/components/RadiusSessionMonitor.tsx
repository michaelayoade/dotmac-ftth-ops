"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Activity, Search, RefreshCw, XCircle, Download, Upload, Clock } from "lucide-react";
import React, { useState } from "react";

import type { RADIUSSession } from "../types";

export interface RadiusSessionMonitorProps {
  sessions: RADIUSSession[];
  isLoading: boolean;
  onRefresh: () => void;
  onDisconnect: (session: RADIUSSession) => void;
  isDisconnecting?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

function formatDistanceToNow(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? "s" : ""} ago`;
}

export function RadiusSessionMonitor({
  sessions,
  isLoading,
  onRefresh,
  onDisconnect,
  isDisconnecting = false,
}: RadiusSessionMonitorProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Filter sessions by search query
  const filteredSessions = sessions?.filter(
    (session) =>
      session.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.nasipaddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (session.framedipaddress ?? "").toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Calculate total bandwidth
  const totalDownload = sessions?.reduce((sum, s) => sum + (s.acctinputoctets ?? 0), 0) ?? 0;
  const totalUpload = sessions?.reduce((sum, s) => sum + (s.acctoutputoctets ?? 0), 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Active RADIUS Sessions</h1>
          <p className="text-muted-foreground">View and manage active RADIUS sessions</p>
        </div>
        <Button onClick={onRefresh} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sessions?.length ?? 0}</div>
            <p className="text-xs text-muted-foreground">Currently online</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Download</CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBytes(totalDownload)}</div>
            <p className="text-xs text-muted-foreground">Data downloaded</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Upload</CardTitle>
            <Upload className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBytes(totalUpload)}</div>
            <p className="text-xs text-muted-foreground">Data uploaded</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by username, NAS IP, or framed IP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sessions Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading sessions...</div>
          ) : filteredSessions && filteredSessions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>NAS IP</TableHead>
                  <TableHead>Framed IP</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Download</TableHead>
                  <TableHead>Upload</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSessions.map((session) => (
                  <TableRow key={session.radacctid}>
                    <TableCell className="font-medium">{session.username}</TableCell>
                    <TableCell>{session.nasipaddress}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {session.framedipaddress && (
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-xs">
                              IPv4
                            </Badge>
                            <span className="text-sm">{session.framedipaddress}</span>
                          </div>
                        )}
                        {session.framedipv6address && (
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-xs">
                              IPv6
                            </Badge>
                            <span className="text-sm">{session.framedipv6address}</span>
                          </div>
                        )}
                        {!session.framedipaddress && !session.framedipv6address && (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {session.acctsessiontime ? (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {formatDuration(session.acctsessiontime)}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Starting...</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Download className="h-3 w-3 text-muted-foreground" />
                        {formatBytes(session.acctinputoctets ?? 0)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Upload className="h-3 w-3 text-muted-foreground" />
                        {formatBytes(session.acctoutputoctets ?? 0)}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatBytes(session.total_bytes)}
                    </TableCell>
                    <TableCell>
                      {session.acctstarttime ? (
                        formatDistanceToNow(new Date(session.acctstarttime))
                      ) : (
                        <span className="text-muted-foreground">Unknown</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDisconnect(session)}
                        disabled={isDisconnecting}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Disconnect
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-8 text-center">
              <Activity className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No active sessions</h3>
              <p className="text-muted-foreground">
                {searchQuery
                  ? "No sessions match your search criteria."
                  : "There are currently no active RADIUS sessions."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
