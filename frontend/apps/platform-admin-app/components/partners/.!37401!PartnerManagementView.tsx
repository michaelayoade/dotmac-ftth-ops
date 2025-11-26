"use client";

import { useState } from "react";
import { usePartners, useDeletePartner, Partner } from "@/hooks/usePartners";
import { Users, Plus } from "lucide-react";
import PartnerMetrics from "@/components/partners/PartnerMetrics";
import PartnersList from "@/components/partners/PartnersList";
import CreatePartnerModal from "@/components/partners/CreatePartnerModal";
import { PageHeader } from "@dotmac/ui";
import { EmptyState } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { ConfirmDialog } from "@dotmac/ui";
import { logger } from "@/lib/logger";

export function PartnerManagementView() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [partnerToDelete, setPartnerToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data, isLoading, error } = usePartners(statusFilter);
  const deletePartner = useDeletePartner();

  const handleEdit = (partner: Partner) => {
    setSelectedPartner(partner);
    setShowCreateModal(true);
  };

  const handleDelete = (partnerId: string) => {
    setPartnerToDelete(partnerId);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!partnerToDelete) return;

    setIsDeleting(true);
    try {
      await deletePartner.mutateAsync(partnerToDelete);
      logger.info("Partner deleted successfully", {
        partnerId: partnerToDelete,
      });
      setShowDeleteDialog(false);
      setPartnerToDelete(null);
    } catch (err) {
      logger.error("Failed to delete partner", {
        partnerId: partnerToDelete,
        error: err,
      });
      alert("Failed to delete partner");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setSelectedPartner(null);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="py-12 text-center text-muted-foreground" role="status" aria-live="polite">
