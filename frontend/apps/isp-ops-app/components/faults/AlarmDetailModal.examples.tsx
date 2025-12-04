/**
 * AlarmDetailModal Examples
 *
 * Example implementations and usage patterns for the AlarmDetailModal component.
 */

"use client";

import { useState } from "react";
import { Button } from "@dotmac/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { AlarmDetailModal } from "./AlarmDetailModal";
import type { Alarm } from "@/hooks/useFaults";

// ============================================================================
// Example 1: Basic Usage
// ============================================================================

export function BasicAlarmDetailExample() {
  const [selectedAlarm, setSelectedAlarm] = useState<Alarm | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Sample alarm data
  const sampleAlarm: Alarm = {
    id: "1",
    tenant_id: "tenant-123",
    alarm_id: "ALM-2024-001",
    severity: "critical",
    status: "active",
    source: "genieacs",
    alarm_type: "DEVICE_OFFLINE",
    title: "ONU Device Offline",
    description: "Customer ONU device has not communicated with the system for 15 minutes",
    message: "Device heartbeat timeout exceeded threshold",
    resource_type: "onu",
    resource_id: "onu-abc123",
    resource_name: "ONU-CUST-001",
    customer_id: "cust-456",
    customer_name: "John Doe",
    subscriber_count: 1,
    correlation_id: "corr-789",
    correlation_action: "aggregate",
    is_root_cause: true,
    first_occurrence: new Date(Date.now() - 3600000).toISOString(),
    last_occurrence: new Date().toISOString(),
    occurrence_count: 5,
    tags: {
      location: "Zone-A",
      priority: "high",
      customer_tier: "premium",
    },
    metadata: {
      device_model: "ONU-X1000",
      firmware_version: "2.3.1",
      last_ip: "192.168.1.100",
      signal_strength: -25,
    },
    probable_cause: "Power outage or network connectivity loss",
    recommended_action:
      "Check physical connection and power supply. Contact customer if issue persists.",
    created_at: new Date(Date.now() - 3600000).toISOString(),
    updated_at: new Date().toISOString(),
  };

  const handleOpenModal = () => {
    setSelectedAlarm(sampleAlarm);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedAlarm(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Basic Usage Example</CardTitle>
        <CardDescription>
          Simple implementation showing how to open the alarm detail modal
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={handleOpenModal}>View Alarm Details</Button>

        <AlarmDetailModal alarm={selectedAlarm} open={isModalOpen} onClose={handleCloseModal} />
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Example 2: With Update Callback
// ============================================================================

export function AlarmDetailWithUpdateExample() {
  const [selectedAlarm, setSelectedAlarm] = useState<Alarm | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [updateCount, setUpdateCount] = useState(0);

  const sampleAlarm: Alarm = {
    id: "2",
    tenant_id: "tenant-123",
    alarm_id: "ALM-2024-002",
    severity: "major",
    status: "acknowledged",
    source: "voltha",
    alarm_type: "HIGH_LATENCY",
    title: "High Network Latency",
    description: "Network latency exceeded threshold of 100ms",
    resource_type: "olt",
    resource_name: "OLT-CORE-01",
    subscriber_count: 45,
    is_root_cause: false,
    first_occurrence: new Date(Date.now() - 7200000).toISOString(),
    last_occurrence: new Date(Date.now() - 1800000).toISOString(),
    occurrence_count: 12,
    acknowledged_at: new Date(Date.now() - 3600000).toISOString(),
    correlation_action: "aggregate",
    tags: {},
    metadata: {
      avg_latency_ms: 125,
      peak_latency_ms: 180,
    },
    created_at: new Date(Date.now() - 7200000).toISOString(),
    updated_at: new Date().toISOString(),
  };

  const handleUpdate = () => {
    setUpdateCount((prev) => prev + 1);
    console.log("Alarm updated, refresh your data here");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>With Update Callback</CardTitle>
        <CardDescription>
          Handle updates when alarm is modified (Updates: {updateCount})
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          onClick={() => {
            setSelectedAlarm(sampleAlarm);
            setIsModalOpen(true);
          }}
        >
          View Acknowledged Alarm
        </Button>

        <AlarmDetailModal
          alarm={selectedAlarm}
          open={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedAlarm(null);
          }}
          onUpdate={handleUpdate}
        />
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Example 3: Multiple Severity Levels
// ============================================================================

export function MultipleSeverityExample() {
  const [selectedAlarm, setSelectedAlarm] = useState<Alarm | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const alarmsBySeverity: Record<string, Alarm> = {
    critical: {
      id: "3",
      tenant_id: "tenant-123",
      alarm_id: "ALM-CRIT-001",
      severity: "critical",
      status: "active",
      source: "netbox",
      alarm_type: "FIBER_CUT",
      title: "Fiber Cut Detected",
      description: "Physical fiber cut detected on main trunk",
      subscriber_count: 250,
      is_root_cause: true,
      first_occurrence: new Date().toISOString(),
      last_occurrence: new Date().toISOString(),
      occurrence_count: 1,
      correlation_action: "none",
      tags: {},
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    major: {
      id: "4",
      tenant_id: "tenant-123",
      alarm_id: "ALM-MAJ-001",
      severity: "major",
      status: "active",
      source: "genieacs",
      alarm_type: "DEVICE_ERROR",
      title: "Multiple Device Errors",
      description: "Multiple devices reporting errors",
      subscriber_count: 12,
      is_root_cause: false,
      first_occurrence: new Date().toISOString(),
      last_occurrence: new Date().toISOString(),
      occurrence_count: 8,
      correlation_action: "aggregate",
      tags: {},
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    minor: {
      id: "5",
      tenant_id: "tenant-123",
      alarm_id: "ALM-MIN-001",
      severity: "minor",
      status: "active",
      source: "manual",
      alarm_type: "CONFIG_DRIFT",
      title: "Configuration Drift",
      description: "Device configuration differs from baseline",
      subscriber_count: 0,
      is_root_cause: true,
      first_occurrence: new Date().toISOString(),
      last_occurrence: new Date().toISOString(),
      occurrence_count: 1,
      correlation_action: "none",
      tags: {},
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    warning: {
      id: "6",
      tenant_id: "tenant-123",
      alarm_id: "ALM-WARN-001",
      severity: "warning",
      status: "active",
      source: "voltha",
      alarm_type: "THRESHOLD_WARNING",
      title: "Bandwidth Threshold Warning",
      description: "Bandwidth usage approaching limit",
      subscriber_count: 5,
      is_root_cause: false,
      first_occurrence: new Date().toISOString(),
      last_occurrence: new Date().toISOString(),
      occurrence_count: 3,
      correlation_action: "none",
      tags: {},
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    info: {
      id: "7",
      tenant_id: "tenant-123",
      alarm_id: "ALM-INFO-001",
      severity: "info",
      status: "active",
      source: "api",
      alarm_type: "SCHEDULED_MAINTENANCE",
      title: "Scheduled Maintenance",
      description: "Planned maintenance window",
      subscriber_count: 100,
      is_root_cause: false,
      first_occurrence: new Date().toISOString(),
      last_occurrence: new Date().toISOString(),
      occurrence_count: 1,
      correlation_action: "none",
      tags: {},
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  };

  const handleViewAlarm = (severity: string) => {
    setSelectedAlarm(alarmsBySeverity[severity] ?? null);
    setIsModalOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Multiple Severity Levels</CardTitle>
        <CardDescription>View alarms with different severity levels</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => handleViewAlarm("critical")} variant="destructive">
            Critical Alarm
          </Button>
          <Button
            onClick={() => handleViewAlarm("major")}
            className="bg-orange-500 hover:bg-orange-600"
          >
            Major Alarm
          </Button>
          <Button
            onClick={() => handleViewAlarm("minor")}
            className="bg-yellow-500 hover:bg-yellow-600"
          >
            Minor Alarm
          </Button>
          <Button
            onClick={() => handleViewAlarm("warning")}
            className="bg-blue-500 hover:bg-blue-600"
          >
            Warning Alarm
          </Button>
          <Button onClick={() => handleViewAlarm("info")} variant="secondary">
            Info Alarm
          </Button>
        </div>

        <AlarmDetailModal
          alarm={selectedAlarm}
          open={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedAlarm(null);
          }}
        />
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Example 4: All Examples Combined
// ============================================================================

export function AlarmDetailModalExamples() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Alarm Detail Modal Examples</h1>
        <p className="text-muted-foreground">
          Interactive examples demonstrating various use cases of the AlarmDetailModal component
        </p>
      </div>

      <BasicAlarmDetailExample />
      <AlarmDetailWithUpdateExample />
      <MultipleSeverityExample />
    </div>
  );
}
