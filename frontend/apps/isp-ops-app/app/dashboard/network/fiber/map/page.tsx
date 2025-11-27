/**
 * Fiber Network Map Page
 * Interactive map view of fiber infrastructure
 */

"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import {
  Map as MapIcon,
  Cable,
  MapPin,
  Layers,
  Filter,
  Download,
  ZoomIn,
  AlertCircle,
  Briefcase,
} from "lucide-react";
import { FiberNetworkMap } from "@/components/fibermaps/FiberNetworkMap";
import {
  useFiberCables,
  useSplicePoints,
  useDistributionPoints,
  useServiceAreas,
} from "@/hooks/useFiberMaps";
import { useFieldInstallationJobs, type FieldInstallationJob } from "@/hooks/useJobs";
import { useActiveTechnicianLocations, type TechnicianLocation } from "@/hooks/useTechnicians";
import { useWebSocketTechnicianLocations } from "@/hooks/useWebSocketTechnicianLocations";
import type { FiberCable, SplicePoint, DistributionPoint } from "@/types/fibermaps";

export default function FiberMapPage() {
  const [selectedCable, setSelectedCable] = useState<FiberCable | null>(null);
  const [selectedSplicePoint, setSelectedSplicePoint] = useState<SplicePoint | null>(null);
  const [selectedDistPoint, setSelectedDistPoint] = useState<DistributionPoint | null>(null);
  const [selectedJob, setSelectedJob] = useState<FieldInstallationJob | null>(null);
  const [selectedTechnician, setSelectedTechnician] = useState<TechnicianLocation | null>(null);
  const [useWebSocket, setUseWebSocket] = useState(true); // Toggle between WebSocket and polling
  const [showLayers, setShowLayers] = useState({
    cables: true,
    splicePoints: true,
    distributionPoints: true,
    serviceAreas: true,
    jobs: true,
    technicians: true,
  });

  // Fetch fiber infrastructure data
  const { cables: cablesData, isLoading: cablesLoading } = useFiberCables();
  const { splicePoints: splicePointsData, isLoading: spliceLoading } = useSplicePoints();
  const { distributionPoints: distPointsData, isLoading: distLoading } = useDistributionPoints();
  const { serviceAreas: serviceAreasData, isLoading: areasLoading } = useServiceAreas();

  // Fetch field installation jobs
  const { data: jobsData, isLoading: jobsLoading } = useFieldInstallationJobs();

  // Real-time technician locations via WebSocket
  const {
    technicians: wsTechnicians,
    isConnected: wsConnected,
    isConnecting: wsConnecting,
    error: wsError,
  } = useWebSocketTechnicianLocations({
    enabled: useWebSocket,
    autoReconnect: true,
  });

  // Fallback: Polling-based technician locations (auto-refreshes every 15s)
  const { data: pollingTechnicians, isLoading: pollingLoading } = useActiveTechnicianLocations();

  // Use WebSocket data if connected, otherwise fall back to polling
  const techniciansData = useWebSocket && wsConnected ? wsTechnicians : pollingTechnicians;
  const techniciansLoading = useWebSocket ? wsConnecting : pollingLoading;

  const cables = cablesData || [];
  const splicePoints = splicePointsData || [];
  const distributionPoints = distPointsData || [];
  const serviceAreas = serviceAreasData || [];
  const jobs = jobsData?.jobs || [];
  const technicians = techniciansData || [];

  const isLoading =
    cablesLoading ||
    spliceLoading ||
    distLoading ||
    areasLoading ||
    jobsLoading ||
    techniciansLoading;

  // Calculate statistics
  const stats = {
    totalCables: cables.length,
    activeCables: cables.filter((c: any) => c.status === "active").length,
    totalFibers: cables.reduce((sum: number, c: any) => sum + (c.fiber_count || 0), 0),
    availableFibers: cables.reduce((sum: number, c: any) => sum + (c.available_fibers || 0), 0),
    splicePoints: splicePoints.length,
    distributionPoints: distributionPoints.length,
    totalCoverage: serviceAreas.length,
    activeJobs: jobs.filter((j) => ["pending", "assigned", "running"].includes(j.status)).length,
    completedJobs: jobs.filter((j) => j.status === "completed").length,
    activeTechnicians: technicians.filter((t) => t.status === "available" || t.status === "on_job")
      .length,
    totalTechnicians: technicians.length,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <MapIcon className="h-8 w-8 text-blue-600" />
              Fiber Network Map
            </h1>
            {/* WebSocket Connection Status */}
            {useWebSocket && (
              <Badge
                variant={wsConnected ? "default" : wsConnecting ? "secondary" : "destructive"}
                className="ml-2"
              >
                {wsConnected ? "🟢 Live" : wsConnecting ? "🟡 Connecting..." : "🔴 Disconnected"}
              </Badge>
            )}
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Interactive visualization of fiber infrastructure
            {useWebSocket && wsConnected && (
              <span className="ml-2 text-green-600 text-sm">• Real-time updates active</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={useWebSocket ? "default" : "outline"}
            size="sm"
            onClick={() => setUseWebSocket(!useWebSocket)}
            title={useWebSocket ? "Switch to polling mode" : "Switch to real-time WebSocket mode"}
          >
            {useWebSocket ? "🔄 Real-time" : "⏱️ Polling"}
          </Button>
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-11 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">{stats.totalCables}</div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Total Cables</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{stats.activeCables}</div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Active Cables</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-purple-600">{stats.totalFibers}</div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Total Fibers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-indigo-600">{stats.availableFibers}</div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Available</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600">{stats.splicePoints}</div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Splice Points</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-orange-600">{stats.distributionPoints}</div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Distribution</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-teal-600">{stats.totalCoverage}</div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Coverage Areas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-amber-600">{stats.activeJobs}</div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Active Jobs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-emerald-600">{stats.completedJobs}</div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-500">{stats.activeTechnicians}</div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Active Techs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-gray-600">{stats.totalTechnicians}</div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Total Techs</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MapIcon className="h-5 w-5" />
                  Network Map
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant={showLayers.cables ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowLayers((prev) => ({ ...prev, cables: !prev.cables }))}
                  >
                    <Cable className="h-4 w-4 mr-1" />
                    Cables
                  </Button>
                  <Button
                    variant={showLayers.splicePoints ? "default" : "outline"}
                    size="sm"
                    onClick={() =>
                      setShowLayers((prev) => ({ ...prev, splicePoints: !prev.splicePoints }))
                    }
                  >
                    <MapPin className="h-4 w-4 mr-1" />
                    Splices
                  </Button>
                  <Button
                    variant={showLayers.distributionPoints ? "default" : "outline"}
                    size="sm"
                    onClick={() =>
                      setShowLayers((prev) => ({
                        ...prev,
                        distributionPoints: !prev.distributionPoints,
                      }))
                    }
                  >
                    <Layers className="h-4 w-4 mr-1" />
                    Distribution
                  </Button>
                  <Button
                    variant={showLayers.jobs ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowLayers((prev) => ({ ...prev, jobs: !prev.jobs }))}
                  >
                    <Briefcase className="h-4 w-4 mr-1" />
                    Jobs
                  </Button>
                  <Button
                    variant={showLayers.technicians ? "default" : "outline"}
                    size="sm"
                    onClick={() =>
                      setShowLayers((prev) => ({ ...prev, technicians: !prev.technicians }))
                    }
                  >
                    <MapPin className="h-4 w-4 mr-1" />
                    Technicians
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <FiberNetworkMap
                cables={cables}
                splicePoints={splicePoints}
                distributionPoints={distributionPoints}
                serviceAreas={serviceAreas}
                jobs={jobs}
                technicians={technicians}
                showCables={showLayers.cables}
                showSplicePoints={showLayers.splicePoints}
                showDistributionPoints={showLayers.distributionPoints}
                showServiceAreas={showLayers.serviceAreas}
                showJobs={showLayers.jobs}
                showTechnicians={showLayers.technicians}
                height={700}
                onCableClick={setSelectedCable}
                onSplicePointClick={setSelectedSplicePoint}
                onDistributionPointClick={setSelectedDistPoint}
                onJobClick={setSelectedJob}
                onTechnicianClick={setSelectedTechnician}
                loading={isLoading}
                error={null}
              />
            </CardContent>
          </Card>
        </div>

        {/* Details Panel */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle>Selection Details</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="cables">Cables</TabsTrigger>
                  <TabsTrigger value="points">Points</TabsTrigger>
                  <TabsTrigger value="jobs">Jobs</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  {!selectedCable &&
                  !selectedSplicePoint &&
                  !selectedDistPoint &&
                  !selectedJob &&
                  !selectedTechnician ? (
                    <div className="text-center py-8 text-gray-500">
                      <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">Select an item on the map to view details</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {selectedCable && (
                        <div>
                          <h3 className="font-semibold mb-2">Selected Cable</h3>
                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="text-gray-600">Name:</span>
                              <span className="ml-2 font-medium">{selectedCable.cable_name}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Type:</span>
                              <Badge className="ml-2" variant="outline">
                                {selectedCable.cable_type}
                              </Badge>
                            </div>
                            <div>
                              <span className="text-gray-600">Status:</span>
                              <Badge
                                className="ml-2"
                                variant={
                                  selectedCable.status === "active" ? "default" : "secondary"
                                }
                              >
                                {selectedCable.status}
                              </Badge>
                            </div>
                            <div>
                              <span className="text-gray-600">Fibers:</span>
                              <span className="ml-2 font-medium">
                                {selectedCable.available_fibers}/{selectedCable.fiber_count}{" "}
                                available
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-600">Length:</span>
                              <span className="ml-2 font-medium">
                                {(selectedCable.length_meters / 1000).toFixed(2)} km
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {selectedSplicePoint && (
                        <div>
                          <h3 className="font-semibold mb-2">Selected Splice Point</h3>
                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="text-gray-600">Name:</span>
                              <span className="ml-2 font-medium">{selectedSplicePoint.name}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Type:</span>
                              <Badge className="ml-2" variant="outline">
                                {selectedSplicePoint.type}
                              </Badge>
                            </div>
                            <div>
                              <span className="text-gray-600">Status:</span>
                              <Badge
                                className="ml-2"
                                variant={
                                  selectedSplicePoint.status === "operational"
                                    ? "default"
                                    : "destructive"
                                }
                              >
                                {selectedSplicePoint.status}
                              </Badge>
                            </div>
                            <div>
                              <span className="text-gray-600">Capacity:</span>
                              <span className="ml-2 font-medium">
                                {selectedSplicePoint.splice_count}/{selectedSplicePoint.capacity}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {selectedDistPoint && (
                        <div>
                          <h3 className="font-semibold mb-2">Selected Distribution Point</h3>
                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="text-gray-600">Name:</span>
                              <span className="ml-2 font-medium">{selectedDistPoint.name}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Type:</span>
                              <Badge className="ml-2" variant="outline">
                                {selectedDistPoint.type.toUpperCase()}
                              </Badge>
                            </div>
                            <div>
                              <span className="text-gray-600">Capacity:</span>
                              <span className="ml-2 font-medium">
                                {selectedDistPoint.ports_used}/{selectedDistPoint.capacity} ports
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {selectedJob && (
                        <div>
                          <h3 className="font-semibold mb-2">Selected Job</h3>
                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="text-gray-600">Title:</span>
                              <span className="ml-2 font-medium">{selectedJob.title}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Status:</span>
                              <Badge
                                className="ml-2"
                                variant={
                                  selectedJob.status === "completed"
                                    ? "default"
                                    : selectedJob.status === "failed"
                                      ? "destructive"
                                      : selectedJob.status === "running"
                                        ? "default"
                                        : "secondary"
                                }
                              >
                                {selectedJob.status.toUpperCase()}
                              </Badge>
                            </div>
                            <div>
                              <span className="text-gray-600">Priority:</span>
                              <Badge className="ml-2" variant="outline">
                                {selectedJob.parameters?.priority || "normal"}
                              </Badge>
                            </div>
                            <div>
                              <span className="text-gray-600">Address:</span>
                              <span className="ml-2 font-medium text-xs">
                                {selectedJob.service_address}
                              </span>
                            </div>
                            {selectedJob.parameters?.ticket_number && (
                              <div>
                                <span className="text-gray-600">Ticket:</span>
                                <span className="ml-2 font-medium">
                                  {selectedJob.parameters.ticket_number}
                                </span>
                              </div>
                            )}
                            {selectedJob.assigned_to && (
                              <div>
                                <span className="text-gray-600">Assigned:</span>
                                <Badge className="ml-2" variant="outline">
                                  Technician
                                </Badge>
                              </div>
                            )}
                            {selectedJob.scheduled_start && (
                              <div>
                                <span className="text-gray-600">Scheduled:</span>
                                <span className="ml-2 font-medium text-xs">
                                  {new Date(selectedJob.scheduled_start).toLocaleString()}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {selectedTechnician && (
                        <div>
                          <h3 className="font-semibold mb-2">Selected Technician</h3>
                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="text-gray-600">Name:</span>
                              <span className="ml-2 font-medium">
                                {selectedTechnician.technician_name || "Technician"}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-600">Status:</span>
                              <Badge
                                className="ml-2"
                                variant={
                                  selectedTechnician.status === "available"
                                    ? "default"
                                    : selectedTechnician.status === "on_job"
                                      ? "default"
                                      : selectedTechnician.status === "on_break"
                                        ? "secondary"
                                        : "outline"
                                }
                              >
                                {selectedTechnician.status.replace("_", " ").toUpperCase()}
                              </Badge>
                            </div>
                            {selectedTechnician.latitude && selectedTechnician.longitude && (
                              <div>
                                <span className="text-gray-600">Location:</span>
                                <span className="ml-2 font-medium text-xs">
                                  {selectedTechnician.latitude.toFixed(4)},{" "}
                                  {selectedTechnician.longitude.toFixed(4)}
                                </span>
                              </div>
                            )}
                            {selectedTechnician.last_update && (
                              <div>
                                <span className="text-gray-600">Last Update:</span>
                                <span className="ml-2 font-medium text-xs">
                                  {new Date(selectedTechnician.last_update).toLocaleString()}
                                </span>
                              </div>
                            )}
                            <div className="pt-2 text-xs text-gray-500">
                              Live location updates every 15 seconds
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="cables" className="space-y-2">
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {cables.map((cable: any) => (
                      <div
                        key={cable.id}
                        className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        onClick={() => setSelectedCable(cable)}
                      >
                        <div className="font-medium text-sm">{cable.cable_name || cable.name}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          {cable.cable_type || "Unknown"} • {cable.status}
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="points" className="space-y-2">
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {splicePoints.map((point: any) => (
                      <div
                        key={point.id}
                        className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        onClick={() => setSelectedSplicePoint(point)}
                      >
                        <div className="font-medium text-sm">{point.name}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          {point.type || "Unknown"} • {point.status}
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="jobs" className="space-y-2">
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {jobs.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Briefcase className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">No field installation jobs</p>
                      </div>
                    ) : (
                      jobs.map((job) => (
                        <div
                          key={job.id}
                          className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                          onClick={() => setSelectedJob(job)}
                        >
                          <div className="font-medium text-sm">{job.title}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge
                              variant={
                                job.status === "completed"
                                  ? "default"
                                  : job.status === "failed"
                                    ? "destructive"
                                    : "outline"
                              }
                              className="text-xs"
                            >
                              {job.status}
                            </Badge>
                            <span className="text-xs text-gray-600 dark:text-gray-400">
                              {job.parameters?.ticket_number || job.id.slice(0, 8)}
                            </span>
                          </div>
                          {job.service_address && (
                            <div className="text-xs text-gray-500 mt-1 truncate">
                              {job.service_address}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
