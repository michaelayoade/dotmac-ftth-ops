/**
 * AlarmDetailModal Component
 *
 * Wrapper that connects the shared AlarmDetailModal to app-specific API client and types.
 */

"use client";

import { useState, useCallback } from "react";
import { AlarmDetailModal as SharedAlarmDetailModal } from "@dotmac/features/faults";
import type { AlarmHistory, AlarmNote, RelatedTicket } from "@dotmac/features/faults";
import type { Alarm } from "@/hooks/useFaults";
import { apiClient } from "@/lib/api/client";

interface AlarmDetailModalProps {
  alarm: Alarm | null;
  open: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

export function AlarmDetailModal(props: AlarmDetailModalProps) {
  const { alarm, open } = props;

  const [history, setHistory] = useState<AlarmHistory[]>([]);
  const [notes, setNotes] = useState<AlarmNote[]>([]);
  const [relatedTickets, setRelatedTickets] = useState<RelatedTicket[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAlarmDetails = useCallback(
    async (alarmId: string) => {
      if (!alarm) return;

      setIsLoading(true);
      try {
        // Fetch history
        const historyResponse = await apiClient.get(`/api/v1/faults/alarms/${alarmId}/history`);
        setHistory(historyResponse.data || []);

        // Fetch notes
        const notesResponse = await apiClient.get(`/api/v1/faults/alarms/${alarmId}/notes`);
        setNotes(notesResponse.data || []);

        // Fetch related tickets if ticket_id exists
        if (alarm.ticket_id) {
          const ticketResponse = await apiClient.get(`/api/v1/tickets/${alarm.ticket_id}`);
          setRelatedTickets([ticketResponse.data]);
        }
      } catch (error) {
        console.error("Failed to fetch alarm details:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [alarm],
  );

  const handleAcknowledge = async (alarmId: string) => {
    await apiClient.post(`/api/v1/faults/alarms/${alarmId}/acknowledge`, {
      note: "Acknowledged from detail view",
    });
    props.onUpdate?.();
    fetchAlarmDetails(alarmId);
  };

  const handleClear = async (alarmId: string) => {
    await apiClient.post(`/api/v1/faults/alarms/${alarmId}/clear`, {});
    props.onUpdate?.();
    fetchAlarmDetails(alarmId);
  };

  const handleCreateTicket = async (alarmId: string) => {
    if (!alarm) return;

    await apiClient.post(`/api/v1/faults/alarms/${alarmId}/create-ticket`, {
      priority: alarm.severity === "critical" ? "urgent" : "normal",
    });
    props.onUpdate?.();
    fetchAlarmDetails(alarmId);
  };

  const handleAddNote = async (alarmId: string, content: string) => {
    await apiClient.post(`/api/v1/faults/alarms/${alarmId}/notes`, {
      content,
    });
    fetchAlarmDetails(alarmId);
  };

  return (
    <SharedAlarmDetailModal
      {...props}
      history={history}
      notes={notes}
      relatedTickets={relatedTickets}
      isLoading={isLoading}
      onAcknowledge={handleAcknowledge}
      onClear={handleClear}
      onCreateTicket={handleCreateTicket}
      onAddNote={handleAddNote}
      onFetchDetails={fetchAlarmDetails}
    />
  );
}
