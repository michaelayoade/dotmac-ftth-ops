"use client";

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { Metadata } from "next";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@/components/ui/use-toast";
import { DiagnosticsDashboard } from "@/components/diagnostics/DiagnosticsDashboard";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function DiagnosticsPage() {
  const { toast } = useToast();

  const [subscriberId, setSubscriberId] = useState("");
  const [selectedSubscriber, setSelectedSubscriber] = useState<any>(null);
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    if (!subscriberId.trim()) {
      toast({
        title: "Error",
        description: "Please enter a subscriber ID or username",
        variant: "destructive",
      });
      return;
    }

    setSearching(true);
    try {
      // Try to find subscriber by ID or username
      const response = await apiClient.get(`/api/v1/subscribers/${subscriberId}`);
      setSelectedSubscriber(response.data);
    } catch (err: any) {
      toast({
        title: "Subscriber not found",
        description: "Please check the subscriber ID or username and try again",
        variant: "destructive",
      });
      setSelectedSubscriber(null);
    } finally {
      setSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Network Diagnostics</h1>
        <p className="text-gray-600 mt-1">
          Troubleshoot subscriber connectivity and service issues
        </p>
      </div>

      {/* Subscriber Search */}
      <Card>
        <CardHeader>
          <CardTitle>Select Subscriber</CardTitle>
          <CardDescription>
            Enter subscriber ID or username to run diagnostics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="subscriber-id">Subscriber ID / Username</Label>
              <Input
                id="subscriber-id"
                placeholder="Enter subscriber ID or username..."
                value={subscriberId}
                onChange={(e) => setSubscriberId(e.target.value)}
                onKeyPress={handleKeyPress}
                className="mt-1"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleSearch}
                disabled={searching || !subscriberId.trim()}
              >
                <Search className="w-4 h-4 mr-2" />
                Search
              </Button>
            </div>
          </div>

          {selectedSubscriber && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="font-medium text-gray-500">Subscriber</div>
                  <div className="font-semibold">{selectedSubscriber.username}</div>
                </div>
                <div>
                  <div className="font-medium text-gray-500">Status</div>
                  <div className="font-semibold">{selectedSubscriber.status}</div>
                </div>
                {selectedSubscriber.static_ipv4 && (
                  <div>
                    <div className="font-medium text-gray-500">IP Address</div>
                    <div className="font-semibold">{selectedSubscriber.static_ipv4}</div>
                  </div>
                )}
                {selectedSubscriber.service_plan_name && (
                  <div>
                    <div className="font-medium text-gray-500">Service Plan</div>
                    <div className="font-semibold">{selectedSubscriber.service_plan_name}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diagnostics Dashboard */}
      {selectedSubscriber && (
        <DiagnosticsDashboard
          subscriberId={selectedSubscriber.id}
          hasONU={!!selectedSubscriber.onu_serial}
          hasCPE={!!selectedSubscriber.cpe_mac_address}
        />
      )}

      {!selectedSubscriber && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="w-16 h-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              Search for a subscriber
            </h3>
            <p className="text-gray-500 max-w-md">
              Enter a subscriber ID or username above to start running network diagnostics
              and troubleshooting tools.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
